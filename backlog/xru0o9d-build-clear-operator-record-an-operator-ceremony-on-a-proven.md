---
kind: story
size: 3
status: open
dateOpened: "2026-09-21"
relatedTo: ["3048"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-independence.mjs
  - we:scripts/lib/review-core.mjs
tags: [review, gate, gate-self, self-clear, review-independence, clearance]
---

# Build `clear-operator`: record an operator ceremony on a proven self-authored review:pending PR

Implement the ratified #3048 ruling (we:docs/agent/platform-decisions.md#clear-operator-proven-self-clear-only): add a `clear-operator` target to REVIEW_LABEL_TARGETS and a decideSetLabel branch in we:scripts/review-set-label.mjs, gated to fire only when decideClearerIndependence reads SELF_CLEAR (never a general review:pending bypass); inherit the --actor/--reason honesty tax; add the third durable-comment phrasing; add tests for the new refusal/accept paths and that INVARIANT 2 (review:human) is untouched; fix the two refusal messages in we:scripts/lib/review-independence.mjs so they stop pointing at each other; and (the review-seam half) reword the independence claim in we:scripts/lib/review-core.mjs:351 and durably log the reviewing session id alongside its verdict.

## Done when

1. **Executable** — given a fixture PR that is `OPEN`, carries `review:pending`, and whose `authored-by-actor`
   equals the clearing session's `CLAUDE_CODE_SESSION_ID`, `node we:scripts/review-set-label.mjs <n> --to=clear-operator --actor=<name> --reason=<...>` exits 0, adds `review:accepted`, and removes `review:pending` — no raw `gh` call, no second session.
2. **Executable** — a test asserts `--to=clear-operator` is refused (non-zero exit, no label/comment mutation) on a fixture PR whose independence reads anything other than `SELF_CLEAR` (proven non-self-authored, or unknown).
3. **Executable** — a test asserts the existing `review:human` refusals are unchanged: `--to=clear-operator` never removes `review:human`, and `--to=accepted`/`--to=clear-human` behave exactly as before (INVARIANT 2 untouched).
4. **Observable** — the durable PR comment for a `clear-operator` clearance names the operator (`--actor`), quotes the `--reason` verbatim, and reads distinctly from the existing "a human ceremony cleared it" / "an established-independent agent cleared it" phrasings (e.g. "an operator ceremony cleared it (review:pending tier, proven self-authored)").
5. **Observable** — the two existing refusal messages (self-clear refused; no `review:human` label to clear) no longer name a route that cannot work from the refusing context.
6. **Executable** — we:scripts/lib/review-core.mjs's prompt (currently at line 351) no longer asserts reviewer-actor independence it cannot prove (reworded to a fresh-context claim only), and the reviewing session's `CLAUDE_CODE_SESSION_ID` is durably logged alongside its verdict wherever that verdict is posted to an open PR.
