---
bornAs: xao3fqx
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2721", "2718"]
scope: ["plateau-app:src/feature-tracker/banner.ts", "plateau-app:src/feature-tracker/banner.css", "plateau-app:src/feature-tracker/mount.ts"]
relatedTo: ["2705", "2718", "2719", "2721", "2729", "xyjz84p"]
dateOpened: "2026-07-27"
tags: []
---

# S8 · Fleet bottleneck banner (derived, single-source) + multi + all-blocked + cycle

Header banner (registers into S1b's slot) reading bottleneckId/computeBottlenecks from S1a (no render-order dependency). Names the feature(s) gating the most fleet points with a jump. Explicit named surfaces + own baselines for M36 (multiple bottlenecks), S14 (fully blocked), and the cyclewarn state.

## Deliverable
A header banner (registers into S1b's slot) reading `bottleneckId`/`computeBottlenecks` from S1a — NO render-order dependency (R5). Names the feature(s) that gate the most fleet points, with an "open blocker in dependencies" jump; hidden when nothing gates. Explicit named surfaces + own baselines for M36 (multiple independent bottlenecks — `computeBottlenecks`, disjoint chains, "both must move"), S14 (fleet fully blocked), and the cycle banner state (cyclewarn, "no build order, no forecast").

## FT cases → rendered=yes
S7, S14 (S17 spec).

## Scope
- `plateau-app:src/feature-tracker/banner.ts`
- `plateau-app:src/feature-tracker/banner.css`

## Acceptance
Banner, scan BLOCKER flag, and DAG lead cite the SAME feature+pts (single-source test naming which feature each surface must show, R5); hides when nothing gates; the jump selects the blocker + opens Dependencies; M36 surfaces both chains; the cycle state renders cyclewarn; S17 stays spec.

## Grounding — what already exists (verified against live code/repo state, 2026-08-15)

- **`plateau-app:src/feature-tracker/` today holds exactly one file: `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`**
  (233 lines; a directory listing, not a citation). None of the read-model (#2718/S1a), the mount file
  (#2721/S1b), the scan/data files, or the DAG file (#2729) exist yet — both of this story's `blockedBy`
  items (#2718, #2721) are `status: open`, unbuilt. This story's design below is necessarily a **forward
  interface spec** for a seam that doesn't exist in code yet, not a citation of live code — flagged per the
  checklist's grounding rule. Everything that CAN be grounded in something real is grounded below instead of
  invented.
- **The existing webcases file confirms the card's own FT-code claims by construction.** `SPEC_BEFORE_RENDER`
  (the frozen 44-case deferred-render allow-list) lists exactly one `S`-family case, `'FT-S17'`, and zero
  `M`-family cases at position 36 (`plateau-app:src/feature-tracker/feature-tracking.webcases.ts:64-81` —
  corrected during independent review; the first draft cited 60-77, which starts inside the preceding doc
  comment and cuts off before the R-family entries).
  Since `rendered` is `spec` iff on that list and `yes` otherwise (enforced by `validateFtRegister()`, same
  file, called at module load), **FT-S7, FT-S14, and FT-M36 are ALL `rendered: yes` in the frozen taxonomy
  today** — the RATIFIED v3 target already commits to drawing them, this card is not asking for something
  outside the ratified scope. FT-S17 staying `spec` is also confirmed, not just asserted.
- **A concrete, ratified precedent for the single-bottleneck (S7) surface exists — the epic's own linked
  "Live integrated page"** (`#2705`'s artifact URL, fetched 2026-08-15:
  `https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046`). This is the actual RATIFIED v3
  prototype, not a description of one. It contains, verbatim:
  - **Markup** (inside `<header class="fleethead">`, immediately after `.fh-top`):
    ```html
    <div class="bottleneck" id="bottleneck" role="region" aria-label="Fleet bottleneck">
      <span class="flag">FLEET BOTTLENECK</span>
      <span id="bn-text"></span>
      <button class="go" id="gotoblocker">Open blocker in dependencies →</button>
    </div>
    ```
  - **CSS** (`.bottleneck`, `.bottleneck .flag`, `.bottleneck .flag::before`, `.bottleneck b`, `.bottleneck
    .go`) — a left-to-right flex row, a red-square+text "FLEET BOTTLENECK" flag (the square carries a text
    twin already, satisfying S11's colour↔text-twin invariant with no extra work), the message, and a
    right-aligned link-styled jump button. All colours ride existing theme custom properties
    (`var(--stall-bg)`, `var(--blk)`, `var(--border)`, `var(--primary)`, `var(--text)`) already defined for
    both `:root` and `html[data-theme="dark"]` — which is almost certainly WHY #2734 (S11)'s own `scope:`
    does **not** list the banner stylesheet: reusing the existing tokens gets theme parity for free, nothing
    extra to harden.
  - **Hide-when-empty logic:** `if(!bn){bar.style.display="none";...return;} bar.style.display="";` — matches
    this card's "hidden when nothing gates" acceptance line exactly.
  - **Jump behaviour:** `$("#gotoblocker").addEventListener("click",()=>{if(BOTTLENECK_ID){TAB="dag";
    selectFeature(BOTTLENECK_ID,true);}});` — switches to the Dependencies tab and selects the blocking
    feature. Confirms "the jump selects the blocker + opens Dependencies" is not new behaviour to invent, it
    is the one thing already proven to work.
  - **THE EXACT RENDER-ORDER BUG #2718/S1a is scoped to fix**, found and cited by line number in the fetched
    artifact: `let BOTTLENECK_ID=null;` is a module-level global. It is written ONLY as a side effect inside
    `updateBanner()` (`BOTTLENECK_ID=bn.id;`), which some other code (the per-feature Dependencies-tab lead,
    `renderDag()`) reads via `f.id===BOTTLENECK_ID` to decide whether to say "This is the fleet blocker" vs
    "This feature gates others" — and the render sequence calls `renderScan();renderDetail();updateBanner();`
    in that ORDER, so `renderDetail()`'s read of `BOTTLENECK_ID` sees the **previous** render pass's value,
    not the current one. Separately, `renderScan()` ALSO independently calls `computeBottleneck()` itself
    (`const bnId=(computeBottleneck()||{}).id;`) to decide the scan row's `.fbk` "BLOCKER" chip — a SECOND,
    duplicate computation site, not reading `BOTTLENECK_ID` at all. Two bugs in one: a stale-read (dag-lead)
    and an un-single-sourced duplicate (scan). Both are exactly what "R5 / no render-order dependency /
    single-source" in this card's own title is written to kill.
  - **What the fetched artifact does NOT contain:** any code path for M36 (multiple bottlenecks), S14 (fully
    blocked), or the cyclewarn state — no `findCycle`, no multi-hub logic, no "fully blocked" framing. This is
    consistent with, not a contradiction of, the taxonomy grounding above: the ratified v3 TARGET commits to
    drawing these (they're `rendered:yes`), but this particular PROTOTYPE artifact is an earlier baseline that
    predates them. So S7's pixel baseline can be ported near-verbatim from the artifact; M36/S14/cyclewarn
    need genuinely fresh baselines captured when this slice lands — which is exactly what the card's own
    phrase "own baselines" already says, now with a verified reason why.
- **A real repo precedent for "a pure `render*(): string` function a parent template interpolates inline,
  with delegated `data-*`-keyed click handling" already exists** — not invented for this card:
  `renderInfraBanner(lanes)` (`plateau-app:src/backlog-view/lane-board.ts:305`) returns `''` when nothing to
  show and a `<div class="lb-infra-banners">…</div>` string otherwise; its caller interpolates it directly
  inside the board-mount function's own template (`plateau-app:src/backlog-view/lane-board.ts:1459`,
  `${renderInfraBanner(board)}`). Its buttons carry `data-cause`/`data-id`; ONE delegated click listener
  elsewhere in the same file resolves the click via `t.closest<HTMLElement>('.lb-infra-resume')`
  (`plateau-app:src/backlog-view/lane-board.ts:1651`) and reads the dataset off the matched element — never a
  bespoke per-button listener. This is the concrete precedent the mount-seam design below reuses.
- **Scope correction: the mount file had to be added.** #2723's original `scope:` listed only the banner
  module and its stylesheet. But "registers into S1b's slot" cannot be a static ES import pointing at a file
  that doesn't exist yet, and the mount file (S1b, #2721) necessarily ships and lands BEFORE the banner module
  exists (`blockedBy` orders S1b before S8) — an import of a nonexistent file does not build. Whatever
  function actually re-renders the fleet header on each data change (the render loop the mount file owns,
  mirroring the v3 artifact's `renderScan();renderDetail();updateBanner();` sequence) has to gain ONE
  additive call to the banner's render function when this slice lands. This is a small, sequential,
  non-concurrent edit — safe precisely because `blockedBy` already orders S1b's landing before S8's, per the
  epic's own stated rule ("Ordering is enforced by each slice's `blockedBy`; scope-disjointness by each
  slice's `scope`" — #2705). Leaving the mount file off this card's scope would have reproduced the exact
  #3090 failure pattern the story-preparation checklist names ("size 1, 2 files declared, touched a caller
  that was not in scope").
- **The same "registers into X's slot, does NOT edit [the parent]" pattern appears in exactly one other place
  in this epic** — #2729 (S7 · one-hop dependency DAG, "registers into S2's dep-tab slot — does NOT edit the
  detail shell"), consuming #2725 (S2)'s slot. No card (#2721, #2723, #2725, or #2729) previously named a
  concrete mechanism for either pair. Filed as its own coordination item (`xyjz84p`, relatedTo above) rather
  than silently resolved only in this card, since #2725/#2729 haven't been prepared yet and could otherwise
  invent an incompatible mechanism independently.

## Decided design

**1. The single-source read-model API this story requires from S1a (proposed here, not yet built — #2718's
own card should adopt this shape when it is next prepared).** Extends the two names #2718/#2723 already both
cite (`computeBottleneck`/`computeBottlenecks`, `bottleneckId`) rather than inventing new ones:

```ts
/** One gating hub: the feature id, its human name, how many downstream features it directly gates, and the
 *  remaining points gated. Mirrors the v3 artifact's `{id,downstream,count,pts}` shape (BY_ID-joined here so
 *  a consumer never needs its own feature lookup). */
export interface BottleneckHub {
  readonly id: string;
  readonly name: string;
  readonly count: number;  // directly-gated downstream feature count
  readonly pts: number;    // remaining points gated
}

/** The ONE derived state every consumer (the banner, the scan row, the DAG lead) reads — never recomputed
 *  locally, never a side-effected global (kills the v3 BOTTLENECK_ID bug at its root: this is a pure
 *  function of `features`, callable fresh on every render, memoization optional and internal). */
export type BottleneckState =
  | { kind: 'none' }
  | { kind: 'single'; hub: BottleneckHub }
  | { kind: 'multi'; hubs: BottleneckHub[] }        // length >= 2, each independently >= bottleneckSharePct
  | { kind: 'allblocked'; hubs: BottleneckHub[] }    // totalGatedPts === totalRemainingPts (see below)
  | { kind: 'cycle'; cycleIds: string[] };           // findCycle() fired; no bottleneck framing applies

/** All disjoint hubs whose gated-pts share of TOTAL gated fleet pts is >= bottleneckSharePct (25%, #2719
 *  ruling). Length 0 (nothing gates), 1 (single dominant hub — S7), or >=2 (M36, disjoint chains). */
export function computeBottlenecks(features: readonly Feature[]): BottleneckHub[];

/** Total remaining points held up by ANY upstream gate, regardless of hub size — corrected during
 *  independent review (2026-08-15): the first draft defined `allblocked` as `computeBottlenecks(f)` summing
 *  to the fleet total, which is WRONG, because `computeBottlenecks` is pre-filtered to hubs clearing the 25%
 *  share threshold. A fleet where gating load is spread across many hubs each under 25% (e.g. five hubs at
 *  ~20% each, together covering 100% of remaining points) would return `[]` from `computeBottlenecks`, sum
 *  to 0, and silently fall through to `{kind:'none'}` — hiding the banner in exactly the scenario where the
 *  fleet has zero forward motion. This function is the UNFILTERED union instead: every feature with at least
 *  one unresolved upstream `blockedBy` entry, summed, with no share threshold applied. Used ONLY to detect
 *  `allblocked`; never to pick which hub to name (a hub below the share threshold is not a useful jump
 *  target, so `allblocked`'s `hubs[]` still comes from `computeBottlenecks`, just its DETECTION does not). */
export function totalGatedPts(features: readonly Feature[]): number;

/** Sum of `remaining()` across every feature in the fleet — the denominator `totalGatedPts` is compared
 *  against to detect `allblocked` (`totalGatedPts(f) > 0 && totalGatedPts(f) === totalRemainingPts(f)`). */
export function totalRemainingPts(features: readonly Feature[]): number;

/** `computeBottlenecks(features)[0]` when it is the ONLY qualifying hub, else `null` — kept as its own
 *  export because #2718's card already names it singular; equivalent to
 *  `computeBottlenecks(f).length === 1 ? computeBottlenecks(f)[0] : null`. */
export function computeBottleneck(features: readonly Feature[]): BottleneckHub | null;

/** Cycle detection over the EDGES graph; returns the cycle's feature ids in dependency order, or `null` if
 *  acyclic. Named directly in #2718's own deliverable text. */
export function findCycle(features: readonly Feature[]): string[] | null;

/** Composes the three primitives above into the ONE discriminated union every rendering consumer switches
 *  on. THIS export is new — #2718's card does not currently name it; flagged so whoever next prepares S1a
 *  adopts it rather than leaving each UI file to compose the primitives itself (which would just move the
 *  single-source violation one level down). Precedence when more than one condition is technically true:
 *  cycle > allblocked > multi > single > none — a cycle makes "which hub" meaningless (no build order
 *  exists at all); allblocked is checked before multi/single because "nothing is moving anywhere" is the
 *  more urgent fact for a fleet lead than "which hub(s) to unblock". */
export function computeBottleneckState(features: readonly Feature[]): BottleneckState;

/** Flagged during independent review (2026-08-15): this is a DELIBERATE rename of the value #2718/#2723's
 *  ratified card text calls `bottleneckId` (singular, no `Of`/no state argument) — a plain value made no
 *  sense once `bottleneckId` had to become a function of the newly-introduced `BottleneckState` (a value
 *  can't be "the id" across five different discriminated-union shapes without something to read it from).
 *  Named explicitly, unlike `computeBottleneckState` above (already flagged as wholly new), so whoever next
 *  prepares #2718 treats this as a rename to reconcile, not an independent invention to ignore.
 *  `bottleneckIdOf` — the single most useful id to highlight/jump to: the `single` hub's id, the FIRST
 *  (top-ranked by pts) hub's id when `multi`/`allblocked`, or `null` for `none`/`cycle`. A convenience
 *  derived value, not a second source of truth — always
 *  `(state.kind==='single'?state.hub.id : state.kind==='multi'||state.kind==='allblocked'?state.hubs[0]?.id
 *  : null)`. */
export function bottleneckIdOf(state: BottleneckState): string | null;
```

**Open fork, named and ruled here (checklist item 4): does S14 (fully-blocked) compose with single/multi, or
override it?** Ruled: **override — its own `allblocked` branch**, carrying the same `hubs[]` so the banner can
still name which feature(s) to act on. Rationale: "the whole fleet has zero forward motion" is a materially
more urgent fact than "which hub(s) gate the rest" and deserves distinct copy/urgency, not a suffix on the
single/multi sentence; `allblocked` is `totalGatedPts(f) === totalRemainingPts(f)` (every feature gated, none
free — the UNFILTERED check, see `totalGatedPts`'s own doc comment above) — checked before the
`multi`-vs-`single` branch precisely because it can co-occur with either.

**2. The mount-seam (producer/consumer wiring) — see Grounding's scope-correction note and the coordination
item (`xyjz84p`) for why this needed deciding at all.** The mount file (S1b) pre-builds the empty container
(`<div class="bottleneck" id="bottleneck" role="region" aria-label="Fleet bottleneck"></div>`, no import of
the banner module, since it cannot exist yet when S1b lands). When THIS slice lands, it:
- adds the banner module, exporting `renderBottleneckBanner(state: BottleneckState): string` — a pure
  function mirroring `renderInfraBanner` exactly (`plateau-app:src/backlog-view/lane-board.ts:305`): returns
  `''` for `{kind:'none'}`, real markup for the other four `kind`s.
- adds ONE call in the mount file's existing render pass: `document.getElementById('bottleneck').outerHTML =
  renderBottleneckBanner(computeBottleneckState(features)) || '<div class="bottleneck" id="bottleneck"
  hidden></div>'` (or the equivalent template-string interpolation if the render pass is template-based
  rather than imperative — S1b's own build decides that shape; this card only requires that wherever it
  lands, the call site is exactly one function call, not a restructuring of the mount file).
- the jump button carries `data-jump-to="<hubId>"` `data-jump-tab="dag"` (mirroring
  `plateau-app:src/backlog-view/lane-board.ts:295`'s `data-cause`/`data-id` pattern) instead of wiring its own
  click listener; the mount file's existing delegated listener gains ONE more `.closest('[data-jump-to]')`
  branch that switches the active tab and calls the shared feature-selection function (owned by S1b/S10 per
  the DEC #2719 keyboard-model ruling — `aria-activedescendant`), the same primitive scan-row / DAG-node /
  ranked-table clicks already use. The banner module never implements its own navigation.
- for the `cycle` state specifically, the jump button (if shown at all) points at the Dependencies tab's
  cycle card (M37, owned by #2729's DAG module) rather than a single feature id — `data-jump-to` is omitted
  (`cycleIds[0]` is not a meaningful single target) and the button reads "View cycle in dependencies →".

**3. Banner copy per state (first-pass; the visual-diff gate freezes the actual pixels as this slice's own
baseline per the epic's acceptance policy, so exact wording is not load-bearing here):**
- `single` (S7) — reuse the v3 artifact's copy verbatim: `<b>{hub.name}</b> gates {hub.count} feature(s) and
  {hub.pts} pts across the fleet — it is the single largest unblock.`
- `multi` (M36) — name both/all hubs: `<b>{hubs[0].name}</b> and <b>{hubs[1].name}</b>{+N more} each gate part
  of the fleet — both must move.` Jump defaults to the top-ranked-by-pts hub (consistent `bottleneckIdOf`
  default), full ranked detail lives in the DAG tab's own ranked table (#2729).
- `allblocked` (S14) — `Fleet fully blocked — every feature is gated; nothing can land until {hub.name}{+N
  more} clears.`
- `cycle` (cyclewarn) — `Dependency cycle detected — no build order, no forecast until it's broken.` No date,
  no pts claim (a cycle has no honest "pts gated" number — asserting one would violate the §0 honest-forecast
  rule from DEC #2719).

## Interfaces / protocol

- **Consumes from the read-model (S1a):** `computeBottleneckState(features)`, `bottleneckIdOf(state)` — see
  Decided design §1 for full signatures. This is the ONLY read-model surface the banner module touches; it
  does not import `computeBottleneck`/`computeBottlenecks`/`findCycle` directly (those are
  `computeBottleneckState`'s own internals) — keeps single-source real rather than nominal.
- **Exports:** `renderBottleneckBanner(state: BottleneckState): string` — pure, no DOM access, no `Date.now`,
  matching the `renderInfraBanner` contract exactly (same file-shape precedent).
- **Consumers:** the mount file (S1b) — the render-loop call site (Decided design §2); eventually the scan
  row's `.fbk` chip and the DAG lead sentence (#2729) read the SAME `computeBottleneckState`/`bottleneckIdOf`
  pair, never their own locally-recomputed value — this is the single-source invariant this card's Acceptance
  line names ("Banner, scan BLOCKER flag, and DAG lead cite the SAME feature+pts").
- **Error shape / edge cases:** empty `features` array → `computeBottleneckState` returns `{kind:'none'}` →
  `renderBottleneckBanner` returns `''` → the pre-built container stays empty/hidden, matching S1b's own
  "empty fleet" honesty requirement (no fabricated banner over zero features).
- **No existing data to migrate** — this is new UI, no prior persisted banner state.

## Tasks

1. Confirm #2718 (S1a) has landed exporting `computeBottleneckState`/`bottleneckIdOf` (or the primitives) per
   Decided design §1; if it shipped a different shape, adapt the banner module to the SHIPPED shape and file
   a reconciling follow-up rather than silently reshaping S1a's exports from within this slice.
2. Confirm #2721 (S1b) has landed with the pre-built empty `#bottleneck` container in the mount file's header
   markup; if the container's exact selector differs from `#bottleneck`, adjust this task list's mount-seam
   call site to match what actually shipped (this card's proposed selector is a v3-artifact-grounded default,
   not a guarantee of what S1b's own build will choose).
3. Add the banner module: `renderBottleneckBanner(state)` covering all five `BottleneckState.kind` branches
   per Decided design §3, with `data-jump-to`/`data-jump-tab` on the `.go` button (omitted for `cycle`).
4. Add the banner stylesheet: port `.bottleneck`/`.flag`/`.go` rules verbatim from the v3 artifact (Grounding)
   for the `single` baseline; add `[data-state="multi"]`/`[data-state="allblocked"]`/`[data-state="cycle"]`
   modifier rules — a fresh visual pass, no existing baseline to match for these three.
5. Wire the mount file: one import, one call in the existing render pass (Decided design §2); extend the
   existing delegated click listener with one `[data-jump-to]` branch if S1b's own build didn't already
   generalise its cross-nav handler to cover it.
6. Add a single-source regression check: a fixture where `computeBottleneckState` names hub X, asserting the
   banner render function's output text contains X's name+pts — the half of the "same feature+pts" invariant
   this slice alone can prove; the cross-file half (scan/dag agreement) completes once #2729 lands, likely as
   part of S12's behavioral gate (#2730).
7. Run this slice's share of the shared gates (webcase conformance for FT-S7/S14/M36, golden-master visual
   diff in both themes, behavioral gate for the jump interaction) — all OWNED by S0a/S0c/S12 respectively, not
   duplicated here (see the testing-architecture note below).

## Done when

- [ ] The banner module exports `renderBottleneckBanner(state)`; returns `''` for `{kind:'none'}`, non-empty
      markup for `single`/`multi`/`allblocked`/`cycle`.
- [ ] The pre-built mount-file slot is populated by exactly one additive call (no restructuring of the mount
      file beyond the one import + one call site + the one delegated-listener branch).
- [ ] Banner is absent/empty when `computeBottleneckState` returns `{kind:'none'}` (no fleet, or fleet with
      nothing gated).
- [ ] FT-S7's visual baseline matches the v3 artifact's `.bottleneck` markup/CSS in both themes (golden-master,
      S0c/#2735).
- [ ] FT-S14 (`allblocked`) and FT-M36 (`multi`) render fresh baselines, both themes, captured at land.
- [ ] The cyclewarn state renders with no date and no fabricated pts figure (honest-forecast §0, DEC #2719).
- [ ] The jump control's `data-jump-to`/`data-jump-tab` drives the same cross-navigation scan-row/DAG-node
      clicks use (behavioral gate, S12/#2730) — switches to the Dependencies tab and selects the named hub.
- [ ] Single-source: banner text and the scan row's `.fbk` "BLOCKER" chip read the same
      `computeBottleneckState`/`bottleneckIdOf` pair (task 6's fixture); no locally-recomputed bottleneck
      logic anywhere in the banner module.
- [ ] FT-S17 remains on `SPEC_BEFORE_RENDER`, untouched — the banner module introduces no code path that
      renders it.
- [ ] `npm run check:standards` — 0 errors (repo-wide gate; this slice's own plateau-app test/lint gates apply
      at build time, not at this preparation step).

## Delivery shape

**One piece, single PR against `plateau-app`**, landing only after #2718 and #2721 are both on `main` (per
`blockedBy`). Cannot land incrementally ahead of its blockers — the pre-built slot it fills doesn't exist
until S1b ships, and the state it reads doesn't exist until S1a ships. Once both are landed, this slice is
purely additive to an already-working screen (S1b's "first usable increment" already renders correctly with
the banner slot silently empty), so it carries no regression risk to land behind `main` — no feature flag
needed.

## Testing architecture note (why this card has no test file in scope)

Per-slice unit tests are NOT this epic's pattern for UI-rendering slices. #2717/S0a owns the webcase
conformance suite, #2735/S0c owns the golden-master visual-diff harness plus the frozen baselines directory,
and #2730/S12 owns the behavioral/interaction gate — confirmed by reading all three cards' `scope:` fields.
This card's task 6 fixture is the one piece of verification only this slice can supply (the pure-function
single-source check); the rest rides the shared gates per #2705's stated acceptance policy ("webcase
conformance + visual-diff-to-baseline + behavioral gate + honest-number/forecast/a11y invariants").

## Independent review (2026-08-15)

A fresh-context reviewer checked every `path:line` citation against the live tree and the fetched v3 artifact
(the markup, the CSS, the `BOTTLENECK_ID` global, the render-order sequence, and the second independent
`computeBottleneck()` call in the scan renderer all confirmed accurate), and checked the coordination item's
"only two producer/consumer pairs" claim by grepping every FT sibling card. It found two real defects, both
corrected in place above: (1) the `allblocked` (S14) detection was defined as `computeBottlenecks(f)` summing
to the fleet total — WRONG, since `computeBottlenecks` is pre-filtered to hubs clearing the 25% share
threshold, so a fleet whose gating load is spread across many sub-threshold hubs would silently report
`{kind:'none'}` in exactly the scenario where the whole fleet has zero forward motion; fixed by adding an
unfiltered `totalGatedPts`/`totalRemainingPts` pair for `allblocked` detection specifically, while `hubs[]`
still comes from the filtered `computeBottlenecks` (a below-threshold hub isn't a useful jump target). (2) A
citation error — `plateau-app:src/feature-tracker/feature-tracking.webcases.ts:60-77` corrected to `:64-81`
(the underlying claim about which FT codes are `rendered:yes` was accurate; only the line range was off). It
also flagged, as a naming transparency issue rather than a defect, that `bottleneckIdOf` is a rename of
#2718's own `bottleneckId` and should be marked explicitly as such for whoever next prepares S1a — now called
out in the interface's own doc comment above. Separately, the reviewer found the coordination item
(`xyjz84p`) undercounted its own scope — two producer/consumer pairs named, five more registering slices
existed across two more producer files — and that item has been widened in place with the fuller count and a
revised recommendation. Confidence after fixes: **High** — every citation into
`plateau-app:src/backlog-view/lane-board.ts` and the fetched v3 artifact held up, the render-order-bug claim
is real and precisely located, and the two substantive defects found were both logic/citation errors
corrected before landing, not premise failures.
