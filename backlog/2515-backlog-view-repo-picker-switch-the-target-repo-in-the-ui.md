---
bornAs: xflsk1n
kind: story
size: 3
parent: "2472"
status: resolved
dateOpened: "2026-07-15"
dateResolved: "2026-07-15"
graduatedTo: none
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: repo picker — switch the target repo in the UI

Surface the configurable repo seam as a UI switcher. v1 reads one repo through a single configurable input; this exposes that as an in-app picker so a reader can switch which repo's backlog the view loads — the first concrete step toward the multi-project console. Read-only.

**Acceptance:** a repo picker lists the configured repos and switching reloads the list / detail against the chosen repo; the current repo is reflected in the view and the URL (`?repo=`); an unknown / unavailable repo shows an honest error.
