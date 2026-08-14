---
bornAs: xl5dnuc
kind: story
size: 3
status: open
dateOpened: "2026-08-02"
preparedDate: "2026-08-14"
relatedTo: ["2832"]
tags: [conveyor, merge-ordering, review-integrity]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
scopeRationale: >-
  One pure predicate plus its wiring, both inside we:scripts/merge-ai-prs.mjs — `provenLanded` and the
  couple-completeness signal fed to it live in `planLabelDrain` / `planDrainPass`, and the carrier-side twin of
  the same predicate is already in `joinImplToCouples` in that file. Tests go beside the existing
  `planLabelDrain` suites in we:scripts/__tests__/merge-ai-prs.test.mjs. No other file reads `provenLanded`.
---

# `blockWait` can clear a dependent's edge on a blocker whose WE carrier landed but whose impl half is still open+red

> **Against #999's change, not #2832's.** This was surfaced by the human `/review` of PR **#984** (#2832) but
> the defect is in **#999**'s liveness fix (`we:scripts/merge-ai-prs.mjs` — the `blockWait` / `provenLanded`
> predicate), not in #2832's label/hold work. Filed standalone so #984 lands without folding an unrelated fix.

## Premise re-verified 2026-08-14 — still live, but narrower than filed

The reproduction below was re-run against `origin/main` at `087d7318` and **still yields `ready [30]`**, so the
defect is real and unfixed. Two corrections to the original framing, both found by reading the current code
rather than the card's prose:

