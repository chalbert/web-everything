---
bornAs: xx15niz
kind: story
size: 2
status: open
dateOpened: "2026-08-08"
tags: [review, converge-loop]
relatedTo: ["2908", "2324"]
---

# The PR body's escalation-reason block is stamped once and never refreshed, so a re-score can leave it stale-low

The `## Escalation reason` block is written only when the marker is ABSENT — both writers guard on
`bodyHasEscalationReason` (we:scripts/pr-land.mjs, we:scripts/merge-ai-prs.mjs). A later re-park that scores MORE
reasons updates the drain's park comment but cannot update the block, so the block is a snapshot of the FIRST
park. Since #2908 the block is write-authorizing — the converge loop bands on it — so a stale-LOW block is a
fail-open: it can read `low` (editor may push) on a PR the drain has since scored `elevated` or `high`.

**Observed, live, on the PR the #2908 ruling is built on.** PR #1018's body block lists ONE reason —
`blast-radius (…)` — while the drain's park comment on the same PR lists
`[blast-radius (…); size (602 ≥ 400 changed lines)]`. Parsed deterministically the block bands `elevated`; the
comment's set bands `high`. The live run's own log recorded `care: elevated`, i.e. it acted on the stale block.
(Both are review-only, so #1018 took no harm — the general shape is what matters: drop `blast-radius` from that
pair and the stale block reads `low`.)

Surfaced at the PR #1106 review while closing F2 (the loop now shells the deterministic parser instead of
LLM-reading the bullets, we:scripts/fetch-parked.mjs). That closes the *reading* hole and leaves this *writing*
one open — the block is now parsed exactly, and exactly parsing a stale list still yields a stale band.

Options to weigh: **(a)** make both writers REPLACE the block when the scored reason set differs (idempotent by
content, not by marker presence) — the block then always states the current score; **(b)** leave the block as the
first-park record and have consumers that need the current set read the drain's latest park comment; **(c)** move
the authoritative reason set off the body entirely, onto the jury ledger / a manifest field, and leave the body
block as human-facing prose. **(a)** looks right and smallest, but it rewrites PR bodies on every re-park, so the
edit must be content-diffed rather than fired blind.
