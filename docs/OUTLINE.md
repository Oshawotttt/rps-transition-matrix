# Presentation outline

CS103 project, Week 13: 10 minutes of presentation, then 5 minutes of Q&A. Topic: Markov chains and transition matrices.

**Framing: is human randomness real?** People think they play rock-paper-scissors at random. We use a transition matrix to test that. Pooled over many people, play looks random. Per person, it isn't: averaging the matrices hides each person's pattern.

**RPS is the worked example, not the significance.** The k = 1 matrix (3 × 3) is small enough to show every concept on a slide and check every claim against real data.

- Counting builds P and picks the next move. That is statistics, and for RPS it is enough to play. Say so on slide 2, before anyone asks "why not just count?".
- The linear algebra reads what P has learned: the habit (x), memory and its kind (λ₂), whether it is real (the noise floor), why pooled data hides it, and what an edge is worth over a game (N).
- The significance comes from section 8: cases where counting can't answer the question, because the answer is in the long run, there is no data to count, or the matrix is too big to read.

Every analysis in sections 3 to 7 runs on our own RPS matrices.

Notation follows LA4CS: square brackets for matrices and vectors, no multiplication symbols, and column-stochastic matrices, so a step is x_{t+1} = P x_t.

**States are moves only (R, P, S).** The code currently uses (move, outcome) tokens, and must be switched before the slides are built. A quick check showed the outcome adds no accuracy: on `test_pooled`, k = 1 gives 34.97% with moves only and 34.95% with tokens. Moves only makes P a square transition matrix with no opponent model.

**Data.**

- Pooled: two published human datasets combined, Brockbank & Vul (2021) and Wang, Xu & Zhou (2014). The talk does not compare the two. Every game is 300 rounds.
- Teammate: one teammate plays at least 100 rounds before the talk, without knowing what we will look for. This is the running example in sections 3 and 4. We can't get 100 rounds from the professor, and fewer rounds are below the noise floor (section 4).

**Numbers marked "preliminary"** come from a quick script, not the project code. Recompute them after the switch to moves only.

## Timing

| Time | Section |
|---|---|
| 0:00 to 0:45 | 1. Demo: best of 3 |
| 0:45 to 1:30 | 2. How the matrix is built |
| 1:30 to 3:00 | 3. Steady state: the null space of (P − I) |
| 3:00 to 5:00 | 4. Eigenvalues: is the pattern real? |
| 5:00 to 6:00 | 5. Pooling hides the pattern |
| 6:00 to 7:15 | 6. k-Markov: looking further back |
| 7:15 to 8:45 | 7. Short games: opening, fade and who wins |
| 8:45 to 10:00 | 8. Significance and close |

The linear algebra core is sections 3, 4 and 5. If the talk runs long, shorten section 6 to the augmentation slide and its payoff, then cut the opening and fade from section 7, keeping the absorbing chain. Don't cut sections 3, 4 and 5.

## 1. Demo: best of 3 (45 s)

- The professor plays the bot live: best of 3 (first to 2 wins). Ties are replayed.
- The bot opens with Paper (section 7 explains why), then predicts from the pooled data.
- Show the bot's prediction after the professor commits to a move, not before.
- Ask: "Did you play randomly?" The rest of the talk tests that question.

## 2. How the matrix is built (45 s)

This step is statistics, not linear algebra, so keep it short. All analysis in the talk uses k = 1: the state is the player's last move.

- Count which move follows each move, then normalize each column. The result is P (3 × 3): columns are the last move, rows are the next move. Smoothing makes every entry positive.
- P is square and maps a state to the next state, so it is a transition matrix.
- The bot's rule is a lookup table: play the move that beats the most likely entry in the current column.
- **Answer "why not just count?" here.** Counting is enough to choose the next move, and we do just count. The linear algebra answers different questions about the counted matrix: is the pattern real, what kind is it, and why does pooled data look random. Section 8 shows cases where counting can't answer at all.

## 3. Steady state: the null space of (P − I) (1 min 30 s)

**Why a steady state always exists.** Each column of P sums to 1, so 1ᵀ P = 1ᵀ and 1ᵀ (P − I) = 0ᵀ. The rows of P − I are linearly dependent, so P − I is singular and a nonzero x with (P − I) x = 0 exists. This matches the rubric example "linear dependence ⇒ Ax = 0".

