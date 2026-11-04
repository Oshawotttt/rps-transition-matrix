# Best-move bot: every panel's numbers computed in Python and exported as JSON for the frontend

**Status:** approved

**Repo:** `d:\SMU\CS103\proj\rps-transition-matrix`

**Context file to update:** none named.

**Commands:**

- Full test suite: `python -m pytest`
- Single test file: `python -m pytest tests/test_bot.py`
- Typecheck: none
- Lint: none

## Dependencies and blockers

| Subtask | Blocked by |
|---|---|
| S1 | none |
| S2 | S1, S3 |
| S3 | none |
| S4 | S1, S2, S3 |

Run order: S1, S3, S2, S4.

External blockers: none.

Uncommitted changes that must stay out of every commit (all present before this task):

- Modified: `.gitignore`, `README.md`, `docs/CONTRACTS.md`, `docs/PRESENTATION-FLOW.md`, `notebooks/clean_data.ipynb`, `pyproject.toml`, `requirements.txt`, `src/rps_markov/markov.py`, and the tracked `__pycache__/*.pyc` files under `src/rps_markov/` and `tests/`.
- Untracked: `notebooks/make_matrix.ipynb`, `src/rps_markov/make-matrix.py`, and the untracked `__pycache__/*.pyc` files.
- Subtasks edit `README.md`, `docs/CONTRACTS.md`, `docs/PRESENTATION-FLOW.md` and `src/rps_markov/markov.py`, which already have uncommitted edits. Those pre-existing hunks must not be staged; stage only this task's hunks. `transient`

Branch: proposed branch: `feat/best-move-bot`, created from `main`. `transient`

## Suggested splits

No split: all subtasks are connected. S4 exports the output of S1–S3; S2 extends the `Bot` from S1 and uses `has_unit_cycle` from S3.

## Out of scope

- The frontend itself (browser/JS, outside this repo): game rules, score, round history, the human's move input, and whether to play the bot's recommended move. Recorded by S4 (ARCHITECTURE "Not included").
- Any HTTP server or API layer: the frontend reads a static JSON file. Recorded by S4 (ARCHITECTURE "Not included").
- Running totals over the game (live tally, expected vs actual score): the bot is stateless, so the frontend appends and adds up the exported per-round values (`q`, `expected_score`); no other arithmetic is in the frontend (user approved). Recorded by S4 (ARCHITECTURE "Not included").
- Updating any matrix during the game: P, A, the 9 × 9 and π are fixed once the bot is built. Recorded by S1 (ARCHITECTURE rules).
- Round-1 prediction from the real first-move distribution u₀. Recorded by S2 (ARCHITECTURE "Not included").
- The match win probability panel (any method: the split 9 × 9 or the absorbing chain) (user: "remove the match win for now. it's confusing and complicated"). Recorded by S4 (ARCHITECTURE "Not included").
- Cleaning the tracked `__pycache__` files out of git. `transient`

## Interfaces

Between subtasks. Python types; the frontend sees them only through the S4 JSON file.

`Bot(counts: Counts, alpha: float = 1.0)`, in `src/rps_markov/bot.py`:

| Member | Type | Meaning | Subtask |
|---|---|---|---|
| `outcome` | `OutcomeTransitionMatrix` | 3 × 9 P from `counts` and `alpha` | S1 |
| `basic` | `BasicTransitionMatrix` | 3 × 3 P from the same `counts` and `alpha` | S1 |
| `payoff` | `PayoffMatrix` | A | S1 |
| `match` | `BotMatchTransitionMatrix` | 9 × 9 M, built from `outcome` and `payoff` | S1 |
| `get_move(state: str)` | `Decision` | the decision after the human's previous token `state` | S1 |
| `opening` | `Decision` | the round-1 decision | S2 |
| `to_dict()` | `dict` | the JSON-safe export | S4 |

`Decision` (frozen dataclass, `src/rps_markov/bot.py`):

