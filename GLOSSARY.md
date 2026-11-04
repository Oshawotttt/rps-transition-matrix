# Glossary

**Master**: `data/processed/rps_human_combined.csv`, the cleaned table of every valid round of every player in both datasets; the source all partitions are copied from.

**Dataset**: one of the two human RPS studies in the master: `brockbank` (Brockbank & Vul 2021) or `wxz` (Wang, Xu & Zhou 2014).

**Partition**: a train or test copy of the master's rows for one dataset, or for both pooled.

**Pooled**: the brockbank and wxz rows of the same split, together.

**Token**: one round of one player as their move followed by their outcome, e.g. `RW` (rock, win); 9 in all.

**State**: a player's previous round as a token, e.g. `PL`; 9 in all. Everything is k = 1.

**Move state**: a player's previous move alone (`R`, `P`, `S`); the 3 × 3 matrix is built by summing the 3 × 9 counts over the outcome.

**History**: the previous round of the same player that gives a row its state; a row without it has no history.

**Counts (N)**: the 3 × 9 matrix of how often each next move followed each state. Held by `Counts`; the only persisted matrix.

**Transition matrix (P)**: the column-stochastic matrix of next-move probabilities, derived from N and alpha; column j is the next-move distribution after state j. Never persisted.

**Smoothing (alpha)**: the pseudo-count added to every cell of N before normalising, so an unseen state gives a uniform column.

**Steady state (π)**: for a square P, the eigenvector for eigenvalue 1, normalised to sum to 1; the long-run share of each state. Not defined (an error) when eigenvalue 1 is repeated.

**Payoff matrix (A)**: the fixed 3 × 3 matrix of the bot's score (+1 win, 0 tie, −1 loss); rows are bot moves, columns are human moves.

**Human-vs-bot chain**: the 9 × 9 column-stochastic matrix over tokens for one human playing the best-move bot.

**Decision**: one bot choice with its working (x, q, A q, move) and the per-round panel numbers.

**Opening**: the bot's round-1 decision, from q₀ = P π of the human-vs-bot chain, or the 3 × 3 steady state when that π is not unique or the chain cycles.

**Closed group**: a group of states the chain never leaves once in it; each has its own steady state.

**Transient state**: a state in no closed group; the long run never returns to it.
