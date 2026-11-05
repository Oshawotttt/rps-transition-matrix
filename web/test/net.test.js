import { test } from "node:test";
import assert from "node:assert/strict";

import { chooseRole, connect, getJson, post, savedRole, seatId } from "../src/net.js";

// An EventSource stand-in the test drives by hand; the last one made is in FakeEventSource.last.
class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url) {
    this.url = url;
    this.readyState = FakeEventSource.CONNECTING;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.last = this;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  emit(type, event = {}) {
    for (const fn of this.listeners[type] ?? []) fn(event);
  }

  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
}

test("connect passes each state event's data and reports open and error", () => {
  const states = [];
  const statuses = [];
  const conn = connect("/api/events?role=host", (s) => states.push(s), FakeEventSource);
  conn.onStatus = (s) => statuses.push(s);
  const es = FakeEventSource.last;
  assert.equal(es.url, "/api/events?role=host");

  es.readyState = FakeEventSource.OPEN;
  es.emit("open");
  es.emit("state", { data: JSON.stringify({ role: "host", seat: "empty" }) });
  es.emit("state", { data: JSON.stringify({ role: "host", seat: "taken" }) });
  assert.deepEqual(states, [{ role: "host", seat: "empty" }, { role: "host", seat: "taken" }]);

  // a dropped stream that EventSource will retry, then one it gave up on
  es.readyState = FakeEventSource.CONNECTING;
  es.emit("error");
  es.readyState = FakeEventSource.CLOSED;
  es.emit("error");
  assert.deepEqual(statuses, ["open", "reconnecting", "closed"]);

  conn.close();
  assert.ok(es.closed);
});

// A fetch stand-in that records its calls and answers with `status` and `body`.
function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
        return body;
      },
    };
  };
  fn.calls = calls;
  return fn;
}

test("post sends JSON and resolves on 204", async () => {
  const fetchFn = fakeFetch(204);
  assert.equal(await post("/api/host/pick", { move: "P" }, fetchFn), undefined);
  assert.equal(fetchFn.calls.length, 1);
  const { url, init } = fetchFn.calls[0];
  assert.equal(url, "/api/host/pick");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(init.body), { move: "P" });
});

test("post rejects with the server's error and status", async () => {
  for (const status of [400, 403, 409, 404]) {
    await assert.rejects(post("/api/host/next", {}, fakeFetch(status, { error: `nope ${status}` })),
      (e) => e.message === `nope ${status}` && e.status === status);
  }
  // a status other than 204 is refused even when it is a success, and a body without JSON still gives the status
  await assert.rejects(post("/api/host/next", {}, fakeFetch(200, { error: "odd" })), (e) => e.status === 200);
  await assert.rejects(post("/api/host/next", {}, fakeFetch(500)), (e) => e.status === 500 && e.message.includes("500"));
});

test("getJson resolves with the body on 200 and rejects otherwise", async () => {
  assert.deepEqual(await getJson("/api/host/bots", fakeFetch(200, { files: ["a.json"] })), { files: ["a.json"] });
  await assert.rejects(getJson("/api/host/bots", fakeFetch(403, { error: "not here" })),
    (e) => e.message === "not here" && e.status === 403);
});

// A sessionStorage stand-in over a Map.
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() { return map.size; },
    keys: () => [...map.keys()],
  };
}

test("chooseRole stores the role and savedRole reads it back", () => {
  const storage = fakeStorage();
  assert.equal(savedRole(storage), null);
  chooseRole(storage, "host");
  assert.equal(savedRole(storage), "host");
  chooseRole(storage, "player");
  assert.equal(savedRole(storage), "player");
  assert.equal(storage.size, 1);
  // null forgets the role, as Leave does
  chooseRole(storage, null);
  assert.equal(savedRole(storage), null);
  assert.throws(() => chooseRole(storage, "admin"));
});

test("an unknown stored role reads as null", () => {
  for (const bad of ["admin", "", "HOST"]) {
    const storage = fakeStorage();
    chooseRole(storage, "host");
    // overwrite the one key chooseRole wrote with a value that is not a role
    storage.setItem(storage.keys()[0], bad);
    assert.equal(savedRole(storage), null, bad);
  }
});

// a random stand-in that walks through fixed numbers in [0, 1)
function fakeRandom(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("seatId makes one id, stores it and returns the stored one after", () => {
  const storage = fakeStorage();
  const id = seatId(storage, fakeRandom(0.25, 0.5, 0.75));
  assert.equal(typeof id, "string");
  assert.match(id, /^[0-9a-z]{12,}$/);
  assert.equal(storage.size, 1);
  assert.equal(storage.getItem(storage.keys()[0]), id);
  // a second call reads the stored id and never calls random
  assert.equal(seatId(storage, () => { throw new Error("random called"); }), id);
  // another tab, another id
  assert.notEqual(seatId(fakeStorage(), fakeRandom(0.1, 0.2, 0.3)), id);
});

test("seatId keeps an id that is already stored", () => {
  const storage = fakeStorage();
  seatId(storage, fakeRandom(0.25));
  const [key] = storage.keys();
  storage.setItem(key, "kept-id");
  assert.equal(seatId(storage, fakeRandom(0.9)), "kept-id");
});
