---
kind: decision
size: 3
status: open
dateOpened: "2026-08-09"
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

**#3010** (`bornAs: xh1d1el`, `kind: decision`, **open**) proposes a repo-wide process-work freeze plus a
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
plausibly where most of the +26,000-to-+48,000 machinery lines a week actually sit.

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
  `we:scripts/lib/jury-core.mjs` import nothing from `we:scripts/lib/review-independence.mjs`.
- **Numbers corrected by later review** — #3012's own body records `+1,699 → +705 → +480 → +147` as
  **unreplicated** (no `2026-08-08 delivery review` exists under `we:reports/`), records the `38,852` gap
  figure as not reproducing either way, and records the earlier projection as high (`+1,591 → +1,909 → +427`
  vs. the measured `+1,510 → +1,909 → +399`). Three numbers earlier passes had wrong, corrected in the record.

**Dropped for want of evidence, and recorded as dropped so they are not re-quoted:** the framing that "eleven
PRs landed" does not reproduce — 61 PRs carry a merge timestamp in the 2026-08-08..2026-08-09 UTC window, 12 of
them on 2026-08-09. "Deleting the fix left 540/540 green" does not appear in PR #1124, whose recorded
verification is `npm run test:unit`, 300 files / 6,383 tests. And the corrections above should **not** be
attributed to "a genuinely separate reviewer" — PR #1129 is the reason that phrase cannot be used, since it
establishes the reviewer was not independent by this repo's own definition.

## Not ruled — what this item is for

This is **capture**. It rules nothing, proposes no third class, and does not decide #3010. What a later turn
has to settle:

1. **Does the output-mix metric get a third class** (product / product-in-disguise / plumbing), or does the
   product/machinery split stand with the conveyor understood as an accepted exception?
2. **If #3010 Fork B adopts a numeric quota**, what stops it penalising the conveyor — an exemption list, a
   different denominator, or the third class above?
3. **The metric is WE-only.** Does an instrument that cannot see `plateau-app:src/backlog-view/` qualify as an
   enforcement instrument for a repo-wide quota at all?
4. **Where the conveyor-as-product thesis lives in the monetization story.** #089 (open) frames the money as
   three layers beside the open spec — trust, hosted infrastructure, interop tooling. A delivery conveyor is
   **none of the three**, so either it is a fourth layer or #089's framing needs revisiting. #428 (open,
   parked 2026-06-14) is the open-core tiering mechanics call, scoped to Web Docs and deferred behind the
   live-serve strategy; it does not cover this.

Whoever rules #3010 must not be able to miss this card — hence the `crossRef` above and the reciprocal note on
#3010 itself.
