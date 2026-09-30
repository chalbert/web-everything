---
bornAs: xr8m6gs
kind: story
locus: plateau-app
size: 5
status: open
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "plateau-app:src/wip/types.ts", "plateau-app:src/wip/wip-read.ts", "plateau-app:src/wip/wip-model.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.css", "plateau-app:src/wip/wip-source.ts", "plateau-app:src/wip/wip-live.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/progress-read.test.ts", "plateau-app:src/wip/wip-model.test.ts", "plateau-app:src/wip/wip-view.test.ts", "plateau-app:src/wip/wip-relay-contract.test.ts", "plateau-app:scripts/wip-publish.ts", "plateau-app:wip-relay.js"]
dateOpened: "2026-09-30"
tags: []
---

# Ship a progress-first Plateau overview that replaces the manual plan scoreboard

Automatically show what is moving, observed landings today, a short trend and current priorities before machine-owned blockers. This is the smallest useful replacement for the hand-maintained plan scoreboard; full design: we:docs/agent/plateau-progress-view.md.
## Design

Follow we:docs/agent/plateau-progress-view.md. WE owns the declarative wire contract and examples; Plateau owns adapters, aggregation, relay and UI. Keep the existing publisher/relay, 120-second baseline, source ages and explicit unknown/partial states. No display-driven GitHub calls. One plain description per row, fully wrapped, never ellipsis. System-owned failures remain flow state.

## MVP

Define schema 2 and declarative examples first. Render moving logical-work/jobs counts from existing running observations; show observed local drain merges today and trailing-hour comparison with provenance and partial coverage. Never invent repo identity for old drain rows or count session completions as merges. Publish selected external plan priorities/rules read-only with source date and unresolved conflict warnings. Keep pending review, red CI and bookkeeping under Flow; only explicit human review/ready forks/human-only escalation enter Needs you. Preserve existing fork links. Consume persisted PR snapshots without invoking their refreshing accessor; missing data stays unknown. New proposed adapter: plateau-app:src/wip/progress-read.ts. Deploy relay/schema consumers before publisher activation.

## Done when

1. Fixture-backed rendering places Progress, Moving and Landed before Flow/Needs you; a pending-review/red-CI fixture produces no human action without escalation.
2. Every first-screen count has explicit units and source freshness; cold history says collecting history, and incomplete merge coverage never says all repos complete.
3. The plan projection is read-only and source-labelled; no copied limit is asserted as actual runtime state.
4. At 320px and 390px descriptions wrap in full with no ellipsis or line-clamp; existing decision links work.

## Test and proof

Run focused Plateau model, view, source and relay contract tests, plus rendered a11y and a publisher-to-relay browser probe. Add meaningful fixtures for partial drain history, stale PR cache, missing trend baseline and conflicting plan sections. Record gh-spend before/after two publish cycles and a second tab: no new GitHub calls from this collector. Compare the resulting phone screen to the manual scoreboard using the same observed window.

## Readiness and follow-ups

Filed with `--queue=false`: design reviewed by the operator and producer seams proven during preparation before scheduling. No prepared stamp is claimed. Scope lists predicted files, including new adapters and tests; revise it during preparation if an existing producer needs a separate change. Record testing lessons and uncovered producer gaps here, not in shared agent docs.

Design-job verification (2026-09-30): all six scoped card checks passed and the diff whitespace check passed. The required lane verifier was invoked, but the sandbox refused its marker write under we:.git/; its documented marker-free run also failed acquiring the host-wide admission lock outside the writable checkout. The standards command hit the same lock restriction. Full lane/standards verification remains required in a permitted environment; no admission bypass or test weakening was applied.
