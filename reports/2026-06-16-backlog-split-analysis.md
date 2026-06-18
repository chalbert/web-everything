# Backlog split analysis — #731 (FUI block-catalog gate)

Date: 2026-06-16 · Focus: `/split 731`

## Candidate

**#731** — *Build FUI block-catalog: completeness gate + fill authored entries + render /blocks/ from
manifest* — `workItem: story`, `size: 13`, `status: open`, `blockedBy: [706]`. Released from
batch-2026-06-15 unstarted; its own body already recommended `/slice` after surfacing a definitional
fork.

## Work-investigation pass (what the tree actually shows now)

#731 framed four deliverables. Tracing them to the real tree (both repos) — **two already landed**
since the item was written, which shrinks the remaining surface:

| # | Deliverable (per #731 body) | Real state today | Evidence |
|---|---|---|---|
| 1 | Completeness gate (FAIL if an implemented `blocks/` family has 0 entries) | **NOT done** — real work | `fui:frontierui/scripts/check-standards.mjs:25-62` validates *existing* entries + cross-repo `weSpecPath`, but has **no `readdirSync(blocks/)` denominator** check |
| 2 | Fill ~17 missing authored entries | **DONE** by #737 (resolved) | `fui:frontierui/src/_data/blocks.json` now has **23 fully-authored entries** (id/summary/type/weSpecPath/status), commit `c63b69f` "register 16 unpublished FUI block impls (WE #737)" |
| 3 | Render /blocks/ from manifest | **already TRUE** | `fui:frontierui/src/blocks.njk:16-31` iterates `blocks` (the fui:blocks.json data) into cards — #731 itself conceded "largely already true" |
| 4 | WE Web-Docs derivation-source doc (authored=default; impl-scan=opt-in) | **NOT done** — independent | `webdocs` is the standard home (`we:src/_data/projects.json`); #706 ratified **option B** (authored manifest + completeness gate), so the dimension is decided but undocumented |

**The blocking fork is real.** #706 resolved the *derivation mechanism* (authored + gate), but **not the
gate's denominator**. Auditing the 23 non-`__tests__` `blocks/` dirs against WE `fui:blocks.json` (74 ids):
- **Dir name ≠ block id** (needs a map, not 1:1): `navigation`→`nav-list`; `stores`→`simple-store`;
  `transient`→`transient-component`; `text-nodes`→`interpolation-text-node`; `audit`→`audit-trail`.
- **Multi-block dirs** (one dir → several WE specs): `parsers`→ handler-/double-curly-/double-square-
  bracket-parser.
- **Infra, no WE spec** (should they count?): `renderers`, `text-nodes`, `traits`, `attributes`,
  `audit`(?).

So the gate *cannot be written* until "which dirs are catalog families, and how each maps to ≥1 WE
spec" is decided — that's a `type:decision`, not mechanical curation. This is the textbook
"carve the fork to its own card, block the buildable slice on it" pattern, **not** "split a fork away."

## Verdict: COULD SPLIT

| Slice | Title | workItem | size | Files (citable) | Blocked by |
|---|---|---|---|---|---|
| **a** | Define the catalog-block-family **denominator + dir→WE-spec mapping** rule | `type:decision` | — | `frontierui/blocks/*` (23 dirs), `fui:frontierui/src/_data/blocks.json`, WE `fui:src/_data/blocks.json` | — (root) |
| **b** | Add the **completeness gate** to FUI check-standards + reconcile any residual entries | `story` | 3 | `fui:frontierui/scripts/check-standards.mjs` (new `readdirSync` family check), `fui:frontierui/src/_data/blocks.json` | **a** |
| **c** | Document **derivation-source as a Web-Docs dimension** (authored=default/reference; impl-scan=opt-in) | `story` | 2 | WE `webdocs` standard page / doc + `we:src/_data/projects.json` | — (root) |

**DAG:** `a → b`; `c` independent. Two startable roots (**a** and **c**), so real parallelism +
incremental delivery — **c** ships a doc immediately; **a** unblocks **b**. No rigid single chain.

**Rubric (all five hold):**
1. *Volume not a fork* — the fork is **extracted to card (a)**, leaving (b) mechanical once (a) lands;
   the fork is tracked, not split away. ✓
2. *≥2 nameable slices, each a real home* — 3 slices (1 decision + 2 stories), each file-cited. ✓
3. *Each ≤3 / batchable* — (b)=3 (gate is one `readdirSync` + a map; entries/render already done by
   #737), (c)=2 (doc-only). No buried fork after (a). ✓
4. *Acyclic DAG, ≥2 independent / incremental* — (a) and (c) independent roots; (c) delivers alone. ✓
5. *Every slice demoable* — (a) decision artifact; (b) `check:standards` green; (c) renders the doc. ✓

Note the shrinkage: because **#737 filled the entries and the render was already manifest-driven**,
slice (b) is materially smaller than #731's "fill ~17 + render" framing — it is now *gate + reconcile*,
comfortably ≤3.

## Could not split

None — the single candidate splits cleanly.

## Proposed mutation (gated on one "go")

1. Convert **#731** in place → **storied epic** (`workItem: story`→`epic`, drop `size`, umbrella digest,
   keep `NNN` and `blockedBy:[706]`), de-bury its inline fork → pointer to slice (a).
2. Scaffold **(a)** `type:decision` · **(b)** `story·3` (blocked-by a) · **(c)** `story·2`, all
   `--parent=731`.
3. Gate on `npm run check:standards`; expect backlog count **+3**.

---

# Focused `/split 736` (temporal block IMPL — variant traits + build-chunk assertion)

## Candidate

