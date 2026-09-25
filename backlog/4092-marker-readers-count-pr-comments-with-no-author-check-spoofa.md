---
bornAs: xopw3lk
kind: story
size: 5
parent: "3383"
status: resolved
scaffoldedBy: "security-fix-marker-authorship-lane-27-ffeb2777"
dateScaffolded: "2026-09-24"
dateOpened: "2026-09-24"
dateResolved: "2026-09-24"
graduatedTo: none
tags: []
---

# Marker readers count PR comments with no author check — spoofable stand-down/rearm/ci-heal/advisory/conflict-fix

The conveyor's durable marker counters (`countStandDownComments`/`countTerminalStandDowns` in `we:scripts/conveyor/stand-down.mjs`,
`countRearmComments` in `we:scripts/conveyor/rearm-review.mjs`, `countCiHealComments` in `we:scripts/conveyor/ci-heal-mark.mjs`,
`countAdvisoryFixComments` in `we:scripts/conveyor/advisory-fix-mark.mjs`, `countConflictFixComments` in
`we:scripts/conveyor/conflict-fix-round-count.mjs`, `countAdvisoryComments` in `we:scripts/conveyor/advisory-round-count.mjs`)
match a PR comment's LEADING LINE against a fixed marker string with no author check at all. Since WE's PRs are public, any
GitHub account can comment a fake stand-down (permanently blocks a fixer, no decay) or a fake rearm/ci-heal/advisory-fix/conflict-fix
marker (burns that PR's round cap toward `cap-exhausted`). Adds ONE shared `we:scripts/lib/marker-authorship.mjs`
(`isAutomationAuthored`/`isOperatorAuthored`/`isTrustedMarkerAuthor`, built on `author.login` — GitHub-assigned, not forgeable
by a comment body) and wires every counter through it, so only the automation's own login(s) or the repo operator's login
count toward dispatch decisions.

## Done when

1. **Executable** — `node --experimental-vm-modules node_modules/.bin/vitest run we:scripts/lib/__tests__/marker-authorship.test.mjs we:scripts/conveyor/__tests__/stand-down.test.mjs` is RED against pre-fix `we:scripts/conveyor/stand-down.mjs`/`we:scripts/conveyor/rearm-review.mjs` (a `mallory`-authored marker comment counts) and GREEN after the fix (it does not).
2. Every one of the six counters above is routed through `isTrustedMarkerAuthor`, with no call-site change needed in `we:scripts/conveyor/reconcile-core.mjs`/`we:scripts/conveyor/reconcile-pass.mjs`.
3. A live, read-only `runReconcilePass({repo:'chalbert/web-everything'})` (`we:scripts/conveyor/reconcile-pass.mjs`) before/after the change produces the SAME dispatch plan for the repo's current real open PRs (their markers are bot- or operator-authored, so the new filter changes nothing for them).
