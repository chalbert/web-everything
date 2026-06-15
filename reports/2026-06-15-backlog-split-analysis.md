# Backlog split analysis — focused re-run of `/slice 646` (post-#652 ratification)

**Date:** 2026-06-15
**Scope:** Focused run, `/slice 646`. Re-runs the #646 row of
[2026-06-14-backlog-split-analysis.md](2026-06-14-backlog-split-analysis.md) (run 6), which deferred the
slice pending the shape decision **#652** — now **resolved 2026-06-15** (Fork 1: plain-markup ejectable
payload, CEM descriptor + `registry-item` wrapper as coexisting exports; Fork 2: standalone devtools
surface reading the shared `workbench*` vocabulary + a WE-owned preset registry in the shadcn
`registry-item` shape; served tool surface → plateau-app per #091). The gate is cleared, so the epic is
now decomposable.

## Work-investigation pass (what's on disk today)

| Piece | State | Evidence |
|---|---|---|
| Composed primitives (preset #1) | **EXISTS, ratified** | nav-list [blocks.json:2082](../src/_data/blocks.json#L2082) · disclosure [intents.json:1868](../src/_data/intents.json#L1868) · anchor `strategy=escape` [intents.json:1256](../src/_data/intents.json#L1256) · hover-intent [intents.json:2671](../src/_data/intents.json#L2671) |
| Reveal-nav recipe (the payload to eject) | **EXISTS, live dogfood** | markup [base.njk:32-69](../src/_layouts/base.njk#L32) + hover-intent CSS wiring [style.css:241-276](../src/css/style.css#L241) — "a page you could have hand-written" |
| Shared `workbench*` vocabulary (read-only input) | **EXISTS** | [workbenchFeatures.json](../src/_data/workbenchFeatures.json) (271 ln) · [workbenchTools.json](../src/_data/workbenchTools.json) (73 ln) |
| Auto-render surface pattern (`/protocols/`, `/intents/`) | **EXISTS, copyable** | [src/protocols.njk](../src/protocols.njk) · [src/intents.njk](../src/intents.njk) (page + nav + validator pattern) |
| WE-owned preset registry (`registry-item` shape) | **GREENFIELD** | no `presets.json`/`assemblerPresets.json`; only research refs in [researchTopics.json:1910](../src/_data/researchTopics.json#L1910) |
| CEM protocol (optional descriptor export target) | **GREENFIELD, pending #653** | not in [protocols.json](../src/_data/protocols.json); registration tracked by #653 |
| Interactive "build-your-own-component" workbench UI | **GREENFIELD, cross-locus** | no composition-builder surface; served surface → plateau-app per #091 |
| Additional-preset primitives | **MIXED** | command-palette / filter / hovercard / toolbar appear in intents/blocks (unverified depth); **date-range / date-picker: NONE** (no intent yet) |

## Could split

The epic is already an `epic` (no `story→epic` conversion; no residual `size` to drop). Two
agent-ready, demoable slices fall out cleanly; the DAG is A → B.

| Slice | type / workItem / size | blockedBy | Files / seam (file:line-citable) | Demoable state |
|---|---|---|---|---|
| **A — Preset registry standard + `/presets/` surface + reveal-nav preset #1** | issue · **story** · **3** | — (#652 ✓) | NEW `src/_data/assemblerPresets.json` in the decided `registry-item` shape `{name, type, composesBlocks/Intents, files:[{path,content}]}`, reveal-nav as entry #1 with `files[].content` = the plain payload from [base.njk:32-69](../src/_layouts/base.njk#L32) + [style.css:241-276](../src/css/style.css#L241); NEW `src/presets.njk` copying the [protocols.njk](../src/protocols.njk) pattern + nav entry in [base.njk](../src/_layouts/base.njk); a `check:standards` validator for the new registry | `/presets/` renders the reveal-nav recipe; payload round-trips into the live header (it *is* the header) |
| **B — Optional per-preset CEM descriptor export** | issue · **task** · — | **A, #653** | Emit a CEM entry describing each preset's composed meta-component **API surface** (riding #653's CEM protocol, never re-minting it); extends the registry from A with an optional `cem` field/export | A preset additionally exposes a valid CEM descriptor; reveal-nav's descriptor renders alongside its recipe |

Both are batchable once unblocked (story·3 and task). Slice A delivers standalone value (the ejectable
recipe *is* the standard, no tool required); B is independent optional polish gated on the CEM protocol.

## Could not split (yet) — tracked, with the unblocking action

| Item | Which condition failed | Unblocking action |
|---|---|---|
| **The interactive assembler workbench (the "tool")** | **(3) re-estimates > 3** + cross-locus + greenfield. It is the *deferred build* #646/#609 name explicitly ("the recipe it emits is the standard, the tool a deferred build"); its served home is **plateau-app** (#091), and its size is unknown until Slice A's registry standard exists to build against. | File as a single **plateau-app story** child, `blockedBy: A`; **re-run `/slice`** on it later *in plateau-app context*, after A lands. (Filed below as slice C so the DAG/tracking is honest — not a batchable same-pass slice.) |
| **Additional preset recipes** (command palette, filter bar, hovercard, toolbar, date-range) | **(3) named files not yet citable / possible buried fork.** Each preset's exact composition (which primitives, what wiring) is unproven without a dogfood like reveal-nav's; the epic itself defers these to **batch-time volume** once the foundational slice exists. **date-range/date-picker has no primitive at all.** | After Slice A establishes the pattern + surface, author **one `task` per preset** whose primitives are verified-ratified. **Mint a date primitive (intent) before the date-range preset.** Do *not* scaffold from the body now. |

## Recommended mutation

Scaffold under #646 (already an epic):

- **A** — `--type=issue --workitem=story --size=3 --parent=646` — preset registry + `/presets/` surface + reveal-nav preset #1.
- **B** — `--type=issue --workitem=task --parent=646 --blocked-by=646A,653` (i.e. blocked-by the new A's NNN + #653) — optional CEM descriptor export.
- **C** — `--type=issue --workitem=story --size=8 --parent=646 --blocked-by=<A>` with `locus: plateau-app` — the deferred interactive workbench tool; re-slice later in plateau-app context.

Net flow on approval: **+3** (A, B, C), #646 stays an open epic. Then `/batch` A (and B once #653 lands);
batch the additional presets after A, one task each.

---

# Backlog split analysis — focused `/slice 666` (Self-Driven Project epic)

**Date:** 2026-06-15
**Scope:** Focused run, `/slice 666`. #666 is an **unsliced epic** (`workItem: epic`, `size: 13`, no
child references it). Its framing was **ratified 2026-06-15 via [#665](../backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas.md)**
(autonomy scale, value/risk-ODD dimension registry, the artefact contract as a Protocol, the
master-brand direction — all as *provisional defaults under a revision protocol*, A1–A6). The epic body
seeds five candidate slices **A–E**; per the skill those are a *seed*, not the answer — each is verified
against the real tree below before being drawn.

## Work-investigation pass (what's on disk today)

| Surface a slice would need | State | Evidence (file:line) |
|---|---|---|
| Research-topic home (step-tree doc) | **EXISTS** | registry [researchTopics.json:1933](../src/_data/researchTopics.json#L1933) (`self-driven-project` entry) · renderer [research-topic-pages.njk](../src/research-topic-pages.njk) · per-topic include [self-driven-project.njk](../src/_includes/research-descriptions/self-driven-project.njk) |
| Protocol registry + `/protocols/` surface | **EXISTS, copyable** | [protocols.json:1](../src/_data/protocols.json#L1) (concept entries, `{id,name,summary,status,ownedByProject,realizesIntent,anchor}`) · [src/protocols.njk](../src/protocols.njk) |
| Ground-truth gate (the conformance state) | **EXISTS** | 3-state matrix [capabilityMatrix.json:1](../src/_data/capabilityMatrix.json#L1) (`native-ok`/`polyfill-ok`/`capability-hard`) |
| Gate-severity enum + persona views (control-plane substrate) | **EXISTS, in plateau-app** | `GateType` advisory/validating/blocking/escalating [plateau-app profiles/schema.ts:60](../../plateau-app/src/profiles/schema.ts#L60) · `Profile` [schema.ts:128](../../plateau-app/src/profiles/schema.ts#L128) · enforcement [gate-enforcement.ts:1](../../plateau-app/src/profiles/gate-enforcement.ts#L1) · page [profiles-page.ts](../../plateau-app/src/profiles/profiles-page.ts) |
| Non-technical "trip planner" / escalation-inbox shell | **GREENFIELD** | no goal-planner or escalation-inbox page in plateau-app; profiles/platform-manager surfaces exist to host one |
| Tool-agnostic artefact-contract Protocol entry | **GREENFIELD** | not in [protocols.json](../src/_data/protocols.json); #665 invariant says it *is* a Protocol, white-space per prior-art §7.4 |
| Methodology home for the developer-role thesis | **EXISTS** | [#563](../backlog/563-ai-driven-agile-methodology-as-a-shareable-approach.md) (the shareable methodology this thesis belongs in) |
| Public approach page + "Project"-overload context | **PARKED / EXISTS** | #143 approach page is parked; project names live in [projects.json:1](../src/_data/projects.json#L1) (39 `web*` entries; "Self-Driven Project" is **not** one — it's a mode, not a standards Project) |

## Could split

The epic is already an `epic` (no `story→epic` conversion). Three agent-ready, demoable slices fall out
cleanly; all three are independent roots (no inter-slice blockers). The control-plane (B) and brand (E)
candidates do **not** slice cleanly yet — see *Could not split*.

| Slice | type / workItem / size | blockedBy | Files / seam (file:line-citable) | Demoable state |
|---|---|---|---|---|
| **A — Step-tree artifact** (every SDLC step × automatable data-driven gate × ceiling autonomy level) | idea · **story** · **3** | — | Author the full step-tree (seed: epic body §A table) as the body of the existing research topic — extend [self-driven-project.njk](../src/_includes/research-descriptions/self-driven-project.njk) (or a sibling `self-driven-step-tree.njk` + [researchTopics.json](../src/_data/researchTopics.json) entry); each row = outcome property · data-driven gate · automatable-today bucket · ceiling level, against #665's ratified scale | `/research/…` renders the complete step-tree table |
| **D — Artefact-contract Protocol** (the no-lock-in foundation) | idea · **story** · **3** | — | NEW entry in [protocols.json](../src/_data/protocols.json) (`id: self-driven-artefact`, `status: concept`, `ownedByProject`, citing GitOps/OSCAL/SPDX + the work-tracker white space §7.4) + a first-cut spec report defining the declarative artefact shape (goal · tolerance/ODD · per-step gate defs · dimension-registry ref · run evidence) a foreign PM tool could drive | `/protocols/` lists the artefact-contract Protocol; spec report defines its shape |
| **C — Developer-role thesis note** | idea · **task** · 1 | — | Author the developer-role inversion (planner/validator/L3-operator/gate-author; *value concentrates in gate authoring*) as a positioning section in [#563](../backlog/563-ai-driven-agile-methodology-as-a-shareable-approach.md) — its named home per the epic body §C | #563 carries the thesis section |

DAG: **A**, **D**, **C** are all independent roots (≥2 independent — rubric (4) ✓). Re-estimates: A=3,
D=3, C=1 (all ≤3 / task — rubric (3) ✓). Each leaves a demoable state (rubric (5) ✓). No slice buries a
fork — #665 ratified the scale, dimension model, and Protocol classification; A/D author against those
provisional defaults and log any friction back to #665's A1–A6 register (the epic's standing
instruction). Naming/brand is *not* drawn into A/D/C (it's deferred — see E).

## Could not split (yet) — tracked, with the unblocking action

| Candidate | Which condition failed | Unblocking action |
|---|---|---|
| **B — Non-technical control plane** (trip-planner + jargon-translated dashboard + escalation inbox, in plateau-app) | **(3) re-estimates > 3 + scope unknown until D lands.** It's a product surface that *reads the artefact contract*; its exact shape isn't investigable until D defines the artefacts. The epic body itself flags it as "own slice/epic, or a cross-cutting requirement … plus one lean shell slice". Drawing it now would manufacture fake-ready work. | **Land D first**, then `/slice` B *in plateau-app context* — carve a single lean dashboard/escalation-inbox **shell** story (`blockedBy: D`, `locus: plateau-app`, #091 layering) plus a cross-cutting "every step in A projects a plain-language gate" requirement. Filed below as a tracking child so the DAG is honest — not a same-pass batchable slice. |
| **E — Brand / positioning rollout** (exact public name, #563 rename, "Project" overload, publish framing) | **(1) the slice's core is an unresolved—deliberately deferred—fork.** #665 ruled the brand *direction* firm but **deferred** the name / #563-rename / overload under its revision protocol (A4/A5), triggered by *first-SaaS-surface friction*. You can't split away a fork. | **No new card** — the fork is already tracked as #665 A4/A5 (deferral governs *when* you ratify, not *whether* it's tracked). It re-enters #665 when B surfaces naming friction. The publishable residual ("publish the value/risk-ODD framing") is already carried by A + D's public artefacts; the #143 approach page stays parked. |

## Recommended mutation

Scaffold under #666 (already an epic; drop nothing — it keeps `status: open`). **#665's A1–A6 friction
register is the standing close-out hook for every slice.**

- **A** — `--type=idea --workitem=story --size=3 --parent=666` — the step-tree artifact.
- **D** — `--type=idea --workitem=story --size=3 --parent=666` — the artefact-contract Protocol.
- **C** — `--type=idea --workitem=task --parent=666` — the developer-role thesis note into #563.
- **B (tracking child)** — `--type=idea --workitem=story --size=8 --parent=666 --blocked-by=<D>` with
  `locus: plateau-app` — the deferred control plane; re-slice later in plateau-app context.

Net flow on approval: **+4** (A, D, C, B-tracking), #666 stays an open epic, `size` dropped (children
carry the points). Then `/batch` A + D + C (all unblocked, ≤3); B opens blocked on D; E stays held in
#665.

---

# Focused re-run of `/split 619` (graduatedTo narrative→body cleanup)

**Scope:** Focused run, `/split 619`. The item self-documents a 2-tranche split in its body; this run
verifies that against the real tree and the tool, then proposes batchable slices.

## Candidate

**#619 — graduatedTo narrative→body cleanup** (`workItem: story`, `size: 13`, `status: open`).
Follow-on to #614/#607. The job: for every resolved item whose `graduatedTo` is prose/narrative/
irregular, derive the true entity, write the canonical leading token (`kind:id`, repo-path, or `none`),
and relocate the narrative into the item body — so entity-graph joins + the G3 lineage walk read it
reliably.

### Work-investigation pass (read before slicing)

Ran `node scripts/normalize-graduated.mjs --json` and read [scripts/normalize-graduated.mjs](../scripts/normalize-graduated.mjs)
to learn what the tool decides vs. what needs a human. Live bucket counts (today, not the body's stale ~74/99):

| bucket | count | nature |
|---|---|---|
| `none` / `typed` / `path` | 376 | already canonical — untouched |
| `fix-bare` | 2 | tool auto-fixes on `--write` (not manual) |
| `review-prose` | 55 | narrative-bearing; **19 carry a tool-precomputed `canonical`** |
| `review-unresolved` | 56 | bare slug / prose the tool can't resolve |

So **~111 values need manual handling** (55 + 56), + 2 the tool auto-fixes. Each value lives in a
*separate backlog file*, so every fix is fully independent (no shared file, no shared state) and
`check:standards` surfaces the remaining count via one aggregated warning — i.e. **any partial
completion is a valid, demoable state**. Homogeneous, embarrassingly-parallel per-item archaeology —
the size is pure volume, not a buried decision.

**Caveat found during investigation (raises the per-item bar, not a blocker):** the tool's precomputed
`canonical` takes the *leading* token, which is wrong where the real entity sits in a parenthetical —
e.g. #459 `webintents (intents.json#system-notification)` graduated to `intent:system-notification`,
**not** `project:webintents`. So even the "mechanical" tranche is *pick-the-in-value-candidate*, not
blind-apply — low-judgment (the candidate is present in the value) but not scriptable. No slice is
"run the tool and walk away."

The working-set groupings below are **heuristic** (regex over the value, to bound each agent's context —
which repo/registry to load); the *authoritative* assignment is the explicit item-ID list per slice.
Each executing agent re-derives the true `graduatedTo` per item regardless of which group it landed in.

## Could split — #619

Verdict: **all five rubric conditions hold.** Convert #619 in place to a storied epic (drop `size: 13`)
and scaffold **7 sibling slices**, each a `task` (a chunk of one cleanup — no standalone deliverable
value), each re-estimated `size ≤ 3`, each named by an exact item-ID set.

| slice | what | items | size |
|---|---|---|---|
| **S1** | Mechanical tranche — apply tool `--write` (2 `fix-bare`); for the 19 precomputed-`canonical` review-prose, set the in-value canonical token (lead **or** parenthetical) + relocate narrative; parse the 4 `{url,label}` object-form urls → `kind:id` | `--write` auto-2 · #177 #322 #426 #459 #460 #461 #462 #468 #471 #472 #473 #474 #570 #618 #632 #653 #654 #655 #656 · #146 #147 #212 #214 | 3 |
| **S2** | webeverything-local archaeology (A) — bare concept slugs + in-repo registry/source refs against `src/_data/*.json` + source tree; **#67 is a folded-YAML block scalar** (`graduatedTo: >`) — read raw frontmatter | #2 #65 #67 #69 #81 #113 #115 #139 #148 #158 #159 #204 #206 #216 #218 #224 #227 #242 | 3 |
| **S3** | webeverything-local archaeology (B) — second half, same method | #243 #257 #301 #304 #316 #337 #346 #347 #366 #386 #392 #404 #505 #566 #575 #599 #662 | 3 |
| **S4** | backlog-lineage resolution — `graduatedTo` points at other backlog items / id-splits / `→ #NNN`; resolve by reading the cited `backlog/*.md`. Incl. corrupt bare-numbers (#25→`203`, #203→`204`, #498→`500`, #562→`575,576,577`) | #25 #28 #85 #102 #114 #203 #225 #259 #348 #349 #370 #387 #415 #463 #498 #562 #636 #665 | 3 |
| **S5** | frontierui cross-repo verification (A) — verify paths/entities against the **frontierui** repo | #34 #88 #116 #125 #133 #136 #137 #138 #145 #155 #163 #193 #200 | 3 |
| **S6** | frontierui cross-repo verification (B) — second half, same repo context | #201 #202 #209 #223 #226 #231 #361 #390 #542 #580 #606 #641 | 3 |
| **S7** | plateau cross-repo verification — verify against the **plateau-app** repo | #29 #101 #156 #160 #168 #339 #502 #594 #598 #633 | 2 |

Coverage: 23 + 17 + 17 + 18 + 13 + 12 + 10 = **111** values (+ 2 tool-auto in S1). No item appears twice.

### Slice DAG

**Fully parallel — no edges.** Each slice partitions a disjoint set of item files; no two touch the same
file, none depends on another's output. `blockedBy: []` for all 7 — the strongest form of rubric (4)
(7 independent slices, not a chain), ideal for `/batch` to chain back-to-back.

```
S1  S2  S3  S4  S5  S6  S7      (all independent; pick any order)
```

### Rubric check

1. **Volume not a decision** ✅ — the "narrative→body, leave canonical token" rule is decided (#607/#614).
   111 items is pure volume; no fork to split away.
2. **≥2 nameable slices with a real home** ✅ — 7, each homed on a concrete context (this repo's
   registries / cited backlog items / frontierui repo / plateau-app repo) + an explicit item set.
3. **Each ≤ size 3 / batchable** ✅ — the two oversized context buckets (we-local 34, frontierui 25)
   are count-halved with explicit ID lists (no silent truncation); each slice lands ≤3 with named items.
4. **Acyclic DAG with real independence** ✅ — fully parallel, disjoint file sets.
5. **Every slice leaves a valid demoable state** ✅ — fixes are per-file independent; the aggregated
   `check:standards` warning count just decrements; the gate stays green throughout.

## Could not split — #619

None. The candidate splits cleanly.

## Recommended mutation — #619

Convert #619 in place: `workItem: story → epic`, **drop `size: 13`**, refresh digest to umbrella framing,
keep `status: open`, keep `NNN`. Then scaffold 7 tasks under it:

- **S1** `--type=issue --workitem=task --parent=619` — mechanical canonical + object-form tranche.
- **S2** `--type=issue --workitem=task --parent=619` — we-local archaeology A.
- **S3** `--type=issue --workitem=task --parent=619` — we-local archaeology B.
- **S4** `--type=issue --workitem=task --parent=619` — backlog-lineage resolution.
- **S5** `--type=issue --workitem=task --parent=619` — frontierui cross-repo A.
- **S6** `--type=issue --workitem=task --parent=619` — frontierui cross-repo B.
- **S7** `--type=issue --workitem=task --parent=619` — plateau cross-repo.

Net flow on approval: **+7**, #619 → open storied epic (`size` dropped). All 7 unblocked → `/batch` them
in any order.

## Note on granularity

7 slices for one cleanup tests the conservative instinct ("don't fragment a coherent deliverable"). It's
justified: the pieces **don't only make sense together** — each item's fix is standalone, partial
completion is a valid gated state, and the explicit goal of `/split` is to manufacture `/batch`-able work
from a story `/batch` refuses (`size 13`). Fragmentation cost (review overhead) is low; the gain (7
batchable tasks) is the point.

---

# Focused re-run of `/slice 669` (interactive build-your-own-component assembler workbench)

`size 13`, `workItem: story`, `parent: 646`, `locus: plateau-app`, tagged `needs-slice`. The card carries
an explicit **re-slice trigger** (2026-06-15): its named precondition — **#667 resolved** (the preset
registry standard) — has landed, so the deferred served tool can now be drawn against a real registry.

## Work-investigation pass (what's on disk today)

The forks are already settled, so this is volume, not an unresolved decision:

- **Emit format + home settled by [#652](../backlog/652-assembler-emit-format-its-relationship-to-the-623-626-workbe.md) (ratified).**
  Fork 1 = plain-markup `registry-item` payload; Fork 2 = standalone devtools surface reading the preset
  registry read-only; served home → plateau-app (#091).
- **Registry standard landed by [#667](../backlog/667-preset-registry-standard-presets-surface-reveal-nav-preset-1.md) (resolved).**
  [src/_data/assemblerPresets.json](../src/_data/assemblerPresets.json) (shadcn `registry-item` shape:
  `{name, type, composesBlocks/Intents, files:[{path,content}]}`, reveal-nav preset #1, status `active`),
  the static [src/presets.njk](../src/presets.njk) catalog render, and the
  [`validatePreset`](../scripts/check-standards-rules.mjs#L474) gate (required fields, ref-resolution into
  blocks/intents/projects, non-empty `files[].content`).
- **plateau-app served-tool pattern is proven and reusable.** A served interactive tool = a
  `src/<tool>/` dir with a `mountXxx(mount)` + full-re-render shell + `.css`, registered in
  [src/main.ts](../../plateau-app/src/main.ts) and given a nav link + `route` template in
  [index.html](../../plateau-app/index.html). The decisive precedent:
  [intent-configurator/configurator.ts:18](../../plateau-app/src/intent-configurator/configurator.ts#L18)
  **already imports WE `_data` cross-locus** (`import intentsData from '../../../webeverything/src/_data/intents.json'`)
  — the exact mechanism this workbench uses to read `assemblerPresets.json` / `blocks.json` / `intents.json`.
  No `src/component-assembler/` exists yet → greenfield, as the card says.
- **Canvas interaction UX is not a fork.** "How you pick/wire primitives in the UI" is tool-design /
  POC-mode latitude, not a standards decision — #652 already fixed the *format* and the *home*. So no
  buried fork survives into the slices ([[feedback_intent_ux_only_technical_to_configurator]],
  [[feedback_poc_mode_pragmatism]]).

## Could split — #669 ✅

The card names the seam itself ("read-only surface … then wire/compose authoring … then registry-item
eject"); the investigation confirms it against the tree. Three slices, all in plateau-app
`src/component-assembler/`:

| Slice | workItem / size | What it is | Named surface |
|---|---|---|---|
| **A (= re-scoped #669)** | story · 3 | **Read-only interactive assembler surface** — clone the intent-configurator shell; list presets from `assemblerPresets.json` (cross-locus import) and render each `files[].content` **live** + show the recipe | new `src/component-assembler/assembler.ts` + `.css`; `mountComponentAssembler` in `src/main.ts`; nav link + `route` template in `index.html` |
| **B** | story · 3 | **Authoring canvas — pick + wire primitives into a live composition** — a primitive palette read from `blocks.json` + `intents.json` (same import pattern); select + assemble into composed markup with live preview | extends `src/component-assembler/assembler.ts` (palette + canvas) |
| **C** | task | **Eject the `registry-item` recipe** — serialize the live composition → the shadcn shape `validatePreset` enforces, with copy/download (output-panel pattern) | extends `src/component-assembler/assembler.ts` (eject panel) |

**DAG:** `A → B → C` (chain). Rigid order, but **incremental delivery holds** — each slice leaves
standalone demoable value: A = a served preset gallery with live preview; B = working build-your-own
authoring; C = the ejectable recipe. No half-a-protocol intermediate.

**Rubric:** (1) volume not decision — forks settled (#652), registry landed (#667), canvas UX is POC
latitude ✅ · (2) 3 nameable slices, real home (plateau-app) ✅ · (3) each ≤ 3 / `task`, files citable ✅
· (4) acyclic, incremental delivery ✅ · (5) every slice demoable (A renders reveal-nav live; B composes;
C ejects a valid payload) ✅.

## Could not split — #669

None at the top level. **Watch-item:** slice **B** is the boundary case — if "pick + wire + live preview"
re-estimates above `size 3` once building in plateau-app context, sub-slice it into **B1 palette+select**
(task) and **B2 compose+live-preview** (task). That is a future re-estimate inside the slice, not a
blocker now, and not a missing decision.

## Recommended mutation — #669

#669 **already has `parent: 646`**, so per the split edge-case it is **not** converted to a nested epic.
Instead:

- **Re-scope #669 in place** → keep `workItem: story`, set `size: 3`, drop the `needs-slice` tag, refresh
  the digest to **slice A** (read-only interactive assembler surface), keep `parent: 646`,
  `blockedBy: []` (its precondition #667 is resolved).
- **Scaffold B** as a sibling under #646: `--workitem=story --size=3 --parent=646 --blocked-by=669`.
- **Scaffold C** as a sibling under #646: `--workitem=task --parent=646 --blocked-by=<B's NNN>`.

Net flow on approval: **+2** (B, C); #669 re-scoped `story·13 → story·3` (now batchable). A is immediately
batchable; B unblocks on A, C on B → `/batch` walks the chain.

### Executed (2026-06-15)

Approved and applied. #669 re-scoped in place → slice A (`story·3`, `needs-slice` dropped). Scaffolded
**[#688](../backlog/688-assembler-authoring-canvas-pick-wire-primitives-into-a-live-.md)** (slice B,
story·3, `parent: 646`, `blockedBy: 669`) and
**[#689](../backlog/689-eject-the-registry-item-recipe-from-the-assembler-compositio.md)** (slice C,
task, `parent: 646`, `blockedBy: 688`). Net flow **+2**. `check:standards` green.

---

# Focused `/split 379` (loan-app S1 — identity, roles & field/action/state permissions)

## Candidate

**#379** — *Phase S1 — identity, roles & field/action/state permission model*
(`workItem: story`, `size: 13`, `parent: 317`).

## Work-investigation pass (read before slicing)

| Piece | State | Evidence |
|---|---|---|
| web-identity intent (auth-state signal + identity descriptor) | **EXISTS, live** | [intents.json:2500](../src/_data/intents.json#L2500) — its own copy names **#379 as a near-term consumer** |
| Guard protocol + access-control member (#178) | **EXISTS, live** | [protocols.json:118](../src/_data/protocols.json#L118) — `hide\|redirect\|forbid\|cloak` deny family; render-or-hide / edit-readonly / action gate machinery |
| App lifecycle, **role-scoped transitions** (S2 #380) | **EXISTS, resolved** | [lifecycle.ts:25-37](../demos/loan-origination/domain/lifecycle.ts#L25) — each edge has an `actor` |
| Signed-in user (identity source) | **PLACEHOLDER** | [app.ts:95](../demos/loan-origination/app.ts#L95) hardcodes `ACTOR = { role: 'underwriter' }` |
| Any role / permission / auth / identity domain file | **GREENFIELD** | no `*role*`/`*perm*`/`*auth*` file in `demos/loan-origination/` |
| 5k seeded apps spread across lifecycle states | **EXISTS** | S0 #378 (resolved) — gives S1b real states to gate against |

**The size-13 framing (re-sized 5→13 on 2026-06-14) is stale.** Its rationale was that #379 must *stand
up* two **unbuilt** WE projects (webpermissions #009, webidentity #012). Both have since shipped: the
web-identity thin intent (#012/#482), the `permission` browser-API intent (#009/#457, a *different*
concern — Permissions-API state, not app RBAC), and the Guard protocol (#272/#178). #379 is therefore
**no longer cross-project standard-building — it is pure app-side consumption** of two shipping surfaces.
The remaining volume cleaves along exactly those two surfaces, which is also the constellation's own
factoring (*identity produces an auth-state signal; Guard consumes it as a predicate* — webidentity
Fork 3 / Guard #272). The seam is architectural, not arbitrary.

## Could split — #379 ✅

| Slice | type / workItem / size | Consumes | blockedBy | Seam (file-citable) | Demoable state |
|---|---|---|---|---|---|
| **S1a — Identity & roles + auth-state signal** | idea · **story** · **3** | web-identity intent | — (#378 ✓, #380 ✓) | NEW `demos/loan-origination/domain/identity.ts` (user account + role set + auth-state signal in the [intents.json:2500](../src/_data/intents.json#L2500) shape); replace the `ACTOR` placeholder at [app.ts:95](../demos/loan-origination/app.ts#L95); add a demo **role-switcher**; point the lifecycle `actor` check at the signal | Switch acting role → chrome shows who you're signed in as; available lifecycle moves change to match the role (vs. the fixed underwriter today) |
| **S1b — Field/action/state permission predicates** | idea · **task** · — | Guard protocol | **S1a** | NEW `demos/loan-origination/domain/permissions.ts` mapping scopes onto Guard members: **state-scoped** edit/read-only (borrower draft-only), **field-scoped** render-or-hide (HMDA wall-off, hidden from LO pricing, never read by rules), **action-scoped** authority (UW-only decision/condition-clear, Admin-only threshold edit), + define `ownsApplication(role, app)` (the **ownership predicate**; the pipeline UI that applies it is S10, not here); wire into `app.ts` | As different roles on seeded apps: fields hide/show, edit↔read-only flips by state, restricted actions are gated |

### DAG

```
#378 ✓ ──┐
          ├──▶ S1a (identity & roles) ──▶ S1b (permission predicates)
#380 ✓ ──┘
```

Incremental delivery — S1a is independently demoable; S1b layers on it. **No circular dependency**: S1b
reads lifecycle *state* (shipped via #380) and gates on S1a's *role signal*; it does not build the state
machine. The ownership predicate is *defined* in S1b but *applied* to the pipeline in S10 — kept out of
scope here.

### Rubric check

| Condition | Verdict |
|---|---|
| Size is volume, not an unresolved decision | ✅ all forks for both surfaces resolved (#012/#482, #009/#457, #272/#178); this is wiring |
| ≥2 nameable slices, each a real home | ✅ both in `demos/loan-origination/domain/` + `app.ts` |
| Each slice ≤ 3 / `task` | ✅ story·3 + task |
| Clean DAG, real independence or incremental delivery | ✅ incremental: S1a demoable alone, S1b builds on it |
| Every slice leaves a valid demoable state | ✅ role-switch (S1a); gated edit/visibility/actions (S1b) |
| Split doesn't cost quality | ✅ seam mirrors the architecture (identity→signal, Guard→predicate); no cohesive model fragmented |

## Could not split — #379

None — splits cleanly.

## Recommended mutation — #379

- **Convert #379 in place** → `workItem: epic` (storied epic); refresh the body to point at the two
  slices; the inflated `size: 13` is superseded by the slices (≈6 total) — note the re-size rationale is
  now stale (surfaces built, not unbuilt).
- **Scaffold S1a**: `--workitem=story --size=3 --parent=379` (cite #378 ✓ + #380 ✓ as satisfied
  prereqs; no open `blockedBy`).
- **Scaffold S1b**: `--workitem=task --parent=379 --blocked-by=<S1a's NNN>`.

Net flow on approval: **+2** (S1a, S1b); #379 reframed `story·13 → epic`. S1a is immediately batchable;
S1b unblocks on S1a → `/batch` walks the chain.

---

# Focused `/split 651` (reference wizard Block + its runtime demo, webworkflows)

## Candidate

**#651** — *Reference wizard Block composing the Flow Progress intent* (`workItem: story`, `size: 13`,
`status: open`, `blockedBy: ["650"]` ✓ resolved, no `parent`). The card self-documents a 2-deliverable
split in its body ("the card bundles **two deliverables**: (1) a new interactive wizard **Block** … (2)
a **runtime demo** proving it end-to-end … or split: the wizard Block, then its runtime demo"). This run
verifies that against the real tree, then proposes batchable slices. Directly parallels the #669
Block→demo precedent already in this report.

## Work-investigation pass (what's on disk today)

The forks are settled (#634 ratified the Flow Progress intent + CustomWorkflowEngine seam); this is
volume, not an unresolved decision.

| Surface a slice would need | State | Evidence (file:line) |
|---|---|---|
| Flow Progress intent (the UX semantics to compose) | **EXISTS, ratified** | [intents.json:2702](../src/_data/intents.json#L2702) (`flow-progress`), #634 |
| `CustomWorkflowEngine` runtime + registry (the orchestration) | **EXISTS, shipped** | [blocks/workflow-engine/registry.ts:34](../blocks/workflow-engine/registry.ts#L34) (`customWorkflowEngine.resolve()`) · `WorkflowInstance` exported [index.ts:34](../blocks/workflow-engine/index.ts#L34); graduated from **#650** (resolved 2026-06-15) |
| `StepperBehavior` (stepper UX to reuse, not reinvent) | **EXISTS** | [blocks/stepper/StepperBehavior.ts:35](../blocks/stepper/StepperBehavior.ts#L35) — already does sequencing, locked-progression, `aria-current="step"` ([:108](../blocks/stepper/StepperBehavior.ts#L108)), Step N of M, `registerStepper()` ([:123](../blocks/stepper/StepperBehavior.ts#L123)) |
| The wizard **Block** itself (custom element) | **GREENFIELD** | no `blocks/wizard/`; no wizard custom element defined |
| Demo registry + dev-server fallback + e2e pattern | **EXISTS, copyable** | [src/_data/demos.json](../src/_data/demos.json) (id/path/entry entries) · existing demos under [demos/](../demos/) |

**The `size: 13` is wiring-of-shipped-pieces, not cross-project build.** Both heavy substrates — the
engine (#650) and the stepper UX (`StepperBehavior`) — are shipped. The Block *composes* them over the
ratified `flow-progress` intent; the demo *proves* the composition in a browser. The bundle's own body
re-estimates the true work at ≈`story·8` and names the seam. No buried fork survives: register, per-step
status mapping, back/undo are all decided by #634's intent + the engine's `send/back/onTransition` API.

## Could split — #651 ✅

Two agent-ready, demoable slices fall out along the seam the card names. DAG: **A → B** (incremental —
the demo consumes the Block element).

| Slice | type / workItem / size | blockedBy | Files / seam (file:line-citable) | Demoable state |
|---|---|---|---|---|
| **A — Wizard Block** (the interactive custom element) | issue · **story** · **3** | — (#650 ✓) | NEW `blocks/wizard/` custom element wiring `customWorkflowEngine.resolve().start(graph)` → a Flow-Progress UX: composes [StepperBehavior](../blocks/stepper/StepperBehavior.ts#L35) for current position + `aria-current="step"` + Step N of M; maps engine `onTransition` to per-step status (`wait`/`process`/`finish`/`error`); back/undo via the instance `back()`; defaults to the wizard register; reuses navigation's `structure:linear`/`guard`/`history`. composesIntents over [`flow-progress`](../src/_data/intents.json#L2702). Plus a unit/render test. | The wizard Block element drives a graph through its steps with per-step status, `aria-current=step`, and back/undo — proven by its unit/render test; droppable onto any page |
| **B — Runtime demo** (the end-to-end browser proof) | issue · **story** · **3** | **A** | NEW demo page under [demos/](../demos/) mounting slice A's wizard Block against a real `CustomWorkflowEngine` graph; register in [src/_data/demos.json](../src/_data/demos.json) (id/path/entry); dev-server fallback; an e2e/render check asserting step advance + back + `aria-current`. new-demo-class work. | `/demos/…` renders a working wizard in a browser, proving Web Workflows protocol + Flow Progress intent compose end-to-end |

### Rubric check

| Condition | Verdict |
|---|---|
| Size is volume, not an unresolved decision | ✅ #634 ratified the intent + engine seam; #650 shipped the engine; `StepperBehavior` shipped — this is composition/wiring |
| ≥2 nameable slices, each a real home | ✅ A → `blocks/wizard/` (standard artifact); B → `demos/` + `demos.json` (runtime proof) |
| Each slice ≤ 3 / `task` | ✅ A story·3 (wires two shipped substrates), B story·3 (new-demo-class) |
| Clean DAG, real independence or incremental delivery | ✅ incremental: A is unit-testable + droppable on its own; B consumes A's element |
| Every slice leaves a valid demoable state | ✅ A = tested wizard element; B = browser e2e proof |
| Split doesn't cost quality | ✅ seam mirrors the constellation factoring (reusable Block in `blocks/`, its proof in `demos/`) — same Block→demo split #669 used; no cohesive unit fragmented |

**Watch-item:** slice **A** is the boundary case — if "compose engine + stepper + per-step status +
back/undo into a custom element" re-estimates above `size 3` once building in webworkflows context,
sub-slice into **A1 element + stepper composition** (task) and **A2 per-step status + back/undo wiring**
(task). A future re-estimate inside the slice, not a blocker now, and not a missing decision.

## Could not split — #651

None — splits cleanly along the body's own seam.

## Recommended mutation — #651

#651 has **no parent**, so per the convention it converts in place to a storied epic (like #379/#619):

- **Convert #651 in place** → `workItem: story → epic`, **drop `size: 13`**, refresh the body to point
  at the two slices, keep `status: open`, keep `blockedBy: ["650"]` context (resolved), keep `NNN`.
- **Scaffold A**: `--type=issue --workitem=story --size=3 --parent=651` — the wizard Block (no open
  `blockedBy`; #650 ✓).
- **Scaffold B**: `--type=issue --workitem=story --size=3 --parent=651 --blocked-by=<A's NNN>` — the
  runtime demo.

Net flow on approval: **+2** (A, B); #651 reframed `story·13 → epic` (`size` dropped, children carry the
points). A is immediately batchable; B unblocks on A → `/batch` walks the chain.

---
---

# Focused re-run of `/split 658` (2026-06-15)

**Scope:** Focused run, `/split 658`. #658 is `story · size 13`, `blockedBy: ["657"]` (now resolved).
Its body already proposed an S1/S2/S3 seam at batch pre-flight; this run verified each seam against the
**real trees** (`webeverything/blocks/`, `../frontierui/`) and refines S2 into batchable ≤3 units.

**Verdict: #658 splits** — 4 batchable front slices + 1 blocked residual.

## Work-investigation pass (what the code actually shows)

Every claim in #658's body was confirmed against the real tree:

| Claim | Verified |
|-------|----------|
| `@frontierui/blocks` does **not** exist as a package | ✓ No `name: "@frontierui/blocks"` anywhere in FUI; `blocks/` is a plain dir. Packages present: `compiler`, `@frontierui/{component-compiler,auto-update-orchestrator,esbuild-plugin,maas-check,rollup-plugin,vite-plugin,jsx-runtime,webdocs-ui}`. |
| FUI uses `packages/*` + `compiler` workspaces; no `plugs/package.json` | ✓ Root `workspaces: ["compiler", "packages/*"]`; `blocks/` and `plugs/` are both bare dirs, no package.json. So S1 follows the **`compiler` precedent** (top-level workspace entry), not `packages/*`. |
| 9 WE-only families carry real impl, absent in FUI | ✓ `audit, background-task-surface, data-grid, lifecycle, master-detail, selection, stepper, tree-select, type-ahead` all present in WE, **0 files** each in `../frontierui/blocks/`. |
| Shared families are byte-identical (the #170 drift hazard) | ✓ `navigation, tabs, transient, for-each, view` all `diff -rq` clean against FUI. |
| The 9 families are mutually independent | ✓ No cross-family imports among them (only `background-task-surface` self-imports via alias) → they migrate in **parallel**, not a chain. |
| S3 is the #604 client migration, and #604 is held | ✓ #604 is `status: open`, `workItem: epic`, `blockedBy: ["170"]`, `relatedProject: webplugs` (concept → out of Tier A); #604 carries **two still-open forks** (in-page vs linked; published-package vs source-composition). |

**Real surface sizing** (impl files + tests that actually import the family via `../../../<fam>/…`):

- **6 single-file families** (`audit, lifecycle, master-detail, selection, stepper, tree-select`):
  1 behavior/provider file each + 1–2 unit tests each.
- **`background-task-surface`** — heaviest: 12 impl files (element, index, register, types,
  `reloadDurabilityAdapter`, 6 `traits/with*`, `__fixtures__/mock-loader`) + several tests.
- **`data-grid`** — `DataGridBehavior` + `DataGridEditBehavior` + 2 registers + ~2 tests.
- **`type-ahead`** — `TypeAheadBehavior` + index + register + types + 1 test.

All 9 families are registered in WE's `plugs/bootstrap.ts` and consumed by WE demos
(`loan-origination`, `auto-insurance`, `background-task-surface-demo`) — so during S2 (migrate-up,
**no delete**) WE keeps its copies + registration and FUI gains copies: a sanctioned **dual-copy
interim** (#170 guard: content-equal upstream *first*, delete only in S3).

## Could split — #658

Convert #658 `story · 13` → **storied epic** (drop `size`, umbrella digest, keep NNN, keep status open)
and scaffold:

| Slice | workItem · size | What | blockedBy | Batchable now? |
|-------|-----------------|------|-----------|----------------|
| **S1** | story · **3** | Create `@frontierui/blocks` as a canonical FUI workspace sub-package: `package.json` + `exports` map (the 14 FUI-owned families), add `"blocks"` to root `workspaces` (the `compiler` precedent), wire `build`. FUI-only, **no WE change, no delete**. | — (#657 ✓) | ✅ yes |
| **S2a** | task · **3** | Migrate the **6 single-file** WE-only families (`audit, lifecycle, master-detail, selection, stepper, tree-select`) UP — impl + register + unit tests, **byte-verified**, WE copies **kept**. | S1 | ✅ yes |
| **S2b** | story · **3** | Migrate **`background-task-surface`** UP (element + index + register + types + `reloadDurabilityAdapter` + 6 `traits/` + `__fixtures__` + tests), byte-verified, WE copy kept. | S1 | ✅ yes |
| **S2c** | story · **3** | Migrate **`data-grid` + `type-ahead`** UP (behaviors + registers + types + tests), byte-verified, WE copies kept. | S1 | ✅ yes |
| **S3** | story · **8** | Delete WE's vendored `blocks/` + repoint **every** WE `blocks/…` import & reconfigure WE build (vite/tsc/module-resolution) to consume cross-repo `@frontierui/blocks`. **This is the #604 client migration.** | S2a, S2b, S2c **and #604** | ❌ blocked + too big |

**DAG:** `S1 → {S2a ∥ S2b ∥ S2c} → S3`; `S3` also `blockedBy #604`.

```
        ┌── S2a ──┐
S1 ─────┼── S2b ──┼──→ S3 ──(also blockedBy #604, held)
        └── S2c ──┘
```

**Rubric:** (1) volume not a fork — #641 (A/A/A) settled everything, #657 did the contract side, nothing
open inside #658 ✓; (2) 5 nameable slices, each story/task ✓; (3) S1/S2a/S2b/S2c re-estimate ≤3, no
buried fork, named files ✓ — **S3 fails ≤3** (see below); (4) S2a/S2b/S2c mutually independent (parallel)
and the front half delivers incrementally without waiting on the held back half ✓; (5) every slice
leaves a valid demoable state — S1: package builds & exports; S2*: family content-equal upstream + FUI
tests green while WE copies still serve demos (#170-sanctioned dual-copy); S3: full cutover ✓.

## Could not split (further) — S3

S3 is a real, valid slice of #658 (incremental-delivery back half) but is itself **neither batchable nor
further-sliceable yet**:

- **Rubric (3) fails** — at size 8 it bundles delete-~21-families + repoint-every-import + build-reconfig.
- **Blocked-in-fact by #604** (held: `relatedProject: webplugs` concept → out of Tier A).
- **Cannot be investigated to slice depth now** — *how* WE resolves cross-repo `@frontierui/blocks`
  (published-package vs source-composition) and the in-page-vs-linked demo seam are the **two open forks
  inside #604**. Drawing S3's sub-slices now would be guessing seams #604 hasn't ruled.

**Unblocking action:** land/resolve **#604** (resolve its two forks; clears its #170 blocker), then
re-run `/split` on S3. **No new decision card needed** — the blocker is #604 itself, an already-tracked
open epic owning those forks; S3 simply carries `blockedBy: #604`, and nothing in #658 is left as an
inline un-tracked fork.

## Recommended mutation — #658 (gated on one "go")

1. Convert **#658** `story · 13` → **storied epic** (drop `size`, umbrella digest, keep NNN, keep status open).
2. Scaffold **S1, S2a, S2b, S2c, S3** with the `--parent=658` / `--blocked-by=…` edges above
   (S3 `--blocked-by` includes `604`).
3. Gate on `npm run check:standards`; confirm backlog count rose by 5.

Net flow on approval: **+5** (658 → epic). S1/S2a/S2b/S2c are immediately `/batch`-able; S3 waits on #604.