| Field | Type | `get_move(state)` | `opening` |
|---|---|---|---|
| `state` | `str \| None` | the token passed in | `None` |
| `x` | `np.ndarray`, shape (9,) or (3,) | one-hot over `TOKENS` at `state` | π of `match` (9,), or π of `basic` (3,) on fallback (eigenvalue 1 repeated, or `match.has_unit_cycle`) |
| `q` | `np.ndarray`, shape (3,) | `outcome.P @ x` = column `state` of P | `outcome.P @ π`, or π of `basic` on fallback |
| `scores` | `np.ndarray`, shape (3,) | `payoff.scores(q)` | `payoff.scores(q)` |
| `move` | `str` | `payoff.best_move(q)` | `payoff.best_move(q)` |
| `source` | `str` | `"state"` | `"match"`, or `"basic"` on fallback |
| `counter_move` | `str` | the move that beats the most likely human move (argmax of q, first in R, P, S on a tie) | same |
| `splits` | `np.ndarray`, 3 × 3 | rows bot move R, P, S; columns `win`, `tie`, `lose` from the bot's side; row b = the sum of q over human moves m with A[b, m] = +1, 0, −1 | same |
| `expected_score` | `float` | `scores` at `move` (the largest entry of A q) | same |

`Decision.to_dict()` (S4): the same keys, arrays as lists of floats; `splits` as a list of 3 rows.

`SquareTransitionMatrix` additions (S3, `src/rps_markov/markov.py`), inherited by `BasicTransitionMatrix` and `BotMatchTransitionMatrix`:

| Member | Type | Meaning |
|---|---|---|
| `look_ahead(x, tol: float = 0.01, max_steps: int = 100)` | `np.ndarray`, shape (t + 1, n) | row 0 is x, row k is Pᵏ x; stops at the first t with the sum of absolute differences between row t and row t−1 below tol, or at t = max_steps |
| `moduli` | `np.ndarray` | the modulus of each entry of `eigenvalues`, same order |
| `eigenvalue_one_multiplicity` | `int` | how many eigenvalues are within 1e-9 of 1 (the same test `stationary` uses) |
| `has_unit_cycle` | `bool` | some eigenvalue has modulus within 1e-9 of 1 but is not within 1e-9 of 1 |
| `rounds_to_fade(fraction: float = 0.1)` | `int` or `None` | the smallest t with modulus(λ₂)ᵗ < fraction: ceil(ln fraction / ln modulus(λ₂)); 0 when λ₂ = 0; `None` when modulus(λ₂) ≥ 1 − 1e-9 |
| `closed_groups` | `list[list[str]]` | the closed communicating classes ("closed groups") of the chain (from the nonzero pattern of P), each a list of state labels in `states` order; groups sorted by their first state's index |
| `group_stationary` | `list[np.ndarray]` | per closed group, its own steady state over all n states (zero outside the group), summing to 1 |
| `transient_states` | `list[str]` | states in no closed group, in `states` order |

`BotMatchTransitionMatrix` additions (S3, `src/rps_markov/markov.py`):

| Member | Type | Meaning |
|---|---|---|
| `edge` | `float` | `outcome_rates["lose"] − outcome_rates["win"]`: the bot's expected score per round in the long run; same `ValueError` as `stationary` when π is not unique |
| `edge_check` | `float` | Σₛ π(s) · (largest entry of A q for state s): the same number computed the other way; same `ValueError` |
| `group_outcome_rates` | `list[dict[str, float]]` | per closed group, `win`, `lose`, `tie` from its `group_stationary`, like `outcome_rates` |

JSON file (S4), top-level keys:

