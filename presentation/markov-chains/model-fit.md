# Is a Markov chain the right model?

## Blocked by

### Open questions

### Assumptions
- The $3^{10} = 59{,}049$ history count is added to make the memoryless saving concrete. It is derived and is not in the outline.
- The add-a-tab and k-Markov diagrams are drawn at build time from the descriptions below.

## Slides

### Slide 1: Strengths
**Purpose:** Show the benefits of the approach.

**Content:**
**Feasible:** the memoryless assumption shrinks what we must track.

Visual: two small boxes side by side. Full history of 10 moves: $3^{10} = 59{,}049$ cases. Markov: 3 states.

**Long-run answers directly from $M$:** steady state comes from one eigenvector, with no simulation.

**Speaker notes:**
So why use this model? First, it is practical. If every past move mattered, ten moves of history would already mean about fifty-nine thousand cases. The memoryless assumption cuts this to three states. Second, it suits long-run questions, since the steady state comes directly from the transition matrix.

### Slide 2: Limitation: new states are expensive
**Purpose:** Show the cost of growing the model.

**Content:**
Visual: a website navigation diagram with Home, Discover and Cart, plus a new Wishlist node with new arrows to and from every tab. Beside it, a $3 \times 3$ matrix grows to $4 \times 4$.

- Every existing column must be re-estimated
- Matrix-vector cost grows with $n^2$

**Speaker notes:**
The first limitation is adding states. Suppose we model users moving between a site's tabs and add a Wishlist tab. Every existing tab can now lead to Wishlist, so every column must be re-estimated to still sum to one. The matrix also grows from three by three to four by four, and multiplication cost grows quadratically.

### Slide 3: Limitation: the present may not be enough
**Purpose:** Show where the memoryless assumption fails, and what the fix costs.

**Content:**
Tomorrow's weather depends on more than today's weather.

k-Markov chain: let the state be the past $k$ states.

$$n \times n \;\longrightarrow\; n^k \times n^k$$

Visual: the 3 RPS states expand into 9 pairs (RR, RP, RS, PR, ... SS), and the $3 \times 3$ matrix grows to $9 \times 9$ for $k = 2$.

**Speaker notes:**
Second, the current state may not be enough. Weather forecasts depend on temperature trends and humidity, not only today's weather. We can add memory with a k-Markov chain, where a state is the past $k$ states. It is still a Markov chain, but the matrix grows exponentially: remembering two moves in our game means nine by nine.

**Q&A backup (not spoken):** The $n^k \times n^k$ matrix is sparse, with at most $n$ non-zero entries per column, since the next pair must overlap the current one. Storage therefore grows as $n^{k+1}$, which is still exponential in $k$. Weather variables such as humidity need a larger state, not more history.
