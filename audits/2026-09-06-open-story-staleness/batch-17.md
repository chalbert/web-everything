# Batch 17 — staleness audit (31 open backlog cards)

- **ALREADY-DONE:** 5 (#1836, #2305, #3189, #3206, #3207)
- **SUPERSEDED:** 0 (2 partials reported inside STALE-INFO: #3254 by #2956, #3349 by #3441/#3473)
- **STALE-INFO:** 17 (#640, #1073, #1083, #1258, #1522, #1852, #2869, #2883, #2896, #2931, #2960, #3221, #3232, #3254, #3333, #3349, #3355)
- **STALE-PREMISE:** 2 (#285, #3024) · **DEAD-REFS (primary):** 1 (#2902); also carried on #1522, #1852, #2224, #285, #2883
- **OK:** 6 (#232, #2224*, #2457, #2987, #3272, #3290) — *#2224 carries a mis-referenced `#96`. Total 31.

---

## #285 — Clean up maas-consumer-demo importmap to package-exports resolution
- **verdict:** STALE-PREMISE (+ DEAD-REFS)
- **confidence:** high (on the dead path), medium (on "moot")
- **evidence:** The card's entire subject — `we:demos/maas-consumer-demo.html` — **does not exist**.
  `find . -name "*maas-consumer*"` returns only the card itself; `demos/` has 104 files, none MaaS.
  No demo in `demos/` contains an `<script type="importmap">` at all, and no file under `demos/` or
  `src/` references `@frontierui/jsx-runtime`. The only surviving mention is a comment in
  `scripts/check-standards.mjs:1879`. Blocker refs also drifted: frontmatter says `blockedBy: ["554"]`
  while the body's last progress note says it was repointed to `["451"]` — and **#451 is now resolved**
  (as are #087, #461, #274, #265, #239). #554 is open (parked Phase-2 suite).
- **suggested action:** resolve or park as moot — the demo it cleans up was deleted. If the demo is
  meant to come back, the card must be re-scoped to whatever replaced it.

## #232 — Deferred `<component>` compiler strategy opt-ins (umbrella)
- **verdict:** OK
- **evidence:** #125/#127/#231/#150/#227/#2091 resolved; #1628 resolved, #1629 parked, #1630 resolved —
  exactly as the body states. Both shipped files exist
  (`frontierui/compiler/src/component-transform/surfaces.ts`, `…/ts-transformer.ts`), and
  `we:reports/2026-07-01-component-compiler-deferred-optins-standing-test.md` exists. Epic correctly
  stays open for the uncarved arbitrary-string-scanning residual.
- **suggested action:** none

## #640 — Repoint plateau-app to @frontierui/plugs and migrate off plugged bootstrap
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - `blockedBy: ["2382"]` — **#2382 is resolved**. Every blocker the card ever named (#170, #1545,
    #2346, #2381, #2382) is now resolved. The card is unblocked and nothing says so.
  - Opening paragraph still asserts *"plateau-app currently aliases @we/plugs (vite.config.mts:119) and
    imports the plugged @we/plugs/bootstrap (plateau:src/main.ts:9)"*. False since #1046: the alias is
    `@frontierui/plugs` (vite.config.mts:1096) and the import is `@frontierui/plugs/bootstrap` at
    `plateau:src/main.ts:10`. The body's own Discovery section already flags this but the header prose
    was never fixed.
  - The migration itself is genuinely still undone (main.ts imports the *plugged* bootstrap;
    `plateau:src/runtime.ts` does not exist; `frontierui/plugs/bootstrapUnplugged.ts` does).
- **suggested action:** edit card — clear `blockedBy`, rewrite the opening paragraph to the post-#1046
  truth, then it is build-ready.

## #1073 — On-device small-VLM vision tier (Tier 2) umbrella
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Body ends *"Epic to be SLICED into batchable build pieces (model pick/eval → provider →
  benchmark → dev-browser surface)"*. It **was** sliced: six children exist (#1080, #1081, #1082, #1084,
  #1142 all resolved; only #1083 open). Also cites #490 as the Tier-1 classifier — #490 is still open,
  fine. `we:scripts/design-refs/providers/transformers-vlm.mjs`, `we:demos/tier2-vlm-demo.html`,
  `we:docs/agent/vision-tiers.md` all exist.
- **suggested action:** edit card (drop the "to be sliced" instruction; note the only open child is
  #1083, itself blocked on the dev-browser shell).

## #1083 — Dev-browser opt-in surface for the Tier-2 vision tier
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The whole "Status: blocked, not build-ready (prep finding, 2026-08-15)" section is out
  of date:
  - *"`plateau:packages/dev-browser/src/` has no `shell/` directory at all (checked directly,
    2026-08-15)"* — **it does now**: `shell/{main.ts, ipc.ts, layout.ts, probe-preload.ts,
    chrome/…}` plus tests.
  - *"[#1753] … Its own card still carries `status: open`"* — #1753 is now `status: active`
    (dateStarted 2026-08-16).
  - #1391 and S2–S5 (#1754–#1757) are still open, so the `blockedBy: ["1391"]` edge itself still holds;
    only the evidence under it is stale.
- **suggested action:** edit card — re-verify the shell state and rewrite the 2026-08-15 prep finding.

## #1258 — Framework-churn watch (standing program)
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:**
  - *"The open directive proposals (#1976/#1977/#1978)…"* — **all three are resolved**.
  - Header block says *"L0/candidate — filed now to record the watch"* and the Status section repeats
    "L0 / candidate", but the review log records a first run that moved it L0→L1 and a second run.
  - Every child/related item cited is resolved (#463, #974, #977, #978, #979, #507, #1271–#1273, #1269,
    #1249); only #1257 (the keystone it defers to) is still open.
  - Last run 2026-07-01; the stated "Next run" (front-B vendor sweep incl. Qwik/Solid-2.0) is >2 months
    overdue.
- **suggested action:** edit card (fix the L0 claim + the "open proposals" sentence) and/or run
  `/review-program 1258`.

## #1522 — Explorer CLI autonomy (standing program)
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:**
  - DEAD-REF: `plateau-app:tools/explorer/plateau-audit.ts` (the "bespoke harness" the whole grounding
    section rests on) **does not exist**.
  - *"The CLI surface is just `<url> --site --gate --max-states --max-depth --json`"* — false;
    `plateau-app/tools/explorer/cli.ts:142` prints
    `[--site] [--discover] [--max-routes N] [--gate] [--auth recipe.json] [--rtl] [--out dir] …`.
  - The five "captured gaps" (#1523, #1524, #1525, #1526, #1530) and all eight 2026-07-01 residuals
    (#2039–#2046) plus #1547/#1550/#1552/#2047 are **resolved** — the stated coverage "20/30" is stale
    (only #1805, parked, remains).
  - The review-log "Next run: build the issue-class residuals" is done; last run 2026-07-01.
  - `childlessReason: program` means it never resolves — correctly.
- **suggested action:** run `/review-program 1522`; edit the grounding section to drop the dead harness
  path and re-measure the goal-set.

## #1836 — Make every plug public API functional unplugged (umbrella)
- **verdict:** ALREADY-DONE (epic ready to resolve) + STALE-INFO
- **confidence:** medium-high
- **evidence:**
  - **Every child is resolved**: W1–W7 (#1840, #1842, #1844, #1841, #1843, #1846, #1845), all three
    carved decisions (#1837, #1838, #1839), and every fix card #1840 spawned (#1856–#1860).
  - Acceptance verified in the tree: `PLUG_UNPLUGGED_TEST_ENFORCED = true` and pushed to `errors`
    (`we:scripts/check-standards-rules.mjs:1791,1806`, contract entry `plugUnpluggedTest.value: true`);
    the doc-site parity page exists (`we:src/plugs-parity.njk`, data at `we:src/_data/plugs/`).
  - Stale statements: *"only webbehaviors has dual-mode coverage, so most public plug APIs likely do not
    actually work"* was refuted by #1840's re-audit (every domain has an unplugged test; #635 declared
    obsolete). And *"This is an **unsliced** epic — `/slice` it"* contradicts the very next heading
    ("Workstreams (sliced — carved 2026-06-27)").
- **suggested action:** resolve (via the epic no-open-slice gate); if anything is judged outstanding,
  say what — otherwise this is a burndown ghost.

## #1852 — WE consistency watch (standing program)
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** medium
- **evidence:**
  - DEAD-REF: the rule label `#reusable-home` has **no anchor** in
    `we:docs/agent/platform-decisions.md`; the live anchor is `{#reusable-neutral-home}` (line 2383).
    (The other eight anchors it cites all resolve.)
  - Cadence claim *"Front B runs **monthly**"* — last front-B run was 2026-06-27, i.e. ~2.3 months ago;
    the stated "Next run" (authoring/derivation slice) never happened.
  - Deferral targets still hold: #1770 open, #1853 parked; both audit/report files exist.
- **suggested action:** run `/review-program 1852`; fix the `#reusable-home` anchor to
  `#reusable-neutral-home`.

## #2224 — Side-by-side design-compare tool — scope + shape
- **verdict:** OK (with a mis-referenced item)
- **confidence:** medium
- **evidence:** Still an unratified `kind: decision` with a recommended verdict, prepared 2026-07-04; no
  compare surface exists in plateau-app or frontierui (grep for `design-compare`/reveal-slider: 0 hits),
  so the go/not-yet call is genuinely still owed. Report exists.
  - **Mis-ref:** *"candidate FUI component, impl in FrontierUI per #96"* — `backlog/096-*.md` is
    "NL to Technical Configurator" (resolved), which is not about component placement. The intended
    ruling is probably `#constellation-placement`/#606; the `#96` citation does not support the claim.
  - Minor drift: #141 is now resolved and #1649 is `parked`, so the "un-gate trigger … filed under
    #1649" points at a parked home; #142 is still open.
- **suggested action:** edit card (fix or drop the `#96` citation; note #1649 is parked), then ratify.

## #2305 — Lane-isolation guard exists only in web-everything
- **verdict:** ALREADY-DONE (all three Done-when boxes checked) — residual owed
- **confidence:** medium
- **evidence:** All three acceptance boxes are `[x]` in the card, and the artefacts exist:
  `we:scripts/guard-lane-install.mjs` (print/status/install/uninstall, repair-not-append),
  `we:scripts/guard-lane.mjs` with the `workspaceRootOf` symlink note, and
  `we:scripts/__tests__/guard-lane.test.mjs`. Card states "**Status: installed.**". #3074 and #2123 are
  resolved.
  The only thing keeping it open is the self-declared **"Still owed: gating *is it installed* in
  `check:standards`"**, deliberately deferred — and no separate card exists for it (only #2997 and
  #3198 mention `guard-lane-install`, neither owns this).
- **suggested action:** resolve, and file the "gate installedness in check:standards" residual as its
  own item (it needs its own decision re CI). Otherwise edit the card to scope it to that residual only.

## #2457 — Resolve a couple's cross-repo symbol MECHANICALLY
- **verdict:** OK
- **confidence:** high
- **evidence:** Not implemented (no cross-repo symbol-resolution filter anywhere in `we:scripts/`), and
  the machinery it names is present and correct: `CONSTELLATION_REPO_NAMES`
  (`we:scripts/merge-ai-prs.mjs:2200`), `siblingCloneName` (`:2268`), `resolveNetDiffBasis`. All related
  items (#2285, #2287, #2263, #2449, #2439, #2336, #2450) are resolved; scope paths all exist.
- **suggested action:** none

## #2869 — Single-source the verifyGateDecision table
- **verdict:** STALE-INFO (low)
- **confidence:** medium
- **evidence:** Still valid work — `VERIFY_GATE_TABLE` does not exist, and **two of the four stale sites
  are verbatim still there**: `we:scripts/lib/lane-verify.mjs`'s `DEFAULT_VERIFY_TTL_MINUTES` docblock
  (*"the gate refuses regardless of age"*, ~:214-216) and `we:scripts/pr-land.mjs:740` (*"A `running`
  marker for THIS HEAD is ALWAYS refused"*). What is stale: the `verifyGateDecision` docblock has since
  been rewritten (`:280-286`) to state the TTL degrade correctly, and **#3321 flipped `requireVerified`
  to the default**, which changes the table the card enumerates (`requireVerified` is now the normal
  path; `--no-require-verified` is the opt-out taken by `lane-drain.mjs` and the parallel workflow). The
  card's DoD wording predates that flip.
- **suggested action:** edit card — drop the already-fixed site from the list of four, and restate the
  DoD against the post-#3321 default.

## #2883 — A stale acceptance must stay non-waivable after the accepted label is stripped
- **verdict:** STALE-INFO (self-declared) + DEAD-REFS (line anchors)
- **confidence:** high
- **evidence:** The card already carries a 2026-08-12 block saying its mechanism is false; that is
  correct and the surviving hole is real — `hasUnclearedReviewLabel`
  (`we:scripts/lib/review-escalation.mjs:1603-1635`) refuses `accepted + pending` by default but
  `allowPending: true` (the `--no-review-escalation` valve) **still waives it**, checked deliberately
  before the accept short-circuit.
  All three line anchors in that block are now dead:
  - `merge-ai-prs.mjs#L2976` (`stripReadyOnPark`) → the function is at **:3750**; L2976 is an
    `--only-repo` flag parse.
  - `review-set-label.mjs#L242` → an unrelated object literal.
  - `gate-invariants.test.mjs#L612` → an unrelated fixture line.
  Also: the top-of-card "Definition of done"/four bullets are explicitly marked superseded but still sit
  above the correction, so a skimmer reads the wrong contract first.
- **suggested action:** edit card — delete the superseded DoD bullets, restate the item as the single
  surviving question ("should `allowPending` waive `accepted + pending`?"), and drop the `#L…` anchors.

## #2896 — The drain auto-accept path hand-rolls the review label swap too
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** `blockedBy: ["2882"]` — **#2882 is resolved**, so the card is unblocked and nothing on
  it says so. The work itself is untouched and still needed:
  `GUARDED_DOC_PREFIXES = ['skills-src/review/', 'docs/agent/']`
  (`we:scripts/lib/review-skill-guard.mjs:59`) has not widened to `skills-src/`; the raw swap is still
  at `we:skills-src/drain/SKILL.md:413` (`gh pr edit … --add-label redteam:accepted --add-label
  review:accepted`); the label-must-exist note is still at `:490`; and `we:scripts/review-set-label.mjs`
  still has **no `redteam` target**.
- **suggested action:** edit card (clear `blockedBy`) — it is build-ready.

## #2902 — git-branch guard denies checkout inside a throwaway clone
- **verdict:** DEAD-REFS
- **confidence:** medium
- **evidence:** `scope: we:.claude/hooks/guard-git-branch.mjs` — **`we:.claude/hooks/` does not exist**
  (`.claude/` holds only `agent-memory/`, `commands/`, `settings.json`, `skills/`), and
  `we:.claude/settings.json` registers no such hook (it registers guard-lane, backlog-guard,
  guard-backward-edge, guard-bash). No `guard-git-branch.mjs` exists anywhere on this machine, including
  `/root/.claude/`. The card's own body says the hook is user-global ("lives under `~/.claude/`, outside
  this repo"), which contradicts its `we:`-prefixed `scope`.
  Related items (#1934, #2897, #1933, #1985, #2123, #2336) are all resolved, so nothing else is stale.
- **suggested action:** edit card — the `scope:` must not claim an in-repo path the repo does not have;
  and confirm the hook still exists on the operator's machine before building (unverifiable from here).

## #2931 — Gate any statusCheckRollup consumer outside latestRequiredCheck
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The gate itself is still unbuilt (`statusCheckRollup` appears nowhere in
  `we:scripts/check-standards-rules.mjs`), so the item is valid. But its sequencing premise is spent:
  - *"Do NOT allowlist the whole-rollup folders — `ciRollup` … and `rollupToCheckRows` … Both are shape
    (b) and both are currently WRONG"* → **both are now fixed**: `we:scripts/readiness/conveyor-state.mjs:43,194`
    and `we:scripts/fetch-parked.mjs:34,60` both import and apply `collapseRollupToLatestPerName`.
  - *"the per-name collapse #2925 **proposes** to add"* → it exists, exported from `merge-ai-prs.mjs`.
  - *"those two files are the gate's known-red cases until #2925 lands. Land this gate AFTER that repair,
    or ship it warning-only first"* → **#2925 is resolved**; the gate can ship at `error` immediately.
- **suggested action:** edit card (drop the warning-only sequencing; the tree is already clean).

## #2960 — Register the review-label CLI on the trust chain's POLICY tier
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The registration itself is genuinely still missing — `review-set-label.mjs` is **not** a
  `TRUST_CHAIN` member (`file:` entries in `we:scripts/lib/gate-config.mjs` list 27 basenames, none of
  them it). But the card's timing argument is written against a world that no longer exists:
  - *"Once #2785 (the implementation of #2771, `status: open`) lands…"* — **#2785 is resolved**. The
    narrowing already shipped: `humanRequired = leashFiles.length > 0 || statuteFiles.length > 0`
    (`we:scripts/lib/review-escalation.mjs:639`), and `POLICY_SPEC_BASENAMES`/`RATIFIED_POLICY_SPEC_FLOOR`
    exist (`gate-config.mjs:431-450`).
  - The card's stated trap — *"a bare `tier: 'policy'` registration would then STOP forcing a human"* —
    is **contradicted by the shipped code**, which is fail-closed by construction:
    `POLICY_SPEC_BASENAMES` = policy members with `leash !== CODE`, so a bare/missing `leash` is treated
    as declarative leash and *stays* human. Dropping to the committee requires writing `leash: 'code'`
    explicitly.
  - *"Verified on the #2895 lane before the split: adding the entry flips `isGateSelfPath` … to `true`"*
    — that verification predates #2785 and no longer describes today's derivation.
- **suggested action:** edit card — re-derive the (a)/(b) choice against the shipped fail-closed
  `leash` predicate; the "do not let #2785's landing silently change the answer" warning is moot.

## #2987 — burndown data reads UTC while its inputs are operator-local
- **verdict:** OK
- **confidence:** high
- **evidence:** Every cited fact checks out today: `we:src/_data/burndown.js` is still CJS,
  `const sysToday = toUTC(fmt(Date.now()))` is at **:43** and `Math.max(sysToday, lastData)` at **:46**;
  `we:scripts/lib/local-date.mjs`, `we:scripts/lib/utc-day-slice-scan.mjs` and
  `we:src/_data/__tests__/burndown.test.ts` all exist; the companion #2985 is still open and #2747
  resolved, exactly as described.
- **suggested action:** none

## #3024 — A stale-acceptance re-park re-asserts review:human from the whole-PR score
- **verdict:** STALE-PREMISE
- **confidence:** high
- **evidence:** `blockedBy: ["3053"]` — **#3053 resolved 2026-08-10, and it ruled AGAINST this item's
  build.** Verbatim from #3053's ratification block: *"**(a) — the whole-PR score stands**"*, and
  *"**(b) — the uncovered-delta score is kept as a DIRECTION, not a commitment** … It is **not**
  authorised to build. Three preconditions, all unmet."* #3024's own text says *"once `#3053` rules for
  the delta-only score, implement the narrowing"* — that condition did not occur.
  #3053 also explicitly corrects a claim **this card repeats**: *"A claim both this card and #3024 cited
  as #2840 statute — 'the leash split is fail-closed and cannot shrink' — is a **test `describe` title**
  in `we:scripts/lib/__tests__/gate-invariants.test.mjs`, not ratified text."* #3024 still presents it
  as statute ("Statute `#review-human-declarative-leash-only` plus #2840's …").
  (#3054, the false-stale umbrella, is still open; its slices #3046/#3052 resolved.)
- **suggested action:** park (not authorised to build) — or edit to record the (a) ruling, replace the
  `blockedBy: 3053` edge with #3053's three named preconditions, and delete the #2840 statute claim.

## #3189 — Extract the review-label provider port so the #2964 write ordering is testable
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Fully shipped under this card's own `bornAs` id (`x8xf5rl`):
  - `we:scripts/lib/review-label-provider.mjs` exists — header reads *"THE PROVIDER PORT for the
    review-label arc (#x8xf5rl) — the four operations `we:scripts/review-set-label.mjs` needs"*; exports
    `PR_STATE_FIELDS`, `GH_ARGV`, `createGhProvider`, `writeOrder`.
  - `we:scripts/review-set-label.mjs` now has **zero** `execFileSync('gh', …)` calls; it imports
    `createGhProvider, writeOrder` (`:86`), calls `provider.readPrState` (`:589`),
    `provider.setLabels` (`:841`), `provider.postComment` (`:852`), and the seam is documented at `:471`.
  - `we:scripts/lib/__tests__/review-label-provider.test.mjs` exists; the write-arc suite is at
    `we:scripts/__tests__/review-set-label.test.mjs:1841` — `describe('the write arc and its #2964
    ordering')` with the exact Done-when cases: *"COMMENT FIRST when review:accepted is not already
    live"*, *"SWAP FIRST when it is already live"*, *"never hands the swap a label the PR does not
    carry"*. Suite grew 1787 → 2505 lines.
- **suggested action:** resolve (the work landed; the card's status never flipped — same class as #3349).

## #3206 — Declare a record-verdict operation
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `we:scripts/operations/record-verdict.mjs`, `we:scripts/operations/record-verdict-io.mjs`
  and `we:scripts/operations/__tests__/record-verdict.test.mjs` (75 `expect(` calls) all exist; the
  transport it names (`we:scripts/apply-review-request.mjs`,
  `we:.github/workflows/apply-review-request.yml`) exists. Done-when 3 (wiring) is satisfied:
  `we:skills-src/review/SKILL.md:262` instructs
  `node scripts/operations/run.mjs record-verdict --runId=… --to=accepted|changes|clear-human`, and
  `we:docs/agent/backlog-workflow.md:276,291` plus `we:docs/agent/platform-decisions.md:3356` cite the
  module as the worked example.
- **suggested action:** resolve.

## #3207 — Declare a `verify` operation
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `we:scripts/operations/verify.mjs`, `we:scripts/operations/verify-io.mjs` and
  `we:scripts/operations/__tests__/verify.test.mjs` all exist (28 `it(` cases). Done-when 1 is met —
  the test asserts `CHECK_OUTCOMES` is `['pass','fail','unrun']` and that a no-summary check yields
  `unrun` with a non-ok verdict (`:77-100`). Done-when "wired into the callers" is met at all three
  named sites: `we:docs/agent/backlog-workflow.md:215` and `:1036`,
  `we:skills-src/conveyor/delivery-agent-brief.md:148,160,266`,
  `we:skills-src/next-backlog-item/SKILL.md:247` — each naming `--checkout` and `verdict.unrun`, as the
  card specifies. The card's own "## Verified" section already records the live runs.
- **suggested action:** resolve.

## #3221 — JIT numbering does not sweep prose citations in docs/
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - The motivating instance is fixed: `we:docs/agent/platform-decisions.md:3339` now reads
    *"(Nicolas, operator; #3214)"*, and #3214's hash `xvatzyf` appears nowhere in `docs/`.
  - `docs/agent/*.md` **is** swept — `we:scripts/lane-drain.mjs:602,627-643` extends the blind rewrite
    scope to the cite-able statute layer, delivered by **#2428 (resolved 2026-07-11)**, which the card
    does not mention.
  - The live gap is elsewhere: **`skills-src/` is not swept** — e.g. `skills-src/review/SKILL.md:253`
    cites `#x9xqexm` (landed as **#3023**), `:61 #xhqqy9j`, `:198 #xlw02hw`;
    `skills-src/next-backlog-item/SKILL.md:125 #xhhsfnq` (→ #3213); `skills-src/converge/SKILL.md:149
    #xl5jroq` (→ #3159); `skills-src/batch-backlog-items/SKILL.md:86 #x2v3kgr` (→ #3251);
    `skills-src/conveyor/SKILL.md:77 #xaibmeu` (→ #3096); plus ~15 more.
  - `Done when 1` is a literal `TODO` — the card is not agent-ready.
- **suggested action:** edit card — repoint the title/body from `docs/` to `skills-src/` (and
  `agent-memory-src/`), cite #2428 as the docs half already done, and write a real Done-when.

## #3232 — The NaN comparator is in six more places
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** Four of the six sites are live and unchanged
  (`we:src/assets/js/backlog-graph.js:141,147,157`, `we:src/assets/js/backlog-active.js:277`), but the
  `we:src/_data/backlog.js` citations have drifted: the card names **"805 and 895"**; today there is
  exactly **one** such comparator, at **:901** (`const byNumAsc = (a, b) => Number(a.num) - Number(b.num)`).
  So it is five places, not six. The shared primitive to promote already exists and is exported —
  `compareIds` at `we:src/_data/backlogGraph.js:11,128` — which the card does not name.
  `Done when 1` is a literal `TODO`.
- **suggested action:** edit card — correct the site list/count, name `backlogGraph.compareIds` as the
  primitive to promote, and write the executable Done-when.

## #3254 — check:standards errors on stranded hashes during the drain window
- **verdict:** STALE-INFO (two of three Done-when items superseded by **#2956**, resolved 2026-08-31)
- **confidence:** high
- **evidence:** `strandedHashesOnMain` (`we:scripts/check-standards-rules.mjs:2391`) now returns
  `{errors, warnings}` and routes by recency: `STRANDED_HASH_GRACE_SECONDS = 180`, and a file committed
  inside the window is a **warning** whose text explicitly does *not* name `number-stranded` (*"No action
  needed here — re-run `check:standards` after a fresh fetch"*), while an older one still errors with the
  remedy. That is Done-when **2** and **3** verbatim. The docblock at `:2362-2378` credits **#2956**, an
  item this card (filed 2026-08-21) does not reference.
  Still open: Done-when **1**, the allocator lock — `number-stranded` in `we:scripts/backlog.mjs` takes
  no lock, so two concurrent allocations can still collide.
- **suggested action:** edit card — mark Done-when 2/3 delivered by #2956 and re-scope the item to the
  lock only (or resolve it if the lock is judged unnecessary now that the advice no longer prescribes
  the race).

## #3272 — The learnings pool is ephemeral on a cloud VM
- **verdict:** OK
- **confidence:** high
- **evidence:** Unbuilt and accurate. `we:scripts/conveyor/learnings-drop.mjs` still resolves the pool as
  `$LEARNINGS_POOL || ~/.claude/conveyor/learnings` (`:48,208-211`) with **no** ephemeral-host detection,
  no durable ref, no `refs/notes` path. `we:scripts/lib/secret-scrub.mjs`, `we:scripts/bootstrap-session.mjs`,
  `we:scripts/conveyor/learnings-harvest.mjs` and `we:docs/agent/vm-sessions.md` all exist; #2984 and
  #3015 are resolved as the card describes. The quoted NUL-byte observation is still true —
  `we:scripts/guard-bash.mjs` contains exactly one `\x00`.
  Nit only: the fourth quoted entry names *"the durable-fix rule table in `we:docs/agent/vm-sessions.md`"*;
  that doc has no "durable-fix" heading (the nearest is the derivable-rules table at `:37`). It is a
  verbatim pool entry, so leave it.
- **suggested action:** none

## #3290 — A claim corrected at one site while the same claim stands at another has no gate
- **verdict:** OK
- **confidence:** medium
- **evidence:** Still unbuilt as specified (no diff-based survivor detector). All five siblings it names
  (#3286, #3287, #3288, #3289) exist and are open; #3147 and #3035 resolved.
  Worth cross-referencing when picked up: **#3307 (resolved)** shipped
  `we:scripts/lib/claim-sweep.mjs`, which solves the adjacent *manual* half (point it at a corrected
  claim, it names every surviving site; report-only, refuses `--fix`) and cites `3290` in its header. It
  does **not** read a lane diff, so it does not satisfy this card's Done-when 1–4.
- **suggested action:** edit card (add the #3307 / claim-sweep cross-ref so the builder reuses the
  shingling rather than re-deriving it).

## #3333 — check:standards rule: a ratified clause may not assert a capability claim without a test/owner
- **verdict:** STALE-INFO (line-anchor rot only)
- **confidence:** high
- **evidence:** The rule is genuinely unbuilt (no `manual observation` detection in
  `we:scripts/lib/validate-rules-anchors.cjs`), and the shape it copies is intact:
  `validateInvariantEnforcers` at `:249` ✓, `runStatuteCheck` at `:520` ✓,
  `we:scripts/__tests__/rules-anchors.test.mjs:145` is exactly the `#2844` describe block ✓,
  #3118 resolved, #3331 open (so #3118's clause does have an OPEN owner — the regression fixture holds).
  Two stale anchors:
  - `we:docs/agent/platform-decisions.md:3133` for clause 3 → the anchor is now at **:3163** and clause 3
    at ~**:3179** (the doc is 4138 lines; :3133 is unrelated text).
  - `we:scripts/check-standards.mjs:1678` as the "folds it into the everyday gate" call site → the
    `runStatuteCheck` fold is now at **:1809-1810**.
- **suggested action:** edit card (refresh the two line anchors; prefer anchor names over line numbers).

## #3349 — resolve-on-land did not fire: five items stayed open
- **verdict:** STALE-INFO (lead 1 closed; class re-diagnosed under #3441/#3473)
- **confidence:** medium
- **evidence:**
  - All five observed items (#3317, #3322, #3319, #3309, #3316) are now `resolved` — hand-closed, as the
    card anticipated. #2899/#2748 resolved; #2906 still open.
  - **Lead 1 is no longer true.** The card says the work set is *"gated on `c.hasManifest && c.item != null`
    … A landed PR whose verdict carries no couple manifest … never enters the set."* Today
    `landedIdsForCandidate` (`we:scripts/merge-ai-prs.mjs:1394-1402`) has a no-manifest branch: for a
    local-repo PR it derives ids via `deliveredItemNumsFromPr(headRef, title, {body, changedFiles})`.
  - That extractor was hardened over 8 review rounds under **#3441** (`active`) and a real extractor bug
    was root-caused and filed under **#3473** (resolved 2026-09-04) — neither of which this card
    references. The class recurred on 2026-09-01 (#3441) with a *different* cause (dispatch agent never
    resolving its own item).
- **suggested action:** edit card — record that lead 1 is closed, cite #3441/#3473 as the live home for
  extractor defects, and either narrow Done-when 1 to a still-unexplained PR or resolve as absorbed.

## #3355 — Gate the declared model-consumer set on standing adversarial fixtures
- **verdict:** STALE-INFO (blocker cleared)
- **confidence:** high
- **evidence:** The card opens *"**Blocked on that decision being ratified and its anchor landing** — the
  two-PR rule requires the cited anchor to be `status: resolved` on `main` before this PR may reference
  it."* **#3354 is resolved (dateResolved 2026-08-27)** and its clause is on `main` — codified as an
  amendment (`we:docs/agent/platform-decisions.md:2855`, *"the model-consumer sentence"*), not a new
  anchor. So the item is build-ready and nothing on it says so.
  Everything else verifies: all 12 cited code paths exist (`cli-adapter.mjs`, `review-core-cli.mjs`,
  `jury-core.mjs`, `judge-spawn.mjs`, `operation-io-fidelity.mjs`, `mutation-check.mjs`,
  `__tests__/helpers/fake-claude.mjs`, `__tests__/review-pr.test.mjs`, `jury-ledger.mjs`,
  `verdict-ledger.mjs`, `tick-core.mjs`, `step-kinds.mjs`), and the gate itself is unbuilt (no
  `not-a-model-consumer` / `MODEL_CONSUMER` anywhere in `we:scripts/`).
  Note: the recommended-approach section cites several `file:line` anchors (`cli-adapter.mjs:107`,
  `judge-spawn.mjs:490`, `operation-io-fidelity.mjs:255,320-327,86,135,371,335`,
  `check-standards.mjs:2270-2274`, `review-pr.test.mjs:1645-2041`) that were not individually
  re-verified — treat them as approximate.
- **suggested action:** edit card (strike the "blocked on #3354" sentence; it is ready to build).

---

### OK cards
- #232 OK · #2457 OK · #2987 OK · #3272 OK · #3290 OK (with a #3307 cross-ref suggestion) ·
  #2224 OK (carries a mis-referenced `#96`)
