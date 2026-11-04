# Contracts

## Round CSVs (master and partitions)

`data/processed/rps_human_combined.csv` and every file in `data/processed/partitions/` have exactly these columns, in this order: `dataset, game_id, player_id, round, move, opp_move, outcome, prev_move, prev_opp_move, prev_outcome`.

| Column | Values |
|---|---|
| `dataset` | `brockbank` or `wxz` |
| `game_id`, `player_id` | unique across datasets |
| `round` | 1–300 |
| `move`, `opp_move` | `R` / `P` / `S` |
| `outcome` | `win` / `lose` / `tie`, for this player |
| `prev_move`, `prev_opp_move`, `prev_outcome` | previous round of the same player; empty on round 1 or after an invalid round |

`(player_id, round)` is unique. Loading a round CSV for counting needs only `player_id`, `round`, `move` and `outcome`; a file missing any of them is rejected.

## Partition files

Written by the notebook to `data/processed/partitions/`: `train_brockbank`, `test_brockbank`, `train_wxz`, `test_wxz`, `train_pooled`, `test_pooled` (`.csv`).

- Per dataset, `floor(0.2 × players)` players go to test, chosen with seed 103; the same seed gives the same split.
- Pooled = the brockbank rows, then the wxz rows, of the same split.
- The master is read, never written.

Code: `src/rps_markov/partition.py`.

## States

- Everything is k = 1: a state is the player's previous round, one of the 9 tokens. There is no `k` parameter and no `-` in a label.
- Token order is fixed: `RW, RL, RT, PW, PL, PT, SW, SL, ST` (move-major, then outcome `W, L, T`). `BasicTransitionMatrix` relies on this order when it sums out the outcome.
- A row gets a state only if its player has a row at round r-1.

Code: `src/rps_markov/count.py` (`MOVES`, `OUTCOMES`, `TOKENS`, `load_rounds`, `add_history`).

## Counting

`count.py` only counts round CSVs and writes `N_<name>.csv`; it builds no matrix.