| Key | Content |
|---|---|
| `tokens`, `moves` | `TOKENS`, `MOVES` |
| `alpha` | float |
| `payoff` | `{A}`: 3 × 3 ints, rows bot move, columns human move |
| `outcome` | `{P}`: 3 × 9 |
| `basic` | `{P, eigenvalues, moduli, eigenvalue_one_multiplicity, has_unit_cycle, rounds_to_fade, stationary, closed_groups, transient_states}`; `rounds_to_fade` is `rounds_to_fade(0.1)` |
| `match` | the same keys as `basic`, plus `outcome_rates`, `edge`, `edge_check`, `group_stationary`, `group_outcome_rates`; `stationary`, `outcome_rates`, `edge` and `edge_check` are `null` when π is not unique |
| `opening` | `Decision.to_dict()` |
| `decisions` | object keyed by the 9 `TOKENS`, each `get_move(s).to_dict()` |
| `policy` | `{S, B}`: S = A P (3 × 9, column s = `decisions[s].scores`), B = 3 × 9 one-hot of `decisions[s].move` |
| `look_ahead` | object keyed by the 9 `TOKENS`, each `{rows, stopped_at}`: `rows` = `match.look_ahead(one-hot s)` as a list of 9-vectors, `stopped_at` = its row count − 1 |

Every matrix is a list of rows. Every eigenvalue list is a list of `[re, im]` pairs, sorted as `eigenvalues` sorts them.

## Subtasks

### S1: Bot with per-round move

- **Goal:** `Bot(counts)` holds the four matrices; `get_move(token)` returns the decision for that state.
- **Blocked by:** none.
- **Files:** `src/rps_markov/bot.py` (new), `tests/test_bot.py` (new), `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`, `README.md`.
- **Seams:** `Bot`, `Bot.get_move`, `Bot.outcome`, `Bot.basic`, `Bot.match`, `Bot.payoff`, `Decision`.
- **Decisions:**
  - The bot carries no memory between calls: the frontend controls the pace, may not play the recommended move, and sends the previous state each round (user). Doc delta.
  - None of the matrices change after build (user; confirmed by `code: src/rps_markov/markov.py`: `Counts.values` is read-only and every matrix value is a `cached_property`; `docs: PRESENTATION-FLOW.md` 2.4: P and A "are fixed before the game and are not updated during it"). So `get_move(s)` depends only on s. Doc delta.
  - The bot holds the matrices as public read-only attributes `outcome` (3 × 9), `basic` (3 × 3), `match` (9 × 9), `payoff` (A); callers read internals through them (e.g. `bot.match.eigenvalues`). The bot adds only decision members and does not re-export matrix getters (user approved). Doc delta.
  - There is no `policy` member on `Bot`: the 9-state policy is `get_move(s).move` for each s in `TOKENS` (user: "i don't get the point of policy"). Doc delta.
  - Matrices live on each `Bot` instance, never in module or global state, so several bots (e.g. friend and pooled) can exist side by side (user approved). Doc delta.
  - `get_move` takes the human's previous token, e.g. `"RL"`, from the human's side (`RL` = the human played R and lost); the caller computes the outcome from the move the bot actually played, not the recommended one. An unknown token raises `KeyError` (user approved). Doc delta.
  - Each decision returns a `Decision` record holding `state`, `x`, `q`, `scores`, `move` and `source`, so the frontend draws q = P x, A q and the choice without recomputing (user approved). Doc delta.
  - All the math for each panel is done by the bot; the frontend only reads exported numbers (user: "all the math for each panel should be done by the bot"). So each `Decision` also carries `counter_move` (for flagging rounds where the choice differs from countering the most likely move), `splits` (the stacked win/tie/lose bars per bot move) and `expected_score` (the per-round value for the expected-vs-actual chart). Doc delta.
  - Building the bot computes nothing; `opening` and the matrices compute on first access and are cached (user approved). Doc delta.
  - Ties in A q go to the first move in R, P, S (`docs: CONTRACTS.md`, `PayoffMatrix.best_move`). Doc delta (already recorded; the Bot section points to it).
  - Matrix classes take a `Counts` and never load (`docs: ARCHITECTURE.md`); so does `Bot`. Doc delta.
