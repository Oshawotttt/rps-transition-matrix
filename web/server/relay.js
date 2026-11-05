// The relay server: holds the one match in memory, runs it through flow.js and sends each screen its view.
// Mounted in Vite's dev and preview servers by relayPlugin(); screens read Server-Sent Events and send POSTs.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateBot } from "../src/game.js";
import { hostView, newFlow, nextRound, pickMove, playerView, throwMove } from "../src/flow.js";

const DEFAULT_BOTS_DIR = fileURLToPath(new URL("../public/bots/", import.meta.url));
const DEFAULT_BOT = "bot_rps_human_combined.json";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const PING_MS = 20000;
// a plain file name ending in .json: no folder separators, and ".." is refused separately
const BOT_NAME = /^[A-Za-z0-9_.-]+\.json$/;
// flow.js error codes: a bad move is bad input, the others a call at the wrong moment
const FLOW_STATUS = { move: 400, phase: 409, wrong: 409 };

// An error the middleware answers with `status` and {error: message}.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// True when the browser runs on the laptop that runs the server.
export function isLoopback(req) {
  return LOOPBACK.has(req.socket.remoteAddress);
}

function readBot(botsDir, name) {
  return validateBot(JSON.parse(readFileSync(join(botsDir, name), "utf-8")));
}

// The JSON body as an object; anything else is a 400.
async function readBody(req) {
  let text = "";
  for await (const chunk of req) text += chunk;
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "the body is not JSON");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "the body must be a JSON object");
  return body;
}

// Runs one flow.js call, turning its error codes into HTTP statuses.
function step(fn) {
  try {
    return fn();
  } catch (e) {
    if (e.code in FLOW_STATUS) throw new HttpError(FLOW_STATUS[e.code], e.message);
    throw e;
  }
}

export function createRelay({ botsDir = DEFAULT_BOTS_DIR, isLocal = isLoopback } = {}) {
  let botName = DEFAULT_BOT;
  let flow = newFlow(readBot(botsDir, botName), 3);
  // the seat holder's id, or null when the seat is empty
  let seat = null;
  // open events streams: {res, role, seat}
  const streams = new Set();

  function stateFor(s) {
    if (s.role === "host") {
      const playerOnline = seat !== null && [...streams].some((o) => o.role === "player" && o.seat === seat);
      return { role: "host", bot: botName, flow: hostView(flow), seat: seat === null ? "empty" : "taken", playerOnline };
    }
    if (seat !== null && s.seat === seat) return { role: "player", seat: "mine", view: playerView(flow) };
    return { role: "player", seat: seat === null ? "empty" : "taken", view: null };
  }

  function send(s) {
    s.res.write(`event: state\ndata: ${JSON.stringify(stateFor(s))}\n\n`);
  }

  function broadcast() {
    for (const s of streams) send(s);
  }

  function fail(res, status, message) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }

  function events(req, res, query) {
    const role = query.get("role");
    if (role !== "host" && role !== "player") return fail(res, 400, "role must be host or player");
    if (role === "host" && !isLocal(req)) return fail(res, 403, "hosting works only on the laptop running the server");
    const id = query.get("seat");
    if (role === "player" && !id) return fail(res, 400, "a player stream needs a seat id");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const s = { res, role, seat: role === "player" ? id : null };
    streams.add(s);
    req.on("close", () => {
      streams.delete(s);
      if (s.role === "player") broadcast();
    });
    if (role === "player" && seat === null) seat = id;
    if (role === "player") broadcast();
    else send(s);
  }

  // one ping timer for every stream, so proxies keep idle streams open; close() stops it
  const ping = setInterval(() => {
    for (const s of streams) s.res.write(": ping\n\n");
  }, PING_MS);

  function loadNamed(name) {
    if (typeof name !== "string" || !BOT_NAME.test(name) || name.includes("..")) {
      throw new HttpError(400, `bad bot file name: ${name}`);
    }
    if (!existsSync(join(botsDir, name))) throw new HttpError(400, `no bot file ${name} in the bots folder`);
    try {
      return readBot(botsDir, name);
    } catch (e) {
      throw new HttpError(400, `${name}: ${e.message}`);
    }
  }

  function holder(body) {
    if (typeof body.seat !== "string" || body.seat === "") throw new HttpError(400, "a seat id is needed");
    return body.seat;
  }

  function mustHold(body) {
    const id = holder(body);
    if (id !== seat) throw new HttpError(403, "this seat id does not hold the seat");
  }

  // POST routes: [who, handler(body)]; a handler changes the match or the seat, then everyone gets the new state
  const posts = {
    "/api/host/pick": ["host", (body) => { flow = step(() => pickMove(flow, body.move)); }],
    "/api/host/throw": ["host", (body) => { flow = step(() => throwMove(flow, body.move)); }],
    "/api/host/next": ["host", () => { flow = step(() => nextRound(flow)); }],
    "/api/host/new": ["host", (body) => {
      if (body.bestOf !== 3 && body.bestOf !== 5) throw new HttpError(400, `bestOf must be 3 or 5, got ${body.bestOf}`);
      const name = body.bot ?? botName;
      const bot = loadNamed(name);
      flow = newFlow(bot, body.bestOf);
      botName = name;
    }],
    "/api/host/free-seat": ["host", () => { seat = null; }],
    "/api/player/claim": ["player", (body) => {
      const id = holder(body);
      if (seat === null) seat = id;
      else if (seat !== id) throw new HttpError(403, "someone else holds the seat");
    }],
    "/api/player/leave": ["player", (body) => {
      mustHold(body);
      seat = null;
    }],
    "/api/player/throw": ["player", (body) => {
      mustHold(body);
      flow = step(() => throwMove(flow, body.move));
    }],
  };

  async function route(req, res, url) {
    const path = url.pathname;
    if (req.method === "GET" && path === "/api/events") return events(req, res, url.searchParams);
    if (req.method === "GET" && path === "/api/host/bots") {
      if (!isLocal(req)) throw new HttpError(403, "host paths work only on the laptop running the server");
      const files = readdirSync(botsDir).filter((f) => f.endsWith(".json")).sort();
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ files }));
    }
    const entry = req.method === "POST" && Object.hasOwn(posts, path) && posts[path];
    if (!entry) throw new HttpError(404, `no such path: ${req.method} ${path}`);
    const [who, handler] = entry;
    if (who === "host" && !isLocal(req)) throw new HttpError(403, "host paths work only on the laptop running the server");
    handler(await readBody(req));
    res.statusCode = 204;
    res.end();
    broadcast();
  }

  function middleware(req, res, next) {
    const url = new URL(req.url, "http://relay");
    if (!url.pathname.startsWith("/api/")) return next();
    route(req, res, url).catch((e) => {
      if (e instanceof HttpError) fail(res, e.status, e.message);
      else fail(res, 500, e.message);
    });
  }

  function close() {
    clearInterval(ping);
    for (const s of streams) s.res.end();
    streams.clear();
  }

  return { middleware, close };
}

// The Vite plugin: mounts one relay in the dev server (`npm run dev`, `npm run host`) and in `npm run preview`.
export function relayPlugin() {
  function mount(server) {
    const relay = createRelay();
    server.middlewares.use(relay.middleware);
    server.httpServer?.on("close", relay.close);
  }
  return { name: "rps-relay", configureServer: mount, configurePreviewServer: mount };
}
