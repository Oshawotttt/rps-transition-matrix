## 1. Intro and Markov basics

- A brief overview of Markov matrices: column-stochastic, so each column sums to 1 and a step is x_{t+1} = P x_t.
- The Markov property: the next state depends only on the current state, not on the full history.

## 2. Application: rock-paper-scissors

Move to RPS as the worked example. It is familiar to everyone and small enough to follow by hand.

### 2.1 The 3 × 3 matrix: last move → next move

**Eigenvalues show whether the human has a pattern.**

- Define the term once, on this slide: "By pattern I mean how the next move depends on what just happened." The wording still fits in 2.2, where "what just happened" grows to the last move plus its outcome.
- One eigenvalue is always 1. The others measure how much the last move affects the next one.
- Low eigenvalues mean the last move barely matters: in practice, the player is random.
- **Pooled data is very close to no pattern.** The eigenvalues are 1, 0.045 and −0.017 (preliminary), so pooled human play looks random.
- **Training on our friend shows a pattern.** Their eigenvalues: to fill in once they have played their rounds.

**The steady state shows the player's habit.**

- Call this the habit (or favourite move), never a pattern, so "pattern" keeps the single meaning defined above.

- The steady state π solves (P − I) π = 0, normalised so its entries sum to 1. It is the eigenvector for eigenvalue 1.
- π is the long-run frequency of each move: the player's habit. π = [1/3, 1/3, 1/3]ᵀ means no habit.
- Pooled: π = [0.333, 0.330, 0.337]ᵀ (preliminary), so no habit.
- Our friend: π to fill in.
- Address the obvious objection head-on. Suggested line: "Here π is just how often they throw each move, and we could get that by counting. That's because we already have the games this matrix describes. The steady state earns its place when we don't: in 2.3 we'll build the matrix for our friend playing our bot, before they've played it, and π will predict how often the bot wins."

**Optional: why π matches the move frequencies.** Use if time allows, or keep for Q&A.

- Let u_t be the unconditional distribution of the move at round t: u_t(j) = P(X_t = j).
- The law of total probability gives P(X_{t+1} = i) = Σⱼ P(X_{t+1} = i | X_t = j) P(X_t = j), which in matrix form is u_{t+1} = P u_t.
- If u is the same every round, then u = P u, so u is the eigenvector for eigenvalue 1: the unconditional probabilities are the steady state.
- If u changes over time, there is a different unconditional distribution each round, u_t = Pᵗ u₀, and the steady state is where they head: Pᵗ u₀ → π as t → ∞, provided |λ₂| < 1.
- In our data u₀ is round 1, which is Rock-heavy at [0.43, 0.38, 0.19]ᵀ (preliminary), so the early rounds differ from π. The move frequency over a game of T rounds is the average (1/T) Σₜ u_t, which tends to π as T grows. Over 300 rounds the early rounds barely count, so π and the raw frequencies agree to 3 decimal places: [0.333, 0.330, 0.337]ᵀ against [0.333, 0.330, 0.337]ᵀ (preliminary).

### 2.2 The 3 × 9 matrix: last move and outcome → next move

**Transition.** Research says a player's own move is not enough to predict them: their opponent's move matters too. Given the player's own move, the opponent's move and the outcome (win, lose or tie) carry the same information, so we add the outcome to the state.

- The state becomes the player's last move plus its outcome: 9 states, e.g. RL (played Rock and lost).
- The matrix is 3 × 9: columns are the 9 states, rows are the next move.

**The payoff matrix picks the bot's best move.**

- The column for the current state is the predicted distribution q of the human's next move.
- The payoff matrix A gives +1 for a win, 0 for a tie and −1 for a loss. Each entry of A q is the expected score of one bot move.
- The bot plays the move with the highest expected score. This can differ from simply countering the most likely move.

### 2.3 The 9 × 9 matrix: human against our bot

- Combine the 3 × 9 matrix with the bot's choice from the payoff matrix in each state.
- In each state the bot's move is fixed, so each of the human's 3 possible next moves leads to exactly one next state. Each column of the 9 × 9 matrix has 3 nonzero entries, the human's probabilities, and they sum to 1.
- The result is a square transition matrix from state to state for this human playing this bot.
- Its steady state gives the long-run share of each state, and each state includes the outcome, so it predicts the long-run win, loss and tie rates. These can't be counted, because this human hasn't played this bot yet. This is the payoff promised in 2.1.
- The steady state is only defined when eigenvalue 1 appears once. If the chain splits into separate parts (e.g. states RT, PW, SL all make the bot play R while RW, PL, ST all make it play S), the code raises an error instead of returning an arbitrary π.

