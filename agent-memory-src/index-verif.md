---
name: index-verif
description: Proving claims before asserting them: run the real probe (browser for UI) before naming a cause, prove-before-claiming-fixed, verify grounding claims before ratifying, a resolved blocker may be a false edge, cross-locus preflight, verify a mechanism has a consumer, verify a closed set member-by-member, distrust bulk LLM classification. Recall when about to assert a cause, a fix, or a closure, or to verify an assumption.
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
- [Ready-to-merge label ≠ proof of work](ready-to-merge-label-is-not-proof-of-work.md) — a lane's `ready-to-merge`/`resolved` ≠ impl exists; diff-scope the PR (touches declared impl files, not just backlog .md) before trusting/landing; #2403
- [Verify "ratified #NNNN" against live status](verify-ratified-citation-against-live-status.md) — "per ratified #NNNN" can be false; check the cited item's status, encode blockedBy if active; #2027
