# Split counting, counts and transition matrices (k = 1); add payoff and human-vs-bot chain

**Status:** approved
**Repo:** `D:\SMU\CS103\proj\rps-transition-matrix`
**Context file to update:** none named
**Docs:** `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `GLOSSARY.md`; presentation sections 2.1–2.4 in `docs/PRESENTATION-FLOW.md` (untracked). No CLAUDE.md/AGENTS.md, no ADRs.

**Commands**
- Full test suite: `python -m pytest`
- Single test file: `python -m pytest tests/test_count.py` (also `tests/test_markov.py`, `tests/test_payoff.py`)
- Typecheck: none
- Lint: none

## 1. Dependencies and blockers

| Subtask | Blocked by |
|---|---|
| S1 | none |
| S2 | S1 |
| S3 | S2 |
| S4 | S1 |
| S5 | S3, S4 |

Run order: S1, S2, S3, S4, S5.

External blockers: none. The friend's rounds do not exist yet; no subtask needs them (tests use synthetic or hand-made counts). Building matrices from the friend's data is a human check.

Uncommitted changes that must stay out of every commit (untracked on `main`):
- `docs/OUTLINE.md`
- `docs/PRESENTATION-FLOW.md`

Branch: `refactor/split-counts-and-matrix` (current branch is `main`).

## 2. Suggested splits

No split: all subtasks are connected. S5 needs S3 (`SquareTransitionMatrix`) and S4 (`PayoffMatrix`); S2, S3 and S4 build on S1's modules (S4 on `Matrix`).

## 3. Out of scope

- k ≠ 1. Everything is k = 1: the counting script, the N files and every matrix class. Recorded by S1's doc delta.
- P, the 9 × 9 and A are never persisted; only N is written. Recorded by S1's doc delta.
- The code never depends on which dataset or player an N file came from. Recorded by S1's doc delta.
- Collecting the friend's rounds, the demo frontend, the round-1 fallback and live bot play. Recorded by S5's doc delta (`docs/ARCHITECTURE.md` "Not included").
- Absorbing chains. Already in `docs/ARCHITECTURE.md` "Not included" (via "no matrix powers"); S5's rewrite of that list keeps it.

## 4. Interfaces

Doc delta to `docs/CONTRACTS.md` on the subtask named in brackets.

- `src/rps_markov/count.py` [S1]: the counting script. Holds `MOVES`, `OUTCOMES`, `TOKENS`, `load_rounds` and `add_history` (moved from `markov.py`, k fixed at 1) and:
  - `add_history(df) -> pd.DataFrame`: copy of df (a round CSV's rows) with column `state` = the player's previous round as a token, keeping only rows whose player has a row at round r − 1.
  - `count(df) -> pd.DataFrame`: takes round rows, returns the labelled 3 × 9 N: index `R, P, S`, columns `TOKENS`, int values. `ValueError` on moves or outcomes outside the contract values.
  - CLI `python -m rps_markov.count --csv <file> [<file> ...] --out <folder>` writes `N_<name>.csv` per input. No `--k`, no other flags.
- `src/rps_markov/matrix.py` [S1]: `Matrix`, abstract base (`abc.ABC`; instantiating it raises `TypeError`) of every labelled matrix. Members:
  - `rows: list[str]`, `columns: list[str]`.
  - `values: np.ndarray` (abstract; len(rows) × len(columns); subclasses compute it on first access and cache it).
  - `to_frame() -> pd.DataFrame`: index `rows`, columns `columns`.
  - `__matmul__(x) -> np.ndarray`: `values @ x`, so `m @ x` works on any `Matrix`.
- `src/rps_markov/markov.py`:
  - `Counts(frame: pd.DataFrame)` [S1]: holds N in memory, read-only. Attributes `states: list[str]` (= `TOKENS`), `values: np.ndarray` (int, 3 × 9, not writeable). `ValueError` if the index is not `R, P, S` or the columns are not exactly `TOKENS`. There is only one kind of N: 3 × 9.
    - `load(path) -> Counts` (classmethod): reads an `N_<name>.csv`.
  - `TransitionMatrix(Matrix)` [S1]: abstract. `states` is the same list as `columns`. Members:
    - `P: np.ndarray`: the same array as `values` (cached; column-stochastic).
    - `column(state) -> np.ndarray` (`KeyError` on an unknown label), `predict(x) -> np.ndarray` (`P @ x`).
  - `OutcomeTransitionMatrix(counts: Counts, alpha: float = 1.0)` [S1]: 3 × 9. rows `MOVES`, states `TOKENS`. `P = (N + alpha) / column sums`.
  - `SquareTransitionMatrix(TransitionMatrix)` [S3]: abstract; `rows == states`. Adds `eigenvalues: np.ndarray` (cached, complex, sorted by modulus descending) and `stationary: np.ndarray` (cached, real, the eigenvalue-1 eigenvector normalised to sum 1).
  - `BasicTransitionMatrix(counts: Counts, alpha: float = 1.0)` [S2 as a `TransitionMatrix`; S3 makes it a `SquareTransitionMatrix`]: 3 × 3. rows and states `MOVES`. The constructor collapses the 3 × 9 N to a 3 × 3 move-count matrix M: column `m` of M = the sum of N's columns `mW`, `mL`, `mT`. `P = (M + alpha) / column sums`.
  - `BotMatchTransitionMatrix(outcome_matrix: OutcomeTransitionMatrix, payoff: PayoffMatrix)` [S5]: `SquareTransitionMatrix`, 9 × 9, rows and states `TOKENS`. Adds `outcome_rates: dict[str, float]` (cached; keys `win`, `lose`, `tie`, human's side, sum 1).
- `src/rps_markov/payoff.py` [S4]: `PayoffMatrix()`, a `Matrix`; rows and columns `MOVES`; `A: np.ndarray`, the same array as `values`, = `[[0, -1, 1], [1, 0, -1], [-1, 1, 0]]` (rows = bot move `R, P, S`, columns = human move `R, P, S`; +1 bot wins, 0 tie, −1 bot loses).
  - `scores(q) -> np.ndarray`: `A @ q`.
  - `best_move(q) -> str`: the move in `R, P, S` with the highest score; the first wins on a tie.

## 5. Subtasks

### S1: Counting script, counts holder and matrix base, all k = 1

- **Goal:** three separate responsibilities, all at k = 1. `count.py` counts round CSVs and writes `N_<name>.csv` per the contract, and nothing else. `Counts` loads and holds N. `TransitionMatrix` is the abstract base; `OutcomeTransitionMatrix` takes a `Counts` and builds the 3 × 9 P on first access, once. The old `markov.py` `TransitionMatrix` (with `fit`, `save`, `load`, `from_csv`, `k`), `state_labels` and the `rps_markov.markov` CLI are removed; no `P_<name>.csv` is written.
- **Blocked by:** none.
- **Files:** `src/rps_markov/count.py` (new), `src/rps_markov/matrix.py` (new), `src/rps_markov/markov.py`, `tests/test_count.py` (new), `tests/test_markov.py`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`, `README.md`.
- **Seams:** `count.count`, `count.add_history`, `count.load_rounds`, CLI `python -m rps_markov.count`; `Counts`, `Counts.load`; `Matrix`, `TransitionMatrix`, `OutcomeTransitionMatrix` public members (section 4).
- **Decisions:**
  - "i want the counts to be persisted as per normal" and "i dont think the probabbility matrices should be persisted as it can be made again" (user). Doc delta.
  - "count.py should be just a script to persist the counts according to the current contract" (user). Doc delta.
  - "make everything k=1 to prevent confusion" (user): no `k` parameter or `--k` flag anywhere; state labels are single tokens or moves, with no `-`. Doc delta.
  - "Counts (or a better name) should load and hold the counts ... then the transitionaMatrix ... takes in the counts to lazily create" (user). Doc delta.
  - Matrix classes do not load or count: "i think should be seperate" (user). Doc delta.
  - "don't differentiate based on pooled or friend! it should work for wtv is in that N_XXX format defined in contracts" (user): `Counts` and the matrix classes accept any N file in the contract's format and never depend on its source. Doc delta.
  - Each kind of matrix is its own class under `TransitionMatrix`: "the 3x3 BasicTransitionMatrix is a TransitionMatrix, the 3x9 ... is a ..." (user). The caller picks the class; every counts-based class takes the same 3 × 9 `Counts`. Names `BasicTransitionMatrix`, `OutcomeTransitionMatrix`, `BotMatchTransitionMatrix`, `SquareTransitionMatrix` (user: "names ok"). Doc delta.
  - "have another base class of Matrix for TransitionMatrix and PayoffMatrix" (user): `Matrix` in `src/rps_markov/matrix.py` holds the shared labelled-matrix behaviour (`rows`, `columns`, `values`, `to_frame`, `@`). `P` and `A` stay as names for `values`, matching the slides' notation. Doc delta.
  - P and every derived matrix or value is computed on first access and cached (`functools.cached_property`). Doc delta.
  - `Counts.values` is read-only, so a matrix's cache cannot go stale. alpha is fixed at construction. Doc delta.
  - CLI keeps `--csv`, `--out` and `N_<name>.csv` naming; no `--alpha`. Doc delta.
