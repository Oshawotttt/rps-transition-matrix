# Network play: host on the laptop, guest joins over the same wifi

**Status:** approved

**Repo:** `d:\SMU\CS103\proj\rps-transition-matrix`

**Context file to update:** none named.

**Commands:**

- Full test suite: `python -m pytest` and `node --test "web/test/*.test.js"` (from the repo root)
- Single test file: `node --test web/test/flow.test.js` (any one file under `web/test/`); `python -m pytest tests/test_bot.py`
- Typecheck: none
- Lint: none

## Dependencies and blockers

| Subtask | Blocked by |
|---|---|
| S1 | none |
| S2 | S1 |
| S3 | S2 |
| S4 | S3 |

Run order: S1, S2, S3, S4.

External blockers: none.

Uncommitted changes: none besides this spec (the frontend polish was committed as `ee23352`). `transient`

Branch: `feat/network` (at `main`). `transient`

## Suggested splits

No split: every subtask is connected. S2 runs S1's round flow, S3 talks to S2's endpoints, and S4 reuses S3's connection helpers and start screen.

## Out of scope

- More than one seat, spectators, or several matches at once. Recorded by S2 (ARCHITECTURE "Not included").
- Internet play, HTTPS, accounts or passwords: only devices on the same network as the server laptop. Recorded by S2 (ARCHITECTURE "Not included").
- Hosting from any machine other than the one running the server. Recorded by S2 (ARCHITECTURE rules).
- Persisting a match across a server restart. Recorded by S2 (ARCHITECTURE "Not included").
- A phone layout for the guest screen (user: "i don't need phone. everything accessed on laptop"). Recorded by S4 (ARCHITECTURE "Not included").
- An offline mode without the server: the projector needs the dev or preview server running. Recorded by S3 (ARCHITECTURE "Not included").
- Undo, save or replay of a game (already recorded, ARCHITECTURE "Not included").
- The look-ahead panel (still a placeholder; already recorded).
- Showing the join URL or a QR code on the projector. `transient`

## Interfaces

### Round flow (`web/src/flow.js`), S1 to S2

Introduced by S1; S2 tests against it. Doc delta to `docs/CONTRACTS.md`, new section "Round flow". A plain ES module like `game.js`: no DOM, no React, no Node built-ins, so it runs in Node and in the browser.

| Export | Signature | Meaning |
|---|---|---|
| `newFlow` | `(bot, bestOf: 3 \| 5) => Flow` | `game` = `newGame(bot, bestOf)`, `phase` `"think"`, `pick` `null`, `thrown` `null` |
| `pickMove` | `(flow, move: string) => Flow` | host picks the bot's move. Needs `phase` `"think"`; `move` must equal `flow.game.decision.move`. If `thrown` is set, the round plays: `phase` `"result"`. Otherwise `phase` `"reveal"` |
| `throwMove` | `(flow, move: string) => Flow` | the human's move (from the guest, or from the host's fallback). Needs `phase` `"think"` or `"reveal"` and `thrown` `null`. If `pick` is set, the round plays: `phase` `"result"`. Otherwise `thrown` is stored and `phase` stays `"think"` |
| `nextRound` | `(flow) => Flow` | needs `phase` `"result"` and `game.winner` `null`; gives `phase` `"think"`, `pick` `null`, `thrown` `null` |
| `hostView` | `(flow) => object` | `{phase, pick, thrown: bool, game}`, where `game` is the `Game` without its `bot` key |
| `playerView` | `(flow) => object` | see below |

A round plays with `playRound(game, thrown, pick)`. Every function returns a new frozen `Flow` and never changes the one passed in.

Errors are `Error` objects with a `code` property:

| `code` | When |
|---|---|
| `"move"` | the move is not in `bot.moves` |
| `"phase"` | the call is not allowed in the current phase (incl. a second throw in one round, `nextRound` after the match is won) |
| `"wrong"` | `pickMove` with a move other than `decision.move` |

`Flow` (frozen): `game` (`Game`), `phase` (`"think"`, `"reveal"` or `"result"`), `pick` (`null` or a move), `thrown` (`null` or a move).

`playerView(flow)`:

