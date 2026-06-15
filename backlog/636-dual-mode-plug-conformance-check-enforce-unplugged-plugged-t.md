---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["635"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Dual-mode plug conformance check — enforce unplugged + plugged tests, no plug may require plugged mode

Add a check:standards rule enforcing the #606 invariants: every plug ships passing automated tests for BOTH the unplugged (non-invasive) and plugged modes, and no plug may require plugged mode (the unplugged form is mandatory and is the real-app surface; plugged is POC/demo). The rule fails the gate on a plug missing either mode's tests, or one that only works plugged. Defines the test shape the backfill fills.

## Progress

- Added the pure rule `validatePlugDualMode` to [scripts/check-standards-rules.mjs](/scripts/check-standards-rules.mjs) and wired the fs collection (per plug domain under `plugs/web*`: does it have an unplugged-mode test, a plugged-mode test) into [scripts/check-standards.mjs](/scripts/check-standards.mjs) as a new section.
- **Detection insight:** a passing *unplugged-mode* (non-invasive) test is the automated **proof** a plug does not require plugged mode — static "has an unplugged form" detection is too fragile (e.g. webdirectives is a customized built-in `extends HTMLTemplateElement`, no `localName`), so the dual-mode test coverage IS the enforcement of the #606 invariant.
- **Staging to keep the gate green (the item is rule-first, #649 backfill-second):** the #635 audit found all 10 domains have an unplugged *form* but only `webbehaviors` has an unplugged *test*. So:
  - **ERROR now:** a domain with no plugged-mode test (all 10 pass → green).
  - **WARN now:** a domain with no unplugged-mode test — the 9 #649 backfill targets, each tagged in the message.
  - A `PLUG_UNPLUGGED_TEST_ENFORCED` flag (currently `false`) flips that warn→error once #649 backfills, fully realizing "fails on a plug missing either mode's tests." Promotion note recorded on [#649](/backlog/649-reconcile-plugs-we-fui-drift-dual-mode-test-backfill-ahead-o/).
- The rule **skips silently when `plugs/` isn't checked out** — #606 makes Frontier UI the canonical home, so a post-#449 WE tree without `plugs/` is expected, not a failure.
- Fixture tests added to [scripts/__tests__/check-standards-rules.test.mjs](/scripts/__tests__/check-standards-rules.test.mjs) (4 cases: dual-mode pass, plugged-missing error, unplugged-missing backfill warn, non-plug-dir skip). 109 rule tests green.
- `npm run check:standards` green (0 errors, 9 backfill warns).

**Graduated to** `scripts/check-standards-rules.mjs` — validatePlugDualMode rule (+ check-standards.mjs) — #606 dual-mode plug conformance: ERROR on missing plugged-mode test, WARN→ERROR (PLUG_UNPLUGGED_TEST_ENFORCED) after #649 backfill.
