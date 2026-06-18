---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
parent: "746"
relatedProject: webadapters
tags: [maas, polyglot, protocol, ergonomics]
---

# MaaS serve-path presets — named bundle of params instead of a long query list

Idea: as the MaaS serve-path param surface grows (`form`/`target`/`strategy` plus catalog values like `react-wrapper`,
and whatever experience adds — see #978), passing the full list on every request gets unwieldy. Add a server-named
**preset** — a request names one preset id that expands to a fixed param set the origin holds, instead of spelling out
every param. Open design questions deferred: where it lives (a `preset` query param vs a route segment), whether it's
neutral-contract or an injected catalog like `form`, how it composes with explicit params, and how it folds into the
content-hash identity. Early/provisional — likely a deliberate `servePathIR` version bump if it lands.

Cross-refs: provisional protocol ruling [#974], standing experience review [#978], FUI catalog registration [#977].
