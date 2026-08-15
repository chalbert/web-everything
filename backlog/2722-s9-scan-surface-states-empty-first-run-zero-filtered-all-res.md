---
bornAs: x8itmee
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["2721"]
scope: ["plateau-app:src/feature-tracker/states.ts", "plateau-app:src/feature-tracker/scan.ts", "plateau-app:src/feature-tracker/scan.css"]
dateOpened: "2026-07-27"
tags: []
---

# S9 · Scan-surface states — empty / first-run / zero-filtered / all-resolved / skeleton / error

Non-happy scan surfaces (scan-only): empty-fleet (FT-S8), first-run no-velocity (FT-S9), filtered-to-zero
(FT-S10, clear-filter), all-resolved (FT-S13, header dashes), initial skeleton (FT-L1), scan-load-failure
(FT-E1: retry + honest absence). Each an explicit deliverable with its own baseline.

**Prepared 2026-08-15** (this pass). Blocked by #2721 (S1b) as declared — correctly, since the module this
card touches doesn't exist yet: `plateau-app:src/feature-tracker/` today holds only
`plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (confirmed via `git log --oneline -- src/feature-tracker`
in the plateau-app checkout, 2026-08-15). The design below is grounded in two things that DO exist today: the
ratified v3 design reference cited by #2705 (the `claude.ai/code/artifact/d6816fec-…` mock — fetched and read
in full this pass), and this repo's own precedent for the two patterns this card needs that the mock does not
draw (skeleton loading, error+retry) — `plateau-app:src/backlog-view/lane-board.ts` /
`plateau-app:src/backlog-view/lane-board.css` and `plateau-app:src/backlog-view/backlog-view.ts`. Where an
exact production signature cannot yet be cited (because the read-model, scan render, mock-data, and mount
modules have no code yet), that is called out explicitly rather than invented — see "Open verification" below.

## Deliverable
Non-happy scan surfaces (need only the scan): empty-fleet, first-run no-velocity (S9), filtered-to-zero
(clear-filter), all-resolved (S13, header dashes not stale numbers), initial skeleton (L1), scan-load-failure
(E1: retry + honest absence). Each an explicit deliverable with its own baseline.

## FT cases → rendered=yes
FT-S8, FT-S9, FT-S10, FT-S13; FT-E1; FT-L1 (the rest of E/L stay spec). Mapped 1:1 to the six named surfaces
above, in the same order: FT-S8=empty-fleet, FT-S9=first-run, FT-S10=filtered-zero, FT-S13=all-resolved,
FT-L1=skeleton, FT-E1=error. (Do not confuse these `FT-<letter><n>` taxonomy codes with the epic's own
build-slice names — this story is slice "S9" of the epic, but only ONE of its six target states is taxonomy
case FT-S9.)

## A real scope gap found in preparation (checklist item 1 — consumer risk)
The captured card scoped only the classifier module and the scan renderer. **The skeleton/empty/error visual
treatment needs new CSS, and the scan stylesheet was missing from scope.** Confirmed by reading the ratified
v3 reference in full: its `.empty-state` block (icon/title/description/button) is the only one of the six
states it draws, and S1b's own deliverable text (its backlog card, "app shell + fleet header… persistent left
SCAN…") never mentions empty/skeleton/error states — so the scan stylesheet as S1b ships it will NOT contain
these rules; this story adds them. `plateau-app:src/feature-tracker/scan.css` is now in `scope:` above, as an
**owned re-edit**, the same convention the card already uses for the scan render module itself. S10 (#2724)
also re-edits the scan render module (virtualization) but not its stylesheet (windowing reuses existing row
markup, no new visual states) — no serialisation conflict.

**Size raised 3 → 5.** Basis: six distinct render states (two already drawn in the ratified mock, four net
new), across three files including one added by this prep, each needing its own markup + CSS + ARIA + honest-
number handling — comparable in surface to S1b's own size-5 (five files, one primary render surface + header).

## Decided design

One pure classifier decides WHICH of seven screen states applies; the scan renderer owns painting each,
reusing the exact `.empty-state` DOM/CSS shape the ratified mock already draws for FT-S8/FT-S10, and extending
it — not inventing a second visual language — for the three states the mock doesn't draw.

**The seven states, one discriminant, explicit precedence (first match wins):**

1. `loading` — before the fleet's first successful load resolves. Renders the skeleton (FT-L1); no header
   metrics; no bottleneck banner.
2. `error` — the load rejected. Renders an error empty-state with a Retry action (FT-E1); header shows dashes,
   not the last-known (stale) numbers.
3. `empty` — loaded, `0` features (FT-S8). *Already drawn in the ratified mock* (the scan render function's
   `BASE.length===0` branch: icon `◍`, "Fleet is empty", "No tracked features right now. When work is picked
   up it appears here in the fleet scan."). This story's job for this ONE state is conformance to that
   existing design, not new design.
4. `all-resolved` — loaded, `>0` features, every feature `land === 'shipped'` (FT-S13). NEW: header dashes
   (extends the same header-metric → `'—'` pattern the mock already uses for `empty`, to this additional
   condition). The scan list itself still renders real rows (nothing to hide — the fleet did the work); only
   the two fleet-wide *forward-looking* metrics (throughput, next-landing) go honest-dash, because a shipped
   fleet has no "next" to project.
5. `filtered-zero` — loaded, `>0` features, active filter matches `0` (FT-S10). *Already drawn in the ratified
   mock* (the scan render function's `vis.length===0` branch: icon `⁝`, "No features match "{FILTER}"", a
   `Clear filter → All` button that sets `FILTER='all'` and re-renders). Same "conform, don't redesign" note
   as `empty`.
6. `first-run` — loaded, `>0` features, but the FLEET-WIDE resolved-slice count is `0` (FT-S9). NEW. This is
   the fleet-aggregate analogue of the K6 "no-basis" per-row chip (`minSampleSlices` ruling, DEC #2719,
   ratified: `0` resolved slices = no-basis; `1–2` = insufficient; `≥3` = enough) — reused at fleet scope for
   consistency with the one ratified threshold semantic, not a second invented cutoff. Header dashes (same
   extension as `all-resolved`); rows render normally (individual K6/insufficient chips per row already carry
   the honest per-feature story — S1b's job).
7. `normal` — none of the above; today's ordinary render.

```ts
// states.ts
export type LoadStatus = 'loading' | 'ready' | 'error';

