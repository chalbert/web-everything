---
bornAs: xe5vt9s
kind: task
status: active
dateOpened: "2026-08-02"
blockedBy: ["2785", "2890"]
dateStarted: "2026-09-15"
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

Built against the post-#2785 code (the human trigger was `leashFiles ∨ statuteFiles`; `isGateSelfPath` was
already out of it, so "replace both path OR-terms" means those two).

- **Composition** — `we:scripts/lib/gate-config.mjs#isPrincipleSurface` = `isDeclarativeLeashPath` ∨
  `isStatuteAnchorEdit` ∨ `isMarkedInvariantEdit`. `STATUTE_PATHS`/`isStatutePath` moved into gate-config (no
  circular import); `we:scripts/lib/review-escalation.mjs` re-exports every old name. `indexDiffByFile` slices the
  whole `diffHunks` text per file (rename/delete/quoted/mode-only aware).
- **`scoreEscalation`** — `humanRequired = gateBasis.some(isPrincipleSurface)`, each file read under its raw AND
  plain (`plainDiffPath`) spelling, which also closes the renamed-statute/leash fail-open #2890 recorded. Reasons
  reuse existing contract tokens only: `statute` for a rule-text edit, `gate-self` for leash and for a marked
  guarantee (a new token would throw in `deriveReviewDisposition`). A reflow-only statute edit escalates with no
  `statute` reason → committee.
- **Statute trigger** — fires unless every hunk is whitespace/reflow-only by collapsed text AND an identical
  `extractAnchors` inventory. Unknown content (`null`, file absent from the diff, binary) fires. Typo fixes and
  preamble edits fire too — deliberate over-fire, no deterministic read tells them apart.
- **Marker trigger — design choice.** A 3-line-context hunk can't show a marker far above an edit, so markers carry
  a body **pin**: `// @invariant <id> pin:<12 hex>` … `// @end-invariant <id>` (or `@principle`), where the pin
  is a whitespace-insensitive sha256 of the body. check:standards requires the pin to match, so any body edit
  must rewrite the marker line, and the scorer fires when a hunk *removes* a marker line. Adding a marker only adds
  lines → no fire (#2839). Markers are recognized only in JS/TS source extensions. A rename out of those
  extensions fires.
- **check:standards (`we:scripts/check-standards.mjs` §17c)** — `validateLeashPin` (floor ⊆ leash set; every
  leash file at its homes/bare/relocated path is a principle surface for null/empty/whitespace/ordinary diffs; the
  real scorer labels it `review:human`) and `validateMarkedInvariants` (pins, structure, repo-wide unique ids).
  No new exported booleans, so the check-standards contract is untouched.
- **First marker** — `runner-forced-shadow` on the forced-shadow exhaustive test in
  `we:scripts/lib/__tests__/review-runner-core.test.mjs` (enforces `#enforce-flip-triple-gated`).
- **Tests** — `we:scripts/lib/__tests__/principle-surface.test.mjs` (grammar, scorer, and a real-git call path through
  `computeNetDiffSignals` → `resolveProducerReviewLabel`), `we:scripts/__tests__/check-standards-principle-surface.test.mjs`,
  INVARIANT 1b in `we:scripts/lib/__tests__/gate-invariants.test.mjs`; two #2890 tests updated to the new behaviour.

**Residuals, stated.** (1) With no diff content (`null` — not computed, or over the producer's buffer), the
marker axis can't see the base and stays inert. The gate then sits on the post-#2785 line, never below it, and the
verdict carries `signals.principleContentUnknown`. (2) Markers are only validated in WE's own check:standards; a
marker in a sibling repo is unpinned. (3) The `statute` token's description in
`we:scripts/lib/review-policy.contract.json` still says every statute touch is human. The clearance is unchanged,
only the prose is stale; a leash-file edit, left to its own change.
