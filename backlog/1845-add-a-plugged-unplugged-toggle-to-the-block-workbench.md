---
kind: decision
size: 3
parent: "1836"
status: open
blockedBy: []
dateOpened: "2026-06-27"
tags: [plugs, unplugged, workbench, dev-experience]
---

# Decide the plugged/unplugged toggle MECHANISM for the block workbench

> **Retyped story → decision (batch-2026-06-27 pre-flight).** Grounding the workbench before building surfaced
> a load-bearing mechanism fork the original story assumed away. `blockedBy: ["1842"]` cleared (the WeakMap
> path landed: `fui:plugs/core/ElementAttachment.ts`); the residual is a design call, not a blocker.

A live "switch the rendered component between plugged and unplugged" toggle collides with two facts about the
real tree:
- **The workbench is single-realm by design.** `fui:workbench/mount.ts` states "chrome and block share **one
  document**" — the trait panel and inspector drive the stage via plain same-document `querySelector` /
  `getComputedStyle`, explicitly **no iframe, no postMessage** for the block stage.
- **Plugged is an irreversible global patch.** `fui:plugs/bootstrap.ts` patches the page realm's globals
  (`window.attributes`, `window.stores`, …). Once run, those globals **linger** — you cannot cleanly
  "un-plug" a realm.

So a same-document re-mount toggle is **not faithful**: after one plugged render, the patched globals stay, and
an "unplugged" re-mount of a plugged-only capability would **falsely appear to work** (it picks up the lingering
globals) — defeating this item's stated purpose ("show the gap"). The mechanism is therefore a real fork:

| Fork | Option | Trade |
| --- | --- | --- |
| **Toggle mechanism** | **(a) iframe-isolated stage per mode** | Correct (clean realm per mode → true gap), but breaks the same-document inspector/trait panel (needs a postMessage bridge like `fui:workbench/manifestBridge.ts`) and is bigger than size-3. |
| | (b) same-document re-mount, accept lingering globals | Cheap, but the gap demo is **incorrect** for plugged-only capabilities (false "works unplugged"). |
| | (c) page-reload per mode (query param selects bootstrap vs unplugged at load) | Correct realms, simplest, but not a *live* toggle (full reload between modes). |

**Recommended: (c)** for a faithful + cheap first cut (a reload-scoped mode is honest about the realm boundary),
with (a) as the richer follow-up if a live in-page toggle is wanted. Ratify the mechanism, then the build is a
clean slice. *Confidence: medium — (b) is defeated by the lingering-globals correctness bug; (a) vs (c) is a
live-toggle-vs-simplicity trade for the human.*
