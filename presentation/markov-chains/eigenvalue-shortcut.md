# Eigenvalues as the shortcut

## Blocked by

### Open questions

### Assumptions
- The class has covered eigenvalues and eigenvectors, so the deck uses them without a recap and does not teach how to compute them.
- The outline's "speed up" claim is reworded to "any $t$ in closed form, and the limit read straight off", because repeated multiplication is cheaper for small $n$ and small $t$. The cost comparison sits in the Q&A backup.
- Eigenvectors are scaled to whole numbers for readability, and $\mathbf{v}_1, \mathbf{v}_2, \mathbf{v}_3$ follow decreasing $\lambda$.

## Slides

### Slide 1: Why not keep multiplying?
**Purpose:** Motivate eigenvectors.

**Content:**
$$\mathbf{x}_t = M^t\mathbf{x}_0$$

- $t$ multiplications to reach step $t$
- No view of where the chain is heading

This might look familiar:

$$M\mathbf{v} = \lambda\mathbf{v} \quad\Rightarrow\quad M^t\mathbf{v} = \lambda^t\mathbf{v}$$

**Speaker notes:**
We could keep multiplying. But each product gives only one more step, and the numbers alone do not tell us where the chain is heading. This should look familiar. On an eigenvector, $M$ only scales, so applying it $t$ times turns a matrix power into a scalar power.

**Q&A backup (not spoken):** Repeated multiplication costs $O(n^2 t)$ and the eigendecomposition costs $O(n^3)$ once. Once decomposed, each step count needs only $n$ scalar powers and a recombination of at most $O(n^2)$. So the gain is largest for many or large values of $t$ and for the limit itself, not for one small $t$ on a small matrix.

### Slide 2: Eigenvalues of our matrix
**Purpose:** Give the three eigenpairs the rest of the deck uses.

**Content:**
$$\lambda_1 = 1 \qquad \lambda_2 = 0.6 \qquad \lambda_3 = 0.3$$

$$\mathbf{v}_1 = \begin{bmatrix} 2 \\ 1 \\ 1 \end{bmatrix} \qquad \mathbf{v}_2 = \begin{bmatrix} 2 \\ 1 \\ -3 \end{bmatrix} \qquad \mathbf{v}_3 = \begin{bmatrix} 1 \\ -1 \\ 0 \end{bmatrix}$$

**Speaker notes:**
Our matrix has three eigenvalues: one, zero point six and zero point three. Three distinct eigenvalues give three independent eigenvectors, so these form a basis of $\mathbb{R}^3$. Any state can be written in terms of them. Keep an eye on that eigenvalue of exactly one.

**Q&A backup (not spoken):** Check: $M\mathbf{v}_2 = [1.2, 0.6, -1.8]^T = 0.6\,\mathbf{v}_2$, and $M\mathbf{v}_3 = [0.3, -0.3, 0]^T = 0.3\,\mathbf{v}_3$.

### Slide 3: Rewrite the start in the eigenbasis
**Purpose:** Express the starting state as a linear combination of eigenvectors.

**Content:**
$$\mathbf{x}_0 = \begin{bmatrix} 1 \\ 0 \\ 0 \end{bmatrix} = \frac{1}{4}\mathbf{v}_1 + \frac{1}{12}\mathbf{v}_2 + \frac{1}{3}\mathbf{v}_3$$

**Speaker notes:**
Now we rewrite the starting state, Rock, as a combination of the eigenvectors. The coefficients come from solving one linear system. We only do this once, and they are one quarter, one twelfth and one third.

### Slide 4: The closed form
**Purpose:** Show the payoff: any future state, with no repeated multiplication.

**Content:**
$$\mathbf{x}_t = \frac{1}{4}\mathbf{v}_1 + \frac{1}{12}(0.6)^t\mathbf{v}_2 + \frac{1}{3}(0.3)^t\mathbf{v}_3$$

Three moves ahead:

$$\mathbf{x}_3 = \begin{bmatrix} 0.545 \\ 0.259 \\ 0.196 \end{bmatrix}$$

Any $t$ takes the same work.

**Speaker notes:**
Apply $M^t$ to that combination, and each eigenvector picks up its eigenvalue to the power $t$. That gives a closed form. Three moves after Rock, the opponent plays Rock with probability about fifty-five percent, which matches direct multiplication. Move one hundred takes the same work as move three. The formula also shows the structure: one term stays fixed and two shrink.
