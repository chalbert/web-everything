---
type: issue
workItem: task
parent: "382"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: design-refs/targets.json
tags: []
---

# Fix Photopea capture — tune enterAction + readySelector to reach the editor

Photopea's live capture lands on its marketing splash, not the editor; the inclusion gate currently quarantines it (parked in we:design-refs/needs-review.json). Tune its we:targets.json enterAction (the 'Start using Photopea' click-through) and readySelector so the editor surface is captured and confirmed, then re-run design-refs collect --refresh --only=photopea and verify the shot is the app, not the landing page.

## Progress (2026-06-12) — fixed, captured + confirmed

**Root cause:** the `readySelector` was `canvas`, but Photopea's editor opens on its **Home screen** (New Project / Open / Templates) which has **no `<canvas>`** — the canvas only exists once a document is open, and even then it lives inside a cross-frame iframe (the page's other iframes are all ad/tracker frames). So the inclusion gate timed out on `canvas` and quarantined the (correctly-loaded) editor as a `readySelector-miss`. The `enterAction` (`text=Start using Photopea`, which fires Photopea's `addPP()` editor loader) was already correct.

**Fix:** `we:design-refs/targets.json` — `readySelector: "canvas"` → `readySelector: "text=New Project"` (the editor Home screen's primary button — visible ~0.4s after the click-through, editor-only, never on the marketing splash which says "Start using Photopea"). Bumped `readyTimeout` 15000 → 20000 for headroom. Verified with the **exact** `we:design-refs.mjs` launch (headless, `--disable-blink-features=AutomationControlled`, no GPU flags) — no script change needed.

**Result:** `design-refs collect --refresh --only=photopea` → `✅ captured … (confirmed)`; `we:needs-review.json` now `{}` (dequarantined); corpus item `dee20f9cb23bdc97` `reviewState: confirmed`, and the screenshot is the real editor (full menubar + left sidebar + New Project/Templates, dark enterprise-dense register) — not the landing page.

> **Close-out note — repo gate red from unrelated concurrent work, not this item.** At close-out `check:standards` reports 1 error: a hidden report `we:reports/2026-06-12-design-ref-corpus-taxonomy-seed.md` (untracked, created 17:31 by a concurrent session working the #382 design-ref epic) with no `/research/` topic or `relatedReport` backlog item. #392 touched only `we:design-refs/targets.json` + the corpus the capture wrote — it added no report and changed no protocol/term counts. The fix is independently verified (capture confirmed, screenshot eyeballed). The hidden-report error belongs to whoever added that taxonomy-seed report.

**Graduated to** `we:design-refs/targets.json` — readySelector canvas→'text=New Project' (Home has no canvas); Photopea dequarantined.
