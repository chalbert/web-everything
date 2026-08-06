---
bornAs: x9zk4wm
kind: task
status: open
relatedTo: ["2895"]
dateOpened: "2026-08-06"
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
tags: [gate, security, review, prevention]
---

# Forbid a trust-deciding predicate as a function parameter in the review-label module

A caller may declare a capability, but must never be able to supply a verdict — an exported gate function that takes its trust decision as a parameter has moved that decision into the caller's data.

Prevention (b) of three carved out of the round-1 review of **PR #1056** (#2895's implementation), from finding
**B2**. **This is a general rule, not a bug report**: the code that prompted it no longer exists anywhere — the
gate-self ceremony was deleted outright when #2895 ruled the unforgeable actor signal deferred. The shape is
filed because it is easy to reintroduce and expensive when it lands.

## The class

**A predicate that decides trust must not be reachable through the caller's data.** A caller may declare a
CAPABILITY ("I am the operator-run CLI") — a boolean, which cannot carry an answer. It must never supply the
VERDICT ("the check passed") — a function, whose return value the callee then trusts.

The instance that named the shape: an earlier cut of `runReviewLabelCli` (exported) took the gate-self ceremony
as a `humanCeremony` config parameter and trusted its return verbatim, so an importer could pass
`() => ({ allowed: true })` and clear the PR **and** post a durable comment falsely asserting a human confirmed
it. That is worse than the dead end #2895 set out to fix: the old bypass left an unattributed raw `gh` edit;
this one manufactures a positive audit record. The sanctioned shape that replaced it, and that survives today,
is the `allowClearHuman` boolean — a capability opt-in, with no verdict in it.

Note the rule is about the SHAPE, not about how strong the gate is. `allowClearHuman` is only an accident
guard (#2895 accepted that an importer who wants the target can pass it), and the rule still binds: a weak
guard that can be forged into a positive audit record is strictly worse than a weak guard that cannot.

## The guard

A `check:standards` rule over [`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs) and its callers:
no exported function in the review-label module may accept a parameter whose name or JSDoc types it as a
function returning an `allowed`/verdict shape. Capability opt-ins stay allowed — they are booleans, and a
boolean cannot carry a forged answer.

Worth checking during the build whether the rule generalizes cheaply to the other gate modules
([`we:scripts/lib/review-escalation.mjs`](scripts/lib/review-escalation.mjs),
[`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs)); if it does not, keep it narrow rather than
weakening it to fit.

## Done when

- `check:standards` errors when the review-label module grows a trust-deciding function parameter, with a
  message naming #1056 B2 and pointing at the `allowClearHuman` boolean as the sanctioned shape.
- A test pins the rule against a fixture that introduces an injected verdict hook (the rule must go red on the
  shape, not on the specific `humanCeremony` name, which no longer appears in the tree).
