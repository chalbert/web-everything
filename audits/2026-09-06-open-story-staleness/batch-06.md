# Batch 06 — staleness audit (10 cards)

Summary (verdict counts):
- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 7 (#2512, #2572, #2884, #3000, #3009, #3021, #3054)
- STALE-PREMISE: 0 (#2884 is borderline — see its block)
- DEAD-REFS: 0 standalone (2 stale `blockedBy` edges reported inside #2512 and #3054)
- OK: 3 (#3038, #3064, #3348)

All verification done read-only against `/home/user/web-everything` @ `05e5f4c` (origin/main tip) and
`/home/user/plateau-app` @ `afe639d`.

---

## #2512 — Migrate plateau-app routes into per-product subtrees (extraction-ready)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Work genuinely not done — `plateau-app:index.html` still carries the flat routes
    (`route:link="/apps"`, `/intent-configurator`, `/explorer-runs`, `/backlog`, `/brand-library`,
    `/web-docs`, …; 26 renaming links exactly as the card counts), and `<template route="/console-ruling">`
    / `"/console-micro"` are at index.html:528/536. So the body is substantively current.
  - **Stale machine-readable edge:** frontmatter still says `blockedBy: ["2510"]`, but
    `/home/user/web-everything/backlog/2510-*.md` is `status: resolved` — the card's own prose already says
    "`blockedBy: ["2510"]` is now satisfied (#2510 resolved 2026-07-15)". The frontmatter contradicts the body
    and is the half a dispatcher reads.
  - Line-ref drift in the consumer sweep (everything else spot-checked exact):
    - "`updateBreadcrumb` labels map keys (`src/main.ts:295-319`)" → `updateBreadcrumb` is now at
      `plateau-app:src/main.ts:291`, labels map starts ~:296.
    - "~25 `if (path === '/old') tryMountX()` conditionals in the `route-change` listener
      (`src/main.ts:398-430`)" → the listener is now at `plateau-app:src/main.ts:384`.
    - Still exact: `PRODUCT_ROUTES` at `src/main.ts:268`, `PUBLIC_ROUTES` at `:263`, the two hand-built hrefs
      at `:449`/`:481`, `nav:section` heads at index.html:59,72,84,92,101,107, backlog-view.ts :63/:558/:560/
      :901/:919, ruling-surface.ts:228, runsPage.ts:52/:111, runsPage.test.ts:59, board.visual.spec.ts:45,
      mount.test.ts:247/:260/:603, ruling-surface.test.ts:331. Every `scope:` path exists.
    - Every FrontierUI router citation re-verified and still true: `frontierui:blocks/router/types.ts:182-190`
      (no `route:redirect` attr), `:448` `matchRoute`, `:540-547` `buildNavigationTarget`,
      `elements/RouteViewElement.ts:134` `connectedCallback` / `:433-436` `route-change` dispatch.
- **suggested action:** edit card — drop `blockedBy: ["2510"]` from frontmatter (blocker resolved), and
  re-point the two drifted `src/main.ts` line ranges (295-319 → ~291-320; 398-430 → ~384-420).

## #2572 — Wire the scheduled converge-and-label runner (the converge daemon)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Opening sentence "Nothing schedules it today, so it is hand-run and writes nothing" is no longer accurate:
    the R7 scheduling substrate **is on `origin/main`** — `we:scripts/converge-daemon-pass.mjs` and
    `we:scripts/converge-daemon-install.mjs` both exist (`git cat-file -e origin/main:…` passes), the npm
    aliases exist (`package.json:54-55` `converge:pass` / `converge:daemon`), and both files are registered
    `engine` tier in `we:scripts/lib/gate-config.mjs:243-254`. What actually remains is the *operator install*
    plus the "shadow runner" → converge-daemon **rename** (still undone: `we:scripts/review-runner.mjs` and
    `we:scripts/lib/review-runner-core.mjs` keep their old names, and "shadow runner" prose survives at
    `gate-config.mjs:234,246` and `scripts/__tests__/converge-daemon.test.mjs:153`). The later R7 section says
    this correctly; the header does not.
  - "The enforce flip is BLOCKED by #2864" section: **#2864 is now `status: resolved`**. The card already
    records the edge being moved to #2893 (open), but the section still reads as a live block.
  - Red-team point 2 is now factually false: "`BLAST_RADIUS` (`:78-85`) lists `.claude/skills/` but **not**
    `we:skills-src/`". `BLAST_RADIUS` is now at `we:scripts/lib/review-escalation.mjs:245-254` and its third
    entry is `/(^|\/)(skills|agent-memory)-src(\/|$)/` — the source trees ARE covered. The "Filed separately"
    follow-on has landed, which slightly weakens (does not overturn) the recorded argument for striking part 2.
  - Line drift: `producerReviewLabel` cited `:307-311` → now `:761`; `CARE_WEIGHTS`/`CARE_BANDS` cited
    `:180-190` → now `:363`/`:373`; `deriveCareLevel` contract cited `:161-167`,`:198-199` → now `:384`;
    `mutations: 0` cited `we:scripts/review-runner.mjs:257` → `:258`. `--enforce` refusal at `:197-200` still
    correct.
- **suggested action:** edit card — rewrite the header sentence ("the substrate shipped; what remains is the
  operator install + the rename"), mark the #2864 section historical (resolved, edge lives on #2893), and add
  a note that BLAST_RADIUS now covers `skills-src`.

## #2884 — Acceptance coverage keys on head-SHA identity so a no-op rebase invalidates a valid review
- **verdict:** STALE-INFO (borderline STALE-PREMISE / possibly ALREADY-DONE — do not close without an operator check)
- **confidence:** medium
- **evidence:**
  - The card's premise sentence — "`acceptanceCoversHead` compares sha identity" — no longer describes the
    code. `acceptanceCoversHead` (`we:scripts/lib/review-escalation.mjs:1490-1535`) now has **two content
    escapes after the SHA test**: the `#x169fqe` reviewed-diff escape (`:1499-1517`, "a content-preserving
    rebase, the acceptance still covers this tree") and the `#x9xqexm` contribution escape (`:1518-1530`).
  - Both are wired end to end: `we:scripts/review-set-label.mjs:989-990` stamps `buildReviewedDiffMarker` +
    `buildReviewedContributionMarker` on an accept, and the drain reads them back and feeds
    `decideReviewGate({… acceptedDiff, acceptedContribution …})` at `we:scripts/merge-ai-prs.mjs:4053`.
  - Tests exist for exactly the livelock shape the card's DoD asks for:
    `we:scripts/lib/__tests__/review-escalation.test.mjs:892` ("#x169fqe — an accept survives a
    CONTENT-PRESERVING rebase") and the PR #1100-shaped case at `:1071`.
  - The docblock reconciliation the card's DoD bullet 2 asks for is also written
    (`review-escalation.mjs:1505-1509`, "WHY THIS IS NOT A LOOSENING OF #2409").
  - **Counter-evidence for not closing it:** its parent #3054's 2026-08-10 banner explicitly says "What is
    still owed here: `#3021` (now wider) and `#2884` (the caller)", and #3054 treats #2884's DoD as the
    umbrella's acceptance bar. #2979 (the content-equivalence card, `bornAs: x169fqe`) is still `status:
    active`, so this line of work is not declared finished.
- **suggested action:** edit card at minimum (its "compares sha identity" framing and the "obvious fix is not
  free" options are written against a pre-#2979 codebase that no longer exists); then have the operator decide
  whether the residual convergence bar is met — it looks met for the benign-rebase case, which was the whole
  motivating incident (PR #983).

## #3000 — review-runner passes no signals to the disposition judge
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - The defect is **still real**: `we:scripts/review-runner.mjs:182` still calls
    `runnerShadowPlan({ ledger, config, currentLabels: item.labels })` with no `signals`; `signals = {}`
    default at `we:scripts/lib/review-runner-core.mjs:107`; `proposeDisposition`'s three hard invariants at
    `we:scripts/lib/disposition-judge.mjs:243-247` still unreached; no `signals`/`gateSelf` reference in either
    test file (grep returns nothing). Not done.
  - Cross-reference block is out of date: it says #3009's fix "needs `authorId`/`clearerId` to exist as
    `runnerShadowPlan` parameters at all, which only PR #1100 adds" — **they exist on `main` today**
    (`review-runner-core.mjs:107` takes `authorId, clearerId`; `we:scripts/lib/review-independence.mjs` exists;
    rail 4 at `we:scripts/lib/auto-land-seam.mjs:153`). #2844 is `resolved`.
  - Same block calls #3008's target "shipped by PR #1113, **not yet on `main`**" — `we:scripts/converge-daemon-pass.mjs`
    is on `origin/main` and #3008 is `status: resolved`.
  - Line drift across the citations (symbols all still present): `review-runner.mjs:181` → `:182`;
    `review-runner-core.mjs:101` → `:106/:107`; `mutations: 0` `:257` → `:258`;
    `gate-config.mjs:221-222` → the two roster entries at `:217-232`; `scoreEscalation`
    `review-escalation.mjs:300` (and `:542` in the prep) → `:578`; `partitionAgentClearable` `:791-804` →
    `:894`; `NEGOTIATION_ROUND_CAP` `jury-core.mjs:538` → `:986`; `MANDATORY_LENSES` `jury-core.mjs:675` →
    `:1137`; `JURY_EVENT_TYPES` `jury-core.mjs:914-920` → `:1413`; `summarizeLedger`
    `review-runner-core.mjs:137` → `:123`. `disposition-judge.mjs:229` and `strictestLensVerdict`
    (`review-runner-core.mjs:45`) are still exact.
- **suggested action:** edit card — refresh the cross-references (#2844/#1100 landed, #3008 resolved and on
  main, so the "not yet on main" caveats go) and refresh the line numbers, or replace bare line cites with
  symbol names. Work itself stays open and is still buildable today.

## #3009 — runShadowPass passes no authorId/clearerId to runnerShadowPlan
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - The gap is **still real and now live**: `we:scripts/review-runner.mjs:182` passes neither id;
    `we:scripts/lib/auto-land-seam.mjs:153-161` runs `decideClearerIndependence` and returns
    `reason: 'self-clear-refused: …'` while echoing `action: intent.action`; `buildShadowRecord` still computes
    `const wouldClear = intent.action === LAND_ACTIONS.CLEAR` (`review-runner-core.mjs:158`). So every shadow
    line today reads `wouldClear: true` with a `self-clear-refused: unknown-clearer` reason.
  - The **title and the first ~60% of the body are stale**: "once #1100 lands", "PR #1100 (open,
    `review:human`, backlog #2844)", "This is latent, not live — … `authorId`/`clearerId` do not yet exist as
    parameters anywhere in this call chain (PR #1100 has not merged)". #2844 is `status: resolved` and
    `we:scripts/lib/review-independence.mjs` is on main. The card's own 2026-08-09 note already corrects this
    ("**Correction, same day — this is LIVE now, not latent**") but the header/"What this is NOT" sections were
    never updated, so the card contradicts itself for any reader who stops early.
  - Prose claims "keeps this item's blocker explicit (`blockedBy: ["2844"]`)" and the verification bullet says
    the same — but the **frontmatter carries no `blockedBy` field at all**. Harmless direction (nothing is
    falsely blocked), but the body describes frontmatter that isn't there.
  - Line drift: `review-runner.mjs:181` → `:182`; `buildShadowRecord` cited `:148-179` → `:147-183`.
- **suggested action:** edit card — retitle/rewrite the header and "What this is NOT" to the LIVE framing the
  in-card correction already establishes, and drop the `blockedBy: ["2844"]` prose. Priority arguably rises:
  this is now degrading the soak record in production.

## #3021 — The contribution fingerprint still collides on an intra-section relocation
- **verdict:** STALE-INFO (line-drift only; substance verified current)
- **confidence:** high
- **evidence:**
  - Substance holds: `normalizeContributionFingerprint` (now `we:scripts/lib/review-escalation.mjs:1192+`)
    hashes hunk lengths + context-run lengths and emits no absolute offset and no `@@` heading; the residual is
    still pinned by `we:scripts/lib/__tests__/review-escalation.test.mjs:1325` ("THE KNOWN RESIDUAL, pinned at
    its WIDENED width: any offset-only relocation collides (#x413mbt)"). The WIDENED banner is accurate.
  - Not built: neither `shouldReattributeRebase` nor `buildRebaseReattributionComment` exists anywhere in
    `we:scripts/` (grep: no hits), so the 2026-08-15 decided design is still entirely ahead.
  - Line drift in the 2026-08-15 prep (files have grown ~100 / ~680 lines since):
    `normalizeContributionFingerprint` cited `review-escalation.mjs:1089-1157` → now `:1192-1260`ish; the
    hunk-header projection `:1131` and context-run projection `:1145-1151` shift accordingly; the pinned test
    cited `:1198-1236` → `:1325+`; `buildReviewedShaMarker` cited `:820` → `:923`; `ledgerCoversHead` cited
    `verdict-ledger.mjs:493-503` → `:579`; the `decideReviewGate` call site cited `merge-ai-prs.mjs:3373` →
    `:4053`; the rebase-drop-precedes-escalation cite `:2996-3072`/`:3103+` and the `c.rebaseDrop === 'rebased'`
    cite `:3710-3715` → now `:4431`; the import line cited `merge-ai-prs.mjs:113` needs re-checking.
- **suggested action:** edit card — refresh the prep's line citations before anyone builds from them (the
  design and every symbol name are still correct).

## #3038 — Promote the jury ledger from a working-tree sidecar to a shared store
- **verdict:** OK
- **confidence:** high
- **evidence:** every claim re-verified: `juryLogDir()` still resolves `<root>/.conveyor/jury` with
  `CONVEYOR_JURY_DIR` the only override (`we:scripts/lib/jury-ledger.mjs:71`, JSDoc `:64-70` — the card cites
  `:70`, one line off); `.conveyor/jury/` still gitignored (`we:.gitignore:71`); the compensations it says
  should be deleted both still exist — `we:scripts/converge-daemon-pass.mjs:73,277` wires
  `CONVEYOR_JURY_DIR` from `CONVERGE_DAEMON_JURY_DIR`, and `installBlockers`
  (`we:scripts/converge-daemon-install.mjs:139,156-158`) refuses/warns when the ledger dir is missing.
- **suggested action:** none.

## #3054 — The acceptance-coverage digest re-parks a cleared PR whose contribution never changed (epic)
- **verdict:** STALE-INFO (+ one stale `blockedBy` edge)
- **confidence:** high
- **evidence:**
  - **`blockedBy: ["3053"]` is stale — `#3053` is `status: resolved`.** This epic is machine-readably blocked
    by a resolved item; its "What is deliberately NOT in scope" section still describes #3053 as a live fork
    gating the epic. (The build side it points at, #3024, is still open.)
  - Banner accurate: #3046 and #3052 are both `resolved`, and the digest repair is on main
    (`normalizeContributionFingerprint` carries neither the gap nor the heading).
  - The **Slices table is incomplete**: `#3064` was filed 2026-08-10 with `parent: "3054"` but appears nowhere
    in this card (grep for "3064" → 0 hits). A reader costing the umbrella misses a slice.
  - `relatedReport: reports/2026-08-09-backlog-consolidation-analysis.md` exists — confirmed.
  - Its assessment of what's left (#3021 + #2884) is consistent with the code, though see #2884's block above:
    #2884's own body is now written against a superseded version of `acceptanceCoversHead`.
- **suggested action:** edit card — clear `blockedBy: ["3053"]` (resolved), add #3064 to the Slices table, and
  re-word the #3053 paragraph as settled rather than gating.

## #3064 — The digest repair's corpus figures ship without the script that produced them
- **verdict:** OK
- **confidence:** high
- **evidence:** `we:scripts/measure-contribution-digest.mjs` still does not exist (and nothing references it);
  the comparator it cites, `we:scripts/measure-judge-spawn.mjs`, does exist; the 16/201/181 figures are still
  written into `#3054`'s banner ("5 false stales before, 0 after"), so the uncitable numbers still stand in the
  cards exactly as the item says. The `RIDE_IN` adversarial fixture it credits is still in
  `we:scripts/lib/__tests__/review-escalation.test.mjs`.
- **suggested action:** none.

## #3348 — Take check:standards and shard imbalance off the per-PR CI critical path
- **verdict:** OK
- **confidence:** high
- **evidence:** `we:.github/workflows/ci.yml` still runs `check:standards` inside the aggregating `test` job
  (`:135` "runs the repo health gate (check:standards — unsharded…)", job `test` at `:141`, `needs: test-shard`
  at `:142`), and the shard matrix is still `shard: [1, 2, 3, 4]` (`:78`) with no rebalancing mechanism. No
  separate `check-standards` job exists. `#3347` is now `resolved`, which only strengthens the card's own
  "Independent of the batch-gate decision 3347" note.
- **suggested action:** none (the `Done when` section is still a literal `TODO`, but that is unfinished
  authoring, not staleness).
