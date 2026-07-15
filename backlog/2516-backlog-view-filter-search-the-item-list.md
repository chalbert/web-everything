---
bornAs: xhffxav
kind: story
size: 5
parent: "2505"
status: resolved
dateOpened: "2026-07-15"
dateResolved: "2026-07-15"
graduatedTo: none
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: filter + search the item list

Filter and search the backlog list — narrow the rows by status, kind, and tag, and match a free-text query against id / title / summary. At the scale of a real repo's backlog (thousands of items) an unfiltered list isn't browsable, so this is what makes the read view actually usable. Filtering is client-side over the already-loaded list rows; the served endpoint stays a plain list.

**Acceptance:** combinable status / kind / tag filters plus a text query; the count reflects the filtered set; clearing restores the full list; a no-match state is honest ("no items match"), never blank.
