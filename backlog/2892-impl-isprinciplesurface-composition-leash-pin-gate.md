---
bornAs: xe5vt9s
kind: task
status: active
dateOpened: "2026-08-02"
blockedBy: ["2785", "2890"]
dateStarted: "2026-09-19"
tags: [governance, mechanization, review-human, principle-surface, check-standards]
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/rules-loader.cjs
  - we:scripts/lib/__tests__/
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/
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

## Progress

- **Built (one PR).** `isPrincipleSurface(changedFile, fileHunks)` + its three triggers in
  `we:scripts/lib/gate-config.mjs`; `scoreEscalation` now derives `humanRequired` from it per changed file
  (per-file hunk slice via `indexDiffSections` / `fileHunksResolver` in `we:scripts/lib/review-escalation.mjs`);
  `we:scripts/lib/rules-loader.cjs` requires `markdown-it` lazily so `extractAnchors` is a dependency-free import;
  leash-pin rule `checkLeashPin` in `we:scripts/check-standards-rules.mjs`, wired in `we:scripts/check-standards.mjs`.
- **Seeded** the first three `@invariant` markers: the composition's union (`isPrincipleSurface`), and in the
  rubric both the `humanRequired` derivation and the per-file-hunks wiring that feeds it. Seeding a marker on the runner's forced-shadow constant is filed as its own
  follow-on (x997mz7) — each seeding rides its own impl PR per #2839.
- **Fail directions (the reviewable calls).** Statute term: hunks unavailable / binary / deleted / renamed-or-created → FIRES
  (today's whole-file gate); only a whitespace/reflow-only CHANGE BLOCK (heading and fence lines must still match
  one-for-one) and a pure mode change stop firing — a line moved across a heading does not. A one-character typo fix inside a rule body still
  fires (mechanically indistinguishable from a meaning change). Marker term is additive: no hunks → contributes
  nothing, and `signals.hunksUnavailable` says so on the verdict. A marked block is the marker + at most `MARKED_BLOCK_MAX_LINES` (3) contiguous non-blank lines, so the
  grammar matches the default `-U3` hunk context; a `-U0` producer would hide markers.
- **Side effect:** moving `isStatutePath` into the roster module also repairs
  `we:scripts/operations/deliver-item-wrapper.mjs`, which already imported it from there.
- This PR edits `we:scripts/lib/gate-config.mjs` (declarative leash), so it is itself `review:human` by the rule it implements.
