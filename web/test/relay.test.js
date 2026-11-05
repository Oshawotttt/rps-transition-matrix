import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request, createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRelay } from "../server/relay.js";

const FIXTURE = new URL("./fixtures/bot_synthetic.json", import.meta.url);
const DEFAULT = "bot_rps_human_combined.json";
const OTHER = "other_bot.json";

// a header the test's isLocal reads, so one loopback socket can act as a remote device
const REMOTE = { "x-test-remote": "1" };

let botsDir, relay, server, base;

beforeEach(async () => {
  // the synthetic fixture under two names, plus a file that is not a bot
  botsDir = mkdtempSync(join(tmpdir(), "relay-bots-"));
  copyFileSync(FIXTURE, join(botsDir, DEFAULT));
  copyFileSync(FIXTURE, join(botsDir, OTHER));
  writeFileSync(join(botsDir, "notes.txt"), "not a bot");
  relay = createRelay({ botsDir, isLocal: (req) => !req.headers["x-test-remote"] });
  server = createServer((req, res) => relay.middleware(req, res, () => {
    res.statusCode = 299;
    res.end("next");
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  relay.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(botsDir, { recursive: true, force: true });
});

// Opens an events stream. `next()` resolves with the next `state` event's data, in order.
function stream(query, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(`${base}/api/events?${query}`, { headers }, (res) => {
      const queue = [];
      const waiting = [];
      let buffer = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const lines = block.split("\n");
          if (!lines.includes("event: state")) continue;
          const data = JSON.parse(lines.find((l) => l.startsWith("data: ")).slice(6));
          if (waiting.length) waiting.shift()(data);
          else queue.push(data);
        }
      });
      let text = "";
      const body = new Promise((r) => {
        res.on("data", (c) => { text += c; });
        res.on("end", () => r(text));
      });
      resolve({
        status: res.statusCode,
        contentType: res.headers["content-type"],
        body: () => body,
        next: () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => waiting.push(r))),
        close: () => req.destroy(),
      });
    });
    req.on("error", reject);
    req.end();
  });
}

test("host stream sends the starting state", async () => {
  const host = await stream("role=host");
  assert.equal(host.status, 200);
  assert.match(host.contentType, /^text\/event-stream/);
  const state = await host.next();
  assert.equal(state.role, "host");
  assert.equal(state.bot, DEFAULT);
  assert.equal(state.flow.phase, "think");
  assert.equal(state.flow.game.bestOf, 3);
  assert.equal(state.seat, "empty");
  assert.equal(state.playerOnline, false);
  host.close();
});

