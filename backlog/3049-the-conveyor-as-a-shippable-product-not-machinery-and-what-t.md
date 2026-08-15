---
bornAs: x96ezuu
kind: decision
size: 3
status: open
dateOpened: "2026-08-09"
preparedDate: "2026-08-15"
relatedTo: ["3010", "3012", "2606", "089", "428", "3001"]
tags: [product-strategy, conveyor, conformance, monetization, throughput, governance, statute-candidate]
crossRef: { url: /backlog/3010-adopt-a-repo-wide-process-work-freeze-and-a-product-quota/, label: "The quota decision this changes (#3010)" }
---

# The conveyor as a shippable product, not machinery — and what that costs a numeric product quota

Operator framing, in-session 2026-08-09: the conveyor — a UI surface that manages automated, standards-conformant AI development — is not only how the next features get delivered, it is itself a valuable product, and provable conformity is what separates it from single-agent vibe coding in the enterprise. Records the consequence for the open #3010 quota decision, since the #3012 output-mix classifier counts conveyor work as machinery, and opens the third-class question. Capture only — nothing built, nothing ruled.

## The operator's note, near-verbatim

Recorded as an in-session note of **2026-08-09**. These are the operator's own words, not a synthesis:

> *"If we can deliver on the idea of the conveyor — a UI surface that can help manage automated AI-driven
> development of standard-based, accurate, high-quality UI — it will be both super useful to help deliver the
> next features, but would be itself a hugely valuable product. We keep seeing how there is a big [gap] between
> vibe coding a screen with a single agent which seems to deliver something good, [and] automated delivery of
> complex, reviewed features. So this challenge is actually an opportunity, and each time we can prove
> conformity and bring guarantee that would be a huge deal in the enterprise sector."*

And, on the state of the conformity claim, same session:

> *"I'd be surprised if we can prove conformity today, but it is a goal we aimed for in the future."*

## Why this is filed rather than left in a transcript — it changes how #3010 should be ruled

**#3010** (`bornAs: 3010`, `kind: decision`, **open**) proposes a repo-wide process-work freeze plus a
**product quota** — its Fork B1 is "at least half of newly-opened lanes serve product items each week". Its
stated enforcement instrument is the output-mix metric from **#3012** (**resolved** 2026-08-09,
`graduatedTo: we:scripts/lib/output-mix.mjs`), built by PR **#1126** and refined by PR **#1128** (both merged
2026-08-09).

Under that classifier, conveyor and delivery-machinery work is **machinery**. Measured directly against the
committed rule list at `origin/main` **73a3925b**, calling `classifyPath` from `we:scripts/lib/output-mix.mjs`
with the ruleset from `we:scripts/lib/output-mix-paths.json`:

| path | class |
| --- | --- |
| `we:scripts/conveyor/status-board.mjs` | **machinery** |
| `we:scripts/lib/jury-core.mjs` (the review/jury engine) | **machinery** |
| `we:scripts/lib/review-core.mjs` | **machinery** |
| `we:skills-src/conveyor/SKILL.md` | **machinery** |
| `we:conformance-vectors/index.ts` | product |
| `we:wrapper-conformance/runner.ts` | product |

**So a numeric product quota would mechanically penalise building the single thing the operator considers most
valuable.** Every hour spent on the conveyor, the review engine, or the operation-declaration engine (#3001,
open, prepared) scores against the quota, while the classifier is indifferent to whether that hour produced a
sellable surface or a lane-pool bugfix. That is not an argument against #3010 — the drift it responds to is
real and #3012 measured it (machinery 19.8× / 7.2× / 66.5× / 58.0× product across the four completed weeks,
and **+0** product so far in the current one). It is an argument that **the instrument does not yet distinguish
the two kinds of machinery**, and ruling B1 on it as-is buys the ratio at the price of the product thesis.

**A second, sharper problem with the instrument:** the conveyor board UI itself is not in this repo. #2586 and
#2660 both scope it to `plateau-app:src/backlog-view/`. The output-mix metric is WE-only, so the product
surface under discussion is **invisible to the number that would police the quota** — it counts neither as
product nor as machinery, because it is not counted at all.

