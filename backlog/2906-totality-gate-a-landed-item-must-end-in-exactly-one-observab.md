---
bornAs: xtvn00y
kind: task
status: open
dateOpened: "2026-08-03"
tags: [merge-gate, review-integrity, check-standards, silent-failure]
relatedTo: ["2899", "2900", "2874"]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
---

# Totality gate: a step that withholds work from a merge decision must report what it withheld

A merge-gate step that filters items out of a set must account for every item it was given. Today a step can
`continue` past one and return a shorter list, and nothing notices: the item reaches no bucket, no log line, no
`--json` key, and the run reports complete success. **A silent withhold is indistinguishable from having had no
work to do.**

## Where this came from

Found by an advisory jury on PR #1017 (#2899) — and it is the same shape three times over, in one diff:

- `resolveIdsForLandedPass` dropped a couple whose sibling half was still open. Its comment claimed the item
  would "defer to a later pass"; it does not, because `landedThisPass` is only populated when a carrier merges
  *in* that pass. So the deferral was permanent **and** invisible — the fix for a silent-stranding bug had
  re-created a silent stranding.
- `resolveLandedItem` returned `flipped: true` even when its commit failed, so a failed flip printed
  `✓ resolved on land … + pushed to main` while the card was untouched on main.
- The per-item `catch {}` swallowed every error with no stderr line.

#2899's fix now emits four buckets — `resolved` / `alreadyResolved` / `deferred` / `failed` — each on stderr
**and** in `--json`. This item makes that shape enforceable instead of remembered.

## Why a gate and not a convention

The defect survives review because the code *looks* right. `if (blocked) continue;` is the correct safety
decision; only the absence of a report makes it a bug. A reviewer checks that a filter filters — nobody checks
that the filtered-out items are still accounted for.

Recall is demonstrably not the mechanism: the reviewer of PR #1012 raised "no silent caps" as a finding and then
shipped a silently-capped sweep in #1017 a few hours later, in the same session.

## What the rule must cover (A1–A4)

- **A1 — the rule.** A `check:standards` rule over the merge-gate modules
  ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs), [we:scripts/lane-drain.mjs](scripts/lane-drain.mjs),
  [we:scripts/lane-stack.mjs](scripts/lane-stack.mjs)): a function whose name matches `plan*` / `*ForLandedPass`
  and which iterates an input collection must either return every input key across its returned partitions, or
  carry an explicit `@partial <reason>` marker. Decidable by AST over the return shape — **no taint analysis**,
  which is the trap that made `2993` unbuildable as first written.
- **A2 — the caller half.** A returned `deferred` / `failed` / `skipped` array that is never read is itself the
  defect. Flag a call site that destructures only the positive bucket.
- **A3 — a real corpus.** The three shapes above, each asserted to be caught by the rule *before* #2899's fix and
  to pass *after* it — pinned against real regressions, not synthetic ones.
- **A4 — do not over-reach.** A pure predicate, a formatter, or anything outside the merge-gate set is out of
  scope. This is about decisions that gate a write to `main`, not about `Array.filter`.

## Boundary

Not a change to any gate's decision — every current defer/skip stays exactly as it is. This is purely the
accounting around them. Adjacent to but distinct from #2837, which extends a totality gate over *verdict* class
bodies; this one is about *work items* in a land pass.

## Design

*Grounded against the live tree 2026-08-21. The card's `scope` pointed the rules module at
`we:scripts/lib/`, where no such file exists — the real home is `we:scripts/check-standards-rules.mjs`, at the
top of `scripts/`, not under `lib/`. Corrected in frontmatter.*

### The seam — pure rule here, fs walk there

Follow the split every recent `check:standards` gate already uses (`scanRepoLocusPrefixes` at
[we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs) `:1754`, and §15's
[we:scripts/lib/review-skill-guard.mjs](scripts/lib/review-skill-guard.mjs)): the **pure** rule takes
`[{ file, content }]` and returns error strings; the fs walk lives in
[we:scripts/check-standards.mjs](scripts/check-standards.mjs) and is DERIVED from a frozen module list the
rule exports, never a second hardcoded list.

