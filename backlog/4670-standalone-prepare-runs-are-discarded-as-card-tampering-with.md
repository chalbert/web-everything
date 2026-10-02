---
bornAs: xamy1gk
kind: story
size: 3
status: open

dateOpened: "2026-09-30"
tags: []
---

# Standalone prepare runs are discarded as card tampering without naming the key, and the allowed prepare keys are too narrow

Live 2026-09-30: Codex prepare runs of #3996 and #4003 through we:scripts/operations/probation-build-run.mjs both ended escalated-needs-human with "the worker edited the item's own backlog card — refusing" (~line 398), and the prepared text was discarded (resultDiscarded: true). In preparing mode the check is frontmatterTamperedBeyondClaim against PREPARE_OWNED_FRONTMATTER_KEYS = scope, preparedDate, preparedAgainstSha (we:scripts/lib/probation-launcher.mjs:208), so correcting any other factual frontmatter (size, blockedBy, and similar) — which the new prepare brief from #4658 now asks for — throws the whole prepare away, and the refusal never says which key changed. Fix: (1) the refusal names each changed key with before/after and keeps the worker diff for inspection; (2) decide and widen the prepare-owned set to the keys a prepare legitimately corrects (at least size and blockedBy), still refusing status, dateStarted, dateResolved and other claim/lifecycle keys; (3) same rule for the builder prepare path if it shares it. Proof: rerun #3996 and #4003 prepares and show stamped cards, plus a test that a status: edit is still refused.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Findings (standalone worker, 2026-10-02)

The build-dispatch daemon held #4670 with:

> worker-declined: could-not-prepare: #4670 leaves a policy choice unresolved: which metadata may preparation workers change, and under what conditions may they re-estimate 'size' or remove 'blockedBy' dependencies? The premise about #4658 is incorrect: both current preparation briefs explicitly preserve other frontmatter. A direct probe of 'we:scripts/lib/probation-launcher.mjs' confirmed that scope changes pass, while 'size', 'blockedBy', and 'status' changes are refused. 'we:scripts/operations/__tests__/probation-build-run.test.mjs:910' explicitly tests refusal of 'blockedBy' edits. The generic refusal and disc…

`scope:` was cleared above so this card is picked up by the existing unshaped-item auto-prepare path;
a prepare pass re-scopes it against the finding.
