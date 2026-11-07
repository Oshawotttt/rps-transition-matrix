# Presentation outline: what to teach before the demo

The demo comes last, as the worked example. Everything it shows must already have been explained, so nothing on screen is new to the audience.

This file lists what the game shows and the concepts that requires. Sections 2 and 3 are in teaching order: each item relies only on items above it.

- **Core:** the audience needs it to follow the demo. It goes in the talk.
- **Q&A:** it appears only in an edge case, or it answers a likely question. Keep it as backup.

Example numbers come from the pooled bot, `web/public/bots/bot_rps_human_combined.json` (shown in the game as "Humanity"). They change with the bot.

## 1. What the game shows

Code: `web/src/RoundReport.jsx`, `web/src/Panels.jsx`, `web/src/LookAhead.jsx`. All numbers are computed in advance by `src/rps_markov/bot.py`, and no matrix changes during a match.

| Where | What is on screen | Concepts it needs |
|---|---|---|
| Lobby, guest phone, tally, win screen | Bot choice, throw buttons, one bar chart of q per round, podium | No new concepts. The tally reuses q. |
| This round: Predict, round 1 | q₀ = P π, with P (3 × 9) and π (9 entries) written out | Matrix times vector, weighted average of columns, steady state |
| This round: Predict, round 2 | q = P x, with x one-hot | One-hot vector picks out a column, so the step is a lookup |
| This round: Predict, round 3 onward | Column x of P highlighted | Same as round 2 |
| This round: Score | A q, plus win and lose bars for each of our moves | Row times vector, expected value, payoff matrix |
| This round: Choose | Class picks the largest entry of A q; a note appears when this differs from countering their likeliest move | Maximum of expected score; ties go to R, then P, then S |
| This round: Result | New state, e.g. PL | The state is the human's move plus their outcome |
| Long run: How M is built | P, A, S = A P, B, then one column of P dropped into M | Matrix times matrix, shape rule, one-hot matrix, policy |
| Long run: the 9 × 9 matrix | M as a grid, 3 nonzero entries per column, each column summing to 1 | Square stochastic matrix, Markov chain |
| Long run: Eigenvalues | det(M − λI) = 0, all 9 eigenvalues with \|λ\|, rounds until the start fades below 10% | Eigenvalues, characteristic equation, complex eigenvalues, modulus, \|λ₂\| |
| Long run: Steady state | π as bars, win, lose and tie rates, our edge, transient states | Eigenvector for λ = 1, normalising, transient states, long-run rates |
| Long run: fallback banner (edge case) | Eigenvalue 1 repeated, or a cycle; closed groups and their rates | Multiplicity, closed groups, periodic chains |
| Look ahead: The formula | x = Σ c v, M v = λ v, Mᵗ x = Σ c λᵗ v | Basis of eigenvectors, linear combination, matrix powers |
| Look ahead: With the numbers | First 3 terms of the sum with real data, stepping through t | Coordinates c, λᵗ shrinking, c₁v₁ = π |
| Look ahead: The answer | Mᵗ x as bars against π; the bot's move from that distribution | Convergence to π, q = P Mᵗ x |

The 3 × 3 matrix is on screen only in the fallback, and no shipped bot triggers the fallback. In the talk it is the small example for teaching eigenvalues and the steady state, not a demo step.

## 2. Linear algebra concepts

### Vectors and matrix multiplication

| # | Concept | What to explain | Where in the game | Level |
|---|---|---|---|---|
| 1 | Probability vector | Entries are at least 0 and sum to 1 | q, π, Mᵗ x | Core |
| 2 | Matrix shape and labels | m × n; rows and columns have meanings | P 3 × 9, A 3 × 3, S 3 × 9, B 3 × 9, M 9 × 9 | Core |
| 3 | Matrix times vector, column view | The result is a linear combination of the columns, with the entries of x as weights | q = P x | Core |
| 4 | Standard basis (one-hot) vector | P eⱼ is column j, so multiplying is a lookup | Round 2 onward | Core |
| 5 | Weighted average of columns | A probability vector x mixes all the columns | q₀ = P π, q = P Mᵗ x | Core |
| 6 | Matrix times vector, row view | Each entry is a row dotted with the vector. Against probabilities, that is an expected value | A q: Paper's entry is q(R) − q(S) | Core |
| 7 | Matrix times matrix | Shape rule: 3 × 3 times 3 × 9 gives 3 × 9. Column s of A P is A times column s of P | S = A P | Core |
| 8 | Non-square against square | P maps ℝ⁹ to ℝ³, so its output can't be fed back in. It has no powers and no eigenvalues. M maps ℝ⁹ to ℝ⁹ | Why we build M from P | Core |
| 9 | Matrix powers | Mᵗ x is M applied t times | Look ahead | Core |
| 10 | The step that isn't linear | Taking the largest entry is not a linear operation, so M is not a product of A and P. It is assembled from P using B | How M is built | Core |
| 11 | A's zero sums | Rows and columns of A each sum to 0, and A has rank 2. Entries of A q sum to 0, and a uniform q scores 0 for every move, so a uniform player can't be beaten | Every A q on screen | Q&A |