```js
// we:scripts/check-standards-rules.mjs — pure (parsing is pure; no fs, no exec)
/** The merge-gate modules this rule governs. `check-standards.mjs` derives its walk from THIS. */
export const LAND_PASS_MODULES = Object.freeze([
  'scripts/merge-ai-prs.mjs', 'scripts/lane-drain.mjs', 'scripts/lane-stack.mjs',
]);
export const LAND_PASS_PARTIAL_MARKER = '@partial';

/** @returns {{errors: string[], sites: Array<{file,line,fn,buckets:string[],marker:string|null}>}} */
export function checkLandPassTotality(docs = []) { /* … */ }
```

### The AST is available — and the parse failure must NOT degrade to skip

`typescript` is a **runtime `dependencies` entry** of this repo's `we:package.json`, and
`we:scripts/check-standards.mjs` (`:1544`) already does `createRequire(import.meta.url)('typescript')`.
Confirmed by running it: `ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)`
parses `we:scripts/merge-ai-prs.mjs` (~21k nodes) with no config and no program, so the rule can stay a pure
function of `content`.

**But copy that call site's mechanism, not its failure policy.** The `:1544` arm wraps the require in a
`try { … } catch { /* skip */ }` because the sibling FUI checkout is legitimately absent in CI. Here the
parser is a first-party dependency, so a failed parse or a missing `typescript` must be an **ERROR**, not a
silent skip. A gate that no-ops when its parser is unavailable is precisely the silent-withhold class this
item exists to close — it would be the defect wearing the fix's clothes.

### The real starting corpus (enumerate it, don't guess)

Running the `plan*` / `*ForLandedPass` name match over the three modules today yields exactly:

| module | matched functions |
|---|---|
| `we:scripts/merge-ai-prs.mjs` | `planCiLifecycleLabelUpdate`, `planResolveOnLand`, `resolveIdsForLandedPass`, `planDrainPass`, `planLabelDrain` |
| `we:scripts/lane-drain.mjs` | `planDrain`, `planWatch`, `planPostDrain` |
| `we:scripts/lane-stack.mjs` | *(none)* |

Eight sites. Small enough that A3's corpus can be real and the first run's output can be read in full — and
small enough that an over-broad name match is a design risk worth checking, not a theoretical one.

### A2 has a live instance to point at, today

