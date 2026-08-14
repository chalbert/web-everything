---
bornAs: xbgtqkm
kind: story
size: 5
parent: "2804"
status: open
dateOpened: "2026-08-01"
blockedBy: ["2802"]
scope:
  - "we:scripts/readiness/scope-reconcile.mjs"
  - "we:scripts/backlog.mjs"
  - "we:scripts/readiness/__tests__/scope-reconcile.test.mjs"
scopeRationale: >-
  New pure core in we:scripts/readiness/scope-reconcile.mjs plus its unit test; the only edit to an existing
  file is the resolve branch of transition() in we:scripts/backlog.mjs. No change to
  we:scripts/readiness/scope-lease.mjs, we:scripts/lib/render-check.mjs, or
  we:scripts/lib/route-import-graph.mjs — all three are consumed as-is.
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# Resolve-time scope reconciliation

At resolve, diff declared scope against actually-changed files; an under-scoped item that touched a
presentation/route-graph surface it did not declare is a hard error. Closes the self-declared-scope master
bypass with the scope-lease `coversFile` lock.

## Premise check (verified against current code, 2026-08-14)

**Not built. Not partially built.** `transition()` in `we:scripts/backlog.mjs` (:248) has exactly one
resolve-time guard — the #658 no-open-slice epic check (:304-310) — and then goes straight to
`applyTransition` (:311) and `writeBacklogMd` (:313). No git read, no `scope:` read, no reconciliation. A
`grep` for `scope` across `we:scripts/backlog.mjs` returns only the scaffold path (:562, :581) and the claim
attribution baseline (:325-329) — nothing on resolve.

The blocker **#2802 is resolved**: it shipped `we:scripts/lib/route-import-graph.mjs`, so this story is
dispatchable now. Everything this story needs already exists as importable primitives — this is wiring plus a
pure decision core, not new machinery.

## Scope and consumers

Read directly, not inferred from the card's prose:

- `we:scripts/readiness/scope-lease.mjs` — the "coversFile lock" the card names is real and already generalized
  past raw set difference: `coversFile(pattern, file)` (:143) is repo-first and granularity-aware, and
  `scopeLease(predictedFiles, observedFiles)` (:214) already returns `{predicted, observed, inScope, breach,
  clean}` where `breach` is exactly "observed files covered by NO declared entry". `breachOf` (:223) is the
  one-line convenience form. **This story writes no new coverage matcher.**
- `we:scripts/lib/render-check.mjs` — `isVisualTouch(files, opts)` (:131) is the presentation predicate: a
  path-regex half (WE `*.njk` / `*.css` / `src/_includes/**`; FUI `plugs/webtheme/**`) plus, when
  `opts.routeGraph` is supplied, the route-import-graph half.
- `we:scripts/lib/route-import-graph.mjs` — `routesAffectedBy` (:192) / `isRouteAffectingChange` (:213) over
  `ROUTE_ENTRIES` (:161). **Note the live shape:** `ROUTE_ENTRIES` today registers exactly one route
  (`/console-board`) with two `plateau-app:` entry modules, and `graph` defaults to an empty `Map`, so the
  closure degenerates to the entry modules themselves. #2802 explicitly deferred the fs-backed / manifest
  snapshot resolver to a follow-up (see its module header, :24-31).
- `we:scripts/readiness/claimScope.mjs` — `porcelainFiles(porcelain)` (:95), the rename-aware
  `git status --porcelain` parser, is **already imported by `we:scripts/backlog.mjs`** (:44). No new import
  needed for the dirty-tree half.
- `we:scripts/check-standards.mjs` (:702-745) already guarantees the `scope:` field's shape at author time:
  array-of-strings, non-empty, every entry repo-qualified. So the reconciler may assume a well-formed
  `scope:` and needs no re-validation — only an absent-vs-present branch.
- `we:scripts/backlog/frontmatter.mjs` — `readField(content, key)` (:37) is **scalar-only** (it regex-matches
  the rest of one line). It cannot read a block-list `scope:`. The wiring must parse frontmatter with
  `gray-matter` via `createRequire` (already at `we:scripts/backlog.mjs`:37), the same way
  `we:scripts/check-standards.mjs`:691 does.

## Size

**5**, unchanged. Basis: one new ~90-line pure module with no IO, one ~35-line IO shell + guard block inside
an existing function, one new unit-test file. Every predicate it needs (`coversFile`, `scopeLease`,
`isVisualTouch`, `routesAffectedBy`, `porcelainFiles`) is imported, not written. The size is carried by the
edge cases (absent scope, empty observed set, `--force`, cross-repo) rather than by volume.

## Decided design

### Fork A — where the reconciliation runs. **Decided: inside `transition()` on resolve, before the flip.**