### Null space and eigenvalues

| # | Concept | What to explain | Where in the game | Level |
|---|---|---|---|---|
| 12 | Eigenvalue and eigenvector | M v = λ v: M only stretches v | Look ahead formula | Core |
| 13 | Characteristic equation | det(M − λI) = 0 gives the eigenvalues. For 9 × 9 it has degree 9, so it is solved numerically | Eigenvalues panel | Core |
| 14 | Why λ = 1 always exists | Columns of M sum to 1, so 1ᵀM = 1ᵀ and 1ᵀ(M − I) = 0ᵀ. The rows of M − I are linearly dependent, so M − I is singular | Eigenvalues panel, first entry | Core |
| 15 | Null space | π lies in the null space of M − I | Steady state panel | Core |
| 16 | Free scale of an eigenvector | Any multiple also works, so scale π to sum to 1 | Steady state panel | Core |
| 17 | Modulus and \|λ\| ≤ 1 | Multiplying by a stochastic matrix can't increase the total size of a vector, so no eigenvalue exceeds 1 in modulus | \|λ\| beside each eigenvalue | Core |
| 18 | Complex eigenvalues | A real matrix that isn't symmetric can have them, always in conjugate pairs a ± bi. They rotate while \|λ\| shrinks them. The imaginary parts cancel, so Mᵗ x stays real | Eigenvalues panel; Look ahead for the 4 persona bots (the pooled bot's first 3 terms are all real) | Core |
| 19 | Multiplicity | λ = 1 appearing k times means there is no single steady state | Fallback banner | Q&A |
| 20 | Perron–Frobenius | All entries positive means λ = 1 is single. It holds for the smoothed 3 × 3 but not M, which has 6 zeros per column | Why the fallback is safe | Q&A |

### Eigenvector basis and the long run

| # | Concept | What to explain | Where in the game | Level |
|---|---|---|---|---|
| 21 | Linear independence and basis | 9 independent eigenvectors form a basis of ℝ⁹, so any x is a combination of them | x = c₁v₁ + … + c₉v₉ | Core |
| 22 | Coordinates in a basis | The weights come from solving V c = x, where the columns of V are the eigenvectors | Weights c in Look ahead | Core |
| 23 | Powers through eigenvalues | Mᵗ x = Σ cₖ λₖᵗ vₖ. Same thing as M = V D V⁻¹, so Mᵗ = V Dᵗ V⁻¹ | Look ahead formula | Core |
| 24 | Dominant eigenvalue | If \|λ\| < 1 then λᵗ → 0, so only the λ = 1 term survives and Mᵗ x → π | Look ahead bars against π | Core |
| 25 | Why c₁v₁ = π | From 1ᵀM v = λ 1ᵀv, every eigenvector with λ ≠ 1 sums to 0. x sums to 1, so the λ = 1 term must carry all of it: c₁ = 1 | Look ahead formula | Q&A |
| 26 | \|λ₂\| as the rate | The start fades like \|λ₂\|ᵗ; below 10% takes t = ln 0.1 / ln \|λ₂\|, rounded up. Pooled: \|λ₂\| = 0.883 gives 19 rounds | Eigenvalues panel | Core |
| 27 | The rate needs c₂ ≠ 0 | \|λ₂\| only matters if the start has a part along v₂. Pooled from RL: c₂ = 0, settled at t = 3. From RT: \|c₂\| = 0.94, settled at t = 29 | Look ahead, changing the start state | Core |
| 28 | No eigenvector basis | Without 9 independent eigenvectors the formula fails, but Mᵗ x still works by repeated multiplication | Message in Look ahead | Q&A |

