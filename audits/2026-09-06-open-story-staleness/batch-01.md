# Batch 01 — staleness audit (9 cards, all children of epic #3318)

- **ALREADY-DONE: 2** (#3350, #3351)
- **SUPERSEDED: 0**
- **STALE-INFO: 6** (#3315, #3318, #3326, #3330, #3339, #3341)
- **STALE-PREMISE: 0** · **DEAD-REFS (as primary): 0** — but 4 cards carry secondary dead/drifted refs
- **OK: 1** (#3338)

Repo checked: `/home/user/web-everything` @ `05e5f4c`. All verification by reading live source; one vitest run.

---

## #3315 — The per-category effective-false-positive meter
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Card body: *"BLOCKED on the verdict ledger: **verdict-ledger.append has no registered sink**…"* — **false now.**
    `/home/user/web-everything/scripts/operations/review-pr-io.mjs:503` registers a real sink for
    `REVIEW_EFFECTS.LEDGER`, and `REVIEW_EFFECTS.LEDGER === LEDGER_EFFECT_TYPE === 'verdict-ledger.append'`
    (`scripts/operations/review-pr.mjs:479`, `scripts/operations/effect-executor.mjs:58`). It calls
    `appendVerdict(buildVerdictRecord({…}))`. A second writer exists on the ordinary label path
    (`scripts/review-set-label.mjs:81,829`).
  - Still true: `.conveyor/jury/` is gitignored (`/home/user/web-everything/.gitignore:71`), and **#3255 is
    still open** — `verdictLedgerDir()` (`scripts/lib/verdict-ledger.mjs:768`) still returns the machine-global
    `~/.claude/verdict-ledger`, so the ledger is local-only, which is the real remaining blocker.
  - Card quality: the whole `## Done when` is the literal placeholder
    *"1. **Executable** — TODO: a command that fails before this item lands and passes after."* — the card is
    not buildable as written.
- **suggested action:** edit card — (1) delete the "no registered sink" clause and re-state the blocker as
  *"the ledger is machine-local until #3255 lands, so no cross-machine finding corpus exists"*; (2) replace the
  TODO Done-when with a real executable criterion before this is ever dispatched.

## #3318 — Review-efficacy watch (ongoing program epic)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the `## The goal-set` table's **State** column is out of date for 7 of its 10 rows; every one of
  those rows now has a **resolved** child and live code:

  | row | card State | reality |
  |---|---|---|
  | 1 verification mandatory (`requireVerified` default true) | "buildable now" | #3321 **resolved**; `scripts/pr-land.mjs:156,764`, `scripts/verify-lane.mjs:70,108`, `scripts/lib/lane-verify.mjs` |
  | 2 announce skipped/degraded review | "buildable now" | #3308 **resolved** |
  | 3 non-code PRs routed off the code reviewer | "buildable now" | #3309 **resolved**; also #3335 (lens derived from touch-set) resolved |
  | 4 escalation basis cumulative from merge-base | "buildable now" | #3317 **resolved** |
  | 5 security lens once per code PR | "buildable now (+~$0.29/PR)" | #3319 **resolved** |
  | 7 findings admitted by evidence kind | "blocked — suite runtime" | #3312 **resolved**; `EVIDENCE_KINDS` / `admitFindingsByEvidence` / `evidenceKind` live in `scripts/lib/jury-core.mjs:15,64,426-433` |
  | 10 determinism / run-to-run stability | "**unaddressed by any layer**" | #3310 **resolved**; `scripts/review-corpus/stability.mjs` exists and is the measurement |

  Rows 6 (#3158), 8 and 9 (ledger, #3007/#3255) are still correctly blocked — all three items are still open.
  The sentence *"5 buildable + 4 blocked + 1 unaddressed = 10"* and its retraction block are therefore both
  describing a state that no longer exists.
  Also: *"L1 is a `/review-efficacy` skill"* — no such skill exists (`ls .claude/skills` has 29 skills, none
  matching `effic`); that is a plan statement, not a claim, so it is not itself stale.
- **suggested action:** edit card — this is the program's next **watch** run: re-derive the goal-set State column
  (7 rows move to "shipped, cite the child"), and re-state which elements remain (6, 8, 9 + whatever the shipped
  rows left owing). Do NOT resolve — it is `ongoing: true` by design.

## #3326 — Scoped fan-out review — disjoint accountability over a shared full-diff context
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - `blockedBy: ["3158", "3335"]` — **#3335 was resolved 2026-08-27**
    (`backlog/3335-a-review-caller-must-derive-its-lenses-from-the-pr-s-touch-s.md`). Only #3158 (open) still
    blocks. Frontmatter is stale.
  - Everything else verified current: `scripts/review-corpus/stability.mjs` ✓,
    `reports/2026-08-27-scoped-fan-out-code-review.md` ✓, the `/research/scoped-fan-out-code-review/` topic ✓
    (`src/_data/researchTopics/scoped-fan-out-code-review.json` + `src/_includes/research-descriptions/…njk`),
    `withRealRepo` ✓ (`scripts/operations/__tests__/helpers/real-repo.mjs`), `panelRigorForCareLevel` ✓
    (12 hits in `scripts/lib/jury-core.mjs`), all three cited `platform-decisions.md` anchors ✓, #3354 and
    #3264 (cited in Done-when 4/5) both resolved ✓.
  - The unbuilt scope entries (`scripts/lib/review-shards.mjs`, its test) genuinely do not exist, and
    `maxShards` is not yet in `scripts/lib/review-policy.contract.json` — consistent with an unbuilt card, not
    rot.
- **suggested action:** edit card — drop `"3335"` from `blockedBy`.

## #3330 — Always-on advisory sanity check over the no-reason PRs that reach no reviewer
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - `blockedBy: ["3329"]` — **#3329 resolved 2026-08-27**. The `observed` verdict it was waiting on now exists:
    `scripts/lib/verdict-ledger.mjs:142` (`OBSERVED: 'observed'`), `:176` (`NON_BEARING = [VERDICTS.OBSERVED]`),
    `:258` (maps to no label). **This card is now unblocked** and its `## Not in scope` bullet
    *"The `observed` verdict itself — `#3329`, which this is blocked on"* is stale.
  - The work itself is genuinely NOT done: nothing anywhere writes an `observed` row (grep for
    `VERDICTS.OBSERVED` / `'observed'` across `scripts/`, `scripts/lib`, `scripts/operations`,
    `scripts/workflows` returns only the ledger's own definition). No sanity-juror pass exists.
  - Its doc link `#every-pr-gets-a-look-advisory-floor` resolves —
    `docs/agent/platform-decisions.md:3805`. `#3158` referenced as a real cost is still open ✓.
- **suggested action:** edit card — clear `blockedBy`, restate the `Not in scope` bullet as *"delivered by
  #3329"*. This is now the most dispatch-ready card in the batch.

## #3338 — Should every advisory lens block above the impact bar, or only claim-accuracy
- **verdict:** OK (minor line drift)
- **confidence:** high
- **evidence:** correctly parked — `blockedBy: ["3374"]` and **#3374 is still open**, so the "do not rule this
  yet" block is current. `relatedReport` file exists
  (`reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md`). Its factual claims still hold:
  `BLOCKING_ADVISORY_LENSES` is still unbuilt (only a comment at `scripts/lib/jury-core.mjs:1171`);
  `review-parked-prs.mjs:154` really is `const MANDATORY_LENSES = ['correctness','security']` (exact hit);
  the `:141` advisory-never-blocks comment is at `scripts/workflows/review-parked-prs.mjs:140-141` (exact);
  `scripts/review-corpus/mine-review-corpus.mjs` exists; the anchor
  `#claim-accuracy-advisory-blocks-on-impact` is at `docs/agent/platform-decisions.md:3856`.
  Only drift found: `we:scripts/review-core-cli.mjs:186` (cited as a `mandatoryLenses` config surface) — the
  symbol is at `:183`, `:186` is now `reasons,`.
- **suggested action:** none (optionally bump the one line ref to `:183`).

## #3339 — An advisory lens's outstanding above-bar findings block the panel verdict
- **verdict:** STALE-INFO (line references drifted) — the work itself is genuinely open
- **confidence:** high
- **evidence:** substance confirmed still needed: `BLOCKING_ADVISORY_LENSES` exists nowhere in the repo except
  as prose in `scripts/lib/jury-core.mjs:1171`, whose own "NOT YET WIRED" paragraph states exactly this card's
  gap; `derivePanelVerdict` (`scripts/lib/jury-core.mjs:1353`) still has only the two mandatory scans plus the
  **resolved**-finding prevention scan. **But every `file:line` in the Shape section has drifted:**

  | card says | actual |
  |---|---|
  | `jury-core.mjs:530-535` (`blocksAcceptance`) | `:971` |
  | `jury-core.mjs:485` (`hasUncapturedPrevention`) | `:926` |
  | `jury-core.mjs:242` (`impactStrictness` throws) | `:249` |
  | `jury-core.mjs:384` (`normalizeFindings`) | `:461` |

  The semantics the card asserts at each of those lines are all still true (verified by reading `:926-929`,
  `:971-976`, `:249-251`), so this is pure reference rot, not a wrong mechanism.
- **suggested action:** edit card — re-anchor the four line refs. Then it is dispatch-ready (no `blockedBy`).

## #3341 — A card's mechanism claim must cite the function or line that backs it
- **verdict:** STALE-INFO (line references drifted) — deliberately left open for its non-gateable half
- **confidence:** high
- **evidence:**
  - The card's own closeout note is accurate: `uncitedMechanismClaim` **is** at
    `scripts/review-corpus/gates.mjs:647` (exact hit), and the gates test file carries 18 hits for `3341`.
    The remaining half (write the convention where reviewers meet it) is genuinely undelivered — the
    convention lives only in the gate's docblock.
  - Drifted refs:
    - `we:scripts/review-corpus/gates.mjs:724` (claimed GATES registration) → the registry is
      `export const GATES` at `:1060`, and the entry is `:1069`.
    - `we:scripts/review-corpus/gates.mjs:406` (`citation-line-content`) → the function
      `citationLineContent` starts at `:395` (`:406` is mid-body); registry entry `:1068`.
    - `we:scripts/pr-land.mjs:839` ("scores off a local `computeNetDiffSignals(...)`") → the call is at
      `scripts/pr-land.mjs:898`; `:839` is now an unrelated label comment.
    - `we:scripts/merge-ai-prs.mjs:2060` (`resolveNetDiffBasis`) → `:2490`.
  - Mild irony worth flagging: this is the *citation-rot* card, and four of its own citations have rotted.
- **suggested action:** edit card — re-anchor the four refs; keep open for the convention half (which, as the
  card says, needs `scope:` widened beyond `gates.mjs` or a sibling card).

## #3350 — An automated rebase defeats the drain's re-sync, because that re-sync requires CI green
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** the card's own Done-when 1 executable check **now passes** (it is specified to fail before the
  item lands). Run at `/home/user/web-everything`:

  ```
  node -e "const s=require('fs').readFileSync('scripts/merge-ai-prs.mjs','utf8');
           const i=s.indexOf('export function isRebaseDropCandidate');
           process.exit(/do not rebase a queued PR from outside the drain/i.test(s.slice(Math.max(0,i-1200),i))?0:1)"
  # → exit 0   (card records: "Run in this lane at this card's tip: exit 1")
  ```

  The note is `scripts/merge-ai-prs.mjs:630-639`, immediately above `isRebaseDropCandidate`
  (now `:641`), and it states the invariant **and its reason** exactly as Done-when 2 requires
  (*"#3350 — INVARIANT: **do not rebase a queued PR from outside the drain.** The reason is the load-bearing
  half… a rebase MOVES THE HEAD, which restarts the required `test` check… the precondition can never hold and
  the self-healing queue becomes a livelock"*), including the eight-PR observation and the generalized rule.
  The **call-site** constraint the card says is "what is genuinely missing" is also present, at
  `scripts/merge-ai-prs.mjs:3601-3610` (*"REBASING A QUEUED PR IS THE DRAIN'S OWN JOB… Invariant: do not
  rebase a queued PR from outside the drain. Reason: `isRebaseDropCandidate` gates on `testGreen`…"*).
  Done-when 3 (`npm run check:standards`) not re-run here.
- **secondary DEAD-REFS:** `we:scripts/__tests__/merge-ai-prs.test.mjs:1042 / :1051` — **that file no longer
  exists**; the suite was split into six files and the `isRebaseDropCandidate` cases now live in
  `scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs:289-322`. Also `:609` → `:641`,
  `:612` → `:644`, call sites `:3047/:3078/:3101` → `~:3611`, and the "unrelated R2 livelock" grep hits
  `1215,1425,1515,2688` → `1274,1555,1645,3189`.
- **suggested action:** resolve.

## #3351 — Validate a juror's cited file against the net diff, and cover the AI seam with fake-juror fixtures
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** shipped under the card's `bornAs` id `#x6t2z6h` (JIT numbering — the tests are tagged with the
  born id, not `#3351`, which is why the card's literal Done-when 1 command selects zero tests).
  - **The citation gate exists:** `scripts/operations/review-pr.mjs:1289` computes `citationScope` in `reduce`
    from `read.netChangedFiles`, skipping when `read.degraded === true` or the list is absent — exactly the
    ruling's "downgrade + disclose, never drop, never refuse", including the degraded-basis carve-out.
  - **The fake-juror fixture library exists:** `scripts/operations/__tests__/review-pr.test.mjs:1880`
    (`// THE FAKE-JUROR FIXTURE LIBRARY (#x6t2z6h)`), with describe blocks at `:1982` (off-scope citation),
    `:2118` (malformed answer is `unrun`), `:2152` (cited line must be a line), `:2188` (wrong in bulk / 50
    findings), `:2248` (two seats disagree). Every bullet of Done-when 2 has a matching `it(…)`: prose where
    the findings array belongs, non-array `findings`, whitespace-only summary, zero/negative/fractional line,
    line past EOF, fifty findings untruncated, missing **and** invented disposition, summary contradicting its
    findings **in both directions**, seat disagreement.
  - **Done-when 3 (a legitimate finding still blocks) is pinned:** `:2025` (`IN_SCOPE`), `:2059`/`:2070`
    (no `citationScope` when unenforceable), `:2073-2080` (*"a juror CANNOT withhold its own finding by writing
    `citationScope` itself"* — the recompute-from-ground-truth clause).
  - **Ran it:** `npx vitest run scripts/operations/__tests__/review-pr.test.mjs -t "x6t2z6h"` →
    `Tests 25 passed | 134 skipped (159)`, 1 file passed.
- **suggested action:** resolve. (If the resolve gate insists on the card's literal Done-when 1, note that the
  filter is `-t "x6t2z6h"`, not `-t "#3351"`.)

---

### Cross-cutting notes

- **Stale `blockedBy` is the dominant rot in this batch.** #3326 and #3330 both name blockers that resolved on
  2026-08-27 (#3335, #3329). Nothing sweeps `blockedBy` when a blocker resolves, so unblocked work stays
  invisible to the readiness pass. Worth a card of its own if one doesn't exist.
- **`file:line` citation rot** hit #3339 (4 refs), #3341 (4 refs), #3350 (7 refs), #3338 (1 ref) — all inside
  two files that grew a lot (`jury-core.mjs` is 145 KB, `merge-ai-prs.mjs` 399 KB). Cards that cite by line
  into hot files decay within days; #3341 is itself the card about citing mechanisms and its own citations
  rotted.
- **Two cards were delivered but never resolved** (#3350, #3351) — both under their `bornAs` ids, both with
  the acceptance evidence sitting in the tree.
