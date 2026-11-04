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
  │  rps_markov.count: load_rounds → add_history → count
  │  (CLI: python -m rps_markov.count)
  ▼
data/processed/transition_matrices/N_<name>.csv   (counts; the only persisted matrix)
  │  Counts.load → <matrix class>   (in memory, lazy, cached)
  ▼
P: OutcomeTransitionMatrix (3 × 9), BasicTransitionMatrix (3 × 3),
   BotMatchTransitionMatrix (9 × 9, built with PayoffMatrix A)
  │  Counts → Bot (holds the matrices; decisions per round)
  ▼
N_<name>.csv → python -m rps_markov.bot → bot JSON → browser frontend
```

`data/` is gitignored. Every file under it is rebuilt by running the notebook and then the CLI. P, the 9 × 9 and A are never written to disk; the bot JSON (under `data/`, rebuilt by the CLI) is the only export.

## Modules

| Module | Role |
|---|---|
| `notebooks/clean_data.ipynb` | Cleans and combines the two raw datasets into the master; section 6 writes the partitions. |
| `src/rps_markov/partition.py` | Splits the master into train/test copies by player. Pure pandas/numpy; the notebook is its only caller. |
| `src/rps_markov/count.py` | Loads master-format CSVs, builds the previous-token history, counts N and holds the CLI. Counting only; no matrices. |
| `src/rps_markov/matrix.py` | `Matrix`, the abstract labelled-matrix base (`rows`, `columns`, `values`, `to_frame`, `@`). |
| `src/rps_markov/markov.py` | `Counts` (loads and holds N, read-only) and the transition matrices built from it: `TransitionMatrix` base, `OutcomeTransitionMatrix`, `SquareTransitionMatrix`, `BasicTransitionMatrix`, `BotMatchTransitionMatrix`. |
| `src/rps_markov/payoff.py` | `PayoffMatrix`: the fixed 3 × 3 payoff A and the bot's best move. |
| `src/rps_markov/bot.py` | `Bot` (holds the four matrices from one `Counts`; `get_move`, `opening`, `to_dict`), the `Decision` record, and the CLI that writes the bot JSON. All panel numbers are computed here and in `markov.py`; the frontend only reads them. |

Signatures and file layouts are in [CONTRACTS.md](CONTRACTS.md); terms in [GLOSSARY.md](../GLOSSARY.md).

## Rules the system keeps

- The master is never written by partitioning: partitions are copies.
- Partitioning is by player: each `player_id` goes wholly to train or test, within its dataset. Brockbank games are fixed pairs, so the two players of one game can land in different splits.
- The pooled partition is the brockbank rows followed by the wxz rows of the same split. Brockbank and wxz `player_id`s don't overlap, so pooling never joins two players' histories.
- A history uses only consecutive rounds of the same `player_id`; it never spans a missing round. The notebook drops invalid rounds, so a dropped round breaks the history.
- The counter has no row or dataset filter: it counts every row of the CSV it is given. Picking a partition file picks the dataset.
- Counting, holding counts and building matrices are separate: `count.py` writes N, `Counts` holds it, and matrix classes take a `Counts` and never load or count. The caller picks the matrix class.
- Matrix classes depend only on the N format, never on which dataset or player an N file came from.
- P and every derived matrix or value is computed on first access and cached; `Counts.values` is read-only so the cache cannot go stale.
- `BotMatchTransitionMatrix` takes an `OutcomeTransitionMatrix` and a `PayoffMatrix`; the bot's move in each state is computed from P and A, so it needs no data of its own.
- The bot keeps no memory between rounds; the caller sends the human's previous token each round. No matrix changes after the bot is built (P, A, the 9 × 9 and π are fixed once built).
- Matrices live on each `Bot` instance, never in module or global state, so several bots (e.g. friend and pooled) can exist side by side. `Bot` takes a `Counts` and never loads.
- The frontend reads the bot only through the JSON export; everything in it is fixed before the game.
- Closed groups, group steady states, group outcome rates and transient states are for display only and never affect a move.
- Round 1 follows `PRESENTATION-FLOW.md` 2.4 (π of the 9 × 9), not `OUTLINE.md`: the real round-1 move distribution u₀ is not used.
- Everything is k = 1: the counting script, the N files and every matrix class.

## Not included

- No evaluation (accuracy, log-loss) on the test split: that is done outside this repo.
- The only square matrices are `BasicTransitionMatrix` (3 × 3) and `BotMatchTransitionMatrix` (9 × 9). No k ≠ 1, no absorbing chains, no SVD or least-squares check. Matrix powers exist only as `look_ahead`.
- No match win probability panel (neither the split 9 × 9 nor the absorbing chain).
- No round-1 prediction from the real first-move distribution u₀.
- No frontend (browser/JS, outside this repo): no game rules, score, round history, human-move input, or choice of whether to play the recommended move.
- No HTTP server or API layer: the frontend reads a static JSON file.
- No running totals over the game (live tally, expected vs actual score): the bot is stateless, so the frontend adds up the exported per-round values (`q`, `expected_score`); it does no other arithmetic.
- No collection of the friend's rounds, plots or presentation visuals.
