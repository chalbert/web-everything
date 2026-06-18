# Backlog split analysis — 2026-06-17

Focused run: `/split 880`.

## Candidate

**#880 — Gate: code-path references in backlog & reports must indicate their repo locus**
(`workItem: story`, `size: 13`, `status: open`). Oversized story in the should-split band, already
self-described in its body as "three things in one (convention · gate-build · migration)".

## Work-investigation pass (real tree)

| Surface | Where | Note |
|---|---|---|
| Convention doc | `docs/agent/conventions.md` (6 KB, "Naming Conventions" §) | exists; slice A appends a clause here |
| Authoring note | `docs/agent/backlog-workflow.md` | new-item authoring guidance lives here |
| Gate machinery | `scripts/check-standards.mjs` (843 lines) | already raw-scans `backlog/*.md` (`:443`) **and** `reports/*.md` (`:591`); slice B adds a check block into these existing loops |
| Migration surface | `backlog/*.md` (867) + `reports/*.md` (150) = **1017 files**, only **5** already carry a `we:`/`fui:`/`plateau:` prefix | slice C's bulk rewrite |

Seams confirmed against real code — each slice's named files are citable, not guessed.

## Could split — #880 → 3 slices

| Slice | workItem / size | Scope | Home |
|---|---|---|---|
| **A — convention clause** | story · **2** | Add the `<repo>:` locus rule (alias table, in-repo `[we:path](path)` link form, cross-repo plain-text form) to `conventions.md`; add the authoring note to `backlog-workflow.md` so new items comply from creation. Ratifies the two bold-defaulted knobs (alias-vs-full → allow both, default alias; rollout → one-pass). | own story |
| **B — detection gate (warn-level)** | story · **5** | New `check:standards` check in the existing `backlog/`+`reports/` scan loops: regex for path-like tokens, with carve-outs (fenced code blocks, `@scope/pkg` specifiers, URLs, `relatedReport`/`graduatedTo`/`crossRef` frontmatter). Emits **warnings** only — build stays green on the un-migrated corpus. | own story |
| **C — migration + hard gate** | story · **5** | One-time regex+locus-inference rewrite of all 1017 files (path-in-WE-tree → `we:`, else resolve vs FUI/plateau; log cross-repo-ambiguous paths for manual pass); flip slice B's check **warn → error**; finishes #841. | own story |

**Slice DAG (incremental delivery, each ships valid):**

```
A (convention) ──▶ B (detect, warn) ──▶ C (migrate + flip to error)
```

- `B blockedBy A` — the gate enforces the form the convention defines.
- `C blockedBy B` — migration targets exactly what the gate flags, then hardens it to error.
- Not a "nothing usable until the last" chain: **A** ships a usable documented rule (authors comply by hand);
  **B** adds detection (warnings, green build); **C** completes the corpus + hard enforcement. Each is a valid,
  demoable state.

**Batchable:** A is immediately batchable (Tier-A on creation). B becomes batchable once A resolves; C once B
resolves. Run `/split 880` → approve → `/batch` to chain A then B then C.

## Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — the 13 pts are three real bodies of work, not a buried fork. The two open
   knobs are **bold-defaulted ratify-at-build micro-choices** (not a `type:decision` smell), settled inside
   slice A — no fork is scattered across children.
2. **≥2 nameable slices, real home** ✓ — three, each its own story.
3. **Slices land small** ✓ — 2 / 5 / 5, none an 8-lump; each `file:line`-grounded.
4. **Clean DAG** ✓ — acyclic; genuine incremental delivery (each slice ships a valid standalone state).
5. **No coherence loss** ✓ — the one hazard (a hard gate on an un-migrated corpus turning `check:standards`
   RED for everyone) is designed out by landing B warn-only and flipping to error inside C.

## Could not split

_None._ #880 is fully splittable.

---

# Focused run: `/split 751`

## Candidate

**#751 — Embedded theme / design-system creator (Plateau embed)** (`workItem: story`, `size: 13`,
`status: open`, `parent: 746`). Resized 5→13 this week and self-flagged "not batchable, needs a focused
session to slice." An unsliced oversized story whose parent (#746) is already an epic — so per the
parented-item edge case it is **not** converted to an epic; #751 stays a re-sized story for its core
slice and the rest land as **siblings under #746**.

## Work-investigation pass (real tree)

