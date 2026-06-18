# Backlog split analysis — large stories (`size` > 5)

**Date:** 2026-06-10 · **Mode:** dry run (analysis only — no backlog mutated) · **Skill:** `split-backlog-item` (`/split`)

Candidate set = open `story` items with `size` > 5: **11 items, all `size` 8** (full frontmatter scan —
the earlier 9-item pass missed **#038** and **#240**, both `story·8` in the `--select` projection; added
below). Each was scored against the five-condition split-safety rubric (*docs/agent/backlog-workflow.md*
→ *Splitting a large story*): **(1)** volume not uncertainty · **(2)** ≥2 nameable slices each with a
real home · **(3)** slices land `≤3`/`task` · **(4)** clean DAG with real independence or incremental
delivery · **(5)** every slice leaves a valid, demoable state.

**Result: 7 could split · 4 could not.** Of the 7, three are *clean* (a root/foundation slice + truly
independent batchable slices), one (#240) is a *foundation + decision-gated remainder*, two are *staging*
splits (slices shrink but stay ≈`5`), and one (#081) is a *close-v1-and-spin-out* split rather than an
epic conversion.

---

## Could split (7)

| # | Title | Split shape | Proposed slices (re-est.) | DAG | Batchable wins |
|---|---|---|---|---|---|
| **228** | Scoped autonomous-element construct + lifecycle | **Clean** (root fix + independent tasks) | **A** root construction fix `story·3` · **B** `disconnectedCallback` removal-path patch `task` · **C** `attributeChangedCallback` patch `task` · **D** form-associated callbacks `task` | A gates B/C/D; **B/C/D independent** | B, C, D batchable once A lands |
| **240** | Collapse duplicated `JSXRenderer` onto `@frontierui/jsx-runtime` | **Foundation + decision-gated remainder** | **A** re-sync package `JSXRenderer` from WE canonical (port #241/#245, keep strict cast) + WE↔package drift match-check `story·3` · **B** repoint `frontierui/blocks/renderers/jsx` at package, delete copy #2, update `jsxInject`/`jsxFactory`/`tsconfig`, verify both repos `story·3` · **D** *(new)* decision: bare-specifier browser resolution — built `dist` vs vite src-alias vs importmap | A independent; B `blockedBy` A **+ D** | **A batchable now** (decision-free regression fix); B waits on D |
| **005** | Validation spec-versioning + capability-adherence | **Clean** (foundation + consumers) | **A** capability-manifest schema + semver scheme (ratify OP-18/19/20) `story·3` · **B** build-time `check:validation-adherence` `story·2` · **C** runtime dev-mode guard `task` · **D** adherence report format `task` · **E** partial-impl fixtures `task` | A gates B/C/D/E; **B/C/D/E independent** | B–E batchable once A lands; **re-points #085's blocker to slice A only** |
| **085** | Validation generation — protocol + adapters | **Clean** (registry + per-adapter fan-out) | **A** intent enumeration + `CustomValidationAdapterRegistry` `story·3` · **B** native-HTML adapter `story·2` · **C** Zod adapter `task` · **D** Pydantic adapter `task` · **E** JSON-Schema adapter `task` · **F** Mode-2 service + 1 format `story·3` | A gates B–F; **B/C/D/E independent**, F last | B–E batchable **after #004/#005 unblock** (inherited) |
| **086** | Mockup-to-standard-code tool | **Staging** (foundation stays ≈5) | **A** neutral structural-description schema `story·5` · **B** analyzer registry + 1 reference provider `story·3` · **C** generator wiring into existing `webadapters` core `task` · **D** quality/round-trip gate `task` · **E** interactive-input analyzer `story·3` (later) | A gates B/C/D; B/C independent; E after B | B–D batchable; A stays single-item |
| **100** | Requirement-as-code | **Staging** (incremental, slices ≈5) | **A** requirement meta-schema + authoring/validation editor `story·5` *(body: "sequence first as a standalone win")* · **B** auto-testing loop `story·5` · **C** code-from-requirement `story·5` | A → B → C (incremental delivery) | None yet batchable; win = concrete near-term slice A |
| **081** | Module-as-a-Service | **Close-v1 + spin-out** (v1 already shipped) | resolve #081 → `module-service` (v1 + 2a/2b/2c done) · spin out **A** reactivity `story·3` · **B** real resolver/registry + caching `story·3` · **C** production runtime delivery `story·3` · **D** FU functional-component form `story·2` | A/B/C/D independent follow-ons | A–D batchable once spun out |

### Notes per item

- **#228 — the textbook safe split.** A concrete bug-fix with a named root cause; the root fix legally
  constructs a scoped autonomous element (flips the "upstream blocker" guard), then three *independent*
  lifecycle callbacks (remove / setAttribute / form-reset) each flip their own guard in
  `we:autonomous-element-lifecycle.spec.ts`. Real parallelism among B/C/D. `blockedBy`/`parent` #167 carry to all slices.
- **#240 — a foundation slice that batches *now*, plus a decision-gated tail.** Slice A is a real
  decision-free regression fix: the published package copy is *missing* WE-canonical features (#241
  auto-define path, #245 inline string-event-handler branch), so re-syncing it from canonical + adding a
  drift match-check ships standalone value and is immediately batchable. The repoint (slice B) hinges on
  the **unsettled bare-specifier resolution** (built `dist` vs vite src-alias vs importmap) the body flags
  — so it's split out as slice B `blockedBy` a **new Tier-B decision (D)**, not forced now. Edge case:
  #240 has `parent: "125"`, so per the rubric it stays a re-sized `story` (slice A) with slice B as a
  **sibling under #125**, not an epic conversion.
- **#005 — foundation unlocks a downstream blocker.** OP-18/19/20 are open but carry leanings (static
  export); they're *localized to slice A* (how the manifest is exposed), so they don't scatter — slice A
  ratifies them as it lands. Bonus: **#085 is `blockedBy: ["004","005"]` but only actually needs slice A**
  (the manifest), so splitting #005 lets #085 re-point to the narrower prerequisite.
- **#085 — clean fan-out, but inherits #004/#005 blockers.** Splitting a blocked item is fine — the
  slices stay blocked until #004 (validity model) and #005-A (manifest) land, then B–E become independent
  batchable adapters. The cross-field rule-language fork stays explicitly out-of-v1, so it doesn't gate
  the split.
- **#086 — splits, but the schema slice stays substantial.** The neutral structural-description schema is
  "the hard, lasting design work" and re-estimates to ≈`5` (single-item, not batchable). The win is the
  downstream tasks (analyzer/generator/gate). `blockedBy: ["052"]` and `parent: "097"` carry to slice A.
- **#100 — a *staging* split the body already endorses** ("sequence the authoring+validation slice first
  as a standalone win"). Slices stay ≈`5` each — this stages an `8` into three deliverable stages with a
  concrete near-term first slice, rather than producing batchable items. Safe and quality-preserving, but
  not a batchability win.
- **#081 — not an epic conversion; a close-out.** v1 + phases 2a/2b/2c are **landed and verified**; the
  "home" decision is now confirmed (stays under `webadapters`). The honest move is to **resolve #081**
  (`--graduated-to=module-service`) and spin out its four explicitly-non-blocking follow-ons as their own
  items. Do **not** convert it to a storied epic (its v1 isn't unbuilt scope). Side note: its digest is
  125 words (`check:standards` warns) — refresh on close-out.

---

## Could not split (4)

| # | Title | Failed condition | Unblocking action |
|---|---|---|---|
| **038** | `<component>` converter playground page | **(4)/(5)** rigid chain, no demoable intermediate | A sizing note added **today** already re-scoped it to "keep as a focused single-item build." Its one seam (a WE→FUI import/symlink mechanism for the *bidirectional* transform) is internal infra with **no fixture-driven demo of its own**, and the playground page can't exist until it + a TS-in-browser bundle land — a rigid chain with no shippable intermediate. Atomic by design. *Possible future seam:* if the WE→FUI cross-repo import mechanism is built for another consumer (gaining independent value), the page becomes a clean `story·3` on top of it. `blockedBy: ["048"]` (resolved), `parent: "049"`. |
| **092** | Provider↔consumer graph & governance | **(1)** unresolved fork | Decide the **ingestion model** — build-time export vs runtime agent vs both (no recommendation on file) — and the seam-contract representation. Surface as a Tier-B decision; once the ingestion architecture is chosen, the graph-model / impact-analysis / governance-UI / platform-map slices fall out. |
| **093** | Business-rule manager + proof of compliance | **(1)** seed/exploration; multiple open forks | The item itself asks for "its own deeper exploration." Run a design/research pass to settle **home** (new project vs extend webvalidation), **proof format & trust model**, and the **enforcement seam** — *then* it slices into rule-manager / proof-of-compliance / enforcement. Surface as a Tier-B decision + research topic. |
| **191** | Upgrader version-migration codemods | **(1)/(4)** prerequisite not settled | The body says "may split once the **descriptor format** is settled." That format is largely #005's job (machine-readable change/migration descriptors per release). **Land #005's manifest/descriptor slice first**; then #191 splits cleanly into (a) descriptor schema/consumption and (b) the transform/codemod engine. Also `blockedBy: ["005","094","102"]`. |

#092/#093/#191 each imply a **Tier-B decision worth tracking** (per *Where an open question goes*).
Registering them — #092 ingestion-model decision, #093 design/exploration topic, #191 "split-after-#005"
note — is the recommended follow-up but is **not** done in this dry run. (#038 is atomic, not pending a
decision — nothing to register.) Note that the **#240 split itself opens a new Tier-B decision** (slice D,
bare-specifier resolution) — that one is created *as part of executing the #240 split*, not separately.

---

## If you green-light the splits

The safe, high-value order:

1. **#228** — cleanest; root fix + 3 independent lifecycle tasks. Pure win, no blockers beyond #167.
2. **#240** — slice A is a decision-free regression fix that batches immediately; slice B + decision D get laid out but don't block A. Low risk, real near-term win.
3. **#005** — foundation slice unblocks #085 (and indirectly #191). Highest leverage.
4. **#085** — fan-out adapters; slices inherit #004/#005 blockers (do after #005-A).
5. **#081** — close v1 + spin out 4 follow-ons (a close-out, not an epic conversion).
6. **#086 / #100** — staging splits; smaller but slices stay ≈`5`. Lower urgency.

Executing any of these mutates the backlog (convert original → storied epic / scaffold slices / set
edges, gated on `check:standards`) and needs an explicit go — none was performed here.
