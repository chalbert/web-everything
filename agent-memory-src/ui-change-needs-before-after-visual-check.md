---
name: ui-change-needs-before-after-visual-check
description: "Touching UI/CSS REQUIRES a Playwright before/after visual check on the running dev server — capture the affected pages BEFORE the edit (ref) and AFTER, compare. Catches regressions the standards gate can't see."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 76b5c1a9-019a-4c4d-a34a-85e7989511e1
---

When a change touches UI — CSS (esp. removing/altering a shared rule), templates, or component markup —
**always do a Playwright before/after on the affected pages against the already-running dev server**
(don't kill/spin one; probe :3000 or :8080). Capture a reference screenshot BEFORE the edit, the same
shots AFTER, and compare (a computed-style probe on the key surface — `bg`/`border`/`radius`/`padding` —
makes the diff objective, not just eyeballing).

**Why:** batch-2026-06-29d's #1895 removed the `.section-card`/`.standard-card` frame as "dead CSS" on the
false premise that every such surface also carried `.fui-card`. It didn't — ~14 templates use those classes
bare — so the white container vanished from `/backlog/NNN/` and other pages. `npm run check:standards`
passed (it doesn't render), and no one looked at the pages. A before/after on one sample page would have
caught it in seconds. A "dead CSS" removal is the classic trap: grep EVERY consumer of the class, and
visually verify a sample of the surfaces that use it.

**How to apply:** for any UI-touching item, the close-out gate is NOT enough — add the visual before/after.
The durable tooling for this is the interim visual-regression guard (Playwright `toHaveScreenshot`, committed
baselines) tracked under epic #800 / decision #799 ([[workflow-crossrepo-lanes-falsedrop]] is unrelated; this
is its own follow-up). Until that lands, do the before/after by hand each time.
