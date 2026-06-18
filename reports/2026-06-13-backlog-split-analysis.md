# Backlog split analysis — 2026-06-13

Focused run: `/slice 468`.

## Candidate

**#468 — Form-control block inventory — datepicker, timepicker, input family, toggle/radio/checkbox**
`workItem: epic` · `size: 5` (residual — must drop) · `parent: "099"` · no children → **unsliced epic
(kind b)**. The decision to decompose is settled at the epic level; its body literally says "Slice into
per-control blocks when relevant." So conditions (2)–(5) are evaluated per slice, and (1) within each.

Body lists six controls not yet itemized: **datepicker, timepicker, text/number/currency/phone/mask
inputs, toggle/switch, radio, checkbox**. Existing neighbours: #177 (form block), #359 (date/time/range
picker), #175 (slider, resolved), #176 (segmented, resolved).

## Could split

| Slice | workItem · size | Scope | DAG |
|---|---|---|---|
| **Input family block** (text / number / currency / phone / mask) | story · 3 | One block enhancing `<input>` across the text-ish types — typing/format/mask affordances, native-first over `type=text\|number\|tel`. | independent |
| **Checkbox block** | story · 2 | Native-first over `<input type=checkbox>` — single + group, indeterminate. | independent |
| **Toggle / switch block** | story · 2 | `<input type=checkbox>` + `role=switch` — boolean on/off. Author already lists separately from checkbox. | independent |
| **Radio group block** | story · 2 | Native-first over `<input type=radio>` group — single-select; composes Selection Intent `single` + Focus Delegation `roving`. | independent |

