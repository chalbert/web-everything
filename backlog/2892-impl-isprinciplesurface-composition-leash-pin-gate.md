---
bornAs: xe5vt9s
kind: task
status: open
dateOpened: "2026-08-02"
blockedBy: ["2785", "2890"]
tags: [governance, mechanization, review-human, principle-surface, check-standards]
---

# Impl: `isPrincipleSurface` composition + leash-pin gate + first `@principle` invariants (enforces #2840)

Mechanical follow-on that enforces the ratified principle-surface gate
(`we:docs/agent/platform-decisions.md#human-is-principle-surface-not-path`, #2840): compose an
`isPrincipleSurface(changedFile, diffHunks)` trigger on top of #2785's narrowed path gate in
`scoreEscalation`, pin the declarative-leash files as a `check:standards` floor, and seed the first
`@principle`/`@invariant` markers. Code only, committee-cleared under the two-PR rule.

## Scope

- Add `isPrincipleSurface(changedFile, diffHunks)` in `we:scripts/lib/gate-config.mjs` — the union of
  `isStatuteAnchorEdit` (statute-anchor heading/body touch, reusing the `extractAnchors` grammar in
  `we:scripts/lib/rules-loader.cjs`), `isMarkedInvariantEdit` (a `@principle`/`@invariant` block present in
  **base**), and `isDeclarativeLeashPath` (the pinned `POLICY_SPEC` floor — the ONE surviving path term).
- In `scoreEscalation` (`we:scripts/lib/review-escalation.mjs`), replace both current path OR-terms
  (`isStatutePath`, `isGateSelfPath`) so `humanRequired = gateBasis.some(f => isPrincipleSurface(f,
  diffHunks(f)))`; a trust-chain file that is not a principle surface this diff still escalates → committee.
- Add the **leash-pin `check:standards` rule** asserting no `POLICY_SPEC` leash file is ever dropped from
  the human gate (guards #2838's flip-edit safeguard).
- Seed the first `@principle`/`@invariant` markers (each seeding rides its own impl PR per #2839).

## Preconditions

`blockedBy: 2785` — the base `POLICY_SPEC` path narrowing this extends must land first (building on the
un-narrowed `isGateSelfPath = isPolicyCorePath` base would re-derive #2771). `blockedBy: 2890` — the
producer-side `diffHunks` plumbing; the content triggers under-fire without it. Enforces #2840's ratified
anchor; mechanical, committee-clearable.