### Reading answers off π

| # | Concept | What to explain | Where in the game | Level |
|---|---|---|---|---|
| 29 | Sum over a subset as a dot product | The win rate is π dotted with a vector that has 1 on the states ending in W | Win, lose and tie rates | Core |
| 30 | Grouping the states | Let G be the 3 × 9 matrix that adds up the states of each move. Then G M = P, so P π = G M π = G π: q₀ is π summed per move | q₀ in round 1 | Q&A |

## 3. Markov chain concepts

| # | Concept | What to explain | Where in the game | Level |
|---|---|---|---|---|
| 1 | State and time step | A round is one step. The state is the human's move plus their outcome from the human's side, so RL means they played Rock and lost. 9 states | x = RL in the header | Core |
| 2 | Markov property | The next state depends only on the current state, not on earlier history. Here it is a modelling assumption about a person, not a fact | Bot needs only the last state | Core |
| 3 | Choosing the state | What counts as "current" is our choice. Going from 3 to 9 states lets the model see outcomes. The match score is not in the state, so the bot ignores it | 3 × 3 to 3 × 9 | Core |
| 4 | Time-homogeneous chain | The same probabilities apply every round. P is fixed before the match and not updated | "Fixed before the match" | Core |
| 5 | Estimating transition probabilities | Count what followed each state, then normalise each column. Smoothing (α = 1) adds 1 to every count, so an unseen state gets a uniform column | Where P comes from | Core |
| 6 | Column-stochastic convention | Columns are "from", rows are "to", each column sums to 1, and a step is xₜ₊₁ = M xₜ. Some sources use rows instead and get the transpose | M grid | Core |
| 7 | Distribution over states | One-hot x means we know the state. A spread-out x means we only know the chances | x against π and Mᵗ x | Core |
| 8 | Next-move table against chain | P gives the next move, not the next state, so it can't be iterated | P against M | Core |
| 9 | Policy closes the loop | The next state's outcome depends on the bot's move. Fixing one bot move per state (B) turns P into the chain M, so M belongs to this human against this bot | How M is built | Core |
| 10 | Multi-step transition | Mᵗ gives the probabilities t rounds ahead, and it is still stochastic. Mˢ⁺ᵗ = Mˢ Mᵗ is the Chapman–Kolmogorov equation | Look ahead | Core; name it only in Q&A |
| 11 | Steady state | π = M π: a distribution one more step leaves unchanged. It is the long-run share of rounds spent in each state | Steady state panel | Core |
| 12 | Why π can't just be counted | This human hasn't played this bot, so no such games exist. π predicts them from M | Steady state panel | Core |
| 13 | Long-run rates and edge | Win, lose and tie rates sum π by outcome. Edge = lose rate − win rate, the bot's expected score per round. Pooled: 0.318, 0.356, 0.326, edge 0.038 | Rates under π | Core |
| 14 | Convergence | From any start, Mᵗ x → π when λ = 1 is single and no other \|λ\| = 1 | Look ahead | Core |
| 15 | Transient states | States the chain eventually leaves for good, so π = 0 there. Pooled: RW, RT, PW, PL, SL, ST | Under the π chart | Core |
| 16 | Closed groups | A set of states the chain never leaves. Pooled: RL, PT, SW, because the bot plays Paper in all three and every reply stays inside | Pooled π is nonzero only there | Core |
| 17 | Reducible chains | Several closed groups means λ = 1 repeats, once per group, and the long run depends on the start | Fallback banner | Q&A |
| 18 | Periodic chains | An eigenvalue with \|λ\| = 1 and λ ≠ 1, such as −1. π is unique but Mᵗ x cycles and never settles | Fallback banner | Q&A |
| 19 | Long run against a short match | A best of 3 never reaches the long run. π is the average over many rounds, not a forecast for this match. Round 1 is itself not the long run: we use π there because it is the only prediction the matrices give without a state | Round 1, match length | Core |
| 20 | Limits of the model | A human can adapt to the bot, which breaks properties 2 and 4. P comes from training games against other opponents, not against this bot | Closing the talk, Q&A | Core |

## 4. Not in the game, so not needed

- SVD and least squares: nothing in the code or on screen uses them.
- Absorbing chains and match win probability: removed from the bot and the frontend.
- k-Markov chains with k > 1: everything is k = 1.
