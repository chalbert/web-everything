---
bornAs: x3hbiy3
kind: decision
parent: "2705"
status: open
dateOpened: "2026-08-15"
preparedDate: "2026-08-15"
relatedTo: ["3136"]
tags: []
---

# Decide the section registry's shared-row DOM contract before S3/S4/S5 self-register

Preparing #2727 (S3, velocity panels) to build-ready found that the ratified v3 baseline mock draws the throughput sparkline, cycle where-the-time-goes bar, and burn-up as THREE SIBLING panels inside one `.velocity` 3-column CSS grid, populated by one render call. The build plan splits that same row into three independently self-registering sections — velocity (S3 #2727), burnup (S4 #2732), rollup (S5 #2726) — registering into S2 (#2725) a data-driven section registry, with no stated contract for whether a registrant gets a shared grid cell or its own standalone block. Grounded and ruled below: **fork 1 (shared row) and fork 2 (registry-owned `group` key) are both at Definition of Ready with an attacked, surviving default** — a fast ratification, not cold research.

## Sibling-decision check — no duplicate exists (this prep's first task)

This item's `bornAs: x3hbiy3` **is** the item — `x3hbiy3` was its pre-JIT-numbering birth id, not a separate sibling. `grep -rl x3hbiy3 backlog/` finds only this file's own frontmatter.

**Correction (this addendum, independent review 2026-08-15): the original claim below about `xyjz84p` was wrong.**
`git log --all -S xyjz84p` finds it in commit `b544c65f "prepare #2723 to build-ready: fleet bottleneck banner"` — but `xyjz84p` is not that commit's own card; it is the birth id of a SEPARATE card the same commit filed as a side finding while preparing #2723: `we:backlog/xyjz84p-ft-screen-slot-mechanism.md`, later JIT-numbered to **`we:backlog/3136-ft-screen-slot-mechanism.md`** (`status: open`, unruled). #3136 is not a duplicate of this decision — its scope is wider, naming a cross-slice slot/registration ambiguity across *three* producer files (#2721↔#2723, #2725↔#2729, #2726↔#2731/#2728) — but it is not unrelated either: its own Recommendation section explicitly names this card's exact design space, "**revisit option 2 [a generic `import.meta.glob`-based slot-registry module] specifically for #2725's section registry**," as still open. That sub-question is this decision's own **Fork 2**, which below rules the registry-owned `group` key (its option 1) rather than a generic slot-registry module (its option 2) — **so this decision supersedes #3136 on the #2725-section-registry sub-question specifically**, while #3136 remains open and authoritative for its broader, still-unresolved scope (#2721↔#2723's own mechanism choice, and #2726's marker-slot pair). Cross-reference added to #3136 pointing back here so a reader of either card sees both. **No fully-duplicate sibling decision card exists; nothing to merge wholesale — #3136 is a broader, still-open item, narrowly superseded here on one sub-question.**

## Found while preparing #2727 to build-ready