**What it means in RPS.** Normalize x so 1ᵀ x = 1. x is the long-run frequency of R, P and S: the player's habit. x = [1/3, 1/3, 1/3]ᵀ means no habit.

**Slide.** Show x for the pooled data and the teammate, next to [1/3, 1/3, 1/3]ᵀ. Pooled x = [0.333, 0.331, 0.337]ᵀ (preliminary): no habit.

Illustrative example, not our data. The player

```
[0.50 0.30 0.30]
[0.25 0.40 0.30]
[0.25 0.30 0.40]
```

has x = [0.375, 0.312, 0.312]ᵀ, so they throw Rock about 38% of the time. Even a bot with no memory beats them by favouring Paper.

## 4. Eigenvalues: is the pattern real? (2 min)

**What the eigenvalues say.**

- One eigenvalue is always λ₁ = 1, the steady state. Every entry of P is positive, so the other eigenvalues satisfy |λ| < 1 (Perron–Frobenius).
- When P can be diagonalized, P^n = V D^n V⁻¹. As n grows, P^n approaches x 1ᵀ at rate |λ₂|^n.
- **Size |λ|:** how long a move keeps influencing future play. Near 0 means no memory.
- **Real and positive:** stuck in a rut. The example in section 3 has λ = 1, 0.2, 0.1, a weak rut that fades fast.
- **Complex pair:** cycling through moves. Illustrative example, not our data. A player who tends to go R→P→S,

  ```
  [0.20 0.35 0.45]
  [0.45 0.20 0.35]
  [0.35 0.45 0.20]
  ```

  has λ = −0.2 ± 0.087i, |λ| = 0.218. The closer the angle gets to ±120°, the cleaner the cycle.

**The baseline that can't be beaten.**

- A uniformly random player has P = (1/3) 1 1ᵀ. It has rank 1, eigenvalues 1, 0, 0 and no memory, and its steady state is uniform. It is the Nash equilibrium.
- Eigenvalues alone don't show that a player can't be beaten. A player whose every column is [0.5, 0.25, 0.25]ᵀ also has rank 1 and eigenvalues 1, 0, 0. They have no memory, but they throw Rock half the time, so Paper beats them.
- A player can't be beaten only if both tests pass. Eigenvalues 1, 0, 0 mean no memory. x = [1/3, 1/3, 1/3]ᵀ means no habit (section 3). A player can be exploited to the extent their P differs from (1/3) 1 1ᵀ.

**The noise floor.** A truly random player's estimated P is never exactly (1/3) 1 1ᵀ, so |λ₂| is never exactly 0. Simulated random players, smoothed the same way as P (preliminary):

| Rounds | \|λ₂\| median | \|λ₂\| 95th percentile | Largest gap between x and 1/3, 95th percentile |
|---|---|---|---|
| 25 | 0.185 | 0.353 | 0.153 |
| 50 | 0.151 | 0.288 | 0.132 |
| 100 | 0.113 | 0.225 | 0.102 |
| 300 | 0.070 | 0.138 | 0.063 |

A pattern is real only if it clears the 95th percentile for that many rounds. At 25 rounds even a typical real player can't be told apart from random, which is why we use the teammate, not the professor.

**Slide.** Plot the eigenvalues on the complex plane for the pooled data and the teammate, with the random player's eigenvalues (1, 0, 0) as reference. Shade the noise floor for the teammate's number of rounds.

## 5. Pooling hides the pattern (1 min)

This section is the main finding.

- **Pooled:** λ = 1, 0.045, −0.014 and x ≈ [1/3, 1/3, 1/3]ᵀ. k = 1 predicts 34.97% on `test_pooled`, against 33.3% for a random guess. Pooled, humans look random.
- **Per person** (188 players with at least 50 rounds, median 299 rounds; preliminary): median |λ₂| is 0.19. Shuffling each player's own moves gives 0.07. For 91% of players the real order beats the shuffled order.
- **Why pooling hides it.** Each column of the pooled P is a weighted average of the players' columns. Players pull in different directions, so the average moves toward (1/3) 1 1ᵀ. The eigenvalues of an average are not the average of the eigenvalues.
- **What this means for prediction.** Fitting k = 1 on a player's first half and scoring on their second half gives 42% median and 44% mean (preliminary). The pooled k = 1 matrix gives 35%. The pattern pays off only when the matrix belongs to the person.

