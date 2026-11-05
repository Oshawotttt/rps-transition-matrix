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

- `Bot(counts)`: holds the four matrices as read-only attributes `outcome`, `basic`, `match`, `payoff`; `get_move(token)` gives the decision after the human's previous token, `opening` the round-1 decision, and `to_dict()` everything the frontend shows.

## Export for the frontend

```
python -m rps_markov.bot --counts data/processed/transition_matrices/N_rps_human_combined.csv --out data/processed/bots/bot_rps_human_combined.json --name Humanity
```

Writes one static JSON file for the browser frontend (optional `--alpha`, default 1.0; optional `--name`, the opponent name stored as `opponent`, `null` when omitted); the file's keys are in [Contracts](docs/CONTRACTS.md).

The default bot for the web app is committed at `web/public/bots/bot_rps_human_combined.json`. After rebuilding `data/`, rebuild it and copy it:

```
python -m rps_markov.bot --counts data/processed/transition_matrices/N_rps_human_combined.csv --out data/processed/bots/bot_rps_human_combined.json --name Humanity
cp data/processed/bots/bot_rps_human_combined.json web/public/bots/
```

It can go stale when `data/` is rebuilt; `tests/test_bot.py::test_default_bot_is_current` fails then (skipped when the N file is missing).

## Single-human bots

Four demo bots, each trained on one human's full game (about 299 transitions). The four were picked from all 188 players because each one has:

- one closed group holding all 9 states, with no transient states and no unit cycle, so π is unique and the opening comes from the 9 × 9;
- no zero cells in N;
- all three bot moves in its policy;
- a pattern you can name.

| Bot file | Player | Pattern | Policy (RW … ST) | 3 × 3 \|λ₂\| | 9 × 9 \|λ₂\| | Edge |
|---|---|---|---|---|---|---|
| `bot_human_stubborn.json` | wxz `wxz_2` | Repeats their last move about 75% of the time, whatever the outcome. | `PPPSSSRRR` | 0.61 | 0.59 | 0.55 |
| `bot_human_cycler.json` | brockbank `1e58af30…` | Plays the move that beats their last one (R → P → S) about 50% of the time. | `SSSRRRPPP` | 0.33 | 0.51 | 0.38 |
| `bot_human_wsls.json` | brockbank `b068ac38…` | Win-stay (66%), lose-shift (87%). The 3 × 3 looks random; the outcome shows the pattern. | `PSPSRSRPR` | 0.13 | 0.72 | 0.28 |
| `bot_human_doubler.json` | wxz `wxz_48` | Repeats after a loss (74%) and shifts up after a win (55%). π piles onto PL (37%). | `SPPRSSPRR` | 0.25 | 0.72 | 0.49 |

Edge is in-sample: it comes from the same 300 rounds the bot was trained on, so it overstates the edge against new play. The player ids are in `DEMO_HUMANS` in `src/rps_markov/partition.py`. Rebuild from the repo root:

```
python -c "from rps_markov.partition import write_players; write_players('data/processed/rps_human_combined.csv', 'data/processed/partitions')"
python -m rps_markov.count --csv data/processed/partitions/human_stubborn.csv data/processed/partitions/human_cycler.csv data/processed/partitions/human_wsls.csv data/processed/partitions/human_doubler.csv --out data/processed/transition_matrices
python -m rps_markov.bot --counts data/processed/transition_matrices/N_human_stubborn.csv --out web/public/bots/bot_human_stubborn.json --name "The Stubborn One"
python -m rps_markov.bot --counts data/processed/transition_matrices/N_human_cycler.csv --out web/public/bots/bot_human_cycler.json --name "The Cycler"
python -m rps_markov.bot --counts data/processed/transition_matrices/N_human_wsls.csv --out web/public/bots/bot_human_wsls.json --name "Win-Stay Lose-Shift"
python -m rps_markov.bot --counts data/processed/transition_matrices/N_human_doubler.csv --out web/public/bots/bot_human_doubler.json --name "The Doubler"
```

To load one, open the app with `?bot=bots/bot_human_wsls.json`.

## Game logic

`web/src/game.js` loads a bot JSON and plays a best-of-3 or best-of-5 match in the browser. It is a plain ES module with no npm dependencies and no DOM code; the React UI beside it only calls it. API: [Contracts](docs/CONTRACTS.md), "Game logic".

## Projector view

A React app in `web/`, built with Vite. Run it from `web/`:

```
npm install
npm run dev
```

`npm run build` writes the static app to `web/dist/`. The page loads the pooled bot by default; `?bot=bots/<file>.json` loads another bot from `web/public/bots/`.

Each round the presenter goes through Predict, Score and Choose with the class, then clicks the bot's move. Only the move with the largest entry of A q is accepted. Until the relay server exists, the presenter then enters the friend's move on the projector.

The test fixture `web/test/fixtures/bot_synthetic.json` is `Bot.to_dict()` of the synthetic counts in `tests/test_bot.py`. Regenerate it from the repo root:

```
python -c "import json, sys; sys.path.insert(0, 'tests'); from test_bot import synthetic_counts; from rps_markov.bot import Bot; open('web/test/fixtures/bot_synthetic.json', 'w', encoding='utf-8').write(json.dumps(Bot(synthetic_counts()).to_dict(), allow_nan=False))"
```

`tests/test_bot.py::test_web_fixture_is_current` fails if it no longer matches Python.

## Tests

```
python -m pytest
node --test "web/test/*.test.js"
```

The JS command takes a file glob (Node 24 fails with `MODULE_NOT_FOUND` on a directory such as `web/test/`). `web/package.json`'s `test` script runs the same tests from `web/`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Contracts](docs/CONTRACTS.md): file formats and rules
- [Glossary](GLOSSARY.md)
- [Presentation outline](docs/OUTLINE.md)
