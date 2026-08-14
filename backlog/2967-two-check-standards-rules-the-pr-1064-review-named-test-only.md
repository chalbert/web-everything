---
bornAs: xazyfw7
kind: story
size: 8
status: open
dateOpened: "2026-08-06"
tags: [check-standards, gate, security, lock-point]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
  - we:scripts/check-standards.contract.json
---

# Two check:standards rules the PR #1064 review named: test-only exports and unfenced mandates

Two script-decidable gate rules whose whole-repo shape needs design work before they can block. (a) TEST-ONLY EXPORT SCAN: flag any we:scripts/lib/*.mjs export whose only in-repo importer is its own __tests__ file — that catches the whole 'extracted, tested, never wired' class (reduceLensJury was exported, unit-tested and never called, so multi-juror lenses collapsed last-writer-wins). A probe run finds ~156 candidates, most false positives (CLI-shelled consumers, star-import re-exports, harness bodies that cannot import), so the carve-out set is the work. (b) UNFENCED MANDATE SCAN: fail any mandate-building export in we:scripts/lib/ that interpolates a caller-supplied string without routing it through fenceUntrusted + FENCED_DATA_RULE — the #2438 splice guard, which was left local to the plan handshake so the next author composing a mandate followed the older unfenced example.

The third rule the same review named — the declared-contract-vs-imports diff — was **cheap and in scope, so it
shipped in the PR #1064 fix** (`validateDeclaredModuleContract`, rule 16, `we:scripts/check-standards-rules.mjs:2237`). These two are what was left.

## Verification of the card's own claim (mutation-tested, not asserted)

Neither rule exists yet anywhere in `we:scripts/check-standards-rules.mjs` (confirmed: grepped every exported
function name in the file — no test-only-export or mandate-fencing scan). So the claim to verify isn't "is an
existing guard decorative" — it's "is the gap this item proposes to close actually live and actually
unguarded today." Verified both, by mutating the lane and running `npm run check:standards` (0 errors, 1316
warnings on the unmodified tree):

**Claim (a).** Added `__mutationScratchTestOnlyExport` to `we:scripts/lib/converge-core.mjs` (exported, unit-tested
in a matching `it()` in `we:scripts/lib/__tests__/converge-core.test.mjs`, never called anywhere else — the
exact `reduceLensJury` shape). `npx vitest run` on that file: 64/64 green. `npm run check:standards`: still
**0 errors**. Reverted both files (`git checkout --`, confirmed clean). So today, nothing catches this class —
the gap is real, not hypothetical. (`reduceLensJury` itself is no longer dead, for the record —
`we:scripts/lib/converge-core.mjs:255` now calls it; the regression it names is fixed, but nothing generalized
the fix into a gate.)

**Claim (b).** Added `__mutationScratchUnfencedMandate({ userText })` to `we:scripts/lib/review-core.mjs`,
returning a template literal that splices `userText` straight into instruction position, unfenced. `npm run
check:standards`: still **0 errors**. Reverted, confirmed clean. And this isn't just a synthetic shape — it is
**already shipping** in two places:
- `we:scripts/operations/review-pr.mjs:389` — `buildPanelMandate({ lens, netChangedFiles: read.netChangedFiles, goal: read.title })`. `read.title` is `String(detail.title || '')` (`we:scripts/operations/review-pr.mjs:214`) — the PR's title, straight from `gh pr view`, author-controlled, spliced unfenced through `buildMandate` → `buildSubjectMandate` into the reviewer's mandate.
- `we:scripts/review-core-cli.mjs:232` — `buildMandateText`'s `'editor'` case calls `buildEditorMandate({ findings, round, roundCap })` with no `fenced: true`, so `findings` (untrusted juror prose, read from `--file`/stdin per the CLI's own documented usage: `cat we:findings.json | node we:scripts/review-core-cli.mjs mandate --editor --round=2`) reaches `buildEditorMandate` unfenced — this is the exact "second hop" the card calls "the dangerous one: finding text goes to an agent with WRITE TOOLS pointed at a live tree," and this CLI path is what a Workflow harness shells (`we:scripts/workflows/review-parked-prs.mjs:673`).

Contrast: `we:scripts/lib/converge-transports.mjs:206` passes `fenced: true` correctly, and
`we:scripts/lib/review-core.mjs:384-433` (`buildPlanMandate`/`buildPlanCritiqueMandate`) fence `task`/`concerns`/`approach`
by construction. So the fence exists, is used correctly in the plan-handshake path (#2438) and one converge
transport, and is skipped on two other live paths that predate or bypass it — exactly the "left local, next
author followed the older example" story the card tells, and `we:scripts/converge-cli.mjs:210-212`'s own header
comment says so nearly verbatim (independent corroboration, not something I wrote in).

**Both claims verified.** The card is not wrong; if anything it understates claim (b) — I found two live unfenced
call sites, not one hypothetical shape.

## (a) The test-only-export scan

**What it catches.** `reduceLensJury` was exported from we:scripts/lib/converge-core.mjs, unit-tested with three
cases, and never called by anything. The consequence was not cosmetic: multi-juror lenses collapsed
last-writer-wins inside `reducePanelRound`, so the SAME two jurors produced `land` or `edit` depending on array
order. "This export's only in-repo importer is its own test file" is fully script-decidable, and it catches the
whole extracted-tested-never-wired class in one rule.

**Why it is not a one-liner — verified false-positive categories, each with a real repo example:**

- **Star-import re-export.** `we:scripts/lib/__tests__/check-standards.conformance.test.mjs:36` does
  a namespace star-import of `we:scripts/check-standards-rules.mjs` (`import * as rules from …`) — every export of that file reads as "imported"
  only through the namespace object, never by name. Also present in `we:scripts/validation-normalize/`,
  `we:scripts/ingest-adapter/`.
- **Workflow harness body, CLI-shelled.** `we:scripts/review-core-cli.mjs`'s exports (`parseFlags`,
  `reduceReview`, `buildMandateText`, `buildComment`, `deriveDispositionLenient`) are imported ONLY by
  `we:scripts/__tests__/review-core-cli.test.mjs` (grepped — confirmed) — a textbook test-only-export false
  positive. But the real consumer is `we:scripts/workflows/review-parked-prs.mjs:566,636,673,733`, whose harness
  body (a prompt string a subagent reads, not an ES module) instructs `node we:scripts/review-core-cli.mjs …` —
  the file's real consumer is the OS/shell, invisible to any import graph.
- **Contract constant, conformance-suite-only by design.** `REVIEW_POLICY`
  (`we:scripts/lib/review-policy.mjs`) is imported only by
  `we:scripts/lib/__tests__/review-policy.conformance.test.mjs` (grepped, confirmed) — the suite pinning
  impl-to-contract values IS the intended consumer, not a bug.
- **Genuinely-public API a sibling repo consumes** — unverifiable from this checkout (no `../frontierui`
  present in the lane); handled the same way `validateBlockImplConformance` already does: skip when the sibling
  isn't checked out rather than false-flag.

**Decided design.** Structural carve-outs (star-import, workflow-harness-shelled) are baked into the scan as
always-on heuristics — they are repo-shape facts, not per-file judgment calls, and re-detecting them costs
nothing extra since the fs-walk already visits every file. Judgment carve-outs (conformance-suite-only
constants, sibling-repo public API) use a **per-export inline marker**, `@test-only-export-ok: <reason>` in the
export's own leading comment, **positionally anchored the way `hasCohesiveEscapeHatch` is**
(`we:scripts/check-standards-rules.mjs:2296-2340`) — that function's own history (r0/r1) is the reason: an
un-anchored marker is forgeable by anything that merely *documents* the escape hatch, including a docstring
example or a fenced code block. A **centralized curated list** (mirroring `COMPOSE_DENY_LIST`,
`we:scripts/check-standards-rules.mjs:1845-1860`) was the other real option and is rejected here specifically
because `we:scripts/check-standards-rules.mjs` is **already a scope-collision lock point** (see Scope note
below) — growing a third giant list in that one file compounds the exact throughput problem #2678 exists to
flag, where an inline marker in the exporting file does not.

**Ships `TEST_ONLY_EXPORT_ENFORCED = false`** (warn-first), mirroring `COMPOSE_TRAITS_ENFORCED`
(`we:scripts/check-standards-rules.mjs:1841`, "warn-first until the deny-list is curated + false-positive-free,
then flip") — the exact same shape of problem (a broad structural scan, real but boundable false-positive
surface), same precedent, same resolution. Not an open question; this one is decided.

## (b) The unfenced-mandate scan

**What it catches.** A mandate-building export in we:scripts/lib/ that interpolates a caller-supplied string
straight into instruction position. This repo already ships `fenceUntrusted` + `FENCED_DATA_RULE` for exactly
that splice (#2438), but the fix was left local to the plan handshake — so the next author composing a mandate
(`buildPanelMandate`, `buildEditorMandate`) followed the older unfenced example and put a raw diff, and then raw
juror finding text, adjacent to the mandate. The second hop is the dangerous one: finding text goes to an agent
with WRITE TOOLS pointed at a live tree. **Confirmed live, not hypothetical — see Verification above: two real
call sites splice unfenced text today** (`we:scripts/operations/review-pr.mjs:389`'s `goal: read.title`,
`we:scripts/review-core-cli.mjs:232`'s unfenced `findings`).

**Shape.** Scan every export in `we:scripts/lib/*.mjs` whose name matches `/^build.*Mandate$/` — the naming
convention every existing mandate builder already follows without exception (`buildMandate`,
`buildPanelMandate`, `buildEditorMandate`, `buildValidatorMandate`, `buildPlanMandate`,
`buildPlanCritiqueMandate`, `buildRosterCritiqueMandate`; `we:scripts/lib/review-core.mjs` — grepped, confirmed
exhaustive). For each, require every destructured parameter that is interpolated into a template literal in the
function body to either (a) pass through `fenceUntrusted` first, or (b) be named in a curated
`MANDATE_FENCE_ALLOWED_PARAMS` allow-list for CLOSED enums (`lens`, `round`, `roundCap`, `contextIsolation` — a
lens name or round number is not attacker-influenced free text, fencing it would be noise). If any parameter is
fenced, require the returned string to also contain `FENCED_DATA_RULE`.

## Interface and protocol (both rules — matches `validateDeclaredModuleContract`'s shape, rule 16)

```js
// we:scripts/check-standards-rules.mjs

export const TEST_ONLY_EXPORT_ENFORCED = false; // #2967, warn-first — mirrors COMPOSE_TRAITS_ENFORCED (#937)

/**
 * @param {Array<{file: string, content: string}>} modules - every candidate .mjs file's content
 *   (scripts/**, skills-src/**, excluding __tests__/dist/node_modules)
 * @param {{starImportedSpecifiers: Set<string>, subprocessReferencedFiles: Set<string>}} structural -
 *   precomputed by we:scripts/check-standards.mjs's fs-walk half (star-import scan + harness-body
 *   subprocess-string scan)
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<{message: string, descriptor: object}>}}
 */
