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
- `BasicTransitionMatrix(counts: Counts, alpha: float = 1.0)`: a `SquareTransitionMatrix`, 3 × 3, rows and states `MOVES`. The constructor collapses the 3 × 9 N to a 3 × 3 move-count matrix M: column `m` of M = the sum of N's columns `mW`, `mL`, `mT` (reshape to 3 × 3 × 3, sum the last axis). This equals counting next move against previous move directly, since both need the same previous round. alpha is added after collapsing: P = (M + alpha) / column sums, so an unseen previous move gives `[1/3, 1/3, 1/3]`.
- `BotMatchTransitionMatrix(outcome_matrix: OutcomeTransitionMatrix, payoff: PayoffMatrix)`: a `SquareTransitionMatrix`, 9 × 9, rows and states `TOKENS`; one human against the bot that plays its best move in every state. It works on any `OutcomeTransitionMatrix`; any other type (e.g. a `BasicTransitionMatrix`) raises `TypeError` from an explicit check in the constructor (P itself is built lazily). Construction: for state s, bot move b = `payoff.best_move(outcome_matrix.P[:, s])`; for each human next move m, `P[token(m, outcome), s] = outcome_matrix.P[m, s]`, where the outcome comes from the payoff, `A[b, m]` (+1 → human `L`, 0 → `T`, −1 → `W`); all other entries 0. With alpha > 0 each column has exactly 3 nonzero entries.
  - `outcome_rates: dict[str, float]`: keys `win`, `lose`, `tie`, from the human's side (the bot's win rate is the human's `lose`); `stationary` summed over the `*W`, `*L`, `*T` tokens; sums to 1. Raises the same `ValueError` as `stationary` when π is not unique (a reducible chain, e.g. states RT, PW, SL all make the bot play R and RW, PL, ST all make it play S).

## Payoff

`PayoffMatrix()` (`src/rps_markov/payoff.py`), a `Matrix`; fixed, so it needs no data. Rows = bot move, columns = human move, both `R, P, S`.

- `A: np.ndarray`, the same array as `values`; int; `[[0, -1, 1], [1, 0, -1], [-1, 1, 0]]` (+1 bot wins, 0 tie, −1 bot loses).
- `scores(q) -> np.ndarray`: `A @ q`, the bot's expected score per move against a human move distribution q.
- `best_move(q) -> str`: the move in `R, P, S` with the highest score. A tie means exactly equal scores (`np.argmax`, no tolerance); the first move wins. This can differ from countering the most likely human move.

## Matrix files

Only counts are persisted: `N_<name>.csv`.

| Part | Content |
|---|---|
| header | `move`, then `RW,RL,RT,PW,PL,PT,SW,SL,ST` |
| rows | 3: `R`, `P`, `S` |
| values | integer counts |

P, the 9 × 9 and A are never written to disk. Old `P_*.csv` and k = 3 `N_*.csv` files from earlier runs are not read; `Counts.load` rejects the k = 3 ones.

## CLI

`python -m rps_markov.count --csv <file> [<file> ...] --out <folder>`, with `src` on `PYTHONPATH`.

For each input `<name>.csv` it writes `N_<name>.csv` to `--out`, creating the folder if needed. `<name>` is the input file name without its extension, so two inputs with the same name overwrite each other's outputs. There is no `--k`, no `--alpha` and no other flag; the parser has `allow_abbrev=False`, so only the exact flags `--csv` and `--out` are accepted.
