---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [backlog, routing, build, dx]
crossRef: { url: /backlog/, label: Backlog index }
---

# Make the backlog slug cosmetic — stable `/backlog/<NNN>/` route + redirect so renames never break links

The id migration ([Option B](/backlog/)) put a stable `NNN` number in every backlog URL, but the slug is still part of the canonical path (`/backlog/<NNN>-<slug>/`). So **editing a slug still changes the URL** and breaks any link that used the old one — the number is stable, the URL is not.

Close that gap: make the `<NNN>` the real routing key and the slug purely cosmetic, so a reword never breaks a link. Two ways in static 11ty: (a) emit a stable `/backlog/<NNN>/` permalink that redirects to the current `<NNN>-<slug>/`, or (b) generate an alias/redirect from the *old* slug URL on rename (e.g. an `eleventy-plugin-redirectfrom`-style map). Either lets cross-refs cite `/backlog/<NNN>/` and survive slug edits. Deferred from the migration session (2026-06-06) — the `NNN`-in-URL scheme shipped; this is the rename-safety layer on top.