## 6. k-Markov: looking further back (1 min 15 s)

This section is the extension. The analysis in sections 3 to 5 stays at k = 1. This section shows that the same analysis still covers a player with a longer memory.

**The idea.** A player may react to more than their last move, e.g. "never three of the same in a row". A k-Markov chain conditions on the last k moves.

**Counting gives a next-move matrix, not a transition matrix.** Counting the move that follows each k-move history gives a 3 × 3^k matrix. Columns are histories, rows are the next move. It isn't square, so it isn't a transition matrix. Only k = 1 is square.

**State augmentation (the linear algebra).** Treat the whole history as one state. The chain becomes a linear map x_{t+1} = T x_t on ℝ^{3^k}, with T of size 3^k × 3^k. This is the same idea as rewriting Fibonacci as a first-order matrix system:

```
[F_{n+1}]   [1 1] [F_n    ]
[F_n    ] = [1 0] [F_{n−1}]
```

**Slide: the same numbers, arranged two ways (k = 2).** From history `RP`, the next history drops the R and appends the new move, so it can only be `PR`, `PP` or `PS`. Column `RP` of the 9 × 9 matrix T holds the 3 entries of column `RP` of the 3 × 9 matrix, and its other 6 entries are 0. T is sparse, with 3 nonzero entries per column. The shift fixes where the nonzeros go; the data gives their values.

**Payoff.** T is a square transition matrix, so the steady state and eigenvalue analysis of sections 3 and 4 apply to it without change. Its steady state would give the long-run frequencies of k-move patterns. We don't compute it: the k = 1 analysis already shows what the tools say, and T for k = 2 is 9 × 9.

- Squareness is not a restriction of the method. Augmentation turns any finite memory into a square matrix. The real cost is size: 3^k states.
- One condition changes. T is sparse, so smoothing does not make every entry positive. Every entry of T^k is positive, because any history can reach any other in k moves. T is primitive, and Perron–Frobenius still applies.

**Why look further back.** One line on the slide, no table: k = 2 predicts better than k = 1 on `test_pooled` (43.03% vs 34.97%, random guess 33.3%), and k = 3 adds almost nothing (43.34%) (preliminary). A small |λ₂| at k = 1 does not mean older moves are irrelevant: it only describes the k = 1 model. The k = 2 jump shows people do react to two moves back. A larger k needs exponentially more data and overfits. Keep the details for Q&A.

## 7. Short games: opening, fade and who wins (1 min 30 s)

Most real RPS is a short game, like the demo's best of 3. A short game never reaches the steady state, so what matters is the opening and how fast it fades.

**Opening.** x₀ is the round-1 distribution. Across 188 players (preliminary):

| Round | R | P | S |
|---|---|---|---|
| 1 | 43% | 38% | 19% |
| 2 | 38% | 30% | 32% |
| 3 | 30% | 37% | 34% |
| 5 | 29% | 36% | 36% |

People rarely open with Scissors. Paper in round 1 wins 43%, ties 38% and loses only 19%. That is why the demo bot opens with Paper. Round 1 has only n = 180, so each percentage is ± about 7%, but Scissors at 19% is still clearly below 33%.

**Fade.** x_t = P^t x₀. The part of x_t that differs from x shrinks like |λ₂|^t, so the eigenvalues explain why the opening bias disappears. In the data it is gone by about round 3. This explains the data; it is not a significance claim. In live play you see every move, so you never need to predict several rounds ahead.

**Limitation.** The pooled P does not fully predict the opening rounds: P x₀ gives R ≈ 34% in round 2, but the data shows 38%. People play differently early in a game than in the middle, so the chain is not stationary. Say this outright.

**Who wins the game (absorbing chain).**