- **Acceptance criteria:**
  - [x] `Bot(counts).outcome.P`, `.basic.P`, `.match.P` and `.payoff.A` equal the arrays from building `OutcomeTransitionMatrix(counts, alpha)`, `BasicTransitionMatrix(counts, alpha)`, `BotMatchTransitionMatrix(...)` and `PayoffMatrix()` directly, for alpha 1 and 0.5. `tests/test_bot.py::test_bot_holds_matrices`
  - [x] `get_move("RL")` returns a `Decision` with `state == "RL"`, `x` one-hot at the index of `RL` in `TOKENS`, `q == outcome.column("RL")`, `scores == payoff.scores(q)`, `move == payoff.best_move(q)`, `source == "state"`. `tests/test_bot.py::test_get_move_decision`
  - [x] For `get_move(s)` on every s of `Counts(count(synthetic_rounds(seed=7)))`: `counter_move` beats `MOVES[argmax q]`; each `splits` row sums to 1; `splits[b, win] − splits[b, lose] == scores[b]`; `expected_score == max(scores)`. `tests/test_bot.py::test_decision_panel_fields`
  - [x] For a state whose q has a tie for the largest entry (built from a counts frame), `counter_move` counters the first tied move in R, P, S. `tests/test_bot.py::test_counter_move_tie`
  - [x] Two `Bot` instances built from different counts give independent matrices and decisions (building one does not change the other's `outcome.P` or `get_move` results). `tests/test_bot.py::test_bots_are_independent`
  - [x] `get_move` called twice with the same token returns equal decisions, whatever was called in between. `tests/test_bot.py::test_get_move_has_no_memory`
  - [x] `get_move("XX")` raises `KeyError`. `tests/test_bot.py::test_get_move_unknown_state`
  - [x] On `Counts(count(synthetic_rounds(seed=7)))` (the generator `tests/test_markov.py` uses), for every state s, the 3 nonzero tokens of column s of `match.P` are exactly the tokens the human gets against bot move `get_move(s).move`. `tests/test_bot.py::test_get_move_matches_match_chain`
  - [x] Building `Bot(counts)` does not compute any matrix value (no `values` key in any held matrix's `__dict__`). `tests/test_bot.py::test_bot_is_lazy`
  - [x] Full suite passes: `python -m pytest`.
- **Doc deltas:**
  - `docs/CONTRACTS.md`: new "Bot" section: constructor, the attributes table, `get_move` input (human-side token, `KeyError` on unknown), the `Decision` fields including `counter_move`, `splits`, `expected_score`; the bot keeps no state between calls; `get_move(s)` depends only on s; matrices are per instance.
  - `docs/ARCHITECTURE.md`: module row for `src/rps_markov/bot.py`; data-flow line `Counts → Bot (holds the matrices)`; rule "The bot keeps no memory between rounds; the caller sends the human's previous token each round. No matrix changes after the bot is built."; "Not included" drops "live bot play".
  - `GLOSSARY.md`: **Decision**: one bot choice with its working (x, q, A q, move) and the per-round panel numbers.
  - `README.md`: Model bullet for `Bot(counts)`.
  - Decisions made during implementation:
    - `Bot.__init__` constructs the four matrix objects (which computes no values) and exposes them as plain read-only properties, so they cannot be reassigned and need no caching. `docs/CONTRACTS.md` Bot section.
    - `Decision` defines `__eq__` comparing every field with `np.array_equal`, so two decisions compare equal field by field despite holding arrays; it is therefore unhashable. `docs/CONTRACTS.md` Bot section.
    - `counter_move` is read from A (the bot move b with A[b, argmax q] = +1), not from a separate beats table, so A stays the one source of the game rules. Needs no doc beyond the `counter_move` field meaning.
    - Extra test `tests/test_bot.py::test_splits_hand_checked` checks `splits` against hand-computed values. Needs no doc.

### S2: Opening move from the steady state, with 3 × 3 fallback

- **Goal:** `Bot.opening` gives the round-1 decision from π of the 9 × 9 chain, or from the 3 × 3 steady state when the 9 × 9 π is not unique or the 9 × 9 cycles.
- **Blocked by:** S1, S3.
- **Files:** `src/rps_markov/bot.py`, `tests/test_bot.py`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`, `docs/PRESENTATION-FLOW.md`.
- **Seams:** `Bot.opening`, `Decision`, `Bot.match`, `Bot.basic`, `BotMatchTransitionMatrix.has_unit_cycle`.
- **Decisions:**
  - Round 1 has no state, so x = π of the 9 × 9; q₀ = P π; score A q₀; choose the best move (`docs: PRESENTATION-FLOW.md` 2.4). Doc delta.
  - When eigenvalue 1 of the 9 × 9 appears more than once (`match.stationary` raises `ValueError`), q₀ = the 3 × 3 steady state; smoothing keeps its λ = 1 single (`docs: PRESENTATION-FLOW.md` 2.4). `source` says which was used. Doc delta.
  - The 3 × 3 fallback is also used when the 9 × 9 has an eigenvalue other than 1 with modulus 1 (`match.has_unit_cycle`): then π is unique but the chain cycles and never settles, so it is not used for round 1 (user: "the code checks it. it needs it to make the decision on whether to use steady state for round 1 or not"). Smoothing makes every entry of the 3 × 3 positive, so the 3 × 3 has neither problem. `source` is `"basic"` in both fallback cases; the frontend tells them apart by `match.eigenvalue_one_multiplicity` and `match.has_unit_cycle`. Doc delta.
  - The opening follows `docs/PRESENTATION-FLOW.md` 2.4, not `docs/OUTLINE.md`: u₀ (the real round-1 move distribution) is not used (user approved). Doc delta.
- **Acceptance criteria:**
  - [x] For `Counts(count(synthetic_rounds(seed=7)))` (unique π): `opening.state is None`, `opening.x == match.stationary`, `opening.q == outcome.P @ match.stationary` and equals π summed over each move's 3 tokens, `opening.scores == payoff.scores(q)`, `opening.move == payoff.best_move(q)`, `opening.source == "match"`. `tests/test_bot.py::test_opening_from_match_steady_state`
  - [x] For the reducible counts built in `tests/test_markov.py::test_stationary_rejects_reducible_chain` (S after RT/PW/SL, P after RW/PL/ST, 10 each; eigenvalue 1 repeated): `opening.source == "basic"`, `opening.x == opening.q == basic.stationary`, `opening.move == payoff.best_move(basic.stationary)`, and no exception escapes. `tests/test_bot.py::test_opening_falls_back_to_basic`
  - [x] For the cycling counts (P after RW/RL/RT, R after PW/PL/PT/SW/SL/ST, 10 each, alpha 1e-12; the 9 × 9 has eigenvalues 1 and −1, π unique on RL and PL): `match.has_unit_cycle is True`, `match.eigenvalue_one_multiplicity == 1`, `opening.source == "basic"`, `opening.q == basic.stationary`. `tests/test_bot.py::test_opening_falls_back_on_unit_cycle`
  - [x] `opening` is cached: the same object on repeat access. `tests/test_bot.py::test_opening_cached`
  - [x] Full suite passes: `python -m pytest`.
- **Doc deltas:**
  - `docs/CONTRACTS.md`, Bot section: `opening`, its two sources and the two fallback conditions.
  - `docs/ARCHITECTURE.md`: "Not included" drops "round-1 fallback" and lists round-1 prediction from u₀.
  - `GLOSSARY.md`: **Opening**: the bot's round-1 decision, from q₀ = P π of the human-vs-bot chain, or the 3 × 3 steady state when that π is not unique or the chain cycles.
  - `docs/PRESENTATION-FLOW.md` 2.4: the paragraph on an eigenvalue other than 1 with modulus 1 says the bot then falls back to the 3 × 3 steady state for round 1, like the repeated-eigenvalue case.
  - Decisions made during implementation:
    - `opening` tests `match.eigenvalue_one_multiplicity > 1` and `match.has_unit_cycle` before reading `match.stationary`, instead of catching its `ValueError`, so the fallback rule reads the same two members the frontend uses to explain it. `docs/CONTRACTS.md` Bot section, `opening`.
    - `tests/test_bot.py` imports the reducible and cycling counts from `tests/test_markov.py` (`reducible_counts`, `cycling_counts`), so both test files use the same chains. Needs no doc.

### S3: Chain diagnostics and look-ahead on square transition matrices

- **Goal:** every number the eigenvalue, π, look-ahead and long-run panels show is a member of `SquareTransitionMatrix` or `BotMatchTransitionMatrix`.
- **Blocked by:** none.
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `docs/PRESENTATION-FLOW.md`, `GLOSSARY.md`.
- **Seams:** the `SquareTransitionMatrix` and `BotMatchTransitionMatrix` additions in **Interfaces**, via `BasicTransitionMatrix` and `BotMatchTransitionMatrix`.
- **Decisions:**
  - All the math for each panel is done in Python (user: "all the math for each panel should be done by the bot"). Doc delta.
  - Look-ahead: start from x; each step is one more product with M; stop when the sum of the absolute differences of the entries from one step to the next falls below 0.01; cap at 100 steps (`docs: PRESENTATION-FLOW.md` 2.4). Doc delta.
  - The modulus is shown beside each eigenvalue; λ₂ sets how fast the start stops mattering, shown as the rounds until modulus(λ₂)ᵗ falls below 10% (pooled: 19) (`docs: PRESENTATION-FLOW.md` 2.4). Doc delta.
  - Transient states are the states in no closed group, the ones π gives 0 (`docs: PRESENTATION-FLOW.md` 2.4, round 1 step 3). Closed groups, group steady states, group outcome rates and transient states are for display only and never affect a move (user: "keep everything"). Doc delta.
  - When eigenvalue 1 appears k > 1 times, the banner shows k, and each closed group's states and win rate are listed (`docs: PRESENTATION-FLOW.md` 2.4). Doc delta.
  - The code checks for an eigenvalue other than 1 with modulus 1 (`has_unit_cycle`); S2 uses it for the round-1 decision and the frontend uses it for the note (user: "yes the code checks it"). Doc delta.
  - The bot's edge is the human's loss rate minus their win rate, cross-checked by weighting the bot's best score in each state by π (`docs: PRESENTATION-FLOW.md` 2.4). Doc delta.
- **Acceptance criteria:**
  - [x] `look_ahead`: row 0 equals x, row k equals `np.linalg.matrix_power(P, k) @ x`, and the last row is the first k whose step change is below tol (every earlier step change is ≥ tol). `tests/test_markov.py::test_look_ahead_stops_at_tolerance`
  - [x] `look_ahead` on uniform P (`zero_counts()`, `BasicTransitionMatrix`) from a one-hot x has 3 rows (row 1 is already uniform; row 2 is the first step whose change is below tol) (changed during implementation from 2 rows, which contradicted the stop rule in **Interfaces**; user chose the Interfaces rule). `tests/test_markov.py::test_look_ahead_uniform`
  - [x] `look_ahead` with `tol=0`, `max_steps=5` on `BasicTransitionMatrix(Counts(count(synthetic_rounds(seed=5))))` from a one-hot x has 6 rows. `tests/test_markov.py::test_look_ahead_cap`
  - [x] `moduli == np.abs(eigenvalues)`. `tests/test_markov.py::test_moduli`
  - [x] On `bot_match(Counts(count(synthetic_rounds(seed=7))))`: `eigenvalue_one_multiplicity == 1`, `has_unit_cycle is False`, `rounds_to_fade(0.1)` is the smallest t with `moduli[1] ** t < 0.1`, `closed_groups` has 1 group, `transient_states` are exactly the states where `stationary` is 0 (atol 1e-12), `group_stationary[0] == stationary`. `tests/test_markov.py::test_diagnostics_irreducible`
  - [x] On the reducible counts from `test_stationary_rejects_reducible_chain`: `eigenvalue_one_multiplicity == 2`, `rounds_to_fade() is None`, `closed_groups == [["RW", "PL", "ST"], ["RT", "PW", "SL"]]`, each `group_stationary` is a fixed point of P supported on its group, each `group_outcome_rates` entry sums to 1, and `edge`/`edge_check` raise `ValueError`. `tests/test_markov.py::test_diagnostics_reducible`
  - [x] On the cycling counts (P after RW/RL/RT, R after PW/PL/PT/SW/SL/ST, 10 each, alpha 1e-12), `bot_match(...)` gives `has_unit_cycle is True`, `eigenvalue_one_multiplicity == 1`, and `stationary` 0.5 on RL and PL (atol 1e-9). `tests/test_markov.py::test_has_unit_cycle`
  - [x] On `bot_match(Counts(count(synthetic_rounds(seed=7))))`: `edge == outcome_rates["lose"] − outcome_rates["win"]` and `edge == edge_check` (atol 1e-12). `tests/test_markov.py::test_edge_cross_check`
  - [x] On uniform P (`zero_counts()`): `edge == 0` (atol 1e-12). `tests/test_markov.py::test_edge_uniform`
  - [x] `OutcomeTransitionMatrix` has none of the S3 members. `tests/test_markov.py::test_square_matrix_kinds` (extended)
  - [x] Full suite passes: `python -m pytest`.
- **Doc deltas:**
  - `docs/CONTRACTS.md`: the `SquareTransitionMatrix` and `BotMatchTransitionMatrix` additions: meaning, tolerances (1e-9 for eigenvalue tests, 0.01 and 100 for look-ahead), `None`/`ValueError` cases.
  - `docs/ARCHITECTURE.md`: "Not included" drops "no matrix powers" for look-ahead only.
  - `docs/PRESENTATION-FLOW.md` 2.4: "The code does not check for this case." becomes "The code checks for this case (`has_unit_cycle`)."
  - `GLOSSARY.md`: **Closed group**: a group of states the chain never leaves once in it; each has its own steady state. **Transient state**: a state in no closed group; the long run never returns to it.
  - Decisions made during implementation:
    - `closed_groups` comes from the reachability closure of the exact nonzero pattern of P (an entry counts if it is > 0), so tiny smoothed entries such as alpha 1e-12 still count as moves between states. `docs/CONTRACTS.md` closed groups entry.
    - `group_stationary` is the eigenvalue-1 eigenvector of P restricted to the group's rows and columns, padded with zeros. `docs/CONTRACTS.md` closed groups entry.
    - `rounds_to_fade` returns 0 only when modulus(λ₂) is exactly 0; on a uniform P floating point gives modulus(λ₂) about 1e-17, so it returns 1. `docs/CONTRACTS.md` `rounds_to_fade` entry.
    - `stationary` keeps its existing eigenvector computation and now raises through `eigenvalue_one_multiplicity`, so both use the same 1e-9 test. Needs no doc beyond the shared tolerance.
    - `outcome_rates` and `group_outcome_rates` share one private helper, so the two rates are summed the same way. Needs no doc.
    - `tests/test_markov.py::test_diagnostics_reducible` also checks `transient_states == ["RL", "PT", "SW"]`. Needs no doc.
    - Spec change: the uniform look-ahead criterion was 2 rows, which contradicted the stop rule in **Interfaces**; the user chose the Interfaces rule, so it is now 3 rows. `docs/CONTRACTS.md` `look_ahead` entry (row 0 is x; the converged row is included).

### S4: JSON export for the browser frontend

- **Goal:** `python -m rps_markov.bot --counts <N file> --out <json file>` writes everything the frontend needs for one bot as one JSON file.
- **Blocked by:** S1, S2, S3.
- **Files:** `src/rps_markov/bot.py`, `tests/test_bot.py`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `README.md`.
- **Seams:** `Decision.to_dict()`, `Bot.to_dict()`, CLI `python -m rps_markov.bot`.
- **Decisions:**
  - The frontend is browser/JS and reads the bot only through a static JSON file; there is no server (user). Doc delta.
  - All panel data goes in the export, computed in Python; nothing in the file needs live updates (user: "all should go in"). The frontend does no math beyond adding up per-round values over the game (user: "all the math for each panel should be done by the bot"); running totals stay in the frontend because the bot is stateless (user approved). Doc delta.
  - The frontend keeps the game rules, score and round history itself, and gets each round's outcome from the exported A (`A[bot, human]`: +1 bot wins, 0 tie, −1 human wins) (`transient`: the frontend is outside this repo; ARCHITECTURE "Not included" records that the repo has no game logic).
  - All exported values are JSON-safe: lists of floats and ints, strings, `null`; complex eigenvalues as `[re, im]` pairs. Doc delta.
  - `match.stationary`, `outcome_rates`, `edge` and `edge_check` are `null` when π is not unique; `eigenvalue_one_multiplicity`, `closed_groups`, `group_stationary` and `group_outcome_rates` give the banner and the per-group rates from PRESENTATION-FLOW 2.4. Doc delta.
  - The CLI has flags `--counts`, `--out` and optional `--alpha` (default 1.0) only, with `allow_abbrev=False`, like `python -m rps_markov.count` (`docs: CONTRACTS.md`, CLI). It creates the parent folder of `--out` if needed. Doc delta.
- **Acceptance criteria:**
  - [ ] `Decision.to_dict()` has keys `state, x, q, scores, move, source, counter_move, splits, expected_score`, all JSON-safe, and `json.dumps` succeeds. `tests/test_bot.py::test_decision_to_dict`
  - [ ] `Bot.to_dict()` has exactly the top-level keys in the **Interfaces** JSON table, with the nested keys listed there; `decisions[s] == get_move(s).to_dict()` for all 9 s; `policy.S` equals `payoff.A @ outcome.P`; each `policy.B` column is one-hot at `decisions[s].move`; `look_ahead[s].rows` equals `match.look_ahead(one-hot s)` and `stopped_at == len(rows) − 1`. `tests/test_bot.py::test_bot_to_dict`
  - [ ] `json.dumps(Bot(counts).to_dict())` succeeds and `json.loads` of it round-trips the eigenvalues as `[re, im]` pairs equal to `match.eigenvalues`. `tests/test_bot.py::test_bot_to_dict_json_safe`
  - [ ] For the reducible counts, `to_dict()` succeeds with `match.stationary`, `outcome_rates`, `edge`, `edge_check` and `rounds_to_fade` `null`, `eigenvalue_one_multiplicity == 2`, 2 entries in `group_outcome_rates`, and `opening.source == "basic"`. `tests/test_bot.py::test_bot_to_dict_reducible`
  - [ ] The CLI on a `tmp_path` N file writes JSON equal to `Bot(Counts.load(path)).to_dict()`; an abbreviated flag (`--count`) exits with an error. `tests/test_bot.py::test_cli_writes_json`
  - [ ] Full suite passes: `python -m pytest`.
- **Doc deltas:**
  - `docs/CONTRACTS.md`: "Bot JSON file" section with the key table from **Interfaces** (as a table, no code); the CLI.
  - `docs/ARCHITECTURE.md`: data-flow line `N_<name>.csv → python -m rps_markov.bot → bot JSON → browser frontend`; rule "The frontend reads the bot only through the JSON export; everything in it is fixed before the game."; "Not included": the frontend, game rules and score keeping, an HTTP server, running totals over the game.
  - `README.md`: the export command.

## Human checks

- [ ] S2: build `Bot(Counts.load("data/processed/transition_matrices/N_rps_human_combined.csv"))` in a Python shell and read `bot.opening`. Expected: `move == "P"`, `q ≈ [0.356, 0.326, 0.318]`, `scores ≈ [−0.008, 0.038, −0.030]` (`docs/PRESENTATION-FLOW.md` 2.4 worked example). Needs the local `data/` build.
- [ ] S1: on the same bot, `[bot.get_move(s).move for s in TOKENS]`. Expected: RW P, RL P, RT R, PW R, PL R, PT P, SW P, SL S, ST S (PRESENTATION-FLOW 2.4 policy table).
- [ ] S3: on the same bot, `bot.match.rounds_to_fade()`, `bot.match.transient_states`, `bot.match.edge`. Expected: 19; every state except RL, PT, SW; ≈ 0.038 (PRESENTATION-FLOW 2.4).
- [ ] S4: run `python -m rps_markov.bot --counts data/processed/transition_matrices/N_rps_human_combined.csv --out data/processed/bots/bot_rps_human_combined.json`, then load the file in a browser console with `fetch` and `JSON.parse`. Expected: it parses, and `opening.move == "P"`.
