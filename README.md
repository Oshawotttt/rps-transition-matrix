# rps-transition-matrix

Markov transition matrices (previous round → next move) for human rock-paper-scissors moves.

## Setup

`data/` is gitignored, so build the dataset before computing any matrix.

1. Install the dependencies and the `rps_markov` package (editable, from `src/`):

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

## Quick start: counts and P

```
python -m rps_markov.count --csv data/processed/rps_human_combined.csv --out data/processed/transition_matrices
```

This needs the package installed (setup step 1). Run it from the repo root, since the paths are relative.

This writes `N_rps_human_combined.csv` (counts) only; output files are named after the input CSV, and `--csv` takes several files. P is derived from N when needed and never written:

```
counts = Counts.load("data/processed/transition_matrices/N_rps_human_combined.csv")
OutcomeTransitionMatrix(counts)   # 3 x 9
BasicTransitionMatrix(counts)     # 3 x 3
```

## Model

- A token is one round: the player's move (`R`, `P`, `S`) plus their outcome (`W`, `L`, `T`). There are 9 tokens.
- A state is the player's previous token, e.g. `PL`. There are 9 states (k = 1 everywhere).
- N is 3 × 9: rows are the next move (R, P, S), columns are states, entries are counts.
- `OutcomeTransitionMatrix`: P = (N + alpha) / column sums, 3 × 9, with alpha = 1 by default. Each column sums to 1, and a state never seen gives [1/3, 1/3, 1/3].
- `BasicTransitionMatrix`: the 3 × 3 P (previous move → next move), from the same N file by summing the outcome out. Its eigenvalues and steady state π are `eigenvalues` and `stationary`.
- `PayoffMatrix`: the fixed 3 × 3 payoff A, which picks the bot's best move against a predicted distribution.
- `BotMatchTransitionMatrix(OutcomeTransitionMatrix(counts), PayoffMatrix())`: the 9 × 9 chain of one human against the best-move bot; `outcome_rates` gives the long-run win, lose and tie rates from the human's side.

## Tests

```
python -m pytest
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Contracts](docs/CONTRACTS.md): file formats and rules
- [Glossary](GLOSSARY.md)
- [Presentation outline](docs/OUTLINE.md)