**#736** — *temporal block impl — variant traits + build-chunk assertion (re-slice)* —
`workItem: story`, `size: 13`, `parent: 315`, `status: open`, `blockedBy: [359, 735]`. The deferred
greenfield IMPL track (Slice C from `/split 359`, 2026-06-15). Its body explicitly defers itself and asks
to *"Re-run /slice on this card after A lands."*

## Verdict: COULD NOT split

#736's own re-slice precondition has **not** been met, and the locus watch-item it flagged has since
hardened from "a re-estimate" into a **live blocking fork**.

## Work-investigation pass (read before slicing)

#736 deferred itself with an explicit precondition: *"impl seams aren't drawable to ≤3 until A (#359)
lands the first WE trait + core block pattern."* Tracing both halves against the real tree:

| Claim / precondition | Reality on disk (2026-06-16) | Met? |
|---|---|---|
| "A (#359) lands the first WE **trait** pattern" | #359 **resolved** but `graduatedTo: fui:src/_data/blocks.json` — a **standards-layer** deliverable (intent activation + abstract block + presets), authoring **no trait**, **no impl dir** (matches the drawer/dialog/carousel `fui:blocks.json`-only gap-fix pattern). | **No** |
| "…and core block **pattern**" (impl) | No `blocks/temporal/` directory (`ls blocks/` — 30 families, temporal absent). | **No** |
| WE has a first authored trait to copy | `traitEnforcer({ traitMap: {} })` — still empty (vite.config.mts:104; line 100 comment: *"traitMap is empty until a trait is authored"*). **Zero authored traits**, as #736's body itself stated. | **No** |
| #735 (Slice B) landed an impl seam | Also **resolved → `fui:blocks.json`** only (three preset contract entries). | **No** |

**Conclusion:** the foundational "first WE trait + core block IMPL pattern" #736 named as its re-slice
trigger was **never delivered** — A and B graduated as pure standards-layer `fui:blocks.json` contracts. There
is no impl surface (no trait module, no `blocks/temporal/`, empty `traitMap`) to draw `file:line`-citable
slice boundaries against. Per-trait tasks now would be slicing "straight from the body" — forbidden.

## Could not split — #736

| Rubric condition failed | Specific unblocking action |
|---|---|
| **Work-investigation depth + (3)** — impl surface to slice against does not exist (no authored trait, no `blocks/temporal/`, `traitMap: {}`); slices aren't `file:line`-citable, can't re-estimate to ≤3. | **Land a first WE trait-impl pattern** (the genuine impl-track "Slice A") — *but only after the ownership fork below is ruled, since it decides where that pattern is authored.* |
| **(1) — a buried, now-live fork.** #736 flagged WE-vs-FUI trait ownership as *"a locus watch-item … a re-estimate, not a fork."* That changed: **[#658](../backlog/658-promote-frontierui-blocks-canonical-migrate-the-9-we-only-fa.md)** (open, active) is migrating all real impl **UP to `@frontierui/blocks`** and **deleting WE's vendored `blocks/`**. The tension between **#713** (placed the trait build in WE) and **#641/#658** (impl → FUI, delete WE `blocks/`) is a real fork. Authoring greenfield trait impl into WE `blocks/` now writes into a doomed tree. | **Ratify a `type:decision` card:** *Temporal trait-impl locus — WE `blocks/temporal/` vs `@frontierui/blocks`*, related-to/blocked-by #658. |

### Why not "just slice it into FUI now"

Premature: #658's `@frontierui/blocks` sub-package **does not yet exist** (#658 body — FUI has no
`fui:blocks/package.json`, no `exports` wiring). So *neither* home is a drawable surface today — WE's is
doomed, FUI's isn't built. Both ends of the fork are blocked on prior work; that's exactly why the seam
isn't drawable and the honest move is to track the fork, not force a split.

## Recommended mutation (gated on one "go")

Nothing splits, so the only mutation is **registering the now-live fork** (skill: a blocking fork is filed
as its own `type:decision` card; de-bury the parent):

1. **Scaffold a decision card** —
   `node we:scripts/backlog.mjs scaffold --type=decision --workitem=story --size=2 --parent=315 --title="Temporal trait-impl locus — WE blocks/ vs @frontierui/blocks" --blocked-by=658 --digest="…"`.
   The fork: #713 placed the temporal trait build in WE, but #658 is migrating impl to `@frontierui/blocks`
   and deleting WE `blocks/`. Decide where greenfield trait-impl (calendar-grid / clock /
   range-coordination) is authored. Likely tracks #641 (impl → FUI), but #713's explicit WE placement
   makes it a real call.
2. **Re-point #736's locus watch-item** to the new card (replace the "re-estimate, not a fork" line) and
   add it to `blockedBy` alongside the still-needed first-trait-impl pattern. #736 stays an open
   `size:13` story — scope intact, still un-sliceable.

#736 is **not** converted to an epic and **not** resolved.

## Net (focused 736)

- Could split: none. Could not split: #736.
- Proposed mutation: **+1 `type:decision` card**; #736 stays open with a corrected `blockedBy`. Gated on
  your "go".

---

# Focused `/split 674` — Self-Driven Project non-technical control plane (plateau-app)

## Candidate

