# Batch 09 — staleness audit (10 open cards)

- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 7 (#1770, #2911, #2982, #3019, #3049, #3108, #3276)
- STALE-PREMISE: 0
- DEAD-REFS: 1 as a co-verdict (#1770 `scope:` entry); OK: 2 (#3098, #3103)

**Caveat on git evidence:** `/home/user/web-everything` is a **shallow clone** (`.git/shallow` present,
`git rev-parse --is-shallow-repository` → true). Any claim resting on a historical commit could not be
checked; those are flagged as *unconfirmable*, never as defects.

---

## #1770 — Audit the end-state constellation placement once all relocations land
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** The load-bearing measurements **re-verify exactly**, so the card's substance is intact:
  `we:plugs/` still absent (so `validatePlugWeFuiDrift`'s `existsSync(join(ROOT,'plugs'))` yields
  `domains = []` — gate still vacuous, `we:scripts/check-standards.mjs:1744-1752`);
  `we:scripts/gen-wrapper/genWrapper.mjs` = **228** lines vs `fui:tools/gen-wrapper/genWrapper.mjs` =
  **417**, whole-directory **437 vs 1270** — both figures match the card to the line;
  `we:blocks/renderers/module-service/moduleService.ts` does **not** exist (the dir survives with only
  `servePathIR.ts`, `servePathOpenAPI.ts`, `maas-servepath.openapi.json`, `conformance/`), so the §9c arm
  is still silently dead. All three blockers are still open (#1294, #1245, #872).
  Stale statements:
  1. **DEAD-REF in `scope:`** — `we:scripts/__tests__/check-standards-rules.test.mjs` does not exist. It
     was split into six files: `check-standards-rules-{backlog-integrity,conformance-gates,content-lint,
     githook-flags,lock-point-and-exports,registry-validators}.test.mjs`.
  2. `we:scripts/check-standards-rules.mjs:1857` (`validatePlugWeFuiDrift` + `PLUG_SHARED_CORE_FILES`) →
     now `:1984` (header) / `:2003` / `:2009`.
  3. "wired at `we:scripts/check-standards.mjs:1586` §8f" → §8f is now at `:1737`.
  4. "`classifySurfacePaths` (`we:scripts/check-standards-rules.mjs:2095`)" → now `:2241`.
  5. "`we:scripts/check-standards.mjs:1787` reads a MaaS module" → §9c is now `:1906`, the
     `moduleService.ts` read at `:1938`.
  6. "**6,980** tracked paths" → `git ls-files | wc -l` = **7,713**. The derived "774 hard errors /
     712 site / 1,114 standard / 124 impl / 4,256 neutral" split is therefore measured against a
     tree that has grown ~10%.
  7. **The #1784 premise moved.** The card says three times that the anchor "assigns the non-engine
     subsystems to the **deferred** decision #1784… #1784 remains free to rule they stay" (`:63`,
     `:229-230`, `:349-350`). **#1784 is `status: resolved` (dateResolved 2026-06-26)** — resolved
     *before* this card's `preparedDate: "2026-08-17"`. Note the stale claim is inherited from
     `we:docs/agent/platform-decisions.md:176`, which still calls it "the deferred conformance-model
     decision #1784", so the doc needs the same correction. Whether the seeded debt list may still name
     #1784 as owner has to be re-decided against #1784's actual resolution.
- **suggested action:** edit card — fix the `scope:` test-file entry (six-way split), refresh the five
  line refs and the tracked-path count, and re-check the #1784 ownership claim (and the
  platform-decisions.md:176 anchor it copies) before this is built.

## #2911 — Gate Workflow harness launchability in check:standards
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Work is genuinely still owed — `we:scripts/lib/workflow-meta.mjs` and
  `we:scripts/__tests__/workflow-meta-launchable.test.mjs` do not exist, and `grep -rn
  "checkWorkflowMeta\|WORKFLOW_HARNESS_ROOTS"` over `scripts/` returns nothing. The three named harnesses
  all still exist and all three `export const meta` blocks are still pure literals (no concatenation),
  exactly as the card says. "No prettier/eslint config in this repo" still holds (no `.eslintrc*`,
  `eslint.config*`, `.prettierrc*`, `prettier.config*`). Stale statements:
  1. "Rule **16** is a positional slot… **`main`'s last rule is 15 today**" → `main` now carries **19**
     numbered rules (`we:scripts/check-standards.mjs:2407` is `── 19. Unfenced mandate params`). The next
     free slot is **20**, and the "zero-sweep error string hardcodes `check:standards rule 16`" guidance
     must be re-read against that.
  2. "the current roots walk **9 files** to reach 3" → `find scripts/workflows skills-src -name '*.mjs'
     -o -name '*.js'` now returns **14** files (the extra ones are `skills-src/{inspect-agent-health,
     closing-session,conveyor,jury,batch-backlog-items}/*.mjs` + their `__tests__`). The narrowing
     argument gets *stronger*, but the number is wrong.
  3. **Unconfirmable (shallow clone):** the whole "Recover — the exact commands" section rests on commit
     `0433216c` being an ancestor of `main` and merge `75a43975` existing. Neither object is present in
     this clone (`git cat-file -t` → "Not a valid object name"). Whoever picks this up must confirm
     `0433216c` is still reachable in a full clone **before** planning the recovery — if it has been
     gc'd the item is a rebuild, not a recovery, and its `size: 2` is wrong.
- **suggested action:** edit card — update rule number 15→19 (next free 20), file count 9→14, and add a
  "verify `0433216c` is still reachable first" precondition.

## #2982 — How a folded-duplicate backlog item retires
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The decision is genuinely unruled and unbuilt. A frontmatter census over all 3,475 cards
  shows **no `foldedInto`, no `dateFolded`, and no `status: folded`**; `grep -rn "foldedInto|dateFolded"`
  over `scripts/ src/ docs/ skills-src/` hits only the research page
  `we:src/_includes/research-descriptions/folded-duplicate-backlog-retirement.njk:145`. The merit
  arguments re-verify: `we:src/_data/burndown.js:32` is still verbatim
  `done: it.status === 'resolved' && it.dateResolved ? …`; `parkedReasonMeta` still holds only
  `platform-gated` + `maturityGated` (`we:src/_data/backlogMeta.js`); `supersededBy` is still
  topic-scoped. `we:reports/2026-08-17-2982-folded-duplicate-retirement.md` exists. Stale statements —
  **all citation line-number drift, content intact at the new lines**:
  - `we:src/_data/backlogMeta.js:23-34` → `parkedReasonMeta` now around `:33-36`.
  - `we:scripts/check-standards-rules.mjs:207-214` (parked-with-no-reason hard error) → now `:280-289`;
    `:207-214` is now the `graduatedTo` canonical-form block.
  - `we:scripts/check-standards-rules.mjs:229-230` (`crossRef` validated) → now `:316-317`.
  - `we:scripts/check-standards.mjs:130`, `:263-286`, `:385-417` (`supersededBy`) → the topic-pointer
    checks are now at `:280-300`.
  - `we:docs/agent/backlog-workflow.md:935` (*Executing a consolidation*) → `:1006`; `:947`
    (NNN-immutable) → `:1018`; `:971` (*Review before adding (dedup)*) → `:1042`; `:973`
    (*Never renumber*) → `:1044`.
  - `we:skills-src/consolidate-backlog-items/SKILL.md:58` → the quoted "never renumbers, deletes, or
    resolves a member" line is now `:60`.
  - Minor: **#2983 is now `resolved`** — the card reads as if `/consolidate` is prospective; the skill
    ships at `we:skills-src/consolidate-backlog-items/`.
- **suggested action:** edit card — refresh the nine line refs (the prose claims all still hold) and note
  #2983 has landed. Then it is ready to ratify as-is.

## #3019 — Harvest synthesizes a cluster into a cause-story, not an elected representative
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** Core premise holds: #2978's Fork 2 is `RATIFIED with a widened scope`
  ("a diagnostic signal first, a ranking key second") and #2978 is `resolved`; the representative pick is
  still longest-summary (`we:scripts/conveyor/learnings-dedup.mjs:88-90`,
  `rep = c.members.reduce((best,m) => String(m.summary).length > String(best.summary).length ? m : best)`);
  the floor is still there (`we:scripts/conveyor/learnings-harvest.mjs:157`,
  `candidates = ranked.filter((c) => c.sessions >= minSessions)`). Stale statements:
  1. **"Today a cluster emits one representative" is now only half true.** The cluster shape at
     `learnings-dedup.mjs:97-114` already emits `summaries: c.members.map(m => m.summary)`,
     `suggestions: [...new Set(...)]` and `sessions: [...]` for **every** member, plus a `proposedFixes`
     array for blocking members — and `we:skills-src/harvest-learnings/SKILL.md:46-47` documents it
     ("a member's own suggestion is never dropped in favour of the representative's"). So the
     "carry every member" half of the ask is largely delivered; what remains is the **synthesis** into a
     cause-story (nothing in the skill or the scripts mentions cause synthesis — `grep -n
     "cause\|synthes"` over the SKILL returns nothing).
  2. **"filters low-count clusters out of the candidate list entirely" overstates it now.**
     `harvest()` reports `belowFloor: ranked.length - candidates.length` in `stats`, and its own docblock
     says the one-offs are "left in the pool for the next run (they are NOT discarded)". The default is
     `minSessions = 1`.
  3. **A hidden prerequisite the card assumes exists.** "Carry every member **with its quoted turn**" is
     not buildable today: `we:scripts/conveyor/learnings-drop.mjs:65`
     `ALLOWED_KEYS = ['kind','summary','area','suggestion', …OPTIONAL_HICCUP_KEYS]` — there is **no
     quote or transcript-pointer field**, so #2978 Fork 1(a)'s "the note carries the quoted turn plus a
     pointer to the transcript" ruling is itself unbuilt. This card silently depends on it.
- **suggested action:** edit card — narrow the ask to cause-synthesis + the floor (the member-carrying is
  mostly done), and either add a `blockedBy`/prerequisite for the quoted-turn drop-schema field or file
  it as a sibling.

## #3049 — The conveyor as a shippable product, not machinery
- **verdict:** STALE-INFO (low severity — the argument stands)
- **confidence:** high
- **evidence:** Almost every measured claim **re-verifies**: `conformance-vectors/*.vectors.ts` = **16**
  files, `conformanceSuites` array = **14** entries, `src/_data/protocols/*.json` = **42**,
  `contracts/package.json` exports = **35**, `contract.ts`/`*-contract.ts` = **39**,
  `wrapper-conformance/vectors.ts` = **2** vectors, `WrapperSubject` still has **no** non-test
  implementation in WE (only the `runner.ts` interface + the `__tests__` double), blocks **81** / plugs
  **60** / intents **100** / capabilities **21**. Every path in the classifier table still exists.
  `we:scripts/lib/output-mix-paths.json` still has exactly three classes (`product` / `machinery` /
  `other`) — no third "product-in-disguise" class, so the open question is genuinely open. #3010 is
  still `open`. Stale statements:
  1. "the operation-declaration engine (**#3001, open, prepared**)" → **#3001 is `resolved`**.
  2. "**3021** backlog items at 73a3925b" → **3,475** cards today (the other `check:standards` counts in
     the same sentence are all still exact).
  3. "the conveyor board UI itself is not in this repo. **#2586 and #2660** both scope it to
     `plateau-app:src/backlog-view/`" → **both are now `resolved`**, and the surface exists
     (`/home/user/plateau-app/src/backlog-view/` holds `conveyor.ts`, `backlog-view.ts`, `composer.ts`,
     `card-state-read-model.ts`, …). The card's point — that the product surface is invisible to a
     WE-only metric — is now an observed fact rather than a forecast, which strengthens it.
  4. Unconfirmable (shallow clone): the `73a3925b` anchor, PRs #1126/#1128.
- **suggested action:** edit card — update #3001's status, the item count, and re-state the #2586/#2660
  point in the past tense (it got stronger). No change to the forks.

## #3098 — Flag a scope that omits its own consumers
- **verdict:** OK
- **confidence:** high
- **evidence:** Everything the card asserts still holds. No consumers-check script exists anywhere under
  `scripts/` or `scripts/readiness/` (the stand-down deletion stuck). `we:scripts/check-readiness.mjs`
  is alive on `main`. `we:scripts/lane-pool.mjs` exists and has **zero ES importers** — the only
  `from '…lane-pool…'` hits in the tree are for the *different* module `lib/lane-pool-paths.mjs`
  (`heavy-admission.mjs:61`, `verify-lane.mjs:48`, `lane-stack.mjs`, `pr-status.mjs:139`,
  `lane-pool.mjs:77` itself) — while 123 files mention `lane-pool`, i.e. the subprocess graph the card
  describes. The deliberate absence of `scope:` is correct (frontmatter carries none). The standing
  hand-discipline it points at is live: `we:agent-memory-src/story-preparation-checklist.md:13` item 1
  ("`scope:` including CONSUMERS… Find them two ways: ES importers, AND…").
- **suggested action:** none

## #3099 — Story preparation: a card must carry what its delivery needs
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** The "what already exists — do not rebuild it" section re-verifies in full:
  `we:scripts/check-readiness.mjs` and `we:scripts/readiness/` exist; `dispatchPlan` is at
  `we:scripts/readiness/dispatch-plan.mjs`; `normScope` (`:68`) and `coversFile` (`:143`) are at
  `we:scripts/readiness/scope-lease.mjs`; the lock-point warning constants
  (`LOCK_POINT_CODE_LINES_THRESHOLD`, `LOCK_POINT_COLLISIONS_THRESHOLD`) are in
  `we:scripts/check-standards-rules.mjs`. The retraction and the struck slice 2 are intact and honest.
  Stale statement:
  - Slice 5 says "**Depends on [#3037]**" — **#3037 is `resolved`**, so that dependency has cleared and
    slice 5 is no longer gated on it. (Slice 4's [#3029] is still `open`, correctly.)
  - Evidence-row statuses have moved but do not affect the argument: #3090 / #3091 / #3084 resolved,
    #3071 still open.
- **suggested action:** edit card — mark slice 5's #3037 dependency as cleared; the re-ranking the epic
  asks its next owner to do is still owed.

## #3103 — Preparation carries a risk assessment: a typed risk enum
- **verdict:** OK
- **confidence:** high
- **evidence:** Unbuilt and accurate. `we:scripts/readiness/risk-assessment.mjs` and its test do not
  exist (correct — they are the deliverable); `grep -rn "risk-assessment\|riskAssessment"` over the repo
  returns nothing, and no closed risk enum exists anywhere (the only `blast-radius` hits are the
  unrelated review-care signal in `lane-drain.mjs:148` / `review-core-cli.mjs:40` /
  `readiness/test-selection.mjs:94`). `we:docs/agent/backlog-workflow.md` (its one existing scope entry)
  is present. The checklist items it cites are real: item **8** ("De-risk the risky part DURING
  preparation") and item **9** ("A prepared card is NOT trustworthy until the preparation itself has
  been independently reviewed") are both in
  `we:agent-memory-src/story-preparation-checklist.md`, and item 9 cross-references this card's enum by
  name. The `#2607` governance ref resolves (`status: resolved`, deterministic-core/thin-judgment).
- **suggested action:** none

## #3108 — Story preparation gets its own staleness signature: `preparedAgainstSha`
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The gap is real and unbuilt: `we:scripts/readiness/prep-staleness.mjs` does not exist, and
  a frontmatter census of all 3,475 cards finds **zero** `preparedAgainstSha` (the only textual hit is
  this card itself) — so design point 4's "no retroactive migration" is still trivially satisfiable. The
  checklist still has **nine** items and no stamp step. `check:health`'s **G4** gate exists
  (`we:scripts/audit-backlog-health.mjs:30`, `:124`). `we:scripts/backlog/frontmatter.mjs` exports both
  `readField` (`:37`) and `setFrontmatterField` (`:57`) as described, and
  `we:scripts/check-readiness.mjs:35` is still exactly the `require(join(ROOT,'src/_data/backlog.js'))`
  single-loader line the card cites. Stale statements:
  1. "`we:scripts/backlog.mjs`'s `prepareStamp()` (**:448-459**)" — repeated twice, incl. inside the
     interface block ("currently :448-459") → `prepareStamp()` is now at
     **`we:scripts/backlog.mjs:570`**.
  2. "`we:docs/agent/backlog-workflow.md` (**lines 317-432**) documents a rich, already-live staleness
     discipline" → that material now runs roughly **:419-:536** (the #1935 stale-prep rule is at `:420`,
     the `prepare-stamp` instruction at `:530`).
  3. "**13** story-kind cards carry `preparedDate` in frontmatter today" → now **29** story-kind (plus
     4 epic and 2 task = 35 non-decision, out of 460 stamped cards total). The card's design point 1
     ("the field is already shared") gets stronger; the number is wrong.
- **suggested action:** edit card — fix the two `prepareStamp()` line refs, the backlog-workflow.md line
  range, and 13→29. Design is otherwise still sound and buildable.

## #3276 — A preparation's review must be machine-readable state, not prose in the body
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** The gap is confirmed real: a frontmatter census over all 3,475 cards finds **no**
  `reviewed`/`prepReviewed`/`confidence` field of any spelling — the only prep-related field is
  `preparedDate` (460 cards), so "preparedDate exists and has no reviewed counterpart" holds, and no
  gate could read a preparation-review today. `grep -rn "preparedReviewed|prepReviewed|prepReview"` over
  `scripts/` and `src/` returns nothing. Stale/weak statements:
  1. "an audit of **433 stamped cards**" → **460** cards now carry `preparedDate`. The "found 18" prose
     fuzzy-match figure could not be reproduced (the audit script is not in the tree) — cite the query
     or re-run it.
  2. **Card quality, not staleness, but blocking:** the `## Done when` is a literal placeholder —
     "1. **Executable** — TODO: a command that fails before this item lands and passes after." There is
     no `scope:`, no interfaces, and no design. At `size: 5` under an epic whose own governing rule is
     #3103/#2607 ("script decides PRESENCE, not SEVERITY"), this is `unshaped-no-scope` and is not
     dispatchable as written.
- **suggested action:** edit card — refresh 433→460 (or re-derive both numbers), and prepare it
  (scope + interfaces + a real `## Done when`) before it can be claimed.

---

### OK cards
- #3098 OK
- #3103 OK
