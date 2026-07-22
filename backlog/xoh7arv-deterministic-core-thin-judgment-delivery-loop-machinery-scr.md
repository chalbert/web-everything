---
kind: decision
size: 2
parent: "2606"
status: resolved
scaffoldedBy: "det-core-statute"
dateScaffolded: "2026-07-22"
preparedDate: "2026-07-22"
dateOpened: "2026-07-22"
dateResolved: "2026-07-22"
codifiedIn: "docs/agent/platform-decisions.md#deterministic-core-thin-judgment"
tags: [plateau-loop, conveyor, delivery, skills, scripts, hookable-vs-judgment, decision]
---

# Deterministic core, thin judgment — delivery-loop machinery scripts every script-decidable decision

Ratified 2026-07-22 (conveyor design session): in delivery-loop machinery (skills, the conveyor, the console) every script-decidable decision lives as a deterministic, tested script single-sourced in we:scripts; model judgment is reserved for judgment-shaped work; skills and UIs shell the same script, never a prose copy or second implementation. Codified as we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment.

## Ruling (2026-07-22)

Ratified in-session during the conveyor-skill design (the #2527 delivery loop: main-session dispatcher +
background delivery agents + drain-daemon landing; the throughput program #2606 is this item's parent).
The user's directive: "we should as much as possible" script.

**In delivery-loop machinery (skills, the conveyor, the console), every script-decidable decision lives as a
deterministic, tested script single-sourced in `we:scripts` — model judgment is reserved for genuinely
judgment-shaped work.**

The concrete split ratified with it:

- **Scripted (deterministic, tested, in `we:scripts`):** the dispatch plan (queue × scope-leases × free
  slots → launch/held JSON), tick state reads, merge watchers, idle/stop clocks, health checks.
- **Judgment (model work):** scope prediction (a probe agent, written to a `scope:` frontmatter field),
  building the item, escalation review, the readiness discussion with the human.

**One source.** Skills and the UI must shell the SAME scripts — never a prose copy of the rule in a skill
body, never a second implementation of the same logic in a UI server. The standing precedents this
generalizes: plateau's dev server already shells `we:scripts/readiness/scope-lease-collect.mjs` for its
`/api/scope-lease` endpoint (`plateau:vite.config.mts`), and the resident drain daemon's charter
(`plateau:tools/drain-daemon/README.md`, #2449) keeps all drain *logic* in `we:scripts` — the daemon only
schedules `we:scripts/merge-ai-prs.mjs` passes.

## Alternative considered

**Dispatch rule stated in skill prose (the conveyor skill "knows" the dispatch policy and re-derives the
plan each tick).** Rejected on merit, not cost:

- **drift between ticks** — a prose rule re-interpreted per tick gives non-reproducible dispatch decisions;
- **token cost** — every tick re-spends context re-deriving what a script computes for free;
- **untestable** — a prose policy has no unit tests, so a regression is only caught in production behaviour;
- **dead-end duplication** — when the product conveyor is built, the prose copy becomes a second
  implementation of the same rule and the two diverge (the exact drift the one-source clause forbids).

## Lineage

Extends the hookable-vs-judgment discipline (agent-memory rule 51: script-decidable → hook; judgment stays
in context — already cited by the statute's merge-risk rule) from agent-context management to
**product/skill design**: the same script-vs-judgment line now governs what the delivery-loop's skills, the
conveyor, and the console may re-derive at run time. Session 2026-07-22, conveyor design with Nicolas;
sibling filings from the same session: #2606 (parent program) and #2605. Statute home:
[we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment).