1. **A carrier-side gate has since been built that closes most of the window.** `joinImplToCouples`
   (`we:scripts/merge-ai-prs.mjs:730-749`, the #xc7p3q9 R7 pass) already refuses to let a WE carrier enter
   `ready` while any sibling ref named in its `manifestRefs` is still open and not landing this pass — it stamps
   `coupleDefer = true` with `coupleDeferReason = 'impl-open'`. So in a healthy, complete-context pass the
   "WE half landed while the impl half is still open" state can no longer be *created* by the drain itself.
   That gate did not exist when this card was filed; the card should not be built as if the carrier side were
   untouched.

2. **The hole that remains is the entry paths that bypass that gate**, i.e. the ways `landedThisPass` /
   `provenOnMain` can gain an item whose couple is not whole:
   - the **concurrent-lander idempotency paths** (`we:scripts/merge-ai-prs.mjs:3522` and `:3546`) — another
     lander merged the carrier out from under this pass, so the plan's `impl-open` gate never ran on it, yet the
     item is still added to `landedThisPass`;
   - **`provenOnMain`** — a carrier `bornAs`-proven on `origin/main` from a *prior* session, which carries no
     evidence at all about its impl half;
   - any **direct call** to `planLabelDrain` with a pre-seeded proof set (what the reproduction does, and what
     `we:scripts/conveyor/pr-watch.mjs` does).

   In all three, `provenLanded` at `we:scripts/merge-ai-prs.mjs:1269` reads the item as landed and
   `blockWait` at `:1279` drops the dependent's edge.

**Severity stays low** and the original reasoning holds: it needs the merge ordering to already be in a
partially-broken state. It is worth pinning before `provenLanded` is consumed by anything unattended.

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
couple** landed. **Rejected** — that set has a second, load-bearing consumer with the opposite requirement:
`planResolveOnLand` (`we:scripts/merge-ai-prs.mjs:753`) takes `landedThisPass` as its `landedItems` and its
docblock at `:756` states outright that these are "item ids stamped on the WE-CARRIER merge". #2899's
resolve-on-land totality report asserts every id in that set lands in exactly one bucket, so narrowing the set
would silently drop resolves. `stackProven` (`:1254-1260`) reads it too. One set cannot mean both "the carrier
merged" and "the couple is whole".

**Decision: keep `landedThisPass` exactly as it is, and add separate negative counter-evidence.**

- Add a `coupleIncomplete: Set` (same `asItemId` keying) to `planLabelDrain`'s proof bag. `provenLanded`
  becomes `(landedThisPass.has(id) || provenOnMain.has(id)) && !coupleIncomplete.has(id)`.
- This preserves the module's stated shape — the edge still clears only on **positive proof**, never on
  absence — and only *subtracts* clearances, so it can add a defer but never remove one. That is the safe
  direction, and it means #999's chain-liveness fix is untouched wherever no counter-evidence exists.
- Compute the set in `planDrainPass` (`:1139-1155`), which already holds both inputs it needs — the joined
  `vs` verdicts and the `openHeadRefs` set it builds at `:1151-1152` — immediately after the
  `joinImplToCouples` call at `:1153` and before the `planLabelDrain` call at `:1154`.
- **Single-source the predicate.** The "is this couple whole?" test is the same one already inlined in
  `joinImplToCouples` at `:736-748`. Extract it to one exported helper used by both, so the carrier-side
  `impl-open` defer and the blocker-side edge agree on what "landed" means — this is the card's original
  "coordinate so `provenLanded` and the gate agree rather than each inventing its own proof", satisfied
  in-file now that the couple gate it wanted to coordinate with has been built.

### Named residual — the `provenOnMain` arm is NOT covered, and cannot be

A carrier that landed in a **prior session** leaves nothing behind to test its couple against: the lane
manifest `we:.lane-manifest.json` is deliberately dropped before land (the #2183 first-lander leak fix,
`we:scripts/merge-ai-prs.mjs:616-620`), it is not tracked on `main`, and it is read through the GitHub contents
API against a PR's **head ref** (`:1019`) — not against `main`. So once the carrier merges, its `manifestRefs`
are unrecoverable and a still-open impl PR cannot be associated back to the landed item at all. This item
covers the `landedThisPass` arm only. Closing the `provenOnMain` arm needs a durable post-land record of the
couple's refs, which is a separate, larger item — do not silently widen this one to attempt it.

## Done when

- [ ] `planLabelDrain` accepts `coupleIncomplete` in its proof bag and `provenLanded` returns `false` for any
      id in it, positive proof notwithstanding.
- [ ] The reproduction above, re-run with `coupleIncomplete: new Set([100])`, yields `deferred [30]` with
      `waitOn` naming item `100` — not `ready [30]`.
- [ ] The reproduction above **unchanged** (no `coupleIncomplete`) still yields `ready [30]`, proving the
      default is a pure no-op and #999's liveness fix is not regressed.
- [ ] A fully-landed blocker (in `landedThisPass`, absent from `coupleIncomplete`) still frees its dependent
      in the same pass — the #999 F1 chain-liveness case at
      `we:scripts/__tests__/merge-ai-prs.test.mjs:500` still passes unmodified.
- [ ] `planDrainPass` populates `coupleIncomplete` from the pass's joined verdicts + `openHeadRefs`: an item
      whose carrier names a `manifestRefs` entry other than its own head that is open-and-not-landing appears
      in the set.
- [ ] The couple-completeness test is ONE exported helper, called by both `joinImplToCouples` (`:736-748`) and
      the `planDrainPass` wiring — a test fails if either re-inlines its own copy.
- [ ] An end-to-end `planDrainPass` case: carrier item 100 merged into `landedThisPass` while its impl ref is
      still in `openHeadRefs` ⇒ a dependent on 100 lands in `deferred`, not `ready`.
- [ ] `provenOnMain`-only proof is documented in the docblock as explicitly NOT covered, citing the
      manifest-dropped-before-land reason, so a later reader does not mistake the gap for an oversight.
- [ ] `npm run check:standards` at 0 errors and `npm run test:unit` green.

## Interfaces

Current, at `origin/main` `087d7318`:

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
```

Proposed additions (no signature is broken — both new params default to empty/absent):

```js
// the extracted single-source predicate
export function coupleImplOpen(carrier, { openHeadRefs, readyImplRefs })  // → boolean
// planLabelDrain proof bag gains:  coupleIncomplete = new Set()
// planDrainPass proof bag gains:   coupleIncomplete = new Set()  (also derived internally and unioned)
```

## Tasks

1. Extract the `:736-748` inlined couple-completeness loop into an exported `coupleImplOpen` helper; re-point
   `joinImplToCouples` at it. Pure refactor — the existing `impl-open` test at
   `we:scripts/__tests__/merge-ai-prs.test.mjs:3531` must pass untouched.
2. Add `coupleIncomplete` to `planLabelDrain`'s proof bag and subtract it inside `provenLanded` (`:1269`).
   Update the `:1261-1268` comment block to state the counter-evidence rule and the safe direction.
3. Wire `planDrainPass` (`:1153-1154`): derive `coupleIncomplete` from the joined verdicts + `openHeadRefs` via
   `coupleImplOpen`, union any caller-supplied set, pass it through.
4. Document the `provenOnMain` residual in the `planLabelDrain` docblock (`:1195-1222`) with the
   manifest-dropped-before-land citation.
5. Tests beside the existing suites — the `#999` liveness suite at
   `we:scripts/__tests__/merge-ai-prs.test.mjs:500` (no-regression) and the couple-join suite at `:637`
   (new behaviour), plus the `planDrainPass` end-to-end case.

## Size

**3.** One pure predicate extraction, one subtraction inside an existing one-line function, one wiring line,
and four to five tests. Basis: the change is small and additive with no signature break, but it sits in the
densest invariant cluster in the repo (`planLabelDrain` carries the #2188 / #2393 / #999 / #xc7p3q9 rules at
once), so the no-regression cases cost more than the fix. Not a 2, because the predicate extraction touches a
second call site with its own live test; not a 5, because the blast radius is bounded to one file and the
`provenOnMain` arm is explicitly out of scope.

## Delivery shape

**One piece.** The predicate extraction, the subtraction and the wiring are meaningless apart — extracting
`coupleImplOpen` alone changes no behaviour, and adding `coupleIncomplete` without populating it in
`planDrainPass` ships a parameter nothing sets. Slicing would produce a half-state where the defect is still
live but the code reads as if it were fixed, which is worse than the defect. The one genuine seam — the
`provenOnMain` arm — is already carved out above as a separate future item, not a slice of this one.
