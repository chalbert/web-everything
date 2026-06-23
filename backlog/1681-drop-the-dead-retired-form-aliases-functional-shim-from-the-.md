---
kind: task
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "fui:tools/gen-wrapper/wrapperFormCatalog.mjs"
tags: []
---

# Drop the dead RETIRED_FORM_ALIASES.functional shim from the FUI wrapper catalog

Ratified #1619 Fork-1: the authoring functional form keeps WE id `functional`, and FUI's retired `functional`->react-wrapper wrapper alias has zero real callers (only its own deprecation tests), so the backward-compat shim is dead weight. Remove `RETIRED_FORM_ALIASES.functional` from `fui:tools/gen-wrapper/wrapperFormCatalog.mjs` plus its 2 deprecation tests (`fui:tools/maas/__tests__/wrapperServeHandler.test.mjs:82`, `fui:tools/gen-wrapper/__tests__/wrapperFormCatalog.test.mjs:50-62`). Drops the courtesy redirect only; #977's retirement (functional not a WRAPPER_FORMS member) stands.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Dropped the `functional` entry, scope-faithfully (the courtesy redirect only):

- **`fui:tools/gen-wrapper/wrapperFormCatalog.mjs`** — emptied `RETIRED_FORM_ALIASES` (`{ functional:
  'react-wrapper' }` → `{}`) and rewrote its doc to note the lone entry was dropped by #1681. Kept the
  generic registry + its `aliasedFrom`/lossy handling as the (now-empty) extension point for any future
  retirement — the scope is "drops the courtesy redirect only," not ripping out the alias machinery.
- **Removed the 2 deprecation tests** — `fui:tools/gen-wrapper/__tests__/wrapperFormCatalog.test.mjs` (the
  fold-to-react-wrapper + serve-records-alias cases, plus the now-unused `RETIRED_FORM_ALIASES` import) and
  `fui:tools/maas/__tests__/wrapperServeHandler.test.mjs` (the `?form=functional` 302-lossy case).
- Updated the stale `functional → react-wrapper` comments in
  `fui:tools/maas/wrapperServeHandler.mjs` and `fui:tools/gen-wrapper/wrapperFormCatalog.d.ts`.

A `?form=functional` request now 400s (Unknown form) instead of folding to react-wrapper — correct, since
#1619 made the authoring `functional` a wholly separate id (landed #1602) and no real caller used the
consume-mode alias. FUI gate green (0 errors); the 22 affected tests pass. #977's retirement stands.
