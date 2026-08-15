---
bornAs: xphltws
kind: story
size: 3
parent: "2804"
status: open
dateOpened: "2026-08-01"
blockedBy: ["2805", "2802"]
scope:
  - we:scripts/backlog/scaffold.mjs
  - we:scripts/backlog.mjs
  - we:scripts/readiness/dispatch-plan.mjs
  - we:scripts/backlog/__tests__/scaffold.test.mjs
  - we:scripts/readiness/__tests__/dispatch-plan.test.mjs
scopeRationale: "Both halves of the slice are surgical additions to already-shipped code: the scaffold stub extends renderItem() (we:scaffold.mjs) via its sole caller scaffold() (we:backlog.mjs); the readiness refusal extends dispatchPlan()'s pure core and its IO shell (we:dispatch-plan.mjs), both in the same file. No other file imports renderItem or shells we:dispatch-plan.mjs in a way this touches (see Consumers checked, below) — we:scripts/conveyor/tick-core.mjs and we:scripts/conveyor/status-artifact.mjs both read dispatch-plan's JSON but never branch on plan.held[].reason, so the two new reason tokens are additive and backward-compatible for them."
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# Scaffold contract stub + readiness refusal

Scaffold stamps a fidelity: skeleton when the classifier fires; readiness/dispatch refuses to dispatch a UI item whose contract is incomplete, points at a fixture route, is missing the empty or overflow seed, or whose target was authored in the build lane.

## Status: blockedBy clear, ready to build

