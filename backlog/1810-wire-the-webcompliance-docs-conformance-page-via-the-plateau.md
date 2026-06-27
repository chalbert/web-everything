---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1809"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "we:demos/webcompliance-conformance-demo.html"
tags: []
---

# Wire the webcompliance docs conformance page via the plateau iframe

C4 of the webcompliance relocation cascade (#1294). Register webcompliance in the generic EMBED_SUITES registry (plateau:src/conformance-engine/embedSuites.ts, the #1801 infra) and create the we:demos/webcompliance-conformance-demo page that embeds the plateau-hosted conformance iframe (?suite=webcompliance) running the vector suite against the FUI binding. webcompliance has no existing demo, so this creates the visible plateau-origin docs surface. Blocked on the binding + vectors (C3).

## Progress

- **Status:** resolved
- **Done:** added the `webcompliance` entry to `plateau:src/conformance-engine/embedSuites.ts` (one-line registry add, the #1801 generic infra). Created `we:demos/webcompliance-conformance-demo.html` + `we:demos/webcompliance-conformance-demo.ts` (embeds the plateau iframe cross-origin with `?suite=webcompliance`, reflects the posted result via `setPlaygroundReady`) + the demo catalog JSON.
- **Verified (live, against the running servers):** the WE demo at :3000 embeds the plateau iframe at :4000 → **6/6 webcompliance vectors green**, `window.playgroundReady=true, playgroundPass=6`, no console errors. Plateau tsc clean · WE check:standards 0 errors.
- **Next:** C5 (#1815) deletes the WE runtime — the cascade's end.
- **Notes:** the 11ty docs build currently fails on a **concurrent session's** broken template (`we:src/_includes/research-descriptions/html-first-composition-strategies.njk`, #1795) — unrelated to this work (my demo JSON loads fine; the build reaches rendering and trips on that njk). Not this work's stop.
