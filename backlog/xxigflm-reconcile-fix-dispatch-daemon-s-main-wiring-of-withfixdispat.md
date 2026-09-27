---
kind: task
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# reconcile-fix-dispatch-daemon's main() wiring of withFixDispatchClaimRefresh has no end-to-end test

Still-open Codex advisory finding from chalbert/web-everything#2789's FINAL review round (codex-correctness/coverage, [PLAUSIBLE]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — still applies.

FINDING: we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs's main() composes withFixDispatchClaimRefresh(withGithubAppAuth(...)) into withSelfSync's own hasStaleRefusal option before it starts ticking. Every existing test for withFixDispatchClaimRefresh exercises the exported wrapper directly, in isolation, with hand-built injected effects/refresh functions — none of them drives main() itself, or asserts that main()'s own real composition still installs the wrapper. If a future refactor of main() drops or reorders withFixDispatchClaimRefresh from that composition, every existing test stays green (they never touch main()), and long-running fix/ci-heal sessions would silently lose the heartbeat refresh this PR exists to add — reverting to plain-TTL claim expiry and reopening the duplicate-dispatch bug this whole PR fixes, with nothing in the test suite catching the regression.

EVIDENCE: read we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs directly off origin/main — main() still composes withFixDispatchClaimRefresh(withGithubAppAuth(buildCliDaemonEffects({ owner }))) inline; grepped we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon.test.mjs on origin/main for any test invoking main() itself around this wiring — none exists; the file's own comment there reads "wired into withSelfSync's hasStaleRefusal option in main(); tested here in isolation", confirming the isolation-only coverage.

PREVENTION (from the reviewer, still owed): add a deterministic wiring test that exercises main()'s own composed effects (with every dependency injected) and fails if withFixDispatchClaimRefresh is ever omitted from that composition.

Priority: not HIGH (a pure coverage gap protecting an already-shipped wiring; no demonstrated live regression today).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
