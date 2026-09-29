---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xzbfgxe-important-github-writes-retry-themselves-on-the-next-cycle-i.md", "we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2844's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xzbfgxe-important-github-writes-retry-themselves-on-the-next-cycle-i.md:30` — A review lens item: any card proposing to loosen or tighten a named refusal rule (`refuse('<rule>')`) must cite the incident id in the rule's comment and list a test pinning that incident. Not script-decidable in general; file as a lens/checklist entry.
2. `we:backlog/xzbfgxe-important-github-writes-retry-themselves-on-the-next-cycle-i.md:28` — Card-authoring checklist: for any 'run X at the top of function F' instruction, name the exact preceding call X must precede and pin that ordering in a test. Lens item; not gate-decidable.
3. `we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md:85` — When folding a review finding, grep the card for every prior statement of the same claim and for the test list entry owning that module; a card-lint check that each 'must never' guarantee names a test file matching the module it describes would be a deterministic gate.
4. `we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md:40` — Add a deterministic assertion to the fidelity suite, or a check:standards rule for any card enabling GH_DEBUG, that no Authorization or token-shaped string survives stripGhDebug output or calls.jsonl lines.
5. `we:backlog/xzbfgxe-important-github-writes-retry-themselves-on-the-next-cycle-i.md:30` — Add a review-lens checklist item, or a shared helper with a lint, that any marker-comment reader must filter by trusted author. Have the owed-flush regenerate the body from a fixed template and validate the repo against the daemon's own repo set.
6. `we:backlog/xzbfgxe-important-github-writes-retry-themselves-on-the-next-cycle-i.md:28` — Add a deterministic regression test that records two refused attempts for one PR and kind before flushing, then requires both distinct comments and the correct reconstructed heal count.
7. `we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md:49` — A standard practice or gate requiring that every declared kill switch or env-toggle must have a corresponding test case listed in the test plan proving its 'off' behavior.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2844@0390ace46e6a6aa25c7c5625ca76c579334781bd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
