# Staleness audit — batch 02 (6 cards)

- ALREADY-DONE: 3 (#3357, #3362, #3363)
- SUPERSEDED: 0
- STALE-INFO: 3 (#3352, #3364, #3374)
- STALE-PREMISE: 0 · DEAD-REFS (primary): 0 — stale line-refs folded into the STALE-INFO blocks
- OK: 0

All verification done read-only in `/home/user/web-everything` at `05e5f4c` (2026-09-06). Three test files
were executed to confirm the "already done" verdicts; nothing was written.

---

## #3352 — The lane lease is advisory, so one non-participating consumer disables it for everyone
- **verdict:** STALE-INFO (still real work; the card understates what has since landed)
- **confidence:** medium-high
- **evidence:**
  - Core premise still holds: nothing implements an "undeclared-but-visibly-occupied ⇒ occupied" rule keyed
    on `.git` foreign activity. `scripts/guard-lane.mjs:38` still states the opt-in limit verbatim.
  - **Stale — fix direction (1) is partly landed and the card does not say so.**
    `scripts/lib/lane-lease.mjs:66-71` (`isLaneAcquirable`, #2267) already refuses any lane whose tree is
    dirty or ahead — *regardless of lease* ("someone's work lives here — never recycle it") — and
    `chooseFreeLane` (`:77`) filters on it, so the auto-pick path never hands out an occupied-with-uncommitted-
    work lane. `scripts/lane-pool.mjs:1083-1090` (#3390) added the same guard to the previously-unguarded
    explicit `acquire --lane=N` path.
  - **Stale — Done-when 1 is substantially satisfied for the "dirty" reading of occupied.** A test asserting
    exactly the withheld direction exists: `scripts/__tests__/lane-pool-acquire-base.test.mjs:264`
    — *"WITHOUT --force, now REFUSES a dirty tracked-file conflict rather than discarding it (#3390)"*,
    expecting `would destroy that work`. The free-lane direction is pinned in
    `scripts/__tests__/lane-pool-acquirable.test.mjs:80-104` and `scripts/lib/__tests__/lane-lease.test.mjs`.
    What is genuinely still open is the *clean*-but-occupied lane (no uncommitted changes) and the
    ".git shows recent foreign activity" half of direction (1).
  - **Stale — closeout note (2026-08-27):** *"`git log origin/main -- we:scripts/lane-pool.mjs` carries nothing
    for this item (its newest commit is `0709df10`, for #3283)"*. Now false as written: the newest commits on
    that file are `4a75f13`, `8dd490a` (#3466) and `9f1a95b` (acquire retry/backoff). Still nothing for #3352.
  - Done-when 2 (#3283 workaround withdrawn / remaining sites named) is still unevidenced on the card, but the
    `/workflow` producer does now lease — `skills-src/batch-backlog-items/parallel-execute.workflow.js:405-408`
    emits `lane-pool.mjs acquire --lane=N --purpose=workflow-lane`.
  - Parent #3318 open; #3283 resolved (blocker gone, consistent with the card's own text).
- **suggested action:** edit card — (a) refresh the closeout note's commit claim, (b) record that #2267 +
  #3390 already deliver the dirty-tree half of direction (1) with tests, and narrow Done-when 1 to the
  residual (clean-but-occupied detection / foreign-`.git`-activity), (c) either name the remaining #3283
  hand-pinning sites or strike Done-when 2 as satisfied.

## #3357 — Guard that every committed pr-land invocation declares its verification posture
- **verdict:** ALREADY-DONE (delivered inside #3321's later review rounds, not under this card's own `scope:`)
- **confidence:** medium-high
- **evidence:**
  - `scripts/__tests__/lane-verify.test.mjs:453-733` now carries the guard in exactly the shape this card
    demanded. **The harvest is computed, not enumerated:** `trackedMentioningPrLand()` shells
    `git grep -lF -- pr-land.mjs` over the tracked set with exactly one pinned exclusion (`scripts/pr-land.mjs`,
    its own `--help` banner), and a case asserts *"the harvest is the TRACKED FILE SET, not a hand-written list
    of filenames"*.
  - **Done-when 1 (replay both historical misses):** the four `parallel-execute.workflow.js` invocations are
    pinned (`expect(invocations.length).toBe(4)` + the strip-the-flag wedge case proving the flag is
    load-bearing), and `buildPrLandArgs` — invisible to a command-string scan because it is an array literal —
    is pinned by its own case (*"the drain builds its argv as an ARRAY"*). Every currently-committed invocation
    passing is `expect(silentIn(harvest())).toEqual([])`.
  - **Done-when 2 (third-file mutation):** two named mutation probes run the real predicate over
    `scripts/lane-review.mjs` and `skills-src/pr/SKILL.md` — files the guard was never told about — with a
    counter-direction case proving the rule is *posture*, not "no pr-land here". The card's literal wording
    ("a file created by the test") is not met; the probes inject into real tracked source in-memory, which is
    strictly the stronger check since a file outside `git grep` could never be a candidate anyway.
  - Executed: `npx vitest run scripts/__tests__/lane-verify.test.mjs` → **60 tests passed**.
  - The card's blocking dependency has cleared: #3242 (`open-pr.mjs` cannot express the opt-out) is
    `status: resolved` (`backlog/3242-*.md`), so *"That gap must close first"* is stale.
  - Residual, and it is small: **Done-when 3** (record the flagged count) is not on the card — the test's own
    docblock records the measurement (8 harvested invocations over 213 candidate files, 7 without the `we:`
    prefix arm). And nothing was added to `scripts/check-standards-rules.mjs`, the card's `scope:` — the guard
    lives in the vitest gate instead, which does refuse rather than warn.
- **suggested action:** resolve — after pasting the recorded count (8 invocations / 213 candidate files) into
  the card and noting the guard shipped in `scripts/__tests__/lane-verify.test.mjs`, not
  `check-standards-rules.mjs`. Also strike the #3242 "must close first" line.

## #3362 — State a check's predicate and candidate set; never assert completeness
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:**
  - The gate exists and is registered: `scripts/review-corpus/gates.mjs:1046` emits
    `gate: 'unqualified-completeness-claim'`, and `:1070` registers
    `{ name: 'unqualified-completeness-claim', fn: unqualifiedCompletenessClaim, targets: 'backlog card or
    script comment' }` inside the frozen `GATES` registry (`export const GATES` at `:1060`).
  - Both directions are tested: `scripts/review-corpus/__tests__/gates.test.mjs:332-441`
    (`describe('unqualifiedCompletenessClaim — #3362')`) covers a card body, a script docblock
    (`scripts/lib/lane-verify.mjs` path arm), the exemptions, and a passing/qualified claim; `:505` re-fires it
    in the registry roll-up. Executed: `npx vitest run scripts/review-corpus/__tests__/gates.test.mjs` →
    **63 tests passed**.
  - Done-when 2 (record the count) is already written into the card body (12 findings over `backlog/`, 10 over
    `scripts/`, all twelve hand-adjudicated 6 true / 1 arguable / 5 false).
  - Caveat to state on resolve: the gate has **no production caller** — that is #3364's job, not this card's
    (this card's Done-when only asks that the gate exist and flag/pass both directions).
  - Note the recorded counts were taken over 3339 backlog files; the board is now 3475, so a re-run would give
    a different number. Does not affect the verdict.
- **suggested action:** resolve.

## #3363 — Record the reviewer's identity per round, so churn can be told from version drift
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:**
  - `scripts/review-corpus/mine-review-corpus.mjs` exports `IDENTITY_FIELDS` (`:268`),
    `parseReviewerIdentity`, `sameReviewer` (`:404-410`), `summariseIdentity`, plus
    `IDENTITY_NEVER_EMITTED` / `IDENTITY_NOTE` / `IDENTITY_REQUIRED_FOR_SAMENESS`; every mined case is built
    with `reviewerIdentity: parseReviewerIdentity(body)` (`:499`, `:612`, `:703`) and the docblock at `:65`
    records *"every case carries `reviewerIdentity`, and `index.json` carries the roll-up"*.
  - The mined corpus on disk carries the field: e.g. `scripts/review-corpus/cases/1506-r1.json`,
    `1559-r1.json`, `1559-r2.json`.
  - Done-when 1's **both directions** are tested in a dedicated file,
    `scripts/review-corpus/__tests__/mine-review-corpus.identity.test.mjs`, whose header states the second
    direction explicitly ("a round whose identity is not recorded is reported `unknown` — never `same`, never
    `different`") and which additionally greps every committed fixture body to keep the "the model id is
    genuinely not in the input" caveat honest. Executed → **16 tests passed**.
- **suggested action:** resolve.

## #3364 — The card gates run nowhere — no caller outside the scoring harness
- **verdict:** STALE-INFO (the decision's central fact re-verified as still true)
- **confidence:** high
- **evidence:**
  - **Premise re-verified, still true.** The only importers of the gate library today are
    `scripts/review-corpus/replay-gates.mjs:51` (`import { GATES, runGates } from './gates.mjs'`),
    `scripts/review-corpus/__tests__/gates.test.mjs:16-17`, and `scripts/review-corpus/stability.mjs:286`
    (transitively, `await import('./replay-gates.mjs')`). `scripts/check-standards.mjs` references only its own
    `CITATION_GATES_ENFORCED` cluster (`:92`, `:1249-1252`), never the library. No production caller.
  - **Stale line citation:** the card cites the frozen registry as `we:scripts/review-corpus/gates.mjs:715`;
    `export const GATES = Object.freeze([` is now at **`:1060`** (the file has grown by the very gates the card
    lists). The other three cited `path:line`s still resolve exactly.
  - **Stale statuses in the "five items" table:** #3340, #3346 and #3319 are now `resolved`, and #3362's gate
    has since landed and is tested (see above); only #3341 and #3362 remain `open`. The table's *conclusion*
    (five detectors in a file nothing calls) is unchanged — all of those gates are still callerless — but the
    open/closed framing has moved.
  - **Counts pinned to a sha, now drifted:** the sweep is labelled *"at `6b03a7bd` — 4046 files (backlog 3339…)"*.
    `backlog/` now holds **3475** cards, so every fire-rate row would re-measure differently. The card already
    demands re-measurement at landing, so this is a note, not a defect.
  - `relatedReport: reports/2026-08-27-card-gate-deployment.md` exists. No children carry `parent: "3364"` yet —
    consistent with an unratified decision.
- **suggested action:** edit card — correct `gates.mjs:715` → `:1060`, refresh the five-items table's statuses,
  and stamp the sweep counts as "measured at `6b03a7bd`; the board is now 3475 cards". Then leave open for
  ratification.

## #3374 — Calibrate the finding consequence scale — one axis or two, asserted or derived, what anchors it
- **verdict:** STALE-INFO (prepared, unratified; body is unusually accurate, two measurements have drifted)
- **confidence:** high
- **evidence:**
  - **Every `jury-core.mjs` citation in the grounding table still resolves to the exact line:** `DISPOSITIONS`
    `:284`, `deriveFindingDisposition` `:318`, `IMPACT_LEVELS` `:197`, `IMPACT_GLOSS` `:210`,
    `IMPACT_STRICTNESS` `:225`, `PREVENTION_IMPACT_BAR` `:264`, `blocksAcceptance` `:971`,
    `derivePanelVerdict` `:1353`, the mandate quotes at `:2021` and `:2028`. `deriveFindingImpact` still does
    not exist. `severity` still appears only 3 times in `jury-core.mjs` (`:184` docblock, `:632`, `:2028`
    prose), and `review-render.mjs:120` still carries the false *"severity/category"* docblock the card wants
    reworded. The scope note holds: `buildReport.mjs:40-42` still requires `severity`,
    `conformanceReport.mjs:44` and `visual-comparator.mjs:59` still type one.
  - **Stale citation:** *"the rendered `_[impact if unfixed: <level>]_` marker
    (`we:scripts/review-corpus/mine-review-corpus.mjs:272`)"* — that parse is now at **`:529`**
    (`rest.match(/\[impact if unfixed: ([a-z-]+)\]/)`); `:272` is now inside the #3363 identity-field block.
  - **Stale counts (the "42 recorded labels" population).** The card says *"`cases/` holds 92 replayable
    cases … findings total: 42 · broken 11 · degraded 19 · cosmetic 12 · unrecoverable 0"*. Re-measured today:
    **93 case files, 49 labelled findings — broken 13 · degraded 24 · cosmetic 12 · unrecoverable 0.** The
    load-bearing fact (`unrecoverable` has never fired) is **still true**, but "0 of 42" is now 0 of 49, and
    Fork 5's re-open trigger ("once Fork 2's shadow record holds 42 or more findings") is stated against a
    population size that has moved.
  - `relatedReport: reports/2026-08-27-calibrated-finding-severity-and-disposition.md` exists; the research
    topic is registered (`src/_data/researchTopics/review-finding-severity-classification.json` +
    `src/_includes/research-descriptions/review-finding-severity-classification.njk`) — note the card links it
    as `/research/…`, which is the site URL, not a repo path.
  - Edge set intact: `backlog/3338-*.md` frontmatter carries `blockedBy: ["3374"]`. `relatedTo` refs resolve
    (#3310, #3314, #2942 resolved; #3338, #3339, #3363, #3315 open; #2950 active).
- **suggested action:** edit card — fix `mine-review-corpus.mjs:272` → `:529`, and re-stamp the label
  population as "42 at `6b03a7bd`; 49 as of 2026-09-06, `unrecoverable` still 0" (and re-express Fork 5's
  re-open trigger against the current n). Then leave open for ratification.
