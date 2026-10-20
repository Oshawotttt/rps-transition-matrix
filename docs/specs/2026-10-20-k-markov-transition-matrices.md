# k-Markov transition matrices for human RPS moves

**Status:** approved
**Repo:** `D:\SMU\CS103\proj\rps-transition-matrix`
**Context file to update:** none named
**Docs:** `README.md` (title only), `data/README.md`, `notebooks/clean_data.ipynb` (schema of the input CSV). No CLAUDE.md, ADRs or glossary.

**Commands**
- Full test suite: `python -m pytest`
- Single test file: `python -m pytest tests/test_markov.py`
- Run notebook: `jupyter nbconvert --to notebook --execute --inplace notebooks/clean_data.ipynb`
- Typecheck: none
- Lint: none

## 1. Dependencies and blockers

| Subtask | Blocked by |
|---|---|
| S1 | none |
| S2 | S1 |
| S3 | S2 |
| S4 | S3 |

Run order: S1, S2, S3, S4.

External blockers: none.

Uncommitted changes (untracked on `main`):
- `requirements.txt`: committed in S1 (user).
- `notebooks/clean_data.ipynb`: committed in S1 with the partition section (user).
- `data/`: never committed; added to a new `.gitignore` in S1 (user).

Branch: `feat/k-markov-transition-matrices` (current branch is `main`).

## 2. Suggested splits

No split: all subtasks are connected. S2–S4 read the partition files from S1; S3 consumes S2's histories; S4 calls S3.

## 3. Out of scope

- k other than 3 in the CLI outputs (user: "just do k=3"). The code keeps `k` as a parameter; tests use small k.
- Evaluation (accuracy, log-loss) on the test split: the user evaluates.
- Row-range or dataset filtering inside the counter: it takes a whole CSV (user).
- Least-squares equivalence check, square 9^k × 9^k chain, matrix powers, stationary vector, SVD (user: "no focus on getting the Ps").
- Playing against a bot or simulating games.
- Plots and presentation visuals.
- Changing `data/processed/rps_human_combined.csv` (master, user).

## 4. Interfaces

Partition files (S1 → S3, S4): CSVs with exactly the columns of `rps_human_combined.csv`:
`dataset,game_id,player_id,round,move,opp_move,outcome,prev_move,prev_opp_move,prev_outcome`.

Module `src/rps_markov/partition.py` (S1; called by the notebook):

```python
def partition(df: pd.DataFrame, test_share: float = 0.2, seed: int = 103) -> dict[str, pd.DataFrame]
    # df: master rows; never modified
    # keys: "train_brockbank", "test_brockbank", "train_wxz", "test_wxz", "train_pooled", "test_pooled"
    # per dataset: floor(test_share * n_players) players chosen with numpy.random.default_rng(seed) go to test

def write_partitions(master: str | Path, out_dir: str | Path, test_share: float = 0.2, seed: int = 103) -> None
    # reads master, writes <key>.csv for each key of partition(); never writes to master
```

Module `src/rps_markov/markov.py`:

```python
MOVES: list[str] = ["R", "P", "S"]
OUTCOMES: dict[str, str] = {"win": "W", "lose": "L", "tie": "T"}
TOKENS: list[str]  # ["RW", "RL", "RT", "PW", "PL", "PT", "SW", "SL", "ST"]

def state_labels(k: int) -> list[str]
    # all 9**k states, itertools.product(TOKENS, repeat=k) order, tokens joined by "-", oldest first

def load_rounds(path: str | Path) -> pd.DataFrame
    # reads a CSV in the master format; checks required columns
    # (player_id, round, move, outcome); raises ValueError if any are missing

def add_history(df: pd.DataFrame, k: int) -> pd.DataFrame
    # copy of df with column "state" (k-state label), keeping only rows whose
    # player_id has rows at rounds r-k .. r-1 (no gaps)

class TransitionMatrix:
    k: int
    alpha: float
    states: list[str]        # == state_labels(k)
    counts: np.ndarray       # shape (3, 9**k), int; rows = MOVES (next move), columns = states

    def __init__(self, k: int = 3, alpha: float = 1.0) -> None   # counts all zero
    def fit(self, df: pd.DataFrame) -> "TransitionMatrix"       # counts from add_history(df, k) over all rows; returns self
    @classmethod
    def from_csv(cls, path, k: int = 3, alpha: float = 1.0) -> "TransitionMatrix"   # load_rounds(path) + fit, whole file
    @property
    def P(self) -> np.ndarray           # (counts + alpha) / column sums; shape (3, 9**k); columns sum to 1
    def to_frame(self) -> pd.DataFrame  # P labelled: index = MOVES, columns = states
    def column(self, state: str) -> np.ndarray   # P @ e_j, j = states.index(state); KeyError on unknown label
    def predict(self, x: np.ndarray) -> np.ndarray   # P @ x for x of length 9**k (belief over states)
    def save(self, path) -> None        # writes counts: rows R, P, S; first column "move", then states
    @classmethod
    def load(cls, path, alpha: float = 1.0) -> "TransitionMatrix"   # reads the counts CSV at path, as written by save(path); k from label length
```