export type ScanScreenState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'all-resolved' }
  | { kind: 'filtered-zero' }
  | { kind: 'first-run' }
  | { kind: 'normal' };

export interface ScanScreenStateInput {
  readonly loadStatus: LoadStatus;
  readonly featureCount: number;        // BASE.length once loaded; meaningless while loadStatus !== 'ready'
  readonly visibleCount: number;        // count after the active filter
  readonly filterActive: boolean;       // FILTER !== 'all'
  readonly allShipped: boolean;         // featureCount > 0 && every feature land === 'shipped'
  readonly fleetResolvedSlices: number; // sum of resolved slices across the whole fleet (throughput sample size)
}

/** Pure; no DOM. Precedence is the ORDER below — first match wins, so a fleet that is e.g. both `allShipped`
 *  and would (trivially) read as `fleetResolvedSlices === 0` still resolves to `all-resolved`, never `first-run`. */
export function computeScanScreenState(input: ScanScreenStateInput): ScanScreenState;
```

The scan renderer dispatches on the discriminant with one render function per branch, each returning/appending
the `.empty-state`-shaped block (or the skeleton block) into the same scan-list mount point the mock already
uses, and each also driving the honest-header extension where the state calls for it (see Interfaces).

### Visual precedent for the two net-new patterns (grounded, not invented)

- **Skeleton (FT-L1).** Mirror `plateau-app:src/backlog-view/lane-board.ts`'s `mountLaneBoardSkeleton`
  (lines 1376–1409) and `plateau-app:src/backlog-view/lane-board.css`'s skeleton/pulse rules (lines 339–353,
  keyframe at line 540): `aria-busy="true"` on the root, `role="status" aria-live="polite"` loading text,
  ghost cells that pulse (`opacity 1↔.4`, `1.6s ease-in-out infinite`) with a `prefers-reduced-motion: reduce`
  override that disables the animation entirely. Translate the SHAPE (not the exact selectors) to the scan
  list's own grid: each ghost row reuses the existing row's `grid-template-columns` so the skeleton reads as a
  preview of the real rows, not a different layout — pulsing bars stand in for the kind glyph, label,
  where-the-time-goes bar, velocity, %, and forecast chip. `~9+` rows per the card's own acceptance line
  (enough to fill the visible scroll area on a typical viewport without implying a real, counted total).
- **Error + retry (FT-E1).** No exact retry-button precedent exists yet in this repo (the closest analogue,
  `plateau-app:src/backlog-view/backlog-view.ts` lines 1136–1147, shows an honest error message but has NO
  retry action). Reuse the FT mock's own `.empty-state` shape (icon/title/description) plus its clear-filter
  button pattern (already exactly this shape for the `filtered-zero` state's "Clear filter → All") for the
  retry CTA — add the button to the SAME `.empty-state` button CSS rule (or a sibling selector sharing its
  declaration block) rather than a new visual language, with the label "Retry" and an injected callback (see
  Interfaces) instead of the filter reset.

## Interfaces & protocol

**The classifier module** exports `ScanScreenState`, `ScanScreenStateInput`, `computeScanScreenState()` as
above. Pure, no DOM, no import of the scan renderer — unit-testable standalone (mirrors S1a's "pure logic,
unit-tested" discipline for the read-model module).

**The scan renderer** — extends its existing render entry point (per the ratified mock's shape: reads `BASE`/
`FILTER`, writes into the scan-list mount point) to call `computeScanScreenState()` first and branch:

```ts
// scan.ts (shape; exact call site depends on what S1b actually lands)
function renderScan(): void {
  const state = computeScanScreenState({ loadStatus, featureCount: BASE.length, visibleCount: vis.length,
    filterActive: FILTER !== 'all', allShipped: BASE.length > 0 && BASE.every(f => f.land === 'shipped'),
    fleetResolvedSlices });
  applyHeaderHonesty(state); // dashes for {'loading','error','empty','all-resolved','first-run'}, live otherwise
  switch (state.kind) {
    case 'loading':      renderSkeleton(list); return;             // NEW — no banner call, see below
    case 'error':         renderErrorState(list, onRetry); return;  // NEW
    case 'empty':          renderEmptyFleetState(list); return;      // conforms to the ratified mock
    case 'all-resolved':  renderAllResolvedState(list, BASE); return; // NEW (rows render; header only)
    case 'filtered-zero': renderFilteredZeroState(list, () => { FILTER = 'all'; renderScan(); }); return; // conforms
    case 'first-run':     renderFirstRunState(list, BASE); return;    // NEW (rows render; header only)
    case 'normal':        /* today's row loop */
  }
}
```

- The retry callback is **injected**, not an import of the mock-data module's load function — that module's
  real shape doesn't exist yet (S1b, unblocked-but-unbuilt), so the scan renderer stays decoupled from it.
  Whatever the mount module ends up calling to (re)load the fleet, it passes that function in; the scan
  renderer only knows it can be invoked. This is the one interface choice in this card NOT grounded in an
  already-built module, by necessity — flagged, not hidden.
- **Banner coordination (FT-L1's "no banner"): no cross-file change needed, by construction, not by luck.**
  The mock's own banner-update function calls its bottleneck computation over `BASE`; while `loadStatus ===
  'loading'`, `BASE` holds no data yet, so that computation returns nothing and the banner already hides
  itself (verified in the fetched mock: `if(!bn){bar.style.display="none"}`). The one thing THIS story owns to
  keep that true: the skeleton render function must not call (or trigger a caller to call) the banner-update
  function — stated as its own Done-when line below so it's independently testable, not just assumed.
- **Header honesty extension.** The mock's existing dash logic (header metric → `'—'` when the fleet is empty)
  lives inside the scan render function in the mock's single-file architecture. Which *production* module owns
  the header metrics once S1b lands (the scan renderer itself, or the mount module) is not yet knowable — S1b's
  card describes the header as part of the app shell, which suggests the mount module. **Task 1 below is to
  resolve this before writing the dash-extension code**, and if the answer is the mount module, add it to this
  card's scope as another owned re-edit rather than reaching outside scope silently (the exact defect this
  checklist exists to catch, per #3090).

## Tasks (ordered)

1. Once #2721 lands, read the actual read-model, scan-render, mock-data, and mount modules — confirm (a) the
   load-status lifecycle and its owning module/shape, (b) which module renders the fleet-header metrics. If
   header rendering is not in the scan render module, add that module to this card's `scope:` before touching it.
2. Add the classifier module: `ScanScreenState`, `ScanScreenStateInput`, `computeScanScreenState()` per
   "Decided design" above, with the seven-way precedence. Unit tests: one per state, plus boundary cases —
   `fleetResolvedSlices` 0 vs 1 vs 3 (first-run vs normal, matching the ratified `minSampleSlices` cutoff),
   `allShipped` true taking priority over an incidentally-zero `fleetResolvedSlices`, `filterActive &&
   visibleCount===0` vs `===1`.
3. Extend the scan renderer's entry point to call the classifier and dispatch per the switch above. `empty`
   and `filtered-zero` branches should be near-verbatim ports of the mock's existing code (conformance, not
   new design) — the diff review should be able to diff them directly against the fetched mock.
4. Add the four new render functions — new markup, following "Visual precedent" above.
5. Add the corresponding rules to the scan stylesheet: ghost-row skeleton (mirroring the lane-board precedent's
   pulse + reduced-motion pattern), the retry button (sharing the empty-state button rule), any new
   header-dash class if needed.
6. Wire the retry callback as an injected function from whatever the mount module exposes for (re)triggering
   the fleet load (confirm exact name/shape per Task 1).
7. `data-uc` anchors on every new state's root element now, even though S0b's mount-conformance harness
   (#2720) hasn't landed yet — so S0b doesn't need a second pass over this file once it does.
8. Manual check in the dev server, both themes, all seven states (`loading`/`error`/`empty`/`all-resolved`/
   `filtered-zero`/`first-run`/`normal`) — screenshot for the record; formal baseline-diff gating awaits S0c
   (#2735), not blocking this PR's own review.

## Done when (testable)

- `computeScanScreenState()` returns the correct discriminant for each of the seven inputs above, including
  the three named boundary/precedence cases in Task 2 — one vitest case each.
- Fleet header shows `—` (not the prior/stale numbers) for throughput + next-landing on `loading`, `error`,
  `empty`, `all-resolved`, and `first-run`; shows live numbers on `filtered-zero` and `normal`.
- The skeleton renders `≥9` ghost rows, sets `aria-busy="true"`, and — independently of what the mount module
  does — the skeleton render function itself never calls the banner-update function.
- `filtered-zero`'s "Clear filter → All" button resets `FILTER` to `'all'` and re-renders the full list
  (already true in the mock; this asserts the built code matches).
- The error state renders a "Retry" control that invokes the injected callback exactly once per click and
  does not fabricate/redisplay stale header numbers while showing.
- `all-resolved` and `first-run` still render the fleet's real rows (only the header goes honest-dash, not the
  list).
- Every state carries a `data-uc` anchor and passes `check:standards`'s render-conformance rule.
- (Deferred, not blocking this PR) matches the frozen visual baseline in both themes once S0c (#2735) lands —
  recorded here so the obligation isn't lost, not treated as this PR's own gate.

## Delivery shape

**One PR, cannot land incrementally.** All seven states share one classifier function and one render-dispatch
switch in the same two-to-three files; splitting by state would mean repeated back-to-back edits to the same
few lines (the exact hazard the card already names for its relationship with S10). Lands after #2721 merges;
internally ordered by the task list above, not by separate PRs.

## Open verification (must resolve at build time, not guessed here)

- **Task 1's module-ownership question** (header metrics: the scan renderer, or the mount module) — genuinely
  unknown until S1b lands; the exact function/variable shapes this card assumes are grounded in the ratified
  MOCK, not in built production code, since none exists yet.
- **The fleet-wide resolved-slices value's exact source** — is it a value the read-model module (S1a) already
  exposes, or does this story compute it locally by summing a field S1a's feature shape carries? Not yet
  knowable; Task 1 covers it.
- **The mock-data module's load/retry entry point shape** — addressed by design (the injected-callback choice
  above decouples the scan renderer from it), but the exact call site in the mount module still needs
  confirming at Task 1/6.

## Preparation review status
Items 1–8 of the story-preparation-checklist applied in this pass (scope+consumers, size with basis, testable
Done-when, decided design with a named precedence fork, interfaces grounded in the fetched ratified mock plus
this repo's own skeleton/error precedents, ordered tasks, delivery shape). **Item 9 (independent review of
this preparation, by a separately-sessioned reviewer) has NOT been run** — this pass was self-prepared; per
the checklist, that means "prepared," not yet "build-ready" in the strictest sense. Recommend an independent
pass before dispatching a build, especially on the header-honesty-extension states and the retry-callback
interface, the two places this prep made a judgment call beyond what the captured card stated.
