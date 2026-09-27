---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# No test exercises deliver-item-wrapper's default (non-overridden) Codex sandbox deny-path wiring

Still-open Codex advisory finding from chalbert/web-everything#2758 (codex-correctness/coverage, [CONFIRMED]), never acted on before merge (2026-09-26). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — still applies.

FINDING: every CODEX_PROVIDER.spawn test in we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs's io() helper hardcodes denyPaths: ['/tmp/primary/**'] (and one override test uses ['/tmp/**']) — none omits denyPaths to exercise the real production wiring (defaultDeliveryDenyPaths(primaryCheckoutForLanePath(lanePath))). Removing or breaking that default wiring would leave every existing test green.

EVIDENCE: grepped we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs on origin/main — only two denyPaths: literals in the whole file, both explicit overrides inside the io() test fixture; no test constructs CODEX_PROVIDER.spawn with denyPaths omitted.

PREVENTION (from the reviewer, still owed): add a provider test with frontierui/plateau-app lane paths and NO denyPaths override, asserting the generated sandbox config denies each repo's own primary checkout.

Priority: not HIGH (coverage gap only, no demonstrated live bug).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
