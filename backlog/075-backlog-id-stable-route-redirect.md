---
type: idea
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-06"
tags: [backlog, routing, build, dx]
crossRef: { url: /backlog/, label: Backlog index }
---

# Make the backlog slug cosmetic — stable `/backlog/<NNN>/` route + redirect so renames never break links

The id migration ([Option B](/backlog/)) put a stable `NNN` number in every backlog URL, but the slug is still part of the canonical path (`/backlog/<NNN>-<slug>/`). So **editing a slug still changes the URL** and breaks any link that used the old one — the number is stable, the URL is not.

Close that gap: make the `<NNN>` the real routing key and the slug purely cosmetic, so a reword never breaks a link. Two ways in static 11ty: (a) emit a stable `/backlog/<NNN>/` permalink that redirects to the current `<NNN>-<slug>/`, or (b) generate an alias/redirect from the *old* slug URL on rename (e.g. an `eleventy-plugin-redirectfrom`-style map). Either lets cross-refs cite `/backlog/<NNN>/` and survive slug edits. Deferred from the migration session (2026-06-06) — the `NNN`-in-URL scheme shipped; this is the rename-safety layer on top.

## Progress

- **Status:** resolved — both rename-safety layers ship and verified end-to-end (2026-06-06).
- **Done:**
  - **Approach (a) — number-only stable route:** `src/backlog-redirects.njk` emits one page per item at `/backlog/<NNN>/` (`permalink: backlog/{{ item.num }}/`) that meta-refresh + `location.replace` redirects to canonical `/backlog/<NNN>-<slug>/`. Verified: clean `eleventy` build writes `_site/backlog/075/index.html` → canonical (which exists); live server returns `200` for `/backlog/075/`; exactly one redirect per real item.
  - **Approach (b) — old-slug back-compat:** `src/backlog-slug-redirects.njk` + `src/_data/backlogAliases.js` paginate each item's `formerSlugs:` into `/backlog/<former>/` redirects. (The pre-NNN backfill of `formerSlugs` data was its own item, #114, now resolved.)
  - `check:standards` validates both (collision/duplicate-alias guards in `scripts/check-standards.mjs`). No #075-related errors.
- **Notes:**
  - The slug is now purely cosmetic — a reword moves the canonical page and `/backlog/<NNN>/` tracks it, so cited number-URLs never break.
  - Stale numeric dirs in `_site/backlog/` (e.g. for deleted item numbers) are eleventy not purging old output, not a redirect defect — a fresh `rm -rf _site` build emits exactly one redirect per live item.
