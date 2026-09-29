---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2974's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/merge-ai-prs.mjs:3851` — Add a before/after cost test that runs with a warm `WE_PR_SNAPSHOT_DIR` snapshot (snapshot enabled). Alternatively, when the snapshot is servable for a repo, prefer it over the live rows for the context and widen the candidate listing's `--json` only when it is not. A gh-call-count fixture running under both snapshot modes would catch this class.
2. `we:scripts/merge-ai-prs.mjs:4137` — Add a deterministic CLI regression test with more than OPEN_PR_LIST_LIMIT off-base PRs preceding an eligible requested-base PR, and require that candidate to remain discoverable; preserve candidate completeness through pagination or a filtered fallback when the raw listing is truncated.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2974@231c3429288e74c55e0a4b1bfd364a20f379218d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
