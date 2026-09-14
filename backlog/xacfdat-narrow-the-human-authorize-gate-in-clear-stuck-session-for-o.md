---
kind: decision
status: open
scope: ["we:scripts/operations/clear-stuck-session.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Narrow the human authorize gate in clear-stuck-session for one deterministic dead-session signature?

we:scripts/operations/clear-stuck-session.mjs deliberately hard-codes a human authorize step (of: 'operator') before clearing a stuck background session, because clearing touches ~/.claude state that is not git-tracked or recoverable — a bad auto-clear cannot be undone. On 2026-09-13, 5 sessions (fix-2056, fix-2045, fix-2106, fix-2083, review-2121) were independently confirmed dead via the exact same signature: Claude Code harness bug #77683 — never reports a pid, no live process, no run-store binding. All 5 came back confirmedStuck: true with zero ambiguity and were manually cleared after real human confirmation. Idea to prepare (not decide): narrow, not remove, the human gate — could a scoped, deterministic auto-clear someday be safe for this ONE exact signature (no pid ever reported + no matching live process + no run-store binding), but only after a track record of enough manually-confirmed clears with zero surprises to trust the signature has no false-positive history? Ties to memory rule #51 'Hookable vs Judgment Rule' (script-decidable -> hook; judgment stays in context until proven safe) — this is currently judgment, proposed to graduate to a hook once trust is earned, not before. Open questions for a future /prepare-decision-item pass: (1) how many manually-confirmed clears should be the bar before considering automation; (2) can the signature be made airtight enough to trust unattended, or are there false-positive edge cases; (3) what is the actual blast radius of a false positive — can a wrongly-cleared session's cleared-marker state be un-cleared if it turns out to matter; (4) should this ever fully graduate to a hook, or is a lighter partial narrowing the realistic ceiling. Filed as status: open / unprepared — captures the idea and open questions faithfully, does not resolve the decision.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
