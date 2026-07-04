---
name: ai-runs-regression-after-each-change
description: "The AI runs the RELEVANT regression lane after each change — NOT a git hook. Git hooks are the wrong fit (live-render lanes need the dev server, are slow + env-sensitive); the agent picks the lane that matches what changed."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 76b5c1a9-019a-4c4d-a34a-85e7989511e1
---

The user expects **the AI to run the regression suite after each change** — and explicitly said a **git hook
is NOT the right fit** for it.

**Why not a hook:** the high-value lanes (a11y / smoke / visual) need the running dev server, take ~10–30s
each, and are environment-sensitive. A pre-commit/pre-push hook blocking on them is fragile (server may be
down) and punishes every commit. The agent running the *matching* lane is smarter than a blanket hook.

**How to apply — after each change, run the lane(s) that match what changed (not the whole suite every time):**
- **CSS / template / component markup** → `npm run check:visual` (+ `npm run test:smoke` if structural). A
  CSS/template edit that passes `check:standards` can still break the render — that's the #1895 class. See
  [[ui-change-needs-before-after-visual-check]].
- **TS/JS logic, scripts, blocks** → `npm run test:unit` (vitest) — scope to the touched file when possible.
- **Backlog/standards/registry data** → `npm run check:standards` (the governance gate).
- **Interaction/behavior** → `npm run test:interaction`; **page health** → `npm run test:smoke`.
- **End of a multi-change session / before declaring done** → the broader sweep (vitest + the live lanes +
  check:standards). There is currently NO single aggregate command — `verify` runs vitest+cold-start+build
  but NOT the Playwright lanes; #800 / #1966 own the rendered-site lanes.

Reuse the already-running dev server (:3000/:8080) — never spin or kill one. Report failures honestly and
separate **mine** from **pre-existing** (the suite carries some pre-existing reds, e.g. a stale
graph-render count test vs the dashed-ring feature, and a flaky claim git-read-count test).