| Field | Type | Meaning |
|---|---|---|
| `phase` | `"open"`, `"locked"` or `"result"` | `"open"`: the guest may throw (flow `"think"` or `"reveal"` with `thrown` `null`); `"locked"`: thrown, round not played yet; `"result"`: flow `"result"` |
| `thrown` | `null` or a move | the guest's throw this round |
| `bestOf`, `target`, `round`, `tally`, `winner` | as in `Game` | |
| `opponent` | string or `null` | `bot.opponent` |
| `last` | `null` or `{round, botMove, humanMove, outcome}` | the last played round; `null` before round 1 |

It has no other keys: never `decision`, `pick`, `history` or any bot matrix (user, confirmed).

### HTTP API (`web/server/relay.js`), S2 to S3 and S4

Introduced by S2; S3 and S4 call it. Doc delta to `docs/CONTRACTS.md`, new section "Relay server". All paths start with `/api/`; anything else falls through to Vite.

Roles: each screen says which role it wants. The host role is allowed only when the request's socket address is loopback (`127.0.0.1`, `::1`, or `::ffff:127.0.0.1`), i.e. the browser runs on the laptop that runs the server. Loopback is the machine talking to itself, whatever network or hotspot it is on. The player role is allowed from any address, the server laptop included.

| Method, path | Who | Body | Effect |
|---|---|---|---|
| `GET /api/events?role=host` | host | none | Server-Sent Events stream. Sends one `state` event at once and one on every change; a `: ping` comment every 20 s |
| `GET /api/events?role=player&seat=<id>` | anyone | none | same stream for a guest; takes the seat if it is empty |
| `POST /api/host/pick` | host | `{move}` | `pickMove` |
| `POST /api/host/throw` | host | `{move}` | `throwMove` (fallback, user, confirmed) |
| `POST /api/host/next` | host | `{}` | `nextRound` |
| `POST /api/host/new` | host | `{bestOf, bot?}` | new match; `bot` is a file name in the bots folder, default the current one |
| `GET /api/host/bots` | host | none | `{files: [names]}`, the `*.json` names in the bots folder, sorted |
| `POST /api/host/free-seat` | host | `{}` | the seat becomes empty |
| `POST /api/player/claim` | anyone | `{seat}` | takes the seat if it is empty |
| `POST /api/player/leave` | seat holder | `{seat}` | the seat becomes empty (user, confirmed) |
| `POST /api/player/throw` | seat holder | `{seat, move}` | `throwMove` |

Responses: `204` on success. Errors return JSON `{error: <message>}`: `400` bad JSON, unknown move, `bestOf` not 3 or 5, a bad bot file name, or `/api/events` with a missing or unknown `role` or a player without `seat`; `403` any host path (incl. `/api/events?role=host`) from a non-loopback address, or a seat id that does not hold the seat; `409` flow error `"phase"` or `"wrong"`; `404` any other `/api/` path or method.

`state` event data (JSON):

- host: `{role: "host", bot: <file name>, flow: hostView(flow), seat: "empty" | "taken", playerOnline: bool}`. `playerOnline` is true while the seat holder has an open events stream.
- guest holding the seat: `{role: "player", seat: "mine", view: playerView(flow)}`.
- other guest: `{role: "player", seat: "empty" | "taken", view: null}`.

## Subtasks

### S1: Round flow module

- **Goal:** `web/src/flow.js` holds the per-round flow (pick, throw, play, next) as pure functions over an immutable `Flow`, plus the host and guest views, so the server can run it and tests can drive it without a browser.
- **Blocked by:** none
- **Files:** `web/src/flow.js` (new), `web/test/flow.test.js` (new), `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`.
- **Seams:** the exports of `web/src/flow.js` listed under Interfaces.
- **Decisions:**
  - `flow.js` imports only `./game.js`; no DOM, React or Node built-ins (code: `web/src/game.js` rule in ARCHITECTURE). Doc delta.
  - The guest can throw before or after the pick; a throw is final for the round; the round plays once both are in (user, confirmed). Doc delta.
  - The host's fallback throw goes through the same `throwMove` (user, confirmed). Doc delta.
  - `playerView` never holds the decision, the pick, the history or any matrix (user, confirmed). Doc delta.
  - Only `decision.move` can be picked; a wrong pick is refused (docs: `docs/ARCHITECTURE.md`, "The presenter can only play the recommended move"). Already recorded.
  - Roles are `host` and `player`; the screen calls the player "guest" (user, confirmed). Doc delta.
