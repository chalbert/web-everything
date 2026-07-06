# Backlog split analysis — 2026-07-05 (`/slice 1294`, focused)

**Candidate:** #1294 — *Relocate WE-resident logic reference runtimes to FUI* (roadmap epic, `kind: epic`,
`status: open`). Downstream of the zero-implementation rule (#1282 / `we:docs/agent/platform-decisions.md#constellation-placement`).

## Standing

#1294 is a heavily-carved roadmap epic. Every prior-carved subsystem is **resolved**:
webpolicy (W1–W4), webcompliance (C1–C5 + #1819), webtheme, intl, analytics, reliability. All children
in the tree are `status: resolved`; the epic itself is still `open`.

Three subsystems were left as *could-not-split* by the prior run
(`we:reports/2026-06-27-split-analysis-1294-webcompliance.md`), pending a **per-subsystem conformance-shape /
placement read**: **process, webtraits, webcases**. This run performs that code-grounded read for each.
The two gates that once parked the epic are now both cleared — the conformance surface foundation landed
(#1783/#1789/#1790, plateau-hosted iframe #1788) and the non-verdict conformance model resolved (#1816,
codified `we:docs/agent/platform-decisions.md#non-verdict-conformance-matcher`).

---

## Could split

### process — CAN SLICE (5-story cascade P1–P5)

The `webprocess` self-driven-artefact protocol. The file seam is already cut for the move: `we:process/contract.ts`
is pure compile-erased definition (its own header, `we:process/contract.ts:2-9`, names the runtime half as
"impl [that] lives in FUI"). The other four files are delivery runtime that **drives/decides** and violate
#1282:
- `we:process/driver.ts` — the decision engine: `runnableSteps` frontier (`:72-81`), `effectiveCeiling`
  throttle (`:98-111`), and the shipped `defaultToleranceThrottle` policy (`:39-46`). Self-labelled impl (`:14-15`).
- `we:process/registry.ts` — stateful `AutonomyLevelRegistry` runtime (`:48-108`).
- `we:process/provider.ts` — trust-boundary seam-guards, self-labelled "the runtime-impl half" (`:2`); these are
  the driver's runtime guards on foreign artefacts (`we:process/driver.ts:21` imports `assertStep`), **not** repo validate-scripts.
- `we:process/index.ts` — default wiring `createDefaultSeam`/`DEFAULT_RECIPE` (`:30-50`).

**Conformance shape — settled, no new machinery.** The driver emits non-verdict structured output; it
classifies onto the interaction-script `ConformanceVectorSuite` + `SynchronousConformanceBinding` (process is
clock-free) with the #1816 closed matcher vocabulary — `exact` (ceilings, booleans, `rank`), `deep-equal`/
`predicate` (`runnableSteps` frontier), `predicate` (guard rejections throwing `ArtefactContractError`).
Source invariants already live in `we:demos/webprocess-conformance-demo.ts:53-170`.

**Rubric:** all five hold — genuine relocation volume (no buried fork; both gates cleared), ≥2 nameable slices
each with a real home (`we:contracts/webprocess.ts`, `fui:webprocess/`, WE vector corpus, plateau iframe), each
slice ≤3/task, strictly linear DAG, and every slice leaves the WE demo green (it keeps importing
`we:process/index.ts` until P5 deletes it, only after the iframe P4 is proven — the webpolicy W1–W4 precedent).

Cascade (mirrors the carved webcompliance C1–C5, since — like webcompliance — the contract entry must still be published):

| Slice | Title | workItem | size | blocked-by | Surface |
|---|---|---|---|---|---|
| **P1** | Publish the `@webeverything/contracts/webprocess` pure-contract entry | task | 1 | — | new `we:contracts/webprocess.ts` (`export type * from '../process/contract'`); FUI `fui:tsconfig.json` path (`:75-76`) |
| **P2** | Relocate the webprocess runtime → FUI | story | 3 | P1 | move `we:process/{driver,registry,provider,index}.ts` → `fui:webprocess/`; repoint imports to `@webeverything/contracts/webprocess` |
| **P3** | Author the WE webprocess binding + vector corpus | story | 3 | P2 | new `we:conformance-vectors/webprocess.vectors.ts` (interaction-script, exact/deep-equal/predicate); register in `we:conformance-vectors/index.ts`; `fui:webprocess/webprocessConformance.ts` factory; invariants from demo `we:demos/webprocess-conformance-demo.ts:53-170` |
| **P4** | Wire the webprocess docs conformance page via the plateau iframe | task | 2 | P3 | `we:demos/webprocess-conformance-demo.ts:10-24` — drop build-time `we:process/index.ts` import, surface plateau iframe |
| **P5** | Delete the WE webprocess runtime, keep contract + vectors | task | 2 | P4 | delete `we:process/{driver,provider,registry,index}.ts` + runtime test; retain `we:process/contract.ts` + `we:contracts/webprocess.ts` + `we:conformance-vectors/webprocess.vectors.ts` |

Net: +5 slices, `process` reaches the #1282 end-state.

---

## Could not split

### webtraits — partial descope + 1 decision fork

Two resolvers, split verdict:

- **`we:webtraits/intentProfileResolver.ts` (#776) — DESCOPE (legitimately WE-resident, ratified).** A *ratified*
  platform decision — `we:docs/agent/platform-decisions.md#custom-intents-namespace-by-ownership` (#1948) — names
  it "**the #776 WE resolver**" and places the reusable build-time substrate that *invokes* it as a
  **bundler plugin → FUI** (`fui:tools/intent-resolver/`, structural twin of `fui:tools/trait-enforcer/`).
  The resolver stays WE; FUI's tool is its *consumer*. Relocating it reverses ratified statute — not a slice.
  Remove from #1294 scope.

- **`we:webtraits/surfaceIntentResolver.ts` (#1911) — CANNOT SLICE — buries a definition-vs-impl fork.**
  #1911 resolved it as a "pure, dependency-free WE-resident resolver … definition not impl, so it stays in WE"
  (`we:backlog/1911-realize-the-surface-intent-resolve-texture-interaction-eleva.md:20`). But `surfaceCss()`
  (`we:webtraits/surfaceIntentResolver.ts:157-166`) emits a full CSS ruleset **string** (base +
  `:hover/:focus-visible` + `@media (prefers-reduced-motion)`) — exactly the shape of webtheme's `compileToCss`,
  which the #1294 cascade **relocated to FUI** (with conformance judged on the structured `resolveTokens` map,
  not the CSS string — #1816 ruling 2). So there are two ratified readings: *stays-WE* (definition, #1911) vs
  *relocate-to-FUI* (impl, by the webtheme/#1816 precedent). **Rubric (1) fails** — a slice here would silently
  pick a side of a live placement fork.
  - **Unblocking action:** file `type:decision` — *"Are the CSS-emitting presentation-axis resolvers definition
    (stay WE, #1911) or impl (relocate to FUI like webtheme's `compileToCss`, #1816)?"* The
    `#presentation-axis-is-intent-owned` reversibility clause already frames this as a fresh merit fork. On
    ratification the slice is mechanical (S1 extract types → S2 relocate → S3 binding/`deep-equal` on
    `resolveSurface` → S4 iframe → S5 delete).

### webcases — 3 descope + 2 decision forks

Five files; none has an external consumer outside its own `we:webcases/__tests__/`, so nothing is stranded either way.

- **DESCOPE (legitimately WE-resident):**
  - `we:webcases/requirementValidator.ts` — pure author-time slot resolver over WE's own registries (injected,
    never imported), `:103-179` — a rule-#6 validate-script (the #100 meta-schema/validator).
  - `we:webcases/compileRequirement.ts` — deterministic corpus codegen over WE definitions, "no I/O, no clock"
    (`:9-11`), `:57-91`. Not a verifier, not a live runtime.
  - `we:webcases/caseToVector.ts` — deterministic WE-vector generation; its header draws the line: "produces the
    vector *contract*; executing + judging it stays the FUI/plateau driver's job" (`:15-16`), `:67-100`.

- **CANNOT SLICE — each buries an unresolved placement fork with no decided home (rubric (1) + (2) fail):**
  - **`we:webcases/driftCheck.ts`** (`detectDrift`, `:97-113`) reads an implementation's recorded output and
    computes a pass/fail verdict — the exact shape #1566 relocated to Plateau — yet its header cites the older
    **#334** ruling "`webcases` is the verification home" (`:2-15`). #1566 did not amend #334; direct
    contradiction. Output is a bespoke `DriftReport` (JSON-Pointer diffs), **not** a #899 vector, so the #1816
    matcher does not apply. No home exists in FUI or Plateau.
    - **Unblocking action — file `type:decision` D1:** does #1566's verifier→Plateau principle extend to
      mock-vs-real drift verification, overriding #334? If it relocates: **FUI** (co-locate with the
      `fui:tools/mock-server` `record` transport it pairs with) or **Plateau** (neutral verifier, per #1566)?
  - **`we:webcases/generateCase.ts`** (`generateCase`, `:68-95`) drives an AI propose→verify→compile loop over an
    injected `RequirementProposer` that is "a Plateau-served provider (#475)" (`:12-16,37-43`). Pure
    orchestration, but the real run drives a live Plateau provider — the #1566 "the *run* is a Plateau product"
    shape. Whether the loop *harness* is a WE authoring tool (stays, injected seam) or a Plateau generation
    feature (relocates) is undecided.
    - **Unblocking action — file `type:decision` D2:** is the generation *run* a Plateau product feature
      (relocate the loop) or a WE authoring loop over injected seams (stays)?

---

## Summary

| Subsystem | Verdict | Action |
|---|---|---|
| **process** | **CAN SLICE** | Carve P1–P5 under #1294 |
| **webtraits** | Cannot split | Descope `we:webtraits/intentProfileResolver.ts` (ratified WE, #1948); file 1 decision fork for `we:webtraits/surfaceIntentResolver.ts` |
| **webcases** | Cannot split | Descope 3 files (validate-scripts / codegen); file 2 decision forks (D1 driftCheck, D2 generateCase) |

**Proposed on-disk mutation (gated on one "go"):**
1. Scaffold **process P1–P5** under #1294 (`--parent=1294`, DAG P1→P2→P3→P4→P5).
2. File **3 `type:decision` cards** under #1294, `status: open` + `priority: low` (the decision lane ranks
   them; a parked decision without a structural blocker is rejected by the gate) — surfaceIntentResolver
   placement (#2298), driftCheck placement/D1 (#2299), generateCase placement/D2 (#2300).
3. **De-bury #1294:** refresh its *Carve status* — process CARVED; webtraits/webcases resolved to
   descope + parked forks (replace the inline "could not split" prose with pointers to the three cards).
4. Gate on `npm run check:standards`.
