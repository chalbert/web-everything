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

**`transition()` is NOT the only resolve path (independent-review correction, 2026-08-14).** Since #2748/#2899
the DRAIN owns the on-land `active`→`resolved` flip: `resolveLandedItem` (`we:scripts/lane-drain.mjs`:864,
called by both landers — `we:scripts/merge-ai-prs.mjs`:3716 is the one `/drain` actually runs) shells out to
the `resolve` verb of `we:scripts/backlog.mjs`, so it DOES enter `transition()`. Two consequences the guard's
design must own, not discover:

1. **It runs after the merge, in a synced clone.** `resolveLandedItem` calls `syncMain(CWD)` first (or, on the
   label lander, is already synced and holds only an un-pushed numbering commit), so `merge-base origin/main
   HEAD` ≈ `HEAD` and the committed half of the observed set comes back EMPTY — the guard passes vacuously on
   exactly the path Fork A's rationale says `check:standards` is too late for. Coverage is the
   producer-authored-in-lane resolve only.
2. **A firing guard there is swallowed.** The `execFileSync` is wrapped in `catch { return { flipped: false } }`
   — the caller reads that as "illegal transition" and falls through to the REOPEN path. So a hard error at the
   drain does not surface as an error; it surfaces as a silently re-opened item. The guard must therefore never
   be relied on as the enforcement point (that is #2812's gate-side floor) — it is a producer-lane speed bump.

`we:scripts/backlog.mjs`:1107 (`resolve-parent`, the on-land epic close) calls `applyTransition` DIRECTLY and
never enters `transition()`, so it is out of the guard's reach by construction. That is correct — an epic has
no diff of its own — but it should not be mistaken for coverage.

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
- `we:scripts/readiness/scope-lease-collect.mjs` — **`parseObservedFiles({diffOut, porcelainOut, repoKey})`
  (:105) already IS the observed-set parser this story needs** (independent-review correction): it takes the
  raw `git diff --name-only <base>...HEAD` and `git status --porcelain` stdout, unions them, repo-qualifies
  with `repoKeyFromSlug`, and normalizes via `normScope`. Its own header states the rule this story must obey
  — "COMPOSES, NEVER REINVENTS". So `observedFilesForResolve()` below is a **git shell only** and must call
  this function rather than re-deriving the union inline; the two paths must not drift on what `we:` means.
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
`isVisualTouch`, `routesAffectedBy`, `parseObservedFiles`) is imported, not written. The size is carried by the
edge cases (absent scope, empty observed set, `--force`, cross-repo) rather than by volume — **and, per the
independent review, by the git-initialised CLI fixture task 5 now names**. The 5 holds only because that
fixture is a ~30-line `beforeAll` on an existing harness shape; if it turns into a general git-fixture helper,
re-size to 8 rather than absorbing it.

## Decided design

### Fork A — where the reconciliation runs. **Decided: inside `transition()` on resolve, before the flip.**

The alternatives were the `check:standards` gate and the drain's on-land planner. Resolve-time wins because
it is the **only** seam where the item and its changed-file set are both in hand **on the producer-authored
path**: the producing lane clone still holds `origin/main..HEAD` plus the dirty tree, while `check:standards`
runs on `main` after the merge, where the item's diff is no longer attributable to it. That rationale does
**not** extend to the drain's resolve-on-land path (see the Premise-check correction above) — there the clone
is already synced and the observed set is empty, so the guard is inert. Fork A is therefore a decision about
where the CHEAP producer-side check lives, not a claim of full coverage; #2812 owns the real floor. Placing it
before `applyTransition` (`we:scripts/backlog.mjs`:311)
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
path-regex half is the half that CAN fire today (a `.njk`/`.css`/`src/_includes/**` edit declared under a
non-presentation scope) — but see the measured population below before calling that "closing the dodge".

**Measured population (independent review, 2026-08-14 — replayed over the last 1200 merges on `origin/main`,
2026-07-27 → 2026-08-14):** 426 merges resolved an item that carried a declared `scope:`. Replaying
`scopeLease(declared, observed).breach` → `isVisualTouch` over each merge's own file set, the guard would have
hard-errored **0 times** and warn-only'd 426 times. Only **14** merges in that window touched any WE
presentation file at all, and all 14 were `we:src/_includes/research-descriptions/*.njk` written by `/prepare`
— which stamps `preparedDate` and never resolves, so none of them reach this guard either. Read honestly:
**false-positive risk on today's traffic is zero, and so is the demonstrated true-positive rate.** This guard
is a FLOOR against a bypass class the WE repo is not currently exercising (WE work is `scripts/`/`docs/`/
`backlog/`-shaped right now), not a live catch. Build it as cheap insurance; do not report it as having
closed the epic's motivating incident — that incident was `plateau-app:src/backlog-view/lane-board-data.ts`,
which Fork B deliberately puts out of reach.

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

