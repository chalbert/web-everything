---
bornAs: xbr0f4a
kind: story
size: 3
parent: "2676"
status: open
dateOpened: "2026-07-27"
preparedDate: "2026-10-01"
preparedAgainstSha: "43692f76491c8d2620cef8ca03ba73a5f820d235"
scope:
  - we:docs/agent/build-ui.md
  - we:skills-src/build-ui/SKILL.md
  - we:skills-src/design-committee/SKILL.md
scopeRationale: "Doc/skill-only fold of a proven-by-hand technique into the existing build-ui method, the same shape as the sibling we:backlog/2708 (identical parent, identical file pair, size 3, resolved). we:.claude/skills is a symlink to we:skills-src (verified: readlink .claude/skills -> ../skills-src), so editing we:skills-src is the only skills-side edit — no separate we:.claude/skills edit, and no code/tooling: there is no existing generic mock-screenshot script this would extend (plateau-app:tests/visual/capture.mjs and plateau-app:tests/visual/render-baselines.mjs capture already-built app ROUTES, not self-contained pre-build mock HTML files, and have no state-driving hook)."
tags: []
deliveryAgent: codex
---

# Full-scale interactive rendering + state-driving for sighted review

Preserve the goal: make full-scale, interactive mock review reproducible through named states in both themes. This is the **method slice** of the Plateau progress-view work: document the convention before applying it to a product mock. It does not implement the progress view or change its wire semantics.

Historical motivation was the feature-tracking-screen session, where the author reported density defects at roughly 31 features: heavy collapsed rows and repeated velocity panels. That is session testimony, not a measured production-volume requirement or a reproduced finding in this preparation. Historical artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d (not re-opened here).

## Progress

Preparation checked the main version of we:skills-src/conveyor/prepare-item-worker-brief.md:3-18 and current local sources. Only this card is edited. The explicit job instruction owns stamping; no implementation, commit, push or PR is part of preparation.

For this job's required `we:` path spelling, **we:../plateau-app/** denotes the sibling Plateau product repository, not WE-owned implementation. Scope ownership must still normalize that sibling to plateau-app when a successor is scaffolded.

| Old premise / scope | Corrected premise / scope and evidence |
| --- | --- |
| The existing method lacks realistic-volume and named-state requirements. | Still a gap in the targeted phases: we:docs/agent/build-ui.md:50-54 requires real field shapes; :95-99 requires screenshots of matrix cells in both themes but supplies no hook. Full-scale assembled-page review already exists at :154-172; preserve it, add the earlier mock requirement without renumbering phases. |
| Both visual scripts capture only built routes; there is no static-mock path. | Incorrect. we:../plateau-app/tests/visual/render-baselines.mjs:4-17 explicitly distinguishes static console-grammar mock and live board; :39-45 configures both. we:../plateau-app/tests/visual/capture.mjs:54-63 navigates, waits for fonts and captures, but does not enumerate named mock states. Remove the repo-wide claims of zero HTML mocks / zero screenshot tooling. |
| State-driving must be invented without a current product seam. | The existing renderer takes connection, snapshot, clock, expanded groups and open cards through `WipView` (we:../plateau-app/src/wip/wip-view.ts:35-56). Production mounting reads the wall clock and live/polled sources (:492-545); deterministic mock driving must not inherit those moving inputs. This supports an isolated review harness, not a production global hook. |
| The progress contract is only future design. | The landed contract already accepts schema 1 and 2 (we:contracts/plateau-progress-view.schema.json:5-12). Its legacy branch says absent progress sections remain unknown (:1144); schema 2 is distinct (:1146-1150), with ownership/rollout constraints at :1500. Existing product `WipSnapshot` still declares schema 1 (we:../plateau-app/src/wip/types.ts:183-184); its producer emits 1 (we:../plateau-app/src/wip/wip-model.ts:306). Do not cast schema-2 examples into that renderer or claim schema-2 product delivery. |
| No tests or tooling considerations exist; standards alone proves completion. | Existing declarative tests accept examples and reject invalid counts/versions/missing freshness (we:contracts/plateau-progress-view.test.ts:10-44), and pin legacy compatibility and non-human flow cases (:53-67). Existing WIP tests cover connection states (we:../plateau-app/src/wip/wip-view.test.ts:40-80). These are useful regression evidence, but neither proves realistic visual density or a working mock hook. Add the explicit behavioral and sighted proof plan below. |