**Slice DAG:** four independent leaves under epic #468 — no inter-slice `blockedBy` edges. Each is a
thin enhancement of a native form element, re-estimates to `size ≤ 3`, names its own files, buries no
fork, and is independently demoable via a fixture-driven block demo (mirrors how #175/#176 graduated).
All four are immediately batchable. Conditions (2)–(5) hold for each.

## Could not split

| Sub-item | Failed condition | Unblocking action |
|---|---|---|
| **datepicker** | (1) buried fork — scope overlaps #359 "Date / time / range picker block" (covers date **and** time **and** range, calendar-based). Slicing a datepicker block here duplicates #359. | **Reconcile #468 ↔ #359 scope** (Tier-B decision): does the single-value date picker live as its own block here, or is it a variant of #359's calendar picker? #359 is itself a `size·8` story under gap-sweep #315 flagged "groom/split before building" — reconcile in that split, not this one. |
| **timepicker** | (1) buried fork — same overlap with #359 (which explicitly includes "time"). | Same reconciliation as datepicker. |

datepicker/timepicker stay described in #468's umbrella body as "held pending #359 reconciliation"; #468
remains their open tracker until the call is made.

## Proposed mutation (gated on go)

- Leave #468 an `epic` in place (kind b — no story→epic conversion); **drop residual `size: 5`**; refresh
  digest to umbrella framing noting datepicker/timepicker held pending #359.
- Scaffold 4 children under `--parent=468`: Input family · Checkbox · Toggle/switch · Radio group — all
  `story`, no `blockedBy` edges (independent).
- Net flow: **+4**, #468 stays epic. Gate on `npm run check:standards`. Then `/batch` can chain the four.

---

# Focused run: `/slice 483` (re-run — supersedes the earlier #483 section above)

> **Supersedes the prior `/slice 483` analysis on this date.** That run recorded *could not split* on
> conditions **(1)** open build-forks and **(5)** providers not demoable, with the unblocking action
> "run `/prepare 483`." That action has since landed: the prepare pass became build-design decision
> **#496**, now **ratified** ([we:reports/2026-06-13-credential-acquisition-protocol-build-design.md](2026-06-13-credential-acquisition-protocol-build-design.md)).
> #496 settled all three build forks and **mandated a mock conformance provider in the first slice** —
> so the two prior blockers are gone. This re-run re-evaluates against the now-clean forks.

## Candidate

**#483 — webidentity project + credential-management protocol (deferred)**
`workItem: epic` · no `size` · `status: open` · `blockedBy: []` · no children → **unsliced epic
(kind b)**. #496 collapsed the scope to a crisp standard-layer build: a `webidentity` **project entry**,
one **`credential-management` protocol** (renamed from `credential-acquisition` by #496's Fork-2 naming
override) with **three members** — `credential-request` (`get`, all families) · `credential-enrollment`
(`create`/`store`, passkey + password) · `session-mediation` (`preventSilentAccess`, origin-global) —
behind one registry-resolved **`CustomCredentialProvider`** seam, default = native `navigator.credentials`
passthrough **+ a mock in-memory conformance provider**. Configurator domain omitted → non-blocking
[#499](../backlog/499-identity-ceremony-configurator-domain-plateau-app-explore-on.md).

## The work-investigation pass — what the build actually touches

The explicit twin is **Guard** (#496 mirrors `CustomGuardProvider` verbatim). Reading the real tree, the
entire build is **three authoring artifacts** — there is no runtime/provider code to ship (no protocol in
this repo ships executable provider code; conformance is a *spec contract* rendered from data + a `.njk`
partial, validated by `check:standards`):

| Artifact | File | Status today |
|---|---|---|
| Project entry (`webidentity`) | [we:src/_data/projects.json](../src/_data/projects.json) — twin `webguards` at **235–242** | absent — ~8 lines to add |
| Protocol entry (`credential-management`) | [we:src/_data/protocols.json](../src/_data/protocols.json) — twin `guard` at **102–108** (`realizesIntent`, `ownedByProject`, `anchor`) | absent — ~7 lines to add |
| Spec partial (mission · feature-surface table · `CustomCredentialProvider` TS interface · the 3 members · 2-D family×member dispatch · trust boundary · composition · status) | `we:src/_includes/project-webidentity.njk` — twin [we:project-webguards.njk](../src/_includes/project-webguards.njk) is **166 lines** | absent — the one substantial piece |

Adjacent, **already authored** (not in scope): the shipped `web-identity` intent
([we:intents.json](../src/_data/intents.json) **2434–2475**, `realizesIntent` target) and both research
topics ([credential-acquisition-protocol](../src/_includes/research-descriptions/credential-acquisition-protocol.njk),
[web-identity-project](../src/_includes/research-descriptions/web-identity-project.njk)). `check:standards`
requires the protocol entry's `ownedByProject`/`realizesIntent` to resolve and an `id="<anchor>"` to exist
in the partial — i.e. the protocol entry and the partial must land **together** to stay green.

Re-estimated against that real surface: the whole build is a single **`story · 5`** — one ~160-line spec
partial mirroring an existing twin, with all design pre-settled by #496. Not epic-volume.

## Could not split — no quality-preserving seam (forks are clean; this is a coherence call)

The forks are now clean, so the prior (1)/(5) failures no longer apply. But re-evaluating the rubric
against the *investigated* surface, the only structural seam still fails — on **independence (4)** and
**coherence**, not on open forks:

| Failed condition | Detail |
|---|---|
| **(4) no real independence; no incremental gain** | The sole seam is **by member**. But all three members are additive sections of **one file** — `we:project-webidentity.njk`. The "enrollment" and "session-mediation" slices both *edit the partial the first slice creates*; they are serialized edits to one ~160-line document, not independent files. There is no parallelism to unlock and no second independent leaf — a member slice cannot start until the partial exists, and two member slices contend on the same file. A by-member DAG is a rigid `A→B→C` chain dressed up as `A→{B,C}`. |
| **(5) first slice recreates the rejected thin state** | A "foundational" slice = project + protocol + seam + **`credential-request` only**. That is *acquisition-only* — the exact shape #496's Fork-2 **rejected as "too thin… leaves passkey registration homeless; you cannot demo passkey sign-in without first enrolling one."** Shipping it as an intermediate reproduces the half-a-protocol state the ruling argued against; the three members were decided as one coherent set. |

**Why not slice anyway.** A by-member split is *technically* rubric-legal as incremental delivery (each
member-state renders + validates). But it would fragment one coherent ~160-line spec page into **three
claims / three commits / three `check:standards` runs with zero parallelism gain** (one author, one file,
tiny additive prose), plus an epic→storied-epic conversion — the textbook *needless split* the skill's
governing instinct warns against: "a needless split fragments one coherent deliverable into pieces that
only make sense together (quality loss, more review overhead, zero gain)." The members of a credential
protocol only make sense together.

**Unblocking action (changed).** The pending action is no longer `/prepare` — that's done. #483 is now an
**agent-ready single build**. Re-scope it **epic → `story · 5`** (drop the epic framing; refresh the
digest to the #496-settled build) and send it to **`/next`** to author in one pass, twin = Guard. It is
*not* batchable (`story · 5` ≥ 5), and that's correct: there is nothing to batch — it's one spec page.

## Proposed mutation

**None by `/slice`.** #483 is recorded *could not split*. Recommended (separate, one-line) follow-up:
re-scope #483 `epic → story · 5` so `/next` picks it up as the agent-ready build it now is. No slices
scaffolded; no item resolved.

---

# Focused run: `/slice 500`

## Candidate

**#500 — Build cross-locus batch — locus→gate registry + per-item in-repo gating (per #498)**
`workItem: story` · `size: 8` · `status: open` · no `parent`. The body carries a *Recommended /split*
into three pieces (A registry+packing · B gating loop · C exercise-app discipline) and flags it "likely
> 8 as one piece." Decision **#498 is resolved**, so there is no open fork — condition (1) is clean; this
is purely a volume/seam call. Note up front: at `size: 8` the item sits at the **top of the batchable
band** (`story · ≤8` is already batchable), so the bar for splitting is *higher* than for a `size · 13`
— this is "can it be cleanly cut," not "it's too big to batch at all."

## The work-investigation pass — what the build actually touches

| Spec part | Real surface (cited) | Kind | ~size |
|---|---|---|---|
| (1) per-locus **registry** | [we:check-standards-rules.mjs:26](../scripts/check-standards-rules.mjs#L26) `export const LOCI = new Set([...])` → record map `{repoPath, gateCommand, devServerProbe, commitTarget, closeoutDiscipline?}`; update validation [we:check-standards-rules.mjs:105-108](../scripts/check-standards-rules.mjs#L105-L108) (`LOCI.has` → keys) | code | ~2 |
| (2) cross-locus **packing** | remove the filter [we:engine.mjs:230](../scripts/readiness/engine.mjs#L230) + drop the `otherLocus` return; collapse the display [we:check-readiness.mjs:175-178](../scripts/check-readiness.mjs#L175-L178); update [we:engine.test.mjs:227-231](../scripts/readiness/__tests__/engine.test.mjs#L227-L231) (the "repo-locus filter" describe block) | code | ~2 |
| (3) per-item **in-locus gating** loop + per-repo commit | agent-prose, not code: rewrite [we:backlog-workflow.md:426](../docs/agent/backlog-workflow.md#L426) future-capability-(a) into the built mechanic + the batch loop steps + [batch we:SKILL.md](../.claude/skills/batch-backlog-items/SKILL.md) | doc | ~2 |
| (4) **exercise-app** closeoutDiscipline | `closeoutDiscipline` field on the registry's exercise-app entry (`check:standards + check:app-conformance` + non-skippable GAP-tagging) + doc | data+doc | ~1–2 |
| (5) **doc** rewrite | the [we:backlog-workflow.md:420-426](../docs/agent/backlog-workflow.md#L420-L426) Repo-locus section | doc | folded |

Re-estimated total ≈ **6–8** — `size: 8` is honest; "likely > 8" is plausible if the doc rigor is high.
Borderline-batchable, borderline-split.

## Could not split — one safety invariant binds packing + gating into a single deliverable

The split-safety rubric fails on **(4) independence/incremental delivery** and **(5) no half-a-protocol
intermediate**. The cause is structural, not a fixable gap:

**The whole item enforces one invariant — `packable ⟺ honestly-gateable-in-its-locus`.** Today that
invariant is upheld by the *fails-open filter* at [we:engine.mjs:230](../scripts/readiness/engine.mjs#L230):
only WE items pack, and the WE gate honestly closes them. The build's job is to move the invariant to a
new equilibrium (all loci packable, each gated in its own repo). The two halves are inseparable:

| Failed condition | Detail |
|---|---|
| **(5) the one "natural" seam is forbidden** | The body's own A/B cut is **packing (A) ‖ gating (B)**. But shipping packing *without* gating removes the fails-open guard while its replacement isn't in place — cross-locus items pack into the pool and get **resolved on the WE gate that never ran them**, the exact dishonest-close the wall exists to prevent. That is the textbook half-a-protocol intermediate (5) forbids. The only *safe* order is gating-doc **before** packing-unlock — which means they can't be independent, contradicting the body's A=packing-first framing. |
| **(4) strict chain, no independence, no incremental value** | Forcing the safe order yields `registry → gating-doc → packing-unlock(+exercise-app)`. No two parts are independent (every part needs the registry; packing needs gating; exercise-app needs the unlock + its own discipline). It's a rigid linear chain with **zero parallelism**, and the user-visible capability (cross-locus batch) exists **only after the final link** — the first two slices are pure setup with no standalone value. The "rigid chain that ships nothing until the last slice" anti-pattern. |

**Why not slice anyway.** A `registry → gating → packing+exercise` chain is *technically* rubric-legal
(each seam leaves a green, honest state, and the batch skill can cascade a linear chain). But for an item
**already at the batchable ceiling**, splitting buys only smaller review units while costing real quality:
the honest-gate invariant is precisely what a reviewer must verify *across* packing+gating together —
fragmenting it across slices/commits makes that cross-cutting check harder, not easier, and adds an
epic-conversion + 3 claim/resolve/gate cycles + DAG edges for one coherent ~6–8pt deliverable. This is the
*needless split* the governing instinct warns against — pieces that only make sense together.

| Failed condition | Unblocking action |
|---|---|
| (4)/(5) — packing & gating are two halves of one safety invariant; no quality-preserving seam | **None via decision** (#498 is resolved). The seam would become real only if the **gating loop (spec 3) were promoted from agent-prose discipline into a tested code runner** (a batch-execution script rather than skill prose) — then packing and gating would be a *code* seam with independent tests, splittable honestly. As long as the loop lives in docs/skills, keep #500 one deliverable. |

## Proposed mutation

**None by `/slice`.** #500 is recorded *could not split*. It is **already batchable as the `story · 8` it
is** (it packs when ~8 points of budget remain) — recommended path is to single-pass it via `/next` or let
`/batch` pack it whole, not to fragment it. No slices scaffolded; no item converted; nothing resolved.

---

# Focused run: `/slice 495`

## Candidate

**#495 — Exhaustive per-source capability presence + deep doc URLs (fan-out over the join table)**
`workItem: story` · `size: 13` · `status: open` · `parent: "315"` · `blockedBy: ["352"]` (resolved).
The body **already prescribes the split** — "one batchable slice per corpus source… /slice this per
source before working; each source is an independent, diffable slice." Condition (1) is clean: there is
no unresolved decision, only volume — the extraction method, schema, and validator were all settled by
the now-resolved foundation **#352**. So this is a textbook *volume* split, not a fork in disguise.

## The work-investigation pass — what the build actually touches

Read the real tree, not the body's framing:

| Surface | Cited | Finding |
|---|---|---|
| Corpus sources | [we:src/_data/benchmarkCorpus.json](../src/_data/benchmarkCorpus.json) `sources[]` | **26 sources**, each with `id` + `docsUrl` (material-3, carbon, fluent-2, …, open-ui). |
| Capabilities | [we:src/_data/benchmarkCapabilities.json](../src/_data/benchmarkCapabilities.json) | **96 capabilities** to test presence for, per source. |
| Join table | [we:src/_data/benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json) `rows[]` | **145 seed rows**, all `provenance: notable-inference`, across **19** of the 26 sources (~8/source); **0** `verified`. The `method` field + the `verified`-without-`url` warn-check already exist (#352). |

Each slice's mechanical contract (from the `method` field): for one `sourceId S`, walk `S.docsUrl`,
decide presence for each of the 96 capabilities, and **splice** rows — upgrade the ~8 `notable-inference`
seeds **in place** to `provenance: verified` (+ `sourceName` + deep `url`) and insert newly-found present
capabilities. **Never rewrite the whole file** — row-splice so a re-run diffs cleanly. Re-estimated
surface per source ≈ a **`task`** (one docs site, ~8 known-present to verify + the rest to scan; most
capabilities resolve to absent fast).

## Could split — clean per-source fan-out (all five rubric conditions hold)

| Condition | Verdict |
|---|---|
| (1) volume not a fork | ✅ method/schema/validator settled by #352; nothing to decide. |
| (2) ≥2 nameable slices w/ a real home | ✅ **26** — one per `sourceId`, each a `task` under the epic (sub-work, not standalone-value stories). |
| (3) each ≤3 / task, named files, no buried fork | ✅ each = one source's docs → splice `we:benchmarkCapabilityPresence.json` rows; ~`task`. |
| (4) acyclic DAG, real independence | ✅ **26 fully-independent leaves** — different `sourceId`, no inter-slice edges; the row-splice discipline means two slices touching the same file don't conflict (disjoint `sourceId` row sets). Maximal parallelism. |
| (5) every slice leaves a valid demoable state | ✅ each slice upserts only its source's rows; the file stays valid + the gap step (#348) gets that source's verified citations immediately; the `verified`-without-`url` check guards each. |

**Slice DAG:** 26 independent leaves under epic #495 — zero `blockedBy` edges between them (the lone
prerequisite #352 is resolved). All 26 immediately batchable.

## Granularity — per-source vs grouped

One judgment remains, and it's *not* a rubric failure — just slice **count**:

- **Per-source (26 `task` slices)** — the item's literal design ("each source is an independent, diffable
  slice"), maximally diffable, cleanest fully-parallel DAG. Cost: **+26** backlog items under #495.
- **Paired (13 `task`·size-3 slices, 2 sources each)** — halves the item count, still batchable (size 3),
  but couples two sources per diff/commit. Triples (≈9 slices) start pushing past size 3 → risks
  non-batchable, so that's the floor.

Grouping by *register* (the natural 5 clusters: flagship DS · headless primitives · web-components ·
React libs · standards) is **rejected** — 4–8 sources/cluster re-estimates to `size 5–8`, which is
*not* batchable, defeating the whole point of the split.

**Recommendation: per-source (26).** It's what #352 + the `method` were built for, gives the cleanest
diff-per-source provenance trail the item explicitly values, and each is unambiguously a `task`. The +26
count is the honest shape of a 26-way fan-out; if that volume is unwanted, pairing-to-13 is the fallback.

## Proposed mutation (gated on go)

- Convert **#495 `story` → `epic`** in place, **keep `parent: "315"`** (a sub-epic — an established
  pattern here, e.g. #317/#318 under #314; `check:standards` permits epic-with-parent), **drop `size: 13`**
  (children carry the points), keep `status: open`, refresh digest to umbrella framing. **Keep `blockedBy:
  ["352"]`?** No — #352 is resolved and the dependency now lives on each child; drop it from the epic and
  the children inherit no live block → all immediately ready.
- Scaffold **26 `task` children** under `--parent=495`, one per `sourceId`, no `--blocked-by` edges, each
  with a per-source digest (source name + docsUrl + "splice verified presence rows for this source").
- Net flow: **+26**, #495 story → epic. Gate on `npm run check:standards` (backlog count must rise by 26).
  Then `/batch` chains them.

---

# Focused run: `/slice 490`

## Candidate

**#490 — Build the on-device verdict classifier — codified distillation pipeline + benchmark + in-browser provider (per #488)**
`workItem: story` · `size: 13` · `status: open` · `blockedBy: ["489"]` (**resolved**). The body's own
sizing note prescribes a split — "`size:13` is a placeholder — slice into batchable pieces (recipe /
classifier / WebGPU provider / benchmark harness)." Condition (1) is clean: **#488 ratified all five
forks**, so there is no open design fork — the model class, runtime, codified-artifact shape, graduation
benchmark, and stay-current cadence are all settled. This is a *volume + data-dependency* split, not a
fork in disguise. The blocker #489 (the labeled-corpus collector) is resolved.

## The work-investigation pass — what the build actually touches

Read the real tree. The vision seam and the corpus collector both **already ship**; the corpus *data*
does not yet exist:

| Surface | Cited | Finding |
|---|---|---|
| Vision provider seam | [we:scripts/design-refs/vision.mjs:55-97](../scripts/design-refs/vision.mjs#L55-L97) — `registerVisionProvider` / `resolveVisionProvider` / `DESIGN_REFS_VISION_PROVIDER_MODULE` | The swap point is built (#480/#485). Adding the on-device model is **registering another provider**, no new plumbing — confirmed by the report's "it's a provider swap, not new plumbing." |
| Reference provider (twin) | [we:scripts/design-refs/providers/anthropic-vision.mjs](../scripts/design-refs/providers/anthropic-vision.mjs) — pure `buildVisionRequest`/`mapVisionResponse` + a thin `classifyCandidate` wrapper, unit-tested without the SDK | The on-device provider (slice D) mirrors this shape: pure I/O functions + a thin runtime wrapper, registering behind the seam. |
| Corpus collector + format | [we:scripts/design-refs.mjs:386-405](../scripts/design-refs.mjs#L386-L405) `archiveQuarantinedFrame`; `items/<id>we:/meta.json` carries `visionVerdict` + `reviewState`; `quarantine/<hash>/`; `we:verdicts.json` (line 49) | The `{frame, verdict}` labeled set is **materialised on disk by design** (#489 resolved). The export (slice A) and benchmark (slice B) read this format. |
| Fixture-test pattern | [we:scripts/design-refs/__tests__/archive-quarantine.test.mjs](../scripts/design-refs/__tests__/archive-quarantine.test.mjs) | The collector is unit-tested against a **synthetic fixture corpus** — so A & B can be built + demoed against fixtures now, no real data needed. |
| Corpus data on disk | `design-refs/` directory | **Absent** — no `items/`, `quarantine/`, or `we:verdicts.json` exist yet. No dev runs have accumulated training frames. **This is the seam:** the *tooling* is buildable now; the *trained model* needs accumulated volume. |

**The split is the tooling/model seam.** Slices A (export + codified recipe artifact) and B (benchmark
harness) are pure tooling over the *format* — buildable and fixture-demoable today, exactly like the
existing collector tests. Slice C (train the quantized student) needs accumulated real corpus *volume*
(an operational dependency — run the gate over many real captures), so its true scope can't be
investigated to depth now. Slice D (WebGPU provider) wraps C's model artifact. Slice E (stay-current
re-benchmark) is the body's explicit spin-out off B.

## Could split — front tooling slices are agent-ready; data-blocked tail is correctly-modeled blocked children

| Slice | workItem · size | Scope | DAG |
|---|---|---|---|
| **A — Corpus export + codified distillation recipe artifact** (F5) | story · 3 | New `design-refs export` step + a versioned, model-agnostic recipe (config + dated-revision log) that reads `items/*/meta.json` + `quarantine/*` → a `{frame, verdict}` training manifest with a held-out split. Fixture-tested like `we:archive-quarantine.test.mjs`. | **independent** — ready now (collector format exists) |
| **B — On-device verdict benchmark harness** (F1/F4) | story · 3 | A provider-agnostic benchmark: run any registered vision provider over a held-out labeled slice → verdict-agreement % + per-class quarantine-recall vs the graduation thresholds (≥95% agreement). Demoable against the `anthropic`/`manual` provider on a fixture — useful immediately to measure the *hosted* provider. | blocked-by **A** (consumes the manifest/held-out format) |
| **C — Train + quantize the distilled verdict classifier** (F1/F2) | story · 5 | Run A's recipe against the accumulated corpus → a ≲10 MB quantized ONNX MobileNet/ViT student; gated by B's benchmark. | blocked-by **A, B** — **+ needs corpus volume (operational)**; not batchable until data accumulates |
| **D — In-browser ONNX Runtime Web + WebGPU vision provider** (F3) | story · 3 | Register the on-device provider behind the [we:vision.mjs](../scripts/design-refs/vision.mjs) seam, wrapping C's model; mirrors `we:anthropic-vision.mjs`'s pure-fn + thin-wrapper shape. | blocked-by **C** |
| **E — Scheduled small-model re-benchmark** (stay-current, F5) | task | A recurring re-benchmark of the small-model frontier (#192 cadence) on B's harness. The body says it "may spin out as its own recurring task once the benchmark suite exists." | blocked-by **B** |

**Slice DAG:** `A → B → {C, E}`, `C → D`. **A is ready now**; **B is ready the moment A lands**. Condition
(4) is satisfied via **incremental delivery** (not parallelism): A ships a usable training-data artifact,
B ships a working agreement benchmark that has value against the *hosted* provider before any on-device
model exists. C/D are scaffolded as children to capture the scope under the epic but are **blocked** —
C's true blocker is corpus *volume*, an operational accumulation, not just its predecessors.

| Condition | Verdict |
|---|---|
| (1) volume not a fork | ✅ #488 ratified all five forks; nothing to decide (per-slice: no slice buries a fork). |
| (2) ≥2 nameable slices w/ a real home | ✅ five — A/B/C/D stories, E task; each a real home behind the existing seam/pipeline. |
| (3) each ≤5 / task, named files, no buried fork | ✅ A,B = 3; C = 5; D = 3; E = task — all `file:line`-citable above. |
| (4) acyclic DAG, ≥2 independent **or** incremental | ✅ acyclic; **incremental delivery** — A then B each ship standalone value before the model exists. |
| (5) every slice leaves a valid demoable state | ✅ A (export a manifest from a fixture corpus), B (benchmark report against a provider) are fixture-demoable; C/D demo once buildable. |

## Could not split — the trained-model tail is not agent-ready *yet*

The split itself is safe (it yields the agent-ready front A & B), but two children are correctly captured
as **blocked, not batchable**:

| Sub-item | Failed condition | Unblocking action |
|---|---|---|
| **C — train the classifier** | (3) scope not investigable to depth — the achievable architecture/accuracy/size is unknown until the corpus has enough labeled volume; `design-refs/` is empty on disk today. | **Accumulate corpus volume** — run the dev gate with a real vision provider over many captures so #489's collector fills `items/`/`quarantine/`. A & B landing first is what *exposes* whether there's enough data and whether C clears the graduation bar. |
| **D — WebGPU provider** | (5) nothing to demo — wrapping a model artifact that doesn't exist yet would ship a half-provider. | Land **C** (a real `.onnx` student) first; then D is a thin provider mirroring `we:anthropic-vision.mjs`. |

These stay as scaffolded blocked children under the #490 epic (the umbrella tracks them); they are **not**
batchable until A/B land and the corpus accumulates.

## Proposed mutation (gated on go)

- Convert **#490 `story` → `epic`** in place, **drop `size: 13`** (children carry the points), keep
  `status: open`, **drop `blockedBy: ["489"]`** (resolved; the live dependency now lives on each child —
  none, since the collector is done), refresh digest to umbrella framing.
- Scaffold **5 children** under `--parent=490`:
  - **A** story·3 — *no* `--blocked-by` (ready now)
  - **B** story·3 — `--blocked-by=<A>`
  - **C** story·5 — `--blocked-by=<A>,<B>` (digest notes the additional corpus-volume operational gate)
  - **D** story·3 — `--blocked-by=<C>`
  - **E** task — `--blocked-by=<B>`
- Net flow: **+5**, #490 story → epic. Gate on `npm run check:standards` (backlog count must rise by 5; DAG
  acyclic). Then `/batch` can chain **A** immediately (and **B** once A resolves).
