---
name: ui-loader-cli-engine-field-parity
description: "backlog.js (UI) and readiness/engine.mjs (CLI) derive batchable/tier/filler independently — a demote/tier rule live in one surface isn't live in the other until both implement it"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 067b2185-c17e-44ab-ba42-d70344653d77
---

The `/backlog` UI and the `check:readiness --select` CLI compute the same
readiness fields (`batchable`, `tier`, `filler`) from **two independent
implementations**: `src/_data/backlog.js` (the 11ty loader → UI) and
`scripts/readiness/engine.mjs` (the CLI selector). They can silently diverge —
a rule documented in `src/_data/backlogMeta.js` or honored by `--select` is
**not live in the UI until the loader also implements it**.

Concrete case (#2014): `priority: low` FILLER was demoted out of the auto-pack
by the CLI engine (`isFiller`) and *documented* in `backlogMeta.priorityMeta`,
but `backlog.js` never read `priority`, so those items still rendered
`batchable: true` in the UI. Fix was to mirror the engine in the loader (add
`item.filler`, subtract it from `item.batchable`).

**Why:** "the CLI says X" and "backlogMeta documents X" are NOT proof the UI
does X — there's no shared derivation, only two parallel ones.

**How to apply:** when a demote/tier/readiness rule appears honored in one
surface but ignored in the other, suspect a parity gap — check BOTH
`backlog.js` and `engine.mjs` implement it, don't reason from one. Related:
[[we-standard-vs-website-app-confusion]] (the "WE" that renders the backlog is
the 11ty app), and the mis-flag angle in [[naming-fork-precedent-discipline]]
(a `kind:story` with a decision-shaped body false-surfaces as batchable —
same #2014 session).
