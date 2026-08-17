---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# Console quick-accept button moved to always-visible spot, easier misclick on a parked review

Surfaced by the independent review of plateau-app PR #143 (WE #3036's impl half). The quick Accept/Request-changes buttons moved from inside the expand panel -- where they rendered only for a live reviewClass of pending/human -- to the always-visible .parked-head row for every parked item. Not a real hole: decideSetLabel re-observes live labels at write time (server-side invariant), so a stale client snapshot can't force a wrong verdict through. But it is a materially easier misclick than before -- one click plus a confirm() on a row that used to require expanding first. Worth a small UX fix (re-gate visibility on the live reviewClass, or add a confirmation step proportional to the row staying collapsed) under epic #3029's console surface.

## Done when

1. **Executable** — a test asserts the quick Accept/Request-changes controls on a `.parked-head` row are only rendered (or only enabled) when the row's live `reviewClass` is `pending`/`human` for that specific item, matching the pre-move gating — fails today (the controls render unconditionally on every parked row), passes once re-gated.
2. If re-gating isn't the chosen fix, an alternative: a confirmation step is added proportional to the row being collapsed (e.g. the confirm() dialog names the PR and its current label explicitly) — a test asserts the confirmation text is specific, not generic.
3. `npm run check:standards` is 0 errors and the relevant new/updated test file is green.
