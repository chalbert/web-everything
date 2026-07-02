# External consultant review — living program report

Standing report for the external-consultant-review program: a periodic fresh-context review of the whole constellation by a model **outside** the day-to-day batch rotation, run at phase boundaries or quarterly. One dated `##` section per run. The value of the lens is independence — the reviewer audits the statute layer and the process rather than working inside them, so the run deliberately fans out uninvolved review agents and synthesizes across lanes.

## Run 1 — 2026-07-01 (Claude Fable 5)

**Method:** four parallel independent review agents (architecture coherence · engineering & quality infrastructure · process & backlog health · strategy & viability), each grounding findings in file evidence and live command runs, synthesized by the orchestrating reviewer. First engagement of this reviewer with the repo (fresh context by construction).

### Verdict

Internally exceptional, externally untested. The backlog (2,061 items, 92% resolved, net-converging), the decision→statute pipeline (99% of resolved decisions codified), and a 2.5s self-tested standards gate put the internal discipline well above industry norm. The mirror image is the risk profile: no CI, no external user, the site unshipped, the dogfooding claim not yet true, and the flagship zero-implementation invariant violated by ~15 block implementations still resident in WE. The machine is excellent; it is currently running open-loop.

### Lens summaries

**Architecture.** The plug/block/intent/protocol/project taxonomy is coherent and enforced; sampled specs (type-ahead, broadcast, CustomPositioner, action intent) are precise, testable, and grounded in platform precedent. The one hard violation: full implementations resident in WE (e.g. we:blocks/resource-loader/ResourceLoader.ts, we:blocks/trusted-html/TrustedHtmlBehavior.ts, ~15 files) against the ratified zero-implementation rule (#1282), already documented as drifted from FUI (#1245) and tracked as parked debt (#1294). Secondary: 67% of projects are pre-draft with no core/contextual/deferred partition; conformance vectors don't yet gate `active` status (the #899 vector-runner is unbuilt).

**Engineering.** Strong: gate passes in 2.5s over the whole surface and is itself unit-tested (~1,600 test lines); 2,003 unit tests green in 9.6s; coverage actually clears 85% where measured; Playwright config cleanly splits live-server vs deterministic-fixture lanes. Fragile: **no CI at all** (we:.github/workflows/ holds only CLA + contract-publish; we:scripts/push-if-green.mjs gates on the standards gate alone), the 80% coverage rule is declared in we:AGENTS.md but never invoked and measures only we:blocks/, 111 stray compiled JavaScript/declaration artifacts sit un-ignored in source planes, and 244 standing gate warnings are going numb.

**Process.** The three-layer design (tracker → statute → automation) works: June created 49 / resolved 32; open pool 177 of 2,061; zero dangling refs; true meta overhead ~3% of commits despite ~80% mentioning process nouns. Sampled items are real and deduplicated — no self-generated busywork. Gaps: the workflow-intent invariants in we:docs/agent/backlog-workflow.md are unaudited, statute anchors in we:docs/agent/platform-decisions.md have no link validation, the batch carry-forward logic is inline and untested in we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js (a bug reopens 12+ items per batch), and the 182 items in we:.claude/agent-memory/ have no freshness guarantee.

**Strategy.** Deliberately pre-audience, which is sound — but sequencing has drifted: polyglot generation (#463/#507) is ratified while zero external JS users exist; the "we eat our own cooking" deck claim is aspirational while #777 sits open blocked on #765; the public deploy chain (#1104 → #1137/#1136) is technology-ready and human-gated. The binding constraint is adopter-validation risk, not technical risk: a solo maintainer + agent swarm can outrun every feedback loop except a real user. Recommended order: dogfood → gated deploy → one pilot adopter with success criteria → only then the enterprise/polyglot story.

### Consolidated findings (cross-lens, priority order)

1. **No CI safety net** — 2,003 tests run only when an agent remembers; at ~1,700 commits/two-weeks convention will miss. Filed as #2080.
2. **External validation is the binding constraint** — pilot-before-polyglot sequencing decision filed as #2089; dogfood (#777), deploy (#1137/#1136) already tracked.
3. **Zero-implementation invariant violated in practice** — already tracked (#1294/#1246); recommendation is to schedule the sweep, not trickle-delete.
4. **Declared-but-unenforced rules train agents that rules are optional** — coverage (#2082), statute-anchor validation (#2083), workflow-intent invariants (#2084), agent-memory freshness (#2087).
5. **Scope needs an explicit tier map, not a cut** — portfolio tiering decision filed as #2088.
6. **Hygiene** — compiled-artifact leak (#2085), carry-forward logic extraction (#2086); warning-floor triage partially covered by #1231.

### Engagement model finding

The differential value of this lens is cross-cutting synthesis with no stake in the process — in-lane agents cite the statute, they don't audit it. Recommended cadence: quarterly plus phase boundaries (the pre-public-launch review is the obvious run 2), never in the batch rotation, so independence is preserved.

### Items filed this run

#2080 · #2082 · #2083 · #2084 · #2085 · #2086 · #2087 · #2088 (decision) · #2089 (decision). Pre-existing items relied on, not duplicated: #1294, #1246, #777, #1137, #1136, #1231, #2073.

### Run 1 addendum — standards corpus grading (2026-07-01)

Follow-up requested by the user: grade all 279 spec entries (98 intents, 81 blocks, 59 plugs, 41 protocols) on the standard-vs-catalog axis, precision, grounding, and — the priority lens — design-decision quality; adversarially challenge the load-bearing design decisions. 40 agents; graded as work-in-progress (drafts noted, not punished). Entry refs below use `kind:id` for the file `we:src/_data/<kind>/<id>.json`.

**Tier map.** platform-standard 112 (40%) · bridge 144 (52%) · app-catalog 23 (8%). By kind: intents 41/48/9, blocks 35/35/11, plugs 24/35/0, protocols 12/26/3. Maturity is the real stratifier: 5 stubs, ~93 thin-drafts. The demonstrable core (~12–20 exemplars that survive native-precedent scrutiny today): blocks:autocomplete, blocks:router, blocks:reorderable-list (all p5 g5 dd5), intents:anchor, intents:gesture, intents:validation, intents:progress, intents:meter, blocks:menu, blocks:droplist, blocks:component, protocols:design-tokens.

**Design decisions — the priority lens.** Recurring strengths: verbatim native-vocabulary adoption (meter/progress, disclosure ToggleEvent, permission W3C enum, data-table NULLS FIRST/LAST); ratified forks with named rejected alternatives (blocks:menu seven #173 forks, blocks:undo-history↔#1394); boundary/seam discipline; composition over new primitives. Recurring anti-patterns: cross-document contradiction (blocks:event-behaviors njk vs JSON, blocks:drawer placement-vs-side, blocks:segmented-control aria-pressed vs role=radio); uncredited prior art the entry sits on (the Every Layout family behind intents box/center/cluster/cover/reel/sidebar/stack/switcher; Speculation Rules eagerness missing from intents:prefetch; DOM Parts missing from the customcomment/customtextnode family); undefined load-bearing types (plugs:customexpressionparser Graph, protocols:editor-engine pivot format); asserted-not-argued role claims (intents:switcher).

**Adversarial outcomes: 14 challenged → 14 weakened, 0 refuted, 0 clean.** No placement or split overturned — the design-decision layer is sound — but every challenged ruling leaked at an edge. Objections most worth acting on: blocks:background-task-surface missing `composed: true` (silently breaks every shadow-root producer, taught in the example); blocks:component silent template corruption verified in Chromium (falsifies the #074 "observed faithfully" claim); intents:validation caution/warning collision with the ratified #1427 tone table; blocks:autocomplete reproducing the alternative #018 rejected; blocks:data-grid "one net-new rule" falsified by APG treegrid row-level focus; intents:anchor escape route contradicting the Popover API in-place top-layer precedent; intents:action `level=destructive` alias underspecified (should map to `level=primary` + `tone=danger`) with a stale consumer in the menu description.

**The catalog tail (23 entries) is a coherent separate product, not a pruning list** — several are high quality (blocks:signature-pad, intents:bulk-action, blocks:code-view). Clearest members: intents audit-timeline / decision-trace / signature / slide-layout-template / overview-grid, blocks lifecycle / signature-pad / app-shell / button, protocols:deck-document-model.

**Kind-level precision.** Blocks strongest (APG keyboard tables, event contracts). Intents bimodal (researched top half vs thin region-role tail). Protocols ground well but chronically leave schemas unpinned ("fields named, types absent"). Plugs are the weak flank: 34/59 thin-drafts, g1 medians across the patch family, siblings citing contracts neither defines — with proof it's fixable (plugs:customgraphlayout g5).

### Run 1 addendum — two-confusion screen experiment (2026-07-01)

The user identified two recurring authoring flaws that repeatedly reached ratification and cost deep human correction: **standard-vs-implementation** (a fork ruling on something not observable across the WE↔FUI boundary) and **merit-vs-prioritization** (timing/cost in fork costume). Both had inline guards — but as same-session self-assertions and a keyword scan. Wired under #2091: a mandatory **fresh-context two-confusion screen** per fork before `preparedDate` (the `Screen:` line; rubric in the backlog-workflow doc's prepared-fork shape, pass 5 of the prepare skill), plus a **lazy-correction policy** for the resolved archive (statute + prepared stock are the proactive audit surfaces; resolved decisions correct on citation).

**Experiment (counter-verified):** screening the full prepared stock (24 items, 36 forks) with independent defenders on every flag: **15 raw flags → 13 upheld, 2 false positives (87% precision); 13 of 24 prepared items (54%) carry an upheld flaw** — quantifying the failure mode the user reported. The statute layer is **clean** (5 flags raised, all 5 defeated by defense). Ten of the thirteen upheld flags cluster on #142-family validation gates whose merit is conceded in their own body with only timing remaining — exposing a genuine statute tension between the validation-gate archetype and the not-a-prioritization rule, filed as decision **#2092** (its ruling disposes of the ten items either way). Distinct upheld catches outside the cluster: #428 Fork 2 (free/paid threshold = calibration, not a fork), #1960 Fork 1 (enforcement mechanism = WE-internal tooling + cost), #083 Fork 6 ("build it at all?" meta-fork).

**Live pipeline test:** an Opus agent ran `/prepare` end-to-end on #232 under the new instructions. It applied the standing test honestly (zero forced forks; the item reshaped to grounded support-all with a published research topic), ran the pass-5 screen (clear), and an independent fresh-context validator returned **PASS-WITH-NOTES** — item body sound, would not have needed the deep review-and-correct treatment; the one defect (research artifacts overreaching past the skeptic's folded amendment on the never-probed residual) was a scoped-verdict fix, remediated on the spot.

**Feeding #2088:** the grading supports three tiers with the tier label decoupled from maturity — the platform-standard tier is real (~112) but over-assigned in plugs where the label describes ambition, not an artifact; app-catalog is a product layer to name, not prune; and since 14/14 challenges weakened but zero refuted, the WIP gap is *precision* (unpinned events, schemas, types), arguing for readiness sub-tiers (exemplar / substantive / thin) within platform-standard rather than demotions. Full per-entry grades persisted at we:audits/2026-07-01-standards-corpus-grades.md; observations only — enactment is a later human decision.