| Surface | Where | State |
|---|---|---|
| Plateau creator surface | `plateau-app/src` | **greenfield** — no theme/design-system creator exists; only `profiles/schema.ts` mentions "design-system" as a governance enum |
| Plateau domain-add pattern | `plateau-app/src/main.ts:14-44,218-229` (route + `mount*`) · `technical-configurator/provider.ts:24-51` (`DOMAINS[]` + `seedProvider`) | **proven** — Technical Configurator is the exact template to clone |
| localStorage + auth seam | `technical-configurator/configurator.ts:118,126` (localStorage) · `main.ts:53-83` (`authStore`, `requireAuth()` wired-but-disabled) | **ready** — persistence pattern + dormant auth seam both exist |
| #747 manifest shape | `design-systems/material-like.designsystem.json` · `src/_data/designSystems.json` · validator `scripts/check-standards-rules.mjs:717-771` · FUI type `frontierui/workbench/designSystems.ts:31-45` | **materialized** (#871 resolved) — `{ extends, themeTokens, intentDefaults?, traitDefaults? }`, validated |
| #749 switcher | `frontierui/workbench/designSystems.ts` + `workbench/mount.ts` | **shipped, FUI-resident**, consumes a **fixed FUI-owned preset gallery** in the manifest *shape*; same-origin, **no WE↔FUI channel** (#809) |
| Screenshot→tokens | `blocks/renderers/upgrader/analyzers/mockupAnalyzer.ts:36-66,143-209` | seam built, but produces **`ComponentIR`, not tokens** — screenshot→**tokens** is **not a built capability** and has no home |

**Key finding:** the creator *build* is buildable now (greenfield but on a proven plateau-app template,
with the manifest shape + validator already shipped). Two things are NOT clean: (a) the **cross-boundary
feed** — how a *Plateau*-authored (cross-origin iframe) manifest reaches the FUI-resident #749 switcher
(which today only serves its own fixed gallery, no WE↔FUI channel) is an **undecided fork**; (b)
**screenshot→theme** depends on a vision **token-extraction** capability that does not exist (#086/#382
extract component structure, not tokens).

## Could split — #751 → 1 decision + 4 build slices (+ 1 parked)

