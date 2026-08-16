---
bornAs: xl5dnuc
kind: story
size: 5
status: resolved
dateOpened: "2026-08-02"
dateResolved: "2026-08-16"
graduatedTo: none
preparedDate: "2026-08-14"
relatedTo: ["2832"]
tags: [conveyor, merge-ordering, review-integrity]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
scopeRationale: >-
  Two sibling predicates plus their wiring, all inside we:scripts/merge-ai-prs.mjs — `provenLanded` and
  `stackProven` live in `planLabelDrain`, the carrier-side twin of the same couple test is already inlined in
  `joinImplToCouples`, and the counter-evidence set must be re-derived in that file's own cascade loop (the
  `replan` closure) because plan-time derivation is provably inert. Tests go beside the existing
  `planLabelDrain` / couple-join suites in we:scripts/__tests__/merge-ai-prs.test.mjs. Both predicates are
  module-local consts with no external reader; we:scripts/conveyor/pr-watch.mjs shells out to this CLI rather
  than importing them, so it needs no change.
---

# `blockWait` can clear a dependent's edge on a blocker whose WE carrier landed but whose impl half is still open+red

> **Against #999's change, not #2832's.** This was surfaced by the human `/review` of PR **#984** (#2832) but
> the defect is in **#999**'s liveness fix (`we:scripts/merge-ai-prs.mjs` — the `blockWait` / `provenLanded`
> predicate), not in #2832's label/hold work. Filed standalone so #984 lands without folding an unrelated fix.

## Premise re-verified 2026-08-14 — still live, but narrower than filed

The reproduction below was re-run against `origin/main` at `95a8fc46` (independent review, 2026-08-14) and
**still yields `ready [30]`**, so the defect is real and unfixed. Two corrections to the original framing, both
found by reading the current code rather than the card's prose:

1. **A carrier-side gate has since been built that closes most of the window.** `joinImplToCouples`
   (`we:scripts/merge-ai-prs.mjs:730-749`, the #2989 R7 pass) already refuses to let a WE carrier enter
   `ready` while any sibling ref named in its `manifestRefs` is still open and not landing this pass — it stamps
   `coupleDefer = true` with `coupleDeferReason = 'impl-open'`. So in a healthy, complete-context pass the
   "WE half landed while the impl half is still open" state can no longer be *created* by the drain itself.
   That gate did not exist when this card was filed; the card should not be built as if the carrier side were
   untouched.

2. **The hole that remains is the STALE-PLAN window, not a missing gate.** The R7 gate is computed **once, at
   plan time**, and it is *not* re-derived across merges — so the ways `landedThisPass` can gain an item whose
   couple is not whole are exactly the ways the plan goes stale *after* it was computed:
   - **The impl half's `gh pr merge` throws mid-cascade.** This is the live one, and it is already written down
     in this file: the resolve-on-land gate's own comment at `we:scripts/merge-ai-prs.mjs:3661-3670` states it
     outright — "the couple decision is computed once at PLAN time, and the in-cascade `replan` re-runs
     `planLabelDrain` WITHOUT the couple join — so if the impl's merge throws, its decision flips to `skip` and
     the carrier still lands." The R7 gate cleared the carrier because `readyImplRefs` held the impl's ref (it
     was *planned* to merge); the throw sets that impl to `skip`; `replan` at `:3476` re-orders without re-running
     the join; the carrier merges; `landedThisPass` gains the item at `:3534` with the impl half still open.
     PR #1012's round-3 review (B5) fixed this for the RESOLVE path and left the ORDERING path open. That is
     this item.
   - **`provenOnMain`** — a carrier `bornAs`-proven on `origin/main` from a *prior* session, which carries no
     in-memory evidence about its impl half. See the residual below.
   - a **direct call** to `planLabelDrain` with a pre-seeded proof set — the reproduction, and the in-process
     `replan` closure at `we:scripts/merge-ai-prs.mjs:3418`, which is the drain's only live plan producer inside
     the cascade loop.

   In each, `provenLanded` at `we:scripts/merge-ai-prs.mjs:1269` reads the item as landed and `blockWait` at
   `:1279` drops the dependent's edge.

   Two paths named in the first preparation are **not** entries and were removed: the concurrent-lander
   idempotency branches (`:3522`, `:3546`) sit inside `for (const c of plan.ready)`, so the `impl-open` gate DID
   run on that carrier and cleared it — they bypass the merge write, not the gate; and
   `we:scripts/conveyor/pr-watch.mjs` does not call `planLabelDrain` in-process at all, it shells out to
   `we:scripts/merge-ai-prs.mjs --only=<pr>`, so it inherits whatever this file does rather than adding a surface.