CLI: `python -m rps_markov.markov --csv <file> [<file> ...] --out data/processed/transition_matrices [--k 3]`. For each input file `<name>.csv`, writes `N_<name>.csv` (counts, via `save`) and `P_<name>.csv` (probabilities, same layout).

## 5. Subtasks

### S1 — Partitions in the notebook, gitignore, commit notebook

- **Goal:** the notebook keeps `rps_human_combined.csv` as the master and writes train/test copies for `brockbank`, `wxz` and `pooled`.
- **Blocked by:** none
- **Files:** `src/rps_markov/__init__.py`, `src/rps_markov/partition.py`, `notebooks/clean_data.ipynb` (new section after "5. Save" that calls `write_partitions`), `.gitignore`, `requirements.txt`, `data/README.md`, `tests/test_partitions.py`, `pyproject.toml` (pytest `pythonpath = ["src"]`)
- **Seams:** `partition`, `write_partitions`; notebook run command
- **Decisions:**
  - "use this as master. in the notebook. create the partitions. copy and keep this" (user): master file unchanged; partitions are copies.
  - "3 diff sets of P. one for each data set and one for pooled" (user).
  - "git ignore data. notebook can commit" (user): `.gitignore` contains `data/`.
  - Libraries: `numpy`, `pandas`, `pytest`; no others (user). Add `numpy` and `pytest` to `requirements.txt`; commit `requirements.txt` (user).
  - Partition by player (user): each `player_id` goes wholly to train or test, chosen at random with a fixed seed, split within each dataset.
  - Partition files (user confirmed), under `data/processed/partitions/`: `train_brockbank.csv`, `test_brockbank.csv`, `train_wxz.csv`, `test_wxz.csv`, `train_pooled.csv`, `test_pooled.csv`. Same columns as the master. Pooled = brockbank rows + wxz rows of the same split. The code has no dataset filter: picking a file picks the dataset.
  - Train/test share (user confirmed): 80% of players to train, 20% to test, per dataset, test count rounded down; seed `numpy.random.default_rng(103)`.
- **Acceptance criteria:**
  - [x] `jupyter nbconvert --to notebook --execute --inplace notebooks/clean_data.ipynb` exits 0 and writes the 6 partition files listed under Decisions.
  - [x] `write_partitions` on a synthetic master in `tmp_path` leaves the master's SHA-256 unchanged and writes the 6 files (`tests/test_partitions.py::test_master_unchanged`).
  - [x] For each dataset, train ∪ test rows == master rows of that dataset and train ∩ test == ∅ on (`player_id`, `round`) (`test_partition_exact_cover`).
  - [x] `train_pooled` == `train_brockbank` + `train_wxz` rows; same for test (`test_pooled_is_union`).
  - [x] No `player_id` appears in both train and test of any dataset (`test_partition_by_player`).
  - [x] Test players per dataset == floor(0.2 × players in that dataset) (`test_partition_share`).
  - [x] Two calls of `partition(df)` with the default seed return equal frames (`test_partition_deterministic`).
  - [x] Each output frame has exactly the master columns, in the same order (`test_partition_columns`).
  - [x] `git check-ignore data/processed/rps_human_combined.csv` exits 0.
  - Tests use synthetic data; none depend on files under `data/`.
- **Doc deltas:** `data/README.md`: `partitions/` folder, rule, file list; master is never overwritten by partitioning.

### S2 — CSV loader and k-history builder

- **Goal:** any master-format CSV loads through one function, and each row can be tagged with its player's last k (move, outcome) pairs, respecting gaps.
- **Blocked by:** S1
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `README.md`
- **Seams:** `load_rounds`, `state_labels`, `add_history`
- **Decisions:**
  - Input format is `data/processed/rps_human_combined.csv` (user).
  - "write an object for the transition matrix and code/object methods to import the csv" (user).
  - States are "rps + win/lose/tie", so one round has 9 tokens and a k-state has 9^k values (user).
  - Labels: tokens `RW, RL, RT, PW, PL, PT, SW, SL, ST` in that order; k-state = tokens joined by `-`, oldest first (user confirmed).
  - "just do k=3" (user).
  - A history uses only consecutive valid rounds of the same `player_id`; it never spans a missing round (user; code: `notebooks/clean_data.ipynb` drops invalid rounds).
- **Acceptance criteria:**
  - [x] `state_labels(1) == TOKENS`, `len(state_labels(3)) == 729`, `state_labels(2)[1] == "RW-RL"` (`tests/test_markov.py::test_state_labels`).
  - [x] `load_rounds` on a CSV missing `outcome` raises `ValueError` (`test_load_rounds_missing_column`).
  - [x] Synthetic player, rounds 1–4, (move, outcome) = (R,win),(P,lose),(S,tie),(R,win), k=2: rows at rounds 3, 4 get `RW-PL`, `PL-ST`; rounds 1, 2 dropped (`test_add_history_basic`).
  - [x] Synthetic player with rounds 1, 2, 4, 5, 6, k=2: rounds 4, 5 dropped, round 6 kept with state from rounds 4, 5 (`test_add_history_gap`).
  - [x] Two players' sequences never mix (`test_add_history_players_separate`).
  - [x] Real master, k=1: `state` equals `prev_move + OUTCOMES[prev_outcome]` on every row with a `prev_move` (`test_add_history_matches_prev_columns`, skipped if CSV absent).
