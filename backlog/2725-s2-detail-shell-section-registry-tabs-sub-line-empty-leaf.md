---
bornAs: xwmr2vr
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2721"]
scope: ["plateau-app:src/feature-tracker/detail.ts", "plateau-app:src/feature-tracker/detail.css", "plateau-app:src/feature-tracker/detail.test.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S2 · Detail shell + section registry + tabs + sub-line + empty/leaf

Thin detail shell with a data-driven section registry (velocity/burnup/rollup self-register to identical ratified DOM), master-detail wiring, back button on narrow, two ARIA tabs with roving tabindex, honest sub-line, nothing-selected + leaf. Pre-builds the dependencies-tab content slot.

## Deliverable
A thin detail shell with a data-driven section registry (velocity/burnup/rollup self-register → identical ratified DOM). Master-detail wiring, back button on narrow, two tabs (Drill&velocity / Dependencies) with ARIA + roving tabindex, a sub-line (next-landing rendered honestly), nothing-selected + leaf. Pre-build the DEPENDENCIES-TAB CONTENT SLOT (S7).

## FT cases → rendered=yes
S2, S3, S4, S15, S16.

## Scope
- `plateau-app:src/feature-tracker/detail.ts`
- `plateau-app:src/feature-tracker/detail.css`

## Acceptance
Row select opens detail + moves focus to the title; nothing-selected + leaf match baseline; a gated feature's next-landing shows "gated — no date", never a date; a tab switch keeps visual + ARIA in lockstep; the registry accepts registrations; the dep-tab slot is present.

## Grounding — what already exists (verified against live code/repo state, 2026-08-15)

- **`plateau-app:src/feature-tracker/` holds exactly one file today**: `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`
  (233 lines, the S0r taxonomy register). `plateau-app:src/feature-tracker/mount.ts`,
  `plateau-app:src/feature-tracker/scan.ts`, `plateau-app:src/feature-tracker/data.ts`,
  `plateau-app:src/feature-tracker/read-model.ts`, `plateau-app:src/feature-tracker/forecast.ts`, and this
  card's own `plateau-app:src/feature-tracker/detail.ts` — every file any epic slice targets — do not exist yet
  (`find plateau-app/src/feature-tracker -type f`).
- **The direct blocker, #2721 (S1b), is unbuilt** (`status: open`) and is itself `blockedBy: ["2718","2719"]`;
  #2718 (S1a, read-model/forecast) is also `status: open`/unbuilt. #2719 (the thresholds/keyboard-model/forecast
  decision) is `status: resolved` (ratified 2026-07-27) — its RULING TEXT is real and citable even though its
  `codifiedIn` target (`plateau-app:src/feature-tracker/read-model.ts`) doesn't exist as code yet.
- **The epic's "ratified v3 baseline" is a real, stable, linked artifact**, not a hypothetical: #2705's own card
  body cites it as "Live integrated page:
  [https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046](https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046)".
  Fetched and read in full during this preparation: a single-file HTML/CSS/JS master-detail mockup that already
  implements everything this card must factor into modules. `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`'s
  own header comment calls it "the RATIFIED v3 baseline target", and #2720 (S0b)'s own acceptance text confirms
  it is the design authority: *"the expected map is authored in the design, not the build"* — S0b's whole job is
  to freeze this exact artifact into `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html` with
  `data-uc` anchors. **Citations below reference the artifact's own function and selector names** (stable
  identifiers) rather than line numbers in a not-yet-committed file.
- **DEC #2719 (resolved) ratified `keyboardModel = aria-activedescendant`** — but scoped explicitly to *"the S1b
  ↔ S10 contract"* (the fleet-SCAN listbox + its virtualization), not the detail pane's tabs. This card's own
  tabs correctly use **roving tabindex** per its acceptance text and the standard WAI-ARIA APG Tabs pattern — no
  conflict with #2719's ruling. #2719 also ratified that `plateau-app:src/feature-tracker/read-model.ts` exposes
  a `projectionLabel`; the v3 baseline's rendered vocabulary (`FC_TXT`/`FC_CLS`: `ok|caveat|stall|noisy`, and the
  `f.land` sub-line branches: a real date string, `"gated"`, or `"shipped"`) is the concrete shape that ruling
  produces.