- `add_history(df) -> pd.DataFrame`: copy of df with column `state` (the player's previous round as a token), keeping only rows whose player has a row at round r-1.
- `count(df) -> pd.DataFrame`: labelled 3 × 9 N. Index `R, P, S` (next move), columns `TOKENS` (previous token), int values; total = number of rows with a state.
- A move or outcome outside the values in "Round CSVs" on any row of df, including rows that get no state (e.g. round 1), is a `ValueError`.

Code: `src/rps_markov/count.py`.

## Counts

`Counts(frame: pd.DataFrame)` loads and holds N in memory and does nothing else.

- `states: list[str]` (= `TOKENS`); `values: np.ndarray`, int, 3 × 9, not writeable (writing raises `ValueError`), so a matrix's cache cannot go stale.
- The frame's values are copied; changing the frame later cannot change N.
- The index must be exactly `R, P, S` and the columns exactly `TOKENS`, in that order; otherwise `ValueError`. It never reorders. A k = 3 file is rejected.
- `Counts.load(path)` (classmethod) reads an `N_<name>.csv`.
- Any N file in the format of "Matrix files" is accepted; nothing depends on which dataset or player it came from.

Code: `src/rps_markov/markov.py` (`Counts`).

## Matrices

`Matrix` (`src/rps_markov/matrix.py`) is the abstract base (`abc.ABC`; instantiating it raises `TypeError`) of every labelled matrix, transition and payoff.

- `rows: list[str]`, `columns: list[str]`.
- `values: np.ndarray` (abstract; len(rows) × len(columns)). Subclasses compute it on first access and cache it (`functools.cached_property`).
- `to_frame() -> pd.DataFrame`: index `rows`, columns `columns`.
- `m @ x` is `values @ x` for any `Matrix`.

Matrix classes neither load nor count: they take a `Counts` (or another matrix) and the caller picks the class. P, the 9 × 9 and A are computed on first use, cached and never written to disk. alpha is fixed at construction.

## Transition matrix

All classes are in `src/rps_markov/markov.py`.

- `TransitionMatrix(Matrix)`: abstract; column-stochastic P. `states` is the same list as `columns`; `P` is the same array as `values`. `column(state) -> np.ndarray` (`KeyError` on an unknown label); `predict(x) -> np.ndarray` is `P @ x`, for a belief x over states.
- `OutcomeTransitionMatrix(counts: Counts, alpha: float = 1.0)`: 3 × 9, rows `MOVES`, states `TOKENS`. P = (N + alpha) / column sums. Default alpha = 1, so an unseen state's column is `[1/3, 1/3, 1/3]`.
- `SquareTransitionMatrix(TransitionMatrix)`: abstract; `rows == states`. Adds:
  - `eigenvalues: np.ndarray`: complex, sorted by modulus descending (the first is 1); equal moduli keep NumPy's order (stable sort). `eigenvalues` and `stationary` share one cached `np.linalg.eig` call.
  - `stationary: np.ndarray`: real, the eigenvector for the eigenvalue closest to 1 (so NumPy's sign does not matter), divided by its sum so it sums to 1. `ValueError` if eigenvalue 1 appears more than once (within 1e-9), because π is then not unique; `eigenvalues` still works.
  - `moduli: np.ndarray`: the modulus of each entry of `eigenvalues`, same order.
  - `eigenvalue_one_multiplicity: int`: how many eigenvalues are within 1e-9 of 1 (the test `stationary` uses).
  - `has_unit_cycle: bool`: some eigenvalue has modulus within 1e-9 of 1 but is not within 1e-9 of 1 (e.g. −1): π is unique but the chain cycles and never settles.
  - `look_ahead(x, tol: float = 0.01, max_steps: int = 100) -> np.ndarray`: shape (t + 1, n); row 0 is x, row k is Pᵏ x. Stops at the first t where the sum of absolute differences between row t and row t−1 is below tol (that converged row is included), or at t = max_steps.
  - `rounds_to_fade(fraction: float = 0.1) -> int | None`: the smallest t with modulus(λ₂)ᵗ < fraction, i.e. ceil(ln fraction / ln modulus(λ₂)). 0 only when modulus(λ₂) is exactly 0 (on a uniform P floating point gives about 1e-17, so it returns 1). `None` when modulus(λ₂) ≥ 1 − 1e-9.
  - `closed_groups: list[list[str]]`: the closed communicating classes of the chain, from the exact nonzero pattern of P (an entry counts if it is > 0, so tiny smoothed entries such as alpha 1e-12 still count as moves). Each group lists its state labels in `states` order; groups are sorted by their first state's index.
  - `group_stationary: list[np.ndarray]`: per closed group, its own steady state over all n states (zero outside the group), summing to 1; the eigenvalue-1 eigenvector of P restricted to the group's rows and columns, padded with zeros.
  - `transient_states: list[str]`: states in no closed group, in `states` order; the states π gives 0.
  - All eigenvalue tests share one tolerance, the module constant `EIGEN_TOL` = 1e-9. These members are for display and never affect a move.
- `BasicTransitionMatrix(counts: Counts, alpha: float = 1.0)`: a `SquareTransitionMatrix`, 3 × 3, rows and states `MOVES`. The constructor collapses the 3 × 9 N to a 3 × 3 move-count matrix M: column `m` of M = the sum of N's columns `mW`, `mL`, `mT` (reshape to 3 × 3 × 3, sum the last axis). This equals counting next move against previous move directly, since both need the same previous round. alpha is added after collapsing: P = (M + alpha) / column sums, so an unseen previous move gives `[1/3, 1/3, 1/3]`.
- `BotMatchTransitionMatrix(outcome_matrix: OutcomeTransitionMatrix, payoff: PayoffMatrix)`: a `SquareTransitionMatrix`, 9 × 9, rows and states `TOKENS`; one human against the bot that plays its best move in every state. It works on any `OutcomeTransitionMatrix`; any other type (e.g. a `BasicTransitionMatrix`) raises `TypeError` from an explicit check in the constructor (P itself is built lazily). Construction: for state s, bot move b = `payoff.best_move(outcome_matrix.P[:, s])`; for each human next move m, `P[token(m, outcome), s] = outcome_matrix.P[m, s]`, where the outcome comes from the payoff, `A[b, m]` (+1 → human `L`, 0 → `T`, −1 → `W`); all other entries 0. With alpha > 0 each column has exactly 3 nonzero entries.
  - `outcome_rates: dict[str, float]`: keys `win`, `lose`, `tie`, from the human's side (the bot's win rate is the human's `lose`); `stationary` summed over the `*W`, `*L`, `*T` tokens; sums to 1. Raises the same `ValueError` as `stationary` when π is not unique (a reducible chain, e.g. states RT, PW, SL all make the bot play R and RW, PL, ST all make it play S).
  - `edge: float`: `outcome_rates["lose"] − outcome_rates["win"]`, the bot's expected score per round in the long run; same `ValueError` as `stationary` when π is not unique.
  - `edge_check: float`: Σₛ π(s) · (largest entry of A q for state s), the same number computed the other way; same `ValueError`.
  - `group_outcome_rates: list[dict[str, float]]`: per closed group, `win`, `lose`, `tie` (human's side, like `outcome_rates`) from its `group_stationary`.

`OutcomeTransitionMatrix` has none of the square-matrix members above.

## Payoff

`PayoffMatrix()` (`src/rps_markov/payoff.py`), a `Matrix`; fixed, so it needs no data. Rows = bot move, columns = human move, both `R, P, S`.

- `A: np.ndarray`, the same array as `values`; int; `[[0, -1, 1], [1, 0, -1], [-1, 1, 0]]` (+1 bot wins, 0 tie, −1 bot loses).
- `scores(q) -> np.ndarray`: `A @ q`, the bot's expected score per move against a human move distribution q.
- `best_move(q) -> str`: the move in `R, P, S` with the highest score. A tie means exactly equal scores (`np.argmax`, no tolerance); the first move wins. This can differ from countering the most likely human move.

## Bot

`Bot(counts: Counts, alpha: float = 1.0, name: str | None = None)` in `src/rps_markov/bot.py`. `name` is the opponent's display name, read back by the `name` property and exported as `opponent`. It takes a `Counts` and never loads. Building it computes nothing; the matrices and `opening` compute on first access and are cached.

- The bot keeps no state between calls. None of its matrices change after it is built, so `get_move(s)` depends only on s. Matrices live on each instance, so several bots can exist side by side.
- Read-only attributes (plain properties; they cannot be reassigned): `outcome` (`OutcomeTransitionMatrix`, 3 × 9), `basic` (`BasicTransitionMatrix`, 3 × 3), `payoff` (`PayoffMatrix`, A), `match` (`BotMatchTransitionMatrix`, 9 × 9, built from `outcome` and `payoff`). Callers read internals through them (e.g. `bot.match.eigenvalues`); the bot does not re-export matrix getters. There is no `policy` member: the 9-state policy is `get_move(s).move` for each s in `TOKENS`.
- `get_move(state: str) -> Decision`: the decision after the human's previous token, from the human's side (`RL` = the human played R and lost). The caller computes that token from the move the bot actually played, not the recommended one. An unknown token raises `KeyError`. Ties in A q go to the first move in R, P, S (see Payoff, `best_move`).
- `opening -> Decision`: the round-1 decision, which has no state. x = π of `match`, q = `outcome.P @ π`. Falls back to the 3 × 3 steady state (x = q = `basic.stationary`, `source` `"basic"`) when `match.eigenvalue_one_multiplicity > 1` (π not unique) or `match.has_unit_cycle` (π unique but the chain cycles). The two members are tested before `match.stationary` is read, instead of catching its `ValueError`; the frontend tells the two fallback causes apart by the same two members. The real round-1 move distribution u₀ is not used.
- `to_dict() -> dict`: the JSON-safe export (see Bot JSON file).

`Decision` (frozen dataclass; fields compared with `np.array_equal`, so two decisions compare equal field by field and a decision is unhashable):

| Field | `get_move(state)` | `opening` |
|---|---|---|
| `state` | the token passed in | `None` |
| `x` | one-hot over `TOKENS` at `state` (9) | π of `match` (9), or π of `basic` (3) on fallback |
| `q` | `outcome.P @ x`, column `state` of P (3) | `outcome.P @ π`, or π of `basic` on fallback |
| `scores` | `payoff.scores(q)` (3) | same |
| `move` | `payoff.best_move(q)` | same |
| `source` | `"state"` | `"match"`, or `"basic"` on fallback |
| `counter_move` | the move that beats the most likely human move (argmax of q, first in R, P, S on a tie), read from A | same |
| `splits` | 3 × 3; rows bot move R, P, S; columns `win`, `tie`, `lose` from the bot's side; row b = the sum of q over human moves m with A[b, m] = +1, 0, −1 | same |
| `expected_score` | `scores` at `move` (the largest entry of A q) | same |

`Decision.to_dict()` has the same keys, arrays as lists of floats, `splits` as a list of 3 rows.

## Bot JSON file

Written by `python -m rps_markov.bot` (see CLI) from `Bot.to_dict()` for the browser frontend, which reads it as a static file. Everything in it is computed in Python and fixed before the game. Values are JSON-safe: lists of floats and ints, strings, `null`. Every matrix is a list of rows. Every eigenvalue list is a list of `[re, im]` pairs, sorted as `eigenvalues` sorts them. The frontend gets each round's outcome from the exported A (`A[bot, human]`: +1 bot wins, 0 tie, −1 human wins).

Top-level keys:

| Key | Content |
|---|---|
| `opponent` | string, the bot's `name`; `null` when not given |
| `tokens`, `moves` | `TOKENS`, `MOVES` |
| `alpha` | float; read from `outcome.alpha`, the value the matrices were built with |
| `payoff` | `{A}`: 3 × 3 ints, rows bot move, columns human move |
| `outcome` | `{P}`: 3 × 9 |
| `basic` | `{P, eigenvalues, moduli, eigenvalue_one_multiplicity, has_unit_cycle, rounds_to_fade, stationary, closed_groups, transient_states}`; `rounds_to_fade` is `rounds_to_fade(0.1)` |
| `match` | the same keys as `basic`, plus `outcome_rates`, `edge`, `edge_check`, `group_stationary`, `group_outcome_rates` |
| `opening` | `Decision.to_dict()` |
| `decisions` | object keyed by the 9 `TOKENS`, each `get_move(s).to_dict()` |
| `policy` | `{S, B}`: S = A P (3 × 9, column s = `decisions[s].scores`), B = 3 × 9 one-hot of `decisions[s].move` |
| `look_ahead` | object keyed by the 9 `TOKENS`, each `{rows, stopped_at}`: `rows` = `match.look_ahead(one-hot s)` as a list of 9-vectors, `stopped_at` = its row count − 1 |

`stationary`, `outcome_rates`, `edge` and `edge_check` are `null` when π is not unique, tested by `eigenvalue_one_multiplicity == 1` rather than by catching `ValueError`, so no other error is hidden (the same rule makes `basic.stationary` `null` if the 3 × 3 π is ever not unique). `rounds_to_fade` is `null` when modulus(λ₂) ≥ 1 − 1e-9. `eigenvalue_one_multiplicity`, `closed_groups`, `group_stationary` and `group_outcome_rates` give the banner and the per-group rates (PRESENTATION-FLOW 2.4).

## Game logic

`web/src/game.js`, a plain ES module with no dependencies, no DOM code and no React import. It loads a Bot JSON file (see above) and plays one match of best of 3 or best of 5. The frontend always chooses the bot's move and passes it in; `botMove` is a required argument of `playRound`, with no default.

| Export | Signature | Meaning |
|---|---|---|
| `validateBot` | `(data: object) => object` | returns `data` unchanged if it has the shape below; otherwise throws `Error` whose message is `bad bot JSON: <key>`, naming the first bad key |
| `DEFAULT_BOT_URL` | `string` | `"bots/bot_rps_human_combined.json"`, relative to the page; Vite serves it from `web/public/bots/`. The default bot is the one built from all human rounds |
| `loadBot` | `(url: string = DEFAULT_BOT_URL, fetchFn = fetch) => Promise<object>` | fetches `url`, parses JSON, returns `validateBot(data)`; a non-OK response throws `Error` with the status |
| `outcomeOf` | `(bot, botMove: string, humanMove: string) => {botScore, outcome, token}` | `botScore` = `bot.payoff.A[i(botMove)][i(humanMove)]`; `outcome` from the human's side: `botScore` +1 → `"lose"`, 0 → `"tie"`, −1 → `"win"`; `token` = `humanMove` + `W`/`L`/`T` for that outcome. A move not in `bot.moves` throws `Error("unknown move: <move>")` |
| `newGame` | `(bot, bestOf: 3 \| 5) => Game` | round 1, `decision` = `bot.opening`, empty history, zero totals; any other `bestOf` throws `Error` |
| `playRound` | `(game, humanMove: string, botMove: string) => Game` | plays one round with the move the frontend chose for the bot; returns a new `Game`. Checks `winner` first, then the moves: throws `Error` if `game.winner` is not `null`, or if either move is not in `bot.moves` |

`i(move)` is the index of `move` in `bot.moves`, never a hardcoded order.

`validateBot` checks (errors read `bad bot JSON: <key>`, with dotted keys such as `payoff.A`, `opening.move`, `decisions.PL.scores`; a missing parent is reported as the parent, e.g. `opening`, `decisions.ST`):

- the data is a JSON object, not an array and not `null` (key `(root)`);
- `moves` equals `["R","P","S"]`; `tokens` equals `["RW","RL","RT","PW","PL","PT","SW","SL","ST"]`;
- `payoff.A` is 3 × 3 and every entry is +1, 0 or −1 (the values `outcomeOf` maps to an outcome);
- `opening` and every `decisions[t]` for t in `tokens` are objects (not arrays), have `move` in `moves`, and `scores` and `q` each hold 3 finite numbers; `expected_score` is a finite number. `decisions` itself is an object.

Other keys are not checked.

Rules:

- Round 1 plays `bot.opening`; every later round plays `bot.decisions[token]` for the human's previous token. The token is from the human's side and is built from the move actually played for the bot, not the recommended one.
- The round outcome comes from the exported A, `A[bot, human]`: +1 bot wins, 0 tie, −1 human wins.
- The match ends when `tally.win` or `tally.lose` reaches `target`. Ties are replayed: they count as rounds but not towards `target`. No round can be played once `winner` is set.
- A round's expected score is the score of the move played, `decision.scores[i(botMove)]`. The actual score is bot round wins minus human round wins.
- One bot per game: `newGame` takes one loaded bot JSON, and each game holds its own state, so two games (e.g. friend and pooled) can exist side by side.
- Games are immutable: `playRound` never changes the game passed in. The returned `Game`, its `history` array, its `tally` object and the `Round` entries are frozen with `Object.freeze`. The bot JSON is not frozen. The UI keeps the game in React state and replaces it each round, e.g. `setGame(playRound(game, humanMove, botMove))`.
- Panels read numbers fixed for the match (9 × 9, eigenvalues, π, outcome rates, edge, policy, banner flags, A) straight from `game.bot`; the game logic adds no wrapper over the Bot JSON. Per-round numbers come from `game.decision` and `game.history`. `Game.state` lets the look-ahead panel pick `bot.look_ahead[state]`.

`Game` (plain object, frozen):

| Field | Type | Meaning |
|---|---|---|
| `bot` | object | the loaded bot JSON |
| `bestOf` | 3 or 5 | the match length chosen at the start |
| `target` | 2 or 3 | round wins needed to take the match: (`bestOf` + 1) / 2 |
| `round` | int | the number of the next round to play, starting at 1; ties count as rounds |
| `state` | `null` or string | the human's last token (the state for the next round); `null` before round 1 is played |
| `decision` | object | the bot's decision for the next round: `bot.opening` when `state` is `null`, else `bot.decisions[state]` |
| `history` | array of `Round` | rounds played, oldest first |
| `tally` | `{win, lose, tie}` ints | rounds by outcome, from the human's side |
| `winner` | `null`, `"human"` or `"bot"` | `"human"` once `tally.win` reaches `target`, `"bot"` once `tally.lose` reaches `target`; `null` before |
| `expectedTotal` | number | sum of each round's `expectedScore` |
| `actualTotal` | int | sum of each round's `botScore` (bot round wins minus human round wins) |

`Round` (one history entry, frozen):

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

Code: `web/src/game.js`.

## Matrix files

Only counts are persisted: `N_<name>.csv`.

| Part | Content |
|---|---|
| header | `move`, then `RW,RL,RT,PW,PL,PT,SW,SL,ST` |
| rows | 3: `R`, `P`, `S` |
| values | integer counts |

P, the 9 × 9 and A are never written to disk. Old `P_*.csv` and k = 3 `N_*.csv` files from earlier runs are not read; `Counts.load` rejects the k = 3 ones.

## CLI

`python -m rps_markov.count --csv <file> [<file> ...] --out <folder>`, with the `rps_markov` package installed (`pip install -e .`, which `requirements.txt` includes).

For each input `<name>.csv` it writes `N_<name>.csv` to `--out`, creating the folder if needed. `<name>` is the input file name without its extension, so two inputs with the same name overwrite each other's outputs. There is no `--k`, no `--alpha` and no other flag; the parser has `allow_abbrev=False`, so only the exact flags `--csv` and `--out` are accepted.

`python -m rps_markov.bot --counts <N file> --out <json file> [--alpha <float>] [--name <str>]` writes the Bot JSON file for one `N_<name>.csv`, creating the parent folder of `--out` if needed. `--alpha` defaults to 1.0. `--name` sets `opponent` in the JSON; it defaults to `<name>` from the counts file name (`N_` prefix removed). No other flag; `allow_abbrev=False`, so only the exact flags are accepted. The file is compact UTF-8 JSON written with `allow_nan=False`, so a NaN or infinity fails the export instead of producing a file a browser's `JSON.parse` rejects.
