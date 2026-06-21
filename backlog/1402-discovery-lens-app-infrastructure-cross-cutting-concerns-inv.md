---
kind: story
size: 3
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [discovery, lens, infrastructure, cross-cutting, gap, book-candidate]
---

# Discovery lens — app-infrastructure cross-cutting concerns inventory

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline against the **non-visual, cross-cutting concerns** every non-trivial web app ships but no single
component owns — exactly the class a component-catalog diff (gap-sweep) can't see. Enumerate the concern
list and diff against [we:src/_data/intents/](../src/_data/intents/) +
[we:src/_data/blocks/](../src/_data/blocks/); every ❌ / partial → a card (placement-unsure → `decision`).

## Seed concern list (extend during the pass)

undo/redo · optimistic mutation · offline / sync · feature flags + experiments · telemetry / analytics
events · error boundary + recovery · permissions / capability gating · i18n + locale + RTL · theming /
design-token runtime · session + auth lifecycle · rate-limit / retry / backoff · clipboard · print /
export · deep-linking + URL state · keyboard-shortcut map · focus + a11y live-region orchestration.

Cross-check existing owners before filing (e.g. `reliability`, `locale`, `data-transfer`, `command`,
`access-control`, `permission`, `draft-persistence`) — some are covered or partial.

## Run 1 — 2026-06-21 (seed concern list + extensions)

Diffed each cross-cutting concern against [we:src/_data/intents/](../src/_data/intents/) +
[we:src/_data/blocks/](../src/_data/blocks/).

**Covered** (named owner):
- permissions / capability gating → `access-control` + `permission` intents.
- i18n + locale + RTL → `locale` + `translation` intents (+ `typography`).
- theming / design-token runtime → the **webtheme** project (+ `density`, `typography`).
- session + auth lifecycle → `web-identity` + `access-control`.
- rate-limit / retry / backoff, error boundary + recovery → `reliability` intent.
- clipboard → `data-transfer` (+ build [#007](/backlog/007-gap-11-clipboard-dnd-files-intents/)).
- deep-linking + URL state → `navigation` intent + `router` block.
- keyboard-shortcut map → `command` intent + `keyboard-shortcuts` block.
- focus + a11y live-region orchestration → `live-region-status` + `focus-containment` + `focus-delegation`
  + `accessible-name`.

**Already filed / routed (no double-file):**
- undo/redo → [#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/); optimistic
  mutation → [#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/) (verb-axis).
- offline / sync → the data-lifecycle lens
  [#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/) (offline queue + sync
  is in its seed verbs).

**Gaps filed (placement-unsure → decision):**
- **Feature flags + experiments** → [#1414](/backlog/1414-feature-flags-experiments-declarative-gating-variant-assignm/)
  — runtime rollout gating + A/B variant assignment, distinct from access-control authz; no owner.
- **Telemetry / analytics events** → [#1415](/backlog/1415-telemetry-analytics-events-declarative-event-emission-vocabu/)
  — declarative event-emission to a swappable sink; a glossary term (`analytics-event-vocabulary`) exists but
  no intent/block (partial).

**Dismissed with reason:**
- *print* → CSS `@media print` styling, not a WE component/behavior standard.
- *export* (CSV/PDF/data serialization) → a `data-transfer` / `collection-operations` **output dimension**,
  not its own standard.

## Done when

Every seeded concern has a covered / partial / ❌ verdict and each gap is a filed card or dismissed-with-reason.
**Round 1 complete (2026-06-21) — 2 cards filed (#1414 feature-flags, #1415 telemetry); the rest covered,
routed, or dismissed.**