- For best of 3 (first to 2), the transient states are the scores (a, b) with a, b ∈ {0, 1}: 4 states. The absorbing states are "bot wins" and "bot loses". A tie keeps the score unchanged, so it is a self-loop.
- Per-round win, tie and loss rates come from the opening rates and the pooled evaluation.
- Q is the transient block. N = (I − Q)⁻¹ = I + Q + Q² + … (a Neumann series). The series converges because the spectral radius of Q is less than 1.
- 1ᵀ N gives the expected number of rounds. B = R N gives the bot's probability of winning the game. The order is R N, not N R, because the columns of P sum to 1: P = [Q 0; R I].
- This assumes the per-round rates stay the same every round. In reality the bot's edge depends on the history and fades after the opening, so say that this is a simplification.
- In RPS terms: B turns a per-round edge into the chance of winning the whole game.

## 8. Significance and close (1 min 15 s)

- **The answer to the framing question.** Pooled, human play looks random. Per person, it isn't, and the linear algebra shows how much and of what kind.
- **Be honest about RPS.** RPS doesn't need linear algebra to pick the next move. It is small enough to check every step by hand, which is why we used it to show the tools. The same tools matter when the matrix is too big to read or the question can't be answered by counting.
- **Where counting can't answer.** Pick one or two for the slide:
  - **The long run.** From one-step customer switching rates between brands, the steady state x gives long-run market share. Nobody can count the future.
  - **No data, only rules.** In a board game like Monopoly, the dice and cards define P. x gives how often each square is landed on, without simulating thousands of games.
  - **Too big to read.** Testing whether a random number generator or human-chosen PINs are really random uses the same "|λ₂| against the noise floor" test, on matrices far bigger than 3 × 3.
- **Benefits:** exact answers in closed form (one null-space solve gives x, one inverse gives B, no simulation), cheap to compute, interpretable (you can read the matrix and its eigenvalues), and the tools scale unchanged to longer memory (T) and bigger chains.
- **Limits:** a person's matrix needs about 100 rounds to clear the noise floor. The state space grows as 3^k. Early-game play is not stationary. An opponent who knows the model can exploit it back.
- **Close:** compare the demo result with the game-win probability B from section 7.

## Q&A prep

Split these so each member owns some. The rubric grades whether all members answer equally.

- Why not just count: for picking the next move, we do. The linear algebra answers questions about the counted matrix (is the pattern real, what kind, why pooled data looks random), and gives exact answers where counting can't (long run, no data, too big).

- Why columns sum to 1 here, when some sources have rows summing to 1. Their matrix is Pᵀ, and the steady state becomes a left eigenvector. The content is the same.
- When the steady state is unique: the chain must be irreducible. When P^n converges to it: the chain must also be aperiodic. Smoothing guarantees both, because every entry of P is positive (Perron–Frobenius).
- What if P can't be diagonalized: the Jordan form gives the same limit, and the convergence rate is still set by |λ₂|.
- Why we dropped the outcome from the state: it added no accuracy and made the matrix 3^k times larger.
- How the noise floor was computed: simulate random players with the same number of rounds and the same smoothing, then take percentiles of |λ₂|.
- Why the teammate and not the professor: fewer than about 100 rounds is below the noise floor.
- Whether the teammate's data is biased: they played before knowing what we would look for. One person is an example, not a study; the 188-player result is the evidence.
- Why the shuffle test works: shuffling keeps a player's move frequencies but destroys the order, so any drop in |λ₂| comes from the order.
- Why pooled play looks random when individuals aren't: each pooled column is a weighted average of the players' columns, and different patterns cancel.
- Why the counted k-Markov matrix (3 × 3^k) isn't a transition matrix, and how T (3^k × 3^k) is built from it.
- Why the analysis uses only k = 1, when k = 2 predicts better: T works with the same tools, but 9 eigenvalues are harder to read than 3.
- Whether the k = 1 to k = 2 gain is real, and whether k = 2 to k = 3 is only noise: run a test on the test-set accuracy against the 33% baseline and against the smaller k.
- How k was chosen, and why not just use the largest k.
- Why a random player can't be beaten.
- How unseen states are handled: smoothing gives a uniform column.
- Why the opening bias exists and why it fades.
- Why N = (I − Q)⁻¹ counts expected visits: entry (i, j) of Q^n is the probability of being in transient state i after n rounds, starting from j. Summing over n gives I + Q + Q² + …, which is N. Only the ordinary Markov property is needed, not the strong one.
- How an opponent could exploit the bot.