The alternatives were the `check:standards` gate and the drain's on-land planner. Resolve-time wins because
it is the **only** seam where the item and its changed-file set are both in hand: the lane clone still holds
`origin/main..HEAD` plus the dirty tree, while `check:standards` runs on `main` after the merge, where the
item's diff is no longer attributable to it. Placing it before `applyTransition` (`we:scripts/backlog.mjs`:311)
also means the contradiction is never written to disk — the same shape as the #658 epic guard directly above
it (:304-310), including its `--force` escape hatch with a printed warning. The gate-side and land-side
halves are **not** dropped: they are #2812 (WE floor, record consumption) and #2813 (on-land escalate), which
this story is deliberately not duplicating.

### Fork B — how "actually-changed files" are observed. **Decided: this clone only.**

The tempting wider design was to union in the sibling product clone's diff, so a `plateau-app:` edit could be
reconciled too. **Rejected, with the reason stated so a later session does not re-litigate it blind:** there
is no durable resolve-time record of which sibling clone held an item's product-side edits. The item→lane
registry (`we:scripts/lane-pool.mjs`:336-343, writing `we:.claude/lane-ports.json`) is written into each
pool's **own** primary checkout, only the WE pool's copy is populated in practice, and entries are dropped on
`unmap` / lane `remove` / `refresh` — so by resolve time the mapping may be gone. Inferring the product diff
from a best-effort pool walk would make a **hard error** depend on a soft, expiring signal, which is the worst
possible combination. The cross-repo proof is owned by #2812's commit-bound conformance record, which the
product renders rather than WE inferring.

Consequence, stated plainly rather than hidden: in a WE lane the observed set is `we:`-qualified, so the
route-graph half of `isVisualTouch` — whose only registered entry modules are `plateau-app:` paths — cannot
fire there today. It is still wired, because (a) `ROUTE_ENTRIES` is intended to grow WE routes, and (b) once
#2802's follow-up manifest lands the same call site gains the transitive half with no edit here. The
path-regex half fires today and is what closes the WE-side dodge (a `.njk`/`.css`/`src/_includes/**` edit
declared under a non-presentation scope).

### Fork C — what the guard does when `scope:` is absent. **Decided: pass, with a printed note.**

