---
bornAs: x19eemk
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/lane-history.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs", "we:scripts/lib/__tests__/lane-history.test.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2989's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-history.mjs:175` — Add a unit test asserting `isUnsalvagedDestructiveUnpushed` is false for `litter-delete` with unpushed commits and true only for actions that reset the tree. Better: record a distinct field such as `destroyedUnpushed` at the call site instead of deriving it from the action name.
2. `we:scripts/lib/lane-history.mjs:195` — Doc note in the `we:scripts/lib/lane-history.mjs` journal header: `actor.name` is caller-declared, and `pid`/`ppid` are the trustworthy fields. If tamper-evidence is ever required, add a hash chain to the journal as a backlog item.
3. `we:scripts/lib/lane-history.mjs:298` — Add a shared `stripControlChars` in `we:lane-whois-core.mjs` and use it in `formatLaneTimeline` and the loud stderr write. Add a lint rule against interpolating raw `reason` strings into stderr or terminal output.
4. `we:scripts/check-standards-rules.mjs:4004` — Extend `LANE_MUTATION_RES` to cover `takeMarkerIf` and `rmSync(file…` in the reclaim code, and tighten the window to the enclosing function. Alternatively, route all lane mutations through one journaled helper and forbid raw calls with a lint rule.
5. `we:scripts/lib/lane-history.mjs` — Add a deterministic regression test that cleans disposable litter beside an unpushed commit, verifies the commit survives, and requires the destructive-work smell to remain silent.
6. `we:scripts/conveyor/health-watch.mjs` — Add deterministic probe tests placing a recent destructive event in a rotated file and beyond the live tail budget, and require it to remain visible throughout the configured window.
7. `we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs:1` — A standard review checklist ensuring all distinct mutation paths (like `refresh --force` vs `reclaim --override`) claimed in the PR description have corresponding integration tests.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2989@6aa47e21043d9ecc5c994dd4c95e4a4027989780

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