## Is linear algebra significant for RPS?

This section is for the team, not the slides. It records the honest answer to "why not just count?" and the case for keeping RPS or changing the application.

### What linear algebra answers about one person

For one person, the linear algebra turns the 9 counted numbers in P into a short description: is there a pattern, what kind, is it real, and what is it worth. It does not predict better than the counted table. Prediction still comes from counting.

| Question about the person | Tool | Could counting answer it directly? |
|---|---|---|
| Do they favour one move overall? | x, the null space of P − I | Yes. x comes out almost exactly equal to the raw move frequencies (pooled: both [0.333, 0.331, 0.337]). Linear algebra adds little here. |
| Does their last move affect their next one? | \|λ₂\| | Partly. You would compare 9 numbers by eye; \|λ₂\| is one score, from 0 (no memory) towards 1 (strong memory). |
| What kind of pattern is it? | The type of λ₂: real and positive means they repeat (a rut); real and negative means they avoid repeating; a complex pair means they cycle, R→P→S or the reverse | Not easily. This is the main thing eigenvalues add. |
| Is the pattern real, or luck? | \|λ₂\| against the noise floor for their number of rounds | No. Counting always shows some pattern, even for a random player. |
| What rule could a human remember? | Read the rule off the type of λ₂ | Only by eyeballing the 9 numbers. |
| What is the edge worth over a best of 3? | B = R N | No, not without simulating many games. |

**The teammate slide in four steps.** Is there a pattern (\|λ₂\| against the noise floor)? What kind (the type of λ₂)? What rule follows? What is it worth (B)?

Illustrative example, not our data: in 100 rounds the teammate has λ₂ = −0.25 ± 0.20i, so \|λ₂\| = 0.32. That is above the noise floor of 0.225 at 100 rounds, so the pattern is real. A complex pair means they cycle. The rule is to play what beats the move after their last one. Over a best of 3, that edge gives B = 0.6.

If the teammate's \|λ₂\| is below the noise floor, the answer is "no real memory pattern; at most a habit". That is a valid result too.

**The honest limit.** For one person, linear algebra is a compression and a diagnosis, not a better predictor. The fade (\|λ₂\|^t) also doesn't matter in live play, because you see every move.

### Why it's okay to keep RPS

- Nearly done: the data, the code, the matrices and the preliminary numbers already exist.
- Original: our own data, analysis and finding. The rubric rewards this over rehashing a standard example.
- One real finding: pooled play looks random (\|λ₂\| = 0.045), but for 91% of players the real move order beats a shuffle of their own moves. Averaging matrices explains why.
- Small enough to explain clearly: every concept fits on a slide in a 3 × 3 matrix and can be checked by hand.
- Covers the whole toolkit: the null space, eigenvalues, the noise floor, augmentation and absorbing chains. It hits the rubric example "linear dependence ⇒ Ax = 0".
- Engaging: the live demo and a familiar game help with peer evaluation.
- We understand it well, which makes Q&A easier to defend.

### Why we should change

- "Why not just count?" has no strong answer: counting alone picks the next move, so the linear algebra only answers side questions.
- The significance is borrowed: section 8 claims it from other domains instead of showing it in RPS. The rubric's "Excellent" band says "convincingly demonstrated".
- The results are small: on pooled data, \|λ₂\| is about 0, x is about uniform, and accuracy is 35% against 33%.
- Monopoly fixes this. The dice and cards define P, so there is nothing to count. The steady state x drives a real decision: which properties to buy, judged by x times rent divided by price.

### Decision

| | Keep RPS | Pivot to Monopoly |
|---|---|---|
| Time needed | Low | 2 to 3 weeks |
| Originality | High | Medium; it's a well-known example |
| Significance | Claimed | Shown |
| "Why not just count?" | Answered upfront, but still weak | Doesn't come up |
| Risk in Q&A | Low | Higher if learned in a hurry |

Pivot if the team has at least 2 to 3 weeks before Week 13 and is unconvinced by RPS. Otherwise keep RPS: the outline above answers the weak spot honestly.