- **Acceptance criteria:**
  - [x] `newFlow(bot, 3)` gives phase `"think"`, `pick` and `thrown` `null`, and a game equal to `newGame(bot, 3)` (`web/test/flow.test.js`).
  - [x] Pick then throw: after `pickMove` phase is `"reveal"`; after `throwMove` phase is `"result"` and `game.history` has one round with `botMove` = the pick and `humanMove` = the throw (`flow.test.js`).
  - [x] Throw then pick: after `throwMove` phase stays `"think"` with `thrown` set; after `pickMove` phase is `"result"` with the same round (`flow.test.js`).
  - [x] `pickMove` with a move other than `decision.move` throws `code` `"wrong"`; an unknown move throws `code` `"move"` in `pickMove` and `throwMove` (`flow.test.js`).
  - [x] `code` `"phase"`: a second `throwMove` in one round, `pickMove` outside `"think"`, `throwMove` in `"result"`, `nextRound` outside `"result"`, and `nextRound` once `game.winner` is set (`flow.test.js`).
  - [x] `nextRound` after a non-final result gives phase `"think"`, `pick` and `thrown` `null`, and keeps the game (`flow.test.js`).
  - [x] Every function leaves its input unchanged, and every returned `Flow` is frozen (`flow.test.js`).
  - [x] `playerView` has exactly the keys `phase, thrown, bestOf, target, round, tally, winner, opponent, last` in each phase; `"open"` / `"locked"` / `"result"` map from the flow as in Interfaces; `last` is `null` before round 1, then the last round's four fields (`flow.test.js`).
  - [x] `JSON.stringify(playerView(f))` does not contain the decision's `q` or `scores` values, for a flow in `"reveal"` (`flow.test.js`).
  - [x] `hostView` gives `thrown` as a boolean and a `game` without `bot` (`flow.test.js`).
  - [x] The full suite passes: `node --test "web/test/*.test.js"`.
