# Batch 16 — staleness audit (24 open cards, web-everything)

- **ALREADY-DONE:** 2 (#3494, #2953)
- **SUPERSEDED:** 0
- **STALE-INFO:** 12 (#3271, #3284, #3345, #2885, #3102, #3006, #872, #876, #907, #315, #2129, #3093)
- **STALE-PREMISE:** 0
- **DEAD-REFS (primary):** 1 (#236) — plus secondary DEAD-REFS on #2935, #3284, #3102
- **OK:** 9 (#2935, #3289, #3190, #3288, #3071, #2955, #3142, #237, #2903)

---

## #236 — Validation normalization + shopping devtool (adapter-as-normalization-hub)
- **verdict:** DEAD-REFS (+ STALE-INFO)
- **confidence:** high
- **evidence:**
  - The "Progress" section cites `we:adapters/eslint.mjs`, `we:adapters/oxlint.mjs`, `we:normalize.mjs`,
    `we:index.mjs`. None exists at those (repo-root) paths — `ls adapters/`, `ls normalize.mjs index.mjs`
    all fail. The real files are `/home/user/web-everything/scripts/validation-normalize/adapters/eslint.mjs`,
    `.../adapters/oxlint.mjs`, `.../normalize.mjs`, `.../index.mjs`. Only the first cite
    (`we:scripts/validation-normalize/knowledge.mjs`) is correct.
  - STALE-INFO: "with `re-export` and `shop` spun out as children" — of the three children,
    `282-…re-export…` is `status: resolved` and `284-…live-config-cli…` is `status: resolved`;
    only `283-…shop-leg…` remains, and it is `status: parked`. `scripts/validation-normalize/reexport.mjs`
    and `live-config.mjs` both exist on disk. So this epic's entire remaining work is one parked child.
- **suggested action:** edit card — repoint the four paths to `we:scripts/validation-normalize/…`; add a
  progress line that #282/#284 landed and only the parked #283 remains (then consider parking the epic).

## #315 — Competitive coverage gap analysis program
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - "graduating to a scheduled sweep (**#367, blocked on #192**) only once it proves stable" and the Status
    section's "**#367** scheduled refresh (blocked on #192 + #366)". `backlog/367-*.md` frontmatter is
    `blockedBy: []`, `status: parked`, `parkedReason: maturityGated`, `maturityTrigger: "realRuns>=3"`.
    #192 (`resolved`) and #366 (`resolved`) are both closed — neither is a blocker any more.
  - The "Status (2026-06-12) … its live children are now:" list is entirely closed except #367:
    #358 resolved · #359 resolved · #360 resolved · #361 resolved · #362 resolved · #363 resolved ·
    #364 resolved · #352 resolved · #366 resolved. Nothing in that list is live.
  - Still accurate: all five phase children resolved; `src/_data/researchTopics/benchmark-corpus.json`,
    `benchmark-capabilities.json`, `benchmark-coverage.json` (plus `benchmark-corpus-source-currency.json`)
    exist; the `/gap-sweep` re-run skill exists.
- **suggested action:** edit card — rewrite the Status section with a current live-children list
  (only #367, maturity-gated on realRuns>=3) and drop the "blocked on #192/#366" wording in both places.

## #237 — Inter-module communication contracts as Protocols
- **verdict:** OK
- **confidence:** medium
- **evidence:** All refs resolve (#150 resolved, #140 resolved, `platform-decisions.md#project-protocol-bar`
  present). Still `childlessReason: blocked` with no `blockedBy` edge, consistent with the card's own text.
  Could not independently confirm the claim "that substrate has no single owning item yet" — left as-is.

## #872 — Constellation contract distribution via WE-published type-only packages
- **verdict:** STALE-INFO (minor)
- **confidence:** medium
- **evidence:** "Byte-copies (incl. **#834/#836** guard) migrate to package imports **once this lands**" —
  that migration already happened without the epic landing: #875 ("Migrate FUI byte-copied contracts to
  @webeverything/contracts imports") is `resolved`, and FUI consumes the scoped specifier today via
  path-mapping (`/home/user/frontierui/tsconfig.json:51-60`, `vite.config.mts:263+`). #834, #836, #694,
  #170, #239, #700 are all `resolved`; both `platform-decisions.md` anchors exist.
- **suggested action:** edit card — note that the byte-copy retirement (#875) already landed on the dev-time
  path-mapping, so what remains under this epic is publication + pinning (#907/#876), not migration.

## #876 — Contract version-skew drift gate
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The "Still blocked after #877" note asserts "the package is still **`0.0.0`** (unpublished)".
  `contracts/package.json` now reads `"version": "0.1.0"` and `.release-please-manifest.json` is
  `{"contracts": "0.1.0"}`. Per #2361 (`resolved`) a `contracts-v0.1.0` tag + GitHub Release were cut
  2026-07-02; the inline `npm publish` was skipped, so the registry is still empty.
  The card's *conclusion* still holds: neither `/home/user/frontierui/package.json` nor
  `/home/user/plateau-app/package.json` declares a `@webeverything/contracts` dependency (grep: no hits),
  so nothing pins a version and the gate would still have nothing to check. `blockedBy: ["907"]` remains
  correct (#907 open).
- **suggested action:** edit card — replace "still `0.0.0` (unpublished)" with "in-tree at `0.1.0`, release
  cut but `npm publish` never fired (#2361); still E404 on the registry and still no consumer pin".

## #907 — First real publish of @webeverything/contracts + migrate a consumer
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Three stale statements, all in the `humanGate` / "Human-gate (kind: setup)" half:
  1. "**Left at `0.0.0` deliberately**" — `contracts/package.json` is `0.1.0` and
     `.release-please-manifest.json` is `{"contracts": "0.1.0"}`.
  2. The `humanGate.what` frontmatter and the "**Gate clears when**" paragraph both describe the manual
     ceremony (`npm version <x>` in `contracts/` → push a `contracts-v*` tag → the #877
     `publish-contracts.yml` pipeline). The card's own later section ("Publishing is CI-owned (decided
     2026-07-02): release-please") supersedes exactly that: "the version bump + publish are **no longer** a
     manual `npm version` + tag-push ceremony". The card contradicts itself; the frontmatter is the stale half.
  3. "this item's residual is just: **cut the first release**" — already done. #2361 (`resolved`) records
     that the 0.1.0 Release PR merged on 2026-07-02 (run 28606668569), release-please created the
     `contracts-v0.1.0` tag + GitHub Release, and the publish job was skipped by a `needs:` without
     `always()`. So the true residual is narrower: fire the one-time 0.1.0 catch-up publish, then pin FUI.
- **suggested action:** edit card — rewrite `humanGate.what` and "Gate clears when" to the release-please
  reality and the 0.1.0-catch-up-publish residual; strike "Left at 0.0.0 deliberately".

## #2129 — Gate-A external pilot adopter
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:** The 2026-08-15 prep note says "#1137 (public gated deploy; the human `DNS`/`workers_dev=false`
  step is **the sole residual**, `humanGate: deploy`)". `backlog/1137-*.md` now carries
  `blockedBy: ["3121"]`, and #3121 ("Verify existing Squarespace DNS records … survive the #1137 nameserver
  cutover") is `status: open` — so there is a second, agent-checkable residual ahead of the human step.
  #1137's own `humanGate.what` was updated to say so ("gated on #3121's DNS/email check first").
  Everything else holds: #1137 open, #2128 open (`blockedBy: ["907"]`), #907 open, #2089 resolved,
  #554 open — the item genuinely cannot start.
- **suggested action:** edit card — one-line amend of the prep note ("#1137 is itself now blocked on #3121").

## #2885 — Gate the drain's ordering context on a degraded open-PR read
- **verdict:** STALE-INFO (two of the three findings are already fixed — close to SUPERSEDED by #2989)
- **confidence:** high
- **evidence:** The fixes landed under #2989 (`status: active`, hash `xc7p3q9`), in
  `scripts/merge-ai-prs.mjs`:
  - **F3a is fixed.** `reduceOpenPrContext` (`:1195-1227`) now tracks `listingFailed` — "`if (entry &&
    entry.failed) listingFailed = true; // #xc7p3q9 (B2) — a swallowed \`gh pr list\` throw`" — and computes
    `contextComplete = !!reconcileRan && !listingFailed && !listingTruncated && !anyDegraded`, which the
    couple gate reads to fail closed. A total listing loss is no longer classified healthy. There is also a
    stderr line `⚠️ FAILED open-PR listing … treats the open-PR context as INCOMPLETE this pass` (`:3277`).
  - **F3c is fixed.** The same docblock: "`reconcileRan:false` (a bare `/merge` sweep or
    `--no-reconcile-labels`, where the context is never collected) is INCOMPLETE by construction (B3)".
  - **F3b is half-fixed.** The card says the `truncated` flag "is read by NOBODY — it never reaches the
    pass's `result` object either". First half is now false: it is threaded into
    `joinImplToCouples(vs, { …, truncated: !!ctx.truncated, contextComplete: … })` (`:1461`) and
    `carrierDeferDecision` (`:1100-1106`, `if (truncated) return { defer: true, reason: 'truncated' }`).
    Second half is still true: `runCli`'s JSON `result` (`:4657`) carries no `truncated` / `contextComplete`
    key, and both `onListingFailed` / `onListingTruncated` warnings remain `if (!AS_JSON)`-gated.
- **suggested action:** edit card — strike F3a and F3c as delivered by #2989/xc7p3q9 (cite
  `reduceOpenPrContext`'s `listingFailed`/`contextComplete`), and re-scope the card to the F3b residual:
  surface `truncated`/`contextComplete` in the `--json` result the `/drain` skill consumes.

## #2903 — Hash-ref rewrite reads only the drain clone's local ledger
- **verdict:** OK
- **confidence:** high
- **evidence:** `applyLedger` (`scripts/backlog/id.mjs:144-145`) still opens
  `const entries = Object.entries(ledger).filter(…)` and rewrites from the ledger alone;
  `numberPendingHashes` (`scripts/lane-drain.mjs:704`) still passes only `ledger`.
  `landedNumberFor` is defined at `scripts/lane-drain.mjs:785` and used only by `merge-ai-prs.mjs`
  (`provenOnMain`, `:116/:1520/:1585`) and tests — never in the rewrite path. All three `relatedTo`
  refs (#2288, #2392, #2428) resolve and are `resolved`. Scope paths all exist.

## #2935 — Blast-radius must cover every file the required check's RESOLUTION depends on
- **verdict:** OK (+ DEAD-REFS)
- **confidence:** high
- **evidence:** Work is genuinely undone. `BLAST_RADIUS` (`scripts/lib/review-escalation.mjs:245-254`) still
  registers only `^scripts/`, the two agent-behaviour tree anchors, `.githooks/`, `.github/`,
  `STATUTE_PATHS`, `src/_data/*.json` and `CONFORMANCE_GRADING_PATHS`. Grep for `package-lock`,
  `vitest.workspace`, `playwright.config` in that file: **no matches**. No `vitest.workspace.*` file exists.
  The card's CI facts re-check out: no workflow `run:` line invokes `npm test`
  (`.github/workflows/ci.yml` uses `test:coverage:shard`, `coverage:merge`, `check:standards`,
  `test:interaction`), and the `visual` job is still `if: ${{ false }}` (`ci.yml:408`).
  **DEAD-REF:** the `scope:` list names `we:scripts/__tests__/check-standards-rules.test.mjs`, which does not
  exist — the rules tests were split into six files
  (`check-standards-rules-{backlog-integrity,conformance-gates,content-lint,githook-flags,lock-point-and-exports,registry-validators}.test.mjs`).
- **suggested action:** edit card — repoint the scope's test path to whichever of the six split files the new
  rule belongs in (most likely `check-standards-rules-content-lint.test.mjs`).

## #2953 — The /review skill's documented call sequence fails on first use
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** All three papercuts are fixed in `scripts/review-set-label.mjs` / `scripts/lib/review-core.mjs`:
  1. **body-file path guard** — `bodyFileRoots` (`:406`) is now `[cwd, tmp, '/tmp']`, and
     `checkBodyFileLocation` (`:380-402`) resolves symlinks **on both sides**, resolving the deepest existing
     ancestor and rejoining the missing tail. Its docblock names this exact incident: "`/tmp` is itself a
     symlink to `/private/tmp` there, so even naming the real temp dir could be refused on SPELLING… an agent
     session scratchpad [was refused]". Landed under #2897 (`resolved`).
  2. **notice outcome vocabulary** — `scripts/lib/review-core.mjs:1329/1355/1357`:
     "`#2953` — `outcome` ALSO accepts `'accepted'` (normalized to `'accept'`)", with
     `const normalizedOutcome = outcome === 'accepted' ? 'accept' : outcome;`.
  3. **PR-state guard** — `scripts/review-set-label.mjs:579/:607`: "`#2953` — `state` rides the SAME call
     (one more json field, no extra hop)" and "`#2953` — FAIL CLOSED on anything but an OPEN PR", with the
     gate re-named at `:780`.
- **suggested action:** resolve (verify the `/review` SKILL.md steps read cleanly, then close).

## #2955 — Lane-instructing docs tell agents to pick a lane without leasing it
- **verdict:** OK
- **confidence:** high
- **evidence:** Every fact re-measured and still exact. `docs/agent/backlog-workflow.md:556` still carries
  "`node we:scripts/lane-pool.mjs status --json` → pick a clean lane". All six skills still carry one
  occurrence each, **at the exact lines the card's table states**: build-ui 16, new-demo 15, new-standard 14,
  exercise-app 15, next-backlog-item 24, prepare-decision-item 23. The two template skills are still at the
  cited lines (`drain/SKILL.md:54`, `merge/SKILL.md:23`). No `check:standards` rule forbids the form
  (no hit for `lane-pool.mjs status` in `check-standards-rules.mjs` / `check-standards.mjs`).
  All `relatedTo` refs (#2267, #2882, #2452) resolve.

## #3006 — Move agent work onto the Claude Code CLI and optimise what it costs
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The "second forcing function is **coming, not yet in force**" section is now false in every
  particular:
  - "**#2844** (open, filed 2026-08-02)" — `backlog/2844-*.md` is `status: resolved`,
    `dateResolved: "2026-08-08"`.
  - "its implementation is PR #1100, which is open and awaiting a human clear" — the seam has landed.
  - "**Nothing** in `we:scripts/review-set-label.mjs`, `we:scripts/lib/review-escalation.mjs`,
    `we:scripts/merge-ai-prs.mjs` or `we:scripts/pr-land.mjs` compares reviewer to author today, so no clear
    is refused on those grounds yet" — `scripts/review-set-label.mjs:632` ("ONLY `--to=accepted` … is
    REFUSED, and only on a PROVEN self-clear"), `:1195` (`'self-clear' on two equal ids`), and the whole of
    `scripts/lib/review-independence.mjs` now do exactly this, keyed on `CLAUDE_CODE_SESSION_ID`.
  - Consequently "the argument for doing this work **before #1100 merges**, not after" is moot.
  - The epic has no children (`grep -l 'parent: "3006"'` → 0 files), so the research/sweep body is still
    unowned work — the card itself stays valid.
  - Not re-verified: the 2026-08-08 cost table and the claim that the drain daemon runs with no
    `CLAUDE_CODE_SESSION_ID`.
- **suggested action:** edit card — rewrite the forcing-function section in the past tense (#2844 landed
  2026-08-08; the self-clear refusal is live and subagents inheriting the parent session id now genuinely
  disqualify a subagent reviewer), which strengthens rather than weakens the case for the CLI move.

## #3071 — Fold the design effect into the standard error
- **verdict:** OK
- **confidence:** high
- **evidence:** `scripts/lib/gate-health.mjs:88-111` — `clusterEffectiveN` still sets
  `const effectiveN = sizes.length ? sizes.length : 0;` (distinct sources = the fully-correlated
  assumption the card names) and `clustered: n > 0 && effectiveN < n`; `:273` still consumes it as a
  hard blocker. No design-effect / `deff` / `√deff` term anywhere in the file. The 2026-08-13
  "ATTEMPTED AND STOOD DOWN" note is consistent with the tree.

## #3093 — Four findings the round-4 review left on the accepted estimator fix
- **verdict:** OK (work live) + STALE-INFO (its citations into #3090 have drifted)
- **confidence:** high
- **evidence:** All findings still reproduce in `scripts/lib/gate-health.mjs`:
  - F1 — `const sizeableMdd = requiredNPerGroup(0, mdd) !== null;` is still at `:329`, with the same
    "`baseRate: 0` is the canonical probe" comment above it.
  - F2 — the "`d * d` underflows to 0 below about `mdd = 1e-160`" claim is still at `:217`, at the guard
    comment `:254`, and the operator blocker string at `:334` still says "far enough above it that its
    square does not underflow".
  - F4 — the `d <= 0` guard is still at `:249` (`if (p + d >= 1) return null;` region unchanged).
  - Scope path `we:scripts/operations/__tests__/gate-health.test.mjs` exists (note: the module itself lives
    at `scripts/lib/`, its tests at `scripts/operations/__tests__/` — that split is real, not a typo).
  - **Stale citations:** the card pins line numbers into `backlog/3090-*.md` that have moved. The
    `smallestCell` claim it cites at `:120` is now at `:125`; the `1e-160` sentence cited at `:167-168` is
    now at `:173`; and the "canonical probe" text cited at `:174-175` no longer appears in #3090 at all
    (`grep -n "canonical probe" 3090-*.md` → no match). #3090 is now `status: resolved`.
- **suggested action:** edit card — re-derive the three `3090-*.md:NNN` pointers (or drop them for quotes),
  and note that #3090 is resolved so its card is now a historical record.

## #3102 — Run delivery on the engine: the three phases from AI-driven to AI-supervised
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:**
  - **Wrong-target ref, cited three times including a Done-when.** `[#1220]` is used throughout for
    "make `review-pr` aimable" ("`review-pr` **cannot be aimed** — `buildPanelMandate` has a `goal` slot…
    ([#1220])", and the Done-when "[#1220] lands before [#3072]"). `backlog/1220-*.md` is
    "**stress-test Claude Code skill — ask Claude in natural language…**" (`resolved`) — unrelated. The
    item this text describes is **#3094** "`review-pr` cannot be aimed, so the loop hand-rolls reviewers
    instead of using it", which is `status: resolved`.
  - The phase-A table's states have all moved: **#3072** (declare the review loop) is `resolved` — so the
    Done-when "#1220 lands before #3072" is unsatisfiable as written and moot in substance;
    **#3036** ("WE half landed; the plateau-side route outstanding") is `resolved`;
    **#2908** (editor-enablement) is `resolved`.
  - Phase B: "**#3118**, where the conveyor's headless agent-spawning lives — **the one open item**" —
    #3118 is `resolved`. #2753, #2612, #3029, #3099 remain open, so the epic's sequencing job survives.
  - #3101 is still `active`, so "the `fix` verb is not working today" is not yet disproven.
- **suggested action:** edit card — replace every `[#1220]` with `[#3094]` and mark it resolved, restate the
  phase-A table against current statuses (#3036/#3072/#2908/#3118 all closed), and re-derive the Done-when
  list (the "#1220 before #3072" bullet is now dead).

## #3142 — review:human silently re-applied after a clear-human clearance
- **verdict:** OK
- **confidence:** high
- **evidence:** The card's whole point is to add dated evidence to #2737 and argue for unblocking it.
  `backlog/2737-*.md` is still `status: open` with `blockedBy: ["2409", "2416", "2502"]`; #2409 is
  `resolved` (as the card says) and #2416 / #2502 are both still `open` — exactly the state the card
  describes. #2895 (`--to=clear-human` ceremony) and #2832 are as cited (#2832 open, now
  `blockedBy: ["2989"]`). Nothing to correct.

## #3190 — Dated records cite runtime paths that moved out of WE
- **verdict:** OK
- **confidence:** medium-high
- **evidence:** Both of the card's sharpest, checkable claims still hold exactly:
  `docs/agent/platform-decisions.md:1505` still cites
  `fui:blocks/router/elements/RouteViewElement.ts:48` for the `routes` getter, which is actually at
  **line 64** in `/home/user/frontierui/blocks/router/elements/RouteViewElement.ts`; and `:1500`/`:1511`
  still cite `…:498` for the clone site, which is actually at **line 599**
  (`renderable = templateDef.template!.content.cloneNode(true)`).
  The convention is still unsettled: `scripts/lib/citation-check.mjs:39` still reads
  `export const CITATION_GATES_ENFORCED = false;` with the `TODO(#2821)` promotion note, and #2821 is open.
  All five `scope:` paths exist. #3154/#1245/#1246 resolve; #1685/#1686/#1688/#1823/#1834 all `resolved`
  (i.e. still the dated resolved-decision records the card names).
  Not re-measured: the 474 / 41 / 70 / 26 gate-5 finding counts — those will have drifted with the corpus.
- **suggested action:** none (optionally re-run the gate-5 scan and refresh the counts when the sweep starts).

## #3271 — Carve-outs on the commit-identity guard
- **verdict:** STALE-INFO (minor) — the four defects themselves are all still live
- **confidence:** high
- **evidence:** Re-read `scripts/guard-bash.mjs` (note: `grep` reports it as binary; use `grep -a`):
  - (1) still true in effect — `hasIdentityEscape` (`:229-237`) is called with a **single segment** at
    `:1674` (`isCommitIdentityOverride(s) && !hasIdentityEscape(s)`), and `export COMMIT_IDENTITY_OK=1`
    fails its own prefix test because `export` is the first non-assignment token.
  - (2) still true — `commitIdentityCommandReason` (`:267-285`) uses `segs.some(isGitCommitSegment)` and
    `segs.some(setsIdentity)` with no ordering constraint.
  - (3) still true — `isGitCommitSegment` (`:248-251`) does
    `shellTokens(seg).some((t) => !t.op && t.text === 'commit')`, scanning `-m` values.
  - (4) still true — `hasIdentityEscape` takes the first non-`NAME=` token as the command word, so a
    `sudo`/`env` wrapper drops the escape, while `programWord` uses `canonicalCommand`.
  - **Stale statement:** finding (1) says "`reason()` tests `/\bCOMMIT_IDENTITY_OK=1\b/` against the CURRENT
    segment". No such regex exists any more — the only `\b…OK=1\b` regex left in the file is
    `/\bSTALE_LANE_OK=1\b/` (`:1671`). The escape is now a position-strict token parse
    (`argvTokens` + an `ASSIGNMENT` prefix test), which is what finding (4) correctly describes.
- **suggested action:** edit card — restate finding (1)'s mechanism as "`hasIdentityEscape` is invoked
  per-segment at the `reason()` call site, and its assignment-prefix rule rejects `export`", dropping the
  regex claim. The Done-when list needs no change.

## #3284 — Gate: a backlog filing that asserts existing code behaviour must cite file:line
- **verdict:** STALE-INFO (+ DEAD-REFS)
- **confidence:** high
- **evidence:** The "RETRACTION" section is now itself stale in the same way it was written to correct:
  - "**`#2548` gates nothing.** It is `status: open` (`we:backlog/2548-…:5`)" — `backlog/2548-*.md` is now
    `status: resolved`.
  - "`handNumberedNewItems` exists only inside that card's own body as a proposal … `grep -rn
    "handNumberedNewItems" --include=*.mjs .` (no matches)" — it now exists as a real exported detector,
    imported and exercised at
    `scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs:17` and `:301-321`
    ("`handNumberedNewItems` — the #2548 hand-numbered-new-item gate (pure detector)").
  - The card's own work is still undone (no existing-code-assertion rule in `check-standards-rules.mjs`),
    and its sibling framing holds (#3280 open, #3285 open, #3283 resolved).
  - **DEAD-REF:** `scope:` names `we:scripts/__tests__/check-standards-rules.test.mjs`, which does not exist
    (same six-way split noted on #2935).
- **suggested action:** edit card — the retraction now *supports* the card rather than undermining it:
  rewrite it to say the #2548 precedent is real and landed (cite the test file above), and repoint the
  scope's test path to one of the six split rule-test files.

## #3288 — A card's prose claim about another item's current content is never re-read
- **verdict:** OK
- **confidence:** high
- **evidence:** No such gate exists — `scripts/lib/citation-check.mjs` emits only `unresolved` /
  `escape-no-reason` / `escape-unclosed` findings (`:678/:695/:705`), and `check-standards.mjs`'s citation
  block (`:1239-1300`) handles only anchor-authority / locus-resolution / hash-slug-scope /
  memory-hash-dangling kinds. All sibling refs resolve and are correctly characterised:
  #3287 open, #3290 open, #3286 open, #3147 resolved, #3118 resolved (the founding-incident items,
  now closed, which does not affect the argument since it is a historical timeline).
  `agent-memory-src/grep-every-name-you-cite-in-prose.md` exists.

## #3289 — A file:line citation goes stale because a later hunk shifts the line
- **verdict:** OK
- **confidence:** high
- **evidence:** No implementation: same citation-check kinds as above; nothing keys on a `line N` pointer +
  adjacent quote. The comparison table's refs all resolve with the statuses it implies —
  #3286 open, #3288 open, #3290 open, #3287 open, #3280 open, #3284 open, #3285 open — and
  `agent-memory-src/grep-every-name-you-cite-in-prose.md` exists. The founding evidence is git-pinned
  (`77f69705` / `775cd30f`), so it cannot stale.

## #3345 — A malformed backlog card loads differently on every load
- **verdict:** STALE-INFO (line drift only; the defect is live)
- **confidence:** high
- **evidence:** Mechanism unchanged: `src/_data/backlog.js` still calls `matter(readFileSync(...))` with
  **no options** inside the skip-and-report try/catch, so `gray-matter`'s content cache still poisons the
  second parse. The card cites that call at `:333` and the try/catch at `:331-338`; the call is now at
  **`:339`** (there is a second uncached `matter()` at `:312` for reports). The named scope file
  `we:src/_data/__tests__/backlog-malformed-determinism.test.ts` does not exist yet (expected — it is the
  deliverable). #430 and #453 resolve as cited.
  Card-level counts have moved: it says "3308 items, then 3309"; `ls backlog/*.md | wc -l` is now **3475**.
- **suggested action:** edit card — bump the `we:src/_data/backlog.js:333` pointer to `:339`, and mark the
  3308/3309 figures as "as measured 2026-08-26" so they read as a dated repro rather than current state.

## #3494 — Parked PRs get no mechanical alert when they drift into a real merge conflict
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** All four buildable tasks exist on `main`:
  - `scripts/conveyor/parked-pr-conflict-watch.mjs` exists and exports exactly the decided API —
    `CONFLICT_LABEL = 'merge-status:conflicting'` (`:58`), `CONFLICT_LABEL_META` (`:65`),
    `isParkedConflictTarget` (`:89`), `planConflictLabelChange` (`:102`), `buildConflictComment` (`:116`),
    `defaultListParkedPrs` (`:142`), `watchParkedPrConflicts` (`:159`).
  - `scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` exists.
  - Wired into the tick: `skills-src/conveyor/runner.mjs:267`
    `runQuiet('conveyor/parked-pr-conflict-watch.mjs', ['sweep']);`, immediately after the
    `branch-drift.mjs` line (`:261`), with the rationale in the header comment at `:186-192`.
  - Git: `2c0b428 WE #xw0odtv: parked-PR conflict watch — alert when a review-parked PR drifts into a real
    merge conflict` (the commit hash matches this card's `bornAs: xw0odtv`), plus a follow-up fix
    `5d051f2 WE #xoh8fkw: fix parked-PR conflict watch -- it never actually applied its conflicting label`.
- **suggested action:** resolve (the follow-up fix #xoh8fkw suggests task 4's live-verify happened too).
