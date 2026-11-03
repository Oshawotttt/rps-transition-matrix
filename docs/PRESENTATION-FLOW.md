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

### 2.4 Demo

Our friend plays the bot live. The game's frontend shows the bot's computation each round, using the 3 × 9 matrix P and the payoff matrix A. The 9 × 9 matrix is not used per round: it is for the long run (2.3).

**Round 1.** There is no last move yet, so there is no state. The bot falls back on the steady state π, the long-run frequency of each move, as its prediction.

**Each round after that:**

1. **Predict: P x.** x is the current state as a one-hot vector: 1 for the state just played (e.g. RL), 0 for the other 8. Show the full multiplication. The result is the 3 × 1 vector q, the probability of each of the human's next moves. Point out that q is exactly column RL of P: multiplying by a one-hot vector picks out a column.
2. **Score: A q.** Each entry is the expected score of one bot move: the chance it wins minus the chance it loses, its "weighted points".
3. **Choose.** The bot plays the move with the highest score.
