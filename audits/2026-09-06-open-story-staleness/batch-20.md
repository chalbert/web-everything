# Batch-20 staleness audit — 85 open backlog cards (web-everything)

**Summary (85 cards)**
- ALREADY-DONE: 3 (#2423, #3117, #3360)
- SUPERSEDED: 0
- STALE-INFO: 18
- STALE-PREMISE: 0
- DEAD-REFS (as primary or secondary): 8
- OK: 64

**Audit caveat:** the working checkout is a shallow clone (142 commits) and `gh` is not installed, so
(a) commit SHAs cited in cards could not be resolved and are NOT reported as dead, and (b) no live PR /
label state could be checked (affects #3005, #3016, #3392).

---

## #800 — Rendered-site regression tooling — unified harness over the live docs site
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Body: *"The end-state home … is the open call in #799 … build slices portably until it
  resolves."* `backlog/799-where-does-rendered-site-regression-tooling-home-*.md` is now
  `status: resolved` (dateResolved 2026-06-17), `codifiedIn: docs/agent/platform-decisions.md#constellation-placement`.
  The named slices are all shipped/resolved too: #763, #770, #796 all `status: resolved`. The
  "later visual-regression slice" now has a dedicated live epic, #2232 (`status: active`) with its own
  slices #2234–#2240 — not tracked here.
- **suggested action:** edit card — replace "the open call in #799" with the ratified
  `#constellation-placement` anchor; point the visual slice at #2232; re-scope or resolve the epic given
  a11y + content are shipped.

## #556 — Per-app live-patch policy console
- **verdict:** OK
- **note:** `blockedBy: ["410","554"]` — #410 resolved, #554 open and explicitly parked
  (`dateParked: 2026-06-14`, founder go/no-go humanGate). Card is accurate; it is parked-by-dependency
  and could carry its own `dateParked` so readiness stops ranking it.

## #557 — Live-patch audit & compliance aggregation dashboard
- **verdict:** OK
- **note:** same as #556 — parked behind #554.

## #1259 — Model-capability watch (Plateau on-device cost linearity)
- **verdict:** OK
- **note:** all four slices it filed are resolved (#1276, #1277, #1278, #1279); `relatedReport`
  `reports/2026-06-20-program-model-capability-watch.md` exists. The card's own "**Next run:** re-sweep
  deltas since 2026-06-20" is ~2.5 months overdue.

## #2090 — External consultant review (standing program)
- **verdict:** OK
- **note:** report exists; every run-1 finding it filed is resolved (#2080, #2082–#2089). Cadence is
  "quarterly + phase boundaries" and the last run was 2026-07-01 — a run is now due. #1137 (the
  pre-public-launch trigger) is still open.

## #2154 — Cut @webeverything/contracts publishing over to OIDC trusted publishing
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Agent-doable follow-up 1 says *"Confirm `permissions: id-token: write` is set on the
  publish job … verify it's present, not just implied."* It is already present and documented —
  `.github/workflows/publish-contracts.yml:33` (`id-token: write # required for npm provenance …`), and
  the file's own comment at lines 63–66 states *"no OIDC trusted-publisher registration required; the
  NPM_TOKEN auth is sufficient. Dropping the token for full OIDC …"*. The remaining work (drop
  `NODE_AUTH_TOKEN` / `secrets.NPM_TOKEN` at line 69, delete the secret, revoke) is genuinely undone.
  Blocker #907 is still `status: open`, so the sequencing premise holds.
- **suggested action:** edit card — strike the already-satisfied first bullet.

## #2239 — Seed the initial reviewed container-linux baselines
- **verdict:** OK
- **note:** every blocker is now resolved (#2234, #2235, #2236, #2237, #2238), and
  `.github/workflows/update-visual-baselines.yml` exists. `tests/visual/` still has **no**
  `*-snapshots/` directory, confirming nothing was seeded. This card is now fully unblocked and is the
  sole gate on #2240 / epic #2232.

## #2240 — Reactivate the visual gate and promote it to a required check
- **verdict:** OK
- **evidence:** verified accurate — `.github/workflows/ci.yml:400-408` still carries
  `visual:` … `if: ${{ false }}` plus the stale "DISABLED (#2232)" comment the card asks to delete.
  Blocker #2239 still open.

## #2422 — Drain-side RUN_TOOLING guard
- **verdict:** OK
- **evidence:** no `isRunTooling` / `RUN_TOOLING` / `selfModifying` symbol in
  `scripts/readiness/lane-partition.mjs`. The card's own stale-axis notes (#2266 moved skills to
  `skills-src/`, #2183 changed the shell-out surface) are still correct; `skills-src/drain/SKILL.md`
  exists, `scripts/push-if-green.mjs` and `scripts/pr-land.mjs` exist.

## #2423 — Per-PR review-escalation relief valve (`--no-review-escalation=<pr#>`)
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** the durable fix the card specifies is fully implemented and tested on `main`:
  - `scripts/merge-ai-prs.mjs:181` `export function parseNoReviewEscalation(argv, name)` — repeatable
    flag, comma lists, bare flag preserved as the legacy pass-wide waiver (line 185).
  - `scripts/merge-ai-prs.mjs:210` `export function applyEscalationRelief(gate, {relieved})` — waives
    only an agent-reviewable `review:pending` park; the JSDoc at lines 197–206 explicitly refuses
    `review:human` and `review:changes`, exactly as the card demands.
  - Wired at `scripts/merge-ai-prs.mjs:3046-3047` (`REVIEW_ESCALATION = label && !escalationRelief.passWide`)
    and `:3335`.
  - Tests: `scripts/__tests__/merge-ai-prs-review-escalation-and-rollup-dedup.test.mjs:19`
    (`describe('#2423 per-PR --no-review-escalation relief valve')`),
    `scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs:78`,
    `scripts/__tests__/merge-ai-prs-ai-detection-and-drain-ordering.test.mjs:204`.
  - Corroborated by #2590's own body ("#2423, `parseNoReviewEscalation`/`applyEscalationRelief` in
    merge-ai-prs.mjs … accepted as a follow-up when PR #611 landed") and by #3229's list of known-stale
    cards ("2423 landed in July").
- **suggested action:** resolve (`graduatedTo` the merge-ai-prs.mjs implementation).

## #2430 — Watch-mode lander keeps enforcing retired policy
- **verdict:** OK
- **evidence:** no source-identity / blob-sha staleness self-check in `scripts/merge-ai-prs.mjs`
  (grep for "staleness"/"source identity" returns only unrelated acceptance-staleness text).

## #2447 — Surface the graduatedTo resolution basis on the review/label surfaces
- **verdict:** OK
- **evidence:** zero `graduatedTo` references in `scripts/lib/review-core.mjs`,
  `scripts/lib/review-render.mjs`, `scripts/lib/review-escalation.mjs`. All 19 `scope:` paths resolve.

## #2459 — Heartbeat the whole-process drain lease on one-shot sweeps
- **verdict:** OK
- **evidence:** `scripts/merge-ai-prs.mjs:4755` still heartbeats only inside the watch loop.

## #2460 — rebase-drop fires on plain BEHIND tips
- **verdict:** OK
- **evidence:** `scripts/merge-ai-prs.mjs:639-647` `isRebaseDropCandidate` still returns true for
  `state === 'BEHIND'` / `'DIRTY'` unconditionally. All four `scope:` paths exist. Note a new sibling
  landed since filing — `scripts/lib/rebase-drop-content.mjs` + a `--no-content-rebase-drop` flag
  (merge-ai-prs.mjs:50-55,107) — which the card's scope does not name.

## #2461 — Drain strategies: move hardcoded behavior to a config file
- **verdict:** OK
- **evidence:** neither `scripts/lib/drain-config.mjs` nor `drain.config.json` exists (as expected —
  they are the deliverable). Blocker-adjacent items #2449 and #2454 are both resolved; all
  `plateau:tools/drain-daemon/*` and `plateau:tools/dev-panel/*` scope paths exist.

## #2547 — Batch-scaffold helper
- **verdict:** OK
- **evidence:** `scripts/backlog/batch-scaffold.mjs` does not exist and `scripts/backlog.mjs` has no
  batch mode.

## #2571 — Constitution/spec review UI
- **verdict:** OK
- **evidence:** plateau-app has only a read-only public `/constitution` render route
  (`index.html:189`, `src/main.ts:88 mountConstitution`) — no granular per-line sign-off surface.
  #2564 and #2563 are resolved; #2494 resolved, #2555 open.

## #2590 — Repo-qualify the per-PR relief target
- **verdict:** OK
- **evidence:** still exactly as described — `scripts/merge-ai-prs.mjs:190` pushes bare integers
  (`const n = Number(t)`) and `:3335` matches `escalationRelief.prs.includes(Number(p.number))` with no
  repo qualifier. Depends on #2423's code, which has landed (see above), so this is now cleanly
  actionable.

## #2636 — Jury-based PR review to convergence (epic)
- **verdict:** OK
- **evidence:** all four named primitives exist in `scripts/lib/review-core.mjs`
  (`panelRigorForCareLevel`, `buildEditorMandate`, `deriveNegotiationOutcome`, `DIVERSITY_SELECTION` —
  exported at lines 105-164). #2285 and #2567 are resolved as the card implies.

## #2642 — Juror management page
- **verdict:** OK
- **note:** blocker #2641 (jury ledger surfaced to the conveyor) is now **resolved**, so this is
  unblocked. plateau-app has zero `juror` occurrences in `index.html` / `src/main.ts` — unbuilt.

## #2781 — Split we:scripts/lib/review-core.mjs (RANK 2 — 13 scope-collisions)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the rank and count in the title are both wrong now. Counting `scope:` frontmatter
  entries across `backlog/*.md` for open/active items:
  `we:scripts/merge-ai-prs.mjs` = **28**, `we:scripts/lib/review-escalation.mjs` = **13**,
  `we:scripts/lib/review-core.mjs` = **8**. So review-core is now **RANK 3 with 8 collisions**, not
  rank 2 with 13 — it has **swapped places with #2783**. Blocker #2678 is resolved. File is now 1987
  lines / 63 exports.
- **suggested action:** edit card — swap the rank/count with #2783's, and correct the "Rank 2 …
  (after merge-ai-prs)" sequencing line.

## #2783 — Split we:scripts/lib/review-escalation.mjs (RANK 3 — 8 scope-collisions)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** inverse of #2781 — review-escalation now has **13** open/active scope-collisions and is
  **RANK 2**, not rank 3 with 8. File is 2280 lines / 61 exports. Blocker #2678 resolved.
- **suggested action:** edit card — correct rank + count; it should now be sequenced ahead of #2781.

## #2784 — Split we:scripts/merge-ai-prs.mjs (RANK 1 — 25 scope-collisions)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** rank 1 still holds, but the counts have moved: **28** open/active scope-collisions (card
  says 25; 47 including resolved items), and the body's *"already a 42-export barrel"* is now **91
  `export ` statements** in a 4841-line file. Blocker #2678 is resolved → unblocked.
- **suggested action:** edit card — refresh both numbers.

## #2870 — check:standards: third-party test-runner semantics need an adjacent citation
- **verdict:** OK
- **evidence:** no such rule among the 76 `export function`s in `scripts/check-standards-rules.mjs`;
  no `it.fails` / runner-semantics scan anywhere in the gate.

## #2871 — Extend the #2821 code-locus rule to token assertion
- **verdict:** OK
- **evidence:** `scripts/check-standards-rules.mjs:1841 scanRepoLocusPrefixes` still only checks for the
  presence of a `<repo>:` prefix; `scripts/lib/citation-check.mjs`'s header (lines 26-28) explicitly
  lists gate 6 (symbol-anchor convention) as *not* in the shipped subset. `vitest.config.ts` exists.

## #2872 — check:standards: prose forward-reference naming a transitive blockedBy descendant
- **verdict:** OK
- **evidence:** no forward-reference/transitive rule in `scripts/check-standards-rules.mjs`.

## #2874 — check:standards: a bare #NNN in PR-vocabulary prose must be `PR #NNN`
- **verdict:** OK
- **evidence:** no such rule exists. Independently confirmed as a live problem class by this very audit:
  four cards in this batch (#3170, #3157, #3167, #3016) carry bare `#NNNN` PR references that resolve to
  unrelated backlog items — see their DEAD-REFS entries below.

## #2889 — Gate: resolving an item must not drop an open blockedBy edge
- **verdict:** OK
- **evidence:** `scripts/check-standards-rules.mjs` has no base-vs-head resolve/blockedBy rule. #2840
  and #2785 are both resolved now (the incident it describes is history, but the class guard is unbuilt).

## #2891 — Impl: `assertNotPrincipleAndImpl` two-PR write gate
- **verdict:** OK
- **note:** blocker #2890 (`diffHunks` plumbing) is now **resolved** and is visibly wired —
  `scripts/merge-ai-prs.mjs:3823` and `scripts/lib/review-escalation.mjs:434` both name
  `assertNotPrincipleAndImpl` as the awaited consumer, and `scripts/lib/diff-hunks.mjs:9` documents it.
  The function itself does not exist. Unblocked and accurate.

## #2892 — Impl: `isPrincipleSurface` composition + leash-pin gate
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  1. Scope bullet 2 says *"replace both current path OR-terms (`isStatutePath`, `isGateSelfPath`)"*.
     That describes pre-#2785 code. Today `scripts/lib/review-escalation.mjs:639` computes
     `const humanRequired = leashFiles.length > 0 || statuteFiles.length > 0;` from
     `isDeclarativeLeashPath` (:634) and `isStatutePath` (:636) — `isGateSelfPath` (:322, now just an
     alias for `isPolicyCorePath`) is **no longer an OR-term** in `humanRequired`.
  2. Scope bullet 1 lists `isDeclarativeLeashPath` as a component to build; it already exists and is
     exported at `scripts/lib/review-escalation.mjs:333`.
  3. Both blockers (#2785, #2890) are now resolved → unblocked.
  `isPrincipleSurface`, `isStatuteAnchorEdit`, `isMarkedInvariantEdit` genuinely do not exist (only
  referenced in comments), so the work is still owed.
- **suggested action:** edit card — rewrite the scoreEscalation bullet against the current two-term shape.

## #2894 — Monotonicity conformance case in gate-invariants
- **verdict:** OK
- **evidence:** `RATIFIED_SHRINKS` appears nowhere in the repo. The card's premise still verifies:
  `scripts/lib/review-escalation.mjs:70-78 isStatutePath` matches
  `^docs/agent/platform-decisions\.md$` whole-file, and
  `scripts/lib/__tests__/gate-invariants.test.mjs:110` pins it (`STATUTE_FILES`).

## #2907 — Review pipeline unblock plan
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the card's stated **critical path is done**. Body: *"Critical path is one operator
  action: **land PR #1031**, which makes `we:scripts/workflows/review-parked-prs.mjs` launchable at all.
  It has been unlaunchable since it was written (its `meta` used string concatenation, which the
  Workflow runtime rejects)."* That file's `meta` is now a pure literal —
  `scripts/workflows/review-parked-prs.mjs:101-105`: *"meta — a PURE literal (no computation)"*,
  `export const meta = { name: 'review-parked-prs', description: '…' }` with no concatenation. The
  other close condition (#2572 landed) is NOT met — #2572 is still `status: open`. Also *"Eleven PRs
  are open and most are parked"* is a July snapshot that could not be re-checked (`gh` unavailable).
- **suggested action:** edit card — strike the critical-path paragraph as done; the close condition
  reduces to "#2572 lands".

## #2912 — Move the head-currency proof onto resolveNetDiffBasis
- **verdict:** OK
- **evidence:** no `expectOid` parameter anywhere in `scripts/merge-ai-prs.mjs` or
  `scripts/fetch-parked.mjs`; `scripts/fetch-parked.mjs:241 sameCommit` / `:326` still local to that
  consumer.

## #2913 — One shared SHA-identity primitive (sameCommit / acceptanceCoversHead)
- **verdict:** OK
- **evidence:** still two implementations — `scripts/fetch-parked.mjs:241 sameCommit` and
  `scripts/lib/review-escalation.mjs:1490 acceptanceCoversHead`. No shared primitive in `scripts/lib/`
  (only a passing mention at `scripts/lib/jury-core.mjs:1577`).

## #2915 — Codify the no-regression land bar in platform-decisions
- **verdict:** OK
- **evidence:** verified accurate — zero "no-regression"/"no regression" hits in
  `docs/agent/platform-decisions.md`; `agent-memory-src/land-on-no-regression-not-perfection.md` exists
  and links no statute anchor for its own rule. #2851 is `status: resolved`.

## #2916 — check-memory: 200-char line budget on sub-indexes + leaf naming
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the rule is still owed (`scripts/check-memory.mjs:156` applies `checkBudget` to
  `MEMORY.md` only; the `indexSources` loop at :167-185 checks pointer integrity, never line length),
  but three of the card's four factual claims have moved:
  1. *"~10 pre-existing violations"* → **75** sub-index lines now exceed 200 chars (longest:
     `agent-memory-src/index-meta.md:3` at **904**, then `index-back.md:33` at 761).
  2. *"the land-bar hook landed at 554 chars (2.7× budget, longest rule line in the corpus)"* → that
     line is now `agent-memory-src/index-meta.md:43` at **168 chars**, within budget, and it is not the
     longest.
  3. *"the land-bar leaf was numbered 232 — the file count (231) + 1"* → the leaf is now
     `agent-memory-src/land-on-no-regression-not-perfection.md`, slug-only, **not numbered**. Max
     existing numeric prefix is **147** (card says 146); corpus is 262 leaves.
  4. *"update the stale 'create the next numbered leaf' line in `we:docs/agent/memory-management.md`"* →
     that string no longer appears in that file.
  Rule 3's *"~30 pre-existing files drift"* is still exact: **30** leaves have a `name:` that differs
  from their filename slug.
- **suggested action:** edit card — refresh all counts; drop the fixed rule-2 instance and the
  already-corrected doc line, keeping only the forward-looking guard.

## #2917 — Gate bare #NNNN citations in agent-memory
- **verdict:** OK
- **evidence:** `scripts/lib/memory-freshness.cjs:153-176` already implements a *cite-resolution* signal
  (a bare `#NNNN` must resolve to a real `backlog/NNNN-*.md`, with `isPrCite` excluding `PR #NNNN`), but
  **not** the namespace-requirement warn this card asks for — and the reported failure mode (`#1031`,
  `#1037`, `#1022` resolving to real-but-wrong items) still passes that resolution check. Card accurate.

## #2918 — Stale-ahead fix reaches only acquire, not list/provision
- **verdict:** OK
- **note:** verified — two builders still exist in `scripts/lane-pool.mjs`: the inline `infoFor` in
  `cmdAcquire` (:1011-1023, carrying the `aheadIsProvablyPushed` relaxation) and `laneAcquirableInfo`
  (:722-726, which does not); the latter is the sole input to `list --acquirable` (:1475) and
  `provision --acquirable` (:774). Blocker #2920 is now **resolved** (containment answerable in one
  spawn — `scripts/lane-pool.mjs:638` `rev-list --ignore-missing --max-count=1 HEAD --not …`), so the
  card's stated reason for not bundling is gone and this is unblocked.

## #2919 — aheadIsProvablyPushed cannot prove containment when the remote tip object is absent
- **verdict:** OK
- **evidence:** `scripts/lane-pool.mjs:638` still relies on local object availability
  (`rev-list … HEAD --not <remoteShas>`); the fetch-before-prove fix is not in. The pinning tests the
  card names exist (`scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs`). A network-free local
  sibling `#2924` variant landed at :650-665 but does not close this.

## #2959 — Enum-totality over the review-label target set
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the card enumerates the target set as *"`accepted`, `changes`, `rearm`, `clear-human`"*
  (four) and says *"so adding a fifth target reddens the gate instead of quietly under-covering."*
  **A fifth target has already been added, with no gate in place**:
  `scripts/review-set-label.mjs:110` is now
  `REVIEW_LABEL_TARGETS = Object.freeze(['accepted','changes','rearm','clear-human','restamp'])`.
  The card's other statements verify: `scripts/lib/verdict-totality.mjs` still guards only `VERDICTS`
  (`enumSymbol: 'VERDICTS'`, :60), and `projectVerdictCommentLength` (:1164, :1205) still relies on its
  own hand-written `REVIEW_LABEL_TARGETS.flatMap` loop rather than a marker.
- **suggested action:** edit card — correct the target set to five members and note that the "fifth
  target" scenario it warns about has already happened undetected (strengthens the case for the gate).

## #2966 — Emit /converge rounds as durable jury-ledger events
- **verdict:** OK
- **evidence:** zero `jury-ledger` / `JURY_EVENT_TYPES` imports in `scripts/converge-cli.mjs`; the core
  `scripts/lib/converge-core.mjs` is correctly still ledger-free.

## #2970 — Migrate the parked-PR review harness onto the extracted convergence core
- **verdict:** OK
- **note:** blocker #3043 is still `status: open`, so the sequencing premise holds. #2908 is resolved as
  the card states.

## #2988 — Land-time lane check: refuse a delivered-but-open lane
- **verdict:** OK
- **evidence:** no delivered-but-open or reciprocal-blockedBy rule in `scripts/check-standards.mjs`,
  `scripts/check-standards-rules.mjs`, or `scripts/merge-ai-prs.mjs`. Both `scope:` paths exist.
  #2989 is still `status: active`, #2880 resolved, #2832 open.

## #2992 — citation-gate: a #token in scripts must resolve
- **verdict:** OK
- **evidence:** no coined-marker rule; `#couple-decouple` no longer appears anywhere in `scripts/`
  (the instance was fixed as the card says), and `scripts/lib/citation-check.mjs:26-28` confirms the
  `#NNN`-plausibility gate is explicitly still outside the shipped subset.

## #3005 — One-time cleanup: strip ready-to-merge from PRs carrying a review hold
- **verdict:** OK (unverified live state)
- **note:** the code-side premise verifies — `scripts/merge-ai-prs.mjs:3739` documents *"#2832 / #984 F2
  — the ONE `ready-to-merge` strip seam every park site in the escalation pass goes through"*, and no
  per-pass reconcile strip exists. Whether any open PR still carries both labels could not be checked
  (`gh` not installed). Worth re-checking before scheduling — this may be a no-op by now.

## #3014 — Wire a cadence trigger for the harvest
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** body cites `poolStatus()` at
  `we:scripts/conveyor/learnings-harvest.mjs:173-182`; it is actually at **:208-212**. The rest holds —
  `scripts/conveyor/tick-core.mjs` has zero `harvest`/`poolStatus` references, so the wiring is unbuilt.
  #2978 is resolved.
- **suggested action:** edit card — fix the line reference.

## #3016 — Shrink #1068 to the ruled design
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** medium
- **evidence:**
  - **DEAD-REF:** the body's four bare `#1068` references mean **PR #1068**, but bare `#NNNN` is backlog
    syntax and `backlog/1068-webrealtime-provider-transport-negotiation-runtime-in-fui.md` is an
    unrelated, resolved FUI story. (Same defect in the parent decision #2978, which cites `#1068` six
    times.) Exactly the class #2874 gates against.
  - **STALE-INFO:** *"The branch is 29 commits behind main and needs a rebase"* is an 2026-08-08
    snapshot, unverifiable here and near-certainly wrong a month later.
  - Blocker #3015 (move the secret scrub to the publish seam) is now **resolved**, so the stated
    ordering constraint is satisfied and this is unblocked.
- **suggested action:** edit card — rewrite `#1068` → `PR #1068`; drop the commit-count claim.

## #3017 — Harvest may defer a cluster whose cause is not yet clear
- **verdict:** OK
- **evidence:** `scripts/conveyor/learnings-harvest.mjs:237 archivePool` still archives per session file
  with no deferred re-emit; no `deferred-<stamp>.jsonl` path anywhere.

## #3040 — Converge loop: retry a transient failure instead of escalating
- **verdict:** OK
- **note:** no `transient` classification in `scripts/lib/converge-core.mjs` or
  `scripts/converge-cli.mjs`. Blocker #2908 is now **resolved** → unblocked.

## #3117 — judge-spawn juror fails its first attempt with a bare, uninformative error
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** the exact fix the card asks for ("capturing stderr or the raw parsed object in the
  thrown message when result is empty") is on `main`:
  `scripts/lib/judge-spawn.mjs:648-662` — `if (parsed.result) { throw … }` followed by a dedicated
  empty-result branch whose comment reproduces this card's incident verbatim (*"reproduced twice in one
  night, cause unknown, resolved both times by a blind retry. A bare `<no result text>` placeholder left
  the caller nothing to act on"*) and which throws
  `` `judge-spawn: the juror failed with no result text. parsed: ${JSON.stringify(parsed)…}` `` plus a
  600-char stderr tail. Covered by
  `scripts/lib/__tests__/judge-spawn.test.mjs:342` — *"when `result` is empty, throws the raw parsed
  object and stderr instead of a useless placeholder (**#xn85i4a**)"*, citing this card's own `bornAs`.
  Independently corroborated by #3229's own example list ("3117 delivered with a test citing the card
  own bornAs"). The card's `we:scripts/lib/judge-spawn.mjs:438` line ref is also stale (now :650).
- **suggested action:** resolve.

## #3121 — Verify existing Squarespace DNS records survive the #1137 cutover
- **verdict:** OK
- **evidence:** `humanGate: {kind: deploy}` — nothing agent-verifiable. #1137 is still `status: open`,
  so the sequencing holds. `crossRef` slug resolves to the real file.

## #3130 — plateau-app: five auth-gated routes reachable while logged off
- **verdict:** OK
- **evidence:** re-verified live on the current plateau-app checkout —
  `plateau-app/src/main.ts:268-274 PRODUCT_ROUTES` still omits `/skills`, `/console-board`,
  `/console-cases`, `/console-ruling`, `/console-micro`; `syncAuthShell` (:285) gates only on
  `isProductRoute`; `plateau-app/src/styles/layout.css:331-338` `.app-shell.logged-off .app-main` still
  only re-centers (`place-items: safe center`), it does not hide. All five routes still exist
  (`index.html:95,96,110,512,520,528,536`). Prerequisite #2512 is still open. Line ref 331-337 → 331-338
  (one-line drift, immaterial).

## #3135 — Wire #3067's stamp-lost detection into review-set-label.mjs and auto-land-seam.mjs
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the card's core factual claim — *"Neither consumer calls them yet:
  `we:scripts/review-set-label.mjs` reads `prBody` but never passes `prCreatedAt` or
  `hasStampLostMarker(prBody)` into `decideClearerIndependence`"* — is **now false for
  review-set-label.mjs**. Wire steps (1) and (2) have landed:
  - `scripts/review-set-label.mjs:74` imports `hasStampLostMarker`
  - `:587`, `:602` fetch and parse `createdAt` off the existing `gh pr view` call
  - `:653-663` passes both into `decideClearerIndependence({ authorId, clearerId, prCreatedAt,
    stampLostMarked: hasStampLostMarker(prBody) })`, with a comment at :654-657 explicitly saying
    "**#3067 WIRED HERE**".
  What genuinely remains: wire step (3) — the refusal at `:665` still matches only
  `INDEPENDENCE.SELF_CLEAR`, never `INDEPENDENCE.STAMP_LOST` (`:1005` likewise) — and the
  **auto-land-seam half is untouched**: `scripts/lib/auto-land-seam.mjs:153` still calls
  `decideClearerIndependence({ authorId, clearerId })` with neither new input. Blocker #3067 is now
  `status: active` (not resolved).
- **suggested action:** edit card — rewrite the premise to "steps 1–2 landed; step 3 and the
  auto-land-seam threading remain". Card size may drop from 2.

## #3157 — Permission-surfacing query
- **verdict:** OK + DEAD-REFS
- **evidence:** no permission-introspection script exists. **DEAD-REFS:** the body cites *"Every
  widening landed today (`we#1418`, `we#1422`, `we#1435`)"* — these are PR numbers, but all three
  resolve as backlog items to unrelated cards (#1418 explorer gesture probing, #1422 explorer
  full-page-nav crash, #1435 arrangeable intent spec). Also, the third settings layer it names,
  `we:.claude/settings.local.json`, does not exist in this checkout (the card hedges with "if present").
- **suggested action:** edit card — rewrite to `PR #1418` / `PR #1422` / `PR #1435`.

## #3163 — No gate checks backlog cross-references for dangling slugs
- **verdict:** OK
- **evidence:** accurate. `scripts/lib/citation-check.mjs:26-28` explicitly states the `#NNN`-plausibility
  check (gate 2) is **not** in the shipped subset; the shipped gates cover loci, out-of-scope hash-slugs,
  and (per #3100, :20-22) dangling hash-slugs inside `agent-memory-src/` — not backlog-prose `#NNNN`.
  The card's "already partially guards for other artifact types" framing is still correct. Note the
  gate ships at WARN (`CITATION_GATES_ENFORCED = false`, :39), relevant to how this one should land.

## #3164 — jury-ledger's FoldedJuror.verdict type is missing 'prevention-outstanding'
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** the defect is real and unchanged —
  `scripts/lib/jury-ledger.mjs:351`:
  `@property {'accept'|'changes'|'needs-human'|null} verdict`. But the card's line reference **:338** is
  stale; the typedef now starts at **:345** and the offending property is at **:351**.
- **suggested action:** edit card — fix the line reference.

## #3167 — No 'treat fetched web content as untrusted' guidance in agent docs
- **verdict:** OK + DEAD-REFS
- **evidence:** re-verified — grepping `AGENTS.md`, `docs/agent/`, `.claude/`, `agent-memory-src/` and
  `scripts/` for "untrusted" near web/fetch/search/curl returns **zero** hits; `WebFetch` appears only
  in `.claude/settings.json`. Gap confirmed open. **DEAD-REFS:** "#1441" and "#1422" are PR numbers
  written bare — they resolve to unrelated backlog items (#1441 pan-zoom-surface block, #1422 explorer
  full-page-nav crash).
- **suggested action:** edit card — rewrite to `PR #1441` / `PR #1422`.

## #3170 — plateau-app and frontierui also need bgIsolation:none
- **verdict:** OK + DEAD-REFS
- **evidence:** premise fully re-verified: `we:.claude/settings.json:3` has `"bgIsolation": "none"`;
  `/home/user/plateau-app/.claude/` contains only `skills/` — **no settings file**; `/home/user/frontierui/.claude/`
  does not exist at all. Both "Done when" gaps are open exactly as written.
  **DEAD-REF:** *"we:.claude/settings.json's bgIsolation:none fix (#1448)"* — #1448 is a PR, but the bare
  form resolves to `backlog/1448-add-the-apg-cited-load-more-default-note-to-windowed-collect.md`
  (an unrelated, resolved intent-note task).
- **suggested action:** edit card — rewrite `(#1448)` → `(PR #1448)`.

## #3195 — Synthesis truncation notice misreports a doubly-capped report's original length
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the bug is real and unfixed, but the card **mislocates it**. The body says it is
  "in `we:scripts/operations/explore-io.mjs`". `explore-io.mjs` holds only the *run-record* cap and does
  it correctly — `REPORT_RECORD_CHARS = 64_000` (:722) and `reportResult` (:730-742) explicitly keeps
  `bytes: full.length` as the true original ("*`bytes` is the length of what the panelist actually
  wrote, never of the excerpt*"). The defective notice is in a different file:
  `scripts/operations/explore.mjs:524-529 renderSynthesisInput` does
  `const full = String(r.report)` — i.e. the **already-record-capped** field, not `r.bytes` — and then
  emits `` `[…truncated at ${REPORT_EXCERPT_CHARS} characters of ${full.length}]` ``. With
  `REPORT_EXCERPT_CHARS = 24_000` (explore.mjs:133) under `REPORT_RECORD_CHARS = 64_000`, a 400 KB report
  is announced as "of 64000". The fix is one line in `explore.mjs`, and the fix input (`r.bytes`) is
  already carried.
- **suggested action:** edit card — retarget to `we:scripts/operations/explore.mjs:527` and name
  `r.bytes` as the correct source. (Makes it a near-trivial build.)

## #3229 — Sweep the backlog for cards describing work already done
- **verdict:** OK
- **evidence:** no such sweep report exists under `reports/`. Independently **corroborated** by this
  audit — of the 85 cards in this batch alone, 3 are demonstrably already-done (#2423, #3117, #3360) and
  18 more carry materially stale statements, i.e. ~25%, higher than the card's own 12% estimate. Two of
  its named examples were re-confirmed here (#2423 landed; #3117 delivered with a `bornAs`-citing test).

## #3274 — stage-pr-view --refresh cannot tell "processed, no change" from "not run yet"
- **verdict:** OK
- **evidence:** `scripts/produce-pr-view.mjs` and `.github/workflows/stage-pr-view.yml` both exist; no
  request-id acknowledgement mechanism present.

## #3291 — Lint the machine-coupled test shape
- **verdict:** OK
- **evidence:** no such rule among the 76 exports in `scripts/check-standards-rules.mjs`. The named
  instance in `scripts/__tests__/bootstrap-session.test.mjs` has since been repaired (explicit `exists`
  fakes at :113, :119, :124, :129, :168), which the card already assumes — the standing lint is the ask.

## #3294 — A PR body's gate line must be the CI result, not a local run
- **verdict:** OK
- **evidence:** `scripts/check-backlog-workflow.mjs` exists and contains no Gate-section / run-id /
  conclusion rule. The two fixture SHAs could not be resolved (shallow clone) — not asserted dead.

## #3295 — A subprocess PATH-resolution test must be run against a stripped PATH
- **verdict:** OK
- **evidence:** no such rule in `scripts/check-standards.mjs`. The card's "must not flag" instance is
  visibly in place — `scripts/operations/__tests__/helpers/fake-claude.mjs:158-168` now wraps
  `command -v claude` with an explicit "NOT-FOUND IS A RESOLUTION" guard. Fixture SHAs (`6e8fb3df`,
  `dad2fe4d`) unresolvable in this shallow clone — not asserted dead.

## #3359 — Stamp the deployed SHA into the Worker and define the rollback path
- **verdict:** OK
- **evidence:** `.github/workflows/deploy.yml` uses `DEPLOY_SHA` internally (:99) but never stamps it
  into the Worker — no `/version` route, no response header, no monotonicity guard (the "Refuse an
  unverified SHA" step at :117-146 checks ancestry-on-main and green checks, never descendant-of-live).
  Note: its sibling #3360 has since landed (see below), so this card's *"lands here rather than in
  #3360"* framing is now the correct home by default.

## #3360 — Deploy only a CI-verified SHA
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** every element the card specifies, including both halves of its own Retraction, is on
  `main` in `.github/workflows/deploy.yml`:
  - trigger switched: `on: workflow_run: { workflows: ["CI"], branches: [main], types: [completed] }` (:59-63)
  - checks out the CI-tested tree: `DEPLOY_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}` (:99)
  - the fork guard the Retraction demands: job `if:` requires
    `workflow_run.conclusion == 'success' && workflow_run.event == 'push' &&
     workflow_run.head_repository.full_name == github.repository` (:92-96)
  - the re-derive with **both** assertions: step "Refuse an unverified SHA" (:117-146) — (A) ancestry
    via `gh api repos/…/compare/main...$DEPLOY_SHA` accepting only `behind|identical`, and (B) latest
    `test` + `smoke` check-runs green via `check-runs?filter=latest` reduced with `max_by(.started_at)`.
  - the file header (:1-41) carries the card's retraction verbatim, including the empirically-verified
    non-ancestor PR sha, exactly as the card says it should ("See the header of
    `we:.github/workflows/deploy.yml` for the full retraction").
- **suggested action:** resolve (`graduatedTo: we:.github/workflows/deploy.yml`). Confirm PR #1611
  landed before splicing.

## #3361 — Arm the red-main stop-the-line
- **verdict:** OK
- **evidence:** `scripts/readiness/red-main-remediation.mjs` exists; nothing writes the freeze marker.
  Both premise items resolved as stated (#2681, #3347). Card is explicitly operator-deferred
  ("DEFERRED BY THE OPERATOR 2026-08-26") — arguably should carry `dateParked`.

## #3388 — verify-lane's shellQuote has no adversarial test
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** the gap is real (`shellQuote` at `scripts/lib/verify-lane-gate.mjs:55` is used at :102
  and :106 to splice diff-derived paths into a string later run via `execSync`, and no test in
  `scripts/lib/__tests__/verify-lane-gate.test.mjs` feeds it a metacharacter). But two numbers drifted:
  the card cites `we:scripts/lib/verify-lane-gate.mjs:22` (actual **:55**) and *"all 8 existing tests"*
  (the file now has **16**).
- **suggested action:** edit card — fix the line ref and the test count.

## #3389 — verify-lane's diff-driven gate ignores a dirty tracked working tree
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** the defect is unchanged — `resolveDefaultGate` computes only from the git diff and never
  reads the working tree; no `porcelain`/`dirty` check anywhere in
  `scripts/lib/verify-lane-gate.mjs`. But the card's line ref
  `we:scripts/lib/verify-lane-gate.mjs:24` is stale — `resolveDefaultGate` is at **:94**.
- **suggested action:** edit card — fix the line reference.

## #3392 — lane-pool-reap-on-acquire test case 3b flakes
- **verdict:** OK (unverifiable)
- **note:** the test file exists and case 3b is unchanged. The card's "no code delta to bisect" claim
  rests on `scripts/lane-pool.mjs` being unchanged since `0709df10` — that is **no longer true**:
  three later commits touched it (`9f1a95b` #x3jmao3 bounded acquire retry/backoff, `8dd490a` and
  `4a75f13` #3466 lane-ports registry). Whether they affect 3b is unknown. Also #3411 (a sibling
  TTL-backdating flake in the same area) has since resolved by widening gh/git bounds to 20s — worth
  checking whether it incidentally fixed this. Cited SHAs unresolvable in this shallow clone.

## #3407 — lane-pool: refused acquire guards leave the lease reassigned
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** the defect is unchanged — `scripts/lane-pool.mjs:1085-1093` calls `fail()` after
  `tryClaimLane` (:826) has already reclaimed and re-marked the lease, with no restore path. But both
  cited line numbers have drifted: `:1044` (explicit-lane path) is now ~**:1085**, and `~:1108`
  (auto-pick) is now ~**:1163**. Blockers-in-prose #3390 and #2924 are both still open.
- **suggested action:** edit card — refresh the two line references.

## #3408 — Enforce lockstep between vitest.config.ts exclude and vitest.integration.config.ts include
- **verdict:** OK
- **evidence:** both config files exist; no lockstep rule or test anywhere in
  `scripts/check-standards*.mjs` or `scripts/__tests__/`.

## #3409 — Gate on slow individual tests, not test-file size
- **verdict:** OK
- **evidence:** `scripts/dev/report-slow-tests.mjs` exists with no `--fail-over-ms` / threshold flag;
  `scripts/__tests__/stdout-flush.test.mjs` (the cited evidence file) exists. Precedent items #2681
  (resolved) and #2967 (active) both real.

## #3410 — Bounded-child-process timeout flaky under the full unsharded local suite
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** the card prescribes *"Fix the bound (widen it, or scale the wait proportionally)"* — but
  **that fix was already applied once**, by a card the filing does not cite:
  `backlog/3011-fix-the-load-flaky-symlink-cycle-test-in-sync-skills-deploy-.md` (bornAs `xhxuo1e`,
  `status: resolved`, dateResolved **2026-08-08**) describes the identical symptom on the identical test
  ("blocker-2 … SIGTERM-killed by its own time bound under load"). The widening is in the tree with a
  comment naming it: `scripts/__tests__/sync-skills-deploy.test.mjs:366-370` — *"20s, not 5s: under a
  full parallel suite run … (three consecutive gate reds, 2026-08-08, #xhxuo1e)"*, `timeout: 20_000`,
  test-level `30_000`. #3410 was filed 2026-08-30, i.e. **after** that widening, so it is a recurrence
  at the new bound, not a fresh discovery — and "widen it" is a fix already known not to hold.
- **suggested action:** edit card — cite #3011, note the bound is already 20s/30s, and re-scope toward
  the proportional/load-aware option (or serialization) rather than another widening.

## #3413 — closing-session step 3e's auto-release silently no-ops with 2+ lanes
- **verdict:** OK
- **evidence:** verified exactly as described — `skills-src/closing-session/SKILL.md:439-450` builds only
  `{ lane, head, clean, behind, ahead }` (no `lease.holder`), and :469 releases via
  `node scripts/lane-pool.mjs release --lane=<N> --json` with no `--session=`.
  `scripts/lane-pool.mjs:1407-1409` confirms the `contested` refusal path the card names.

## #3414 — closing-session step 3e's ahead-check snippet has no error handling
- **verdict:** OK
- **evidence:** verified — `skills-src/closing-session/SKILL.md:445` is a bare
  `execFileSync('git', [...,'rev-list','--count',...])` inside a `.map()` callback with no try/catch,
  unlike `scripts/lane-pool.mjs`'s `tryGit`-wrapped `laneDirtyOrAhead` (:592).

## #3415 — lane-pool release should refuse to drop a lease whose lane is ahead of origin
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** defect unchanged — `cmdRelease` runs `assertReleaseReservedScoped`, reserved-lease,
  ownership and contested-lease checks, then drops the lease; it never calls `laneDirtyOrAhead`. But the
  card's line ref *"cmdRelease, ~line 1288"* is stale: `cmdRelease` is at **:1352** (:1282 is now
  `cmdReleaseAllPools`).
- **suggested action:** edit card — fix the line reference.

## #3417 — verify-lane default gate: bound check:standards to a core cap
- **verdict:** OK
- **evidence:** `scripts/check-standards.mjs` has no `--max-workers` flag, no
  `WE_CHECK_STANDARDS_MAX_WORKERS` env read, and no `worker_threads` usage.

## #3424 — dispatch-abort: CLI-integration test for bare --trust refusal
- **verdict:** OK
- **evidence:** verified precisely — `scripts/operations/dispatch-abort.mjs:178` exports
  `requireTrustDir`, called at the CLI site :192; `scripts/operations/__tests__/dispatch-abort.test.mjs`
  tests it only as a pure function (:110-119) and its own comment at :113 says the guard *"used to live
  only inside the `IS_CLI` block, which a unit test can never make true."* No subprocess test exists.
  The subprocess-pattern reference `scripts/operations/__tests__/wake-cli.test.mjs` exists.

## #3430 — rust-scan citation_check: context_around counts chars, JS counts UTF-16
- **verdict:** OK
- **evidence:** verified in source — `scripts/rust-scan/src/citation_check.rs:68-74 context_around`
  builds `let chars: Vec<char> = flat.chars().collect()` and slices by char index. The parity test file
  `scripts/__tests__/rust-scan-citation-check-parity.test.mjs` exists.

## #3431 — rust-scan backlog_meta: invalid-UTF8 file drops corpus-wide metadata
- **verdict:** OK
- **evidence:** verified — `scripts/rust-scan/src/backlog_meta.rs:97`
  `let content = fs::read_to_string(&path).ok()?;` (skip-on-decode-failure), vs JS's lossy
  `readFileSync(path,'utf8')`.

## #3432 — rust-scan citation_check: \b is Unicode-mode, JS reference is ASCII-only
- **verdict:** OK
- **evidence:** verified — `citation_check.rs:157` (`locus_re`), `:226` (`hash_ref_re`), `:230`
  (`file_link_re`) all use `\b` with no `(?-u)` and no ASCII-only boundary.

## #3455 — fetchPrStates in lease-reaper.mjs has no gh timeout
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** defect confirmed — `scripts/conveyor/lease-reaper.mjs`'s `fetchPrStates` calls
  `execFileSync('gh', args, { encoding:'utf8', stdio:[...] })` with no `timeout`. But the card's
  *"(line ~258)"* is stale: `function fetchPrStates` is at **:413** and the unbounded call at **:419**.
  #3411 is resolved as the card assumes.
- **suggested action:** edit card — fix the line reference.

## #3471 — Wire the Playwright visual-capture pass into the #3461 admission queue
- **verdict:** OK
- **evidence:** blocker #3461 is now **resolved** and its deliverable exists
  (`scripts/readiness/heavy-admission.mjs`, wired into `scripts/verify-lane.mjs`), so this is unblocked.
  `plateau-app/tests/visual/capture.mjs` exists and has **zero** `heavy-admission`/`acquire` references —
  the gap is exactly as described. #3456 is real.

## #3493 — decideReviewGate must require redteam:accepted before an engine-tier auto-land
- **verdict:** OK
- **evidence:** all three claims re-verified: (a)
  `scripts/lib/review-escalation.mjs:42` — the `redteamAccepted` comment does say
  *"enforcement (requiring it before an engine-tier auto-land) is #2412's concern"*; (b)
  `decideReviewGate` (:2137-2141) takes no redteam parameter; (c) the only `gh pr edit --add-label
  redteam:accepted` procedure is prose in `skills-src/drain/SKILL.md` (mirrored in
  `scripts/lib/review-skill-guard.mjs:51-54`) — no `.mjs` writes it. Blocker #2410 is still open.

---

## OK (no further notes)

- #2870 OK · #2872 OK · #2874 OK · #2889 OK · #2894 OK · #2912 OK · #2913 OK · #2915 OK · #2917 OK ·
  #2966 OK · #2988 OK · #2992 OK · #3163 OK · #3229 OK · #3274 OK · #3291 OK · #3294 OK · #3295 OK ·
  #3408 OK · #3409 OK · #3413 OK · #3414 OK · #3417 OK · #3424 OK · #3430 OK · #3431 OK · #3432 OK ·
  #3493 OK · #556 OK · #557 OK · #2571 OK · #2636 OK · #2547 OK · #2422 OK · #2430 OK · #2459 OK ·
  #2460 OK · #2461 OK · #3017 OK · #3121 OK · #3130 OK · #3359 OK · #3361 OK · #3471 OK · #2239 OK ·
  #2240 OK · #2919 OK · #2918 OK · #2891 OK · #2642 OK · #3040 OK · #2970 OK · #3005 OK · #3157 OK ·
  #3167 OK · #3170 OK · #1259 OK · #2090 OK · #3392 OK