- **`plateau-app` is under a codified, enforced dogfooding mandate** — #1253 (`kind: decision`, `status: resolved`,
  codified to `we:docs/agent/platform-decisions.md#first-party-dogfood`): *"Hand-rolled UI is a conformance
  defect... reaching for `document.createElement` / bespoke CSS to build an interaction a FUI component already
  provides"* is explicitly named as the fault mode, and #1253's own text lists **"tabs"** as one of the
  components the migration is *"gated on FUI shipping"* — **tabs has shipped.**
  `frontierui:blocks/tabs/TabsElement.ts` exports `registerTabs(tag = 'we-tabs')` → a `<we-tabs>` light-DOM
  custom element hosting a `TabGroupBehavior` kernel (`frontierui:blocks/tabs/TabGroupBehavior.ts`) that
  **already implements every keyboard/ARIA behavior this card's acceptance asks for**: roving tabindex
  (`aria-selected`/`tabindex` 0/-1 toggling) and `ArrowLeft`/`ArrowRight`/`Home`/`End` nav — matching the v3
  baseline's own hand-authored tab keyboard handling move for move. **This is already dogfooded in this exact
  repo**: `plateau-app:src/component-assembler/assembler.ts` imports `registerTabs` from `@frontierui/blocks/tabs`
  and renders `<we-tabs class="we-tabs" default="f0"><nav tab-list>…triggers…</nav><div class="tab-panels-container">…panels…</div></we-tabs>`
  (see that file's `presetCard()` helper). The v3 mockup's hand-rolled `<button role="tab">` markup (its `.tabs`/
  `.tab` CSS classes) is a throwaway **design prototype**, not a pattern to reproduce verbatim in the real build
  — copying it literally would be exactly the "conformance defect" #1253 names. **This is a load-bearing finding
  for Decided design below** — it would very likely have cost a review round if a builder had copied the
  mockup's hand-rolled tabs as-is.
  - **Correction from independent review**: `plateau-app:scripts/check-render-conformance.mjs` is a ratchet on
    *regressions* (hand-rolled-DOM density rising past baseline), but a brand-new FUI-importing file with NO
    baseline entry at all is `untracked`, which is not a warning — `untracked.length > 0` makes the script
    `process.exit(1)`, same severity as a real regression. This is not a side gate either:
    `plateau-app:src/render-conformance.test.ts` shells this exact script inside `npm test` (the CI-required
    `test` check the drain gates merges on) and asserts its `untracked` array is empty. Since this module
    imports `@frontierui/blocks/tabs`, it becomes a newly-landed FUI surface the moment it lands —
    **`npm run check:render-conformance -- --update` is a required task for this story, not an optional one**
    (moved into Tasks/Done-when below; an earlier draft of this card wrongly called it optional).
- **A second, ratified FUI component overlaps part of this card's own scope — flagged, not silently adopted or
  dismissed.** `frontierui:blocks/master-detail/MasterDetailBehavior.ts` is a shipped, codified WE standard
  (`intent:master-detail`, #356, resolved) that composes the shipping `SelectionBehavior` block over a master
  list and a paired detail region: it owns the empty-state placeholder, calls a consumer-supplied
  `renderDetail(key: string, detailEl: HTMLElement): void | Promise<void>` hook on selection, and can move focus
  into the detail region via a `focusFlow: 'advance'` option. It is not used anywhere in `plateau-app/src` today.
  It would be instantiated over BOTH the master list and the detail container together, so adopting it is
  primarily **#2721's (S1b's) decision**, not this card's — `plateau-app:src/feature-tracker/mount.ts` is the
  file that owns both. This card's own `renderDetail(container, feature, options)` shape (Interfaces below) is
  compatible with being wrapped as that hook's implementation (`(key, detailEl) => renderDetail(detailEl,
  lookupFeature(key), { onBack })`), so this card does not block #2721 from adopting it later. **One real overlap
  to flag rather than paper over**: `MasterDetailBehavior`'s own `showEmpty()`/`placeholderHTML` could supersede
  this card's own nothing-selected branch in the live integration (it never calls the consumer's `renderDetail`
  hook at all when nothing is selected) — if #2721 adopts it, whoever prepares/builds #2721 must decide whether
  to route its `placeholderHTML` to reuse this card's null-branch output or let `MasterDetailBehavior`'s own
  generic placeholder take over (which does not hide the tabs or match the baseline's icon+description
  structure on its own). This card's null-branch stays correct and tested as a standalone unit either way; the
  decision belongs to #2721's own preparation, recorded here so it isn't missed there.
- **Existing `mountXxx(el: HTMLElement): void` convention** for this codebase's top-level mount exports —
  `plateau-app:src/backlog-view/backlog-view.ts` (`mountBacklogView`), with siblings in the same directory
  following the identical shape (`mountLaneBoardSkeleton`, `mountMicroDecisionSurface`, `mountRulingSurface`; one,
  `plateau-app:src/backlog-view/queue-view.ts`'s `mountQueuePanel`, additionally returns a teardown `() => void`).
- **No repo precedent anywhere in WE, FrontierUI, or plateau-app for a "content-section self-registration"
  pattern** (`Map<sectionId, renderFn>`, modules registering themselves as a side effect of import) — grepped
  `registerSection`/`SectionRegistry`/`renderers[` across `plateau-app/src`, the `frontierui` checkout, and this
  repo's own `scripts`/`demos`: no hit anywhere. **This part of the design below is genuinely new**, owned
  entirely by this card — not invented against an interface that should have been cited from elsewhere, because
  nothing to cite exists. Modeled on the closest neighboring idiom this repo already uses for idempotent
  self-registration (`registerTabs`'s "call once, safe if called again" shape) for house-style consistency.
- **The v3 baseline's mock `FEATURES` array** (`F(id,name,kind,pct,seg,done,total,vel,trend,fc,blk,land,blockedBy,blocks)`)
  is the **conceptual** shape every render path needs — not a literal contract to import.
  `plateau-app:src/feature-tracker/data.ts` and `plateau-app:src/feature-tracker/read-model.ts` (#2721/#2718)
  own the real, canonical field names for this data and **neither card has been
  prepared or built yet** (`we:backlog/2718-s1a-read-model-forecast-bottleneckid-single-source-of-number.md` and
  `we:backlog/2721-s1b-fleet-scan-frame-shell-header-read-only-feature-epic-shi.md` are both un-prepared stubs
  — no Decided design/Interfaces section on either, same as this card was before this pass). Inventing their
  field names here would violate the checklist's own grounding rule — "cite `path:line` actually opened, never
  invent an interface you have not read." **This card therefore defines its own minimal, local input
  type** (`FeatureDetailRecord`, below) rather than guessing at `plateau-app:src/feature-tracker/data.ts`'s.
- **The "leaf" state (a feature with zero epics) has no occurrence anywhere in the ratified v3 baseline.**
  `synthEpics()` always produces 5–8 epics (`n=5+Math.floor(rng()*4)`) and the one hand-authored feature
  (`conveyor`) has 8. So unlike every other acceptance line in this card, **"leaf" has no baseline pixels to
  cite** — it is genuinely uncited. Handled explicitly below (Decided design + Tasks) rather than silently
  invented.

## Decided design

**This shell is thin and side-effect-scoped.** It owns exactly: (a) branching on selection/leaf/normal, (b) the
tab shell plus a section registry that dispatches to whatever has self-registered, (c) the honest sub-line, (d)
the dependencies-tab content slot. It does **not** reach outside its own container to touch `document.body`, the
SCAN listbox, or any DOM `plateau-app:src/feature-tracker/mount.ts`/`plateau-app:src/feature-tracker/scan.ts` (#2721, unbuilt) own — see the back-button fork below, decided in
favor of the option that keeps that boundary real.

**1. Tabs use FUI's `<we-tabs>`, not hand-rolled `role="tab"` buttons.** Per the Grounding finding above (#1253 +
the already-dogfooded `plateau-app:src/component-assembler/assembler.ts` precedent), this module imports
`registerTabs` from `@frontierui/blocks/tabs` and calls it once at module load (idempotent, mirroring that same
file's own top-level call). The two-tab markup:
```html
<we-tabs class="dt-tabs" default="overview" aria-label="Feature detail views">
  <nav tab-list>
    <button tab-trigger="overview">Drill &amp; velocity</button>
    <button tab-trigger="dag">Dependencies <span class="cnt" id="dag-cnt"></span></button>
  </nav>
  <div class="tab-panels-container">
    <section tab-panel="overview" id="dt-overview"></section>
    <section tab-panel="dag" id="dt-dag"></section>
  </div>
</we-tabs>
```
`TabGroupBehavior` supplies `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, roving `tabindex`, and
Arrow/Home/End nav for free — this satisfies acceptance line 4 ("a tab switch keeps visual + ARIA in lockstep")
without hand-authoring any of it. The paired stylesheet styles `we-tabs.dt-tabs`'s parts to match the ratified
v3 look (colors/spacing/underline), not the element's own bare default styling (themeable — matches #1253's
"differentiated solely by a custom theme" principle). The `#dag-cnt` badge (blocker + blocked-by count) is plain
text content this module sets, same as the v3 baseline's own `dag-cnt` handling.

**2. One uniform section registry, four slots, not three-plus-a-special-case — AMENDED per #3132's ruling (below).**
The card names "velocity/burnup/rollup" as the self-registering set and separately asks to "pre-build the
dependencies-tab content slot" for S7 — but a single, uniform mechanism for all four is simpler than a bespoke
one-off for the fourth. **Correction (this addendum):** the shape below originally described **three** independent
per-`SectionId` containers (one each for velocity/burnup/rollup), silent on whether velocity's and burnup's
containers were the same DOM node — `we:backlog/3132-decide-the-section-registrys-shared-row-dom-contract-before-.md`
(prepared the same day as this card, independently, then cross-referenced back here) rules that ambiguity: velocity
and burnup **share ONE registry-owned container** (a `group` key), because both must land inside the ratified
mock's single `.velocity` 3-column CSS grid row, not two independent blocks. Decided (superseding the earlier
three-container draft):
```ts
export type SectionId = 'velocity' | 'burnup' | 'rollup' | 'dag';
export interface SectionDef {
  readonly id: SectionId;
  /** Optional shared-row co-tenancy key (#3132). Registrants sharing the same `group` render into sibling
   *  wrapper nodes inside ONE registry-owned container (in registration order), instead of each getting its
   *  own top-level container. Absent = the section keeps its own standalone container (rollup, dag). */
  readonly group?: string;
  /** Render (or update) this section's content into `container`. Called every time the owning tab becomes
   *  visible or the selected feature changes. Must be idempotent over the nodes THIS registrant owns — for a
   *  `group` registrant that means its own wrapper node, never the shared row container a co-tenant also
   *  writes to (#3132's idempotency-clobber finding). */
  render(container: HTMLElement, feature: FeatureDetailRecord): void;
}
const SECTIONS = new Map<SectionId, SectionDef>();
const GROUP_ROWS = new Map<string, HTMLElement>();
const WRAPPERS = new Map<SectionId, HTMLElement>(); // per-registrant wrapper, memoized (#3132 correction,
  // independent review 2026-08-15) — without this, containerFor would append a FRESH wrapper on every
  // render() call instead of reusing one, violating the idempotency contract below.
/** Idempotent — a section may re-register (e.g. HMR); the latest registration wins. Mirrors the
 *  `registerTabs`-style "safe to call again" shape already used across this codebase. */
export function registerSection(def: SectionDef): void { SECTIONS.set(def.id, def); }
/** Resolve the container to pass to `def.render()` (#3132). Registry-owned — neither registrant creates or
 *  reaches into a co-tenant's container; each gets only the wrapper node IT owns, and the SAME node on every
 *  call, so repeated `render()` calls are genuinely idempotent over that node. */
function containerFor(def: SectionDef, overview: HTMLElement): HTMLElement {
  if (!def.group) return overview.querySelector(`[data-section="${def.id}"]`)!;
  const cached = WRAPPERS.get(def.id);
  if (cached) return cached;
  let row = GROUP_ROWS.get(def.group);
  if (!row) {
    row = document.createElement('div');
    row.className = def.group; // 'velocity' — reuses the baseline's own CSS class/grid rule verbatim
    overview.querySelector('[data-overview]')!.appendChild(row);
    GROUP_ROWS.set(def.group, row);
  }
  const wrapper = document.createElement('div');
  wrapper.dataset.section = def.id;
  row.appendChild(wrapper); // DOM order = registration order = the baseline's own append order
  WRAPPERS.set(def.id, wrapper);
  return wrapper;
}
// S3 (#2727): registerSection({ id: 'velocity', group: 'velocity', render: renderVelocity });
// S4 (#2732): registerSection({ id: 'burnup',   group: 'velocity', render: renderBurnup   });
```
`velocity`/`burnup` (both `group: 'velocity'`) render into sibling wrapper nodes inside ONE `.velocity` row
container this shell builds; `rollup` keeps its own standalone container, laid out in the exact order and wrapping
structure the v3 baseline's own overview render function uses (the `.velocity` grid row → milestones → section
head → a rollup container → a legend) so the pixels a later slice fills in land into an already-correct frame.
`dag` renders into the `dag` tab panel — the "pre-built content slot" IS `SECTIONS.get('dag')`'s
container; #2729 (S7) registers into it exactly the way #2727/#2732/#2726 (S3/S4/S5) register into the other
three. **At this card's own ship time no section has registered anything.** #2727 (S3), #2726 (S5), and #2729
(S7) each list `2725` directly in their own `blockedBy`; #2732 (S4) is blocked by `2727` (S3) rather than `2725`
directly, but transitively still cannot land before this card does. So this card ships strictly first regardless.
Each container therefore renders empty when nothing is
registered — consistent with the "faking no number" convention #2721's own card already uses for the same
ordering problem. Acceptance line "the registry accepts registrations" is verified with a **local stub
registration** in this card's own test (see Tasks/Done-when), not real S3/S4/S5 content.

