---
bornAs: xln1ya7
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/sweep-orphan-backlog-cards.mjs", "we:scripts/lib/open-pr-items.mjs", "we:scripts/operations/machine-pr-title.mjs", "we:scripts/lib/forge-land-provider.mjs", "we:scripts/operations/__tests__/sweep-orphan-backlog-cards.test.mjs", "we:scripts/lib/__tests__/open-pr-items.test.mjs", "we:scripts/operations/__tests__/machine-pr-title.test.mjs", "we:scripts/lib/__tests__/forge-land-provider.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3207's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/sweep-orphan-backlog-cards.mjs:119` — Hoist the prevention-card heading and its source-ref regex into one shared exported constant used by every producer and consumer. Add a check:standards rule that fails on the literal `owed by` heading string outside that module.
2. `we:scripts/lib/open-pr-items.mjs:48` — Add a cleanTitle/machinePrTitle rule that neutralizes `#\d` sequences in the subject slot (for example `#` followed by a zero-width-free substitute), or restrict itemNumsFromPr's title scan to the lead `<REPO> #id:` token. Back it with a property test over MACHINE_TITLE_KINDS asserting that itemNumsFromPr(title) equals only the lead id for a subject containing `#1234`.
3. `we:scripts/operations/machine-pr-title.mjs:75` — Add a table-driven regression gate covering every recognized legacy template and asserting that normalization preserves delivery-versus-annotation classification.
4. `we:scripts/lib/forge-land-provider.mjs:86` — Add parameterized create-boundary tests for omitted, undefined, null and empty titles, requiring refusal before constructing publish arguments.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3207@1b0dc6b662e73a26e6b426ae1159284dc0ea75a2

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