`planResolveOnLand` ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:~1006`) returns
`{ resolve, deferred }`; the back-compat shim `resolveIdsForLandedPass` (`:1014`) returns **only**
`planResolveOnLand(o).resolve` — a caller that takes the positive bucket and discards `deferred`. Its own
JSDoc says so in words (*"a caller that only takes this list cannot honour the totality rule"*). That is the
A2 shape as an existing, in-tree fixture rather than a synthetic one. Whether the shim is a legitimate
documented exception (`@partial <reason>`) or a site to fix is a call the builder makes **explicitly** — do
not let the rule quietly pass it.

The four-bucket report #2899 shipped is assembled at `we:scripts/merge-ai-prs.mjs:3982`
(`{ resolved, alreadyResolved, deferred, failed }`) and surfaced under the `resolveOnLand` key of the `--json`
result at `:4041`. That is the shape the rule enforces the *existence* of, not the exact key names.

### Model to copy, not reinvent

[we:scripts/lib/verdict-totality.mjs](scripts/lib/verdict-totality.mjs) `checkVerdictTotality` (`:212`) is the
house pattern for a DERIVE-BASED totality gate: discovery finds consumers, an unmarked consumer is itself an
error, and a `@…-partial <reason>` opt-out **requires a reason** (a bare tag is its own error, `:245-250`).
Reuse that three-state shape (`total` / `partial+reason` / unmarked→error) verbatim; it already survived the
"a gate carrying its own hand list repeats the failure it guards" lesson.

## Done when

- `npx vitest run` against [we:scripts/__tests__/check-standards-rules.test.mjs](scripts/__tests__/check-standards-rules.test.mjs)
  is green with the A3 corpus: the three PR #1017 shapes (the permanent-invisible `deferred`, the
  `flipped: true` on a failed commit, the bare `catch {}`) each asserted RED against the pre-#2899 source and
  GREEN against the post-fix source, plus an A4 negative (a pure predicate / formatter fixture is not flagged)
  and an A2 case (a call site destructuring only the positive bucket is flagged). Every one of these fails
  today — the rule does not exist.
- A bare `@partial` with no reason is its own error, asserted as a case — mirroring
  `we:scripts/lib/verdict-totality.mjs`'s bare-marker rule, so the escape can never be silent.
- `node we:scripts/check-standards.mjs` → 0 errors with the new rule wired in, i.e. every one of the eight
  `plan*` / `*ForLandedPass` sites listed above either returns total partitions or carries an
  `@partial <reason>`. If any site needs the marker, the reason is written on the line, visible in the diff.
- The walk is derived, not duplicated: `we:scripts/check-standards.mjs` imports `LAND_PASS_MODULES` from the
  rules module and does not re-list the three merge-gate paths. Cheap check — `grep -n "merge-ai-prs" we:scripts/check-standards.mjs`
  returns no new hardcoded path from this change.
- A missing/failed `typescript` parse is reported as an ERROR by the rule, asserted as a case — never a skip.
- **A2's caller scan reaches beyond `LAND_PASS_MODULES`, or says in one line why it does not** (juror finding,
  2026-08-21): the rule's fs walk is derived from the three merge-gate modules, so a *fourth* file that imports
  `planDrainPass` / `planResolveOnLand` and keeps only the positive bucket is invisible to A2 as scoped —
  the same silent withhold, one file over. Asserted by a case: a fixture call site OUTSIDE the three modules
  that destructures only the positive bucket is either flagged, or the rule's docstring states the scope limit
  explicitly so nobody reads A2 as repo-wide.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: prove the premise by mutation or reversion firsting) — Confirmed no existing check:standards rule polices land-pass totality today (grep for LAND_PASS/checkLandPassTotality returns nothing outside the card itself), and the three PR #1017 shapes cited are real: we:scripts/merge-ai-prs.mjs:1014's resolveIdsForLandedPass shim still exists with the exact JSDoc the card quotes, and the production caller at we:scripts/merge-ai-prs.mjs:3961 already consumes planResolveOnLand's full {resolve, deferred} shape post-#2899.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The eight-site table was verified by direct grep against we:scripts/merge-ai-prs.mjs, we:scripts/lane-drain.mjs, we:scripts/lane-stack.mjs today: all five/three/zero counts match exactly, so A3's corpus size claim is not inflated or understated.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — A2's call-site scan only covers spans within the three LAND_PASS_MODULES files' own content (the fs walk is explicitly restricted to that frozen list); a future caller of e.g. planDrainPass added in a fourth file that destructures only the positive bucket would not be found by ES-import or subprocess search beyond those three files. Today this is moot — grep confirms zero external callers of any of the eight functions exist outside their own defining module plus tests — but the design leaves that blind spot uncovered going forward.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The 'node we:scripts/check-standards.mjs → 0 errors' acceptance criterion is a genuine round-trip test at the pure-rule/fs-walk seam, run against real files rather than a mock — matching the scanRepoLocusPrefixes/checkVerdictTotality precedent it says it follows, which I confirmed is wired the same way at we:scripts/check-standards.mjs:1929-1963.
- **population** (addressed; strategy: name the population each threshold guards) — The population (the eight plan*/*ForLandedPass sites) is named explicitly and verified against the live tree rather than estimated.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — A3 requires the three PR #1017 shapes asserted RED against pre-#2899 source and GREEN against post-fix source — this is a built-in mutation test for the guard itself, stronger than the taxonomy's minimum bar of 'a named test reddens.'
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The ~21k-node TS-parse claim over we:scripts/merge-ai-prs.mjs was independently reproduced (21,281 nodes, exact match), and typescript's placement in `we:package.json` 'dependencies' (not devDependencies) was confirmed, grounding the no-silent-skip argument.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card's core mechanism is legibility itself: a missing/failed typescript parse must be a hard ERROR, contrasted explicitly and correctly against the existing try{}catch{resolveExports=()=>null} silent-skip arm at we:scripts/check-standards.mjs:1542-1568, which I verified degrades exactly as described.

**Corrections recommended:**

- none — the preparation held up as written.

Every citation the card makes (line numbers, function names, the node count, the dependencies-vs-devDependencies placement, the existing try/catch-skip contrast, the verdict-totality precedent, the four-bucket --json key) checks out exactly against the live repo, and the acceptance criteria bake in a real regression corpus rather than synthetic fixtures — this is unusually well-grounded preparation.

_Recorded through the declared `review-prep` operation._
