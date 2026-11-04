# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Audience (primary reader of the projector):** CS103 classmates and the professor during a Week 13 talk on Markov chains and transition matrices. They watch the projector and follow the linear algebra as the presenter narrates it.
- **Presenter:** drives the projector view and narrates each step; owns setup (loading a bot, choosing match length).
- **Human player:** a friend who plays the bot live. They sit away from the projector ("banished to a corner") and play on their own device, so they never see the bot's computation. The player's view only needs to take a move and show the round result.

## Product Purpose

A live demo that makes the bot's matrix computation visible, round by round, while a real person plays rock-paper-scissors against it. Every round runs the same three steps: predict q = P x, score A q, choose the largest entry. Round 1 uses π of the 9 × 9 human-vs-bot matrix in place of a one-hot x. Success: the audience can read each step's matrix or vector and the chart of what it means, fast enough to keep pace with a live match inside a 10-minute talk.

Source of truth for what the frontend shows: `docs/PRESENTATION-FLOW.md` section 2.4 (Demo). Where it and `docs/OUTLINE.md` disagree, PRESENTATION-FLOW wins (3 × 9 outcome states, round 1 from π).

## Positioning

Not an RPS game with a smart opponent; a projected worksheet of the bot's linear algebra, driven by real play. The numbers on screen are the exact numbers the bot used, exported from the Python model, not re-derived or approximated in the browser.

## Operating Context

- Classroom projector, read from across a room, under time pressure (demo budget roughly 45 s in the outline, longer in PRESENTATION-FLOW 2.4).
- Two screens on the room's wifi: the human's device (move input) and the presenter laptop on the projector (computation view). The presenter laptop runs a local server that serves the app and relays moves between the two. No other server or API.
- Match length chosen before the game: best of 3 (default) or best of 5; ties are replayed.
- Reveal timing does not matter, since the human cannot see the projector.

## Capabilities and Constraints

- Stack: React app in `web/` beside `web/src/game.js`, one `web/package.json`; Vite serves `web/public/` (bot JSON at `bots/…`).
- Game logic lives in `web/src/game.js` (pure ES module, immutable frozen `Game`); the UI calls it and keeps the game in React state. API in `docs/CONTRACTS.md`, "Game logic".
- The frontend does no math beyond reading exported numbers, summing per-round values and counting round wins: no matrix products, no eigenvalues, no re-deciding moves in JS.
- The bot JSON is switchable: load the friend's bot or the pooled default (`web/public/bots/bot_rps_human_combined.json`) before a match. Both must work.
- Panels required each round (PRESENTATION-FLOW 2.4): payoff matrix A always on screen; q = P x (full one-hot multiplication shown once, then shortened as a column lookup); bar chart of q; A q with stacked win/tie/loss bars per bot move; chosen move highlighted, with tie-break order R, P, S and a flag when the choice differs from countering the most likely move.
- Round 1 panels: the 9 × 9 matrix as a grid (3 nonzero entries per column); all 9 eigenvalues sorted by modulus with |λ| (complex pairs as a ± bi), λ = 1 and λ₂ highlighted; π as a bar chart of the 9 states coloured by outcome, labelled with long-run win/loss/tie rates and the bot's edge; transient (zero) states pointed out; then q₀ = P π.
- Edge-case banners: eigenvalue 1 repeated (chain splits into k closed groups; fall back to the 3 × 3 steady state) and a unit-modulus eigenvalue other than 1 (`has_unit_cycle`; same fallback, show a note).
- Optional panels, if time allows: live tally row of per-round q charts (actual move green, others red, no accuracy statistic); expected vs actual score running total; policy table S = A P with B; habit vs bot (q₀ against 3 × 3 π); look-ahead animation of Mᵗ x capped at 100 steps.
- Out of scope per `docs/ARCHITECTURE.md`: match win probability panel, undo/save/replay, round-1 prediction from u₀.
- Open: the friend's bot numbers are not computed yet; their training rounds are still to be played.

## Brand Commitments

- Notation follows LA4CS: square brackets for matrices and vectors, no multiplication symbols, column-stochastic matrices (x_{t+1} = P x_t).
- Terminology is fixed (see `GLOSSARY.md`): "pattern" means how the next move depends on what just happened; "habit" means the steady-state move frequencies. Never swap them.
- States are written as move plus outcome from the human's side, e.g. RL (played Rock and lost).

## Evidence on Hand

- Pooled bot JSON: `web/public/bots/bot_rps_human_combined.json` (Brockbank & Vul 2021 plus Wang, Xu & Zhou 2014).
- Worked pooled numbers in `docs/PRESENTATION-FLOW.md` 2.4 (eigenvalues, π, q₀, policy table). Some are marked preliminary.
- Synthetic test fixture: `web/test/fixtures/bot_synthetic.json`.
- No friend data yet; do not fabricate their numbers.

## Product Principles

1. Show the real numbers: every value on screen comes from the bot JSON, never computed or rounded differently in the browser.
2. One idea per step: each step shows its matrix or vector, then one chart of what it means.
3. Legible from the back row: the projector view is read at distance, mid-narration.
4. Same three steps every round; only x changes. The layout should make that repetition obvious.
5. The human's screen stays minimal; the projector carries the explanation.