### 2.4 Demo

Our friend plays the bot live. The game's frontend shows the bot's computation each round, using the 3 × 9 matrix P and the payoff matrix A. Both are fixed before the game and are not updated during it. The 9 × 9 matrix (2.3) is used only in round 1 and in the long-run panels.

Every round runs the same three steps: predict q = P x, score A q, choose the best move. Only x changes. In round 1, x is the steady state π of the 9 × 9 matrix. In every later round, x is the one-hot vector for the state just played.

The payoff matrix A, shown on screen every round. Rows are the bot's move, columns are the human's move, and each entry is the bot's score.

| | Human R | Human P | Human S |
|---|---|---|---|
| **Bot R** | 0 | −1 | +1 |
| **Bot P** | +1 | 0 | −1 |
| **Bot S** | −1 | +1 | 0 |

**Round 1: predict from the steady state.**

There is no last move yet, so there is no state to look up. The bot uses the long run instead. Show these steps:

1. **The 9 × 9 matrix** for our friend against this bot, built before the game. Show it as a grid with 3 nonzero entries per column.
2. **Its eigenvalues.** State the equation det(M − λI) = 0, where M is the 9 × 9 matrix. Say it is solved numerically: a degree-9 polynomial is not done by hand. List all 9 eigenvalues, sorted by modulus, with |λ| beside each. Highlight λ = 1 and λ₂. λ₂ sets how fast the starting state stops mattering: its effect shrinks like |λ₂|ᵗ.
3. **The eigenvector for λ = 1**, scaled so its entries sum to 1. This is π, the long-run share of each of the 9 states. Point out any zero entries: those states are transient, and the long run never returns to them. Show π as a bar chart of the 9 states, coloured by outcome (W, L, T). Label it with three summaries, so no separate panel is needed:
   - **Long-run win, loss and tie rates:** π summed over the states ending in W, L and T, from the human's side. This is the payoff promised in 2.1: a number that can't be counted, because this human hasn't played this bot yet.
   - **The bot's long-run edge per round:** the human's loss rate minus their win rate. Over N rounds, the bot expects to be ahead by N times the edge.
   - Pooled: the human wins 0.318, loses 0.356 and ties 0.326, so the edge is 0.038.
4. **Collapse π to a move prediction: q₀ = P π.** A needs the probability of each human move, a 3-vector, but π has 9 entries. q₀ = P π gives that 3-vector, and it equals π summed over the 3 outcomes of each move. It is the same step as every later round, with π in place of the one-hot x. A one-hot x picks one column of P; π takes a weighted average of all 9 columns.
5. **Score: A q₀.** The expected score of each bot move.
6. **Choose.** The bot plays the move with the highest score.