- **Doc deltas:** `README.md`: setup (`pip install -r requirements.txt`), test command, state token definition, note that `data/` is gitignored and rebuilt by the notebook.

### S3 — TransitionMatrix object (column picture)

- **Goal:** `TransitionMatrix` counts transitions over a whole CSV and exposes the column-stochastic `P` of shape 3 × 9^k.
- **Blocked by:** S2
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `README.md`
- **Seams:** `TransitionMatrix` public methods and properties
- **Decisions:**
  - Use the column picture where relevant (user): rows = next move `R, P, S`, columns = states, each column sums to 1, prediction for state j = `P e_j`, belief x over states gives `P x`.
  - "P should be 3x9^k" (user); k=3 gives 3 × 729.
  - Add-one smoothing: `alpha = 1.0` default, unseen state column = [1/3, 1/3, 1/3] (user).
  - "counter should take in the whole csv" (user): no row or dataset filter in `fit` / `from_csv`.
  - File layout: 3 rows `R, P, S`, first column `move`, then 729 state columns (user confirmed).
- **Acceptance criteria:**
  - [x] `TransitionMatrix(k).fit(df).counts` on S2 synthetic data equals hand-computed counts (`test_counts_small`).
  - [x] For k = 1, 2, 3 on synthetic data: `P.shape == (3, 9**k)`, entries in [0, 1], `P.sum(axis=0)` all 1 within 1e-12 (`test_columns_sum_to_one`).
  - [x] Unseen state column equals [1/3, 1/3, 1/3] with alpha=1 (`test_unseen_state_uniform`).
  - [x] `column("RW-PL-ST")` equals `P @ e_j` and `to_frame()["RW-PL-ST"]` (`test_column_is_P_e_j`).
  - [x] `predict(x)` equals `P @ x` and sums to 1 for a probability vector x (`test_predict_mixture`).
  - [x] `column("XX")` raises `KeyError` (`test_column_unknown_state`).
  - [x] `counts.sum() == len(add_history(df, k))` (`test_counts_total`).
  - [x] `tm.save(path)` then `TransitionMatrix.load(path)` gives equal `counts` and `k`, with `path` under `tmp_path` (`test_save_load_roundtrip`).
  - [x] `from_csv(path, k)` equals `TransitionMatrix(k).fit(load_rounds(path))` (`test_from_csv`).
  - [x] Counts from `train_brockbank.csv` + `train_wxz.csv` equal counts from `train_pooled.csv` (`test_pooled_counts_sum`, skipped if files absent).
- **Doc deltas:** `README.md`: define `P` (rows = next move, columns = last-k (move, outcome) state, columns sum to 1, `P e_j`, `P x`), object usage, train/test usage with partition files.

### S4 — CLI to write matrices for given CSVs

- **Goal:** one command writes `N` and `P` (k=3) for each input CSV, e.g. the three train partitions.
- **Blocked by:** S3
- **Files:** `src/rps_markov/markov.py`, `tests/test_markov.py`, `README.md`
- **Seams:** CLI `python -m rps_markov.markov`
- **Decisions:**
  - k=3 (user).
  - Three sets of P: one per dataset and one pooled (user).
  - Output folder `data/processed/transition_matrices/` (user).
- **Acceptance criteria:**
  - [x] CLI on two synthetic CSVs `a.csv`, `b.csv` writes `N_a.csv`, `P_a.csv`, `N_b.csv`, `P_b.csv` to `--out` (`test_cli_writes_files`, `tmp_path`).
  - [x] Each `N_*.csv` loads via `TransitionMatrix.load` with `P.shape == (3, 729)` and column sums 1 (`test_cli_output_valid`).
  - [x] Real run exits 0: `python -m rps_markov.markov --csv data/processed/partitions/train_brockbank.csv data/processed/partitions/train_wxz.csv data/processed/partitions/train_pooled.csv --out data/processed/transition_matrices` (with `src` on `PYTHONPATH`).
- **Doc deltas:** `README.md`: CLI usage and output file layout.

## 6. Human checks

- [x] S4: open `data/processed/transition_matrices/P_train_pooled.csv`. Expected: 3 rows (`R, P, S`), 729 state columns, each column sums to 1.
- [x] S3: fit k=1 on the master, compare with the notebook's crosstab `pd.crosstab([prev_outcome, prev_move], move, normalize="index")`. Expected: same values up to add-one smoothing, transposed.
- [x] S4: compare `P_train_brockbank.csv` and `P_train_wxz.csv` for a common state, e.g. `RL-RL-RL`. Expected: values differ.
