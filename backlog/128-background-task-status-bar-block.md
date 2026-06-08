---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-07"
graduatedTo: "blocks.json#background-task-surface"
tags: [block, background-task, status-bar, async, layout, surface, ux]
relatedProject: webintents
crossRef: { url: /intents/background-task/, label: Background Task Intent }
---

# Implement the Background Task surface as a block

The [Background Task Intent](/intents/background-task/) defines the *contract* for the persistent surface that hosts go-async tasks (aggregation, persistence, navigation-guard, lifecycle). It declares **what** should be true; nothing yet **implements** it. This item is the implementing block — the status-bar surface itself.

Scope:
- An app-shell region (composes the [Layout Intent](/intents/layout/) as a `dock`) that renders one entry per registered background task with per-task progress.
- Reuses the [Loader Intent](/intents/loader/) state machine for per-task progress (determinate/indeterminate, version token, lifecycle) — the same machine, hosted off-view.
- Exposes per-task retry delegating to the [Reliability Intent](/intents/reliability/); one task's failure does not abort the batch.
- Arms the `beforeunload` / route-leave warning while any task is `active` (composing the navigation-guard — see #129).
- May emit a [Feedback Intent](/intents/feedback/) toast on completion.

Open questions for implementation:
- The registration API: how a Loader hands a task off at `escalation: async`, and how the surface discovers tasks (injector context vs. event bus).
- Whether the surface is a single global block or composable per-shell.
- Persistence storage — does an in-flight task survive a full page reload (Background Fetch / service worker territory) or only client-side route changes?

Surfaced authoring the Background Task Intent (#113).

## Progress

- **Status:** resolved — graduated to `blocks.json#background-task-surface` + `src/_includes/block-descriptions/background-task-surface.njk`.
- **Branch:** docs/standard-authoring-workflow
- **Done:** Authored the `background-task-surface` block (status `draft`, type `Component`) — implementsIntent `background-task`; composesIntents loader/reliability/layout/feedback; webStandards, events, designDecisions, traits. Wrote its description page. Resolved all three open questions (see below). check:standards green (0 errors); page renders 200 at /blocks/background-task-surface/ and appears in the intent's reverse-lookup.
- **Next:** Done. Follow-ons split out: #135 (runtime implementation, draft→active) and #134 (reload-durable tier).
- **Notes — decisions (trace on the standard's designDecisions):** (1) registration = bubbling `background-task-register` event, not injector — fixed mechanic (outlives the view). (2) nearest-ancestor surface resolution, global-by-default — fixed mechanic. (3) durability = route-only baseline + opt-in `durability: reload` adapter (Background Fetch/SW) — exposed as a dimension because both branches are legitimate per product. Rule recorded: a fork becomes a configurable dimension only when both branches are legitimate end-states; otherwise it stays a fixed mechanic. #129 owns the navigation-guard harvest the guard composes.