**Severity stays low** and the original reasoning holds: it needs an impl-half merge to fail mid-cascade. It is
worth pinning before `provenLanded` is consumed by anything unattended.

## The defect

`we:scripts/merge-ai-prs.mjs` `planLabelDrain` clears a cross-item `blockedBy` edge as soon as the blocker is
`provenLanded` (`:1269`, `:1279`):

```js
const provenLanded = (id) => landedThisPass.has(id) || provenOnMain.has(id);
const blockWait = (Array.isArray(c.blockedBy) ? c.blockedBy : [])
  .map(asItemId).filter((b) => openItems.has(b) && !provenLanded(b));
```

`landedThisPass` is keyed on the **WE-carrier merge** (the resolve carrier, where `bornAs` is stamped —
`:3534`, guarded on `c.hasManifest`). But a couple is impl-first/WE-last across repos, and a blocker's WE half
can land while its **impl half is still open — or red**. In that window the blocker reads as `landedThisPass`,
`blockWait` drops the edge, and the dependent merges even though the blocker is not fully landed.

## Reproduction (from the reviewer — re-run 2026-08-14, still fails)

```js
planLabelDrain(
  [{ num: 20, item: 100, decision: 'skip', hasManifest: true },
   { num: 30, item: 101, blockedBy: [100], decision: 'merge', hasManifest: true }],
  { landedThisPass: new Set([100]) })
// → ready [30]   deferred []
// #30 merges because item 100 reads "landed this pass" — but its carrier's impl half could still be open/red.
```

## The decided design

The card's original suggestion was to redefine `landedThisPass` so it registers an item only when the **whole
couple** landed. **Rejected** — that set has two other load-bearing consumers that need the carrier-keyed
meaning:

- `planResolveOnLand` (docblock `we:scripts/merge-ai-prs.mjs:753`, signature `:790`) takes `landedThisPass` as
  its `landedItems`, and #2899's jury J2 **totality** rule (`:3702-3709`) requires every id in that set to end
  in exactly one *observable* bucket — resolved / already-resolved / deferred / failed. `planResolveOnLand`
  already subtracts the incomplete couples itself (`:820-825`) into a **reported** `deferred` bucket, which is
  the A4 stranded sweep's only input. Narrowing `landedThisPass` upstream would not change which cards flip —
  it would delete the *report*, so a stranded couple would vanish with no log line and no recovery path. That
  is the regression, and it is the reason the set must stay carrier-keyed — not "silently drop resolves", which
  was the first preparation's stated reason and is inaccurate.
- `stackProven` (`:1255-1260`) reads it as proof (1). Narrowing the set would change the #2393 stowaway gate's
  meaning as a side effect of an ordering fix.

**Decision: keep `landedThisPass` exactly as it is, and add separate negative counter-evidence.**

- Add a `coupleIncomplete: Set` (same `asItemId` keying) to `planLabelDrain`'s proof bag. `provenLanded`
  becomes `(landedThisPass.has(id) || provenOnMain.has(id)) && !coupleIncomplete.has(id)`.
- This preserves the module's stated shape — the edge still clears only on **positive proof**, never on
  absence — and only *subtracts* clearances, so it can add a defer but never remove one.
- **`stackProven` gets the same subtraction, in the same edit.** Proof (1) at `:1256`
  (`landedThisPass.has(id) → true`) is the identical hole one screen above `provenLanded`, and the #2393
  stowaway guard it serves is the *stronger* of the two invariants: landing a descendant past a parent whose
  impl half never landed drags half a parent onto `main` under the child's number. Fixing only `blockWait`
  would leave the sibling predicate wrong and read, to the next person, as a deliberate carve-out. Proof (3)
  (`provenOnMain`) is out of scope on both predicates for the reason in the residual below.

### Where the set is derived — plan time is TOO EARLY

The first preparation put the derivation in `planDrainPass` (`:1147-1155`), single-sourced with the R7 gate.
**That is provably a no-op** and must not be built:

- `coupleImplOpen(carrier) === true` at plan time ⇒ `joinImplToCouples` stamps `coupleDefer = 'impl-open'`
  (`:737-749`) ⇒ `planLabelDrain` gives the carrier a `coupleWait` and puts it in `deferred`, never `ready`
  ⇒ the cascade never iterates it ⇒ its item never enters `landedThisPass`.
