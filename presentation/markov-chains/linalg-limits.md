# When the linear algebra stops applying

## Blocked by

### Open questions

### Assumptions
- The win/lose claim cites Wang, Xu & Zhou (2014), *Scientific Reports* 4:5830. It was checked against the abstract and search excerpts, not the full text, so the slide makes only the general claim and no direction of shift.
- The outline's "needs to be diagonalisable" is corrected: diagonalisability gives the clean formula, and regularity gives convergence. A regular chain converges even if it is not diagonalisable.
- The closing wording is drafted from the outline's final line.
- The two diagrams are drawn at build time from the descriptions below.

## Slides

### Slide 1: The matrix must be square
**Purpose:** Show why a natural RPS extension breaks the iteration.

**Content:**
Next move depends on the last move and on win, lose or tie.

Visual: a $3 \times 9$ matrix takes a vector in $\mathbb{R}^9$ (move and outcome) to a vector in $\mathbb{R}^3$ (next move). A crossed-out arrow shows the output failing to feed back as input.

$$M\mathbf{x}\in\mathbb{R}^3,\quad \mathbf{x}\in\mathbb{R}^9 \quad\Rightarrow\quad M^2 \text{ is undefined}$$

Source: Wang, Xu & Zhou (2014), *Scientific Reports* 4:5830.

**Speaker notes:**
Now the linear algebra's own requirements. Research finds that players respond to whether they won, lost or tied. Predicting the next move from move and outcome gives a three by nine matrix. Its output cannot feed back in as input, so it cannot be iterated, and it has no eigenvalues.

**Q&A backup (not spoken):** "Why not a $9 \times 9$ chain on (move, outcome) pairs?" That is square and does work, but the next outcome also depends on the other player's move, so it needs that player's strategy to be fixed and included in the matrix.

### Slide 2: The matrix must be fixed
**Purpose:** Show why changing probabilities remove the eigen-analysis, and note the remaining conditions.

**Content:**
Players adapt, so $M$ changes over time:

$$\mathbf{x}_t = M_t \cdots M_2 M_1 \mathbf{x}_0$$

Visual: the step chain from section 1, with each box now labelled differently, $M_1, M_2, M_3$.

No single set of eigenvectors applies.

Also needed:
- **Diagonalisable:** for the clean formula
- **Regular:** for convergence to one steady state

**Speaker notes:**
Second, $M$ must stay fixed. A real player adapts, so their probabilities change. Then we have a product of different matrices, with no shared eigenvectors, so our formula fails. Finally, the clean formula needs a diagonalisable matrix, and convergence to one steady state needs a regular chain.

**Q&A backup (not spoken):** A chain is regular if some power of $M$ has all positive entries. Counterexample: $\begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}$ has $\lambda = 1, -1$, so $\mathbf{x}_t$ oscillates and does not converge, although its time average still does.

### Slide 3: Closing
**Purpose:** End on the deck's main idea.

**Content:**
Not a limit of linear algebra.

If your model fits these constraints, linear algebra gives you the analysis.

$$\mathbf{x}_t = M^t\mathbf{x}_0 \;\longrightarrow\; \boldsymbol{\pi}$$

**Speaker notes:**
These are not really failures of linear algebra. It is a set of tools, and each tool has conditions. If your model fits them, a question about probability becomes a question about eigenvalues, and the long-run answer can be read straight off the matrix. Thank you.
