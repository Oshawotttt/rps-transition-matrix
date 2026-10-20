# rps-transition-matrix

k-Markov transition matrices for human rock-paper-scissors moves.

## Setup

`data/` is gitignored, so build the dataset before computing any matrix.

1. Install the dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Download the two raw files into `data/raw/`:
   - `rps_v1_data.csv`, Brockbank & Vul (2021): https://raw.githubusercontent.com/erik-brockbank/rps-games-analysis/master/data/rps_v1_data.csv
   - `WXZ2014.rda`, Wang, Xu & Zhou (2014): download https://cran.r-project.org/src/contrib/Archive/stratEst/stratEst_1.1.6.tar.gz, then extract the one file and move it into place:

     ```
     tar -xzf stratEst_1.1.6.tar.gz stratEst/data/WXZ2014.rda
     mv stratEst/data/WXZ2014.rda data/raw/
     ```

3. Run the cleaning notebook. It writes `data/processed/rps_human_combined.csv` and the train/test files in `data/processed/partitions/`:

   ```
   jupyter nbconvert --to notebook --execute --inplace notebooks/clean_data.ipynb
   ```

Sources and licences: [data/README.md](data/README.md).

## Quick start: P for k = 1

```
PYTHONPATH=src python -m rps_markov.markov --csv data/processed/rps_human_combined.csv --out data/processed/transition_matrices/k1 --k 1
```

PowerShell: run `$env:PYTHONPATH = "src"` first, then the same command without the `PYTHONPATH=src` prefix.

This writes `P_rps_human_combined.csv` (probabilities) and `N_rps_human_combined.csv` (counts). Output files are named after the input CSV, not k, so give each k its own `--out` folder. `--csv` takes several files; `--k` defaults to 3.

## Model

- A token is one round: the player's move (`R`, `P`, `S`) plus their outcome (`W`, `L`, `T`). There are 9 tokens.
- A k-state is the player's last k tokens, e.g. `RW-PL-ST`. There are 9^k states.
- N is 3 × 9^k: rows are the next move (R, P, S), columns are k-states, entries are counts.
- P = (N + alpha) / column sums, with alpha = 1 by default. Each column sums to 1, and a state never seen gives [1/3, 1/3, 1/3].

## Tests

```
python -m pytest
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Contracts](docs/CONTRACTS.md): file formats and rules
- [Glossary](GLOSSARY.md)
- [Presentation outline](docs/OUTLINE.md)