// Sends one request; `body` is sent as is when it is a string, else as JSON. Resolves with {status, json}.
function send(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, { method, headers: { "content-type": "application/json", ...headers } }, (res) => {
      let text = "";
      res.setEncoding("utf-8");
      res.on("data", (c) => { text += c; });
      res.on("end", () => resolve({ status: res.statusCode, text, json: text && res.headers["content-type"]?.includes("json") ? JSON.parse(text) : null }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

const post = (path, body = {}, headers) => send("POST", path, body, headers);

test("host stream is refused from a remote address and needs a known role", async () => {
  const remote = await stream("role=host", REMOTE);
  assert.equal(remote.status, 403);
  assert.ok(JSON.parse(await remote.body()).error);
  for (const query of ["", "role=admin", "role=player"]) {
    const bad = await stream(query);
    assert.equal(bad.status, 400, query);
    assert.ok(JSON.parse(await bad.body()).error);
  }
});

test("a guest stream takes the empty seat; a second id finds it taken", async () => {
  const host = await stream("role=host");
  await host.next();
  const first = await stream("role=player&seat=a", REMOTE);
  const mine = await first.next();
  assert.equal(mine.role, "player");
  assert.equal(mine.seat, "mine");
  assert.equal(mine.view.phase, "open");
  const second = await stream("role=player&seat=b", REMOTE);
  const taken = await second.next();
  assert.deepEqual(taken, { role: "player", seat: "taken", view: null });
  const hostState = await host.next();
  assert.equal(hostState.seat, "taken");
  assert.equal(hostState.playerOnline, true);
  for (const s of [host, first, second]) s.close();
});

test("a guest stream from loopback is allowed", async () => {
  const guest = await stream("role=player&seat=a");
  assert.equal(guest.status, 200);
  assert.equal((await guest.next()).seat, "mine");
  guest.close();
});

// the host's state as one fresh stream sees it
async function hostState() {
  const host = await stream("role=host");
  const state = await host.next();
  host.close();
  return state;
}

function otherMove(move) {
  return ["R", "P", "S"].find((m) => m !== move);
}

test("a full round over HTTP", async () => {
  const host = await stream("role=host");
  const start = await host.next();
  const guest = await stream("role=player&seat=a", REMOTE);
  await guest.next();
  await host.next();
  const pick = start.flow.game.decision.move;
  assert.equal((await post("/api/host/pick", { move: pick })).status, 204);
  assert.equal((await host.next()).flow.phase, "reveal");
  assert.equal((await guest.next()).view.phase, "open");
  assert.equal((await post("/api/player/throw", { seat: "a", move: "R" }, REMOTE)).status, 204);
  const hostResult = await host.next();
  const guestResult = await guest.next();
  assert.equal(hostResult.flow.phase, "result");
  assert.equal(hostResult.flow.game.history[0].botMove, pick);
  assert.equal(guestResult.view.phase, "result");
  assert.deepEqual(guestResult.view.last, { round: 1, botMove: pick, humanMove: "R", outcome: hostResult.flow.game.history[0].outcome });
  host.close();
  guest.close();
});

test("flow errors are 409", async () => {
  const { flow } = await hostState();
  const pick = flow.game.decision.move;
  assert.equal((await post("/api/host/pick", { move: otherMove(pick) })).status, 409);
  assert.equal((await post("/api/host/next")).status, 409);
  const guest = await stream("role=player&seat=a", REMOTE);
  await guest.next();
  assert.equal((await post("/api/player/throw", { seat: "a", move: "R" }, REMOTE)).status, 204);
  const second = await post("/api/player/throw", { seat: "a", move: "P" }, REMOTE);
  assert.equal(second.status, 409);
  assert.ok(second.json.error);
  guest.close();
});

test("bad input is 400", async () => {
  for (const [path, body] of [
    ["/api/host/pick", { move: "X" }],
    ["/api/host/throw", { move: "X" }],
    ["/api/host/new", { bestOf: 4 }],
    ["/api/host/pick", "{not json"],
    ["/api/host/new", { bestOf: 3, bot: "../x.json" }],
    ["/api/host/new", { bestOf: 3, bot: "a/b.json" }],
    ["/api/host/new", { bestOf: 3, bot: "missing.json" }],
  ]) {
    const res = await post(path, body);
    assert.equal(res.status, 400, `${path} ${JSON.stringify(body)}`);
    assert.ok(res.json.error);
  }
  const guest = await stream("role=player&seat=a", REMOTE);
  await guest.next();
  assert.equal((await post("/api/player/throw", { seat: "a", move: "X" }, REMOTE)).status, 400);
  guest.close();
});

test("host paths are refused from a remote address and change nothing", async () => {
  const before = await hostState();
  const pick = before.flow.game.decision.move;
  for (const [path, body] of [
    ["/api/host/pick", { move: pick }],
    ["/api/host/throw", { move: "R" }],
    ["/api/host/next", {}],
    ["/api/host/new", { bestOf: 5 }],
    ["/api/host/free-seat", {}],
  ]) {
    assert.equal((await post(path, body, REMOTE)).status, 403, path);
  }
  assert.equal((await send("GET", "/api/host/bots", undefined, REMOTE)).status, 403);
  assert.deepEqual(await hostState(), before);
});

test("seat-holder paths refuse another seat id", async () => {
  const guest = await stream("role=player&seat=a", REMOTE);
  await guest.next();
  assert.equal((await post("/api/player/throw", { seat: "b", move: "R" }, REMOTE)).status, 403);
  assert.equal((await post("/api/player/leave", { seat: "b" }, REMOTE)).status, 403);
  assert.equal((await hostState()).seat, "taken");
  guest.close();
});

test("new match: best of 5, then another bot", async () => {
  const host = await stream("role=host");
  await host.next();
  const pick = (await hostState()).flow.game.decision.move;
  await post("/api/host/pick", { move: pick });
  await host.next();
  assert.equal((await post("/api/host/new", { bestOf: 5 })).status, 204);
  const five = await host.next();
  assert.equal(five.flow.game.bestOf, 5);
  assert.equal(five.flow.game.round, 1);
  assert.equal(five.flow.phase, "think");
  assert.equal(five.bot, DEFAULT);
  assert.equal((await post("/api/host/new", { bestOf: 3, bot: OTHER })).status, 204);
  const other = await host.next();
  assert.equal(other.bot, OTHER);
  assert.equal(other.flow.game.bestOf, 3);
  host.close();
});

test("bots lists the .json files, sorted", async () => {
  const res = await send("GET", "/api/host/bots");
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { files: [DEFAULT, OTHER] });
});

test("freeing, claiming and leaving the seat", async () => {
  const first = await stream("role=player&seat=a", REMOTE);
  await first.next();
  const second = await stream("role=player&seat=b", REMOTE);
  assert.equal((await second.next()).seat, "taken");
  await first.next();
  assert.equal((await post("/api/host/free-seat")).status, 204);
  assert.equal((await second.next()).seat, "empty");
  assert.equal((await first.next()).seat, "empty");
  assert.equal((await post("/api/player/claim", { seat: "b" }, REMOTE)).status, 204);
  assert.equal((await second.next()).seat, "mine");
  assert.equal((await first.next()).seat, "taken");
  assert.equal((await hostState()).seat, "taken");
  assert.equal((await post("/api/player/leave", { seat: "b" }, REMOTE)).status, 204);
  assert.equal((await second.next()).seat, "empty");
  assert.equal((await hostState()).seat, "empty");
  first.close();
  second.close();
});

test("the host sees the guest go offline", async () => {
  const host = await stream("role=host");
  await host.next();
  const guest = await stream("role=player&seat=a", REMOTE);
  await guest.next();
  assert.equal((await host.next()).playerOnline, true);
  guest.close();
  const after = await host.next();
  assert.equal(after.seat, "taken");
  assert.equal(after.playerOnline, false);
  host.close();
});

const A = JSON.parse(readFileSync(FIXTURE, "utf-8")).payoff.A;

function losingThrow(botMove) {
  const moves = ["R", "P", "S"];
  return moves[A[moves.indexOf(botMove)].indexOf(1)];
}

test("no guest event in a full match holds the decision, the pick or the history", async () => {
  const guest = await stream("role=player&seat=a", REMOTE);
  const events = [await guest.next()];
  let state = await hostState();
  while (state.flow.game.winner === null) {
    if (state.flow.phase === "result") await post("/api/host/next");
    else {
      const pick = state.flow.game.decision.move;
      await post("/api/host/pick", { move: pick });
      events.push(await guest.next());
      // the throw the bot's pick beats, so every round counts and the match ends
      await post("/api/player/throw", { seat: "a", move: losingThrow(pick) }, REMOTE);
    }
    events.push(await guest.next());
    state = await hostState();
  }
  assert.ok(events.some((e) => e.view.phase === "result" && e.view.winner !== null));
  for (const e of events) {
    const text = JSON.stringify(e);
    for (const key of ["decision", "pick", "history"]) assert.ok(!text.includes(`"${key}"`), `${key} in ${text}`);
  }
  guest.close();
});

test("other /api/ paths are 404; other paths go to next()", async () => {
  assert.equal((await send("GET", "/api/nope")).status, 404);
  assert.equal((await send("GET", "/api/host/pick")).status, 404);
  assert.equal((await post("/api/events")).status, 404);
  assert.equal((await post("/api/constructor")).status, 404);
  const page = await send("GET", "/index.html");
  assert.equal(page.status, 299);
  assert.equal(page.text, "next");
});

test("npm run host and the Vite plugin are set up", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
  assert.equal(pkg.scripts.host, "vite --host");
  const config = readFileSync(new URL("../vite.config.js", import.meta.url), "utf-8");
  assert.match(config, /import \{ relayPlugin \} from "\.\/server\/relay\.js"/);
  assert.match(config, /plugins: \[[^\]]*relayPlugin\(\)/);
});
