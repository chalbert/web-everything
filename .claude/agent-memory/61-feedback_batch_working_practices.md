---
name: feedback_batch_working_practices
description: "Lessons for running backlog batches — claim before coding, pre-flight for hidden forks, cluster by subsystem, track net flow"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5a39444d-e982-43af-a672-9ba9eadd092b
---

Practices that made `/batch` runs cleaner (learned running batch-2026-06-09-241-233-235):

1. **Claim before reading code.** Flipping `open → active` + `dateStarted` must be the *first* action
   on an item, before any exploration — it's the only on-disk guard against concurrent double-work. In
   one item I explored + wrote code while still `open` and only flipped at close-out (no harm, but the
   window was real).
2. **Pre-flight each item for hidden design forks — `size` measures effort, not decision-weight.** A
   `story·3` hid a genuine architecture fork (self-contained served form vs. import a helper). Before
   approving the plan, skim each body for "decide whether / alternative held open"; a small item with a
   buried fork is a stop risk (rule 4), not a clean batch item.
3. **Cluster the plan by subsystem/repo; make the repo boundary the planned context-seam.** Mixing
   webeverything items with frontierui ones meant the natural stop was the repo boundary — predict that
   at plan time and order toward it instead of discovering it mid-batch.
4. **Surface net backlog flow.** A batch both resolves and *opens* items (this one: −3 resolved, +2
   captured = net −1). The ledger should show net, since capture can outpace drain.
5. **The points budget is the driver — never stop a batch on a felt context call.** (batch-2026-06-12:
   stopped at 7/9 with 19/37 pts, two eligible items, green gate, on a gut "I've read a lot" context
   seam — then the meter read **22% used**, ~3× the budget still in hand. The stop was wrong.) You
   **cannot measure your own context**, so a felt sense of heavy context is not a signal. Run to the
   budget unless a *hard* rule fires (gate red / no eligible item after re-pack / real fork). The context
   seam fires **only** on a countable proxy: a *planned* repo/subsystem boundary, or a user-reported meter
   reading near the limit (ask, per [[feedback_context_meter_ask_dont_estimate]]). Codified this in
   `backlog-workflow.md` → *The stop rule* rule 5 (rewrote "err toward stopping" → "keep going to the
   budget") and the SKILL.md summary.

**Why:** batches trade per-item approval stops for speed, so the cheap safety checks (claim discipline,
fork pre-flight, predictable seams) are what keep "running longer" safe.

**How to apply:** at plan time, annotate each candidate with repo + a fork-scan, order same-subsystem
together, and stop at the repo boundary. During the loop, claim as the first keystroke. In the ledger,
add a net `−resolved/+opened` line.

Infra footgun seen this batch: adding a relative `import` to a shared transform (`htmlToJsx.ts`) broke
the 11ty build because the `.eleventy.js` filter *transpiles the file standalone* (bare
`require("./sibling")` can't resolve) — switch that filter to esbuild `buildSync({bundle:true})`. Any
shared TS consumed by `.eleventy.js` has this trap.

Related: [[feedback_backlog_is_tracker]] · [[feedback_poc_mode_pragmatism]] ·
[[feedback_self_contained_plans]] · [[feedback_no_commit_talk_in_backlog]]