- So a plan-time `coupleIncomplete` built from the *same inputs via the same helper* is **disjoint from
  `landedThisPass` by construction**. Subtracting it can never change an answer. The tests would go green (they
  hand-seed the set) while production behaviour is byte-identical — a guard that cannot fire.

**Derive it in the cascade instead, against a refreshed open-ref set, and thread it into `replan`.** This
mirrors exactly what the resolve-on-land gate already does at `:3679-3701`:

- The carriers stay available: the cascade copies `verdicts` into `remaining` (`:3470`) and never mutates
  `verdicts`, so a merged carrier's `manifestRefs` are still in memory for the whole pass.
- Maintain `mergedRefs` (the head refs actually merged this pass — the cascade already has `merged`) and derive
  the live open-ref set as `openHeadRefs \ mergedRefs`, the same subtraction `:3686-3701` performs. Without it
  the pass-start snapshot still lists a sibling that merged normally, and every ordinary impl-first/WE-last
  couple would be wrongly marked incomplete — that is the one way this change could suppress a legitimate
  clearance, so the subtraction is load-bearing, not hygiene.
- Recompute `coupleIncomplete` inside the cascade loop immediately before each `replan(remaining)` (`:3476`),
  and pass it into the `replan` closure (`:3418`). `replan` is the drain's ONLY in-cascade plan producer; a set
  wired into `planDrainPass` alone never reaches it.
- `planDrainPass` still accepts and forwards a caller-supplied `coupleIncomplete` (tests, and any future
  caller), but derives nothing itself — at plan time there is nothing for it to derive.
- **Single-source the predicate.** The "is this couple whole?" test is the loop inlined in `joinImplToCouples`
  at `:736-749`. Extract it to one exported helper used by both the R7 gate and the cascade derivation, so the
  carrier-side `impl-open` defer and the blocker-side edge agree on what "landed" means. The two call sites
  differ only in their *inputs* — plan-time `readyImplRefs` (planned) versus in-cascade `mergedRefs` (actual) —
  which is precisely why the predicate must take them as arguments rather than close over either.

### Named residual — the `provenOnMain` arm is NOT covered

A carrier `bornAs`-proven on `main` from a prior session has no live verdict in this pass, so nothing in memory
names its couple's refs. `landedNumberFor` proves only *that* the item landed, never *which PR* carried it, so
there is no handle to walk from.

**Correction to the first preparation's stated reason.** It claimed the couple's refs are "unrecoverable"
because the manifest is dropped before land and read off a head ref. That is wrong on both halves: #2411 moved
the manifest into the **PR body**, and `readPrManifest` (`we:scripts/merge-ai-prs.mjs:2453-2474`) reads the body
FIRST — the tree-committed file and the contents-API read off a head ref are the *legacy fallback*. A PR body
survives the merge indefinitely, so a landed carrier's `manifestRefs` are perfectly readable via
`gh pr view <num> --json body`. What is missing is not the record but the **join key**: getting from a
`bornAs` hash on `main` to that PR number costs a merged-PR search per proven item, per pass.

So the residual is a **cost** call, not an impossibility, and it is carved out on that basis: it adds an
unbounded `gh` search to the hot path for a strictly rarer window than the one this item closes. Closing it
belongs in its own item, which should start from "search merged PRs for the carrier and read its body
manifest", not from "build a durable post-land record" — do not silently widen this one to attempt either.

## Done when

- [ ] `planLabelDrain` accepts `coupleIncomplete` in its proof bag and `provenLanded` returns `false` for any
      id in it, positive proof notwithstanding.
- [ ] `stackProven` proof (1) (`:1256`) makes the SAME subtraction: a `stackParent` in both `landedThisPass`
      and `coupleIncomplete` is NOT proven, so the descendant defers.
- [ ] The reproduction above, re-run with `coupleIncomplete: new Set([100])`, yields `deferred [30]` with
      `waitOn` naming item `100` — not `ready [30]`.
- [ ] The reproduction above **unchanged** (no `coupleIncomplete`) still yields `ready [30]`, proving the
      default is a pure no-op and #999's liveness fix is not regressed.
- [ ] A fully-landed blocker (in `landedThisPass`, absent from `coupleIncomplete`) still frees its dependent
      in the same pass — the #999 F1 chain-liveness case at
      `we:scripts/__tests__/merge-ai-prs.test.mjs:500` still passes unmodified.