Worked example on the pooled data (our friend's numbers will differ):

- The eigenvalues by modulus are 1, 0.883, 0.142, 0.038 (a complex pair, 0.015 ± 0.035i), 0.009, 0.007, 0.003 and 0. λ₂ = 0.883 is close to 1, so the starting state takes about 19 rounds to fall below 10% influence.
- π is 0 everywhere except RL = 0.356, PT = 0.326 and SW = 0.318. In all three of those states the bot plays Paper, and every human reply leads back into one of them. In the long run, the bot always plays Paper.
- q₀ = [0.356, 0.326, 0.318]ᵀ, so A q₀ = [−0.008, 0.038, −0.030]ᵀ and the bot opens with Paper.

Be honest about one limit: round 1 is the start of the game, not the long run. The real first-move distribution u₀ (Rock-heavy, see 2.1) is the better round-1 predictor. Here it gives the same answer, Paper. We use π because it is the only prediction the matrices give without a state, and it shows the eigenvector doing real work.

**Complex eigenvalues.** M is not symmetric, so some eigenvalues can be complex. They always come in conjugate pairs, a ± bi.

- They don't affect the steady state. λ = 1 is always real, and its eigenvector can always be scaled to a real vector.
- A complex pair means part of the chain rotates through states, like a cycle R → P → S, while it decays. |λ| is the decay rate per round, so show a ± bi with |λ| beside it.
- Don't show the complex eigenvectors. They don't feed the bot's decision.

**Eigenvalue 1 more than once.** This means the chain splits into separate closed groups of states (example in 2.3). Each group has its own steady state, so the long run depends on where the game starts, and no single π exists. The code raises an error. The frontend should then:

- Show a banner: "Eigenvalue 1 appears k times, so the chain splits into k closed groups. There is no single steady state."
- Fall back to the 3 × 3 matrix's steady state for q₀. Smoothing makes every entry of the 3 × 3 matrix positive, so its λ = 1 appears once (Perron–Frobenius).
- Optionally, list each group's states and the win rate within each group.

A related edge case: an eigenvalue other than 1 with |λ| = 1, such as −1. Then π is still unique, but the chain cycles and Mᵗ u₀ never settles. π is still the long-run share of each state averaged over rounds. The code checks for this case (`has_unit_cycle`), and the bot then falls back to the 3 × 3 steady state for round 1, like the repeated-eigenvalue case. Show a note if it happens.

**Each round after that: look up, score, choose.**

1. **Look up: q = P x.** x is the current state as a one-hot vector: 1 for the state just played (e.g. RL), 0 for the other 8. Show the full multiplication once, then shorten it. The result is the 3 × 1 vector q, the probability of each of the human's next moves. Point out that q is exactly column RL of P: multiplying by a one-hot vector picks out a column, so this step is a lookup.
2. **Score: A q.** Show A (table above) multiplying q. Each entry is the expected score of one bot move: the chance it wins minus the chance it loses, its "weighted points". For example, the Paper row gives q(R) − q(S).
3. **Choose: the largest entry of A q.** If two entries tie, the bot takes the first in the order R, P, S. Flag the rounds where this differs from countering the most likely move.

**Visuals between steps.** Each step shows its matrix or vector, then a chart of what it means. Round 1 uses the same charts, with q₀ in place of q.

- **After the lookup:** a bar chart of q, with 3 bars for the human's chance of throwing R, P and S.
- **After the score:** a stacked bar for each of the 3 bot moves, split into the bot's chance of winning, tying and losing. Each split is read straight off q. For example, if the bot plays Paper, it wins with q(R), ties with q(P) and loses with q(S). Mark A q on each bar: it is the win share minus the loss share.
- **After the choice:** highlight the chosen move's bar. Its win, tie and loss split is the bot's confidence for this round.

**Other panels.** Use these if time allows, or keep them for Q&A. The long-run win, loss and tie rates and the bot's edge are not separate panels: they are labels on the π chart (round 1, step 3).

- **Live tally: one prediction chart per round.** Keep a row of small charts, one per round played. Each shows that round's q as 3 bars. The human's actual move is green and the other two are red. The row shows at a glance how much probability the bot gave to what really happened. Visual only: no accuracy statistic.
- **Expected score against actual score.** Each entry of A q is the bot's expected score if it plays that move. The bot plays one move, the largest entry, so that entry is its expected score this round. Add it up over the rounds to get the expected score difference so far (bot round wins minus human round wins). Plot that running total against the actual score difference.
- **The bot's policy table, built by one matrix product.** This is what turns the 3 × 9 matrix into the 9 × 9 matrix.
  1. **Score every state at once: S = A P.** A is 3 × 3 and P is 3 × 9, so S is 3 × 9. Column s of S is A q for state s: the expected score of each bot move in that state. It is the per-round score step done for all 9 states in one product.
  2. **Pick the largest entry in each column.** That is the bot's move in that state. Highlight it in S.
  3. **Write the choice as a 3 × 9 one-hot matrix B.** Column s has a 1 in the row of the bot's move in state s and 0 elsewhere. B and P together fix every entry of the 9 × 9 matrix.
  - Pooled S (rows bot R, P, S; columns RW, RL, RT, PW, PL, PT, SW, SL, ST):

    | | RW | RL | RT | PW | PL | PT | SW | SL | ST |
    |---|---|---|---|---|---|---|---|---|---|
    | **Bot R** | −0.060 | −0.032 | **0.042** | **0.047** | **0.042** | 0.004 | 0.007 | 0.012 | 0.000 |
    | **Bot P** | **0.058** | **0.049** | 0.039 | −0.074 | −0.039 | **0.034** | **0.028** | −0.078 | −0.052 |
    | **Bot S** | 0.003 | −0.018 | −0.081 | 0.027 | −0.003 | −0.038 | −0.035 | **0.065** | **0.053** |

  - Policy: RW P, RL P, RT R, PW R, PL R, PT P, SW P, SL S, ST S. RT is close: R scores 0.042 and P scores 0.039.
- **The habit against this bot versus the habit in training.** Compare q₀ = P π with the 3 × 3 steady state. Pooled: [0.356, 0.326, 0.318]ᵀ against [0.333, 0.330, 0.337]ᵀ. They differ because the bot changes which states the human visits, which changes how often they throw each move.
- **Looking ahead t rounds.** Start from x, the one-hot vector for the current state. Show M x, M² x, M³ x and so on as an animated bar chart of the 9 states, with a counter for t. Each step is one more matrix product. Stop when the bars stop changing: when the total change from one step to the next, the sum of the absolute differences of the 9 entries, falls below 0.01. Show the t it stopped at, next to π. The bars approach π at the rate |λ₂|ᵗ, so a |λ₂| near 1 takes more steps, which makes the meaning of λ₂ visible. Cap the animation at 100 steps. If eigenvalue 1 appears more than once, the bars settle on the steady state of the group the current state is in. If some |λ| = 1 with λ ≠ 1, the bars cycle and never settle, and the cap stops the animation.

**Optional panel: match win probability.** Include it only if time allows. The long-run win rate from π is fixed, because P is fixed. The chance that the bot wins this match changes after every round. The match length is a setting: best of 2n − 1, so first to n round wins, with ties replayed. The default is best of 3 (n = 2); best of 5 (n = 3) is the main alternative. It reuses the 9 × 9 matrix M, so no new large matrix is needed.

**Decision: reuse the 9 × 9 matrix, not one large chain.** The textbook method is one absorbing chain whose states are the score plus the last token. First to n has 9n² + 1 transient states (n² scores × 9 tokens, plus the start state) and 2 absorbing states (human wins the match, bot wins the match). For best of 3 that is a 39 × 39 matrix with Q 37 × 37, and for best of 5 an 84 × 84 matrix with Q 82 × 82. F = (I − Q)⁻¹. We use the 9 × 9 method below instead, for three reasons:

- The audience has already seen M. Splitting it adds no new matrix to explain.
- It needs one 9 × 9 inverse for any match length, and a 37 × 37 or larger matrix can't be shown on screen.
- The inverse has a one-line explanation. (I − T)⁻¹ = I + T + T² + … is the matrix version of 1 / (1 − t), the geometric series over any number of tied rounds. It converges because every eigenvalue of T has size less than 1.

Both methods give the same answers on the pooled data: 0.541 for best of 3 and 0.552 for best of 5.

1. **Split M by the outcome of the next state.** M = W + L + T. W keeps only the rows for tokens ending in W (the human wins the round), L the rows ending in L, and T the rows ending in T. Each is 9 × 9.
2. **Invert the tie part once.** A tie leaves the score unchanged, so the game can tie any number of times before the score moves. G = (I − T)⁻¹ adds up all those repeated ties. T is the same at every score, so this one 9 × 9 inverse is the only one needed.
3. **Work backwards from the end of the match.** v(h, b) is a row of 9 numbers: the bot's chance of winning the match from each token, when the human has h wins and the bot has b.
   - Boundary: v = all 1s once the bot has n wins, and all 0s once the human has n.
   - Every other score: v(h, b) = [ v(h + 1, b) W + v(h, b + 1) L ] G.
   - Compute from the highest scores down: every v(h, b) with h, b < n, ending at v(0, 0). That is n² rows: 4 for best of 3, 9 for best of 5. For best of 3, the order is v(1, 1), then v(1, 0) and v(0, 1), then v(0, 0).
4. **Round 1.** Before round 1 there is no token, so step 3 doesn't apply directly. The bot plays its round-1 move against q₀. That round ends in a human win, loss or tie with probabilities from q₀. Weight v(1, 0), v(0, 1) and v(0, 0) by those probabilities, using the token each outcome leads to.

**Pooled numbers.** The bot wins a best-of-3 match with probability 0.541 and a best-of-5 match with 0.552. A longer match favours the player with the edge, so the bot's chance rises.

**On screen.**

- Before the game, let the user pick the match length, then show the bot's match win probability from round 1.
- After each round, show the entry of v at the current score and token.
- Plot the history of this value over the match. It is the live number that the long-run rate can't give.
- If time allows, show the v rows as an n² × 9 table, one row per score and one column per token: 4 × 9 for best of 3, 9 × 9 for best of 5.
