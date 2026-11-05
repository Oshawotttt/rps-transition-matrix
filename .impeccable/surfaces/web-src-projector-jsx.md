---
version: 1
slug: "web-src-projector-jsx"
primary_target: "web/src/Projector.jsx"
related_targets: []
---

# Projector view

Mode: Operate (presenter drives it; class reads it from the back row).

Audience and job: the presenter walks the class through the bot's three steps each round, then clicks the bot's move. The friend's move arrives from their own device and stays hidden ("Move locked in") until the bot's move is chosen.

Approved mock: `.impeccable/mocks/drafts-v3/report.html` (approved 2026-11-04). Earlier rounds: `.impeccable/mocks/drafts-v2/index.html` (draft 4 chosen), `.impeccable/mocks/drafts-v3/table.html` (superseded).

## Direction contract

THESIS: The match as two players across a table, with the bot's thinking written below as a report the class scrolls through. Refuses the category default of an accordion of step cards under a score header, and the earlier toy-box look (thick outlines, glyph faces).

OWN-WORLD: Warm wall #f1efe8 over a sage table #c9d8c5 with a darker rim; paper #fbfbf8 report; ink #20232b. Moves keep fixed hues (R #c24b3a, P #3462ad, S #d39b22); outcomes win #2f7b55, tie #d8d5cc, loss #c24b3a; highlight #fff3c9 for the selected column. Gabarito for display, Atkinson Hyperlegible for body and numbers (tabular). Geometric SVG characters: robot with antenna, screen face and bow tie; human in blazer and tie. Face-up move cards with drawn R/P/S icons. Square-bracket matrices and vectors.

STORY: The class sees who is playing, what happened last round, then reads Predict, Score, Choose in order and agrees on the bot's move. The presenter clicks it; both cards reveal; the next round starts with only x changed.

FIRST VIEWPORT: Scene band (~380px): bot left labelled "That's us", friend right with "Move locked in", score centred, last round's two cards on the table. Sticky tab bar: This round, Long run, Tally, Look ahead, plus score and match length. The Policy tab was folded into Long run (2026-11-05): "How M is built" shows S = A P, B and how each column of P lands in M. Below, the round title with x, then step 1 open.

FORM: Across the Table, draft 4 of the second board, refined over two rounds. seed: fc4f32d9effc1d3b

STEP 2 CHART (chosen 2026-11-05, draft 7 of `.impeccable/mocks/drafts-v4/score-combo.html`): a grid of q bars coloured by each row of A, then a column with the win and loss bars side by side; the dashed band between their tops is A q. The chosen move's row is highlighted after the pick.

SIGNATURE: Step 3 holds the three move buttons. A wrong pick shakes and states its score; the right pick reveals both cards and the result, then "Next round" returns to the top.

Look ahead (built 2026-11-05, `web/src/LookAhead.jsx`): start-state picker (defaults to the current state), the formula (x = Σ cᵢvᵢ, M vᵢ = λᵢvᵢ, Mᵗx = c₁λ₁ᵗv₁ + c₂λ₂ᵗv₂ + c₃λ₃ᵗv₃ + ⋯), a sticky back/forward stepper (also ← →), the first 3 terms with real c, λ and v, then Mᵗ x beside horizontal bars on the same rows with π ticks. Stepping rolls only the powers and the answer; bars slide. t runs 0 to `look_ahead[s].stopped_at`. Under the answer: a read-out of the likeliest state now and in π (row highlighted), a right-hand card pair (their likely throw from q = P Mᵗx, our move from A q, from `look_ahead[s].decisions[t]`), then "Why that move": one disclosure (collapsed by default) holding Predict, Score, Choose, each open inside and still collapsible on its own.

## Unresolved


- Real build loads the bot JSON with `loadBot()` from `web/src/game.js`; the mock hard-codes pooled numbers.

Edge-case banners (drafted in the mock, `#split` and `#cycle`): one banner, two messages, shown on This round in round 1 and on Long run. Picked by `match.eigenvalue_one_multiplicity > 1` or `match.has_unit_cycle`; both say round 1 uses the 3 × 3 steady state (`opening.source == "basic"`). The split case swaps the π chart for the closed groups and their rates (`closed_groups`, `group_outcome_rates`).
