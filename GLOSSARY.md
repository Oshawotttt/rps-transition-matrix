# Glossary

**Master**: `data/processed/rps_human_combined.csv`, the cleaned table of every valid round of every player in both datasets; the source all partitions are copied from.

**Dataset**: one of the two human RPS studies in the master: `brockbank` (Brockbank & Vul 2021) or `wxz` (Wang, Xu & Zhou 2014).

**Partition**: a train or test copy of the master's rows for one dataset, or for both pooled.

**Pooled**: the brockbank and wxz rows of the same split, together.

**Token**: one round of one player as their move followed by their outcome, e.g. `RW` (rock, win); 9 in all.

**k-state**: a player's last k tokens joined by `-`, oldest first, e.g. `RW-PL-ST`; 9^k in all.

**History**: the k consecutive prior rounds of the same player that give a row its k-state; a row without them has no history.

**Counts (N)**: the 3 × 9^k matrix of how often each next move followed each k-state.

**Transition matrix (P)**: the 3 × 9^k column-stochastic matrix of next-move probabilities; column j is the next-move distribution after state j.

**Smoothing (alpha)**: the pseudo-count added to every cell of N before normalising, so an unseen state gives a uniform column.