- **Doc deltas:**
  - `docs/CONTRACTS.md`: new section "Round flow" with the tables under Interfaces (prose and tables only, no code).
  - `docs/ARCHITECTURE.md`: `web/src/flow.js` in the Modules table and the data-flow diagram; rules: the guest may throw before or after the pick, a throw is final for the round, the round plays once both are in; the host can enter the throw as a fallback; the guest view never carries the bot's decision, pick, history or matrices.
  - `GLOSSARY.md`: **Host** (admin; the projector screen on the laptop that runs the server; picks the bot's move and runs the match), **Player** (shown as "guest"; the friend's screen; only throws), **Round flow** (one round's steps: pick, throw, play, next).
  - Decision made: the move is checked before the phase, so an unknown move is always `code` `"move"` (the relay's `400`), whatever the phase. Goes in `docs/CONTRACTS.md` "Round flow".
  - Decision made: in phase `"result"` the flow keeps `pick` and `thrown` from the round just played; `nextRound` clears them. Goes in `docs/CONTRACTS.md` "Round flow".
  - Decision made: `flow.test.js` drives the flow with the synthetic fixture bot (`web/test/fixtures/bot_synthetic.json`), so the decisions are real exported ones. No doc needed: the test file names the fixture.

### S2: Relay server in the Vite dev and preview servers

- **Goal:** `npm run host` serves the app on the wifi and runs the match on the laptop: screens get live state over Server-Sent Events, the host's actions and the guest's throw arrive as `POST`s, and each path checks the caller's role.
- **Blocked by:** S1
- **Files:** `web/server/relay.js` (new), `web/vite.config.js`, `web/package.json` (script `host`), `web/test/relay.test.js` (new), `README.md`, `TODO.md`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`.
- **Seams:** the HTTP API under Interfaces, through a real `node:http` server on an ephemeral port in the test. `createRelay({botsDir, isLocal})` returns `{middleware, close}`: `middleware(req, res, next)` is Connect-style; `isLocal(req) => bool` defaults to the loopback check and lets the test act as a remote device. `relayPlugin()` is the Vite plugin that mounts it in `configureServer` and `configurePreviewServer`.
- **Decisions:**
  - Server-authoritative: the server holds the match and runs `game.js` through `flow.js`; Server-Sent Events plus JSON `POST`, no new npm dependency (user, confirmed). Doc delta (replaces, for networked play, the ARCHITECTURE rule that the UI keeps the game in React state, and the "No friend's device screen and no relay server yet" item).
  - User: "idm logging in as admin or join as guest". Each screen picks its role on a start screen. The host role is allowed only from loopback, so only the laptop running the server can host; this holds on any wifi or hotspot, since loopback is the machine itself. No password. Doc delta.
  - One seat; a guest stream with a seat id takes an empty seat; `POST /api/player/claim` takes it once freed; the host can free it; a guest leaving frees it (user, confirmed). Doc delta.
  - The match is in memory; restarting the server starts a new best-of-3 match with `bot_rps_human_combined.json` (user, confirmed). Doc delta.
  - User, on choosing the game: "both", i.e. the host picks best of 3 or 5 and which bot file. Bots are read from `web/public/bots/` with `validateBot`. A bot name must be a plain file name ending in `.json` (letters, digits, `_`, `-`, `.`; no `/`, `\` or `..`) and must exist there; otherwise `400`. Doc delta.
  - `npm run host` = `vite --host`, port 5173; `npm run dev` unchanged (user, confirmed). Doc delta (README).
  - User: "sure" to the README covering the same wifi first and a hotspot as the fallback, and removing the `TODO.md` item. The hotspot can come from a phone or from Windows Mobile hotspot; both laptops join it (user, confirmed). The Windows firewall note from `TODO.md` stays. Doc delta.
- **Acceptance criteria:**
  - [x] `GET /api/events?role=host` from loopback sends a first `state` event with `role` `"host"`, `bot` `"bot_rps_human_combined.json"`, `flow.phase` `"think"`, `flow.game.bestOf` 3, `seat` `"empty"` (`web/test/relay.test.js`).
  - [x] `GET /api/events?role=host` from a remote address returns `403` and no stream; `role` missing or `"admin"` returns `400` (`relay.test.js`).
  - [x] A guest stream with a seat id takes the empty seat: it gets `seat` `"mine"` and a `view`; a second seat id gets `seat` `"taken"` and `view` `null`; the host's next event has `seat` `"taken"` and `playerOnline` true (`relay.test.js`).
  - [x] A guest stream from loopback is allowed (`relay.test.js`).
  - [x] Every `POST /api/host/*` path and `GET /api/host/bots` from a remote address returns `403` and changes nothing (`relay.test.js`).
  - [x] `POST /api/player/throw` and `POST /api/player/leave` with a seat id that does not hold the seat return `403` (`relay.test.js`).
  - [x] A full round over HTTP: host `pick` with `decision.move` returns `204`, guest `throw` returns `204`, and both streams then get a `state` with the result (host `flow.phase` `"result"`, guest `view.phase` `"result"`, `view.last` set) (`relay.test.js`).
  - [x] Host `pick` with a wrong move returns `409`; a second guest throw in one round returns `409`; `next` while `"think"` returns `409` (`relay.test.js`).
  - [x] Unknown move, `bestOf` 4, bad JSON, and bot names `../x.json`, `a/b.json`, `missing.json` each return `400` (`relay.test.js`).
  - [x] `POST /api/host/new` with `{bestOf: 5}` resets to a best-of-5 match at round 1 and broadcasts it; with `{bestOf: 3, bot: <other file>}` the host's next event names that bot (`relay.test.js`).
  - [x] `GET /api/host/bots` lists the `.json` files of the test's bots folder, sorted (`relay.test.js`, with a temp folder holding the synthetic fixture under two names).
  - [x] `POST /api/host/free-seat` empties the seat; then `POST /api/player/claim` from the second id gets it. `POST /api/player/leave` by the holder empties the seat (`relay.test.js`).
  - [x] No guest `state` event, in any phase of a full match, contains the keys `decision`, `pick` or `history` (`relay.test.js`).
  - [x] Any other `/api/` path returns `404`; a non-`/api/` path calls `next()` (`relay.test.js`).
  - [x] `web/package.json` has the script `"host": "vite --host"`, and `vite.config.js` registers `relayPlugin()` (`relay.test.js` reads both files).
  - [x] The full suite passes: `node --test "web/test/*.test.js"`.
- **Doc deltas:**
  - `docs/CONTRACTS.md`: new section "Relay server" with the HTTP API, roles, status codes, `state` event shapes and the bot file name rule.
  - `docs/ARCHITECTURE.md`: `web/src/flow.js`'s caller `web/server/relay.js` in Modules and the data flow; rules: the server holds the match and runs `game.js` in Node; only the laptop running the server can host (loopback), no password; one seat; the guest stream never carries the bot's decision, pick or history; the match is in memory only. Replace "No friend's device screen and no relay server yet" in "Not included" with: one seat only, no spectators, no internet play, HTTPS or accounts, no hosting from another machine, no match kept across a server restart.
  - `README.md`: new section "Play on two laptops": both laptops on the same wifi; on the presenter laptop run `npm run host` from `web/` and open `http://localhost:5173/`, choose Host; the friend's laptop opens the "Network" URL Vite prints and chooses Join as guest; one laptop can test both roles in two tabs; allow Node through the Windows firewall on Public networks; if the wifi blocks device-to-device traffic, both laptops join a hotspot (a phone's, or Windows Mobile hotspot) and use the Network URL Vite prints on it. Replace "Until the relay server exists, the presenter then enters the friend's move on the projector".
  - `TODO.md`: remove the "Play on a phone over the laptop's hotspot" item (moved into the README).
  - `GLOSSARY.md`: **Seat** (the one guest slot; held by one tab's seat id).
  - Decision made: the listed host paths check loopback before reading the body, so a remote caller gets `403` even with a bad body; an unlisted `/api/host/...` path or a wrong method is `404`, not `403`. Goes in `docs/CONTRACTS.md` "Relay server".
  - Decision made: `POST /api/player/claim` while another seat id holds the seat is `403` (the caller does not hold it); by the holder it is `204` and changes nothing. Goes in `docs/CONTRACTS.md` "Relay server".
  - Decision made: a `POST` body that is JSON but not an object, and a missing or empty `seat` in a player `POST`, are `400`. Goes in `docs/CONTRACTS.md` "Relay server".
  - Decision made: a bot file whose name passes the rule but whose JSON fails to parse or fails `validateBot` is `400` with that error; any unexpected server error is `500` with `{error}`. Goes in `docs/CONTRACTS.md` "Relay server".
  - Decision made: every successful `POST`, and every guest stream opening or closing, sends a `state` event to every open stream; a new host stream gets only its own first event. Goes in `docs/CONTRACTS.md` "Relay server".
  - Decision made: the default bot is read once when the relay starts; if it is missing or invalid the dev server fails to start. Goes in `docs/ARCHITECTURE.md` rules.
  - Decision made: one 20 s ping timer per relay serves all streams; `close()` ends the streams and stops it, and the plugin calls it when Vite's HTTP server closes. No doc needed: the code comment in `web/server/relay.js` says so.
  - Decision made: `relay.test.js` acts as a remote device through an `isLocal` that reads a test-only header (`x-test-remote`), on one loopback socket. No doc needed: the test file says so.

### S3: Start screen and host screen on the server's state

- **Goal:** the app opens on a start screen with "Host" and "Join as guest". The projector shows the server's match and sends every match action to the server. The host alone picks the bot's move, presses Next, starts a new match, sets best of 3 or 5, picks the bot and frees the seat. The projector shows whether the guest is online and has thrown, never which move.
- **Blocked by:** S2
- **Files:** `web/src/net.js` (new: events stream and `post` helpers), `web/src/Start.jsx` (new), `web/src/main.jsx`, `web/src/Projector.jsx`, `web/src/RoundReport.jsx`, `web/src/projector.css`, `docs/ARCHITECTURE.md`, `README.md`.
- **Seams:** the HTTP API; for tests, `net.js` exports `connect(url, onState, EventSourceImpl)` and `post(path, body, fetchFn)`, which take their transport as an argument, and `chooseRole(storage)` / `savedRole(storage)` over a `sessionStorage`-like object.
- **Decisions:**
  - User: "idm logging in as admin or join as guest". The start screen has "Host" and "Join as guest". The choice is kept in the tab's `sessionStorage`, so a refresh keeps the role. If the host stream is refused (`403`), the start screen says hosting works only on the laptop running the server. Doc delta.
  - "Leave" on the projector returns to the start screen (user, confirmed). Doc delta.
  - `main.jsx` loads the bot named by `state.bot` with `loadBot("bots/" + name)` and loads it again when the name changes. Doc delta.
  - User: "both" for choosing the game. The bot picker lists `GET /api/host/bots` and starts a new match with the chosen file; it replaces `?bot=`. Best of 3 / 5 and New match post `new`. Doc delta.
  - The client checks the pick against `decision.move` before posting, so the wrong-pick shake stays immediate; the server still refuses a wrong pick (code: `web/src/Projector.jsx`, `onPick`). Doc delta.
  - Tabs, the wrong-pick shake and the win screen overlay are local to the host's browser (user, confirmed). Doc delta.
  - "What did they throw?" buttons show only in phase `"reveal"` when nothing has been thrown (user, confirmed). Doc delta.
  - When the events stream drops, the screen shows a "Reconnecting" banner; `EventSource` reconnects on its own. Doc delta.
  - No offline mode: without the server the page shows an error naming `npm run dev` / `npm run host`. Doc delta.
- **Acceptance criteria:**
  - [x] `connect` calls `onState` with the parsed data of each `state` event and reports open and error to its caller (`web/test/net.test.js`, fake `EventSource`).
  - [x] `post` sends JSON to the path, resolves on `204`, and rejects with the server's `error` message and `status` on any other status (`net.test.js`, fake `fetch`).
  - [x] `chooseRole` stores `"host"` or `"player"`, `savedRole` reads it back, and an unknown stored value reads as `null` (`net.test.js`, fake storage).
  - [x] `npm run build` (from `web/`) succeeds.
  - [x] The full suite passes: `node --test "web/test/*.test.js"`.
- **Doc deltas:**
  - `docs/ARCHITECTURE.md`: `web/src/net.js` and `web/src/Start.jsx` in Modules; the start screen picks the role and the tab remembers it; `main.jsx` loads the bot named by the server; the projector reads the match from the server and keeps only its tabs, wrong-pick shake and win overlay locally; "Not included": no offline mode without the server.
  - `README.md`: "Projector view": choose Host on the start screen; the host picks the bot from a list; remove `?bot=`; the fallback buttons for entering the friend's move.
  - Decision made: `connect` returns `{onStatus, close}`; the caller sets `onStatus` to hear `"open"`, `"reconnecting"` (EventSource retries) or `"closed"` (`readyState` 2, it gave up). Goes in `docs/ARCHITECTURE.md` (`web/src/net.js` row).
  - Decision made: `chooseRole(storage, role)` takes the role as a second argument; `null` forgets it (Leave) and any other value throws. Key `rps.role`. Goes in `docs/ARCHITECTURE.md`.
  - Decision made: `net.js` also exports `getJson(path, fetchFn)` (rejects like `post` on any status but 200), used for `GET /api/host/bots`. Goes in `docs/ARCHITECTURE.md`; tested in `web/test/net.test.js`.
  - Decision made: EventSource hides the HTTP status, so Host first probes `GET /api/host/bots`: `403` shows the hosting-only-on-the-server-laptop message, any other failure shows the error naming `npm run dev` / `npm run host`; a closed host stream probes again the same way. Goes in `docs/ARCHITECTURE.md`.
  - Decision made: the guest status, Free the seat, the bot picker and Leave sit in a strip between the scene and the tab bar, since the tab bar is full. No doc needed: layout only.
  - Decision made: until the guest screen exists, Join as guest shows a placeholder with Back. No doc needed: replaced by the guest screen.
  - Decision made: a failed host `POST` shows its error in a banner under the strip. Goes in `docs/ARCHITECTURE.md`.

### S4: Guest screen

- **Goal:** "Join as guest" opens a minimal guest screen: the score, the round, three move buttons, the locked throw while waiting, the round result and the match result. It has no host controls.
- **Blocked by:** S3
- **Files:** `web/src/Player.jsx` (new), `web/src/main.jsx`, `web/src/net.js`, `web/src/projector.css` or a new `web/src/player.css`, `docs/ARCHITECTURE.md`, `PRODUCT.md`.
- **Seams:** the HTTP API (`GET /api/events?role=player&seat=…`, `POST /api/player/claim`, `/throw`, `/leave`); for tests, `net.js` exports `seatId(storage, random)`.
- **Decisions:**
  - The seat id is a random string kept in the tab's `sessionStorage` under one key, so a refresh keeps the seat (user, confirmed). It is not made with `crypto.randomUUID`, which browsers do not offer on a plain-`http` LAN address. Doc delta.
  - With `seat` `"taken"` the screen shows "Someone else is playing"; with `seat` `"empty"` it posts `claim` once (user, confirmed). Doc delta.
  - "Leave" posts `leave` and returns to the start screen (user, confirmed). Doc delta.
  - The guest screen never shows the bot's matrices or its move before the round has played (docs: `PRODUCT.md` "The human's screen stays minimal"; user, confirmed). Doc delta for the rest.
  - User: "i don't need phone. everything accessed on laptop". Designed for a laptop browser; no phone layout. Uses the cards and move icons from `ui.jsx`. Doc delta (Out of scope).
- **Acceptance criteria:**
  - [ ] `seatId` returns the stored id when there is one, and otherwise makes one from `random`, stores it and returns it; two calls on one storage return the same id (`web/test/net.test.js`).
  - [ ] `npm run build` (from `web/`) succeeds.
  - [ ] The full suite passes: `node --test "web/test/*.test.js"`.
- **Doc deltas:**
  - `docs/ARCHITECTURE.md`: `web/src/Player.jsx` in Modules; the guest screen shows only the score, the round, the throw buttons, the result and the match result; the seat id is kept in the tab's `sessionStorage`; "Not included": no phone layout.
  - `PRODUCT.md`: the human player plays on a second laptop; their view: throw, wait, result, match result; "Someone else is playing" for a second guest.

## Human checks

- [ ] (S2) Both laptops on the same wifi. On the presenter laptop, from `web/`, run `npm run host` and open `http://localhost:5173/`; choose Host. On the friend's laptop open the "Network" URL Vite prints; choose Join as guest. Expected: the projector on one, the guest screen on the other.
- [ ] (S2) On the friend's laptop, choose Host. Expected: the start screen says hosting works only on the laptop running the server.
- [ ] (S2) If the friend's laptop cannot load the page: both laptops join a hotspot (phone or Windows Mobile hotspot), rerun `npm run host`, and follow the README steps. Expected: the page loads at the Network URL on the hotspot.
- [ ] (S3) Play a best of 3 to the end: pick on the host, throw on the guest, Next on the host. Expected: both screens show each result; only the host has Next, New match, Best of 3/5, the bot picker and Free the seat; the win screen opens on the host and the match result on the guest.
- [ ] (S3) Throw on the guest before the host picks. Expected: the projector shows "thrown" without the move; after the pick the round plays at once.
- [ ] (S3) Pick another bot in the host's picker. Expected: a new match with that bot's numbers on the projector, and the guest screen back at round 1.
- [ ] (S3) Refresh the host tab mid-round. Expected: still host, same round, score and phase.
- [ ] (S3) Close the guest tab mid-round, then pick on the host. Expected: the projector shows the guest offline and the fallback throw buttons; using them plays the round.
- [ ] (S4) Refresh the guest tab mid-round. Expected: it keeps the seat and the locked throw.
- [ ] (S4) Open a second guest tab. Expected: "Someone else is playing". After "Free the seat" on the host (or "Leave" on the first guest), the second tab gets the seat.
- [ ] (S4) The guest screen is readable on a laptop; no matrix, decision or bot move shows before the round has played.
- [ ] (S3) The projector layout still fits with the added guest status, bot picker and Leave button.