| Slice | workItem / size | Scope | Home |
|---|---|---|---|
| **#751 (kept, re-sized)** | story · **3** | The capstone embed: "Your theme" button on the FUI block page → embeds the Plateau creator (iframe) and feeds the authored manifest to the #749 switcher *per the transport decision*. Realizes #751's original acceptance. | webdocs / FUI block page |
| **A — transport decision** | `type:decision` | Decide the **Plateau-creator → FUI-switcher manifest transport**: cross-origin iframe feed convention **and** whether the #749 switcher should consume a *user-supplied* manifest at all vs its fixed gallery. Rhymes with #881 (WE→FUI chrome config) but is a distinct cross-origin, runtime-authored case. De-buries the fork from #751's body. | own `type:decision`, parent #746 |
| **B — creator domain scaffold** | story · **3** | New plateau-app domain (route + `mount*` + `seedProvider` entry, cloning Technical Configurator) — the authoring shell + the "sign in to persist/share" upsell CTA seam (auth store exists). Demo: navigate to the creator, see shell + upsell. | plateau-app |
| **C — manual authoring + localStorage** | story · **3** | Token picker + intent-defaults (density/motion/surface) + trait-defaults (radius/feel) → emit a **valid #747 manifest**, validate against the #871 shape, save/restore via localStorage, in-Plateau live preview. Demo: author → reload → persists → valid manifest. | plateau-app |
| **D — DTCG / Figma-file import adapter** | story · **3** | Free deterministic **local** parse of DTCG tokens + Figma variables-export **file** → #747 manifest (adapter-as-normalization-hub; free per #775 Fork 2-B). Demo: import a DTCG file → manifest populated. | plateau-app |
| **E — screenshot→theme (paid vision)** | story · **parked** | The paid vision path. **Could-not-build now:** needs a vision **token-extraction** capability (Plateau service per #475) that does not exist — #086/#382 extract `ComponentIR`, not tokens. Parked so the epic scope stays visible. | parked |

**Slice DAG:**

```
B (scaffold) ──▶ C (authoring) ──▶ D (import)
                     │
A (transport decision) ─┐
B, C ───────────────────┴──▶ #751 (embed capstone)

E (vision) — parked: blocked on a non-existent vision-token-extraction capability
```

- **B** is unblocked → batchable now (proven pattern, manifest shape shipped).
- **C** `blockedBy B`; **D** `blockedBy C` (incremental — each ships a valid in-Plateau demo).
- **#751** `blockedBy A, B, C` — needs the transport decided + a creator to embed + a manifest to feed.
- **A** is a `type:decision` (resolve via `/decision` or `/prepare`, not a batch build).
- **E** parked (capability foundation absent).

**Batchable:** B now; C after B; D after C; #751 after A + B + C. Run `/split 751` → approve →
`/batch` the plateau-app chain (B→C→D), decide A in parallel, then build #751.

## Rubric check

1. **Volume, not uncertainty** ✓ *(after carving A out)* — the buried cross-boundary fork is **extracted
   into its own `type:decision` (A)** and only gates the embed slice; B/C/D are pure build volume on a
   proven template. Leaving the fork in #751's body would have been the failure — fixed per
   *misflagged-batchable → fix real state*.
2. **≥2 nameable slices, real home** ✓ — four build slices, two homes (plateau-app · FUI block page).
3. **Slices land small** ✓ — #751/B/C/D all `≤3`; each `file:line`-grounded. (E is parked, not a ready slice.)
4. **Clean DAG** ✓ — acyclic; genuine incremental delivery; each build slice ships a valid standalone demo.
5. **No coherence loss** ✓ — slices are genuinely separable (Plateau creator vs FUI block-page embed are
   different repos/origins); the embed capstone re-integrates them.

## Could not split

| Piece | Failed condition | Unblocking action |
|---|---|---|
| **E — screenshot→theme** | (1) foundation absent — no vision **token-extraction** capability (the #086/#382 pipeline yields `ComponentIR`, not tokens) | Land a vision token-extraction capability (a Plateau service per #475, no-leakage client seam) first; then E becomes a buildable paid slice. Parked in the meantime. |

---

# Focused run: `/slice 736`

## Candidate

**#736 — temporal block impl — variant traits + build-chunk assertion (re-slice)** (`workItem: story`,
`size: 13`, `status: open`, `parent: 315`, `locus: frontierui`, `blockedBy: [359, 735]`). Both blockers
**resolved** (→ WE `blocks.json` contracts). The two forks that previously held it back are settled:
ownership (#779 → **FUI-locus end-to-end**, resolved 2026-06-17) and scope (#713 → option C, one abstract
core + named shallow presets, resolved). What remains is **pure impl volume**: author the three variant
trait modules + wire the presets + the build-chunk dogfood. #736 already has a parent (#315), so per the
parented-item edge case it stays a **re-sized story for its core slice** and the rest land as **siblings
under #315** — no epic conversion.

## Work-investigation pass (real tree, frontierui repo)

| Surface | Where | State |
|---|---|---|
| Trait module pattern | `frontierui/blocks/traits/Sortable.ts` (+ `Highlight`/`Polling`/`Revealable`) | **proven** — `CustomAttribute` mixin w/ `activationSurface`, `connectedCallback`, activate/deactivate lifecycle; the exact shape each variant trait clones |
| The Map (runtime) | `frontierui/plugs/webbehaviors/traitManifest.ts` (`registerTraits`, lazy/eager/preload entries) · `plugs/bootstrap.ts:218` | **shipped** — `attribute → trait` table, `defineLazy` per entry; manifest is enforcer-generated (`virtual:trait-manifest`) |
| The Enforcer (build) | `frontierui/tools/trait-enforcer/vite-plugin.ts` (scan + codegen, pure fns) · `__tests__/trait-enforcer.test.ts` | **shipped** — scans template usage, code-splits a chunk per trait; wired via `traitEnforcer({ traitMap })` |
| Temporal impl dir | `frontierui/blocks/temporal/` | **greenfield** — does not exist yet; slices create `blocks/temporal/traits/*` |
| Family contracts | WE `src/_data/blocks.json` — `temporal` core + 4 presets (`date-picker`, `time-picker`, `datetime-picker`, `date-range-picker`) `:4443-4571` | **shipped** (#359/#735) — each preset's presentation×granularity pin + trait bindings are spec'd |
| Chunk-isolation test precedent | `tools/trait-enforcer/__tests__` (unit) + `plugs/__tests__/e2e/preload-traits.spec.ts` (dev Playwright) | exists at unit/dev level; the **#713 production-build "time-only fixture pulls no calendar chunk" dogfood** is new |

**Trait→preset binding map (from the contracts):** `calendar-grid` → date-picker, datetime-picker,
date-range-picker · `clock` → time-picker, datetime-picker · `range-coordination` → date-range-picker.
Locale parse/format + keyboard roving are **composed from other intents** (Locale Intent, Focus
Delegation) per the core contract — **not** new traits authored here, so out of #736's scope (no slice for
them).

## Could split — #736 → 4 slices (1 kept + 3 siblings under #315)

| Slice | workItem / size | Scope | Home |
|---|---|---|---|
| **#736 (kept, re-sized)** | story · **3** | **`calendar-grid` trait + date-picker preset.** Author `blocks/temporal/traits/CalendarGrid.ts` (`CustomAttribute`: render a `role=grid` calendar surface over `<input type=date>`), add to the enforcer `traitMap`, wire a date-picker fixture/demo that binds `calendar-grid` (lazy-loads on appearance). Demo: date-picker shows the grid; chunk fetched on first appearance. | frontierui |
| **A — `clock` trait + time-picker preset** | story · **3** | Author `blocks/temporal/traits/Clock.ts` (spatial clock surface over `<input type=time>`), add to `traitMap`, time-picker fixture binds `clock`. Independent of calendar-grid. Demo: time-picker shows the clock, lazy-loaded. | frontierui |
| **B — `range-coordination` trait + date-range-picker preset** | story · **3** | Author `blocks/temporal/traits/RangeCoordination.ts` (start ≤ end ordering across two bound `<input type=date>` anchors, reported as a pair), date-range-picker fixture binds `calendar-grid` + `range-coordination`. Demo: range stays ordered; both chunks present. | frontierui |
| **C — datetime-picker preset + #713 build-chunk dogfood** | story · **3** | Wire the datetime-picker preset (composes `calendar-grid` + `clock` over `<input type=datetime-local>`), then author the **production-build** assertion: a **time-only fixture pulls no calendar chunk** (and a date-only fixture pulls no clock chunk). Capstone proving per-preset trait isolation. Demo: green chunk-isolation test on a real build. | frontierui |

**Slice DAG (A/#736 parallel roots; incremental):**

```
#736 (calendar-grid + date-picker) ──┬──▶ B (range-coordination: date-range-picker binds calendar-grid)
                                      └──▶ C (datetime-picker composes calendar-grid + clock; build-chunk test)
A (clock + time-picker) ───────────────────▶ C
```

- **#736** and **A** are **independent roots** — calendar-grid and clock traits share no code; batch in parallel.
- **B** `blockedBy #736` — the date-range-picker preset binds `calendar-grid`, so the grid must exist first.
- **C** `blockedBy #736, A` — datetime-picker composes both surfaces, and the "time-only pulls no calendar
  chunk" assertion needs both chunks to exist to prove isolation.
- Genuine incremental delivery: each of #736/A/B ships a working, lazily-loaded picker preset; C adds the
  composed preset + the dogfood gate. Every slice leaves a valid demoable state.

**Batchable:** #736 and A immediately (both unblocked roots); B after #736; C after #736 + A. Run
`/slice 736` → approve → `/batch` the FUI chain.

## Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — the 13 pts are 3 independent trait authorings + preset wiring + a
   build assertion. Both forks (ownership #779, scope #713) are **already resolved** — none buried in a
   child.
2. **≥2 nameable slices, real home** ✓ — four, all home = `frontierui/blocks/temporal/traits/` +
   `tools/trait-enforcer`.
3. **Slices land small** ✓ — 3 / 3 / 3 / 3 (≈ the original 13), each `file:line`-grounded against the
   existing `traits` family + enforcer.
4. **Clean DAG** ✓ — acyclic; two parallel roots, two incremental dependents; each ships a valid demo.
5. **No coherence loss** ✓ — the traits are genuinely separable (distinct surfaces, distinct native
   anchors); C re-integrates them and proves the isolation the family's whole "scale without weight"
   premise rests on.

## Could not split

_None._ #736 is fully splittable now that #779 + #713 are resolved.
