---
name: index-verif
description: Proving claims before asserting them: run the real probe (browser for UI) before naming a cause, prove-before-claiming-fixed, verify grounding claims before ratifying, a resolved blocker may be a false edge, cross-locus preflight, verify a mechanism has a consumer, verify a closed set member-by-member, distrust bulk LLM classification, grep every symbol/file/id/count you name in prose before pushing it, a clearing session must not edit the branch it clears. Recall when about to assert a cause, a fix, or a closure, to cite a symbol or an item, to review or clear a PR, or to verify an assumption.
metadata:
  type: reference
---

Verification & Proof cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 11. Verify Closed Set Member-By-Member — check "closed at N" vs EACH subject; closure=easiest overclaim; #1816
- 19. Prep: Verify Mechanism Has A Consumer — grep consumers first; 0 callers→build-vs-defer; needs the SPECIFIC orphan
- 21. Cross-Locus Pre-flight: Read Consuming Tree — migration "flat/no fork"=hypothesis; verify first
- 22. Resolved Blocker = Maybe False Edge — cleared blockedBy ≠ proof; verify the unblocker delivered; #1355
- 52. Test Before Asserting A Cause — run the real probe (BROWSER for UI) BEFORE naming a cause; never guess; #610
- 53. Verify Grounding Claims Before Ratifying — trace a prepared default's claims to the real tree; #730
- 127. Verify Bulk LLM Classification — bulk classification ~50-75% wrong; adversarial-verify before commit; #911
- 129. Prove Before Claiming Fixed — never say 'fixed' without a runtime test on the REAL surface; #1207
- [Verify "ratified #NNNN" against live status](verify-ratified-citation-against-live-status.md) — "per ratified #NNNN" can be false; check the cited item's status, encode blockedBy if active; #2027
- [Review a parked PR against CURRENT main, not `gh pr diff`](review-parked-pr-diff-against-current-main.md) — `gh pr diff` renders the stale merge-base; siblings may have already landed most of it, so diff the head against current main to get the true review surface (a gate-self touch can be illusory); WE #798. `gh pr view`'s file/line COUNTS are stale the same way — 4 of 7 sampled PRs over-reported (#1135: 25f/+3333 vs a real 15f/+2635); use `git diff origin/main...<head>`, or `computeNetDiffSignals` in tooling
- [A clearing session must not edit the branch](clearing-session-must-not-edit-the-branch.md) — the final reviewer REPORTS (`--to=changes`), never fixes in place: committing makes you a co-author of the diff you would clear, so a third session is needed and it recurses. Nothing detects it — the `authored-by-actor` stamp names only whoever OPENED the PR; PR #1135
- [Record the changes-request before launching fix/converge](record-verdict-before-launching-converge.md) — post the `changes` verdict on the PR FIRST, then launch the loop: it moves the head out from under the review and races the `review:pending` filter; PR #1049
- [Stop hardening an unachievable guarantee](stop-hardening-an-unachievable-guarantee.md) — same finding-CLASS one layer down each converge round = the claim is unachievable by this mechanism; narrow the claim, don't harden; #2895/PR #1056
- [Grep every name you cite in prose](grep-every-name-you-cite-in-prose.md) — every symbol/file/id/count named in prose gets grepped before push, or dropped; provenance written from memory reads plausible and nothing checks it; worst in `leash: spec` files + backlog bodies; PR #1112, 7 misses / 4 rounds; gate #3026
- [A guarantee in prose is a test with the wrong syntax](a-guarantee-in-prose-is-a-test-with-the-wrong-syntax.md) — three kinds of comment: what the code DOES (delete), what it GUARANTEES (write the test instead), WHY not the alternative (keep). Ten undefended properties in one file in one week, every one with a comment describing it; enforced from the other side by `GUARANTEE_NEEDS_A_TEST_RULE` in the review mandate
- [Probe a safety claim before writing it down](probe-safety-claims-before-writing-them.md) — "cannot happen" is a claim about the WORST path, and reading the source walks the intended one; run the falsifying input, or mutate the guard and confirm a NAMED test reddens. Watch DEFAULTS — a default value quietly satisfying a check written for the explicit value cost two of three rounds on PR #1178
- 146. Prompt Sink Resists Sanitising — author data in a prompt that JUDGES that author can't be sanitised (LLM sink ≠ shell) or corroborated (existence ≠ identity); delete the channel, carry a boolean; #2457
- [A success signal from the wrapper is not the outcome](a-success-signal-from-the-wrapper-is-not-the-outcome.md) — exit codes, `ast.parse`, and `| tail -1` report on the WRAPPER, not the work; `check:standards | tail -1` returns tail's status, and a dispatched agent that declines the job exits 0 exactly like one that did it (PR #1641's resolver: 50 bytes, branch untouched, logged `ok`). Name the post-condition in the world and query THAT
