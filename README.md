# rps-transition-matrix

k-Markov transition matrices for human rock-paper-scissors moves.

## Setup

```
pip install -r requirements.txt
```

`data/` is gitignored. Rebuild `data/processed/` by running the notebook (the raw files in `data/raw/` must be present):

```
jupyter nbconvert --to notebook --execute --inplace notebooks/clean_data.ipynb
```

## Tests

```
python -m pytest
```

## States

One round of a player gives a token: their move (`R`, `P`, `S`) followed by their outcome (`W` win, `L` lose, `T` tie). The 9 tokens, in order: `RW, RL, RT, PW, PL, PT, SW, SL, ST`.

A k-state is the player's last k tokens joined by `-`, oldest first, e.g. `RW-PL-ST` for k = 3. There are 9^k states. A history only uses consecutive rounds of the same player: a row whose previous k rounds are not all present has no state.

Code examples run from the repo root with `src` on `PYTHONPATH`.

```python
from rps_markov.markov import add_history, load_rounds

df = load_rounds("data/processed/partitions/train_pooled.csv")
hist = add_history(df, k=3)  # adds column "state"; drops rows without k gap-free prior rounds
```
