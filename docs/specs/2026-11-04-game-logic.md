# Game logic: load the bot JSON and run a best-of-3 or best-of-5 match in JavaScript

**Status:** draft

**Repo:** `d:\SMU\CS103\proj\rps-transition-matrix`

**Context file to update:** none named.

**Commands:**

- Full test suite: `python -m pytest` and `node --test frontend/test/`
- Single test file: `python -m pytest tests/test_bot.py`; `node --test frontend/test/game.test.js`
- Typecheck: none
- Lint: none

## Dependencies and blockers

| Subtask | Blocked by |
|---|---|
| S1 | none |
| S2 | S1 |

Run order: S1, S2.

External blockers: Q4, Q5 below.

Uncommitted changes that must stay out of every commit (all present before this task): the modified tracked `__pycache__/*.pyc` files under `src/rps_markov/` and `tests/`, and the untracked `__pycache__/*.pyc` files. `transient`

Branch: proposed `feat/game-logic`, created from `feat/best-move-bot` (the bot JSON export is not on `main` yet). `transient`

## Open questions

4. **ASSUMED Q4: one bot per game.** `newGame(bot, bestOf)` takes one loaded bot JSON; two games (e.g. friend and pooled) can exist side by side because a game holds its own state. Affects S1.
5. **ASSUMED Q5: game state is immutable.** `playRound` returns a new game and never changes the one passed in. Affects S1.

## Suggested splits

No split: S2 tests S1's module against Python's export.

## Out of scope

- The UI: HTML, buttons, panels, charts, banners, and how the live tally is drawn. Built later in `frontend/` (the user plans to use the Impeccable design skill for it). Recorded by S1 (ARCHITECTURE "Not included").
- Any HTTP server: the game loads a static JSON file. Already recorded (ARCHITECTURE "Not included").
- Any math beyond reading exported numbers, adding up per-round values and counting round wins: no matrix products, no eigenvalues, no re-deciding moves in JS. Recorded by S1 (ARCHITECTURE rules).
- The match win probability panel (user, best-move-bot spec: "remove the match win for now"). The match length only decides when the game ends. Already recorded (ARCHITECTURE "Not included").
- Undo, save or replay of a game. Recorded by S1 (ARCHITECTURE "Not included").
- Cleaning the tracked `__pycache__` files out of git. `transient`

## Interfaces

`frontend/game.js` (ES module), introduced by S1; S2 tests against it. Doc delta to `docs/CONTRACTS.md`, new section "Game logic".

| Export | Signature | Meaning |
|---|---|---|
| `validateBot` | `(data: object) => object` | returns `data` unchanged if it has the shape below; otherwise throws `Error` whose message names the first bad key |
| `loadBot` | `(url: string, fetchFn = fetch) => Promise<object>` | fetches `url`, parses JSON, returns `validateBot(data)`; a non-OK response throws `Error` with the status |
| `outcomeOf` | `(bot, botMove: string, humanMove: string) => {botScore, outcome, token}` | `botScore` = `bot.payoff.A[i(botMove)][i(humanMove)]`; `outcome` from the human's side: `botScore` +1 → `"lose"`, 0 → `"tie"`, −1 → `"win"`; `token` = `humanMove` + `W`/`L`/`T` for that outcome. A move not in `bot.moves` throws `Error` |
| `newGame` | `(bot, bestOf: 3 \| 5) => Game` | round 1, `decision` = `bot.opening`, empty history, zero totals; any other `bestOf` throws `Error` |
| `playRound` | `(game, humanMove: string, botMove: string) => Game` | plays one round with the move the frontend chose for the bot; returns a new `Game`. Throws `Error` if `game.winner` is not `null`, or if either move is not in `bot.moves` |

`i(move)` is the index of `move` in `bot.moves`, never a hardcoded order.

`validateBot` checks: `moves` equals `["R","P","S"]`; `tokens` equals `["RW","RL","RT","PW","PL","PT","SW","SL","ST"]`; `payoff.A` is 3 × 3 numbers; `opening` and every `decisions[t]` for t in `tokens` exist, have `move` in `moves`, and `scores` and `q` of length 3; `opening.expected_score` and each `decisions[t].expected_score` are numbers. Other keys are not checked.

`Game` (plain object, frozen with `Object.freeze`, history entries frozen too):

| Field | Type | Meaning |
|---|---|---|
| `bot` | object | the loaded bot JSON |
| `bestOf` | 3 or 5 | the match length chosen at the start |
| `target` | 2 or 3 | round wins needed to take the match: (`bestOf` + 1) / 2 |
| `round` | int | the number of the next round to play, starting at 1; ties count as rounds |
| `decision` | object | the bot's decision for the next round: `bot.opening` in round 1, else `bot.decisions[last token]` |
| `history` | array of `Round` | rounds played, oldest first |
| `tally` | `{win, lose, tie}` ints | rounds by outcome, from the human's side |
| `winner` | `null`, `"human"` or `"bot"` | `"human"` once `tally.win` reaches `target`, `"bot"` once `tally.lose` reaches `target`; `null` before |
| `expectedTotal` | number | sum of each round's `expectedScore` |
| `actualTotal` | int | sum of each round's `botScore` (bot round wins minus human round wins) |