The preserved frontmatter `scopeRationale` contains the old route-only claim; this Progress correction supersedes it. The worker brief permits edits only to body, scope and preparation stamps, so other frontmatter is preserved verbatim rather than silently rewritten.

## Design

Keep #2694's existing WE method ownership and goal. Update only the existing phase-2/3 guidance and the two skill pointers; no new phase, generic capture engine, runtime standard or production global API. Canonical placement remains we:docs/agent/platform-decisions.md:143-164 (`#constellation-placement`): product rendering belongs in Plateau; contract/conformance definitions belong in WE.

1. In phase 2 of we:docs/agent/build-ui.md:48, require a stated realistic dominant-collection count and provenance for that count, plus long labels/details and representative status distribution. A roughly 31-row mock may reproduce the historical exercise, but is not a universal threshold. Include empty and small collections as separate cases, not replacements for density review.
2. In phase 3 at we:docs/agent/build-ui.md:93, document the mock-only `window.__setState(caseId: string): void | Promise<void>` convention and its `cases: string[]` property. Case IDs come from the phase-1 matrix, must be unique and stable, and an unknown ID throws before mutating the current case. Every call resets all case-owned state, including clock, selection, disclosure and data, so A→B→A produces the same rendered A. The hook leaves theme selection to the capture loop.
3. Completion means the requested case is rendered, including async work. The driver awaits the return and an explicit render-ready condition plus fonts before capturing; a fixed sleep alone is not readiness evidence. Capture each declared case in light and dark with a fixed viewport, deterministic clock/data and animations settled. Use a documented surface/case/theme/viewport filename tuple to prevent overwrites. These are proposed mock conventions, not additions to the progress wire schema.
4. Add the toy-scale honesty clause to the existing list at we:docs/agent/build-ui.md:199. Condense the additions into we:skills-src/build-ui/SKILL.md:24-33 and a pointer at we:skills-src/design-committee/SKILL.md:44; keep the method authoritative rather than copying a second specification.

Use the Plateau progress view as the concrete worked matrix. The examples already provide partial history, stale cache, missing trend baseline, conflicting plan, cold history, pending review and red CI without human action, and schema-1 compatibility (we:contracts/plateau-progress-view.examples.json:2, :215, :428, :641, :868, :1081, :1311, :1541). Preserve their unknown-versus-zero and source-freshness distinctions. A scale fixture should derive additional uniquely identified rows and consistent totals from these shapes; blindly duplicating an example is insufficient. Cross-field arithmetic and source joins are consumer responsibilities, not guaranteed by JSON Schema (we:contracts/plateau-progress-view.schema.json:4).

## MVP

The independently useful deliverable is the WE method update: realistic volume, complete named-state contract, deterministic capture recipe, both-theme review and concise skill pointers. Document the progress matrix above as a worked application without claiming a current schema-2 renderer. Do not modify the landed schema or examples just to accommodate a harness.

**Scope including verification:** the three existing frontmatter paths are the complete intended WE edit set. Existing regression input is we:contracts/plateau-progress-view.test.ts:10-84 (run, not edit). No implementation-mirroring prose test is needed. Any reusable executable harness would require its own behavior tests and belongs to the product successor below; do not smuggle it into a doc-only scope.

### Per-repo delivery proposal (#4289)

The operator ruling at we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:19-21 selects contract predecessor / consumer successor for #4620 while retaining coupled delivery as a future feature. Apply that seam rather than expanding this method card into an unsupported mixed build:

