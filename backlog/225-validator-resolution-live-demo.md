---
type: issue
workItem: story
size: 3
status: open
dateOpened: '2026-06-09'
blockedBy: ["224"]
tags:
  - validation
  - async
  - demo
  - registry
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
parent: "004"
---

# Live demo for the async validator-resolution plane (stale-answer race)

#214 shipped the `validator-resolution/` model and its two plug pages but no runnable
surface — the async sibling of the `validity-merge-demo`. The concept is hard to grasp
statically because it is a *race*: it only shows its value when answers arrive out of
order. A demo makes that visible.

**Build (depends on #224's runtime plug):**
- A standalone demo (registered in `src/_data/demos.json`, mirroring `validity-merge-demo`)
  with a debounced async field whose validator resolves on a controllable delay, so a
  user can fire overlapping checks and watch which answer wins.
- A strategy toggle: **versioning** ↔ **cancellation**, swapped with zero field edits,
  showing late answers dropped (versioning) vs requests aborted (cancellation).
- Feed the surviving answer into the #215 `<validity-merge-field>` `async` source so the
  merged `:user-invalid` styling reacts live — demonstrating the two planes composed.
- A runtime-conformance section asserting the live plug's invariants (same source as the
  #214 unit suite).

Sibling to the validity-merge demo. Best done after #224.