**#674** — *Self-Driven Project non-technical control plane (plateau-app SaaS surface) — re-slice after
the artefact contract lands* — `workItem: story`, `size: 13`, `parent: 666`, `status: open`,
`blockedBy: [672]`, `locus: plateau-app`. Carried an explicit self-deferral: *"NOT yet sliceable — its
surface is unknown until the artefact contract (#672) lands; re-run /slice … after #672 resolves."*

## Verdict: COULD SPLIT — the precondition has landed

[#672](../backlog/672-self-driven-project-tool-agnostic-artefact-contract-everythi.md) **resolved
2026-06-15** (→ `protocol:self-driven-project-artefact-contract`; spec
`we:reports/2026-06-15-self-driven-project-artefact-contract-spec.md`). The autonomy ladder (L0–L4), gate
model, and `we:process.config.json` tolerance/ceiling dials are now fixed vocabulary — the deferral
condition is met.

## Work-investigation pass (the plateau-app surface is rich + citable)

The control plane is a **persona-facing read/act layer over enforcement that already exists** in
plateau-app (`/Users/nicolasgilbert/workspace/plateau-app`) — not greenfield:

| Substrate | State | Concrete refs |
|---|---|---|
| Gate model + enforcement | ✅ full | `plateau:src/profiles/gate-enforcement.ts` — `GateEnforcer` (`evaluate()→DeployVerdict` :201, `signOff` :135, `refuse` :145, `escalate` :163, `audit()` :124), `GateRecord` :32, `AuditEntry` :45, `DeployVerdict` :55; `GateType` `plateau:src/profiles/schema.ts:75` |
| Persona scoping | ✅ rich | `plateau:src/profiles/schema.ts:128` (`Profile`), `plateau:src/profiles/roster.ts` (7 charters + `escalation`), `plateau:src/profiles/profiles.ts:14` (`getProfile`) |
| Escalation routing | ✅ schema/logic | `GateRecord.escalatedTo` + `escalate(gateId,authority,actor)` :163; roster escalation strings — **no inbox UI** |
| Audit trail | ✅ schema/logic | `AuditEntry{action,actor,reason,at}` :45, immutable `audit()` :124; reversibility `plateau:src/technical-configurator/seed-change-tracking.ts:82` — **no audit dashboard** |
| Route + mount pattern | ✅ proven | `<template route="/profiles">` `we:index.html:135` + `#profiles-mount`; `mountProfiles(el)` `plateau:src/profiles/profiles-page.ts:158`; wiring `plateau:src/main.ts:216`/`:351`/`:463` |
| SDLC step-tree | ❌ greenfield | #671 graduated to a *webeverything* `/research/` njk, not plateau-app code |

Each slice wraps **one existing enforcement module** + adds **one mount module** on the proven
`plateau:profiles-page.ts` pattern → all `file:line`-citable, all re-estimate to `size ≤ 3`.

## Proposed slices

#674 already has a parent (#666), so per the edge case it is **NOT converted to a sub-epic** — it stays
a `story` under #666 re-scoped to its **core slice** (dashboard + shell); the rest scaffold as
**siblings under #666**.

| Slice | workItem · size | Home (new + reads) | Blocked by |
|---|---|---|---|
| **#674** (re-scoped) — control-plane **gate dashboard + shell**: `/control-plane` route, persona-scope selector, each gate in plain language (GateType→plain label, blocking vs advisory) | `story · 3` | new `plateau:src/control-plane/dashboard.ts` + `we:index.html` route + `plateau:src/main.ts` mount; reads `plateau:gate-enforcement.ts` (`DeployVerdict`/`GateRecord`), `plateau:roster.ts`, `getProfile` | — (root) |
| **B** — L3 **escalation inbox**: plain-words "X requests your decision" from `GateRecord.escalatedTo`; approve/refuse → `signOff`/`refuse` | `story · 3` | new `plateau:src/control-plane/escalation-inbox.ts`; reads `escalate`/`signOff`/`refuse` + roster `escalation` | #674 |
| **C** — **audit / what-changed-why-undo** view: render `audit()` trail + reversibility as plain what/why/undo-ability | `story · 3` | new `plateau:src/control-plane/audit-view.ts`; reads `AuditEntry`/`audit()` + reversibility model | #674 |
| **D** — goal + **tolerance-envelope "trip planner"**: set autonomy ceiling (L0–L4) + tolerance dials in plain language → `we:process.config.json`-shaped state | `story · 3` | new `plateau:src/control-plane/trip-planner.ts`; reads #672 contract vocabulary | #674 |

**DAG:** `#674 → {B, C, D}`; B/C/D mutually independent leaves (no cross-edges).

**Rubric (all five hold):**
1. *Volume not a fork* — autonomy ladder/gate model/persona roster all fixed upstream (#665/#672). The
   one open shape (dedicated `/control-plane` family vs panels inside `/profiles`) is a UX-structural
   default, not a standards fork; recommended default = dedicated persona-scoped `/control-plane` family
   (matches the "SaaS surface" framing); slices hold either way. ✓
2. *≥2 nameable, real home* — 4 slices, each file-cited. ✓
3. *Each ≤3 / batchable* — each = one mount module over one enforcement API; no buried fork. ✓
4. *Acyclic, ≥2 independent / incremental* — #674 ships a working dashboard alone; B/C/D are 3
   independent panels off it (both independence and incremental delivery). ✓
5. *Every slice demoable* — each mounts a real route over real enforcement data. ✓

## Could not split (carried note)

- **"Plain-language-gate requirement *on the step-tree*"** (5th sub-idea in #674's body) — *failed
  (2)/(3)*: its named home (a plateau-app step-tree) **doesn't exist** (#671 graduated to a webeverything
  `/research/` njk). The plain-language *translation* is **absorbed into slice #674** (the dashboard IS
  the translation). *Unblocking action*: land a step-tree surface in plateau-app first (new foundational
  item), then a requirement-as-code (#100) artefact can attach gate copy to step nodes.

## Proposed mutation (gated on one "go")

1. Re-scope **#674** in place: keep `workItem: story` under `parent: 666`, drop `blockedBy:[672]` (resolved),
   `size 13→3`, retitle to the gate-dashboard+shell core, refresh digest. **Not** converted to an epic
   (already has a parent).
2. Scaffold **B/C/D** as `story·3`, all `--parent=666 --blocked-by=674`.
3. Gate on `npm run check:standards`; expect backlog count **+3**.

---

# Focused `/split 752` — Embedded technical configurator (Plateau embed) + cost preview

## Candidate

**#752** — *Embedded technical configurator (Plateau embed) — configure a block's technical aspects,
with a cost preview* — `workItem: story`, `size: 13`, `parent: 746`, `status: open`, `locus:
webeverything`, `relatedProject: webdocs`. Released unworked from batch-2026-06-16, bumped 3→13 after the
batch traced its surfaces and found three load-bearing premises false; its own body asks for a `/slice`.

## Work-investigation pass (what the tree shows now — one premise is already stale)

#752's body named three blockers. Re-tracing each against the real tree:

| # | Body premise | Reality on disk (2026-06-16) | Evidence |
|---|---|---|---|
| 1 | "Configurator has **exactly one** domain (Change Tracking) → no pattern for adding domains" | **STALE / false now** — there are **9 domains** with a **repeatable add-pattern**: a `seed-*.ts` + one `we:provider.ts` entry + a `plateau:presets.ts` block. Three were added recently for Web Editing (#618/#633). | `plateau:plateau-app/src/technical-configurator/provider.ts:9-31` (`DOMAINS[]` = changeTracking, fileUpload, sortingStrategy, expressiveSymbol, reactionUpdateStrategy, hoverIntent, editingEngine, serializationFormat, substrateNegotiation); `plateau:seed-editing-engine.ts` (132 ll), `plateau:seed-substrate-negotiation.ts` (116 ll) |
| 2 | "No embed/seed mechanism — Plateau↔WE seeded-embed is an undecided cross-repo seam" | **TRUE** — `mountTechnicalConfigurator(root)` takes **no seed, reads no URL params**; no Plateau→WE embed transport exists (the FUI `fuiDemo` iframe is FUI-only). A genuine cross-repo design fork. | `plateau:plateau-app/src/technical-configurator/configurator.ts:581` (`mountTechnicalConfigurator(root: HTMLElement)`, single arg) |
| 3 | "No cost model — bytes/requests/hydration preview + chunk graph" | **TRUE** — nothing computes it. But fidelity is a **v1-default build choice**, not a load-bearing fork (POC pragmatism: start with a rough chunk-graph-derived estimate). | (absence) — chunk-graph source data is settled by resolved #719/#720 |

**The four "WE-side concepts" are all resolved**, so each new domain has settled source data (no buried
fork inside a domain seed): #079 render-strategy (resolved), #455 transport (resolved decision), #448
trait-lazy-load (resolved), #719/#720 chunk-split (resolved). Adding each as a Configurator domain is now
the **mechanical, well-trodden** seed+provider+presets add — exactly the editing-engine precedent.

**Net effect of premise (1) collapsing:** the part the body said was *impossible* ("reuse existing
domains") is now the *easy, repeatable* part. What remains genuinely open is only the cross-repo
**embed/seed transport** (premise 2) — a real fork, carved to its own `type:decision` card, the parent
build blocked on it (not split away).

## Verdict: COULD SPLIT

#752 already has `parent: 746` (it's one of that epic's 8 slices), so per the edge case it is **NOT
converted to a sub-epic** — it stays a `story` under #746 re-scoped to its **core slice** (the WE
block-page button + seeded embed + preview render); the rest scaffold as **siblings under #746**.

| Slice | workItem · size | Home (new + reads) | Blocked by |
|---|---|---|---|
| **A** — *decision*: Plateau↔WE **embed/seed transport contract** (iframe + query-param seed? shared component? deep-link-only?) — analogous to #700/#701 and to sibling decision #747 | `type:decision` · — | `plateau:plateau-app/.../configurator.ts:581` (`mountTechnicalConfigurator` — no seed today), the #701 `fuiDemo` iframe precedent | — (root) |
| **B** — add the **four WE technical dimensions as Configurator domains**: render-strategy (#079), transport (#455), trait-lazy-load (#448), chunk-split (#719/#720) — 4× `seed-*.ts` + `we:provider.ts` entries + `plateau:presets.ts` blocks | `story` · 5 | new `plateau:plateau-app/.../seed-render-strategy.ts` (+3 more), `we:provider.ts:19-29` (`DOMAINS[]`), `plateau:presets.ts` | — (root) |
| **C** — **cost-preview model + UI**: chunk graph + estimated bytes/requests/hydration for the selected config (v1 = rough estimate from the chunk-split data) | `story` · 5 | new cost-model module in `plateau-app/.../technical-configurator/`; reads the chunk-split domain (B) | **B** |
| **#752** (re-scoped) — WE block-page **"Configure technical aspects" button** → embedded mini configurator seeded with this block's 4 dims + **deep-link** to the full Plateau Configurator + render the cost preview; fixture exercises one non-default config | `story` · 5 | WE block/explorer page (under #746/#727 surface) + the #701 `fuiDemo` embed wiring | **A, B, C** |

**DAG:** `A` and `B` are independent roots; `C → ` depends on `B`; `#752 → ` depends on `A, B, C`
(the integration/convergence node). Two startable roots now (**A** can be prepared/decided immediately;
**B** is mechanical and startable immediately) → real parallelism + incremental delivery (each B domain
demos in the Configurator on its own; A produces a decision artifact).

**Rubric (all five hold):**
1. *Volume not a fork* — the one genuine open fork (embed/seed transport) is **extracted to card A** and
   the build (#752) is **blocked on it**, not split across children; the cost-model "fidelity" is a v1
   default (POC pragmatism), not a blocking call. ✓
2. *≥2 nameable slices, each a real home* — 4 (1 decision + 3 stories), each file-cited. ✓
3. *Each ≤5 / batchable, no buried fork* — B=5 (4× the ~120-line editing-engine seed pattern), C=5
   (v1 estimator), #752=5 (button+embed+preview wiring once A/B/C land); A is a decision, not sized. ✓
4. *Acyclic, ≥2 independent / incremental* — A and B are independent roots; B's four domains each ship
   demoable alone. Not a rigid single chain. ✓
5. *Every slice demoable* — A = decision artifact; B = new working Configurator domains (pick→see the
   decision experience); C = cost estimator with a sample config; #752 = the fixture-driven button+embed. ✓

## Could not split

None — #752 splits cleanly. (Alternative considered: split **B** four ways, one story per domain. Held as
**one story** — the four are mechanically identical seed-adds sharing one PR shape; four near-identical
cards would needlessly fragment a coherent "add WE's technical dimensions" deliverable. It can be
re-sliced 4-way later if a batch wants finer parallelism.)

## Proposed mutation (gated on one "go")

1. Re-scope **#752** in place: keep `workItem: story` under `parent: 746`, `size 13→5`, retitle/digest to
   the WE button+embed+preview core, add `blockedBy: [A, B, C]`, and **de-bury the inline fork** — replace
   the premise-2 paragraph with a pointer to decision card A. **Not** converted to an epic (already has a
   parent).
2. Scaffold **A** `type:decision` (`--parent=746`), **B** `story·5` (`--parent=746`), **C** `story·5`
   (`--parent=746 --blocked-by=B`). Then add `--blocked-by=A,B,C` to #752.
3. Gate on `npm run check:standards`; expect backlog count **+3**.

## Net (focused 752)

- Could split: **#752** (+3 slices). Could not split: none.
- #752 stays an open `story` re-scoped to its core, **not** converted to an epic and **not** resolved.

---

# Focused `/split 100` — Requirement-as-code (now unblocked by #714)

## Candidate

**#100** — *Requirement-as-code — machine-checkable requirements an AI can understand, test, and
(eventually) generate from* — `workItem: story`, `size: 13`, `parent: "099"`, `status: open`,
`blockedBy: [714]`, `relatedProject: webcases`. The 2026-06-10/06-15 split passes ruled it
*splittable-but-deferred* because its core fork (the meta-schema format) was unratified. **#714 resolved
2026-06-16** — its ruling explicitly says *"land foundational slice A as a standalone win, then re-run
`/split 100` to carve slice B and C against the now-real tree."* This is that re-run.

## Work-investigation pass (the surface the slices bind to all exists now)

#100's body stages three capabilities. Tracing each against the real tree:

| Cap. (per body) | WE-resident, deterministic core | Plateau-served (no-leakage, #475/#714 fork 3) | Surface today |
|---|---|---|---|
| 1 — authoring + validation | the **meta-schema** (typed requirement record) + a **deterministic slot-resolver** (a requirement naming a nonexistent registry term fails) | the AI contradiction/ambiguity/gap checker (a *swappable provider*) | registries exist: `we:src/_data/intents.json:1`, `we:src/_data/semantics.json:1`, `we:src/_data/protocols.json:1`; webcase artifact shape: `we:webcases/driftCheck.ts:1` (pure, dependency-free TS) |
| 2 — auto-testing | the **requirement→webcase compiler** (deterministic 1:N projection, #714 fork 2 *compile-to*) | the AI test-generator for the non-compilable residue | `webcases/` dir + `we:driftCheck.ts` is the compile target's precedent |
| 3 — code-from-requirement | *(none — pure AI codegen)* | the AI code-proposer | — |

**#714 settled what was the blocker.** Fork 1 = (d) EARS-over-Given/When/Then, every slot a typed
reference (role=persona, Given=intent-dimension value, When=`semantics` event, Then=`protocols`
observable) — with a concrete worked YAML example. Fork 2 = compile-to. Fork 3 = Plateau placement
(#475). The "exact clause set / required-vs-optional role slot" are explicitly *slice-A authoring
details, not fork blockers*. So capabilities 1 & 2 are now **volume, not uncertainty**.

**Capability 3 still buries a fork.** #100's body: *"Two shapes: (a) requirement is the only source of
truth, code generated… (b) AI proposes a code change, a dev validates."* That `(a)/(b)` source-of-truth
call is unresolved, and capability 3 has **no WE-resident deterministic artifact** (it is pure
Plateau-served codegen). It cannot be a clean build slice.

## Verdict: COULD SPLIT (A + B); capability 3 → could-not-split (fork carved)

#100 already has `parent: "099"` (it's one of that storied epic's slices), so per the edge case it is
**NOT converted to a sub-epic** — it stays a `story` under #099 re-scoped to its **core slice A**; slice B
scaffolds as a **sibling under #099**.

| Slice | workItem · size | Home (new + reads) | Blocked by |
|---|---|---|---|
| **#100** (re-scoped) — **slice A: meta-schema + deterministic validator.** The typed requirement-record schema (per #714's worked example) + a resolver that checks every slot against the live registries and reports unresolvable references (the WE-resident half of "authoring + validation") | `story · 5` | new `we:webcases/requirement-schema.ts` (typed record) + `we:webcases/validate-requirement.ts` (resolves slots vs `src/_data/{intents,semantics,protocols}.json` + personas); pattern = `we:webcases/driftCheck.ts` (pure, dep-free) | — (root; #714 resolved) |
| **B** — **requirement→webcase compiler.** Deterministic 1:N projection of a typed requirement record (slice A's schema) into webcase(s) — the compile-to ratified in #714 fork 2 | `story · 5` | new `we:webcases/compile-requirement.ts`; reads slice-A schema, emits a `webcases/`-shaped artifact (we:driftCheck.ts precedent) | **#100** (A) |
| **C-decision** (parked) — **code-from-requirement source-of-truth fork.** `(a)` requirement-is-only-SoT (codegen at build/run) vs `(b)` AI-proposes-dev-validates. De-buried from #100's body | `type:decision` · `story·2`, `status: parked` | #100's "capability 3" framing; #475 no-leakage placement | — (parked: far-future, gated on Plateau codegen existing) |

**DAG:** `#100(A) → B`; C-decision is an independent parked card (not a build edge). A is a root,
startable now; B cascades the instant A resolves.

**Rubric (all five hold for A + B):**
1. *Volume, not uncertainty* — the gating format fork is **resolved by #714**; capability-3's `(a)/(b)`
   fork is **extracted to the parked C-decision card**, not split across children. ✓
2. *≥2 nameable slices, each a real home* — A (schema+validator) and B (compiler), each a `webcases/`
   module, file-cited. ✓
3. *Each ≤5 / batchable, no buried fork* — A=5 (a dep-free resolver over existing registries, driftCheck
   scope), B=5 (a deterministic projection); the AI checker/generator are *separate Plateau-locus*
   providers, deliberately out of A/B. Slice-A clause-set details are #714-confirmed *not* forks. ✓
4. *Acyclic, ≥2 independent / incremental delivery* — a 2-node chain (A→B), justified by **genuine
   incremental delivery**: A *is* the "standalone win" #714 names (a usable intent-linter + corpus
   producer, valuable without B), and B ships valid alone (requirements compile to webcases). ✓
5. *Every slice demoable* — A: a fixture requirement (the #714 YAML) validates green, one with a bad
   registry reference fails (fixture-driven). B: a fixture requirement compiles to a webcase. ✓

## Could not split

| Item | Rubric condition failed | Unblocking action |
|---|---|---|
| **Capability 3 — code-from-requirement** | **(1)** buries the `(a)/(b)` source-of-truth fork **and (5)** has no WE-resident deterministic artifact to demo (pure Plateau-served codegen). | File the `(a)/(b)` fork as the **parked C-decision card** (above). The build becomes a sliceable slice C **once** that decision is ratified **and** the Plateau-served codegen capability exists — re-run `/split` then. |

## Proposed mutation (gated on one "go")

1. Re-scope **#100** in place: keep `workItem: story` under `parent: "099"`, **drop `blockedBy: [714]`**
   (resolved), **`size 13→5`**, retitle/digest to slice A (meta-schema + deterministic validator), and
   **de-bury capability 3** — replace its body section with a one-line pointer to the C-decision card.
   **Not** converted to an epic (already has a parent).
2. Scaffold **B** `story·5` `--parent=099 --blocked-by=100`, and **C-decision** `type:decision`
   `workItem:story·2 --parent=099` then set it `status: parked`.
3. Gate on `npm run check:standards`; expect backlog count **+2**.

## Net (focused 100)

- Could split: **#100** (+1 build slice B). Could not split: capability 3 → **+1 parked decision card**.
- #100 stays an open `story` re-scoped to slice A — **not** converted to an epic, **not** resolved.

---

# Focused `/split 727` — Web Docs /blocks/ per-component live surface (live example + props/token/a11y panels)

## Candidate

**#727** — *Web Docs /blocks/ — per-component live surface (FUI render + props/token/a11y panels) on the
catalog skeleton* — `workItem: story`, `size: 13`, `parent: "623"`, `status: open`,
`relatedProject` (none set; webdocs domain). Carved from #627 at batch-2026-06-15; the body's own
2026-06-16 note already traced the four panels and asked for a `/slice` ("released unworked … Needs a
`/slice`").

## Work-investigation pass (the tree corrects the body on two of four panels)

#727's body splits the per-component view into four panels. Re-tracing each against the **real tree**
revises the body's own (partly stale) trace — two resolved siblings (#653, #654) and a per-component
token tier the body missed:

| Panel | Body's claim | Reality on disk (2026-06-16) | Evidence |
|---|---|---|---|
| **Live example** | available now | **TRUE** — the `fuiDemo` shortcode exists and is used **ad-hoc in 8 of 69** block includes; no *uniform* slot on the page template yet | `we:.eleventy.js:38` (`addShortcode("fuiDemo", …)`); 8 includes call it (`block-descriptions/{tabs,tooltip,nav-list,autocomplete,for-each,view,component,interpolation-text-node}.njk`); `we:block-pages.njk:32-35` includes the per-block njk but has **no** structured demo slot |
| **Props table** | blocked — *"needs a CE-manifest analyzer that does not exist"* | **PARTLY STALE** — the analyzer **and renderer already exist**. #653 (resolved → `protocol:custom-elements-manifest`) shipped `we:scripts/gen-cem.mjs`; #654 (resolved → `block:props-table`) shipped the renderer `we:block-descriptions/props-table.njk`. The real blocker is **narrower**: gen-cem projects only events/exports/tagName, and there's **no source for structured attribute/property/slot/CSS-API data** | `we:scripts/gen-cem.mjs:43-93` (maps `events`/`exports`/`tagName` only — no member/attribute/slot/cssProp projection); `we:custom-elements.json` = 68 modules, **0** `members`/`attributes`/`customElement`, 68 `x-webeverything`; #653 note: *"as blocks gain structured attribute/slot/CSS-API fields, the same pipeline emits a richer manifest"* |
| **Token table** | unverified source | **PARTLY FALSE** — a **per-component token tier exists** (`button`, `card` DTCG component overrides) but covers ~2 of 69, is keyed by component name not `block.id`, and `webtheme/` is **not** exposed to 11ty (`src/_data` has no theme/token data) | `we:webtheme/defaultTokens.ts:90-104` (`button`/`card` component tier); no `src/_data/*token*`/`*theme*` file |
| **A11y panel** | unverified source | **CONFIRMED no source** — zero per-component a11y data anywhere; #770 (resolved) ships a **route-level** axe gate, not per-component metadata; `we:intents.json` carries no a11y fields | `we:tests/a11y/rendered-site-a11y.spec.ts` (route allowlist, not per-component); intent keys = `[id,name,status,summary,dimensions,description]` |

**Net:** the body's "props table needs a missing analyzer" is stale — the CEM protocol + props-table
renderer both shipped; what's missing is **where the structured per-component API data comes from**, and
that crosses the **WE/FUI boundary** (the API surface is an FUI impl detail; WE never imports FUI code —
[[project_docs_rendering_boundary_we_iframes_fui]]). Token and a11y panels likewise have **no wired
source**, each a distinct "what data, from where" call. Only the **live-example slot** is volume, not
uncertainty.

## Verdict: PARTIAL — 1 slice splits cleanly; 3 panels could-not-split (each gated on its own decision)

#727 already has `parent: "623"` (one of that storied epic's slices), so per the edge case it is **NOT
converted to a sub-epic** — it stays a `story` under #623 re-scoped to its **core slice** (the uniform
live-example slot); the three panel forks scaffold as **`type:decision` siblings under #623**.

### Could split

| Slice | workItem · size | Home (new + reads) | Blocked by |
|---|---|---|---|
| **#727** (re-scoped) — **uniform live-example slot**: a structured `section-card` on every `/blocks/{id}/` page that embeds the block's FUI demo via the `fuiDemo` shortcode, driven by an optional `fuiDemo` field on the block's `fui:blocks.json` entry; migrate the 8 ad-hoc include calls into the slot | `story · 3` | `we:src/block-pages.njk:32-35` (new slot), `fui:src/_data/blocks.json` (optional `fuiDemo` field), `we:.eleventy.js:38` (existing shortcode), the 8 `block-descriptions/*.njk` ad-hoc calls (de-dupe) | — (root) |

Only one slice is buildable today, but it is genuinely batchable now — exactly the work `/split` exists
to manufacture for `/batch`.

### Could not split

| Panel | Rubric condition failed | Unblocking action (→ filed as a `type:decision` card) |
|---|---|---|
| **Props table** | **(1)** buries a real fork: where structured per-component API data originates — hand-authored `fui:blocks.json` fields (WE-side declared contract) vs. an **FUI-side CE-manifest analyzer** over FUI block source, shipped to WE as data — a WE/FUI **boundary/placement** call; renderer (#654) + protocol (#653) already exist, so this is *purely* the data-source decision + a gen-cem projection extension | **D1** — *Per-component API data sourcing for the props table* (`type:decision · story · 3`): rule the source (authored vs FUI-analyzer), then extend `we:scripts/gen-cem.mjs` to project `attributes`/`members`/`slots`/`cssProperties`. On ratification → spins out the (mechanical) props-table page-integration build |
| **Token table** | **(1)/(5)** no wired source: the component token tier covers ~2 of 69, is keyed by component name (not `block.id`), and `webtheme/` isn't exposed to 11ty — what a per-block table shows and how it maps is undecided | **D2** — *Per-component token-table data sourcing* (`type:decision · story · 2`): expose the `webtheme` component tier to the docs data layer, define the `block.id → component-token-key` mapping, and the table's scope (component overrides vs aliased primitives) |
| **A11y panel** | **(1)/(5)** **no source at all**: #770 is a route-level gate, not per-component metadata; nothing on-disk describes a block's roles/keyboard map/WCAG notes — even *what the panel shows* is unspecified | **D3** — *Per-component a11y-panel content + data sourcing* (`type:decision · story · 3`): decide what the panel surfaces (intent/trait-derived a11y metadata? per-demo axe results? authored notes?) and its origin before any build |

**Why three decisions, not one:** the three sources are unrelated (FUI block API surface · webtheme token
tier · nonexistent a11y metadata) with different unblock actions and different repos/layers — collapsing
them would bury three distinct calls in one card. They share only the surface (`we:block-pages.njk`), which
the live-example slice already establishes.

## Proposed mutation (gated on one "go")

1. Re-scope **#727** in place: keep `workItem: story` under `parent: "623"`, **`size 13→3`**, retitle +
   refresh digest to the uniform live-example slot, and **de-bury the four-panel body** — replace the
   props/token/a11y paragraphs with one-line pointers to D1/D2/D3. **Not** converted to an epic (already
   has a parent).
2. Scaffold **D1** `type:decision · story·3`, **D2** `type:decision · story·2`, **D3** `type:decision ·
   story·3`, all `--parent=623`. Each, on ratification, spins out its own build slice (props-table
   integration / token panel / a11y panel) per the prepared-fork → spin-off-builds pattern — no
   ready-looking blocked build cards are pre-filed.
3. Gate on `npm run check:standards`; expect backlog count **+3**.

## Net (focused 727)

- Could split: **#727** (re-scoped to the live-example slot, batchable now). Could not split: props /
  token / a11y panels → **+3 `type:decision` cards** (D1/D2/D3).

---

# Backlog split analysis — #823 (move loan-origination + auto-insurance to FUI)

Date: 2026-06-16 · Focus: `/slice 823` · **Verdict:** splits into **4 slices + 1 de-buried decision card**.

#823 is an **unsliced epic** (`workItem: epic`, `parent: 658`, `locus: frontierui`, no children) executing
#812 Fork-1(a): host the two flagship exercise apps (`loan-origination` #317, `auto-insurance` #318) in
FUI as iframe-embed targets, so the app-coupled blocks deletion (#824) can proceed. An epic skips the
should-we-split question — slices seeded from the body, then verified against both real trees.

## Work-investigation pass (both trees read)

| Fact | Evidence |
|---|---|
| FUI runtime shell present (the router/loader the apps boot on) | `fui:frontierui/plugs/bootstrap.ts:204` `registerRouter(...)` registers route-view/route-outlet/route:link/route:prefetch — the exact elements `we:demos/loan-origination/index.html` + `we:auto-insurance/index.html` consume via `we:/plugs/bootstrap.ts` |
| FUI auto-hosts multi-file demo-apps | `fui:src/_data/demos.js` auto-scans `demos/*.html` (FUI we:AGENTS.md:35); precedent dir `frontierui/demos/durable-tier-verification/` |
| 5 block-impl families the apps compose **already up** in FUI | `frontierui/blocks/{audit,lifecycle,master-detail,selection,stepper,tree-select}` all present (#694); `master-detail`→`selection` edge satisfied |
| 5 renderer-impl deps **NOT** in FUI | `frontierui/blocks/renderers/` = `data-grid` + `we:index.ts` only. Both apps import `../../blocks/renderers/{audit-timeline,data-table,decision-trace,pagination,status-indicator}/…` (`loan we:app.ts:19-32`) |
| Import paths survive the move unchanged… | apps live in `demos/<app>/`, import `../../blocks/…` + absolute `we:/plugs/bootstrap.ts`; both resolve identically under FUI |
| …**except one** WE-only dep, on loan | `loan we:app.ts:29` `import { CustomGuardRegistry } from '../../guard/registry'`, used for real at `:99` `new CustomGuardRegistry()` + `:100 .define(...)`. FUI has **no `guard/` dir, no webguards plug**. guard is a WE *standard model* (Guard protocol #288/#289), not a block-impl family — outside the epic's enumerated bring-up set |
| auto-insurance has **zero** guard dependency | its only guard token is the `GuardResolver` *type* from `lifecycle/LifecycleProvider` (`auto we:app.ts:15`), already up in FUI; no `CustomGuardRegistry`, no `guard/` import |

**The body under-scoped the dependency set.** It names block-impl + renderer deps but misses loan's
`CustomGuardRegistry`. That model lives only in WE, so moving loan breaks it — a real, unaddressed
consequence of #812(1a). It is **not** a mechanical "copy it too": vendoring a WE **standard** into FUI is a
different boundary precedent than #694's **impl**-family migration ([[project_npm_scope_mirrors_layer]] —
@frontierui never imports @webeverything; @webeverything = standard artifacts only). → de-bury as a
`type:decision` card; the loan-host slice blocks on it. auto-insurance is unaffected and stays clean.

## Could split

| Slice | Title | workItem·size | Home | blockedBy | Batchable |
|---|---|---|---|---|---|
| **A** | Bring up the 5 renderer-impl deps to FUI (`renderers/{audit-timeline,data-table,decision-trace,pagination,status-indicator}`), byte-verified UP, WE copies kept (WE keeps the renderer demos); add to `we:blocks/renderers/index.ts` | story · 3 | frontierui | — | ✅ now |
| **C** | Host `auto-insurance` in FUI: move `demos/auto-insurance/` → `frontierui/demos/`, register in the demos public surface, verify it boots on FUI's router shell (deps all present after A + #694) | story · 3 | frontierui | A | ✅ after A |
| **B** | Host `loan-origination` in FUI: move `demos/loan-origination/` → `frontierui/demos/`, **resolve loan's `CustomGuardRegistry` per the guard-boundary decision**, register, verify boots | story · 3 | frontierui | A, guard-decision | ⛔ until decision |
| **D** | WE iframe-embeds both FUI-hosted apps in the docs showcase (`fuiDemo` entries) + file any residual standard-gaps upstream | story · 2 | webeverything | B, C | ✅ after B,C |

Plus one de-buried card:

| Card | Title | type · size | status |
|---|---|---|---|
| **guard-decision** | Resolve loan-origination's `CustomGuardRegistry` (WE standard model) when the app moves to FUI: bring the guard model UP to FUI vs. decouple loan's guard composition | decision · 2 | open (Tier-B; blocks B) |

**DAG:** `A → {C ∥ (guard-decision → B)} → D`.

**Rubric check (all hold):** (1) volume-not-fork settled at epic level (#812(1a)); (2) ≥2 nameable slices,
real homes (A/B/C → frontierui, D → webeverything); (3) each ≤3 — A:3 B:3 C:3 D:2 (near-mechanical
relocation: identical import paths + shell present, not a re-port); (4) clean DAG, real independence (C
delivers without B given A) + incremental (each hosted app a standalone valid state); (5) every slice
leaves a valid demoable state; (6) no slice buries a fork — loan's guard fork extracted to its own
`type:decision` card, B references it.

## Could not split

Nothing in #823 is unsplittable. One slice (**B — host loan**) is *split but blocked*: not agent-ready until
the guard-boundary decision resolves. **Unblocking action:** ratify the guard-decision card (bring the guard
model up to FUI, or decouple loan's `CustomGuardRegistry`). Slices A, C, D are unaffected.

## Proposed mutation (gated on one "go")

1. Keep **#823** an epic in place (already an epic — no story→epic conversion; it carries no `size` to drop;
   refresh digest to umbrella framing if needed).
2. Scaffold the 4 slices under it: `A story·3` (`--parent=823`), `C story·3` (`--blocked-by=A`),
   `B story·3` (`--blocked-by=A,<guard-decision>`), `D story·2` (`--blocked-by=B,C`).
3. Scaffold the **guard-decision** `type:decision · story·2` (`--parent=823`), and replace #823's body
   guard-silence with a pointer to it.
4. Gate on `npm run check:standards`; expect backlog count **+5**.

## Net (focused 823)

- Could split: **#823** → 4 slices (A renderers · C auto-insurance · B loan · D WE showcase) + 1
  de-buried `type:decision` (guard boundary). A and C batchable immediately after A.
- #823 stays an open `epic` — **not** resolved (scope now lives in children).
- #727 stays an open `story` re-scoped to its core — **not** converted to an epic, **not** resolved.