An unscoped item is already refused at dispatch (`unshaped-no-scope`, #2613) and its scope is auto-prepared,
so an absent `scope:` at resolve is a pre-#2613 legacy item, not a bypass attempt. Erroring there would break
resolves of old items for no fidelity gain. The note keeps it visible.

### Fork D — undeclared-but-not-presentation files. **Decided: warn, never error.**

The card's error condition is narrow on purpose: undeclared **and** presentation/route-graph. A lane that also
touched an undeclared `we:scripts/` file is scope drift, but scope drift is the ADVISORY signal of
`we:scripts/readiness/scope-lease.mjs` (its own header says the whole-clone lease is the real lock), and
re-grading all of it to error at resolve would break most normal resolves. Only the UI-fidelity bypass is the
hard error this epic owns.

## Done when

- [ ] `we:scripts/readiness/scope-reconcile.mjs` exists and exports a pure `reconcileScope({declared,
      observed, routeGraph})` that takes plain arrays and returns
      `{undeclared, offending, clean}` — no `fs`, no `child_process`, no `Date`, everything injected.
- [ ] Given `declared: ["we:scripts/foo.mjs"]` and `observed: ["we:scripts/foo.mjs", "we:src/_includes/x.njk"]`,
      `reconcileScope` returns `offending: ["we:src/_includes/x.njk"]` and `clean: false`.
- [ ] Given `declared: ["we:src/_includes/"]` and an observed `we:src/_includes/x.njk`, it returns
      `clean: true` — a declared subtree covers the file (the `coversFile` granularity contract, not a
      re-implementation).
- [ ] Given an undeclared file that is NOT presentation (e.g. a `we:scripts/` module), `offending` is empty
      and `clean` is true, while `undeclared` still lists it (Fork D: reported, not fatal).
- [ ] Given a `routeGraph` whose registered entry module is in the observed-and-undeclared set,
      `offending` includes it — proving the route-graph half is wired, not just the path-regex half.
- [ ] The `resolve` verb of `we:scripts/backlog.mjs` **exits non-zero and does not write the file** when the
      item declares a scope and the clone's diff contains an undeclared presentation file. Verified by
      asserting the item's `status:` is still `active` after the failed run.
- [ ] The same run with `--force` succeeds and prints a warning naming each offending file — mirroring the
      epic guard at `we:scripts/backlog.mjs`:304-310.
- [ ] An item with no `scope:` field resolves normally and prints the Fork-C note.
- [ ] A git failure (not a repo, `git` missing, detached base) does NOT fail the resolve — it degrades to a
      printed note, matching the best-effort convention already used by the claim-baseline block
      (`we:scripts/backlog.mjs`:325-333) and the claim cleanliness guard (:296-301).
- [ ] `npm run check:standards` stays at 0 errors and `npm run test:unit` passes.

## Interfaces and protocol

**1. New pure core — `we:scripts/readiness/scope-reconcile.mjs`:**

```js
/**
 * @param {object} a
 * @param {string[]} a.declared  the item's frontmatter `scope:` (repo-qualified, already shape-validated)
 * @param {string[]} a.observed  repo-qualified changed files (lane diff + dirty tree)
 * @param {object} [a.routeGraph] forwarded verbatim to isVisualTouch's opts.routeGraph
 * @returns {{undeclared: string[], offending: string[], clean: boolean}}
 */
export function reconcileScope({ declared, observed, routeGraph }) {
  const undeclared = scopeLease(declared, observed).breach;      // scope-lease.mjs:214 — NOT re-implemented
  const offending = undeclared.filter((f) => isVisualTouch([f], routeGraph ? { routeGraph } : {}));
  return { undeclared, offending, clean: offending.length === 0 };
}
```

`isVisualTouch` is called **per file** rather than on the whole set because it returns a boolean for the set;
the error message must name the specific offenders. Imports: `scopeLease` from
`we:scripts/readiness/scope-lease.mjs`, `isVisualTouch` from `we:scripts/lib/render-check.mjs`.

**2. IO shell — a new `observedFilesForResolve()` helper in `we:scripts/backlog.mjs`,** best-effort and
returning `[]` on any failure:

- `git merge-base origin/main HEAD` then `git diff --name-only <base> HEAD` (committed lane work), plus
  `porcelainFiles(git status --porcelain)` (already imported, :44) for uncommitted work.
- Repo-qualify each path with the clone's own repo key, derived from `git remote get-url origin` through
  `repoKeyFromSlug` (`we:scripts/readiness/lane-manifest.mjs`:171) — the same derivation
  `we:scripts/readiness/scope-lease-collect.mjs` uses in its IO shell, so the two agree on what `we:` means.

**3. Wiring — a new guard block in `transition()` (`we:scripts/backlog.mjs`), inserted immediately after the
epic guard (:310) and before `applyTransition` (:311):**

```js
if (v === 'resolve') {
  const declared = readScopeList(before);            // gray-matter, since readField (frontmatter.mjs:37) is scalar-only
  if (!declared?.length) {
    console.error(`${DIM}note: #${idFromName(file)} declares no scope: — resolve-time scope reconciliation skipped (#2613 legacy item).${RST}`);
  } else {
    const { offending } = reconcileScope({ declared, observed: observedFilesForResolve(), routeGraph: { routeEntries: ROUTE_ENTRIES } });
    if (offending.length && !argv.includes('--force'))
      die(`#${idFromName(file)} touched ${offending.length} presentation/route surface(s) its scope: never declared — an under-scoped UI item cannot resolve (#2803):\n${offending.map((f) => `    ${f}`).join('\n')}\nDeclare them in scope: (and let the UI-fidelity gate see the item), or pass --force.`);
    if (offending.length)
      console.error(`${YEL}warning:${RST} ${DIM}--force: resolving #${idFromName(file)} over ${offending.length} undeclared presentation surface(s): ${offending.join(', ')}${RST}`);
  }
}
```

`die`, `argv`, `idFromName`, `DIM`/`YEL`/`RST` are all already in scope in that function.

## Tasks (ordered)

1. Write `we:scripts/readiness/scope-reconcile.mjs` — the pure `reconcileScope` above, with a module header
   stating the two forks decided here (this-clone-only observation; presentation-only hard error).
2. Write `we:scripts/readiness/__tests__/scope-reconcile.test.mjs` covering the five pure-core `Done when`
   rows (undeclared presentation, declared subtree covers, undeclared non-presentation, route-graph hit,
   empty/absent inputs). Injected arrays only — no fs, no git.
3. Add `readScopeList()` and `observedFilesForResolve()` to `we:scripts/backlog.mjs`, both best-effort.
4. Insert the resolve guard block after `we:scripts/backlog.mjs`:310.
5. Add the CLI-level rows: a failing resolve leaves `status: active`; `--force` passes with a warning; a
   scope-less item resolves with the note.
6. Run `npm run check:standards` and `npm run test:unit`.

## Delivery shape

**One piece.** The pure core is ~90 lines and useless without its one call site, and the call site is a single
guard block in a function that already hosts an identically-shaped guard. Splitting core-from-wiring would
land a module with no consumer — the exact half-built shape the epic's post-mortem warns about. The parts this
story deliberately does **not** carry (the gate-side floor, the on-land escalation, the real route-graph
snapshot) are already separate items (#2812, #2813, and #2802's own follow-up), so the remaining unit is
atomic.

## Known residuals (named, not hidden)

- **Cross-repo observation** — a `plateau-app:` presentation edit is not reconciled here (Fork B). Covered by
  #2812's commit-bound conformance record.
- **Transitive route graph** — the route-graph half runs against `ROUTE_ENTRIES` with an empty adjacency map
  until #2802's manifest-snapshot follow-up lands, so it matches registered entry modules only, not their
  deeper imports. No edit to this story's call site is needed when that follow-up lands.
- **`--force`** remains an escape hatch by design, consistent with every other guard in `transition()`. Making
  it non-bypassable is #2812's job at the gate, where a `--force` at resolve leaves no trace the gate honours.
