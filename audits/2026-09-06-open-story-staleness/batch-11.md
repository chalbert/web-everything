# Batch 11 — staleness audit (13 open cards), 2026-09-06

- ALREADY-DONE: 1  (#2949)
- SUPERSEDED: 0  (but #2753 is a candidate — see its block; flagged, not asserted)
- STALE-INFO: 7  (#2947, #2948, #2951, #2753, #3105, #2985, #3043)
- STALE-PREMISE: 0
- DEAD-REFS: 0 standalone (line-ref rot reported inside the STALE-INFO blocks)
- OK: 5  (#3234, #3143, #3055, #3490, #3491)

---

## #2947 — The solo-dev care profile: earned lenses, re-weighted signals, one juror
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - The card is built on a **four-lens** panel ("cuts the default panel from four seats to one or two",
    "Today every band fans out all four of `PANEL_LENSES`", and a 4-row lens table). `PANEL_LENSES` is now
    **five**: `we:scripts/lib/jury-core.mjs:1181` = `[...MANDATORY_LENSES, ...ADVISORY_LENSES]` where
    `MANDATORY_LENSES` (`:1137`) = correctness + security and `ADVISORY_LENSES` (`:1141-1145`) = simplicity,
    standards-conformance, **claim-accuracy** (added by #3314, resolved 2026-08-26). Every band in
    `we:scripts/lib/review-policy.contract.json` (lines 126-152) lists all five. The card's lens table has no
    row for `claim-accuracy`, so the "which lenses are earned" design is incomplete as written.
  - Everything else the card asserts is still true and unbuilt: no `profiles`/`activeProfile` key exists in
    `we:scripts/lib/review-policy.contract.json`; `CARE_WEIGHTS.blastRadius` is still `3`
    (`we:scripts/lib/review-escalation.mjs:366`); `PR_DIFF_ADAPTER.mandatoryLenses` is still the frozen
    constant (`we:scripts/lib/review-core.mjs:1003`); `panelRigorForCareLevel` still reads an inline
    `rigorByLevel` literal (`we:scripts/lib/jury-core.mjs:1211-1218`); `jurorsPerLens` is still 2 at `high`.
- **suggested action:** edit card — replace "four lenses"/"four seats" with five throughout, and add a
  `claim-accuracy` row to the "when it sits" table (it is advisory-on-merit per the ruling codified at
  `we:docs/agent/platform-decisions.md#claim-accuracy-advisory-blocks-on-impact`, so the profile must say
  whether it is earned or always-on).

## #2948 — Cheap review: cut review cost to what the change actually earns
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Same four→five lens drift as #2947: "four lenses × one juror × two rounds", "Two of those four lenses
    rarely pay out", "Every band fans out the same four lenses", "`high` runs two copies of one lens". Five
    lenses today (`we:scripts/lib/jury-core.mjs:1137-1181`, contract bands lines 126-152), so the stated cost
    arithmetic ("roughly eight to ten full reads") is understated — it is now ~10-12 at `elevated`.
  - Slice table statuses have moved: **#2949 is effectively delivered** (see its block below — still
    `status: open`), **#2950 is `active`**, #2947 and #2951 still open. The table presents all four as
    pending work.
  - Structural claims still verified true: `panelRigorForCareLevel` differs only in rounds/juror count;
    `CARE_WEIGHTS.blastRadius: 3` unchanged.
- **suggested action:** edit card — correct four→five, restate the cost arithmetic, and mark #2949 delivered /
  #2950 in flight in the slice table.

## #2949 — Acceptance criteria on items, written to be proven not judged
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** every one of the card's 7 numbered Build tasks and all 4 `## Done when` criteria are on `main`:
  1. `we:docs/agent/backlog-workflow.md:255-346` — the determinism-ladder section, the "every item carries at
     least one tier-1 criterion" rule (`:265`), and the "Title the section `## Done when`, not `## Acceptance`"
     convention (`:346`).
  2. `we:scripts/backlog/scaffold.mjs:101-105` — `renderItem` appends the `## Done when` skeleton, comment
     tagged `(#2949)`.
  3. `we:scripts/backlog/__tests__/scaffold.test.mjs:71-78` — `describe('renderItem — \`## Done when\`
     skeleton (#2949)')` asserting the heading and its position after the digest.
  4. `we:scripts/backlog/__tests__/frontmatter.test.mjs:220-221` — the trailing-content assertion updated
     (not deleted), commented `#2949`.
  5. `we:scripts/audit-backlog-health.mjs` — `missingDoneWhenProof` **exported** at `:268`, wired at `:460-463`,
     docblock entry at `:49`, `desc.A1` at `:565`, `section('A1', …)` at `:591`.
  6. `we:scripts/__tests__/audit-backlog-health.test.mjs` — new file; `describe('missingDoneWhenProof — A1
     (#2949)')` at `:11` with all four cases from the criterion (`no-section`, `no-executable-token`, real
     command → no hit, exemption → no hit) at `:14,21,29,36`.
  7. `we:skills-src/next-backlog-item/SKILL.md:147-148` — the tie-break prose line.
- **suggested action:** resolve — **but the no-open-slice guard blocks it**: its child **#3234** (parent
  `"2949"`) is still open. Resolve or re-parent #3234 first. (Corpus counts inside the card are dated
  2026-08-14 snapshots and are fine as history.)

## #2951 — Evidence block on the PR: red before, green after
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Frontmatter `blockedBy: ["2949"]` and the body's "Depends on #2949 — there is nothing to evidence until
    items carry criteria." **The blocker's work has landed** (see #2949 above): items now scaffold with a
    `## Done when` skeleton and `check:health` flags missing ones (`A1`). #2949's card is still
    `status: open`, so the blocker *reads* live while the dependency is in fact satisfied — this item is
    actionable now.
  - The card's build seams are all still real and unbuilt: `we:scripts/pr-land.mjs` composes the body and
    embeds the lane manifest (`:100,163-200`, `embedManifestInBody`) but has **no** `<!-- evidence -->` block;
    `we:scripts/lib/lane-verify.mjs` exists and has no notion of a criterion (zero hits for
    `tier-1`/`criterion`/`criteria`).
- **suggested action:** edit card — note the dependency is satisfied in code (drop or annotate `blockedBy:
  ["2949"]` once #2949 resolves); no other change needed.

## #2753 — Session-free conveyor — reduce the operator session to queue + expose-state
- **verdict:** STALE-INFO (possible SUPERSEDED — flagged for the operator, not asserted)
- **confidence:** high on the stale statements; **medium** on supersession
- **evidence:**
  - **A successor epic exists that the card never mentions.** **#3383** ("A background mechanical dispatcher
    replaces the interactive session as delivery supervisor", `kind: epic`, `status: active`, opened
    2026-08-28 — two days *after* this card's prepare pass, `costUsd: 658.92` across 9 sessions) states the
    same thesis: "The session's role narrows to queueing work and being notified of blocked items"; "a
    mechanical dispatcher owns queuing and capacity"; "subagents only edit code." Its follow-on **#3443**
    ("Graduate `origin/lane/mechanical-dispatcher` to main in small, independently reviewable pieces",
    `active`) is the transport. **#3416** (resolved) already describes `we:skills-src/conveyor/runner.mjs`
    having a **`dispatchPass`** that calls `dispatch-lane` — i.e. this card's own S1 slice is already built,
    on the unmerged `lane/mechanical-dispatcher` branch. It is not on `main` (grep for
    `dispatch-lane|dispatchPass` in `we:skills-src/conveyor/runner.mjs` = 0), which is why the card's
    measured criteria still "fail" — they measure `main`, and the work moved to a branch.
  - **#3296 is now resolved**, not "open, size 5, prepared" (card's corrected-DAG row 2). **#3332 is now
    resolved**, so the R3/R4 "operation side #3332" ownership and S2's `#3332` blocker are both cleared.
  - **The "one `dispatch-lane` mention" measurement is stale**: `grep -c 'dispatch-lane'
    skills-src/conveyor/SKILL.md` now returns **3** (lines 77, 545, 595), not 1.
  - **Every SKILL.md/runner line reference has drifted** (all still findable, all off by 4-30 lines):
    `SKILL.md:251→255`, `:279→283`, `:521→538`, `:605→634`, `:680→709`, `:835-841→864`;
    `runner.mjs:81-94→83-96`, `:114-156→~130-150`, `:201-214→384-…`.
  - Still true and verified: 5 hand-spawn sites (grep = 5), the publish seam (grep = 1), the runner is
    print-only on `main`, `we:backlog/3357-*.md` is still open.
- **suggested action:** edit card **and** ask the operator whether #3383/#3443 supersede it. Minimum edit:
  add #3383/#3443/#3416 to the DAG, correct #3296 and #3332 to resolved, re-measure the `dispatch-lane` count,
  and re-pin every line reference.

## #3105 — The gate outruns the agent foreground window
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - **"Why the obvious fix does not work" is no longer the state of the world.** The card says "wording has
    not fixed it, across every phrasing tried". A structural guard now exists on `main`:
    `we:scripts/guard-bash.mjs` (`:18`, `:288-312`, `backgroundedVerificationReason`, #2833 finding 3) DENIES
    a backgrounded verification-set run (`verify-lane` / `check:standards` / `test:unit`) via either the Bash
    `run_in_background` param or a shell `&`/`nohup`/`setsid`/`disown`.
    `we:skills-src/conveyor/delivery-agent-brief.md:138-143` documents this as "structurally blocked, not
    merely discouraged". That kills observed shape 1 (the dominant one, 4 of 5 builds).
  - **The `## Approaches` fork is RULED.** `## Done when` bullet 3 ("the approach fork above is ruled and the
    reasoning recorded") is satisfied by **#3405** ("Ratify the 'agents never run commands, only the
    mechanical layer does' dispatch doctrine", `kind: decision`, **resolved 2026-08-30**,
    `codifiedIn: docs/agent/platform-decisions.md#dispatched-agent-never-runs-commands-directly`,
    `relatedTo: ["3105", …]`) — i.e. approach three ("take the gate out of the agent's arc") is the ruled
    direction. Statute anchor confirmed at `we:docs/agent/platform-decisions.md:3220`.
  - **Caveat worth recording:** #3405's prose says a `dispatchedAgentVerificationReason` rule gated on
    `WE_DISPATCH_KIND` "landed under `#3105`" in `we:scripts/guard-bash.mjs`. **It is not on `main`** (zero
    grep hits for either symbol) — it lives on the unmerged `lane/mechanical-dispatcher` branch. So #3105 is
    partly delivered off-main; do not resolve it on #3405's word alone.
  - Minor: the card's mechanism is stated as `npm run test:unit -- --shard=N/2`; `test:unit` is now plain
    `vitest run` (`we:package.json:29`) and sharding lives in CI (`we:.github/workflows/ci.yml:59-65`), so the
    "150-350 s per shard" figure is not measuring the command an agent runs today.
- **suggested action:** edit card — record that the fork is ruled (#3405) and that the backgrounding footgun
  is guard-blocked on `main` (#2833), then narrow the remaining ask to the two unmet Done-when bullets
  (one end-to-end unattended arc; loud failure) and note the #3405/#3383 lane-branch dependency.

## #3143 — Should requiredNPerGroup fold in this module's own 5-and-5 validity floor?
- **verdict:** OK
- **confidence:** high
- **evidence:** spot-checked every structural cite and all are still exact:
  `we:scripts/lib/gate-health.mjs:143` `compareProportions`, `:153` the `usable = Math.min(...) >= 5` rule,
  `:245` `requiredNPerGroup`, `:269` `assessCriteria`, `:329` the `sizeableMdd` probe, `:364-369`
  `testable`/`shortCells`, `:373` the blocker. `we:reports/2026-08-17-power-estimator-validity-floor.md`,
  `we:src/_data/researchTopics/power-estimator-validity-floor.json`,
  `we:src/_includes/research-descriptions/power-estimator-validity-floor.njk` and
  `we:scripts/operations/__tests__/gate-health.test.mjs` all exist. `#3090` resolved / `#3083` open, both as
  the card describes.
- **suggested action:** none.

## #2985 — Does the born-active TTL need a grace day for operator timezone skew
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - **"There are currently **zero** born-active unsettled items in the tree, so the check is inert as it
    stands."** No longer true: there are **5** `status: active` items carrying `dateScaffolded` —
    `backlog/3467-*.md` (2026-09-03), `backlog/3496-*.md`, `backlog/3497-*.md`, `backlog/3498-*.md`,
    `backlog/3499-*.md` (all 2026-09-05). At least #3467 is past its creating day, so the O1/TTL check is
    live, not inert. (The card itself warns this fact is a snapshot; the number should still be refreshed
    before the ruling, since "inert today" was used to size the work.)
  - Line-ref rot: `we:scripts/check-standards.mjs:866` → the `const today = localToday();` line is now
    **:937**. `we:scripts/backlog.mjs:89` (cited as the `dateScaffolded` stamping path) is now an unrelated
    constant; the real stamp is `we:scripts/backlog/scaffold.mjs:90` (that half of the cite is still exact).
    `we:scripts/__tests__/workflow-invariants.test.mjs:68-77` → the born-active TTL describe block is now
    `:62-80`.
  - Still exact: `we:scripts/check-backlog-workflow.mjs:24`, `we:scripts/audit-backlog-health.mjs:378`, no
    `TZ`/`BACKLOG_TZ` in any of the three CI workflows, `BACKLOG_TZ` handling in
    `we:scripts/lib/local-date.mjs:75-95`, and no in-tree project-day declaration (Fork 1's recommended
    default is unbuilt).
- **suggested action:** edit card — re-measure the born-active population (5, not 0) and re-pin the three
  drifted line refs; the decision itself is still genuinely open.

## #3055 — Review independence is blind to contributors
- **verdict:** OK
- **confidence:** high
- **evidence:** all four `scope:` files exist; `we:scripts/lib/review-independence.mjs:81` is still
  `currentActorId` (the cited `:81-84`), `ACTOR_ENV = 'CLAUDE_CODE_SESSION_ID'` at `:73`,
  `AUTHOR_ACTOR_MARKER = 'authored-by-actor'` at `:87`, and there is still **no** commit-authorship read
  anywhere in the file — the gap the card names is intact. `we:scripts/merge-ai-prs.mjs`, `we:.githooks/`
  (post-merge, pre-commit, pre-push), `we:scripts/guard-git-push.mjs` and
  `we:reports/2026-08-16-3055-contributor-blindness-prep.md` all exist. Related-item statuses match the
  card's framing (#2844/#2439/#2398 resolved; #2946/#3048/#3006 open).
- **suggested action:** none.

## #3043 — /converge's editor is not care-gated
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - **The blocker has resolved.** Frontmatter `blockedBy: ["2908"]`; **#2908 is `resolved`**. The item is
    ready to rule.
  - Line-ref rot throughout the argument (every symbol still exists, every line number is wrong):
    `we:scripts/lib/jury-core.mjs:755` `EDITOR_ENABLED_CARE_LEVELS` → **:1254**; `:765` `EDITOR_MIN_ROUNDS`
    → **:1264**; `:785-803` `editorPolicyForCareLevel` → **:1284-1300**.
    `we:scripts/workflows/review-parked-prs.mjs:252` `editorMayPush` → **:261**; `:1299` the per-round
    re-check → **:1308**. `we:docs/agent/platform-decisions.md:3430`
    `#converge-editor-enabled-at-low-only` → **:3631**. `we:scripts/lib/converge-core.mjs:536-539` → the
    unconditional `EDIT` return is at **:539**.
  - Still exact and still true (the substance holds): `we:scripts/lib/review-core.mjs:768` `editorMayPush`;
    `we:scripts/lib/converge-core.mjs` has **zero** references to `editorPolicyForCareLevel`;
    `we:scripts/converge-cli.mjs:70-76` still documents `elevated` as the default care band. #2970 (the
    dependent migration) is still open.
- **suggested action:** edit card — re-pin the seven drifted line refs and note the #2908 blocker is
  resolved so this is decidable now.

## #3490 — Close the gaps in the typed mutation-operation catalog
- **verdict:** OK
- **confidence:** high
- **evidence:** filed 2026-09-04 and its snapshot still matches the tree. `we:scripts/operations/` contains
  exactly the declared operations the card lists, and confirms the four zero-coverage families: there is no
  `lane.*`, no `file.*`, no commit/push operation module. `we:scripts/operations/declared-homes.mjs`,
  `we:reports/2026-08-08-agent-command-surface-sizing.md` and parent #3001 all exist; #3273/#3029 open as
  described. One nit only: the "declared operations that exist" list omits `route-pr-outcome` and
  `review-dispatch`, both present as modules in `we:scripts/operations/` (neither is in one of the seven
  families, so the gap table is unaffected).
- **suggested action:** none (optionally add the two missing module names to the inventory line).

## #3491 — Flip guard-bash.mjs from a deny-list to a fail-closed allow-list
- **verdict:** OK
- **confidence:** high
- **evidence:** every cited path exists and every claim checks out: `we:scripts/guard-bash.mjs` (2371 lines)
  is still a deny-list with an allow-by-default tail and documents its own false-DENY/false-ALLOW classes at
  `:859-862`; `we:scripts/__tests__/guard-bash.test.mjs`, `we:scripts/readiness/scope-lease.mjs`,
  `we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md` and the statute anchor
  `#agent-mutations-through-typed-operations` in `we:docs/agent/platform-decisions.md` all resolve.
  `blockedBy: ["3490"]` — #3490 is open, so the block is live and correct. #3188 still open as stated.
- **suggested action:** none.

## #3234 — Run each tier-1 criterion, do not just read it
- **verdict:** OK
- **confidence:** medium
- **evidence:** its factual claims are dated 2026-08-21 observations about a specific overnight batch and are
  not contradicted by anything in the tree; its parent #2949's mechanism (the `A1` flag,
  `we:scripts/audit-backlog-health.mjs:268`) checks *shape*, not *execution*, so the gap this card names is
  still open. Note, not a staleness finding: its own `## Done when` is the unfilled scaffold placeholder
  ("**Executable** — TODO: a command that fails before this item lands and passes after."), which its own
  parent's A1 check would flag — worth authoring before it is picked up. It is also the one open child
  blocking #2949's resolve.
- **suggested action:** none (author the placeholder criterion when picked up).

---

### OK list
- #3234 OK (see block — placeholder `## Done when`)
- #3143 OK
- #3055 OK
- #3490 OK
- #3491 OK
