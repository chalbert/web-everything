---
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

PR #1056 shipped the gate-self ceremony as an injected hook on an exported function whose return value was trusted verbatim, so any importer could pass a stub returning allowed:true.

Prevention (b) of three carved out of the round-1 review of **PR #1056** (#2895's implementation), from finding
**B2**. The instance is fixed in that PR; the CLASS is not, which is why this is filed.

## The class

`runReviewLabelCli` is `export`ed and took `humanCeremony` as a config parameter, then trusted its return value
verbatim. That made "only the CLI can clear a gate-self PR" a property of **caller discipline** rather than of
module scope, and an importer could write:

```js
import('./scripts/review-set-label.mjs').then((m) => m.runReviewLabelCli({
  argv: ['1048', '--repo=o/n', '--to=clear-human'],
  humanCeremony: () => ({ allowed: true, reason: 'ok' }),
}));
```

— clearing the PR **and** posting a durable comment falsely asserting a human confirmed it at a terminal. That
is worse than the dead end #2895 set out to fix: the old bypass left an unattributed raw `gh` edit; this one
manufactures a positive audit record.

The general shape: **a predicate that decides trust must not be reachable through the caller's data.** A caller
may declare a capability ("I am an interactive CLI") but must never supply the verdict ("the human said yes").

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
- A test pins the rule against a fixture that reintroduces the injected hook.
