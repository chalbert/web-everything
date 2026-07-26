---
kind: story
size: 5
parent: "2636"
status: open
blockedBy: ["xuqbibk"]
scope: ["we:scripts/lib", "we:scripts"]
dateOpened: "2026-07-26"
tags: [jury, disposition, auto-land, shadow]
relatedTo: ["2652", "2651", "2668"]
---

# Auto-land seam for clean auto-dispositions, defaulting to SHADOW mode

Connect a clean auto-dispose outcome to the `review:accepted` label write
(`we:scripts/review-set-label.mjs` `decideSetLabel`) so the drain merges it — closing the loop from
jury verdict to landed PR. Blocks on the judge-wiring seam (the sibling card) that produces the
disposition; this card is the final write step behind it.

## CRITICAL RULING (ratified) — SHADOW mode is the default

This seam defaults to **SHADOW mode**: the judge LOGS what it WOULD dispose (a ledger entry / PR comment)
while a HUMAN still clears the PR, for a confidence-building period. It does **not** write
`review:accepted` on its own until the flip.

- A config level `shadow | enforce` on the #2651 disposition-config gates the flip from shadow to
  enforcing. Flipping it to `enforce` is a **separate one-line ruling later**, not part of this card.
- In `shadow` the seam observes and records only; in `enforce` a clean auto-dispose writes
  `review:accepted` via `decideSetLabel` and the drain lands it with no human in the loop.

## Safety rails (never auto-land these)

- **Never** auto-lands a red-judge-refused PR (`redRefute` fired) — that stays parked `review:human`.
- **Never** auto-lands a gate-self / statute-touching PR — the producer rubric already parks those; the
  auto-land seam must not override that park (relates to #2668, the drain/queue certification concern).

## Acceptance

- With config `shadow` (default), a clean auto-dispose logs its intended disposition but writes no label;
  a human still clears.
- With config `enforce`, a clean auto-dispose writes `review:accepted` and the drain merges it.
- A red-refused or gate-self PR is never auto-landed under either mode.

Relates to #2652 (the judge), #2651 (the disposition-config that carries the shadow|enforce level),
#2668 (drain certification of an accepted PR).

locus: we
