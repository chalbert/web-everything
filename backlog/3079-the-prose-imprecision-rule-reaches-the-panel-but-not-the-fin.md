---
bornAs: xzgx125
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-12"
dateOpened: "2026-08-12"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [review, mandate, jury, prose, loop]
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
---

# The prose-imprecision rule reaches the panel but not the final validator

#1175 added a clause telling reviewers that wording, framing, and claims about history or significance are
worth a NOTE and not a change-request unless the imprecision would cause a wrong ACTION. It was typed into
`buildPanelMandate` only. The #2439 INDEPENDENT FINAL VALIDATOR is built by `buildValidatorMandate` and never
received it — and the validator is the gate the panel's accept is conditioned on, so a rule the last gate does
not have is a rule the loop does not have. Named as owed at #1175's review and not fixed there.

## Why the fix is to move it, not to copy it

Two copies of a mandate clause drift. The clause is not panel-specific — it is about how any adversary should
weigh prose against behaviour — so its home is `buildMandate`, the shared base both builders already wrap.
That also reaches any future transport built on the same base without anyone remembering to add it.

## Watch for

- Exactly ONE copy in a panel mandate. Moving it up while leaving the original in place is the drift this is
  meant to prevent, and it looks identical from a `toContain` assertion.
- The EDITOR mandate is a separate builder and does not wrap `buildMandate`. Deliberately out of scope: the
  editor acts on findings a reviewer raised, so a reviewer that stops raising prose findings already fixes the
  editor's half.

## Done when

- [x] The rule reaches `buildValidatorMandate`.
- [x] It still reaches `buildPanelMandate`, exactly once.
- [x] It is declared in ONE place, and a test proves both builders carry the same text.

## How it resolved

`PROSE_IMPRECISION_RULE` is exported from `we:scripts/lib/review-core.mjs` and appended to `buildMandate`'s
body lines, so panel, validator, and any future builder on the same base all carry the same text. The copy in
`buildPanelMandate` is gone.

Two mutations reddened named tests: dropping the rule from `buildMandate` (4 red, including the validator
test that is the whole point) and re-typing it into the panel as a second copy (1 red — the exactly-once
assertion).
