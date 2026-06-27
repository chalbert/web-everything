---
name: project_explorer_report_inflates_per_state
description: explorer per-state report RE-COUNTS the same element across interactive states; dedupe per fg/bg/target for the real residual
metadata: 
  node_type: memory
  type: project
  originSessionId: fd38a971-9ed0-4891-94b4-79a423983f08
---

The FUI explorer's bundle `report.md` (and the per-state `nodes` counts) **inflate** by re-counting the
same DOM element across every interactive state it visits — so a route shows e.g. `color-contrast (89)` when
the real distinct residual is 2. Don't trust the per-state count. Instead read `findings.json` `a11y[].rules[]`
and **dedupe per `(route, fg, bg, target)`** to get the true set: on #1575 this turned a scary ~400 per-state
total into **19 distinct** nodes (which matched the item's hand-counted 15 + 4 same-kind extras).

Corollary: a naive landing-page axe scan UNDER-counts the opposite way — many failures only render in deeper
interactive states (an empty review queue, an unselected component, a not-yet-blocked verdict). To reproduce
what the explorer found, run the real explorer recipe (`npm run explore -- <url> --auth <recipe>.json --out <dir>`),
not a one-off `page.goto` + axe. See [[feedback_test_before_asserting_cause]], [[feedback_prove_before_claiming_fixed]]. #1575
