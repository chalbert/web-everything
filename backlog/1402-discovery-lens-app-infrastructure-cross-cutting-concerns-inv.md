---
kind: story
size: 3
parent: "1399"
status: open
dateOpened: "2026-06-21"
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

## Done when

Every seeded concern has a covered / partial / ❌ verdict and each gap is a filed card or dismissed-with-reason.