Both prerequisites are `status: resolved` on `main`: [#2805](2805-ui-fidelity-contract-schema-validator.md) (the
`fidelity:` shape validator, `we:scripts/lib/fidelity-contract.mjs`) and [#2802](2802-dependency-aware-ui-item-classifier.md)
(the dependency-aware classifier, `we:scripts/lib/render-check.mjs` `isVisualTouch` + `we:scripts/lib/route-import-graph.mjs`).
This is slice 3 of epic [#2804](2804-ui-fidelity-gate-real-route-conformance-born-with-contract-t.md); full design
reference: [we:reports/2026-07-31-ui-fidelity-gate-design.md](../reports/2026-07-31-ui-fidelity-gate-design.md) §"Gate
lifecycle" row 1–2 and §4 slice 3.

## Grounding — what already exists to compose

- **`validateFidelityContract(fidelity, {id})`** — `we:scripts/lib/fidelity-contract.mjs:63-156`. Pure, zero-IO
  shape validator; returns `{errors, warnings}` (flat `{message}` arrays, no per-error category field). Already
  wired into `check:standards` at `we:scripts/check-standards-rules.mjs:266-270`, gated `if (item.fidelity !==
  undefined)` — **an item that never authors a `fidelity:` key is never checked there.**
- **`isVisualTouch(files, opts)`** — `we:scripts/lib/render-check.mjs:131-148`. Pure, zero-IO. Two independent
  signals, either firing returns `true`: (1) a path-regex over WE (`*.njk`/`*.css`/`src/_includes/**`) and FUI
  (`plugs/webtheme/**`) surfaces, repo-qualification read from each entry's `repo:path` prefix (bare strings
  default to `we`); (2) when `opts.routeGraph` is supplied, `isRouteAffectingChange` (`we:scripts/lib/route-import-graph.mjs:213-215`)
  — exact Set-membership against a route's import closure.
- **`ROUTE_ENTRIES`** — `we:scripts/lib/route-import-graph.mjs:161-166`. Today maps only `/console-board` → its
  two plateau-app entry files; `graph` (the transitive edges) is not wired to real source yet — **#2802's own
  card says so explicitly** ("Follow-up: wire `buildImportGraph` to a committed real-graph snapshot… kept a
  fixture here"). `routesAffectedBy` (`we:scripts/lib/route-import-graph.mjs:192-204`) does **exact** id matching, not prefix
  matching.
- **The established composition pattern** — `we:scripts/readiness/scope-reconcile.mjs:65-71` (`reconcileScope`,
  #2803, already resolved) imports `isVisualTouch` **directly into its own pure core** and calls it per file with
  `{ routeGraph: { routeEntries: ROUTE_ENTRIES } }` (no `graph`, i.e. entries-only closure). The exact same call
  shape is wired at resolve time in `we:scripts/backlog.mjs:394`. This item mirrors that shape at scaffold and
  dispatch, for defense-in-depth (the "master bypass" #2803/slice-11 closed at resolve; scaffold/dispatch are the
  earlier checkpoints the same epic calls for at lines 67-68 of the design reference table).
- **The loader already carries `fidelity`.** `we:src/_data/backlog.js:318-333` spreads `...data` (the raw
  frontmatter) into every loaded item, and nothing after that spread shadows `fidelity` — confirmed by reading the
  block; `item.fidelity` reaches `we:scripts/readiness/dispatch-plan.mjs`'s IO shell's `byNum` map
  (`we:scripts/readiness/dispatch-plan.mjs:334-341`) already, it is simply not read into the `queue` row yet
  (`we:scripts/readiness/dispatch-plan.mjs:342-353` currently forwards only `num`/`kind`/`scope`/`openBlockers`).
- **Self-verification, run against this clone before writing this design (checklist item 8):**
  `grep -l "^fidelity:" backlog/*.md` returns **no matches** — no in-flight item carries a `fidelity:` block today,
  so this whole addition is currently inert (fires on nothing) until a future scaffold/hand-author actually stamps
  one. `node we:scripts/readiness/dispatch-plan.mjs --json` runs clean (`{"launch":[],"held":[]}`). The existing
  baseline suites are green: `npx vitest run we:scripts/backlog/__tests__/scaffold.test.mjs
  we:scripts/readiness/__tests__/dispatch-plan.test.mjs` → 50/50 pass. This bounds the blast radius: nothing this
  slice changes can regress a currently-passing dispatch decision, because no live item exercises the new branch.

## A load-bearing finding: the existing `scope` field cannot be reused for classification

`we:scripts/readiness/dispatch-plan.mjs`'s IO shell already strips the repo qualifier off every scope entry before it reaches the
pure core — `toRepoRelative` (`we:scripts/readiness/dispatch-plan.mjs:307-313`), applied so a lease's `we:` / `web-everything.git:` /
bare qualifiers compare equal for **overlap** detection. Reusing that already-stripped `scope` field for
`isVisualTouch` would silently break its FUI branch: a scope entry authored as `frontierui:plugs/webtheme/defaultTheme.ts`,
after `toRepoRelative` strips its repo qualifier, becomes the bare `plugs/webtheme/` path with no prefix; `isVisualTouch`'s bare-string
branch defaults an unqualified string to `repo: 'we'` (`we:scripts/lib/render-check.mjs:134`), so it is checked against the
**WE** path-regex (`.njk`/`.css`/`src/_includes/`) instead of the FUI one (`plugs/webtheme/`) — a real, silent
false-negative, not a hypothetical one. **Decided:** the queue row carries a second, untouched field
(`fidelityScope`) alongside the existing repo-relative `scope`, sourced from the same `it.scope` before
`toRepoRelative` runs. `scope` (for lease overlap) is unchanged; `fidelityScope` (for the classifier) is new.

## The decided design (named forks)

**Fork 1 — does scaffold stamp a real, validator-checked `fidelity:` YAML key, or a body-prose reminder?**
Decided: **body prose**, not a real key. Reasoning: `we:scripts/check-standards-rules.mjs:266` runs `validateFidelityContract`
unconditionally the moment `item.fidelity !== undefined` — there is no "shape is incomplete but that's OK, it's
just scaffolded" tolerance in the shipped #2805 code, and changing that gate's leniency is out of this slice's
declared scope (that module belongs to #2805, already resolved). At scaffold time nothing is known yet — no
route, no host, no seeds, and **no registry to point `target.registryId` at, because #2806 (target registry +
token + perceptual floor) is still `status: open`** (verified: `backlog/2806-*.md` line 6). Stamping a
real-but-empty `fidelity:` key would make `check:standards` RED from birth for every UI-classified scaffold until
the author completes fields some of which cannot yet be completed truthfully — breaking `we:scripts/backlog/scaffold.mjs`'s own
documented invariant ("`check:standards` passes on the skeleton", `we:scripts/backlog/scaffold.mjs:69`). A prose TODO section in the
body is inert to `check:standards` (the digest/body is only word-count-warned, never hard-gated) and still
satisfies "stamps a skeleton" — it is the skeleton of the AUTHOR'S TODO, not of the YAML.

**Fork 2 — one combined `fidelity-incomplete` held reason, or one per NOT-READY category (fixture route / missing
seed / other)?** Decided: **one combined token.** `validateFidelityContract`'s `errors` are flat `{message}`
strings with no category field (`we:scripts/lib/fidelity-contract.mjs:67`, `err = (m) => errors.push({message: ...})`) — splitting
by category would mean either adding a `code` field to #2805's already-shipped, already-tested return shape (out
of this slice's scope) or sniffing error message text in `we:scripts/readiness/dispatch-plan.mjs` (brittle: a wording change in
`we:scripts/lib/fidelity-contract.mjs` would silently break the split with no test to catch it). One token keeps the two modules
decoupled, matching this codebase's stated discipline of composing a sibling's output rather than reaching into
its internals (`we:scripts/readiness/scope-reconcile.mjs:14`, "This module writes NO new coverage matcher"). The four NOT-READY
categories the design reference names (route missing/fixture, host missing, seeds missing empty/overflow, target
absent) are exactly what `validateFidelityContract`'s messages already spell out per-field — an operator who hits
`fidelity-incomplete` runs `check:standards` (once the item carries any `fidelity:` block) to see which field.

**Fork 3 — "target authored in the build lane": how is that checkable pre-build, and against what?** Design
reference invariant A says the target's `authoredInCommit` "must PRE-DATE the build lane." At dispatch time (before
any build starts), the only way a queued item's contract could reference an in-lane commit is a **prior** attempt
whose commits sit on an unmerged branch. Decided: check `authoredInCommit` is an ancestor of `origin/main` via
`git merge-base --is-ancestor <sha> origin/main`, run from the primary checkout `we:scripts/readiness/dispatch-plan.mjs`'s IO shell
already runs in (it shells `we:scripts/lane-pool.mjs list --acquirable`, a whole-pool-visibility op only meaningful centrally
— never from a lane clone). Any git failure (unknown SHA, non-ancestor, network hiccup) is treated as "not
verified" → refuse, matching invariant B ("absence is failure, never skip", design reference line 21). **Named
limitation, not fixed here:** this checks only the commit-ancestry half of invariant A. The registry-token /
content-hash verification is explicitly #2806's and #2812's job (design reference table rows 4/7) — #2807 does not
and cannot anticipate a registry that does not exist yet.

**Fork 4 — where does the classifier composition live: inside `dispatchPlan`'s pure core, or precomputed by the
IO shell?** Decided per call site, deliberately inconsistent with a stated reason at each: in `we:scripts/readiness/dispatch-plan.mjs`,
the pure core imports `isVisualTouch` + `ROUTE_ENTRIES` directly (mirrors `we:scripts/readiness/scope-reconcile.mjs`'s existing
precedent exactly, keeps the branch unit-testable with plain objects like the file's other 38 tests). In
`we:scripts/backlog/scaffold.mjs`, `renderItem` stays import-free and takes a precomputed `fidelityTouch` boolean, because
`we:scripts/backlog/scaffold.mjs`'s own docstring already states an explicit, existing preference to stay dependency-free (it
re-implements `normalizeScope` locally rather than importing `we:scripts/readiness/scope-lease.mjs`'s `normScope` for the same reason,
`we:scripts/backlog/scaffold.mjs:43-49`) — respecting that stated intent over uniformity.

## Known, accepted limitation (inherited, not introduced)

The route-graph half of the classifier only fires on an **exact** scope-entry match against `ROUTE_ENTRIES`' two
plateau-app file paths (`routesAffectedBy`, `we:scripts/lib/route-import-graph.mjs:192-204`, Set membership — no prefix
matching), and `ROUTE_ENTRIES` itself only knows `/console-board` today with no wired transitive graph. A coarse
directory-prefix scope entry (e.g. `plateau-app:src/backlog-view/`, the shape `we:scripts/backlog/scaffold.mjs`'s own docstring says
scope commonly takes, `we:scripts/backlog/scaffold.mjs:43-49`) will **not** trip the route-graph signal even when it covers a route
entry file. The WE/FUI path-regex half tolerates prefixes fine (`^src\/_includes\//`, `\/plugs\/webtheme\//`). This
gap is #2802's own documented follow-up ("wiring `buildImportGraph` to a committed real-graph snapshot… is the
follow-up"), not something #2807 introduces or is sized to fix. Wiring the same (currently narrow) composition at
scaffold + dispatch is still correct: it gives immediate, zero-cost defense-in-depth for every case the classifier
CAN already see, and it means the day #2802's follow-up widens the graph, scaffold and dispatch inherit the wider
coverage for free (no edit needed here).

## Interfaces

**`we:scripts/readiness/dispatch-plan.mjs` — `dispatchPlan()` (pure core), extended:**

```js
export function dispatchPlan({
  queue, leases, freeLanes,
  isTargetAncestor = () => true,
  // NEW — (sha: string) => boolean. True iff `sha` is an ancestor of the mainline the dispatcher is running
  // against. The IO shell wires the real `git merge-base --is-ancestor <sha> origin/main` check; every existing
  // caller/test that omits it is UNCHANGED (always-true default).
} = {}) { … }
```

Each `queue` row gains two new OPTIONAL fields (existing `num`/`kind`/`scope`/`openBlockers` unchanged):
```js
{
  fidelity,       // the item's raw `fidelity:` frontmatter value (object), or undefined
  fidelityScope,  // the item's scope AS-AUTHORED, repo-qualified, UNSTRIPPED — see "load-bearing finding" above.
                   // Distinct from `scope`, which stays repo-relative for the existing overlap logic.
}
```

New precedence step, inserted between the existing step 4 (`unshaped-no-scope`) and step 5 (lease overlap) — every
queued item still resolves to exactly ONE outcome, per the file's own invariant:
```js
const touched = isVisualTouch(item.fidelityScope, { routeGraph: { routeEntries: ROUTE_ENTRIES } });
if (touched || item.fidelity !== undefined) {
  const { errors } = validateFidelityContract(item.fidelity, { id: String(num) });
  if (errors.length) { held.push({ num, reason: 'fidelity-incomplete' }); continue; }
  const sha = item.fidelity?.target?.authoredInCommit;
  if (sha && !isTargetAncestor(sha)) { held.push({ num, reason: 'fidelity-target-in-lane' }); continue; }
}
```
New imports at the top of `we:scripts/readiness/dispatch-plan.mjs`: `isVisualTouch` (`we:scripts/lib/render-check.mjs`), `ROUTE_ENTRIES`
(`we:scripts/lib/route-import-graph.mjs`), `validateFidelityContract` (`we:scripts/lib/fidelity-contract.mjs`) — all three
zero-IO.

New exports, following the exact `UNSHAPED_HINT`/`NEEDS_SLICE_HINT` pattern (`we:scripts/readiness/dispatch-plan.mjs:94-109`):
```js
export const FIDELITY_INCOMPLETE_HINT =
  'UI-fidelity contract incomplete — author route/host/webcases/seeds/themes/target/baseline (see check:standards for field-level errors)';
export const FIDELITY_TARGET_IN_LANE_HINT =
  'fidelity target authored in-lane — target.authoredInCommit must pre-date the build (invariant A)';
```
`HELD_REASONS` (`we:scripts/readiness/dispatch-plan.mjs:90-92`) gains the two new tokens. The CLI's non-JSON hint ternary
(`we:scripts/readiness/dispatch-plan.mjs:389-393`) gains two more branches, same shape as the existing three.

`main()` IO shell changes:
- Row mapping (`we:scripts/readiness/dispatch-plan.mjs:342-353`): add `fidelity: it?.fidelity, fidelityScope: Array.isArray(it?.scope) ? it.scope : undefined,` — sourced from the SAME `byNum` lookup already used for `kind`/`scope`/`openBlockers`, taken BEFORE `toRepoRelative` is applied to the existing `scope` field.
- New `isTargetAncestor` wired into the `dispatchPlan({...})` call:
  ```js
  const isTargetAncestor = (sha) => {
    try { execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { stdio: 'ignore' }); return true; }
    catch { return false; }
  };
  ```

**`we:scripts/backlog/scaffold.mjs` — `renderItem()`, extended:**
```js
/**
 * @param {{ …, fidelityTouch?: boolean }} spec  fidelityTouch: true ⇒ append the UI-fidelity TODO body
 *   section. Precomputed by the caller (renderItem stays import-free, matching its existing stated
 *   dependency-free preference, scaffold.mjs:43-49) — never computed inside this function.
 */
export function renderItem(spec) {
  const { …, fidelityTouch = false } = spec;
  …
  const fidelitySection = fidelityTouch ? `\n## UI-fidelity contract (author before build)\n\n` +
    `This item's scope touches a presentation surface (the UI-fidelity classifier fired on its \`scope:\`, ` +
    `we:scripts/lib/render-check.mjs \`isVisualTouch\`). Per epic #2804, it must carry a complete ` +
    `\`fidelity:\` frontmatter block (route / host / webcases / seeds[empty+overflow] / themes[light+dark] / ` +
    `target / baseline — schema: we:scripts/lib/fidelity-contract.mjs) before it can dispatch to build; an ` +
    `incomplete contract or an in-lane target holds it at readiness (we:scripts/readiness/dispatch-plan.mjs). ` +
    `See we:reports/2026-07-31-ui-fidelity-gate-design.md for the schema + a worked example.\n` : '';
  return `${fm.join('\n')}\n# ${title}\n\n${lead}\n${fidelitySection}`;
}
```
No new `fm.push(...)` line — this NEVER emits a `fidelity:` YAML key (Fork 1). Confirmed safe against
`we:src/_data/backlog.js:263` (`firstParagraph(bodyMd)` — the digest/summary is only ever the FIRST paragraph, so
an appended trailing section cannot change what a card's one-glance digest shows).

**`we:scripts/backlog.mjs` — `scaffold()`, extended:**
```js
import { isVisualTouch } from './lib/render-check.mjs';   // ROUTE_ENTRIES already imported at line 51
…
const fidelityTouch = isVisualTouch(scope, { routeGraph: { routeEntries: ROUTE_ENTRIES } });
// `scope` here (we:scripts/backlog.mjs:652) is the raw, comma-split, repo-qualified --scope= flag value — the SAME
// as `fidelityScope`'s provenance in dispatch-plan.mjs (author-typed, unstripped). Passed straight through,
// no normalization needed for classification purposes.
const content = renderItem({ kind, size, slug, title, today: today(), blockedBy, parent, scope, digest: flag('digest'), scaffoldedBy: session, fidelityTouch });
```

## Tasks (build order)

1. `we:scripts/readiness/dispatch-plan.mjs`: add `fidelity`/`fidelityScope` to the IO shell's row mapping (no behavior change to
   existing fields).
2. `we:scripts/readiness/dispatch-plan.mjs`: import `isVisualTouch`, `ROUTE_ENTRIES`, `validateFidelityContract`; add the new
   precedence step to `dispatchPlan`'s pure core (step 4.5); add the `isTargetAncestor` parameter, defaulted
   `() => true`.
3. `we:scripts/readiness/dispatch-plan.mjs`: export `FIDELITY_INCOMPLETE_HINT` / `FIDELITY_TARGET_IN_LANE_HINT`; extend
   `HELD_REASONS`; extend the CLI hint ternary.
4. `we:scripts/readiness/dispatch-plan.mjs`: wire the real git-ancestor `isTargetAncestor` in `main()`.
5. `we:scripts/readiness/__tests__/dispatch-plan.test.mjs`: add tests — (a) UI-classified item with a complete, ancestor-valid contract
   launches; (b) UI-classified item with no `fidelity` holds `fidelity-incomplete`, even with a free lane and no
   competing lease (mirrors the existing `unshaped-no-scope`-with-free-lanes precedent test shape); (c) shape-valid
   contract whose `isTargetAncestor` stub returns false holds `fidelity-target-in-lane`; (d) a non-UI item with no
   `fidelity` block is unaffected (regression pin); (e) all 38 pre-existing tests still pass unmodified (proves
   the new parameter/fields are additive).
6. `we:scripts/backlog/scaffold.mjs`: extend `renderItem`'s signature + JSDoc with `fidelityTouch`; append the UI-fidelity TODO body
   section when true; add a comment noting it deliberately never emits a `fidelity:` key.
7. `we:scripts/backlog.mjs`: import `isVisualTouch`; compute `fidelityTouch` in `scaffold()`; thread it into `renderItem(...)`.
8. `we:scripts/backlog/__tests__/scaffold.test.mjs`: add tests — (a) `renderItem({..., fidelityTouch: true})` contains the TODO section; (b)
   `fidelityTouch: false`/omitted does not; (c) the emitted content never contains a literal `fidelity:` line
   (guards Fork 1's decision against a future accidental regression).
9. Gate: `npm run check:standards` (0 errors) + `npx vitest run we:scripts/backlog/__tests__/scaffold.test.mjs
   we:scripts/readiness/__tests__/dispatch-plan.test.mjs` (all green, 50 pre-existing + new).

## Done when

- `renderItem({ ...base, fidelityTouch: true })` includes the `## UI-fidelity contract` body section;
  `renderItem({ ...base })` (no `fidelityTouch`) and `renderItem({ ...base, fidelityTouch: false })` do not; no
  variant ever emits a `fidelity:` frontmatter line.
