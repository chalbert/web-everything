---
bornAs: xamy1gk
kind: story
size: 3
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Standalone prepare runs are discarded as card tampering without naming the key, and the allowed prepare keys are too narrow

Live 2026-09-30: Codex prepare runs of #3996 and #4003 through we:scripts/operations/probation-build-run.mjs both ended escalated-needs-human with "the worker edited the item's own backlog card — refusing" (~line 398), and the prepared text was discarded (resultDiscarded: true). In preparing mode the check is frontmatterTamperedBeyondClaim against PREPARE_OWNED_FRONTMATTER_KEYS = scope, preparedDate, preparedAgainstSha (we:scripts/lib/probation-launcher.mjs:208), so correcting any other factual frontmatter (size, blockedBy, and similar) — which the new prepare brief from #4658 now asks for — throws the whole prepare away, and the refusal never says which key changed. Fix: (1) the refusal names each changed key with before/after and keeps the worker diff for inspection; (2) decide and widen the prepare-owned set to the keys a prepare legitimately corrects (at least size and blockedBy), still refusing status, dateStarted, dateResolved and other claim/lifecycle keys; (3) same rule for the builder prepare path if it shares it. Proof: rerun #3996 and #4003 prepares and show stamped cards, plus a test that a status: edit is still refused.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Operator ruling — 2026-10-03 (ratified, verbatim)

No ruling operation exists for a non-decision card (checked `we:scripts/operations/` and the `we:scripts/backlog.mjs` verbs), so the ruling is recorded here in the body; no lifecycle field was touched.

Question: may a prepare worker change a card's `size` and `blockedBy`?

1. Operator answer: "Seems that it would need to be"
2. Operator refinement: "Blocked by, maybe with a confirmation from another agent?"

Resulting rule:
- `size`: the prepare worker may change it directly, grounded in file:line evidence and stated in `## Progress`. Implemented by adding `size` to `PREPARE_OWNED_FRONTMATTER_KEYS` (we:scripts/lib/probation-launcher.mjs).
- `blockedBy`: the worker may only PROPOSE edge changes in a `## Proposed blockedBy changes` section (add/remove, with file:line grounds); the frontmatter stays unchanged, and a direct `blockedBy:` edit is still refused as tamper. Confirmation mechanism: the parked prepare PR's independent review is the second actor (a different session from the preparer); the runner lists the proposed edges in the PR body. No existing juror pattern was reused because the review already is an independent actor. An add may never target a resolved or missing card or create a cycle (`validateProposedBlockedBy`, the same rules as check:standards "6d-ter"); the runner refuses the run otherwise.

