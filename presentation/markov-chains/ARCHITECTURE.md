# Markov Chains: A Linear Algebra View

## Brief
- **Audience:** CS103 class and professor. Assumed to know eigenvalues and eigenvectors, not Markov chains.
- **Duration:** 10 minutes, followed by 5 minutes of Q&A. About 1,400 spoken words at 140 words per minute.
- **Goal:** Show how eigen-analysis explains a Markov chain's long-run behaviour, and when that analysis stops applying.
- **Language and concision:** Clear and simple. One idea per slide, short phrases on slides, scholarly wording in the notes. Up to 3 diagram-only slides with the words in the notes. Math in LaTeX: bold lowercase vectors, capital matrices, square brackets, no `*`, dot or cross for multiplication.
- **Sources:** `context/linalg_markov/initial-outline.md`, `context/linalg_markov/Project Info & Rubric.pdf`, and Wang, Xu & Zhou (2014), *Scientific Reports* 4:5830, for the win/lose claim.
- **Spec status:** draft

## Sections

### 1. From Markov chain to matrix
- **File:** `spec/markov-chains/chain-to-matrix.md`
- **Status:** in discussion
- **Purpose:** Turn "predict the next move" into matrix multiplication. About 2.5 minutes.
- **Contains:**
  - Rock-Paper-Scissors hook
  - Markov property and state diagram
  - State as a vector, transition as a matrix: $\mathbf{x}_{t+1} = M\mathbf{x}_t$
  - Column-stochastic matrices, the RPS example and the column view
  - Looking ahead: $\mathbf{x}_t = M^t\mathbf{x}_0$
- **Leads into next section:** $M^t$ takes $t$ multiplications and hides where the chain is heading, so we need a better view of it.

### 2. Eigenvalues as the shortcut
- **File:** `spec/markov-chains/eigenvalue-shortcut.md`
- **Status:** in discussion
- **Purpose:** Show that eigenvectors reduce $M^t$ to powers of scalars. About 2 minutes.
- **Contains:**
  - Why repeated multiplication falls short
  - Eigenvalues and eigenvectors of $M$
  - $\mathbf{x}_0$ as a linear combination of eigenvectors
  - Closed form for $\mathbf{x}_t$ and a worked prediction
- **Leads into next section:** The closed form has one term with $\lambda = 1$ and two that shrink. What is left when $t$ is large?

### 3. Steady state: where the chain ends up
- **File:** `spec/markov-chains/steady-state.md`
- **Status:** in discussion
- **Purpose:** Show what eigenvalues reveal about long-run behaviour. The core of the deck. About 3.5 minutes.
- **Contains:**
  - Definition of steady state; why $\lambda = 1$ exists and $|\lambda| \le 1$
  - Convergence from the formula, with eigen-component chart
  - RPS convergence animation
  - Interpretation: 50% Rock, and the link to probability
  - Time average: $\frac{1}{N}\sum_{t=0}^{N-1}\mathbf{x}_t \to \boldsymbol{\pi}$
  - Speed of convergence: $0.6^t$ against $0.3^t$
- **Leads into next section:** All of this rests on the memoryless model. Is that model a good one?

### 4. Is a Markov chain the right model?
- **File:** `spec/markov-chains/model-fit.md`
- **Status:** in discussion
- **Purpose:** Weigh the model's benefits against its costs. About 1.5 minutes.
- **Contains:**
  - Strengths: memoryless is feasible, steady state comes directly from $M$
  - Cost of new states: website tabs, $3 \times 3$ to $4 \times 4$
  - Next state may depend on more than the current state: weather
  - k-Markov chains: $n \times n$ becomes $n^k \times n^k$
- **Leads into next section:** Those are limits of the model. The linear algebra has its own requirements.

### 5. When the linear algebra stops applying
- **File:** `spec/markov-chains/linalg-limits.md`
- **Status:** in discussion
- **Purpose:** Separate limits of the tools from limits of the model, then close. About 1 minute.
- **Contains:**
  - Must be square: the $3 \times 9$ RPS move and outcome example
  - Must be fixed: $\mathbf{x}_t = M_t \cdots M_2 M_1 \mathbf{x}_0$
  - Other conditions: diagonalisable, regular
  - Closing: linear algebra is a toolset that rewards models fitting its constraints
- **Leads into next section:** End of deck, into Q&A.