**3. Selection/back-button fork — decided in favor of a callback, not shared body-class reach-through.**
The v3 baseline's monolith reaches directly for `document.body`'s class list and the SCAN row's DOM in its
selection/back handlers because it has no module boundary to respect. The modular build does. Two real options:
  - **Option A — this module reaches out.** The render function internally toggles `document.body`'s class for
    the narrow "show-detail" layout and re-queries the scan row to restore focus on back. Simplest to write, but
    couples this file to `plateau-app:src/feature-tracker/mount.ts`/`plateau-app:src/feature-tracker/scan.ts`'s (#2721, unbuilt) DOM structure and CSS class names it does not
    own — exactly the kind of cross-scope reach the #3090 lesson (touching a caller outside a card's own
    declared scope) warns against, and it can't be unit-tested without mounting the whole app shell.
  - **Option B — this module exposes callbacks, `plateau-app:src/feature-tracker/mount.ts` wires them.** `renderDetail(container, feature, { onBack })`
    — `onBack` fires when the back button activates; this module never touches `document.body` or the scan
    list. Focus-into-the-title-on-select (acceptance line 1: "row select opens detail + moves focus to the
    title") stays entirely inside this module's own container (querying its own title element after render — no
    reach-out needed, since the title lives inside the detail pane's own DOM). The narrow-layout class toggle and
    "return focus to the row" behavior move to whoever owns both the scan list and the detail container — i.e.
    `plateau-app:src/feature-tracker/mount.ts` (#2721), which is exactly where the v3 baseline's own body-level code already lives conceptually.
    Slightly more plumbing (one callback), but keeps this module testable in isolation (mount a bare `<div>`,
    call `renderDetail`, assert DOM/focus/callback firing — no dependency on #2721's unbuilt code) and keeps
    every file's DOM writes inside its own declared `scope:`.

  **Decided: Option B.** It is the only option consistent with this codebase's existing small-composable-render-
  function-plus-callback style (`mountQueuePanel`'s teardown callback) and the only one this story can actually
  ship + test without #2721 existing first. **This constrains #2721's own future interface** (its `plateau-app:src/feature-tracker/mount.ts` must
  call `renderDetail(container, feature, { onBack })` and implement `onBack` itself) — recorded here as a real
  seam decision for whoever prepares/builds #2721 next, not as scope creep on this card.

**4. `nothing-selected` is cited from the baseline; `leaf` is NOT and is flagged as inferred.**
Rendering with a `null` feature reproduces the v3 baseline's own "nothing selected" branch exactly: hide the
tabs, clear the header fields, show an empty-state block (icon + title "Nothing selected" + description "Pick a
feature from the fleet scan…"). (The baseline's *other* empty branch — "fleet is empty" — is S9's concern per
#2722's own scope, not this card's; this card only owns the null-feature branch.) For **leaf** (a selected
feature with zero epics — no baseline pixels exist, per Grounding above): render the header/sub-line normally (a
leaf feature still has points/velocity/forecast data), but render the rollup section's container with the
**same empty-state component** used for "nothing selected" (icon + "No epics yet" + a short honest description),
reusing the one empty-state pattern rather than inventing a second. This is a **proposed**, not baseline-cited,
design — flagged explicitly so a future visual-diff/webcase-conformance gate treats it as provisional, not
frozen, until FT-S16 gets an actual reference rendering to diff against.

## Interfaces / protocol

```ts
// This module's OWN local input contract — not a copy of data.ts's/read-model.ts's future exports (neither
// exists or has been prepared yet; see Grounding). Field meanings are drawn from the ratified v3 baseline's
// mock-feature tuple and its render logic, not the baseline's own golfed field names.
export interface FeatureDetailRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: 'visual' | 'build';
  readonly pointsDone: number;
  readonly pointsTotal: number;
  readonly pctComplete: number;               // 0-100
  readonly velocity: number | null;            // points/wk; null when no basis yet (K6)
  readonly trend: 'up' | 'down' | 'flat';
  readonly forecastClass: 'ok' | 'caveat' | 'stall' | 'noisy';
  readonly blocked: boolean;
  /** Honest next-landing text: a real projection/date string, the literal `'gated'`, or the literal
   *  `'shipped'` — never a fabricated date on a blocked/gated/stalled feature (DEC #2719's forecast policy). */
  readonly nextLanding: string;
  readonly blockedByIds: readonly string[];
  readonly blocksIds: readonly string[];
  /** Epic count — 0 means leaf. This module does not compute the rollup; it only needs the count to decide
   *  whether to show the leaf empty-state in the rollup slot vs let the `rollup` section render. */
  readonly epicCount: number;
}

export type SectionId = 'velocity' | 'burnup' | 'rollup' | 'dag';
export interface SectionDef {
  readonly id: SectionId;
  /** Optional shared-row co-tenancy key (#3132). Registrants sharing the same `group` render into sibling
   *  wrapper nodes inside ONE registry-owned container (in registration order), instead of each getting its
   *  own top-level container. Absent = the section keeps its own standalone container (rollup, dag). */
  readonly group?: string;
  /** Called every time the owning tab becomes visible or the selected feature changes. Must be idempotent
   *  over the nodes THIS registrant owns — for a `group` registrant that means its own wrapper node, never
   *  the shared row container a co-tenant also writes to (#3132's idempotency-clobber finding). */
  render(container: HTMLElement, feature: FeatureDetailRecord): void;
}
export function registerSection(def: SectionDef): void;

export interface RenderDetailOptions {
  /** Fired when the back button (narrow layout only) is activated. This module does not itself change layout
   *  or return focus to the scan list — the caller (mount.ts, #2721) owns both and does so in response. */
  onBack?: () => void;
}
/** Render (or re-render) the detail pane into `container`. `feature: null` renders the nothing-selected
 *  empty state. Idempotent — replaces `container`'s content each call, safe to call repeatedly (e.g. on
 *  every selection change or theme toggle, mirroring the v3 baseline calling its own render function from
 *  both the row-select and theme-toggle handlers). Moves focus to the feature title (a `tabindex="-1"`
 *  heading) whenever `feature` is non-null and different from the previously-rendered feature — matching
 *  the baseline's own post-select focus move. */
export function renderDetail(
  container: HTMLElement,
  feature: FeatureDetailRecord | null,
  options?: RenderDetailOptions,
): void;
```

**Error shape:** none — this module has no fallible operation (no fetch, no parse). `renderDetail` never throws:
an unregistered section renders its container empty (a mount that hasn't landed yet is not an error, per the
"S1b ships first, faking no number" convention already established for this exact ordering problem).

**Consumers (none built yet, named for the seam they'll need):** `plateau-app:src/feature-tracker/mount.ts` (#2721, S1b, unbuilt) calls
`renderDetail` on selection and wires `onBack`; the velocity/burnup/rollup/dag modules (#2727/#2732/#2726/#2729,
all unbuilt, all `blockedBy: ["2725", …]`) each call `registerSection({ id, render })` once at module load.

**Migration:** none — additive, no existing data to migrate (first slice to create these files).

## Tasks

1. Add this card's shell module (`FeatureDetailRecord`, `SectionId`/`SectionDef`/`registerSection`,
   `RenderDetailOptions`, `renderDetail`). Import and call `registerTabs` from `@frontierui/blocks/tabs` at
   module load (mirrors `plateau-app:src/component-assembler/assembler.ts`'s own top-level call). Build the
   fixed-order overview layout shell per the group-key design ruled by #3132 — velocity and burnup are NOT two
   independent containers; they share one registry-owned `.velocity` row container (built lazily via
   `containerFor`/`GROUP_ROWS` on first registration, `group: 'velocity'`), each landing in its own memoized
   per-registrant wrapper (`WRAPPERS`) inside that row — followed by rollup's own standalone container, in the
   v3 baseline's own order, plus the dag-tab container. Every section's render target is resolved via
   `containerFor(def, overview)`, not a bare `SECTIONS.get(id)` lookup.
2. Implement the sub-line exactly matching the baseline's own next-landing branching (`gated` → `"gated — no
   date"`, `shipped` → `"shipped"`, else the literal `nextLanding` string) plus points/pct/epicCount/velocity+trend.
3. Implement the nothing-selected branch (cited) and the leaf branch (proposed design — reuse the empty-state
   component in the rollup slot when `epicCount === 0`).
4. Implement the back button: render it (narrow-layout only, CSS-gated same as the baseline's own back button),
   wire its click to call `options.onBack?.()` — no `document.body` or scan-list DOM access from this module.
5. Add the paired stylesheet — style `we-tabs.dt-tabs`'s parts plus the shell layout to match the v3 baseline's
   visual target (colors/spacing only; the interaction is FUI's).
6. Add this card's test file (vitest, `happy-dom`, mirroring `plateau-app:src/backlog-view/mount.test.ts`'s
   style): mount a bare `<div>`, exercise each acceptance line directly — (a) rendering with `null` shows the
   nothing-selected empty state, tabs hidden; (b) rendering with a **locally-authored synthetic zero-epic
   fixture** (none exists anywhere upstream — see Grounding) shows the leaf empty-state in the rollup slot while
   the header/sub-line still render; (c) a `gated`-`nextLanding` fixture renders the literal "gated — no date"
   text, never a date; (d) calling the render function twice with a different feature moves focus to the title
   and updates `aria-selected`/`tabindex` on the FUI tab triggers in lockstep; (e) `registerSection({ id:
   'velocity', render: stub })` then rendering calls `stub` with the velocity container plus the feature; (f) the
   `dag` tab panel container exists and is queryable before any `dag` section registers.
7. Run `npm run check:render-conformance -- --update` (in `plateau-app`) to baseline this newly-landed FUI
   surface — **required**, not optional (independent review found the unbaselined default fails `npm test`'s
   required `test` check, since an FUI-importing file absent from the baseline is treated as a regression; see
   Grounding).
8. Run this story's own new test file under vitest, and plateau-app's own `npm test` (which now includes the
   render-conformance gate for this file). `npm run check:standards` at the webeverything root is this
   preparation PR's own doc-gate only — the functional gates above are for whoever builds this card.

## Done when

- [ ] The shell module exists and exports `FeatureDetailRecord`, `registerSection`, `renderDetail` as specified
      above.
- [ ] Rendering with `null` renders the nothing-selected empty state (tabs hidden), matching the v3 baseline's
      own "nothing selected" branch.
- [ ] Rendering with a synthetic `epicCount: 0` fixture (authored in the test) renders the header/sub-line
      normally and an honest empty-state in the rollup slot.
- [ ] A fixture with `nextLanding: 'gated'` renders the literal text "gated — no date" in the sub-line — never a
      date string.
- [ ] Selecting a new feature (a second render call with a different `feature.id`) moves focus to the title and
      keeps the FUI tab triggers' `aria-selected`/`tabindex` in lockstep with the visible panel.
- [ ] `registerSection({ id, render })` followed by a render call invokes that section's `render` with its
      container plus the current feature — proven with a local stub, not real S3/S4/S5 content.
- [ ] The `dag` tab's content container exists and is queryable from outside the module before anything
      registers into it (the "pre-built slot" S7/#2729 will consume).
- [ ] The back button (present only under the narrow-layout CSS condition) invokes `options.onBack` and performs
      no `document.body` / scan-list DOM access itself.
- [ ] This story's own new test file passes under vitest.
- [ ] `npm run check:render-conformance` (in `plateau-app`, no flag — the enforcing run) exits 0: this file is
      baselined via `-- --update` and carries no untracked/regressed hand-rolled-DOM density.
- [ ] `npm run check:standards` is 0 errors (webeverything root — this backlog card's own doc gate).

## Delivery shape

**One piece, single PR**, additive-only (three new files, nothing existing modified) — no shared gate is
touched, so there's no incremental-landing constraint. It cannot land *functionally* before #2721 (S1b) ships,
since nothing calls `renderDetail` in a real page until `plateau-app:src/feature-tracker/mount.ts` exists — but it CAN be built, unit-tested, and
merged on its own (its test harness stands up a bare `<div>`, not the real app shell), exactly the ordering
#2721's own card already models ("SHIPS FIRST... faking no number"). Recommend building this once #2721 (S1b) is
itself prepared to build-ready — not necessarily *merged* first, since this card has no runtime dependency on
#2721's code, only on the seam contract (`onBack`, `FeatureDetailRecord`) agreed here.

## Out of scope (explicit)

- `plateau-app:src/feature-tracker/mount.ts`/`plateau-app:src/feature-tracker/scan.ts`/`plateau-app:src/feature-tracker/data.ts` (#2721, S1b) — the app shell, SCAN listbox, and mock data module this card
  consumes but does not build.
- `plateau-app:src/feature-tracker/read-model.ts`/`plateau-app:src/feature-tracker/forecast.ts` (#2718, S1a) — the real computation behind `FeatureDetailRecord`'s fields; this
  card's test fixtures are hand-authored, not sourced from a real read-model.
- The actual velocity/burnup/rollup/dag panel content (#2727/#2732/#2726/#2729, S3/S4/S5/S7) — this card only
  builds the containers plus the registry they call into.
- A real leaf-feature fixture sourced from ratified design pixels — none exists anywhere in this epic today (see
  Grounding); this card's leaf rendering is a proposed design pending a future visual-diff confirmation, not a
  frozen baseline match.
- Whether `plateau-app:src/feature-tracker/mount.ts` (#2721) adopts `frontierui:blocks/master-detail/MasterDetailBehavior.ts`
  to drive selection→detail wiring, and if so how its `placeholderHTML`/`showEmpty()` reconciles with this
  card's own nothing-selected branch — a real seam flagged above, decided by #2721's own preparation, not this
  card.

## Independent review (2026-08-15)

A fresh-context reviewer checked every file-existence, backlog-status, and artifact claim in this card against
the live repos (independently re-fetching the v3 baseline artifact) and found the file-existence/backlog-status/
tabs-precedent claims accurate, but two real defects, both fixed above: (1) the original draft claimed
`plateau-app:scripts/check-render-conformance.mjs` was not a CI trip-wire for a new file — false; a brand-new
FUI-importing file with no baseline entry fails `npm test`'s required `test` check exactly like a regression, so
baselining it is now a required Task/Done-when item, not optional Out-of-scope; (2) the original draft designed
the master-detail selection wiring without checking whether a ratified FUI component already covers part of it —
`frontierui:blocks/master-detail/MasterDetailBehavior.ts` (#356, resolved, unused in `plateau-app` today) does,
and is now named in Grounding with the real overlap (its own empty-state placeholder) flagged as an open seam
for #2721's own preparation rather than silently decided here. Two minor corrections also applied: the #2803
citation for "don't invent an unbuilt interface" was backwards (fixed to cite the checklist's grounding rule
directly instead of miscasting #2803's own failure mode), and the "S3/S4/S5/S7 all list 2725 in blockedBy" claim
was imprecise (#2732/S4 is blocked by #2727/S3, not 2725, directly — transitively still ships after, now stated
precisely). Confidence after fixes: **Medium-High** — the remaining residual is the #2721-side seam question
(MasterDetailBehavior adoption) this card correctly defers rather than resolves, and the fact that this card's
own functional gates (vitest, render-conformance) cannot be run from this preparation PR itself (webeverything-
only), so they are verified by specification and citation here, not by an actual green run.