- [ ] The couple-completeness test is ONE exported helper taking its open-ref and landing-ref sets as
      arguments, called by both `joinImplToCouples` (`:737-749`) and the in-cascade derivation — a test fails
      if either re-inlines its own copy.
- [ ] **The reachability test — this is the one that proves the fix is not decorative.** A `planDrainPass`
      case that ONLY populates `coupleIncomplete` at plan time, from the same helper and the same plan-time
      inputs as the R7 gate, must show the set is **disjoint from anything that can reach `landedThisPass`**:
      every carrier the helper flags is already `coupleDefer: 'impl-open'` and therefore absent from
      `plan.ready`. The test asserts that disjointness, so a future refactor that moves the derivation back to
      plan time fails instead of quietly going inert.
- [ ] **The real-window test.** Drive the cascade shape the resolve-on-land comment at `:3661-3670` describes:
      the impl half is planned to merge (so the R7 gate clears its carrier), its merge then fails and flips to
      `skip`, the carrier lands and enters `landedThisPass`. A dependent `blockedBy` that item must land in
      `deferred`, not `ready`, on the NEXT `replan` — i.e. the re-derived `coupleIncomplete` reaches `replan`.
      This fails on today's code and on any plan-time-only wiring.
- [ ] **The merged-sibling no-regression test.** An ordinary impl-first/WE-last couple where the impl DID merge
      this pass: its ref is in the pass-start `openHeadRefs` snapshot but also in `mergedRefs`, so the item must
      NOT appear in `coupleIncomplete` and its dependents must stay `ready`. Without the `\ mergedRefs`
      subtraction every healthy couple would defer — this is the test that pins it.
- [ ] `provenOnMain`-only proof is documented in the `planLabelDrain` docblock as explicitly NOT covered, with
      the real reason (the manifest IS durable in the PR body; the missing piece is the hash→PR-number join),
      so a later reader does not repeat the "unrecoverable" claim.
- [ ] `npm run check:standards` at 0 errors and `npm run test:unit` green.

## Interfaces

Current, at `origin/main` `95a8fc46` (re-checked against the file during the independent review):

```js
// we:scripts/merge-ai-prs.mjs:1223
export function planLabelDrain(candidates, { landedThisPass = new Set(), provenOnMain = new Set(),
  extraOpenItems = null, contextComplete = true, isWeRepo = () => false } = {})
// → { ready, deferred, staleLandedOpenItems }

// we:scripts/merge-ai-prs.mjs:1269
const provenLanded = (id) => landedThisPass.has(id) || provenOnMain.has(id);

// we:scripts/merge-ai-prs.mjs:1139
export function planDrainPass({ verdicts, listings, openPrContext, …, landedThisPass = new Set(),
  provenOnMain = new Set() } = {})

// we:scripts/merge-ai-prs.mjs:671
export function joinImplToCouples(verdicts,
  { carrierHealth = null, truncated = false, contextComplete = false, openHeadRefs = null } = {})

// we:scripts/merge-ai-prs.mjs:3418 — the in-cascade plan producer the fix MUST reach
const replan = (cands) => planLabelDrain(cands, { landedThisPass, provenOnMain, extraOpenItems,
  contextComplete, isWeRepo });
```

Proposed additions (no signature is broken — every new param defaults to empty/absent):

```js
// the extracted single-source predicate — both ref sets are ARGUMENTS, because the two call sites
// differ exactly there (plan time: planned-to-merge refs; in-cascade: refs actually merged).
export function coupleImplOpen(carrier, { openHeadRefs, landingRefs })   // → boolean
// planLabelDrain proof bag gains:  coupleIncomplete = new Set()   (subtracted in BOTH provenLanded and stackProven)
// planDrainPass proof bag gains:   coupleIncomplete = new Set()   (forwarded only — nothing to derive at plan time)
// the `replan` closure gains a re-derived `coupleIncomplete` per cascade iteration
```

## Tasks

1. Extract the `:737-749` inlined couple-completeness loop into an exported `coupleImplOpen(carrier, {
   openHeadRefs, landingRefs })` helper; re-point `joinImplToCouples` at it, passing its plan-time
   `readyImplRefs` as `landingRefs`. Pure refactor — the existing `impl-open` test at
   `we:scripts/__tests__/merge-ai-prs.test.mjs:3531` must pass untouched.
