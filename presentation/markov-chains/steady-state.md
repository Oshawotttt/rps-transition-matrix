# Steady state: where the chain ends up

## Blocked by

### Open questions

### Assumptions
- The outline's `<Insert definition?>` is filled with the standard definition: $M\boldsymbol{\pi} = \boldsymbol{\pi}$, non-negative entries summing to 1.
- The averaging horizon is $N$, not the outline's $T$, so it does not clash with the transpose.
- The outline's "video" is `convergence.gif`, because no video encoder is installed here. It plays in PowerPoint. `convergence.png` is the static fallback.
- "Against this mix, Paper wins 50% and loses 25%" is added to answer the opening hook. It is derived from $\boldsymbol{\pi}$ and is not in the outline.

## Slides

### Slide 1: Steady state
**Purpose:** Define the steady state and show that it follows from $\lambda = 1$.

**Content:**
A distribution that $M$ leaves unchanged:

$$M\boldsymbol{\pi} = \boldsymbol{\pi}, \qquad \pi_i \ge 0, \qquad \sum_i \pi_i = 1$$

An eigenvector with $\lambda = 1$, scaled to sum to 1.

Every stochastic matrix has $\lambda = 1$, and all its eigenvalues satisfy $|\lambda| \le 1$.

$$\boldsymbol{\pi} = \frac{1}{4}\mathbf{v}_1 = \begin{bmatrix} 0.5 \\ 0.25 \\ 0.25 \end{bmatrix}$$

**Speaker notes:**
A steady state is a distribution that $M$ leaves unchanged. That is exactly an eigenvector with eigenvalue one, scaled to sum to one. It is not luck that our matrix has this eigenvalue: every stochastic matrix does, and none has an eigenvalue larger than one in magnitude.

**Q&A backup (not spoken):**
- $\lambda = 1$ exists: columns sum to 1, so $M^T\mathbf{1} = \mathbf{1}$, and $M$ and $M^T$ have the same eigenvalues.
- $|\lambda| \le 1$: $M$ does not increase the 1-norm, so $|\lambda|\,\|\mathbf{v}\|_1 = \|M\mathbf{v}\|_1 \le \|\mathbf{v}\|_1$.

### Slide 2: Why it converges
**Purpose:** Show convergence directly from the closed form.

**Content:**
$$\mathbf{x}_t = \boldsymbol{\pi} + \frac{1}{12}(0.6)^t\mathbf{v}_2 + \frac{1}{3}(0.3)^t\mathbf{v}_3 \;\longrightarrow\; \boldsymbol{\pi}$$

Visual: `resources/steady-state/eigen-components/eigen-components.png`. Bars for each of the three components and their sum $\mathbf{x}_t$, at $t = 0, 1, 3, 10$.

**Speaker notes:**
Here is the closed form again. Each row of the chart is one term, and each column is a later time. The top row, $\boldsymbol{\pi}$, never changes. The middle two rows shrink away because their eigenvalues are below one. So the bottom row, our state, settles onto $\boldsymbol{\pi}$. Those shrinking terms are the only part that remembers the start.

**Q&A backup (not spoken):** The start does not matter: eigenvectors with $\lambda \ne 1$ have entries summing to 0, and $\mathbf{x}_0$ sums to 1, so the coefficient on $\boldsymbol{\pi}$ is always 1.

### Slide 3: Watching it converge
**Purpose:** Let the audience see the convergence. Diagram-only slide.

**Content:**
Visual: `resources/steady-state/convergence/convergence.gif`. Rock, Paper and Scissors probabilities drawn over 20 transitions, starting from Rock and settling at dashed lines for 0.50 and 0.25. Static fallback: `resources/steady-state/convergence/convergence.png`.

**Speaker notes:**
Here is the same thing move by move, starting from Rock. Rock falls from one towards a half, while Paper and Scissors rise towards a quarter each. By about ten moves, the lines have settled, and the starting move has almost no influence.

### Slide 4: What the steady state means
**Purpose:** Translate $\boldsymbol{\pi}$ back into the game and into probability.

**Content:**
$$\boldsymbol{\pi} = \begin{bmatrix} 0.5 \\ 0.25 \\ 0.25 \end{bmatrix} \quad \begin{matrix} \text{Rock} \\ \text{Paper} \\ \text{Scissors} \end{matrix}$$

In the long run, this player plays Rock 50% of the time.

Against this mix, Paper wins 50% and loses 25%.

**Speaker notes:**
So what does this mean? Far into the future, the probability that this player plays Rock is fifty percent, whatever they started with. That answers our opening question for the long run: playing Paper wins half the time and loses a quarter of the time. But is this also how often they actually play Rock?

### Slide 5: Steady state as a long-run average
**Purpose:** Connect $\boldsymbol{\pi}$ to the fraction of time spent in each state.

**Content:**
$$\frac{1}{N}\sum_{t=0}^{N-1}\mathbf{x}_t = \boldsymbol{\pi} + \frac{1}{N}\left(\frac{1}{12}\sum_{t=0}^{N-1}(0.6)^t\mathbf{v}_2 + \frac{1}{3}\sum_{t=0}^{N-1}(0.3)^t\mathbf{v}_3\right) \;\longrightarrow\; \boldsymbol{\pi}$$

Geometric sums stay bounded, so dividing by $N$ removes them.

Visual: `resources/steady-state/running-average/running-average.png`.

**Speaker notes:**
It is. Average the state vectors over $N$ moves, and $\boldsymbol{\pi}$ comes out unchanged. The other two terms are geometric series, so their sums stay bounded, and dividing by $N$ sends them to zero. The average probability of Rock is the expected fraction of rounds spent on Rock, so $\boldsymbol{\pi}$ is that fraction. The average converges slowly, like one over $N$.

**Q&A backup (not spoken):** The sums are bounded by $\frac{1}{1 - 0.6} = 2.5$ and $\frac{1}{1 - 0.3} = \frac{10}{7}$. Expected fraction of time: $\frac{1}{N}\sum_t P(X_t = i) = E\left[\frac{1}{N}\sum_t \mathbb{1}(X_t = i)\right]$.

### Slide 6: Speed of convergence
**Purpose:** Show that the second-largest eigenvalue sets the rate.

**Content:**
The largest $|\lambda| < 1$ sets the speed.

Visual: `resources/steady-state/eigen-decay/eigen-decay.png`. $0.6^t$ against $0.3^t$, with $t = 5$ marked.

After 10 transitions: $0.6^{10} \approx 0.006$

**Speaker notes:**
How fast does this happen? The eigenvalues tell us. The zero point three term is gone within a few moves, so zero point six is what we wait for. After ten transitions, it has shrunk to about zero point zero zero six, and the state is within zero point zero zero two of steady state. Smaller eigenvalues mean faster convergence.

**Q&A backup (not spoken):** At $t = 10$, $\mathbf{x}_{10} \approx [0.5010, 0.2505, 0.2485]^T$. The largest error is in Scissors, about $0.0015$.
