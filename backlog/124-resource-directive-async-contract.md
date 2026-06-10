---
type: decision
workItem: story
size: 2
parent: "070"
status: open
blockedBy: ["070"]
dateOpened: "2026-06-06"
tags: [jsx, adapters, directives, resource, async, loader, intent]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Specify the `<Resource>` directive's async contract

The directive-sugar layer (#070) shipped `<For>`/`<Show>`/`<Resource>` as reversible spellings of `<template is="for-each|if|resource">`. But unlike `for-each` and `if` — which map to **real, existing** directives the lowering compiler (#078) already understands — **`is="resource"` is net-new and has no defined behavior anywhere**. `<Resource from="@users">` currently round-trips as pure spelling; nothing says what it *does*.

Decide the async contract before `is="resource"` is more than a placeholder:

- **Slots / states.** Does `<Resource>` own a loading / error / fallback surface (e.g. child `<template is="if">`-style branches, or named slots `loading`/`error`)? SolidJS's `<Suspense>`/`<Resource>` and the loader-intent's `escalation` states are the reference points.
- **Loader Intent wiring.** `from="@…"` is an injector/context ref — does the resource resolve through the **Loader Intent** (pending/determinate/escalation) and the async-collection lifecycle, or is it its own thing? Cross-reference, don't duplicate (see [/intents/loader/](/intents/loader/)).
- **Lowering correspondence (#078).** What is the vdom-strategy equivalent `is="resource"` lifts to — an `await`/`use()` call, a `createResource()` form? Until that's defined, `crossStrategy` can't carry it.
- **Relationship to #018** (async pagination beyond load-more) and the windowed-collection seam — a resource that paginates.

Until resolved, `<Resource>` is a documented spelling with no runtime semantics beyond building the inert `<template is="resource">` element (declarative-static, like every other directive in the parked Axis-2 world). Surfaced while implementing #070.
