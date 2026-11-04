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

FIRST VIEWPORT: Scene band (~380px): bot left labelled "That's us", friend right with "Move locked in", score centred, last round's two cards on the table. Sticky tab bar: This round, Long run, Tally, Policy, Look ahead, plus score and match length. Below, the round title with x, then step 1 open.

FORM: Across the Table, draft 4 of the second board, refined over two rounds. seed: fc4f32d9effc1d3b

SIGNATURE: Step 3 holds the three move buttons. A wrong pick shakes and states its score; the right pick reveals both cards and the result, then "Next round" returns to the top.

## Unresolved

- Look ahead panel not designed.
- Real build loads the bot JSON with `loadBot()` from `web/src/game.js`; the mock hard-codes pooled numbers.

Edge-case banners (drafted in the mock, `#split` and `#cycle`): one banner, two messages, shown on This round in round 1 and on Long run. Picked by `match.eigenvalue_one_multiplicity > 1` or `match.has_unit_cycle`; both say round 1 uses the 3 × 3 steady state (`opening.source == "basic"`). The split case swaps the π chart for the closed groups and their rates (`closed_groups`, `group_outcome_rates`).
