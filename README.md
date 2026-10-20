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

## Transition matrix

`TransitionMatrix(k, alpha)` counts, over every row of a CSV, which move a player makes next after each k-state.

- `counts`: shape 3 × 9^k. Rows = next move `R, P, S`; columns = k-states in `state_labels(k)` order.
- `P`: `(counts + alpha) / column sums`. Each column sums to 1 (column-stochastic). With the default `alpha = 1`, a state never seen gives `[1/3, 1/3, 1/3]`.
- `column(state)` = `P e_j`, the next-move distribution for state j.
- `predict(x)` = `P x`, the next-move distribution for a belief x over the 9^k states.

Fit on a train partition, predict on the matching test partition:

```python
from rps_markov.markov import TransitionMatrix, add_history, load_rounds

tm = TransitionMatrix.from_csv("data/processed/partitions/train_pooled.csv", k=3)
test = add_history(load_rounds("data/processed/partitions/test_pooled.csv"), k=3)
probs = [tm.column(s) for s in test["state"]]  # P(R), P(P), P(S) for each test row

tm.save("data/processed/N_train_pooled.csv")   # counts; reload with TransitionMatrix.load(path)
tm.to_frame()                                  # P as a DataFrame: index R, P, S; columns = states
```

Pick the dataset by picking the file: `train_brockbank.csv`, `train_wxz.csv` or `train_pooled.csv`.