## The distinction the quota needs — and the third class it implies

"It's all product really" is available as an excuse for every piece of tooling, and is exactly how a ratio
never gets confronted. The operator's point is narrower. The test to record is:

> **Would this ship outside this repo?**

- **Plausibly yes** — the conveyor UI surface; conformance proof; the review/jury engine; the
  operation-declaration engine (#3001). Generalizable, and the thing an enterprise buyer would pay for.
- **Plausibly no** — lane pooling; JIT backlog numbering (#2288); drain rebase mechanics; this repo's own
  bookkeeping.

So the metric arguably needs **three classes, not two** — product, **product-in-disguise** (shippable delivery
machinery), and plumbing. Nobody is tracking the middle one, and it may be the interesting number: it is
plausibly where most of the machinery lines sit — #3012's completed weeks measure +13,671 to +36,373 machinery
lines a week (its partial current-week row reads higher still, but #3012's own guidance is to read the
completed weeks).

Note that the classifier **already splits the "plausibly yes" list down the middle** without anyone deciding
that it should: the conformance substrate (`we:conformance-vectors/`, `we:wrapper-conformance/`) was ruled
`product` by PR #1128 on the seam test — *does it cross the seam?* — while the conveyor and the review engine
stay `machinery` because they live under `we:scripts/`. The seam test and the ships-outside test are
**different tests that currently agree by accident of directory layout**, and #3012 records that the rule list
is ordered path-first, so the disagreement will surface the moment a shippable engine is written somewhere
`we:scripts/` does not reach.

**This is an open question, deliberately not answered here.** Do not read the paragraphs above as a proposed
third class; read them as the warrant for asking whether one is needed.

## The differentiator — an aim, with the starting position measured

The thesis is that **provable conformity** is what separates this from single-agent code generation: you cannot
prove conformity against taste, only against a declared contract, and this repo holds the contracts.

The operator has stated plainly that this is **a goal, not a present capability**. Nothing below is a shortfall
against an overclaim — it is the starting position on a stated aim, and the gap is the roadmap.

**Two kinds of conformity, and conflating them is how this overclaims later:**

- **Process conformity — real and shipping today.** The repo can demonstrably prove that its *own delivery
  process* held: `npm run check:standards` (0 errors over 81 blocks, 60 plugs, 42 protocols, 100 intents, 21
  capabilities, 345 terms, 3021 backlog items at 73a3925b), the mutation batteries (PR #1128 ran 12 mutations,
  all red, control green over 89 tests), the review record and its escalation ledger. This is genuinely
  unusual and it is genuinely evidence.
- **Artifact conformity — the aim, and the actual product thesis.** Proving that a *generated UI artifact*
  meets a declared contract. **The first does not imply the second**, and the pitch must never let them blur.

**Where the artifact half stands today, measured at 73a3925b:**

- `we:conformance-vectors/` **does** hold real vectors: 16 `*.vectors.ts` suite files. **14** are registered in
  the `conformanceSuites` array in `we:conformance-vectors/index.ts`; the other two (`webdocs`,
  `webdirectives-ssr`) are different-shape golden-vector suites exported separately.
- **WE ships no driver that executes them against a candidate.** By design, not by omission: the header of
  `we:conformance-vectors/index.ts` states that "the runtime driver that executes a suite against a candidate
  component lives in plateau/FUI per #899", and WE owns "only the build-agnostic contract — the vectors and the
  shape". What WE ships is `we:conformance-vectors/schema.ts` and the `assertConformanceSuite` **structural**
  validator, which checks that a suite is well-formed — not that any implementation passes it.
- **One executing runner does live here** — `we:wrapper-conformance/runner.ts` (#891), a headless-DOM harness,
  deliberately generator-agnostic. Two things bound it today: the corpus in
  `we:wrapper-conformance/vectors.ts` is **2 vectors**, and it needs a per-framework `WrapperSubject` adapter
  to drive anything. **No non-test `WrapperSubject` implementation exists in WE** — the only one is the double
  in `we:wrapper-conformance/__tests__/runner.test.ts`. FUI owns the real subjects (the #855 B2 boundary).
- **Coverage of declared contracts is partial.** 14 executable-shape suites against **42** protocols. On the
  other declaration axis: `we:contracts/package.json` publishes **35** subpath exports, and the tree holds
  **39** files of the `we:**/contract.ts` / `we:**/*-contract.ts` shape. Either way roughly a third of what is
  declared has a vector suite, and none of it has an in-repo runner that grades an implementation.
- **No gate executes the corpus.** Nothing under `we:scripts/` imports `we:conformance-vectors/` except the
  generator `we:scripts/gen-webdirectives-ssr-vectors.mjs`; `check:standards` does not run the vectors.
  `npm run check:app-conformance` (`we:scripts/check-app-conformance.mjs`) is a **different axis** — the
  exercise-app platform-conformance benchmark — and should not be cited as artifact-conformance proof.

**The honest gap is an asset, and this is the line to hold.** Claiming provable conformity you do not have is
the fastest way to lose enterprise trust rather than win it — a buyer who tests the claim and finds a
structural validator where they expected a grader does not come back. Recorded here so nobody later mistakes
the aim for the state. Concretely, the distance from here to the thesis is: a driver WE can point at (or a
ruled statement that the driver is FUI's and WE never ships one), vector coverage past a third of declared
contracts, at least one real `WrapperSubject`, and a corpus larger than two.

## Evidence from the 2026-08-08/09 session — the verified subset only

This session is itself a partial demonstration of the "reviewed automated delivery" claim, and the claim
should be made only from what re-checks. Verified with `gh pr view`:

- **PR #1113** (merged 2026-08-09) — the converge daemon. A pass runs `git reset --hard`, and the launchd job
  is a `StartInterval` of `DEFAULT_INTERVAL_SEC = 900` (15 minutes) in
  `we:scripts/converge-daemon-install.mjs`. Both the pass (`assertNotPrimary`) and the installer
  (`installBlockers`) refuse to run against the operator's primary checkout — "because either alone leaves a
  hole". So the fifteen-minute destructive loop over a live working tree was a real shape, and the ruling is
  what forced it into its own clone.
- **PR #1124** (merged 2026-08-09) — an operator's `review:human` clearance on PR #1106 was silently revoked
  seven minutes later. Root cause reproduced against the real commits, not hypothesised, and the rendered
  escalation block shown byte-identical to the one on the live PR. Two design holes closed: the clearance
  record was written but never read back, and the re-hold posted no comment.
- **PR #1129** (merged 2026-08-09) — **the guard that refused its own author.** Both sanctioned clearance
  routes refused, each naming the other, leaving an operator approval on a self-authored `review:pending` PR
  with no recording route at all. Its wider finding matters more than the deadlock: a subagent inherits its
  parent's `CLAUDE_CODE_SESSION_ID`, so a subagent "independent adversarial review" is **the same actor as the
  author** by this repo's own #2439/#2398 bar, and `we:scripts/lib/review-core.mjs` and
  `we:scripts/lib/jury-core.mjs` import nothing from `we:scripts/lib/review-independence.mjs`. The finding is
  **subagent-scoped, not universal**: a headless `claude -p` spawn does *not* adopt the inherited id — it mints
  its own `session_id` — so headless spawns are structurally distinct actors and independent review stays
  possible via that route (#3028 / PR #1131, merged 2026-08-09, which verified both halves and builds the
  juror spawn on exactly that distinction; re-verified independently by the 2026-08-09 review of this card).
- **Numbers corrected by later review** — #3012's own body records `+1,699 → +705 → +480 → +147` as
  **unreplicated** (no `2026-08-08 delivery review` exists under `we:reports/`), records the `38,852` gap
  figure as not reproducing either way, and records the earlier projection as high (`+1,591 → +1,909 → +427`
  vs. the measured `+1,510 → +1,909 → +399`). Three numbers earlier passes had wrong, corrected in the record.

**Dropped for want of evidence, and recorded as dropped so they are not re-quoted:** the framing that "eleven
PRs landed" does not reproduce — 61 PRs carry a merge timestamp in the 2026-08-08..2026-08-09 UTC window, 12 of
them on 2026-08-09. "Deleting the fix left 540/540 green" does not appear in PR #1124, whose recorded
verification is `npm run test:unit`, 300 files / 6,383 tests. And the corrections above should **not** be
attributed to "a genuinely separate reviewer" — those passes ran as same-session subagents, which PR #1129
establishes are the same actor as the author by this repo's own definition. That disqualifies *those
reviews*, not independent review as such: a headless `claude -p` spawn mints its own `session_id` and is a
distinct actor (#3028 / PR #1131).

## Not ruled — what this item captured, and what is now prepared below

This card started as **capture only** — nothing built, nothing ruled, no third class proposed. The four
open questions it originally posed are answered below as a **validation gate** (productize or not) and
**two forks** (does the metric need a third class; does it need cross-repo reach) — prepared to
Definition of Ready, still **not ratified**. `preparedDate` marks that the research + authoring is done,
not that #3010 or this card's own gate/forks have been decided. #428 (open, parked 2026-06-14) is the
open-core tiering mechanics call, scoped to Web Docs and deferred behind the live-serve strategy; it does
not cover this and is not touched by anything below.

Whoever rules #3010 must not be able to miss this card — hence the `crossRef` above and the reciprocal note
on #3010 itself.

## Validation gate — package the conveyor/delivery-loop machinery as an external product, or keep it internal?

**Why this is a validation gate, not a `## Fork N`:** the standing test asks for an excluded/broken branch,
or two branches that genuinely cannot coexist. Neither holds here. "Internal-only" is the current, coherent,
already-shipped state — every actual consumer of this machinery (WE's own delivery loop) is served fine by
it today. "Productize" is a candidate addition whose case has to be built, not the forced alternative to a
broken default. So this takes the go/no/not-yet shape.

**Digest + verdict: NOT-YET**, gated on a named, falsifiable trigger — not a park with no un-gate condition.

**Prior-art delta.** Comparable products that sell delivery/orchestration machinery externally: Temporal
(a workflow-orchestration engine sold standalone, decoupled from any one company's own workflows),
Buildkite/CircleCI (CI orchestration sold as a hosted product), GitHub Actions' self-hosted-runner model,
and in the AI-coding space directly: Devin, GitHub Copilot Workspace, and IDE "background agent" products
that sell "an agent drives the delivery loop" as the pitch itself. What they share structurally, and what
this repo's conveyor currently lacks, checked against the tree at `origin/main` cedc9524:

1. **A documented, externally-invocable interface, decoupled from one team's own repo.** The operation
   engine's HTTP adapter (`we:scripts/operations/http-adapter.mjs`) is wired only into plateau-app's own
   dev-panel (`plateau:tools/dev-panel/vite-plugin.ts`) — there is no published, versioned external API
   surface.
2. **A control plane that isn't a local file behind one process.** `we:scripts/operations/run-store.mjs`
   rides what #3029 itself calls "the store-seam discipline (#2626 proposes) — it migrates when that
   decision's product trigger fires, not before"; #2626 is still open. The run-record store is deliberately
   not yet the shape an external, multi-tenant product would need — by the epic's own scoping, not by
   omission.
3. **A third party's code to prove conformance against.** Every comparable "AI delivers code, provably"
   pitch lives or dies on grading against the *customer's* own components. This item's own "differentiator"
   section above already records the state, checked at 73a3925b: WE ships no driver that executes the
   conformance vectors against a candidate; 14 of 42 declared protocols have an executable-shape suite
   (~a third); the corpus is 2 vectors; and the only `WrapperSubject` implementation in the tree is a test
   double. Selling "provable conformity" before the prover exists is precisely the enterprise-trust-destroying
   move that section's own "the honest gap is an asset" line warns against.

**Build conditions — must exist before this can ship, whenever it ships (not the trigger itself):**

1. **A working artifact-conformance prover.** At least one non-test `WrapperSubject` for a real framework
   target, coverage that grows meaningfully past today's ~third of declared protocols, and a driver that
   actually executes the corpus in CI (today nothing does — `check:standards` does not run the vectors).
   No specific percentage is fixed here deliberately — the load-bearing fact is a *working, CI-exercised*
   prover, not a number crossed on paper; a product whose entire differentiator is "provable conformity"
   cannot ship before the prover does, regardless of anything else.
2. **The operation engine's HTTP adapter published as a documented, versioned external interface** — not
   only mounted into plateau-app's own dev-panel. The mechanical precondition #3029 itself names: "the only
   way the UI will be able to use it."

**Concrete un-gate trigger — the actual go/not-yet signal:** a real prospective customer or partner asks to
run this delivery machinery against their own repo. Not a hypothetical enterprise buyer, and not "the build
conditions above are done" — those are prerequisites this gate would still require even with unlimited free
engineering time (you cannot sell a prover that doesn't exist), so they are not themselves reasons to defer
once a real ask exists; they are work items the ask would trigger. Absent the ask, do not build toward this.

**Monetization-framing default (resolves the item's original Q4 — where does this sit in #089's layers?):**
this does not need a fourth layer, even once the gate turns "go." The existing
[#brand-on-distinctness](../docs/agent/platform-decisions.md#brand-on-distinctness) statute already governs
this exact shape of question: *"a sub-component gets its own marketed product brand only when it has a real
standalone consumer surface... default is fold"* — un-parked only when "≥1 consumer depends on it without
depending on the parent." The conveyor has no such consumer today: its only consumers are this repo's own
delivery loop and, via the same HTTP adapter named above, plateau-app's own dev-panel — both *inside* the
constellation. #089 already names the shape this folds into on a "go": the conveyor is the shared engine
under #089's tier-1 "AI-assisted code tools" family (#086 mockup→code, #094 upgrader, #095 conformance
auto-fix, #096 NL→configurator) — each of those tools' "propose, then verify against the standard" loop is a
smaller instance of what the conveyor already mechanizes end-to-end for this repo's own delivery — and it
strengthens idea #1's ("trusted continuous conformance verification") pitch once artifact conformance
exists, since "process conformity, provably, on every change" is the same SSL/CA pitch idea 1 already makes.
Fold by default; revisit only on brand-on-distinctness's own un-park trigger.

**Cost, if the gate later turns "go" — grounded in the current tree.** `we:scripts/operations/` (8,095
lines), `we:scripts/readiness/` (7,738 lines), and `we:scripts/conveyor/` (5,003 lines) total ~20,836 lines
as measured on this branch, none of it written with an external customer, a support/SLA boundary, a
multi-tenant run-store, or a documented external API in mind. `we:scripts/operations/` alone grew from 0 to
8,095 lines in about six days (first commit `58cd55b3`, 2026-08-09) — a live signal of how fast the target
is still moving, not a stable surface ready to package. Separately, `plateau-app:src/backlog-view/` (the
actual conveyor-board UI, per #2586/#2660) is 21,422 lines across 73 files — real product-shaped work the
WE-only output-mix metric cannot see at all (Fork 2, below).

**Skeptic:** SURVIVES WITH AMENDMENT. Attack: "the NOT-YET verdict seems to contradict the ratified statute
[#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
clause 4, which already calls the operation engine 'two permanent products for different people' — ratified
2026-08-08. That's the operator already ruling a product framing applies." Answer: clause 4's "two products"
is a narrower claim than this gate's — it names two *delivery modes* for the same internal loop (solo-local
vs. hosted-key-billed), both still serving WE's own delivery today; nothing in #3031 or #3029 proposes
selling the hosted tier to a third party outside the constellation. Amendment: this write-up holds that
distinction explicitly so it is never later read as contradicting the ratified statute — clause 4's
"product" means "a permanent architectural seam for who runs the compute"; this gate's "product" means "sold
externally, to a customer, with a support boundary and a conformance claim someone outside WE can test."
Both are true at once; they answer different questions. Classification axis: not a config dimension
(internal-only and sold-externally are not two values of one knob a current consumer picks between), not
support-both (a support/SLA boundary and an external customer relationship cannot be added without deciding
to add them), not settled by precedent (the operation-engine statute answers an adjacent but distinct
question, per the amendment). Statute-overlap: none found — clause 4 and this gate's verdict govern
different turf (compute-seam architecture vs. go-to-market), reconciled by the amendment rather than
colliding. Citation-scope: clause 4's authoring scope is the operation engine's execution architecture
(#3031), not go-to-market — supporting context here, never cited as authority over the sell/don't-sell call.

**Screen:** clear, after correcting where the merit lives. (1) This gate is squarely a go-to-market framing
question (sell externally vs. stay internal) — not an implementation detail hidden behind the WE↔FUI
boundary; correctly placed as a business-strategy call on this item rather than folded into a build item's
scope. (2) Imagining unlimited engineering capacity to build and maintain both build conditions instantly:
the prover and the published API would exist "for free" under that hypothesis, which means they are NOT
where the irreducible merit gap lives — citing them as the reason to defer would be prioritization dressed
as merit. The gap that survives free, perfect engineering is the un-gate trigger itself: no amount of
build capacity manufactures a real external customer asking to run this against their own repo. That is why
the trigger is written as the ask, not as "the build conditions are done" — the recommendation above already
reflects this; flagged here so the distinction stays load-bearing rather than decorative.

## Fork 1 — does the output-mix classifier need a third class, or does the conveyor stay `machinery` with a named exception?

**Fork exists:** the classifier's schema forces a single choice for the instrument as a whole — either
`we:scripts/lib/output-mix-paths.json` carries a third `class` value (with real rules routing specific paths
into it) or it stays two-class and any "this file is different" judgment happens outside the instrument, in
a hand-maintained exception list. A given ruleset cannot be both two-class and three-class at once — the
report `we:scripts/lib/output-mix.mjs` renders is either a sum over two buckets or three. That is the
genuine either/or (two branches that cannot coexist in one instrument, not a forced invariant). A third
design — an orthogonal boolean tag (e.g. `sellable: true`) alongside the existing `class`, rather than
expanding the enum — was considered and set aside: it answers the same question as option (a) below but
costs a second field on every rule for no expressive gain over a third enum value, since nothing here needs
a path to be simultaneously product *and* sellable-machinery.

- **(a) Add a third class, `product-in-disguise`, to `we:scripts/lib/output-mix-paths.json` — DEFAULT.**
  Route a deliberately narrow seed set into it rather than trying to classify all of `we:scripts/**` at
  once: `we:scripts/operations/**` (the declared-operation engine) and the four paths this item's own table
  above already named (`we:scripts/conveyor/status-board.mjs`, `we:scripts/lib/jury-core.mjs`,
  `we:scripts/lib/review-core.mjs`, `we:skills-src/conveyor/SKILL.md`). Leave the rest of `we:scripts/**`
  (including all of `we:scripts/readiness/**`) as plain `machinery` by default — the item's own "plausibly
  no" list already names lane pooling, JIT numbering, and drain mechanics as this-repo-only bookkeeping.
  ```json
  {
    "match": "scripts/operations/**",
    "class": "product-in-disguise",
    "why": "the declared-operation engine (#3029) — output-mix-paths.json's own productScope note excludes all of scripts/** from `product` on a WE-to-FUI seam test that cannot see a WE-to-external-customer seam; this class exists to cover exactly that blind spot, independent of any product-tier ruling"
  },
  {
    "match": "scripts/conveyor/status-board.mjs",
    "class": "product-in-disguise",
    "why": "the conveyor status surface named directly in #3049 as the operator's example of shippable delivery machinery"
  }
  ```
  Every new rule in the class must cite a *concrete* external-shippability signal — the productScope seam
  gap, an existing product-tier ruling, or a named prospective external consumer — never "feels valuable,"
  so the class earns the same declared-and-inspectable discipline `we:scripts/lib/output-mix-paths.json`'s
  own header already claims for product vs. machinery. (Note: `we:scripts/operations/**` is cited above on
  the seam-test gap, *not* on
  [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
  clause 4 — the Validation gate above establishes that clause 4's "two products" means two delivery
  *modes* for WE's own use, not external sellability, so citing it here as an external-shippability signal
  would contradict that reading. The seam-test gap is the honest, non-contradictory citation.)
- **(b) Stay two-class; treat conveyor paths as a named exception inside #3010's quota mechanism itself**
  (mirrors #3010 Fork A's "named exception list" pattern) rather than touching the classifier. Cheaper today
  — zero instrument changes.

**Tradeoff — a decision-locus difference, not a maintenance-cost one.** A class is a general partition rule:
once authored, it classifies any future path matching its pattern with zero further human decisions — the
judgment is exercised once, at rule-authoring time, and applies forever. A named exception list requires a
fresh human decision act *for every new file*, forever, no matter how cheap or well-staffed that act is —
someone has to notice the new file and choose to add it. That is true even under unlimited, instantly-applied
maintenance budget: the list still needs a *decision event* per file the class does not. (b) is not simply
"more work" than (a); it is a structurally different, permanently-recurring judgment liability. Concretely,
`we:scripts/operations/` went from 0 to 8,095 lines in ~6 days — under (b) that is at least one fresh
exception-list decision already overdue.

**Skeptic:** SURVIVES WITH AMENDMENT. Attack: "'would this ship outside this repo' is exactly as subjective
as 'it's all product really' — you have not made the line mechanical, you have just moved the fuzziness from
a binary call into a fuzzier ternary one, which undermines the classifier's own claim that disagreeing means
'open this file, change one rule.'" Answer: the existing two-class instrument is not zero-subjectivity either
— its own `productScope` field is prose, and the "seam test" it already applies required a judgment call (PR
#1128) about `we:conformance-vectors/` vs. everything else under `we:scripts/`. The discipline #3012 actually
offers is *declared and inspectable* subjectivity, not *absent* subjectivity — one paragraph, in the file,
that anyone can read and dispute. `product-in-disguise` can meet that same bar. Amendment: hold the seed set
to the concrete citation rule stated in (a) above so the new class inherits the same discipline rather than a
weaker one — and, specifically, never cite
[#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
clause 4 as an external-shippability signal (see the note under (a)); cite the seam-test gap instead.

**Screen:** clear. (1) Not an implementation detail hidden across the WE↔FUI boundary — the classifier lives
in `we:scripts/lib/`, used only by WE's own progress board; this is entirely an internal WE
measurement/governance question, correctly kept on this side. (2) With unlimited maintenance budget for both
branches, a real merit gap survives, located in decision-locus rather than cost: (a) needs one human judgment
per pattern, ever; (b) needs one human judgment per file, forever, regardless of how instantly that judgment
could be executed. That is merit (who must notice and re-decide), not prioritization in fork costume.

## Fork 2 — must the enforcement instrument reach cross-repo before a repo-wide quota can bind on it?

**Fork exists:** #3010's Fork A (the freeze) states its own scope as "repo-wide" explicitly; Fork B (the
quota) says only "each week, at least half of newly-opened lanes serve product items," without stating a
repo scope of its own. That silence is the fork: either Fork B is read as inheriting Fork A's explicit
WE-repo-wide framing (and the output-mix instrument, which is WE-only, is adequate to enforce it), or Fork B
is read as covering constellation-wide lane-opening (in which case a WE-only instrument cannot legitimately
enforce it, and needs cross-repo reach first). A single ruling of Fork B has to pick one of these readings —
it cannot claim to bind lane-opening in general while relying on an instrument that only sees one repo,
without saying which scope it actually means.

- **(a) Read Fork B as WE-lane-opening only, matching Fork A's stated scope — DEFAULT.** Recommend #3010 add
  one clarifying sentence to Fork B itself: the quota governs WE lane-opening, and a constellation-wide
  product signal (if ever wanted) is a separate, future instrument — not a precondition for ruling Fork B
  now. Zero net-new code.
- **(b) Extend `we:scripts/lib/output-mix.mjs` cross-repo before enforcing the WE-side quota** — pull
  plateau-app (and frontierui) commit/lane activity into the same weekly report. Closes the blind spot this
  item names (the 21,422-line `plateau-app:src/backlog-view/` UI counts as neither product nor machinery
  today — it isn't counted at all), but requires new cross-repo aggregation infrastructure, duplicates the
  "which repo is truth for backlog/status" question already live and open in #3129 ("per-repo backlog data
  model"), and adds a second axis of drift risk: three repos' classifiers now have to stay mutually
  exclusive and jointly exhaustive, forever, for a number whose only current consumer is a WE-internal
  lane-opening discipline.

**Tradeoff:** (a) ships now, at the cost that the blind spot stays real — someone could in principle satisfy
a WE lane-opening quota by moving product-shaped work to a sibling repo, and the dashboard would read that as
a clean win rather than a gamed one. (b) closes the blind spot honestly, at real infrastructure cost, in
service of a question Fork B's own text never actually poses (the constellation's aggregate ratio, vs. WE's
own lane-opening discipline) — building it now would answer a bigger question than the one in front of the
ratifier.

**Skeptic:** SURVIVES WITH AMENDMENT. Attack: "then Fork B's whole premise — 'rebalance toward product' — is
gamed for free the moment someone routes new product-shaped work into plateau-app instead of WE; the
dashboard reports success while the constellation's real ratio hasn't moved." Answer: this attack applies to
*any* single-repo instrument, in any repo, forever — and Fork A is explicitly WE-scoped by design already (it
does not propose freezing plateau-app or frontierui lane-opening). The gaming risk is real, but it is a
Fork-B design question (should the floor be measured per-WE-lane, or does the operator's own discipline just
have to not game it), not evidence the *measurement instrument* itself must go cross-repo. Amendment: this
fork's write-up carries the residual-risk note forward explicitly onto #3010 (a cross-reference, mirroring how
this item already cross-references #3010's Fork B) so whoever rules Fork B sees the gaming risk named, even
though the instrument itself stays WE-only under this default. Citation-scope correction made during prep:
earlier drafting of this fork read Fork B's own text as if it asserted "repo-wide" directly — it does not;
only Fork A and the item's title do. The fork above is now phrased as an inherited-scope reading, not a direct
quote from Fork B.

**Screen:** clear. (1) Not a WE↔FUI implementation-boundary question at all — this is a WE-internal
process-measurement scoping call (does WE's own lane-opening quota need a cross-repo view), correctly kept
here. (2) With unlimited engineering budget for both branches, a real merit gap survives: (b) still answers a
larger, different question ("what does the whole constellation ship") than what Fork B's own text actually
poses ("newly-opened lanes serve product items"), read most naturally as this-repo's lanes given Fork A's
sibling framing — building cross-repo reach now would be solving a bigger problem than the one in front of the
ratifier. Merit (scope-correctness), not "we'll get to it eventually" prioritization.

### Review jury (provisional — pre-registered #2638)

Care band: **elevated** (system-machinery, statute-candidate tags, cross-repo consideration in Fork 2; not
`high` — this does not touch gate-self). Predicted touch-set of the work this decision authorizes, if
ratified: `we:scripts/lib/output-mix-paths.json`, `we:scripts/lib/output-mix.mjs`,
`we:docs/agent/platform-decisions.md`.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

## The mechanical link to the operation engine (#3029)

Recorded 2026-08-09 alongside the operator note on #3029: *"the only way the UI will be able to use it"* is what
connects this thesis to the operation engine. The conveyor is a product only insofar as its UI surface can
actually invoke the delivery operations, and under the statute
[#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
a caller for the console is **generated from a declaration** — so an operation that is not declared onto #3029's
engine cannot appear in the console at all. That makes the operation registry the supply of features this
product ships, and an undeclared operation a feature it cannot sell. The rationale in full is on #3029; noted
here so the dependency reads in both directions.
