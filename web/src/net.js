// The browser's side of the relay: the events stream, POSTs and the role the tab chose.
// No DOM or React; transports and storage are passed in, so node --test runs it with fakes.

// EventSource.readyState once it has given up (a non-200 answer or no server): it will not retry
const CLOSED = 2;

// Opens the events stream at `url` and calls `onState` with each `state` event's data.
// Set `onStatus` on the returned object to hear "open", "reconnecting" (EventSource retries on its own)
// or "closed" (it gave up); `close()` ends the stream.
export function connect(url, onState, EventSourceImpl = globalThis.EventSource) {
  const es = new EventSourceImpl(url);
  const conn = { onStatus: null, close: () => es.close() };
  es.addEventListener("state", (e) => onState(JSON.parse(e.data)));
  es.addEventListener("open", () => conn.onStatus?.("open"));
  es.addEventListener("error", () => conn.onStatus?.(es.readyState === CLOSED ? "closed" : "reconnecting"));
  return conn;
}

// Rejects with the server's {error} message, or the status when the body has none; `status` is on the Error.
async function rejectWith(response) {
  let message = `HTTP ${response.status}`;
  try {
    message = (await response.json()).error ?? message;
  } catch {
    // no JSON body: keep the status
  }
  throw Object.assign(new Error(message), { status: response.status });
}

// POSTs `body` as JSON; resolves on 204 and rejects otherwise.
export async function post(path, body, fetchFn = globalThis.fetch) {
  const response = await fetchFn(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (response.status !== 204) await rejectWith(response);
}

// GETs JSON, e.g. the host's bot list; rejects like `post` on any status but 200.
export async function getJson(path, fetchFn = globalThis.fetch) {
  const response = await fetchFn(path);
  if (response.status !== 200) await rejectWith(response);
  return response.json();
}

const ROLE_KEY = "rps.role";
const ROLES = ["host", "player"];

// Keeps the role the tab chose in `storage` (the tab's sessionStorage), so a refresh keeps it; null forgets it.
export function chooseRole(storage, role) {
  if (role === null) return storage.removeItem(ROLE_KEY);
  if (!ROLES.includes(role)) throw new Error(`unknown role: ${role}`);
  storage.setItem(ROLE_KEY, role);
}

// The role this tab chose, or null when there is none or the stored value is not a role.
export function savedRole(storage) {
  const role = storage.getItem(ROLE_KEY);
  return ROLES.includes(role) ? role : null;
}

const SEAT_KEY = "rps.seat";

// This tab's seat id: the stored one, or a new one from `random` (12 base-36 characters), stored so a refresh
// keeps the seat. Not crypto.randomUUID, which browsers leave out on a plain-http LAN address.
export function seatId(storage, random = Math.random) {
  const stored = storage.getItem(SEAT_KEY);
  if (stored) return stored;
  let id = "";
  for (let k = 0; k < 3; k++) id += Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  storage.setItem(SEAT_KEY, id);
  return id;
}