2. Add `coupleIncomplete` to `planLabelDrain`'s proof bag and subtract it in BOTH `provenLanded` (`:1269`) and
   `stackProven` proof (1) (`:1256`). Update the `:1246-1268` comment blocks to state the counter-evidence rule
   and why the subtraction applies to both predicates.
3. In the cascade (`:3470-3480`), maintain a `mergedRefs` set of the head refs actually merged this pass and
   re-derive `coupleIncomplete` from `verdicts`' carriers + (`openHeadRefs` minus `mergedRefs`) via
   `coupleImplOpen`, immediately before each `replan(remaining)` (`:3476`). Thread it into the `replan` closure
   (`:3418`). Reuse the `mergedRefs`/`openHeadRefs` construction the resolve-on-land gate already performs at
   `:3686-3701` rather than writing a second copy.
4. Give `planDrainPass` a pass-through `coupleIncomplete` for callers and tests. Do NOT derive it there — add a
   comment saying why (plan-time derivation is disjoint from `landedThisPass` by construction), so the next
   reader does not "helpfully" move it back.
5. Document the `provenOnMain` residual in the `planLabelDrain` docblock (`:1195-1222`) with the corrected
   reason: the couple's refs survive in the merged carrier's PR body (#2411), what is missing is the
   hash→PR-number join, and the cost of that lookup is why it is a separate item.
6. Tests beside the existing suites — the `#999` liveness suite at
   `we:scripts/__tests__/merge-ai-prs.test.mjs:500` (no-regression) and the couple-join suite at `:637` (new
   behaviour), plus the three cascade-level cases named in *Done when*: reachability/disjointness, the
   real-window impl-merge-throw case, and the merged-sibling no-regression case.

## Size

**5.** Basis: the fix itself is still small — one extracted predicate, two one-line subtractions — but the
independent review moved the wiring OUT of the pure `planDrainPass` seam and INTO the live cascade loop, which
is a materially different job. The cascade is stateful (`remaining`, `merged`, per-iteration `replan`), it is
the drain's single write path to `main`, and it is where the `\ mergedRefs` subtraction has to be exactly right
or every healthy couple defers. It also now touches two predicates (`provenLanded` and `stackProven`), inside
the densest invariant cluster in the repo (`planLabelDrain` carries #2188 / #2393 / #999 / #2989 at once),
and it carries three cascade-level tests rather than pure-function ones. Not a 3 — a 3 was the plan-time
version, which is provably inert. Not an 8 — it is still one file, no signature break, and the `provenOnMain`
arm stays out of scope.

## Delivery shape

**One piece.** The predicate extraction, the two subtractions and the cascade wiring are meaningless apart —
extracting `coupleImplOpen` alone changes no behaviour, and adding `coupleIncomplete` without re-deriving it in
the cascade ships a parameter nothing ever sets to a non-empty value. Slicing would produce exactly the
half-state the first preparation would have shipped: the defect still live, the tests green, and the code
reading as if it were fixed. The one genuine seam — the `provenOnMain` arm — is carved out above as a separate
future item, not a slice of this one.

## Verified & resolved 2026-08-16 — shipped via merged PR #1261, status was stale

Re-verified against the live tree before resolving (a queue-generation scan flagged this card's `status: open`
as lagging reality; checked independently rather than trusted):

- **PR [#1261](../../pull/1261)** ("#3004 blockWait: a half-landed couple no longer clears a dependent's
  edge", head `lane/build-3004`) is `state: MERGED`, merge commit `dbf807dd`, which is an ancestor of
  `origin/main` HEAD.
- [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs) carries the exported `coupleImplOpen` predicate
  (`:664`), the `deriveCoupleIncomplete`/`liveOpenHeadRefs` cascade derivation (`:689-746`), and both
  subtractions this card specified: `stackProven` proof (1) at `:1398`
  (`landedThisPass.has(id) → !coupleIncomplete.has(id)`) and `provenLanded` at `:1415`
  (`(landedThisPass.has(id) || provenOnMain.has(id)) && !coupleIncomplete.has(id)`). The in-cascade `replan`
  closure threads a per-iteration `coupleIncomplete` (`:3564-3634`), matching the "derive it in the cascade,
  not at plan time" design this card ruled.
- [we:scripts/__tests__/merge-ai-prs.test.mjs](../scripts/__tests__/merge-ai-prs.test.mjs) — 387 tests, all
  green (`npx vitest run`).
- `npm run check:standards` — 0 errors on the current tree.

All Done-when items are satisfied by code already on `main`; nothing further to build.
