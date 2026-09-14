---
bornAs: xacfdat
kind: decision
status: open
scope: ["we:scripts/operations/clear-stuck-session.mjs"]
dateOpened: "2026-09-14"
tags: []
crossRef: { url: /backlog/2881-subagent-stall-harness-backstop-detect-auto-clear-a-stuck-ba/, label: "related — #2881 is the general stuck background-wait subagent detect/auto-clear backstop; this item narrows one specific tool's (clear-stuck-session.mjs) human gate for one exact dead-session signature" }
---

# Narrow the human authorize gate in clear-stuck-session for one deterministic dead-session signature?

we:scripts/operations/clear-stuck-session.mjs deliberately hard-codes a human authorize step (of: 'operator') before clearing a stuck background session, because clearing touches ~/.claude state that is not git-tracked or recoverable — a bad auto-clear cannot be undone. On 2026-09-13, 5 sessions (fix-2056, fix-2045, fix-2106, fix-2083, review-2121) were independently confirmed dead via the exact same signature: Claude Code harness bug #77683 — never reports a pid, no live process, no run-store binding. All 5 came back confirmedStuck: true with zero ambiguity and were manually cleared after real human confirmation. Idea to prepare (not decide): narrow, not remove, the human gate — could a scoped, deterministic auto-clear someday be safe for this ONE exact signature (no pid ever reported + no matching live process + no run-store binding), but only after a track record of enough manually-confirmed clears with zero surprises to trust the signature has no false-positive history? Ties to memory rule #51 'Hookable vs Judgment Rule' (script-decidable -> hook; judgment stays in context until proven safe) — this is currently judgment, proposed to graduate to a hook once trust is earned, not before. Open questions for a future /prepare-decision-item pass: (1) how many manually-confirmed clears should be the bar before considering automation; (2) can the signature be made airtight enough to trust unattended, or are there false-positive edge cases; (3) what is the actual blast radius of a false positive — can a wrongly-cleared session's cleared-marker state be un-cleared if it turns out to matter; (4) should this ever fully graduate to a hook, or is a lighter partial narrowing the realistic ceiling. Filed as status: open / unprepared — captures the idea and open questions faithfully, does not resolve the decision.

## Recommended data-collection design (operator-reviewed direction, not a ratification)

The operator has reviewed and approved the mechanism below as the recommended direction. This is not
a ruling on the decision itself — the item stays `status: open`/unprepared, and the numeric bar below
is deliberately left unset for the future `/prepare-decision-item` pass.

1. **Reuse the existing scorecard pattern, don't invent a new mechanism.** This repo already solved a
   structurally identical problem for model-probation graduation (`#3654`,
   `we:scripts/conveyor/run-scorecards.json` — real trial-outcome data feeding a graduation bar, not a
   guessed number). `we:scripts/operations/clear-stuck-session.mjs` should grow a similar durable
   scorecard: every invocation logs its signature fingerprint (no pid ever reported + no live process +
   no run-store binding), a timestamp, and the human's verdict — mechanically, as a side effect of the
   tool running, never a manually-maintained log.
2. **Define "surprise" concretely, not just "clean clear."** A clear only proves the signature safe if
   nothing broke later. Of tonight's 5 sessions, 2 (`fix-2083`, `review-2121`) turned out to have real
   unresolved PR questions underneath — a duplicate-PR judgment call and an unresolved run-record effect
   — that the clear itself did not resolve. The scorecard should track a follow-up check: if a cleared
   session's underlying PR/backlog item resurfaces as broken, blocked, or reopened within some window
   after the clear, that counts as a "surprise" and should reset/penalize the trust count for that
   signature, never be silently ignored.
3. **The specific numeric bar is intentionally left open.** How many clean clears should be required
   before graduating to auto-clear, and how long the surprise-window should run, are real judgment
   calls for the future `/prepare-decision-item` pass, informed by whatever scorecard data has
   accumulated by then — per this repo's "never take an unprepared decision" rule, no number is guessed
   here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
