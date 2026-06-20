---
kind: story
size: 3
status: resolved
graduatedTo: "intent:background-task"
dateOpened: "2026-06-06"
dateResolved: "2026-06-07"
tags: [background-task, status-bar, async, loader, navigation, ux, surface]
relatedReport: reports/2026-06-06-front-end-platform-book.md
relatedProject: webintents
crossRef: { url: /intents/loader/, label: Loader Intent (escalation dimension) }
---

# Persistent background-task status surface — the home for go-async tasks

The Loader Intent's `escalation: async` value says: past a platform-defined duration, a long-running task should go async — a **persistent status bar stays present, the user is free to navigate away, and a window prompt warns before they close or leave the app** (the task continues in the background). The intent declares *that this should happen*; nothing yet defines the **surface** that hosts those backgrounded tasks.

This is a distinct UX surface, not a loader: it outlives the originating view, aggregates multiple concurrent tasks (parallel uploads, each individually retryable, an error not aborting the batch — see the Loader Intent's determinate guidance), shows per-task progress, and mediates the `beforeunload`/navigation-away warning. It is **not** the Feedback Intent (transient toasts) and **not** the Loader Intent (in-view pending state).

Open questions before authoring:
- Is this a new **intent** (e.g. `background-task` — the UX contract for persistent async work), a **block/component** (the status-bar surface), or both (intent + implementing block)? Lean: an intent for the contract, then a block.
- Relationship to **Layout Intent** (it's an app-shell region) and **Feedback Intent** (both surface status) — cross-reference, don't duplicate.
- How tasks register/deregister, survive route changes, and drive the navigation/close warning — the observable contract.

Surfaced while extending the Loader Intent for #106 (loading & waiting).

## Progress

- **Status:** resolved — graduated to the [Background Task Intent](/intents/background-task/).
- **Branch:** docs/standard-authoring-workflow
- **Done:** Authored the Background Task Intent (`background-task` in `we:intents.json`, dimensions `aggregation` / `persistence` / `navigationGuard`, lifecycle + interface, composition cross-refs to Loader / Reliability / Layout / Feedback). Added the `Background Task` glossary term. Cross-linked the Loader Intent's `escalation: async` bullet to the new surface. `gen:inventory` + `check:standards` green; `/intents/background-task/` renders.
- **Next:** Implementation + the harvested guard tracked as their own items (#128, #129).
- **Notes:** Decided **both** (intent now, block deferred) per user. Loader's `escalation: async` is the handoff point *into* this surface — they compose, not a Loader dimension. Navigation-guard harvested as a separate candidate intent (#129).
