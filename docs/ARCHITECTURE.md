# Architecture

## Data flow

```
data/raw/rps_v1_data.csv, data/raw/WXZ2014.rda
  │  notebooks/clean_data.ipynb, sections 1–5
  ▼
data/processed/rps_human_combined.csv            (master)
  │  notebook section 6 → rps_markov.partition.write_partitions
  ▼
data/processed/partitions/{train,test}_{brockbank,wxz,pooled}.csv
  │  rps_markov.markov: load_rounds → add_history → TransitionMatrix.fit
  │  (CLI: python -m rps_markov.markov)
  ▼
data/processed/transition_matrices/N_<name>.csv, P_<name>.csv
```

`data/` is gitignored. Every file under it is rebuilt by running the notebook and then the CLI.

## Modules

| Module | Role |
|---|---|
| `notebooks/clean_data.ipynb` | Cleans and combines the two raw datasets into the master; section 6 writes the partitions. |
| `src/rps_markov/partition.py` | Splits the master into train/test copies by player. Pure pandas/numpy; the notebook is its only caller. |
| `src/rps_markov/markov.py` | Loads master-format CSVs, builds k-state histories, counts transitions (`TransitionMatrix`), and holds the CLI. |

Signatures and file layouts are in [CONTRACTS.md](CONTRACTS.md); terms in [GLOSSARY.md](../GLOSSARY.md).

## Rules the system keeps

- The master is never written by partitioning: partitions are copies.
- Partitioning is by player: each `player_id` goes wholly to train or test, within its dataset. Brockbank games are fixed pairs, so the two players of one game can land in different splits.
- The pooled partition is the brockbank rows followed by the wxz rows of the same split. Brockbank and wxz `player_id`s don't overlap, so pooling never joins two players' histories.
- A history uses only consecutive rounds of the same `player_id`; it never spans a missing round. The notebook drops invalid rounds, so a dropped round breaks the history.
- The counter has no row or dataset filter: it counts every row of the CSV it is given. Picking a partition file picks the dataset.

## Not included

- No evaluation (accuracy, log-loss) on the test split: that is done outside this repo.
- No square 9^k × 9^k chain, matrix powers, stationary vector, SVD or least-squares check: only the 3 × 9^k `P`.
- No bot play, game simulation, plots or presentation visuals.
- The CLI is run for k = 3 only; `k` stays a parameter in the code.