- `dispatchPlan` holds `{ num, reason: 'fidelity-incomplete' }` for a queued item whose `fidelityScope` trips
  `isVisualTouch` and whose `fidelity` is absent or shape-invalid per `validateFidelityContract` — even when a
  free lane is open and no lease/rival overlaps it.
- `dispatchPlan` holds `{ num, reason: 'fidelity-target-in-lane' }` for a queued item whose `fidelity` is
  shape-valid but whose injected `isTargetAncestor(fidelity.target.authoredInCommit)` returns `false`.
- `dispatchPlan` **launches** a queued item whose `fidelity` is shape-valid and whose `isTargetAncestor` returns
  `true` (the happy path is not over-blocked), and leaves every non-UI, no-`fidelity` item's launch/hold outcome
  byte-for-byte unchanged (the pre-existing 38 tests pass with no edits to their assertions).
- `node we:scripts/readiness/dispatch-plan.mjs --json`, run against this repo's current backlog (no item carries a
  `fidelity:` block), still returns `held: []` with respect to the two new reasons — confirms the addition is
  inert against real data, not just the fixtures.
- `npm run check:standards` → 0 errors. `npx vitest run we:scripts/backlog/__tests__/scaffold.test.mjs
  we:scripts/readiness/__tests__/dispatch-plan.test.mjs` → all pass (new + pre-existing).

## Delivery shape

Single WE-side PR, lands as one piece. The five touched files are tightly coupled (one shared classifier
composition, ~3 points of work total) and nothing here depends on an unbuilt sibling slice: #2806 (target
registry), #2809/#2810/#2811 (plateau-app harness/geometry/conformance) are product-side and irrelevant to this
WE-only change (WE holds zero implementation, MEMORY #6) — the `isTargetAncestor` provenance check works purely
off git history, needing no registry to exist. No incremental/behind-a-flag landing is needed: the change is
self-verified inert against every item currently on the board (see Done-when), so it cannot regress `main`'s
current dispatch behavior the moment it lands.
