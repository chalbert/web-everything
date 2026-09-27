---
kind: epic
status: open
dateOpened: "2026-09-27"
tags: []
---

# Configurable, combinable delivery and testing strategies, routed by risk and complexity

Product vision (operator, 2026-09-27): Plateau offers several delivery strategies (full Definition-of-Ready prepare-review-build, rapid prototype delivery, a fast blocker lane) and testing strategies (shadow/dry-run in parallel, edge/canary, soak replay), configurable and combinable; routing to one or another is manual or automatic based on risk and complexity. Built on top of a config-driven workflow engine (related: the flows-as-configuration decision, #4219). Cross-constellation placement (WE=standard, FrontierUI=impl, plateau-app=product) is genuinely unsettled — filed here pending a decided home; the product surface likely belongs in plateau-app, a shared engine in FrontierUI, and only a reusable protocol in WE.

## Today's evidence — early instances of "a delivery/testing strategy", already live piecemeal

None of this was built as a named "strategy" yet — it is scattered mechanism the epic would name and make
combinable/routable:

- **Full-DoR delivery lane.** The "fixes need a prepared card" agent memory (this session, 2026-09-27): file → prepare →
  light review → dispatch on the card + generic brief. First instance under trial is
  we:backlog/xasdfvs-run-rating-record-whether-an-item-was-prepared-dor-before-bu.md, which will compare it
  against bespoke-prompt dispatch in the run-rating report.
- **Fast blocker lane.** we:scripts/conveyor/fix-dispatch-claim.mjs and
  we:scripts/conveyor/reconcile-fix-dispatch.mjs already run a distinct, tighter-time-boxed dispatch path for
  fixes — a real (if unnamed) second delivery strategy alongside full-DoR build dispatch.
- **Shadow/dry-run testing.** PR #2813 (merged today, "draft-first PRs: open agent PRs as drafts, promote on
  green CI") — every agent PR now runs its checks in draft before a real review starts, i.e. a dry-run gate
  in parallel with the delivery path. we:scripts/conveyor/build-dispatch-policy.mjs (PR #2814, merged today)
  also ships its own `--dry-run` mode as a read-only rehearsal of the same daemon's live behavior.
- **Edge/canary testing.** we:scripts/conveyor/canary.mjs and we:scripts/conveyor/canary-stages.mjs already
  give a daemon-change worker a canary run before a full rollout — an existing edge/canary overlay this epic
  would generalize into a configurable testing strategy rather than a one-off tool.
- **Config-driven workflow engine.** The flows-as-configuration decision (#4219, prepared, parent #4075) is
  building the underlying engine (declared flows over step logic) this epic's strategies would be expressed
  as configuration on top of, once ratified.

## Done when

This is a vision epic with no single executable acceptance check — it resolves the normal way for an epic,
by every sliced child card resolving (rule: resolve-epic-by-parent-edges). First step is slicing: name the
delivery-strategy axis, the testing-strategy axis, and the risk/complexity router as separate forks/slices
rather than one story, per the split-backlog-item method.