- **WE / #2694:** the three declared method/skill files. Independently accepted when the convention and worked matrix are reviewable and checks pass. The existing schema, examples and declarative test are read-only prerequisites already present, not a new contract story.
- **Plateau / proposed successor, not scaffolded here:** a self-contained progress-review mock at proposed we:../plateau-app/docs/mocks/plateau-progress-view.html; a named-state capture driver at proposed we:../plateau-app/tests/visual/plateau-progress-view-capture.mjs; browser behavior tests at proposed we:../plateau-app/tests/visual/plateau-progress-view.spec.ts; fixtures at proposed we:../plateau-app/tests/visual/fixtures/plateau-progress-view.json. Depend on #2694's landed method and pin the existing WE schema/examples revision. Its independent acceptance is a working interactive mock, validated fixtures and the complete reviewed screenshot matrix. This is a proposal, not an allocated card or an existing test path.
- The later **production** schema-2 consumer remains the #4620 delivery, not this successor's hidden responsibility. A schema-1 exercise can use the existing pure renderer; the schema-2 mock remains explicitly a mock until the consumer lands. No publisher/relay changes, credentials or live commands are necessary for sighted review.

If a new contract change becomes necessary, propose a separately validated WE predecessor and a Plateau consumer dependency before dispatch. Do not disguise mixed ownership through path spelling or treat #4289 as a permanent ban on coupled delivery.

## Test plan

For the WE method change, review each stated interface property against the worked progress matrix; check that phases and existing references remain stable. Run the existing declarative contract test and required WE gates from the WE checkout:

```bash
npx vitest run contracts/plateau-progress-view.test.ts
npm run check:standards
node scripts/verify-lane.mjs
```

Passing these checks proves consistency, not rendered quality.

The proposed Plateau successor must include behavior tests in its declared browser-test scope:

- Enumerate every unique advertised case; fail on unknown ID without changing the prior state; await asynchronous cases before inspection.
- Drive A→B→A and compare the case-owned DOM/state, including restored clock and disclosures. Assert no live polling, command requests or publisher dependency during review.
- Validate every wire fixture against the pinned contract, then separately check unique identities, cross-field totals and source joins. Exercise schema-1 missing sections, schema-2 unknown values, stale source under fresh publisher, partial/cold history and non-human pending-review/red-CI states.
- Assert actual full-scale row count, long-text wrapping, operable expansion/collapse, keyboard focus visibility and no horizontal overflow at the declared narrow and desktop widths. Check case × theme × width coverage, unique filenames and readiness before screenshot.

Keep current product regressions in view: we:../plateau-app/src/wip/wip-view.test.ts:40-80 covers connection semantics; :421-437 covers missing/finished scopes. A future product change must run its own repo gate and affected tests; WE's green gate cannot substitute for Plateau verification.

## Proof plan

For this card's eventual method delivery, attach the text diff and successful WE checks. Do not label the product harness implemented or the pixels reviewed based on that evidence.

For the proposed application, serve the actual mock in a browser, record mock/fixture/contract revisions, selected volume with rationale, fixed clock, viewport and theme. Drive every advertised case on the same page, collect the complete screenshot matrix, and inspect the PNGs at realistic density in both themes. Demonstrate unknown-ID rejection, A→B→A reset and at least one real keyboard/disclosure interaction. Record count/wrapping/overflow assertions beside the visual findings. Show stale/unknown values honestly rather than substituting zero; no screenshot alone proves the wire arithmetic. Retain failing evidence and re-capture after fixes; baseline regeneration alone is not a pass.

Preparation itself is source inspection and card validation only. No browser capture or sighted review is claimed in this preparation.

## Follow-ups

- Scaffold the bounded Plateau mock/capture/test successor only when authorized; use the per-repo scopes above and the actual landed method/contract revisions. Do not silently turn #2694 into production progress-view implementation.
- After the convention has been exercised, assess whether the existing static/live baseline tooling can share the named-state driver. Its static-mock capability is real (we:../plateau-app/tests/visual/render-baselines.mjs:39-45); a generic framework is not a prerequisite for this method update.
- Preserve testing lessons here: schema validity does not establish arithmetic correctness; a fixed sleep does not establish render readiness; repeated state transitions catch leakage that one screenshot per page load misses. Do not append these lessons to shared agent documentation in this preparation.
