# From Markov chain to matrix

## Blocked by

### Open questions

### Assumptions
- Rock-Paper-Scissors opens the deck as the hook and runs through to section 5. The outline introduced it at the matrix.
- The numbers in $M$ are illustrative, not measured, and the slide says so.
- $X_t$ is the opponent's move at round $t$.
- Team names are a placeholder on the title slide.
- The state diagram, function diagram and step chain are drawn at build time from the descriptions below.

## Slides

### Slide 1: Title and hook
**Purpose:** Give the audience one question to follow through the deck.

**Content:**
Title: Markov Chains: A Linear Algebra View

Your opponent just played Rock. What comes next?

[Team names]

**Speaker notes:**
Your opponent just played Rock. Can you predict their next move, and where their play is heading in the long run? A Markov chain models this question. Today we show that once it is written as a matrix, linear algebra answers both parts.

### Slide 2: The Markov property
**Purpose:** State the one assumption the whole model rests on.

**Content:**
The next state depends only on the current state.

Visual: a chain of nodes $X_0 \to X_1 \to \cdots \to X_t \to X_{t+1}$, like a linked list. Only the arrow from $X_t$ to $X_{t+1}$ is highlighted, and earlier nodes are greyed out.

$$P(X_{t+1} = i \mid X_t = j,\, X_{t-1} = i_{t-1},\, \ldots,\, X_0 = i_0) = P(X_{t+1} = i \mid X_t = j)$$

**Speaker notes:**
The Markov property says the next state depends only on the current state, not on the full history. Conditioning on every earlier move gives the same probability as conditioning on the last one. Like a linked list, each node only points to the next.

### Slide 3: Rock-Paper-Scissors as a chain
**Purpose:** Make the model concrete. Diagram-only slide.

**Content:**
Visual: state diagram with three nodes, Rock, Paper and Scissors, and an arrow for every transition, labelled with its probability.
- From Rock: to Rock 0.7, to Paper 0.2, to Scissors 0.1
- From Paper: to Rock 0.4, to Paper 0.5, to Scissors 0.1
- From Scissors: to Rock 0.2, to Paper 0.1, to Scissors 0.7

Footnote: Illustrative probabilities.

**Speaker notes:**
Here is one player as a chain. The three moves are our states, and each arrow is the probability of moving from one to another. After Rock, this player repeats Rock seventy percent of the time. These numbers are illustrative. Each node's outgoing arrows sum to one, because some move must follow.

### Slide 4: From function to matrix
**Purpose:** Connect the diagram to linear algebra.

**Content:**
A transition is a function from one state to the next.

Visual: $\mathbf{x}_t$ enters a box labelled $M$, and $\mathbf{x}_{t+1}$ comes out.

- State: a vector of probabilities, $\mathbf{x}_t \in \mathbb{R}^n$
- Transition: a matrix, $M \in \mathbb{R}^{n \times n}$

$$\mathbf{x}_{t+1} = M\mathbf{x}_t$$

**Speaker notes:**
A transition behaves like a function: it takes today's state and returns tomorrow's. So we write the state as a vector, where entry $i$ is the probability of being in state $i$. This function is linear, so it is a matrix. One step of the chain is one matrix-vector product.

**Q&A backup (not spoken):** Linearity comes from the law of total probability: $P(X_{t+1} = i) = \sum_j P(X_{t+1} = i \mid X_t = j)\, P(X_t = j) = \sum_j M_{ij}(\mathbf{x}_t)_j$, which is row $i$ of $M\mathbf{x}_t$.

### Slide 5: The Markov matrix
**Purpose:** Define the matrix and read it through the column view.

**Content:**
Column-stochastic: entries are non-negative and each column sums to 1.

$$M = \begin{bmatrix} 0.7 & 0.4 & 0.2 \\ 0.2 & 0.5 & 0.1 \\ 0.1 & 0.1 & 0.7 \end{bmatrix}$$

Columns and rows are labelled Rock, Paper, Scissors, in that order.

Last move was Rock:

$$\mathbf{x}_0 = \begin{bmatrix} 1 \\ 0 \\ 0 \end{bmatrix} \qquad M\mathbf{x}_0 = \begin{bmatrix} 0.7 \\ 0.2 \\ 0.1 \end{bmatrix}$$

Visual: column 1 of $M$ is highlighted, with the same highlight on $M\mathbf{x}_0$.

**Speaker notes:**
This is the diagram as a matrix. Column $j$ holds the probabilities of leaving state $j$, so $M_{ij}$ is the probability of moving from $j$ to $i$. Each column sums to one. If the last move was Rock, the state vector is the first standard basis vector, and by the column view, multiplying simply picks out column one.

### Slide 6: Looking ahead
**Purpose:** Generalise one step to $t$ steps.

**Content:**
Visual: a chain of boxes, $\mathbf{x}_0 \to M \to \mathbf{x}_1 \to M \to \mathbf{x}_2 \to \cdots$, with values below.

$$\mathbf{x}_1 = M\mathbf{x}_0 = \begin{bmatrix} 0.7 \\ 0.2 \\ 0.1 \end{bmatrix} \qquad \mathbf{x}_2 = M\mathbf{x}_1 = \begin{bmatrix} 0.59 \\ 0.25 \\ 0.16 \end{bmatrix}$$

$$\mathbf{x}_t = M^t\mathbf{x}_0$$

**Speaker notes:**
To look further ahead, we apply $M$ again. Two moves after Rock, the probability of Rock is fifty-nine percent. Note that $\mathbf{x}_2$ is no longer a column of $M$, because $\mathbf{x}_1$ is a mix of all three states. Repeating this gives the equation for the rest of the talk: $\mathbf{x}_t$ equals $M$ to the $t$ times $\mathbf{x}_0$.