export function findTestOnlyExports(modules, structural) { /* … */ }

export const UNFENCED_MANDATE_ENFORCED = /* see Open decision below */;

export const MANDATE_FENCE_ALLOWED_PARAMS = new Set(['lens', 'round', 'roundCap', 'contextIsolation']);

/**
 * @param {Array<{file: string, content: string}>} modules - we:scripts/lib/*.mjs content
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<{message: string, descriptor: object}>}}
 */
export function findUnfencedMandateParams(modules) { /* … */ }
```

Registration mirrors rule 16 exactly: the fs-read stays impure in `we:scripts/check-standards.mjs` (a
`readdirSync` walk building the `modules`/`structural` inputs), the pure rule is imported and called in a
numbered block (`for (const e of findTestOnlyExports(mods, structural).errors) err(e.message, e.descriptor);` /
same for `.warnings` → `warn(...)`), and each finding is `{message, descriptor}` where `descriptor.kind`
identifies the rule (`'test-only-export'` / `'unfenced-mandate-param'`) for the `--json` machine-readable feed
(`we:scripts/check-standards.mjs:86-89`). Any exported `*_ENFORCED` constant automatically needs a matching
entry in `we:scripts/check-standards.contract.json` — this is not a task to remember, it's a standing,
already-shipped self-guard: `we:scripts/lib/__tests__/check-standards.conformance.test.mjs:94-101` ("every
`*_ENFORCED` constant exported by the engine is declared in the contract") reddens automatically the moment
either constant is exported without its contract entry.

## Open decision: `UNFENCED_MANDATE_ENFORCED` default

Rule (a) is uncontroversially warn-first (COMPOSE_TRAITS_ENFORCED precedent, ~156 raw candidates). Rule (b) is
different: I found it is **already live-exploitable on main today** at two call sites (see Verification). Two
real options:

- **Warn-first (`false`), matching (a)'s pattern for consistency.** Ships the scan without touching
  `we:scripts/operations/review-pr.mjs` or `we:scripts/review-core-cli.mjs` in this PR; a human decides later
  when to flip to error and fix the live sites then. Lower blast radius for this PR, but leaves a known,
  demonstrated prompt-injection surface at advisory-only for an unspecified soak period — the gate exists to
  prevent exactly this and would ship decorative on day one for its two realest cases.
- **Error-enforced (`true`) from day one, with the two live sites fixed in the SAME PR.** The fixes are small
  and mechanical (wrap `goal`/`read.title` and the `findings` param in `fenceUntrusted`, add `FENCED_DATA_RULE`
  to the returned template — the same three-line pattern `we:scripts/lib/converge-transports.mjs:206`'s
  `fenced: true` already uses). This is a security-relevant gate closing a security-relevant, demonstrated gap;
  I'd rather it not open already-broken.

**My recommendation is the second** — but I'm naming it rather than deciding it silently, because it changes
this item's blast radius (touches two files outside `we:scripts/check-standards*` that no other part of this
card scopes) and because "ship the gate, fix the two sites it would immediately catch" is a judgment call about
bundling a security fix into a gate-adding PR that deserves a human's sign-off, not an agent's.

## Scope note: lock-point files

All three `we:scripts/` files this item edits are themselves flagged by the repo's own #2678 lock-point gate
(measured on the unmodified tree, this run):

- `we:scripts/check-standards-rules.mjs` — 1732 code lines, named in **9** queued items' `scope:`
- `we:scripts/check-standards.mjs` — 1321 code lines, named in **12** queued items' `scope:`
- `we:scripts/__tests__/check-standards-rules.test.mjs` — 1745 code lines, named in **9** queued items' `scope:`

Building this item serializes against every other queued item that also names these files — that's
information for the dispatcher, not a defect to fix here (splitting these files is a separate, much larger
concern the #2678 warn already tracks).

## Tasks

1. In `we:scripts/check-standards.mjs`'s fs-walk half: extend the existing `scripts/lib` walk (already built for
   rule 16) to also cover `scripts/**` and `skills-src/**` (excluding `__tests__/`, `dist/`, `node_modules/`) for
   rule (a)'s candidate universe; add a light star-import scan (`import \* as \w+ from '...'`) and a subprocess
   reference scan (`node scripts/<basename>` string literals inside `scripts/workflows/**`) to build the
   `structural` carve-out sets.
2. Implement `findTestOnlyExports` in `we:scripts/check-standards-rules.mjs`: export extraction, import-graph
   matching (mirror `validateDeclaredModuleContract`'s specifier-basename matching), structural carve-outs, the
   `@test-only-export-ok:` positional inline-marker carve-out (reuse/extend `hasCohesiveEscapeHatch`'s
   header-anchor logic, generalized to anchor on the export's own leading comment rather than the file header).
   Ship `TEST_ONLY_EXPORT_ENFORCED = false`.
3. Implement `findUnfencedMandateParams` in `we:scripts/check-standards-rules.mjs`: match `/^build.*Mandate$/`
   exports, extract destructured params, scan the function body for `${param}` outside a `fenceUntrusted(...)`
   call, apply `MANDATE_FENCE_ALLOWED_PARAMS`, require `FENCED_DATA_RULE` when any param is fenced. Ship
   `UNFENCED_MANDATE_ENFORCED` per the Open decision above.
4. Wire both into `we:scripts/check-standards.mjs` (numbered blocks, mirroring rule 16's
   `for (const e of …) err(...)` shape) and add both flags to `we:scripts/check-standards.contract.json`'s
   `enforcement.flags`.
5. If the decision lands on error-enforced for (b): fix `we:scripts/operations/review-pr.mjs:389` and
   `we:scripts/review-core-cli.mjs:232` to route through `fenceUntrusted` + `FENCED_DATA_RULE` (pattern already
   shipped at `we:scripts/lib/converge-transports.mjs:206`).
6. Tests in `we:scripts/__tests__/check-standards-rules.test.mjs`: synthetic fixtures for each rule (positive,
   negative, each carve-out category individually), plus a standing "the real repo" guard test for each (mirrors
   `validateDeclaredModuleContract`'s `it('the real scripts/lib modules stay clean…')`,
   `we:scripts/__tests__/check-standards-rules.test.mjs:1861-1866`) — for (a), asserting today's real
   false-positive examples (`we:scripts/review-core-cli.mjs`, `REVIEW_POLICY`, the conformance-suite
   star-import) produce ZERO findings; for (b), asserting the fixed
   `we:scripts/operations/review-pr.mjs`/`we:scripts/review-core-cli.mjs` (post-task-5, if taken) produce zero
   findings.

## Delivery shape

One piece, not incremental — both rules are additive, non-overlapping wiring blocks in the same three files,
and reviewing them together is how the #1064 review named them (as a pair, against the same third rule that
already shipped). `TEST_ONLY_EXPORT_ENFORCED = false` means rule (a) cannot fail `check:standards` on land
regardless of residual false positives, so it's safe to ship before its carve-out set is perfectly curated — a
follow-up item (not filed here) flips it once a soak period confirms zero live-repo findings. Rule (b)'s
delivery shape depends on the Open decision above.

## Done when

Each entry names the line to break and the test that must redden — "the rule is tested" is not acceptance.

- Breaking `findTestOnlyExports`' own-test-file match (e.g. hardcoding it to always return `errors: []`)
  reddens the fixture test asserting it fires on a synthetic `reduceLensJury`-shaped export (verified today:
  the exact mutation, run for real in this prep — see Verification — currently passes `check:standards` with 0
  errors; after this item ships, the SAME mutation must produce a warning/error).
- Deleting the star-import structural carve-out reddens the fixture test built from the real
  `we:scripts/lib/__tests__/check-standards.conformance.test.mjs:36` shape (a star-imported module's exports
  must NOT be flagged).
- Deleting the workflow-harness-body carve-out reddens the fixture test built from the real
  `we:scripts/review-core-cli.mjs` / `we:scripts/workflows/review-parked-prs.mjs:566` shape (a CLI-shelled
  file's exports must NOT be flagged).
- Removing the `@test-only-export-ok:` marker's positional (header/leading-comment) anchor check — so it
  matches anywhere in a file, e.g. inside a docstring example — reddens a fixture test mirroring
  `hasCohesiveEscapeHatch`'s r0/r1 regression tests.
- Breaking `findUnfencedMandateParams`'s fence check (e.g. never checking for `fenceUntrusted`) reddens the
  fixture test built from the real `we:scripts/operations/review-pr.mjs:389` shape (`goal: read.title`,
  unfenced) — verified today: the exact mutation shape, run for real in this prep, currently passes
  `check:standards` with 0 errors.
- Breaking the `FENCED_DATA_RULE`-presence check (returning a fenced param without the rule sentence) reddens a
  fixture test for that specific omission.
- Exporting `TEST_ONLY_EXPORT_ENFORCED` or `UNFENCED_MANDATE_ENFORCED` without a matching
  `we:scripts/check-standards.contract.json` entry reddens the already-shipped
  `we:scripts/lib/__tests__/check-standards.conformance.test.mjs:94-101` self-guard (inherited acceptance, not
  new — cited so the builder knows it's mechanized, not a step to remember).
- `npm run check:standards` is 0 errors on the live repo with both rules wired in at their shipped enforcement
  defaults.