**"Warn" means RETURNED, not PRINTED (independent-review correction).** The measurement above found a
non-empty `undeclared` set on **426 of 426** recent resolves — printing it on every resolve would be pure
noise and would train the operator to ignore the line that also carries the real offenders. So
`reconcileScope` RETURNS `undeclared` (a consumer such as #2812's record can read it), and the CLI prints
**only** when `offending` is non-empty. The wiring snippet below already behaves this way; this paragraph and
the `Done when` row are worded to match it, so the builder does not add a per-resolve warn that the fork text
appears to ask for.

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
      and `clean` is true, while `undeclared` still lists it (Fork D: returned for a later consumer, not
      printed and not fatal — asserted on the return value, and asserted ABSENT from stderr at the CLI row).
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
returning `[]` on any failure. **Git only — it parses nothing itself:**

- Run `git merge-base origin/main HEAD`, then `git diff --name-only <base>...HEAD`, then
  `git status --porcelain`, then `git remote get-url origin`.
- Feed the three outputs to `parseObservedFiles({ diffOut, porcelainOut, repoKey: repoKeyFromSlug(slug) })`
  from `we:scripts/readiness/scope-lease-collect.mjs` (:105) — it already unions the committed and
  uncommitted halves, applies the rename-aware `porcelainFiles`, repo-qualifies, and `normScope`s.
  **Do not re-derive that union inline** (independent-review correction): a second copy would drift from the
  collector on what `we:` means, and the collector's own header makes "composes, never reinvents" the rule.
  This also means `porcelainFiles` does not need to be called directly here.

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

`die` (:81), `argv`, `idFromName`, `DIM`/`YEL`/`RST` (:65) are all already in scope in that function.
**New imports `we:scripts/backlog.mjs` does not have yet** (independent-review correction — the file currently
imports none of the three): `reconcileScope` from `we:scripts/readiness/scope-reconcile.mjs`, `ROUTE_ENTRIES`
from `we:scripts/lib/route-import-graph.mjs`, and `parseObservedFiles` from
`we:scripts/readiness/scope-lease-collect.mjs`. All three graphs are light —
`we:scripts/lib/render-check.mjs` imports only `we:scripts/lib/route-import-graph.mjs`, and
`we:scripts/readiness/scope-lease.mjs` only `we:scripts/readiness/lane-partition.mjs` — so no startup cost is
added to the backlog CLI, which every hook and the conveyor shell out to.

## Tasks (ordered)

1. Write `we:scripts/readiness/scope-reconcile.mjs` — the pure `reconcileScope` above, with a module header
   stating the two forks decided here (this-clone-only observation; presentation-only hard error).
2. Write `we:scripts/readiness/__tests__/scope-reconcile.test.mjs` covering the five pure-core `Done when`
   rows (undeclared presentation, declared subtree covers, undeclared non-presentation, route-graph hit,
   empty/absent inputs). Injected arrays only — no fs, no git.
3. Add the three imports named above, plus `readScopeList()` (gray-matter) and `observedFilesForResolve()`
   (git shell → `parseObservedFiles`) to `we:scripts/backlog.mjs`, both best-effort.
4. Insert the resolve guard block after `we:scripts/backlog.mjs`:310.
5. Add the CLI-level rows: a failing resolve leaves `status: active`; `--force` passes with a warning; a
   scope-less item resolves with the note. **The existing #2274 throwaway-clone substrate is NOT enough here**
   (independent-review correction): `we:scripts/backlog/__tests__/resolve-parent-cli.test.mjs` builds its temp
   clone with `mkdtemp` + `cpSync` and never runs `git init`, so `observedFilesForResolve()` would degrade to
   `[]` and every offending-file row would pass vacuously. These rows need the temp clone `git init`-ed with
   one commit and an `origin/main` ref, then a presentation file written on top. Budget for that fixture —
   it is the single largest piece of work in this story.
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
- **The drain's resolve-on-land path is uncovered** (added by independent review) — `resolveLandedItem` runs
  the same verb but in a clone already synced to merged `origin/main`, so the observed set is empty and the
  guard is inert there; and its `catch` turns any hard error into a silent stranded-reopen rather than a
  visible failure. This story does NOT fix that: making the drain surface a guard refusal, or attaching the
  producer's observed set to the manifest so the drain can reconcile post-merge, belongs with #2812/#2813.
- **No demonstrated live population** (added by independent review) — over the last 1200 merges the guard
  would have fired 0 times, because recent WE work touches no presentation files and the 14 merges that did
  came from `/prepare`, which never resolves. Ship it as a floor, and treat "did it ever fire?" as an open
  question for #2812's record rather than an assumed win. If it is still at 0 firings when #2812 lands, the
  honest move is to fold it into the gate-side floor and delete the resolve-time branch, not to keep a hard
  error on the resolve path that has never caught anything.
