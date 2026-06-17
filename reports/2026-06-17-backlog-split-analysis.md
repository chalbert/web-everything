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
