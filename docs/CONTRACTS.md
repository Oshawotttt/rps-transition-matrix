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

- Token order: `RW, RL, RT, PW, PL, PT, SW, SL, ST`.
- k-state labels: the 9^k tokens' Cartesian product in that order, joined by `-`, oldest first (the second k = 2 label is `RW-RL`).
- A row gets a state only if its player has rows at rounds r-k .. r-1.

Code: `src/rps_markov/markov.py`.

## Transition matrix

- Counts N: 3 × 9^k integers; rows = next move `R, P, S`; columns = states in label order. Total = number of rows with a state.
- P = (N + alpha) / column sums; every column sums to 1. Default alpha = 1, so an unseen state's column is `[1/3, 1/3, 1/3]`.
- Prediction for state j is column j of P; for a belief x over states it is P x.
- Unknown state labels are a `KeyError`; moves or outcomes outside the values above are a `ValueError`.

Code: `src/rps_markov/markov.py` (`TransitionMatrix`).

## Matrix files

`N_<name>.csv` (counts) and `P_<name>.csv` (probabilities) share one layout:

| Part | Content |
|---|---|
| header | `move`, then the 9^k state labels in label order |
| rows | 3: `R`, `P`, `S` |
| k = 3 | 729 state columns; in `P_`, each column sums to 1 |

k is read back from the length of the first state label.

## CLI

`python -m rps_markov.markov --csv <file> [<file> ...] --out data/processed/transition_matrices [--k 3]`, with `src` on `PYTHONPATH`.

For each input `<name>.csv` it writes `N_<name>.csv` and `P_<name>.csv` to `--out`, creating the folder if needed. `<name>` is the input file name without its extension, so two inputs with the same name overwrite each other's outputs.
