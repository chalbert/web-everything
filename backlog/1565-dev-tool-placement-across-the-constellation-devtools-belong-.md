---
kind: decision
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#devtools-placement"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-devtool-placement-constellation.md
blocks: ["1553"]
tags: [constellation, devtools, placement]
---

# Dev-tool placement across the constellation — devtools belong in Plateau, not FUI

## Digest

A user ruling (2026-06-22) — **dev-tools belong in Plateau (plateau-app), not FUI** — must become a
precise, codifiable placement rule across the constellation (**WE** = standard/contracts, zero impl
[#1282] · **FUI** = the reference *implementation* of the standards · **Plateau** = the *product* layer).
No design existed for this; the three forks below are grounded in a prior-art survey **published as
[`/research/devtool-placement-constellation/`](/research/devtool-placement-constellation/)** (session
report linked via `relatedReport`), each carrying a recommended default in **bold**. The ruling is *not*
free-standing: it collides with two ratified placements — [#809](/backlog/809/) (block-explorer workbench
is FUI-owned) and the reproduction-conformance program [#1225](/backlog/1225/) ("the deterministic diff
engine is **FUI** (impl/devtool)") — and a blanket "move every tool to Plateau" reading would drag WE's
own conformance verifiers ([#1467](/backlog/1467/)) out of the standard layer. So the open call is the
**exact cut**, not the direction. This decision **blocks [#1553](/backlog/1553/)** (the trainable-judge
constellation boundary, whose Fork 3 assumes where the explorer lives).

## The axis being decided

The survey's load-bearing finding — five external precedents (Chrome DevTools vs Blink/V8; Storybook vs
the component library vs Chromatic; Material Web vs Theme Builder vs the docs site; WPT/Test262; the
monorepo packages-vs-apps split) converge on **one principle that matches the project's own ratified
`project_conformance_verifier_vs_subject` (#1467) exactly: the dividing line is the consumer.** A surface
a *human operates* is a developer **product** (separate from the impl it inspects — "the inspector is not
the thing inspected"); a tool that *reads an implementation's observable output as DATA* is **conformance
machinery that lives with the standard** (WPT/Test262 live with the standard, never inside an engine).

Three axes, each pinned to the real tree:

- **The placement rule itself** — does "devtools → Plateau" *override* the existing capability-seam
  statute wholesale, or *refine* it? The statute today: `we:docs/agent/platform-decisions.md:70-94`
  (constellation-placement rule 1 — runtime/capability-delivery → FUI), `:154`
  (`we-fui-embed-boundary` rule 5 — "Chrome / workbench is FUI-owned"), and `:795-796` (reproduction-
  conformance — "the deterministic diff engine … is **FUI** (impl/devtool), like the #809 block-explorer").
  *Fork 1.*
- **The block-explorer / workbench** (`fui:demos/workbench.ts`, `fui:demos/workbench-host.html`) — ruled a
  FUI-owned *product* in #809 (codified at `we:docs/agent/platform-decisions.md:154`), explicitly because
  its driver is *embedding the chrome on third-party customer sites*. Does the new ruling reverse that, or
  is the workbench carved out of "devtool"? *Fork 2.*
- **The autonomous explorer** (`fui:tools/explorer/`, 44 files) — the direct trigger via #1553. It is
  layered: deterministic harness (`fui:tools/explorer/cli.ts`, `fui:tools/explorer/explorer.ts`,
  `fui:tools/explorer/oracles/genericInvariants.ts`) + a conformance-vector oracle that drives **WE**
  vectors through FUI bindings (`fui:tools/explorer/oracles/conformanceVectors.ts:26` imports
  `@webeverything/conformance-vectors/schema`; `:37` "FUI ships a binding per conformant standard") + an
  advisory vision judge (`fui:tools/explorer/oracles/tier2VlmJudgeModel.ts`, already Plateau per #475).
  Whole-tool → Plateau, or split at the capability seam? *Fork 3.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 · The placement rule | **Refine, don't override: ONE positive test — a developer-operated surface you run against your OWN build → Plateau; conformance machinery (reads output as data, #1467) and build-time impl transforms (#020/#291) are *unchanged*, not "moved"; third-party-embed distribution surfaces are the #809 carve-out** | Wholesale "every developer tool → Plateau, full stop" | High |
| 2 · Block-explorer / workbench | **Carve OUT — stays FUI. Its driver is third-party-site embedding (a distribution/showcase of how FUI is consumed); Plateau-routing re-introduces the cross-origin boundary #809 dissolved. #809 is the cited precedent, NOT reversed** | Reverse #809 → relocate workbench to Plateau | Med-High |
| 3 · Autonomous explorer | **Split at the capability seam (REVISED 2026-06-22): the conformance ENGINE (generic runner + pure judge + binding interface) → WE — it is the standard's implementer-agnostic verifier (#1467/WPT), which lets the explorer test ANY WE implementer; FUI's concrete per-component bindings (subject) stay FUI; vision (Layer-3) stays Plateau (#475); product CLI chrome / orchestration / report-bundling → Plateau** | (b) Whole explorer → Plateau · (c) engine stays FUI (prep's original — superseded) | Med-High |

## Fork 1 — The placement rule: override or refine?

**Fork-existence:** the two branches genuinely cannot coexist — either "devtools → Plateau" is a
*wholesale* rule that supersedes the capability-seam statute (so the explorer's deterministic harness and
the #1225 diff engine both move), or it is a *refinement* that leaves #1467 verifiers in WE and
impl-is-not-a-standard codegen in FUI. The wholesale branch is **broken**: it drags WE's own conformance
verifiers (`auditDataTable`-class, #1467 — they read output as DATA, the WPT/Test262 archetype) out of
the standard layer, which #1467 categorically forbids. So a real either/or that the user's own rationale
("dev-tools are product-shaped") already leans toward refining.

- **(a) Refine — ONE positive test (default).** *A developer-operated surface a human runs to
  inspect / switch / explore / configure an implementation* — workbench, block-explorer, spec/dev-panel,
  autonomous-explorer chrome, configurator — **→ Plateau, full stop.** State it as a single positive test,
  *not* a three-way sort: the other two "buckets" are pre-existing settled law cited as **unchanged**, not
  carved fresh:
  - *reads an implementation's observable output as DATA* (verifier / golden-vector / trace) → **stays
    WE** — unchanged, per `project_conformance_verifier_vs_subject` (#1467) and the WPT/Test262 precedent.
  - *build-time implementation transform / reference-impl generator* (codegen, CSS lowering, bundler
    plugins) → **stays FUI** — unchanged, per impl-is-not-a-standard (#020/#291).
  - **Bundled-surface tiebreaker:** when a surface fuses inspection *chrome* with reference-impl *render
    machinery* (the #809 shape), reuse #809's "chrome decoupled from distribution" seam — but the owner is
    decided by the **third-party-embed test** (Fork 2), not a blanket "chrome → Plateau."
- **(b) Wholesale — every developer tool → Plateau, full stop.** *Rejected (broken):* cleaner to state,
  but it pulls the #1467 conformance verifiers and the #899 vector-runner half out of WE/FUI into the
  product layer, contradicting ratified #1467 and `constellation-placement` rule 1. The simplicity is a
  mirage — it relabels settled, uncontested placements as "in scope" to win a one-liner.

**Default: (a).** `Skeptic: SURVIVES-WITH-AMENDMENT` — the attack ("refined is just disobeying a clear
ruling, and the 3-prong sort relists settled law as if it needed carving, leaving the trigger tool
litigable") was correct on *form*. Folded in: stated as **one positive test** (operated-surface →
Plateau), with #1467 / impl-is-not-a-standard cited as **unchanged** rather than as "refinements," and the
**#809 reversal made an explicit, named question (Fork 2)** rather than left to survive by silence. The
*direction* (consumer-based cut) survived — pure wholesale is too blunt (it breaks #1467).

## Fork 2 — Block-explorer / workbench: reverse #809 or carve out?

**Fork-existence:** #809 (ratified 2026-06-16, codified at `we:docs/agent/platform-decisions.md:154`)
ruled the workbench a FUI-owned product; the new devtools→Plateau ruling makes "relocate it to Plateau" a
coherent, tempting reading (it *is* a human-operated inspection surface). The two cannot both hold — the
workbench is either FUI-distribution or a Plateau dev-tool. The "relocate" branch is the one that turns
out **broken** on the concrete merit below.

- **(a) Carve OUT — stays FUI (default).** The workbench is "reference-impl that only *looks* like
  tooling," not a devtool the ruling targets. The distinguishing test is #809's own driver: it **ships
  embedded on third-party / customer sites** ("embed FUI with the chrome on other sites"), chrome + block
  fused **same-origin inside one iframe** so inspection is intra-FUI host-side DOM with *no* cross-origin
  postMessage protocol. That is a **distribution/showcase feature of how FUI is consumed**, not an
  internal developer tool you run against your own build. So #809 stands; it is the *cited precedent* for
  the carve-out, not a casualty of the new rule.
- **(b) Reverse #809 → relocate workbench to Plateau.** *Rejected (broken):* the claim "Plateau renders
  FUI same-origin, so #809's no-postMessage elegance is preserved" is **false for the driving use case** —
  same-origin holds only *on plateau.app*; a third-party customer site embedding a *Plateau* widget is
  cross-origin to its own page, **re-introducing exactly the host↔guest boundary #809 dissolved.** The
  Storybook/DevTools analogy backfires: those run against *your own* build and never ship embedded on
  customers' production sites — the workbench does. Reversing a six-day-old ratified ruling, on a general
  principle the item itself flagged as merely an *unreconciled tension*, is the reckless move.

**Default: (a).** `Skeptic: SURVIVES-WITH-AMENDMENT → flipped the original default.` The prep's first
default was (b) reverse-to-Plateau; the skeptic refuted it on the third-party-embed merit (Plateau-routing
breaks same-origin) and on process (don't reverse #809 by silence). Folded in: the default is now the
**carve-out**, with the **third-party-embed test** as the explicit distinguishing rule (*ships embedded on
customer sites = FUI distribution; runs against your own build = Plateau dev-tool*). The WE-standards
introspection panels #809 already split to a WE-docs overlay are unaffected.

## Fork 3 — Autonomous explorer: whole-tool to Plateau or split?

**Fork-existence:** the explorer is the direct trigger (#1565 was opened because #1553's Fork 3 boundary
assumes where it lives). "It's a developer-facing UI-testing *product* → move the whole thing to Plateau"
is a coherent reading (Storybook is wholesale a product in the apps layer). But it **cannot coexist** with
keeping the conformance harness where the data-consumer rule (Fork 1 (a) / #1467) puts it — you either
relocate the Layer-2 vector oracle to Plateau or you don't. The whole-tool branch is **broken** by the
project's own #1467 rule.

- **(a) Split at the capability seam (default — REVISED in discussion 2026-06-22, see below).** Four homes:
  - **Conformance ENGINE → WE.** The generic `runConformanceVector` runner (verb-agnostic step dispatcher),
    the *pure* `judgeConformanceTrace` (trace-vs-`expect` comparison), the `ConformanceBinding` interface,
    and `VirtualClock` — all in `fui:tools/explorer/oracles/conformanceVectors.ts` today, all
    **implementer-agnostic** (they touch no impl internal, only the binding interface). This is the
    **standard's conformance verifier** — the WPT/Test262 archetype — so by `project_conformance_verifier_vs_subject`
    (#1467: "WE keeps the verifier that reads output as DATA + vectors; the subject it tests → FUI") it
    belongs in **WE**. It is what makes the explorer testable against **any** WE implementer, not just FUI.
    Allowed in WE despite #1282 — #1467 explicitly carves out conformance verifiers.
  - **Concrete bindings (the SUBJECT adapters) → FUI.** `fui:blocks/*/...Conformance.ts` (e.g.
    `fui:blocks/deck/deckConformance.ts` — "the FUI-owned adapter that drives a real `DeckBehavior`").
    These already live next to the FUI components and `import` the engine — they are the per-component
    subject side. Other WE implementers ship their own bindings against the same WE engine + WE vectors.
  - **Vision (Layer-3) → Plateau.** `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts` — already codified
    Plateau by #475 no-leakage; unchanged.
  - **Product CLI chrome → Plateau.** `fui:tools/explorer/cli.ts`, `fui:tools/explorer/cliRouting.ts`,
    `fui:tools/explorer/routeDiscovery.ts`, `fui:tools/explorer/reportBundle.ts` — the "point it at any
    URL" orchestration + report-bundling *is* the genuine developer-operated product surface. It moves to
    Plateau and consumes the **WE** engine + the target implementer's binding + Plateau vision as services.
  - **Layer-1 generic invariants** (`fui:tools/explorer/oracles/genericInvariants.ts`, app-agnostic
    no-crash / no-a11y-violation) — neither WE-conformance nor FUI-specific; **residual**, homed on the
    relocation slice (lean Plateau product-engine, arguably a shared platform-UX lib). Not ruled here.
- **(b) Whole explorer product → Plateau (engine included).** *Rejected (broken):* drags the conformance
  engine + WE-vector judging into the product layer, violating #1467 and `constellation-placement` rule 1.
- **(c) Engine stays FUI (the PREP's original (a)).** *Superseded in discussion:* keeping the generic
  runner+judge in FUI assumes FUI is the only implementer — it would make *FUI own the test that rules
  whether FUI's competitors conform to the WE standard*, which is backwards. The prep conflated the generic
  **engine** (implementer-agnostic verifier → WE) with the per-component **binding** (subject → FUI); the
  multi-implementer goal forces them apart.

**Default: (a, revised).** `Discussion 2026-06-22 → engine flipped FUI → WE.` The prep's (a) put the whole
driver in FUI (citing `we:docs/agent/platform-decisions.md:795-796` "diff engine is FUI"). The user's goal
— *run the explorer against other WE implementers* — exposes that the generic runner+judge are the
standard's conformance verifier (WPT precedent the prep itself cited but mis-homed), so they belong in WE;
only FUI's concrete per-component bindings are the subject side that stays FUI. Code grounding:
`fui:tools/explorer/oracles/conformanceVectors.ts` holds a verb-agnostic runner + a *pure* judge + the
binding interface; `fui:blocks/deck/deckConformance.ts` is FUI's concrete binding importing that engine —
the dependency direction inverts cleanly to WE→FUI (no backward dep; #700/#872 respected). The
reproduction-conformance "diff engine is FUI" line (`we:docs/agent/platform-decisions.md:795-796`) is the
*deterministic-diff* engine of a different program (#1225), not this vector verifier — note the distinction
when codifying so they don't read as contradictory.

---

## Context

### Standing test (pass 0) — the principle itself is not a fork

The user *gave* the principle (devtools → Plateau); it is the frame, not a choice. What is genuinely
open is its **precise scope** (Fork 1) and the two concrete placements where it collides with ratified
rulings (Forks 2–3). Every other tool's placement falls out of Fork 1's cut as **mechanical
classification**, below — not a decision.

### Tool census & classification (supported by default, not forks)

Full inventory from the constellation-wide sweep, classified under Fork 1 (a)'s consumer/embed cut:

| Tool | Path | Character | Home |
|---|---|---|---|
| `check:standards` suite + backlog CLIs | `we:scripts/*.mjs` | reads WE spec as data (repo conformance) | **WE** (unchanged) |
| Trait-manifest contract | `we:tools/trait-enforcer/traitManifestContract.ts` | pure contract | **WE** (unchanged) |
| `auditDataTable`-class verifiers | WE `we:check.ts` gates | reads output as DATA (#1467) | **WE** (unchanged) |
| scope-isolator | `fui:tools/scope-isolator/` | build-time CSS transform | **FUI** (unchanged) |
| trait-enforcer impl (multi-bundler) | `fui:tools/trait-enforcer/` | build-time impl | **FUI** (unchanged) |
| gen-wrapper (CEM→framework codegen) | `fui:tools/gen-wrapper/` | reference-impl generator (#855) | **FUI** (unchanged) |
| ingest-adapter | `fui:tools/ingest-adapter/` | reference-impl generator | **FUI** (unchanged) |
| maas serve plugin | `fui:tools/maas/` | serve-time impl | **FUI** (unchanged) |
| mock-server | `fui:tools/mock-server/` | dev utility, run against own build | **→ Plateau** (relocate) |
| **block-explorer / workbench** | `fui:demos/workbench.ts` | 3rd-party-embed distribution (**Fork 2**) | **FUI** (carve-out) |
| **explorer — conformance ENGINE** (generic runner + pure judge + binding interface + clock) | `fui:tools/explorer/oracles/conformanceVectors.ts` | implementer-agnostic verifier; reads output as DATA; runs WE vectors against ANY binding (**Fork 3**) | **→ WE** (relocate; #1467/WPT) |
| **explorer — concrete bindings** (subject adapters) | `fui:blocks/*/...Conformance.ts` (e.g. `fui:blocks/deck/deckConformance.ts`) | per-component subject adapter (**Fork 3**) | **FUI** (stays; co-located w/ components) |
| **explorer — Layer-1 generic invariants** | `fui:tools/explorer/oracles/genericInvariants.ts` | app-agnostic no-crash / no-a11y (**Fork 3 residual**) | **→ Plateau** (residual; ruled on the slice) |
| **explorer — vision (Layer-3)** | `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts` | vision capability (#475) | **Plateau** |
| **explorer — CLI / orchestration chrome** | `fui:tools/explorer/cli.ts` | operated product surface (**Fork 3**) | **→ Plateau** (relocate) |
| dev-panel / spec-explorer Vite plugin | `we:tools/dev-panel/` + `fui:tools/dev-panel/` (byte-dup) | operated dev surface | **→ Plateau** (relocate + de-dup) |
| Technical Configurator | `plateau:src/technical-configurator/` | operated product surface | **Plateau** (already correct) |
| dev-browser / IDE-bridge | `plateau:src/dev-browser/` | operated product surface | **Plateau** (already correct) |
| intent-configurator | `plateau:src/intent-configurator/` | operated product surface | **Plateau** (already correct) |
| design/vision-review, compatibility-map | `plateau:src/*-review/` | operated product surfaces | **Plateau** (already correct) |

### Relocation slices to scaffold at resolution (build work, not this decision)

The decision rules placement; the moves are downstream items (carve standalone per
`feedback_distributed_placement_standalone_slices`):
1. Relocate the explorer **conformance ENGINE** (generic `runConformanceVector` + pure
   `judgeConformanceTrace` + `ConformanceBinding` interface + `VirtualClock`) `fui:tools/explorer/oracles/`
   → **WE** (a `@webeverything/conformance-vectors` runtime sub-path or sibling package). FUI's concrete
   `fui:blocks/*/...Conformance.ts` bindings re-point their import to the WE engine (WE→FUI; #700/#872).
   This is the move that makes the explorer testable against any WE implementer.
2. Relocate the explorer **CLI chrome / orchestration / report-bundling** FUI → Plateau (consumes the WE
   engine + the target's binding + Plateau vision as services; thin seam). Decide Layer-1
   `fui:tools/explorer/oracles/genericInvariants.ts`'s home here (Plateau product-engine vs shared
   platform-UX lib).
3. Relocate **mock-server** FUI → Plateau.
4. **De-duplicate + relocate** the dev-panel / spec-explorer Vite plugin (byte-copied WE+FUI today;
   sub-question for the slice: Plateau-owned vs a shared package each dev server consumes).
5. (No move) Confirm Technical Configurator / dev-browser / intent-configurator already-correct.

### Downstream consequence to name

The reproduction-conformance diff-engine line (`we:docs/agent/platform-decisions.md:795-796`, "diff
engine is FUI") is **consistent** with Fork 3's split — the deterministic harness stays FUI, only the
*chrome* relocates. Note it explicitly when codifying so the two rules read as aligned, not contradictory.

## Decided

### Fork 1 — RATIFIED 2026-06-22

The placement rule **refines, does not override** the capability-seam statute. It is **one positive
test**, not a three-way sort:

> **A developer-operated surface a human runs to inspect / switch / explore / configure an
> implementation — against your OWN build — belongs in Plateau.**

The other two buckets are pre-existing settled law, cited **unchanged** (not "moved"):
- *reads an implementation's observable output as DATA* (verifier / golden-vector / trace) → **stays
  WE**, per `project_conformance_verifier_vs_subject` (#1467) + the WPT/Test262 precedent.
- *build-time implementation transform / reference-impl generator* (codegen, CSS lowering, bundler
  plugins) → **stays FUI**, per impl-is-not-a-standard (#020/#291).
- **Bundled-surface tiebreaker:** when a surface fuses inspection *chrome* with reference-impl *render
  machinery* (#809 shape), the owner is decided by the **third-party-embed test** (Fork 2), not a
  blanket "chrome → Plateau."

The wholesale "every developer tool → Plateau" branch is **rejected (broken)**: it drags WE's own
#1467 conformance verifiers and the #899 vector-runner half out of the standard/impl layers into the
product layer, contradicting ratified #1467 and `constellation-placement` rule 1. Red-team ("refining
is just disobeying a clear ruling") answered: the refinement is *forced by other ratified law* (#1467,
#809), not by reluctance to relocate — the consumer-based cut the user's own "dev-tools are
product-shaped" rationale already leans toward survives; pure wholesale does not.

### Fork 2 — RATIFIED 2026-06-22

The block-explorer / workbench **stays FUI** — carved OUT of the devtools→Plateau rule, with #809
cited as the standing precedent (**not reversed**).

> **Ratifying rationale (user): it is *impl*, not a tool.** The workbench is reference-impl — a
> FUI-owned page that ships as an embeddable `<iframe>` distribution (`fui:demos/workbench.ts`,
> `fui:demos/workbench-host.html`; `fui:workbench/index.ts`) showing *how FUI is consumed*. It is not
> a developer tool you run against your own build.

The **third-party-embed test** is the supporting mechanism, not the headline: the workbench ships
embedded same-origin on third-party / customer sites (chrome + block intra-frame, **no postMessage
protocol**). Routing it through Plateau would break that — a Plateau widget on a customer page is
cross-origin again, reopening the boundary #809 dissolved. So Fork 1's "operator-facing → Plateau"
test does **not** reach it: it falls under *reference-impl that only looks like tooling* (the Fork 1
bundled-surface tiebreaker resolves to the embed test, and the embed test says FUI). The WE-standards
overlay rendered *around* the embed stays WE-docs chrome (#755 split), unaffected.

### Fork 3 — RATIFIED 2026-06-22 (engine flipped FUI → WE in discussion)

The autonomous explorer **splits at the capability seam**, with the conformance engine homed in **WE**
(the discussion-driven revision of the prep's "engine stays FUI"):

> **The conformance ENGINE — generic `runConformanceVector` runner + pure `judgeConformanceTrace` +
> the `ConformanceBinding` interface + `VirtualClock` — is the standard's implementer-agnostic
> verifier → WE.** It is what lets the explorer test **any** WE implementer, not just FUI (the
> WPT/Test262 archetype; #1467 "WE keeps the verifier that reads output as DATA + vectors").

- **Conformance engine → WE** (`fui:tools/explorer/oracles/conformanceVectors.ts` today → a
  `@webeverything/conformance-vectors` runtime home).
- **Concrete per-component bindings (the subject) → FUI** (`fui:blocks/*/...Conformance.ts`, e.g.
  `fui:blocks/deck/deckConformance.ts`) — other WE implementers ship their own against the WE engine.
- **Vision (Layer-3) → Plateau** (#475, unchanged).
- **Product CLI chrome / orchestration / report-bundling → Plateau** (consumes WE engine + target
  binding + Plateau vision).
- **Layer-1 generic invariants → residual**, ruled on the relocation slice.

**Ratifying rationale (user):** *we want to run the explorer on other WE implementers* — so the
generic verifier cannot belong to one implementer (FUI owning the test that judges its competitors is
backwards). The prep's "engine stays FUI" conflated the implementer-agnostic engine with FUI's
concrete bindings; the multi-implementer goal forces them apart. Dependency direction inverts cleanly
to WE→FUI (#700/#872 respected). The `reproduction-conformance` "diff engine is FUI"
(`we:docs/agent/platform-decisions.md:795-796`) is a *different* engine (#1225's deterministic diff),
not this vector verifier.

### Codification

All three forks + the consumer/embed placement rule are codified as the persistent statute
**`we:docs/agent/platform-decisions.md#devtools-placement`** (cross-refs `constellation-placement`,
`we-fui-embed-boundary` #809, `no-leakage-client` #475, `reproduction-conformance` #1225, #1467) — a
cite-able rule so future placement calls reference it rather than re-deciding. **Unblocks
[#1553](/backlog/1553/)**; relocation slices scaffolded as separate build items.