`Round` (one history entry):

| Field | Type | Meaning |
|---|---|---|
| `round` | int | round number |
| `decision` | object | the decision the bot had for this round |
| `botMove` | string | the move the frontend chose for the bot |
| `recommendedMove` | string | `decision.move` |
| `recommended` | bool | `botMove === recommendedMove` |
| `humanMove` | string | the human's move |
| `botScore` | int | from `outcomeOf` with `botMove` |
| `outcome` | string | from `outcomeOf` with `botMove` |
| `token` | string | from `outcomeOf` with `botMove`; the state for the next round |
| `expectedScore` | number | `decision.scores[i(botMove)]` |
| `recommendedExpectedScore` | number | `decision.expected_score` |
| `expectedTotal`, `actualTotal` | number | the running totals after this round |

## Subtasks

### S1: Game module with load, validation, rounds and match end

- **Goal:** `frontend/game.js` loads and validates a bot JSON and plays a best-of-3 or best-of-5 match, keeping history, tally, running totals and the winner, using only numbers read from the JSON.
- **Blocked by:** none.
- **Files:** `frontend/game.js` (new), `frontend/package.json` (new), `frontend/test/game.test.js` (new), `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `README.md`, `GLOSSARY.md`.
- **Seams:** the exports `validateBot`, `loadBot`, `outcomeOf`, `newGame`, `playRound`.
- **Decisions:**
  - JavaScript, not Java: the frontend runs in a browser and reads a static JSON file (user). Doc delta (ARCHITECTURE).
  - The frontend lives in `frontend/` in this repo (user: "in frontend/"). Doc delta (ARCHITECTURE: data flow, module table; remove the "No frontend (browser/JS, outside this repo)" bullet from "Not included").
  - Game logic comes before the UI, as a module with no DOM code (user). Doc delta: "`frontend/game.js` has no DOM code; the UI only calls it" (ARCHITECTURE rules).
  - Plain ES modules, no npm dependencies, tests with Node's built-in `node --test`; `frontend/package.json` holds only `"type": "module"` and a `test` script (user approved; the Impeccable skill needs nothing from the game logic, since it designs the UI). Doc delta (README).
  - The frontend always chooses the bot's move and passes it in (user: "frontend choose no matter what"). So `botMove` is a required argument of `playRound`, with no default. Doc delta (CONTRACTS, Game logic).
  - The match length is chosen at the start: best of 3 or best of 5 (user: "start can choose bets of 3 or 5"). First to `target` round wins takes the match, and ties don't count towards it (`docs: PRESENTATION-FLOW.md` 2.4: "first to n round wins, with ties replayed"). No round can be played after the match is won. Doc delta (CONTRACTS, Game logic).
  - Each round's expected score is the score of the move played, `decision.scores[i(botMove)]` (user: "yes"). Doc delta (CONTRACTS, Game logic).
  - A live tally is shown. When the chosen move differs from the bot's move, the tally shows both; otherwise it shows only one (user: "have a live tally also if chosen != bot move then show both. else only show one"). So each `Round` keeps `botMove`, `recommendedMove`, `recommended`, `expectedScore` and `recommendedExpectedScore`. Doc delta (CONTRACTS, Game logic: the `Round` fields; ARCHITECTURE: the UI rule for the tally).
  - Round 1 plays `opening`; every later round plays `decisions[token]` for the human's previous token (`docs: PRESENTATION-FLOW.md` 2.4, `docs: CONTRACTS.md` Bot). Doc delta (CONTRACTS, Game logic).
  - The round outcome comes from the exported A, `A[bot, human]`: +1 bot wins, 0 tie, −1 human wins (`docs: CONTRACTS.md` Bot JSON file). Doc delta (already recorded; the Game logic section points to it).
  - The token is from the human's side and is built from the move actually played for the bot (`docs: CONTRACTS.md` Bot, `get_move`). Doc delta (CONTRACTS, Game logic).
  - Move indices come from `bot.moves`, never a hardcoded order. Doc delta (CONTRACTS, Game logic).
  - The actual score is bot round wins minus human round wins (`docs: PRESENTATION-FLOW.md` 2.4, "Expected score against actual score"). Doc delta (CONTRACTS, Game logic).
  - The frontend does no math beyond reading exported numbers, adding up per-round values and counting round wins (`docs: ARCHITECTURE.md`). Doc delta (ARCHITECTURE rule, replacing the "No running totals" bullet in "Not included").
  - Q4, Q5 as settled. OPEN.
- **Acceptance criteria:**
  - [ ] For all 9 (botMove, humanMove) pairs on a hand-built bot, `outcomeOf` gives `botScore` equal to the PRESENTATION-FLOW 2.4 A table, the human-side outcome, and the token (e.g. bot P, human R → `botScore` 1, `"lose"`, `"RL"`). `frontend/test/game.test.js` "outcomeOf covers all pairs"
  - [ ] `outcomeOf` and `playRound` with a move not in `bot.moves` throw. `frontend/test/game.test.js` "unknown move throws"
  - [ ] `newGame(bot, 3)` has `bestOf` 3, `target` 2, `round` 1, `decision` equal to `bot.opening`, empty `history`, tally all 0, `winner` null, both totals 0; `newGame(bot, 5)` has `target` 3; `newGame(bot, 4)` throws. `frontend/test/game.test.js` "newGame"
  - [ ] After `playRound(newGame(bot, 3), "R", "P")`, `decision` is `bot.decisions[token]` for the token of round 1, `round` is 2, and the history has one `Round` with every field per the Interfaces table. `frontend/test/game.test.js` "playRound uses the token for the next decision"
  - [ ] `playRound` with `botMove` equal to `decision.move` records `recommended` true and `expectedScore` equal to `recommendedExpectedScore`; with another move it records `recommended` false, uses `botMove` for `botScore` and `token`, and `expectedScore` = `decision.scores[i(botMove)]`. `frontend/test/game.test.js` "chosen move versus recommended move"
  - [ ] Over a scripted game, `tally`, `expectedTotal` and `actualTotal` equal the sums over the history, and each entry's totals are the running sums up to it. `frontend/test/game.test.js` "totals are running sums"
  - [ ] In best of 3, ties leave `winner` null; `winner` becomes `"bot"` on the bot's 2nd round win and `"human"` on the human's 2nd; in best of 5, on the 3rd. `playRound` on a game with a winner throws. `frontend/test/game.test.js` "match ends at target"
  - [ ] `playRound` leaves the game passed in unchanged, and the returned game and its history entries are frozen. `frontend/test/game.test.js` "playRound is immutable"
  - [ ] A bot whose `moves` are in a different order than R, P, S is rejected by `validateBot`; for each check in the Interfaces list, a bot missing or breaking it throws an `Error` naming that key. `frontend/test/game.test.js` "validateBot rejects bad shapes"
  - [ ] `loadBot` with a stub `fetchFn` returns the validated data; a stub with `ok: false` throws an `Error` containing the status. `frontend/test/game.test.js` "loadBot"
- **Doc deltas:**
  - `docs/CONTRACTS.md`: new "Game logic" section with the Interfaces tables above and the rules from Decisions.
  - `docs/ARCHITECTURE.md`: data flow ends in `frontend/game.js`; module table row for `frontend/game.js`; rules: no DOM code in it, no math beyond reading, summing and counting round wins, the live tally shows both moves only when they differ; "Not included": the UI (for now), undo/save/replay; remove the "No frontend … outside this repo" and "No running totals" bullets.
  - `README.md`: a "Game logic" section with the test command.
  - `GLOSSARY.md`: **Match** (best of 3 or 5: first to 2 or 3 round wins, ties don't count); **Game** (one human's match against one loaded bot: history, tally, totals, winner); **Round record** (one played round: decision, chosen and recommended moves, outcome, token, scores); **Live tally** (the per-round record shown during the game; it shows the chosen and the recommended move only when they differ).

### S2: Fixture from the Python export and cross-language check

- **Goal:** the JS game is tested against a real `Bot.to_dict()` export, and a pytest fails if that fixture no longer matches Python.
- **Blocked by:** S1.
- **Files:** `frontend/test/fixtures/bot_synthetic.json` (new), `frontend/test/game.fixture.test.js` (new), `tests/test_bot.py`, `README.md`.
- **Seams:** `frontend/game.js` exports; `Bot.to_dict()`; `python -m rps_markov.bot`.
- **Decisions:**
  - The fixture is `Bot(Counts(count(synthetic_rounds(seed=7)))).to_dict()`, the counts `tests/test_bot.py` already uses, written as JSON (`code: tests/test_bot.py`). `data/` is gitignored, so the fixture lives under `frontend/test/fixtures/` (`docs: ARCHITECTURE.md`). Doc delta (README: how to regenerate it).
  - Fixture floats are compared within 1e-12, since `np.linalg.eig` output can differ in the last bits across machines. `transient`
- **Acceptance criteria:**
  - [ ] `validateBot` accepts the fixture. `frontend/test/game.fixture.test.js` "fixture is a valid bot"
  - [ ] For every token t and every human move, playing a round with the recommended move from a game whose last token is t gives `decision` = `fixture.decisions[next token]`, and the 3 next tokens from state t (one per human move) are exactly the 3 nonzero rows of column t of the 9 × 9 export (`fixture.match.P`). `frontend/test/game.fixture.test.js` "tokens match the 9 x 9 chain"
  - [ ] `tests/test_bot.py::test_frontend_fixture_is_current`: the fixture equals `Bot(synthetic_counts()).to_dict()` (strings and ints exactly, floats within 1e-12). `python -m pytest tests/test_bot.py`
- **Doc deltas:**
  - `README.md`: the command that regenerates the fixture, and that `node --test frontend/test/` is part of the test suite.

## Human checks

none