Grounded against the RATIFIED design mock (the live artifact linked from `we:backlog/2705-feature-tracking-screen-ratified.md`, `https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046`) — its rendered HTML is the frozen source S0b (#2720) will annotate into `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`, not yet committed to either repo:

- The mock's CSS: `.velocity{display:grid;grid-template-columns:1.15fr 1.15fr 1.55fr;gap:14px;margin-bottom:18px}` — ONE grid container, three columns.
- The mock's render call sequence populates that one container directly: `vel.appendChild(sparkPanel(f,v)); vel.appendChild(cyclePanel(f)); vel.appendChild(burnPanel(f,v));` — three `.panel` children of one `vel` node, written by one function, not by three independent registrants.
- `we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md` describes S2's deliverable as *"a data-driven section registry (velocity/burnup/rollup self-register to identical ratified DOM)"* — naming velocity, burnup, and rollup as three SEPARATE registrants.
- `we:backlog/2727-s3-velocity-panels-band-forecast-chips-insufficient-stalled-.md` (S3) scopes only `plateau-app:src/feature-tracker/velocity.ts`/`plateau-app:src/feature-tracker/velocity.css` and is `blockedBy` S2, not S4.
- `we:backlog/2732-s4-burn-up-honest-forecast-projection-gated-hatched-band-no-.md` (S4) scopes `plateau-app:src/feature-tracker/burnup.ts`/`plateau-app:src/feature-tracker/burnup.css` (+ an owned re-edit of `plateau-app:src/feature-tracker/forecast.ts`), separately, `blockedBy: ["2727", "2687"]` — i.e. burn-up registers AFTER velocity, as its own section.
- Rollup (S5, `we:backlog/2726-s5-epic-slice-rollup-with-connector-rails.md`) scopes `plateau-app:src/feature-tracker/rollup.ts`/`plateau-app:src/feature-tracker/rollup.css` and is visually a full-width block BELOW the `.velocity` row in the mock (`.sec-h`/`.rollup` are separate, unrelated CSS rules from `.velocity`) — so S5 is not actually part of this ambiguity; only velocity (S3) and burn-up (S4) compete for slots inside the same historical `.velocity` grid row.

## Cross-reference — #2725 (S2) was independently prepared to build-ready the same day, and its own text reproduces this exact ambiguity unresolved

`we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md` carries `dateOpened: "2026-08-15"` and an "Independent review (2026-08-15)" section — prepared to build-ready **in parallel with this decision, by a different session, with no cross-link either direction**. It already ships a concrete `SectionId = 'velocity'|'burnup'|'rollup'|'dag'` / `SectionDef{ id, render(container, feature) }` / `Map<SectionId,SectionDef>` registry (its `## Decided design` point 2, `## Interfaces / protocol`), independently reviewed at confidence Medium-High. Its own text (`we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md:177-179`):

> `velocity`/`burnup`/`rollup` render into three containers inside the `overview` tab panel, laid out in the exact order and wrapping structure the v3 baseline's own overview render function uses (a 3-column grid → milestones → section head → a rollup container → a legend) so the pixels a later slice fills in land into an already-correct frame.

"**Three** containers" — one per `SectionId` — is silent on whether velocity's and burnup's containers are the same DOM node or two independent ones, which is precisely this decision's fork 2. This is direct, dated evidence the gap is real and live, not hypothetical: a build-ready, independently-reviewed shell card already shipped without this ruling, and would need editing to conform once ruled (see Action for #2725, below) — the exact "buried fork handed to a builder" class `we:agent-memory-src/story-preparation-checklist.md` item 4 exists to catch, now caught before either card lands.

## Prior art (repo-internal; no new WE standard is being minted, so no `/research/` web survey is required)

This decision is a **plateau-app product-layer implementation contract** (rule 96: WE=standard, FUI=impl, plateau-app=product), not a new WE intent/block/plug/protocol/adapter — confirmed by grep: no `we:src/_data/intents/*.json` entry owns "section"/"slot"/"registry" vocabulary (`we:src/_data/intents/region-select.json`/`we:src/_data/intents/live-region-status.json` are unrelated ARIA-live concerns), so there is no owning standard-layer anchor to cite as authority, and none is being bypassed. #2725's own grounding pass already confirmed no repo precedent for a **self-registering content-section** pattern exists anywhere in WE/FUI/plateau-app (`registerSection`/`SectionRegistry`/`renderers[` grepped, no hit). The closest real precedent, cited here to ground the mechanism (not the vocabulary):

- **`registerTabs`'s idempotent "call once, safe if called again" self-registration idiom** (`frontierui:blocks/tabs/TabsElement.ts`) — already the house style #2725 models its own `registerSection` on.
- **`CustomWorkflowEngineRegistry`** (`frontierui:blocks/workflow-engine/registry.ts`) — a shipped `Map<string, Engine>` + resolve-with-default registry, the same "named registry, swappable providers" shape this decision's mechanism generalizes from (a provider-registry precedent, not a DOM-slot one — cited for the `Map`-keyed-registry idiom, not the container-sharing question).
- **`we:docs/agent/platform-decisions.md#surface-contract-not-computation`** ("Mandate the surface contract, not the computation... competing 'models' that emit the same surface are... swappable provider strategies") — supports pinning the *DOM surface* (pixel parity with the ratified mock) as the thing this decision fixes, while leaving the registry's internal bookkeeping (`Map` shape, container-creation timing) an implementation detail free to evolve.
- **`we:docs/agent/platform-decisions.md#single-introspection-slot`** ("One canonical introspection slot — render alternate forms into it, never duplicate the surface") — a different subsystem (workbench introspection), but the same underlying principle this decision's fork 1 rules on: don't fork/duplicate a canonical render target when one already exists and is ratified.
- **Native platform analog** (why "slot" is on the table as a name, not adopted as the mechanism): Shadow DOM's `<slot>` is the platform's own producer/consumer content-distribution primitive, but it requires a shadow root — `plateau-app` renders light-DOM per the existing house style (`registerTabs`/`MasterDetailBehavior` are all light-DOM), so `<slot>` itself isn't reusable here; it's cited only as the naming precedent for calling the shared mechanism a "slot," not as a candidate implementation.

## Per-fork classification (7-question pass, summarized)

**Which layer?** Both forks are plateau-app product-layer (confirmed above — no owning WE intent, nothing to mis-layer). **Fixed mechanic or configurable dimension?** Fork 1 is a forced pick, not a dimension — the "independent sections" branch isn't a legitimate alternate end-state a config flag could select between, because it invalidates an already-shipped ratified artifact rather than offering a second coherent shape (Q4 test: the branches are not both legitimate end-states, so this is a real fork, not `#config-extends-platform-default`). Fork 2 is a genuine either/or over which of two mechanisms ships in code that must compile against S3's/S4's own already-written `render()` signatures — also a real fork, not a dimension (only one will exist in the shipped registry). **Most-permissive default / DI-injectable?** Fork 2's ruled default (registry-owned `group` key) is the more DI-friendly of the two — a registrant declares `group` declaratively at its own registration call site rather than the shell hardcoding which ids collapse together, so a future registrant can opt into row-sharing without the shell's container-building code changing.

## Fork 1 — Shared-row DOM contract vs. independent-section contract

**Fork-existence justification:** the "independent sections" branch is excluded because it silently abandons the row layout of an already-ratified, live design artifact (`#2705`'s own linked mock) without the epic's own required re-baseline/operator visual-diff approval, and it breaks acceptance text S3/S4 already carry verbatim ("spark + cycle match baseline in both themes," `#2727`) — not a hypothetical cost, a currently-unmet acceptance criterion the moment that branch ships.

1. **Registry entries are DOM-fragment contributors to a shared row.** S2 owns a `.velocity` grid container; S3 and S4 each register a render function that injects its own node(s) into that shared grid, preserving the original 3-column layout (S3 contributing 2 of 3 columns — spark + cycle — S4 the 3rd). Matches the frozen baseline pixel-for-pixel, no re-baseline.
2. **Registry entries are independent, self-contained sections.** Each of velocity/burnup/rollup renders its own full section (own heading, own layout, stacked vertically like `.rollup` already is) — the historical single-row 3-column `.velocity` grid is INTENTIONALLY abandoned for a new stacked layout, a real design change requiring the operator's visual-diff approval per #2705's own acceptance policy, with no stated reason anyone wants this.

**Recommended default: (1), shared row.** It is what the ratified mock already draws, requires no new baseline/visual-diff round-trip, and keeps S3/S4's "match the frozen baseline" acceptance literally checkable.

**Skeptic: SURVIVES-WITH-AMENDMENT.** CSS-grid auto-placement is by DOM order, not by which JS call did the appending, so "S3 appends 2 children, then S4 appends 1" does reproduce the flat 3-column grid pixel-for-pixel — the mechanism holds. The exclusion-branch claim also holds: #2705's own acceptance policy makes any pixel divergence from the ratified baseline trip the visual-diff gate, so branch (2) genuinely would force re-approval; no looser reading survives. **But the original draft's "zero cost" framing was false** — #2725's own already-drafted `## Decided design` §2 currently describes **three** per-`SectionId` containers, not a merged velocity+burnup one (see Cross-reference above), so landing fork 1 still requires editing that text. Folded into the Action for #2725 below as a named task, not asserted as free.

**Screen: clear.** Genuine externally-visible contract (whether the shipped screen preserves or silently redesigns a live, ratified pixel baseline) — not an implementation detail hidden behind a module boundary. A real merit difference survives even under a zero-build-cost hypothetical: (1) is the only branch that actually matches what was ratified; (2) produces a different, unrequested design regardless of how cheaply it's built.

## Fork 2 — Container-ownership mechanism: how does S2 hand the shared `.velocity` container to both velocity (S3) and burnup (S4) while keeping them mutually decoupled?

**Fork-existence justification:** exactly one mechanism will ship in #2725's shell code; S3's and S4's own `render()` implementations must agree with it or they silently produce wrong pixels or clobber each other's DOM nodes on re-render — `SectionDef.render` is documented (per #2725's own `## Interfaces`) as callable "every time the owning tab becomes visible or the selected feature changes" and "must be idempotent (safe to call repeatedly on the same container)"; for a naive full-container-clear implementation, two registrants secretly sharing one raw container would wipe each other's nodes on independent re-renders. This is a real, currently-unresolved either/or, not a stylistic preference.

1. **Registry-owned `group` key.** `SectionDef` gains an optional `group?: string`. The registry — not either registrant — creates ONE shared row container on first registration to a given `group` (reusing the baseline's own `.velocity` class name), and for **each** registrant in that group allocates and appends a dedicated child wrapper node, handing that per-registrant wrapper (never the shared raw container) to `render(wrapper, feature)`. Registration order determines DOM order (velocity registers before burnup, matching the baseline's own append order).
2. **Static shell-owned shared reference (no new API).** Since the full fixed `SectionId` set is already known when S2 is authored, the shell just builds the `.velocity` grid element once and hands that same raw `HTMLElement` to both `SECTIONS.get('velocity')!.render(container, feature)` and `SECTIONS.get('burnup')!.render(container, feature)`, in fixed call order — no `group` field, no registry-side container bookkeeping.

**Recommended default: (1), the registry-owned `group` key** — reversing this decision's own earlier draft, which had recommended (2) before the skeptic pass below.

```ts
export interface SectionDef {
  readonly id: SectionId;
  /** Optional shared-row co-tenancy key (this decision, #3132). Registrants sharing the same `group` render
   *  into sibling wrapper nodes inside ONE registry-owned container (in registration order), instead of each
   *  getting its own top-level container. Absent = the section keeps its own standalone container (today:
   *  rollup, dag — unchanged from #2725's original shape). */
  readonly group?: string;
  render(container: HTMLElement, feature: FeatureDetailRecord): void;
}

const SECTIONS = new Map<SectionId, SectionDef>();
const GROUP_ROWS = new Map<string, HTMLElement>();
const WRAPPERS = new Map<SectionId, HTMLElement>(); // per-registrant wrapper, memoized — closes the clobber
  // hole for real: without this cache, every render() call would create+append a FRESH wrapper, producing a
  // duplicate <div> per re-render instead of reusing one (caught in independent review, 2026-08-15).

/** Resolve the container to pass to `def.render()`. Registry-owned — neither registrant creates or reaches
 *  into a co-tenant's container; each gets only the wrapper node IT owns, and the SAME node on every call. */
function containerFor(def: SectionDef, overview: HTMLElement): HTMLElement {
  if (!def.group) return overview.querySelector(`[data-section="${def.id}"]`)!; // unchanged per-id shape
  const cached = WRAPPERS.get(def.id);
  if (cached) return cached; // idempotent: re-render calls reuse the same wrapper, never append a duplicate
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
// S5/S7 (#2726/#2729): registerSection({ id: 'rollup'|'dag', render })  — no `group`, own container, unchanged.
```

**Skeptic: REFUTED (original static-shared-reference default flipped to the registry-owned `group` key).** The static option (2) has a genuine correctness hole: if two registrants secretly share one raw container and either does a naive "clear the whole container, then rebuild" on its own re-render (a reasonable reading of #2725's own "idempotent — safe to call repeatedly" contract), it wipes its co-tenant's nodes on every independent selection/tab-visibility change. Option (1) closes this **by construction** — each registrant is only ever handed its own owned wrapper, never a node a sibling also writes to. **Correction (independent review, 2026-08-15):** the pseudocode's earlier draft memoized the shared row (`GROUP_ROWS`) but not the per-registrant wrapper, so `containerFor` would itself have violated the very idempotency contract this fork exists to guarantee — appending a fresh duplicate `<div>` on every re-render instead of reusing one. Fixed above: `WRAPPERS` now memoizes per-`SectionId`, so `containerFor` returns the SAME wrapper node on every call for a given registrant, not just a stable row for the group. Option (2) is also not actually the smaller surface once compared honestly: the velocity+burnup grouping becomes undocumented knowledge living only inside the shell's implementation, invisible to anyone reading S3's or S4's own `registerSection` call; option (1)'s `group: 'velocity'` field is self-documenting at the exact call site a future reader would look. On YAGNI: checked for a second row-sharing case elsewhere in the epic's 24 children — S6a/#2731 and S6b/#2728 register into rollup's own marker slot, but that's mutually-exclusive per-kind dispatch (exactly one renders), not simultaneous co-tenancy, so "exactly one shared-row case today" holds; but a slot/group abstraction already recurring at smaller scale (rollup's own dispatch) undercuts dismissing option (1)'s `group` field as speculative machinery for a hypothetical that doesn't exist — the underlying need (more than one registrant landing in one container) already shows up twice in this epic, just implemented ad hoc each time today.

**Screen: flagged(prioritization) → re-argued on merit, resolved.** The original default's rationale ("no new API surface... deferred until a second real need appears") was cost-based — prioritization dressed as a fork verdict, not a merit claim, exactly the pattern the two-confusion screen exists to catch. Re-derived on merit instead (per the Skeptic verdict above): option (1) is chosen because it closes an idempotency-clobber correctness hole *structurally* and is more self-documenting at the registration call site — not because it is less work. On the screen's layering question: this whole decision is plateau-app product-layer (confirmed under Prior art above — no WE standard/intent is being minted, nothing gets a `codifiedIn` claim), so "the shared contract" fork 2 rules on is the `registerSection`/`SectionDef` surface every S3/S4/S5/S7 registrant already codes against per #2725 — the correct altitude for this call, not an impl concern smuggled onto a standard-layer decision.

## Recommendation

**Rule fork 1(1) — shared row — and fork 2(1) — registry-owned `group` key — together, as one ruling, since fork 2 only exists because fork 1 was ruled shared.** Both defaults survived an adversarial pass with one real amendment folded in (fork 1: naming the #2725 edit as a task, not asserting it's free) and one real reversal folded in (fork 2: flipping from the static shared-reference to the registry-owned group key, closing a genuine idempotency hazard). This belongs in S2's (#2725) own implementation — S2 is the item that actually builds the registry — so the concrete signature above lands there, not bolted onto S3 after the fact.

## Action for #2725 (S2) — required before S2 is built, not before this decision lands

`we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md`'s `## Decided design` §2 and `## Interfaces / protocol` currently describe **three** per-`SectionId` containers with no `group` field — superseded by this ruling. A short, clearly-labeled addendum has been added directly to that card (this same PR) pointing at this decision's ruling and the code shape above, so #2725's builder sees the corrected contract rather than rediscovering this exact ambiguity at the S0c (#2735) baseline/visual-diff gate — the failure mode this decision exists to prevent.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (system machinery feeding a 24-open-child epic; predicted touch-set: `plateau-app:src/feature-tracker/detail.ts`, `plateau-app:src/feature-tracker/velocity.ts`, `plateau-app:src/feature-tracker/burnup.ts`). This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