- **Acceptance criteria:**
  - [x] History and counting tests move to `tests/test_count.py` and are rewritten for k = 1: `test_load_rounds_missing_column`; basic history (`BASIC` gives states `RW, PL, ST` for rounds 2–4); gap (round after a missing round has no state); players kept separate; `test_add_history_matches_prev_columns`; small counts; total = number of rows with a state; unknown outcome → `ValueError`; `test_pooled_counts_sum` (skipped without partition files). `python -m pytest tests/test_count.py`
  - [x] CLI test: two inputs give exactly `N_a.csv`, `N_b.csv` in `--out`; header `move,RW,RL,RT,PW,PL,PT,SW,SL,ST`; rows `R, P, S`. Same command.
  - [x] CLI test: `--k` is rejected (non-zero exit). Same command.
  - [x] New test: `Counts.load(CLI output).values` equals `count(load_rounds(input)).to_numpy()`; `outcome is True`. `python -m pytest tests/test_markov.py`
  - [x] New test: `Counts` raises `ValueError` on rows not `R, P, S`, on a missing state column, and on k = 3 labels (`RW-RW-RW`, ...). Same command.
  - [x] New test: writing to `Counts(...).values` raises `ValueError`. Same command.
  - [x] New test: `Matrix()` and `TransitionMatrix()` raise `TypeError`. Same command.
  - [x] New test: for an `OutcomeTransitionMatrix` tm, `isinstance(tm, Matrix)`, `tm.P is tm.values`, `tm.states == tm.columns == TOKENS`, `tm.rows == MOVES`, `tm @ x` equals `tm.predict(x)`, and `tm.to_frame()` has index `MOVES` and columns `TOKENS`. Same command.
  - [x] P tests rewritten for `OutcomeTransitionMatrix(Counts(count(df)))`: shape 3 × 9, entries in [0, 1], columns sum to 1 (atol 1e-12); unseen state column `[1/3, 1/3, 1/3]` and a hand-checked seen column; `column(s)` equals `P @ e_s` and `to_frame()[s]`; `predict` of a mixture; unknown label → `KeyError`. Same command.
  - [x] New test: `tm.P is tm.P`. Same command.
  - [x] Full suite passes. `python -m pytest`
- **Doc deltas:**
  - Decision (made in S1): `count` rejects a bad move or outcome on any row of its input, not only on rows that get a state, so a bad round 1 is still caught. `docs/CONTRACTS.md` "Transition matrix".
  - Decision (made in S1): `Counts` requires rows exactly `R, P, S` and columns exactly `TOKENS`, in that order; it does not reorder. `docs/CONTRACTS.md` "Matrix files".
  - Decision (made in S1): `Counts` copies the frame's values, so changing the frame later cannot change N. `docs/CONTRACTS.md` "Transition matrix".
  - Decision (made in S1): the count CLI parser has `allow_abbrev=False`, so only the exact flags `--csv` and `--out` are accepted. `docs/CONTRACTS.md` "CLI".
  - Decision (made in S1): `tests/test_markov.py` imports the round builders (`rounds`, `BASIC`, `synthetic_rounds`, `write_inputs`, `run_cli`) from `tests/test_count.py` instead of copying them. No doc: test layout only.
  - `docs/CONTRACTS.md` "States": k = 1 only; a token state is one of `TOKENS`. "Transition matrix": split into counting (`count.py`), counts (`Counts`: load, hold, read-only, any source) and matrices (`TransitionMatrix` base, `OutcomeTransitionMatrix`; computed on first use, cached, never persisted).
  - `docs/CONTRACTS.md` "Matrix files" and "CLI": only `N_<name>.csv` is written, by `python -m rps_markov.count`; 9 state columns (token kind); no k. P, the 9 × 9 and A are never written to disk.
  - `docs/ARCHITECTURE.md` data flow: `load_rounds → add_history → count → N_<name>.csv` (CLI `rps_markov.count`); `Counts.load → <matrix class> → P`. Modules table: add `count.py` and `matrix.py` (`Matrix` base), narrow `markov.py`. Replace "The CLI is run for k = 3 only; k stays a parameter" with "Everything is k = 1".
  - `GLOSSARY.md`: k-state and History entries become k = 1 ("state": the previous round's token). N is held by `Counts` and is the only persisted matrix; P is derived from N and alpha.
  - `README.md` quick start and "Model": `python -m rps_markov.count --csv ... --out ...`, writes `N_rps_human_combined.csv` only; P comes from `OutcomeTransitionMatrix(Counts.load(path))`; model described at k = 1 (9 states).

### S2: BasicTransitionMatrix from the 3 × 9 counts

- **Goal:** `BasicTransitionMatrix(counts, alpha)` takes the same 3 × 9 `Counts` as `OutcomeTransitionMatrix` and, in its constructor, sums out the outcome to get next move given previous move (3 × 3), then builds its 3 × 3 P. No change to `count.py`, the N file or `Counts`.
- **Blocked by:** S1.
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `docs/CONTRACTS.md`, `GLOSSARY.md`, `README.md`.
- **Seams:** `BasicTransitionMatrix` (`P`, `rows`, `states`, `to_frame`).
- **Decisions:**
  - "3×3 P: last move → next move" (user). Doc delta.
  - The 3 × 3 is made in the constructor from the 3 × 9 counts, not by a separate count or N file (user: "shouldn't it be done in the constructor?"). Column `m` of the move counts = N columns `mW + mL + mT`; this equals counting next move against previous move directly, because both need the same previous round. Doc delta.
  - alpha is added after collapsing: `P = (M + alpha) / column sums`, so an unseen previous move gives `[1/3, 1/3, 1/3]`. Doc delta.
- **Acceptance criteria:**
  - [x] New test: `BasicTransitionMatrix(Counts(count(BASIC)), alpha=1)` has column `R` = `[0.25, 0.5, 0.25]` (one R→P: `(0+1, 1+1, 0+1) / 4`), column `P` = `[0.25, 0.25, 0.5]` (one P→S) and column `S` = `[0.5, 0.25, 0.25]` (one S→R). `python -m pytest tests/test_markov.py`
  - [x] New test: on synthetic rounds, `(P × column sums − alpha)` recovers move counts equal to a `pd.crosstab` of next move against previous move computed in the test from the same rows. Same command.
  - [x] New test: `P` is 3 × 3, columns sum to 1 (atol 1e-12), `rows == states == MOVES`. Same command.
  - [x] Full suite passes. `python -m pytest`
- **Doc deltas:**
  - Decision (made in S2): the collapse reshapes N to 3 × 3 × 3 and sums the last axis, which relies on `TOKENS` being move-major (`RW, RL, RT, PW, ...`). `docs/CONTRACTS.md` "States" (token order is fixed).
  - `docs/CONTRACTS.md` "Transition matrix": `BasicTransitionMatrix`, the collapse rule and where alpha is added.
  - `GLOSSARY.md`: add "Move state": the player's previous move; the 3 × 3 is built by summing the 3 × 9 counts over the outcome.
  - `README.md` "Model": the 3 × 3 P comes from the same N file via `BasicTransitionMatrix(Counts.load(path))`.

### S3: SquareTransitionMatrix: eigenvalues and steady state

- **Goal:** `SquareTransitionMatrix` gives eigenvalues and steady state π, both lazy and cached. `BasicTransitionMatrix` is a `SquareTransitionMatrix`; `OutcomeTransitionMatrix` is not.
- **Blocked by:** S2.
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`.
- **Seams:** `SquareTransitionMatrix.eigenvalues`, `SquareTransitionMatrix.stationary`, `BasicTransitionMatrix`.
- **Decisions:**
  - Any square P from any N file in the contract's format gives eigenvalues and π (user). Doc delta.
  - Eigenvalues: complex array sorted by modulus descending, so the first is 1. π: eigenvector for eigenvalue 1, real, normalised to sum 1. Doc delta.
  - Both come from NumPy's `np.linalg.eig`; no hand-written eigen solver and no SciPy (user). `transient`.
- **Acceptance criteria:**
  - [x] New test: on synthetic counts, `BasicTransitionMatrix.eigenvalues[0]` ≈ 1 (atol 1e-12), sorted by modulus descending, other moduli < 1. `python -m pytest tests/test_markov.py`
  - [x] New test: `P @ stationary` ≈ `stationary`, sums to 1, all entries > 0. Same command.
  - [x] New test: zero counts (uniform P) give eigenvalues ≈ `[1, 0, 0]` and `stationary` ≈ `[1/3, 1/3, 1/3]`. Same command.
  - [x] New test: `isinstance(BasicTransitionMatrix(...), SquareTransitionMatrix)`; `OutcomeTransitionMatrix` has no `eigenvalues` or `stationary` attribute. Same command.
  - [x] Full suite passes. `python -m pytest`
- **Doc deltas:**
  - Decision (made in S3): `eigenvalues` and `stationary` share one cached `np.linalg.eig` call; the sort is stable, so equal moduli keep NumPy's order. `docs/CONTRACTS.md` "Transition matrix" (order only).
  - Decision (made in S3): π is taken from the eigenvector whose eigenvalue is closest to 1, then its real part is divided by its sum, so the sign NumPy returns does not matter. `docs/CONTRACTS.md` "Transition matrix".
  - `docs/CONTRACTS.md` "Transition matrix": `SquareTransitionMatrix`, eigenvalues (order, dtype) and π (null space of P − I, sums to 1).
  - `docs/ARCHITECTURE.md` "Not included": remove "stationary vector".
  - `GLOSSARY.md`: add "Steady state (π)".

### S4: PayoffMatrix

- **Goal:** `PayoffMatrix` holds the fixed 3 × 3 A and picks the bot's best move for a predicted distribution q.
- **Blocked by:** S1 (`Matrix`).
- **Files:** `src/rps_markov/payoff.py` (new), `tests/test_payoff.py` (new), `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`.
- **Seams:** `PayoffMatrix.A`, `PayoffMatrix.scores`, `PayoffMatrix.best_move`.
- **Decisions:**
  - "i think payoff should be a seperate class" (user); it is a `Matrix` (user). Doc delta.
  - "3×3 payoff A: +1 win, 0 tie, −1 loss ... It is fixed, so no data is needed. Rows are bot moves and columns are human moves." (user). Doc delta.
  - Score ties go to the first move in `R, P, S` order. Doc delta.
- **Acceptance criteria:**
  - [x] New test: `PayoffMatrix().A` equals `[[0, -1, 1], [1, 0, -1], [-1, 1, 0]]`. `python -m pytest tests/test_payoff.py`
  - [x] New test: `isinstance(PayoffMatrix(), Matrix)`; `A is values`; rows and columns `MOVES`; `scores(q)` equals `PayoffMatrix() @ q`. Same command.
  - [x] New test: `best_move([1, 0, 0]) == "P"`, `best_move([0, 1, 0]) == "S"`, `best_move([0, 0, 1]) == "R"`. Same command.
  - [x] New test: `best_move([0.45, 0.11, 0.44]) == "R"` (scores `[0.33, 0.01, -0.34]`), although the counter to the most likely move (R) is P. Same command.
  - [x] New test: `best_move([1/3, 1/3, 1/3]) == "R"`. Same command.
- **Doc deltas:**
  - Decision (made in S4): `A` is an int array, and a tie in `best_move` means exactly equal scores (`np.argmax`, no tolerance). `docs/CONTRACTS.md` "Payoff".
  - `docs/CONTRACTS.md`: new "Payoff" section (section 4 shape).
  - `docs/ARCHITECTURE.md` modules table: `src/rps_markov/payoff.py`.
  - `GLOSSARY.md`: add "Payoff matrix (A)".

### S5: BotMatchTransitionMatrix: human vs bot 9 × 9

- **Goal:** `BotMatchTransitionMatrix(outcome_matrix, payoff)` builds, from any `OutcomeTransitionMatrix` and a `PayoffMatrix`, the 9 × 9 chain of that human against the best-move bot, plus its long-run win/lose/tie rates. No real data is needed: the bot's best move per state is computed from P and A.
- **Blocked by:** S3, S4.
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md`, `GLOSSARY.md`.
- **Seams:** `BotMatchTransitionMatrix` (`P`, `stationary`, `eigenvalues`, `outcome_rates`).
- **Decisions:**
  - "9×9: friend vs bot (2.3). It is built from the friend's 3×9 plus the bot's best move under A in each state. Its steady state gives the predicted win, loss and tie rates." (user). Doc delta.
  - "it should work on all counts with that shape" (user). Doc delta.
  - Construction: for state s, bot move b = `payoff.best_move(outcome_matrix.P[:, s])`; for each human next move m, `P[token(m, outcome of m vs b), s] = outcome_matrix.P[m, s]`; all other entries 0 (`docs/PRESENTATION-FLOW.md` 2.3). Doc delta.
  - It is a `SquareTransitionMatrix`, so it also has `eigenvalues`. `outcome_rates` is from the human's side (the bot's win rate is the human's `lose`): `stationary` summed over the `*W`, `*L`, `*T` tokens. Doc delta.
- **Acceptance criteria:**
  - [ ] New test: on synthetic counts, `P` is 9 × 9, columns sum to 1 (atol 1e-12), exactly 3 nonzero entries per column (alpha > 0). `python -m pytest tests/test_markov.py`
  - [ ] New test: for one hand-checked state, the 3 nonzero rows of column s are the tokens given by m vs `best_move(outcome_matrix.P[:, s])`, with values `outcome_matrix.P[:, s]`. Same command.
  - [ ] New test: zero counts (uniform `outcome_matrix.P`) give `outcome_rates` ≈ 1/3 each. Same command.
  - [ ] New test: `outcome_rates` sums to 1 and equals `stationary` summed over `*W`, `*L`, `*T`. Same command.
  - [ ] New test: `isinstance(..., SquareTransitionMatrix)`; passing a `BasicTransitionMatrix` as `outcome_matrix` raises `TypeError`. Same command.
  - [ ] Full suite passes. `python -m pytest`
- **Doc deltas:**
  - `docs/CONTRACTS.md` "Transition matrix": `BotMatchTransitionMatrix`, the construction rule, `TOKENS` order, `outcome_rates` from the human's side.
  - `docs/ARCHITECTURE.md` "Not included": replace the line on square chains and bot play with: the only square matrices are `BasicTransitionMatrix` (3 × 3) and `BotMatchTransitionMatrix` (9 × 9); no k ≠ 1, no matrix powers or absorbing chains, no live bot play, demo frontend or data collection.
  - `GLOSSARY.md`: add "Human-vs-bot chain": the 9 × 9 column-stochastic matrix over tokens for one human against the best-move bot.

## 6. Human checks

- [ ] S1: run the new README quick-start command (`python -m rps_markov.count --csv data/processed/rps_human_combined.csv --out <folder>`). Expected: `<folder>` gets `N_rps_human_combined.csv` with 9 state columns and no `P_` file. Old `P_*.csv` and k = 3 `N_*.csv` from earlier runs stay until deleted by hand; `Counts.load` rejects the k = 3 ones.
- [ ] S3: run `python -m rps_markov.count --csv data/processed/partitions/train_pooled.csv --out <folder>`, then `BasicTransitionMatrix(Counts.load(<folder>/N_train_pooled.csv))`. Expected: eigenvalues near 1, 0.045, −0.017 and π ≈ [0.333, 0.330, 0.337], the preliminary numbers in `docs/PRESENTATION-FLOW.md` 2.1. If they differ, try the master.
- [ ] S3, S5: once the friend's CSV exists (master format), count it once, load the N file into one `Counts`, then read `BasicTransitionMatrix(counts)` eigenvalues and π and `BotMatchTransitionMatrix(OutcomeTransitionMatrix(counts), PayoffMatrix()).outcome_rates`. Expected: numbers to fill into `docs/PRESENTATION-FLOW.md` 2.1 and 2.3.
