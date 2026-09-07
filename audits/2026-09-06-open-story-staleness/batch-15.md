# Batch 15 — staleness audit (24 open cards)

- **ALREADY-DONE: 2** — #3100, #3268
- **SUPERSEDED: 2** — #2737, #3186
- **STALE-INFO: 12** — #097, #099, #184, #186, #297, #1451, #1585, #1589, #1979, #2410, #2922, #3047
- **STALE-PREMISE: 0** · **DEAD-REFS (primary): 1** — #314
- **OK: 7** — #181, #563, #1399, #1975, #3116, #3286, #3287

> **Environment caveat:** `/home/user/web-everything` is a **shallow clone** (142 commits, `.git/shallow`
> present) and `gh` is **not installed**. Every commit SHA cited by a card in this batch
> (`fed61bc5`, `13f2da58`, `50bcc3f6`, `12db3256`, `3644b569`, `df8488e9`, `91072ddb`, `cf6730a3`, …)
> fails `git cat-file -e` here. That is **not** evidence the SHAs are dead — it is a clone-depth
> artifact. No card was marked DEAD-REFS on a SHA for that reason.

---

## #097 — Emergent MVP strategy
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card explicitly declares itself a *living doc* ("Keep this updated — it's a living
  doc"); it has not been updated as its candidates shipped.
  - *"Conformance auto-fix agent (#095) — **being worked.**"* → `backlog/095-*.md` is
    `status: resolved`, `dateResolved: "2026-06-08"`, `graduatedTo: scripts/autofix/engine.mjs +
    scripts/conformance-autofix.mjs CLI (npm run autofix)`. It was already resolved two days after
    #097 was opened.
  - *"Mockup → code (#086) — **deferred post-MVP.**"* → `status: resolved`, `dateResolved:
    "2026-06-15"`, `graduatedTo: demo:mockup-to-standard-demo`.
  - The #094 growth path lists #188/#189/#190/#191 as future work — **all four are `resolved`**.
  - *"Sequencing note: the bigger always-on plays (MaaS live CDN #081, business-rule/compliance manager
    #093, the relationship-graph dashboard #092) are **post-MVP**"* → #081 resolved 2026-06-11
    (`graduatedTo: blocks/renderers/module-service/moduleService.ts`), #092 resolved 2026-06-12
    (`project:webregistries`), #093 resolved 2026-06-12 (`project:webpolicy`). All three shipped.
- **suggested action:** edit card — (a) change #095 from *"being worked"* to resolved-with-artifact,
  (b) change #086 from *"deferred post-MVP"* to resolved 2026-06-15, (c) mark #188–#191 as landed,
  (d) rewrite the Sequencing note: #081/#092/#093 are no longer "waiting on a self-run tool to fund
  them" — they exist. This card is the `blockedBy` for #184 and #297, so its staleness propagates.

## #099 — The evergreen app (north star)
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** The "Essay ingredient → where it lives now" table marks five rows **"new — #100"**,
  **"new — #101"**, **"new — #102"**, **"new — #103"**, **"new — #104"**. All five are now
  `status: resolved` (checked in `backlog/`). The table therefore still presents the *entire*
  right-hand column of the evergreen loop as unbuilt. Same for the referenced #092/#093/#095/#094 —
  all resolved. `reports/2026-06-06-front-end-platform-book.md` exists (path OK).
  The "hardest unsolved piece is requirement-as-code → automatic verification (#100/#095)" —
  #100 is resolved as *slice A* only (meta-schema + typed-slot validator), so that sentence is
  partly still true; flagged, not asserted stale.
- **suggested action:** edit card — drop the "new —" markers, restate the table as
  ingredient → shipped-artifact, and re-state which part of the loop is genuinely still open.

## #181 — Commercialization infrastructure
- **verdict:** OK
- **confidence:** medium
- **evidence:** Children check out against the stated posture: #182 / #183 / #185 `resolved`
  (as *shape/decision* rulings — #184's own 2026-08-15 re-check confirms #182 "ruled its shape but
  explicitly deferred the *build*"), #184 / #186 still `open`. The 2026-06-11 deferral note has not
  been contradicted by anything landed.
- **suggested action:** none.

## #184 — Marketing landing + pricing site
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:**
  1. **Frontmatter/body contradiction.** Frontmatter is `status: open`; the body carries a
     "## Parked 2026-06-16 (batch-2026-06-16) — `status: parked`" section. The later 2026-08-15
     re-check concludes *"Leave `status: open` … as-is"*, so the park section now describes a state
     the card is not in.
  2. *"surfaced as 'batchable' once its only `blockedBy` (#097) **resolved**"* — #097 is
     `status: open, ongoing: true`, **reopened 2026-06-20** ("Resolving this 2026-06-15 was
     premature"). The premise of the park note no longer holds as written.
  3. Structural: `blockedBy: ["097"]` points at an `ongoing: true` epic that is by design
     **never expected to resolve** — the 2026-08-15 note acknowledges this but leaves the edge in
     place, so this card is permanently un-surfaceable by readiness.
- **suggested action:** edit card — reconcile the park section with the live `open` status, correct
  the "#097 resolved" sentence, and either re-point `blockedBy` at a resolvable node (a pricing-shape
  decision card) or move to `status: parked` with a `maturityTrigger`, matching #1678/#1679's shape.

## #186 — Legal & business-protection review
- **verdict:** STALE-INFO
- **confidence:** low
- **evidence:** *"**OSS + commercial license split** — the policy is its own decision in #098 …;
  settle before launch"* — `backlog/098-*.md` is `status: resolved` ("Licensing strategy — open
  standard, open reference impl, available…"), so that fork is settled, not pending. All other refs
  resolve: #2363 `resolved`, #183 `resolved`, #1104 `open`. The `humanGate` framing and the
  2026-07-09 scope split are accurate.
- **suggested action:** edit card — one line: note #098 is ratified and cite the ruling, so the
  remaining item is drafting the tier labels against it, not deciding the split.

## #297 — Implement Lemon Squeezy MoR checkout + webhook→license issuance
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** Same two defects as #184 (they are siblings):
  1. Frontmatter `status: open`, body section "## Parked 2026-06-16 … `status: parked`".
  2. *"kept surfacing as 'batchable' because its only `blockedBy` (#097) **resolved**"* — #097 is
     `open` + `ongoing: true` since its 2026-06-20 reopen.
  The substantive claims are still true: #183 `resolved` (MoR fork ruled), #182 `resolved`, no
  pricing shape fixed in #097's body, external provisioning still not agent-doable.
- **suggested action:** edit card — reconcile the park section against the live `open` status and
  correct the "#097 resolved" premise; same `blockedBy`-on-an-ongoing-epic problem as #184.

## #314 — Flagship exercise apps
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** *"## Next steps — 1. ~~Confirm the slate.~~ Done — A, B, G, E committed
  (**#317–#320**). 2. ~~Create a child story per committed candidate.~~ Done (**#317–#320**)."*
  The range `#317–#320` is wrong on both lines: `backlog/320-*.md` is **"Author the viewport-presence
  mechanism intent"** (`resolved`, no `parent`), unrelated to this epic. The epic's own "Committed
  selection" section names the correct children: **#317, #318, #319, #345** (all four `parent: "314"`,
  all four `resolved`; #377 is a fifth resolved child). Everything else verified: `docs/agent/
  exercise-app-workflow.md` and `scripts/check-app-conformance.mjs` both exist; #100/#093/#096 refs
  resolve.
- **suggested action:** edit card — replace both `#317–#320` with `#317, #318, #319, #345`. Minor:
  "Revisit the pool (**C, D, F**)" omits **H**, which the slate also lists as uncommitted.

## #563 — AI-driven agile methodology as a shareable approach
- **verdict:** OK
- **confidence:** high
- **evidence:** Every referenced item's live status matches what the card asserts: #569 `resolved`
  (artifact-shape fork ratified, as the Status section says), #564 `resolved`, #622 `resolved`,
  #1678 **`parked`** and #1679 **`parked`** (exactly as the "two `maturityGated` parks" line states),
  #143 `open`, #665 `resolved`, #666 `open`, #671 `resolved`, #166 `resolved`, #089 `open`.
  `reports/2026-06-23-563-slice-analysis.md` exists.
- **suggested action:** none. (Cosmetic only: `[#1678]` / `[#1679]` are bare brackets, not links,
  unlike every other ref on the card.)

## #1399 — Latent-standard discovery program
- **verdict:** OK
- **confidence:** high
- **evidence:** `reports/2026-07-01-program-latent-standard-discovery.md` exists. All ten lens rows
  resolve to real items; all seven lens children (#1390, #1400–#1405) and the whole founding harvest
  (#1384, #1393–#1398) are `resolved`, consistent with the review log's "lens ran once, emitted its
  cards" reading. #2029, filed by the 2026-07-01 run, is now `resolved` — normal program progress,
  not staleness. `src/_data/intents/` and `src/_data/blocks/` both exist. `parent: "099"` is open.
- **suggested action:** none. (The next run is due only on an APG/OpenUI index-version change, per the
  card's own idempotent-dry gate.)

## #1451 — Library-adapter watch
- **verdict:** STALE-INFO (+ DEAD-REFS)
- **confidence:** high
- **evidence:**
  - **DEAD PATH, cited 4×:** `we:src/_data/adapters.json#lib` **does not exist**. Adapters were split
    into a directory: `src/_data/adapters/*.json` (+ `src/_data/adapters.js`). Occurs in the intro,
    the "Why this is a distinct program" bullet, the Ownership section, and the Goal-set header.
  - **All 5 filed slices are resolved:** #2034 (Floating UI), #2035 (Mousetrap), #2036 (focus-trap),
    #2037 (TanStack-Virtual), #2038 (Zod/TanStack-Form) — every one `status: resolved`. The review
    log's *"**Next run:** build the 5 filed adapters"* is done.
  - **The Goal-set coverage figure is stale.** *"Coverage at record time: **1/7 owed elements live**"*
    and *"both registered `lib` adapters are concept stubs"* — `src/_data/adapters/` now holds
    `floating-ui-adapter.json` (`"status": "implemented"`), `mousetrap-adapter.json`
    (`"implemented"`), `focus-trap-adapter.json` (`"poc"`), `tanstack-virtual-adapter.json` (`"poc"`).
    (No Zod/validation adapter JSON in WE — #2038 may have landed FUI-side; not confirmed.)
  - **Two "blocked" rows are now unblocked.** The card states TanStack-Query server-state is blocked on
    #1419 *"(unresolved)"* and TanStack-Table on #1411 *"(unresolved)"* — **both are `resolved`**. By
    the card's own rule ("it files the adapter slice when the protocol ratifies"), two slices are now
    owed and unfiled.
  - Still accurate: `src/_data/protocols/storage.json` is `"status": "concept"`, so the held
    TanStack-Query-persistence row is correctly held. `capabilityMatrix.json` and the 2026-07-01
    report exist. #1258 open, #1249/#1262/#011 resolved.
  - Minor: the `#463` citation for `forward-generation-adapters` points at *"Polyglot MaaS origin —
    generate .NET / Java / other server-side origins"*, which reads like a mis-cite; not confirmed.
- **suggested action:** edit card (fix the 4 dead `adapters.json#lib` paths; refresh the Goal-set
  table's Adapter-state column and the 1/7 figure) **and** run the watch — #1419/#1411 ratifying is
  precisely this program's front-B trigger, so two adapter slices should be filed.

## #1585 — Design-knowledge intake program
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:**
  - Carve list: *"**#1588** (`decision`) — source admission + credibility-weight criteria (**the open
    fork**, de-buried)"* — #1588 is `status: resolved`, graduated into
    `src/_data/credibilityWeighting.js` (`computeCredibilityWeight`), which
    `src/_data/designKnowledgeWatch.json`'s own description now documents as live.
  - Review log: *"**Next run:** ratify #1588 …, then run #1589"* — the first half is done; only #1589
    remains (`status: open`, prepared 2026-08-15).
  - The card's own #1589 line still shows `blockedBy: #1588, #490`; #1589's live frontmatter is
    `blockedBy: []` (both cleared in substance, per its 2026-08-15 blocker-status section).
  - Not indexed: **#3116** (`parent: "1585"`, `blockedBy: ["1589"]`) was filed 2026-08-15 as the
    multi-source-axis follow-on and appears nowhere in the carve list or review log.
  - Verified still-true: all 4 ledger rows have `distilledInto: null` (nothing distilled yet), so the
    front-A NUDGE is genuinely 4/4 pending. Front-B source-discovery sweep still unbuilt.
- **suggested action:** edit card — mark #1588 ratified, add #3116 to the carve list, and rewrite
  "Next run" to name #1589 (+ #3116) as the remaining distillation work.

## #1589 — Distillation pipeline (single-source axes)
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** The card is otherwise excellent and current (prepared 2026-08-15), but its **decided
  design rests on a fact that has since changed**:
  - *"…**#1035, the actual machine consumer of rubric content, does not exist yet**, so a second
    structured-data home for the same content would repeat that mistake"* and, in Relationships,
    *"#1035 / #1036 / #1553 — downstream consumers … (**not yet built**…)"*. **#1035 and #1036 are
    both `status: resolved`.** #1035 shipped as `.claude/skills/review-design/SKILL.md`, which reads
    the rubric out of `docs/agent/vision-tiers.md#design-critique-rubric-ratified-1034` as prose
    ("Don't restate the rubric here; if it changes, edit that doc"). #1553 is also `resolved`.
  - **This strengthens the card's ruling rather than overturning it** — the real consumer parses the
    doc, which is exactly where the card decided to put the content — but the *stated reason* is now
    false and should be replaced with the confirmatory one.
  - **Line drift:** *"`isDistilled()` in `we:scripts/check-standards-rules.mjs:330`"* — the function is
    at **line 453**, inside `computeDesignKnowledgeConformance` at line 451.
  - Everything else verified live: `docs/agent/vision-tiers.md` is **`Rubric version: v2`** (so the
    v2→v3 bump is still owed), `src/_data/credibilityWeighting.js` exists, `design-refs/
    distillation-recipe.json` exists, #1591/#511 `resolved`, #513 `parked`, #514 `open`, #1592
    `resolved`, #3004/#3095 `resolved`, and the target test file
    `scripts/__tests__/design-knowledge-distillation.test.mjs` does **not** exist yet.
- **suggested action:** edit card — replace "#1035 does not exist yet" with "#1035 shipped as the
  `/review-design` skill and reads this doc section directly, which confirms the doc-prose placement";
  fix the `:330` line pointer to `:453`.

## #1975 — Directive catalog (net-new directive proposals)
- **verdict:** OK
- **confidence:** high
- **evidence:** `reports/2026-06-29-directive-catalog-brainstorm.md` exists. Candidate index is
  accurate as an index: #1976, #1977, #1978, #1980, #1981 all `resolved`; **#1979 is the single open
  child**. #1963 `resolved`, #1969 `resolved` (cited in the "region transition" pool row).
- **suggested action:** none now — but note the epic is one item from complete: once #1979 lands, the
  only residual is the "Catalogued in the report — promote to items when prioritized" pool, which is
  a promote-or-dismiss judgment call rather than open build work.

## #1979 — Directive proposal — virtualized iteration
- **verdict:** STALE-INFO
- **confidence:** low
- **evidence:**
  - **Dead line pointer** (the #3289 class): *"spec keyed-diff note
    `we:src/_includes/project-webdirectives.njk:473`"*. Line 473 of that file is now inside a
    **`defer` directive example** ("Server emits the placeholder branch… Supersedes the earlier `lazy`
    proposal"), not a keyed-diff note.
  - The surviving keyed-diff prose has moved to `:501` and `:539` and now reads **present tense as
    shipped** — *"The client reads `data-key` for keyed reconciliation"* (:501) and *"For `for-each`
    directives, the client reads `data-key` attributes to perform efficient keyed reconciliation when
    data changes"* (:539) — not the *"key parsed; diffing Phase 2, #1971"* the card quotes from the
    catalog report. **#1971 is still `open`**, so I am not asserting the gate has cleared; flagging
    that the doc and the blocker now disagree and the un-gate trigger deserves a re-read.
  - Everything else resolves: `docs/agent/block-standard.md#composition-rubric` exists (line 462),
    #1963 `resolved`, `src/_data/intents/windowed-collection.json` exists (`"status": "draft"`).
- **suggested action:** edit card — re-point the njk citation at `:501`/`:539`, and re-verify whether
  #1971's keyed reconciliation has in fact landed (which would clear this decision's NOT-YET).

## #2410 — Unified drain convergence loop (option B)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's central section is *"## Slices (**to cut when picked up**)"* listing four
  unnamed slices. **All four were cut and shipped:**
  - slice 1 *Approach handshake* → **#2438** `resolved`
  - slice 2 *Independent hardened validator* → **#2439** `resolved`
  - slice 3 *Anti-test-gaming gates* → **#2440** `resolved`
  - slice 4 *CI-green land clause + off-by-default flag* → **#2441** `resolved`
  - plus **#2669** `resolved`, and **#2737** the only open child.
  None of the six children is named anywhere on the epic. Corroborating code: the #2440 anti-test-
  gaming gate is live at `scripts/merge-ai-prs.mjs:3928` (`scanTestTampering`) with `#2440 (slice C of
  epic #2410)` in its own comment. All cited siblings resolved: #2285, #2311, #2310, #2398, #2281,
  #2336. `reports/2026-07-10-ai-code-review-best-practices.md` referenced as `relatedReport`.
- **suggested action:** edit card — replace "Slices (to cut when picked up)" with a child index
  showing #2438–#2441 + #2669 shipped and #2737 outstanding. This epic is a resolve candidate the
  moment #2737 closes (see next entry).

## #2737 — anti-test-gaming re-park must exempt a review:accepted PR
- **verdict:** SUPERSEDED
- **confidence:** high
- **evidence:** The defect this card is **titled** for has been fixed by a later, independent item
  that never cites it:
  - `scripts/merge-ai-prs.mjs:3931-3949` now carries the `#xuboo0q` block — on a `scanTestTampering`
    hit for a PR carrying `review:accepted`, it lazily fetches `headRefOid,comments`, calls
    `parseLatestHumanClearedSha(cd.comments)`, and gates the re-park on
    `shouldReparkForTestTampering({tampered, netDiffScored, humanClearedSha, headSha})`.
  - That is **exactly this card's prescribed "correct fix"**: SHA-pinned *and* bound to a
    human `clear-human` marker — the comment states explicitly it is *"NOT a bare `reviewed-sha ==
    head` check"* so *"a plain agent `review:accepted` … can never silently inherit an older,
    unrelated human clearance"*, closing this card's Finding 1 and Finding 2.
  - The owning item is **`backlog/3178-scantesttampering-re-parks-review-human-…md`**
    (`bornAs: xuboo0q`, `status: active`). Tests exist at
    `scripts/lib/__tests__/review-escalation.test.mjs:1845+`; the export is wired through
    `scripts/lib/review-escalation.mjs`.
  - **The card's blocking rationale is disproven by the shipped fix.** It says the exemption is
    *"blocked on #2409 + #2416 + #2502"*; #2409 is `resolved`, but **#2416 and #2502 are still
    `open`** and the fix landed anyway, via `parseLatestHumanClearedSha` (the #2895 `--to=clear-human`
    ceremony the card itself flagged as *"possibly superseding"* #2416).
  - **A genuine residual survives, and it is not the titled one.** The sibling **manifest-tamper**
    short-circuit at `scripts/merge-ai-prs.mjs:3894` (`if (tamper.tampered) { … continue; }`) still
    has **no** clearance/SHA memory of any kind — the card names it as having *"the identical
    structural blind spot"*.
- **suggested action:** resolve this card as superseded by #3178, and **file a narrow follow-up** for
  the manifest-tamper branch at `merge-ai-prs.mjs:3894` (same fix shape, different trigger).
  Also relevant: #3142 (`open`) covers the observed silent re-park symptom.

## #2922 — pr-land's dry-run summary line is not park-aware
- **verdict:** STALE-INFO
- **confidence:** high (defect still live; only the line pointer is stale)
- **evidence:** **The defect is confirmed still present.** `scripts/pr-land.mjs` line **730** still
  builds `detail:` as `` `would open+label ${SRC} (…) as a self-approved PR from ${REF}${PLAN
  .triggerDrain ? ' and trigger a single-couple drain' : ''} — the drain lands it onto ${BASE}` ``,
  with **no** `PLAN.mode === 'park'` branch — while the `plan` array immediately above it *is*
  park-aware (lines 716 and 726 both emit `#2622 PARK … the PR is HELD`). The two dry-run outputs
  still disagree. No `detail`-vs-park assertion in `scripts/__tests__/pr-land.test.mjs` (its park
  block, lines 406–506, covers `resolveParkLabel`/`planPrLand`/the park branch placement only).
  Supporting refs check out: #2622 `resolved`, #2216 `resolved`.
  **Stale:** the card cites *"`we:scripts/pr-land.mjs:604`"* — the site is now **line 730** (line 604
  is `resolveRosterReconcile`, unrelated).
- **suggested action:** edit card — re-point `:604` → `:730`. Otherwise build as written; it is a
  genuine, still-open, ~5-line fix.

## #3047 — A failed comment fetch makes acceptanceCoversHead return covered
- **verdict:** STALE-INFO
- **confidence:** high (defect still live; the line pointers moved ~800 lines)
- **evidence:** **The defect is confirmed still present.**
  - `scripts/lib/review-escalation.mjs:1496` — `if (!a || !h) return { covers: true, reason: '' };`
    (its own docblock at :1469 still says *"Either SHA unknown … → `{ covers: true }` — fails…"*).
  - `scripts/merge-ai-prs.mjs:4004` — `} catch { /* fetch miss → SHAs null → gate fails open */ }`,
    verbatim as quoted.
  - The asymmetry argument still holds, and is now *sharper*: the neighbouring `#xuboo0q`
    test-tampering fetch at `merge-ai-prs.mjs:3947` fails **closed** — `/* fetch miss → both stay
    null → shouldReparkForTestTampering fails closed (still true) */` — three dozen lines above the
    fail-open. That is a new, stronger instance of the card's own "house style" argument.
  - #2993's allow-list extension is still owed: no `check:standards` rule for the class exists.
  - **Stale line pointers:** *"lines 3168–3190"* → the lazy marker fetch is now at **~3974–4004**;
    *"line 3243"* (the `gate.action === 'merge'` skip) → `decideReviewGate` is now called at
    **line 4053**; *"line 3190"* (the un-listed fetch) → **4004**.
  - Sibling statuses as claimed: #2885 `open`, #2993 `open`, #2883 `open`, #2884 `open`,
    #2913 `open`, #2409 `resolved`, #2844 `resolved`.
- **suggested action:** edit card — refresh the three line pointers; optionally add the
  `merge-ai-prs.mjs:3947` fail-closed neighbour as the strongest asymmetry exhibit. Then build.

## #3100 — agent-memory-src is missing from the at-land hash rewrite scope
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Every *Done when* clause is satisfied in the live tree:
  - `scripts/lib/citation-check.mjs:46` — `export const HASH_REWRITE_DIRS = ['backlog/',
    'docs/agent/', **'agent-memory-src/'**];`
  - `scripts/lane-drain.mjs:605-658` — `numberPendingHashes` now has the third source, with a
    `#3100` comment: `const MEMORY = join(CWD, 'agent-memory-src')` (:615), a
    `git ls-files agent-memory-src/*.md` tracked-set read (:652), `memoryFiles` mapped at :654, and
    `const files = [...stems…, ...docsFiles, ...memoryFiles]` at :658.
  - Gate side: `scripts/check-standards.mjs:1351` — `scanDir('agent-memory-src/', ['.md'])`, plus a
    new **gate 3b** `findDanglingMemoryHashSlugs` (`:1247`, `:1275`, `:1337`). The review's
    "internally contradictory" objection was **honoured, not ignored**: `agent-memory-src/` was
    deliberately *not* added to `HASH_SLUG_OUT_OF_SCOPE_DIRS` (still just `reports/`,
    `src/_data/researchTopics/`, `src/_includes/research-descriptions/`), and
    `citation-check.mjs:55` says so explicitly.
  - Tests: `scripts/__tests__/lane-drain-numbering.test.mjs:269, 285, 303` (three named `#3100`
    cases, including the explicit `bornAs:` protection assertion) and
    `scripts/__tests__/citation-check.test.mjs:358+` (`findDanglingMemoryHashSlugs — gate 3b
    (#3100)`), plus parity coverage in `scripts/__tests__/rust-scan-citation-check-parity.test.mjs`.
  - Corpus cleanup done: `grep -rnoE '\bx[0-9a-z]{6}\b' agent-memory-src/ | grep -v bornAs`
    returns **nothing** — all 7 measured dead hashes are gone.
- **also DEAD-REFS:** the card's `scope:` lists
  `we:scripts/lib/__tests__/citation-check.test.mjs` — that path does not exist; the file is
  `we:scripts/__tests__/citation-check.test.mjs`.
- **suggested action:** **resolve.**

## #3116 — Distillation pipeline — multi-source rubric axes (follow-on to #1589)
- **verdict:** OK
- **confidence:** high
- **evidence:** `blockedBy: ["1589"]` and #1589 is genuinely still `open`. The v3→v4 bump premise is
  consistent: `docs/agent/vision-tiers.md` is at **v2** today and #1589 owns the v2→v3 bump, so v3→v4
  is correctly this card's. The four multi-source axes (#3, #6, #7, #8) and their source pairings
  match #1589's scope table exactly. `src/_data/designKnowledgeWatch.json` still has
  `uicrit-uist24.distilledInto: null` with `trackingItem: "1589"` (which #1589 will flip to `"3116"`),
  and the stated credibility weights (apple-hig 0.75, uicrit-uist24 1.0) match the live file.
- **suggested action:** none.

## #3186 — review-set-label emits an ordered apply-plan
- **verdict:** SUPERSEDED
- **confidence:** high
- **evidence:** The card **declares its own supersession** ("## SUPERSEDED IN MECHANISM
  (2026-08-19) — `--emit-plan` is no longer the shape"), and the named replacement is confirmed
  shipped:
  - `scripts/apply-review-request.mjs` exists and runs the real
    `scripts/review-set-label.mjs` in CI (`:160` — `join(REPO_ROOT, 'scripts',
    'review-set-label.mjs')`).
  - `.github/workflows/apply-review-request.yml` exists.
  - `grep -n 'emit-plan\|emitPlan' scripts/review-set-label.mjs` returns **nothing** — the flag this
    card's entire `Done when` is written against was never added, and by the card's own ruling never
    will be.
  - Every one of the five `Done when` clauses names `--emit-plan` behaviour, so the card cannot be
    delivered as written. The remaining live descendants of this goal are the read-direction items
    (see #3268, below, which landed the `ops/pr-views` sibling transport).
- **suggested action:** **resolve** (goal met by another mechanism), or if the `--emit-plan`
  defence-in-depth is still wanted, rewrite the card down to that residual — do not build the
  `Done when` as it stands.

## #3268 — A reviewing session can author the material its own juror judges
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Option (b) — the ruled recommendation — is implemented, and all five *Done when*
  clauses have named, matching tests:
  - `scripts/operations/stage-pr-view.mjs` docblock (:44-54) describes exactly the ruled design
    ("the session pushes a REQUEST, CI runs `gh pr view --json` and commits the answer to
    `ops/pr-views`, and `--fromTransport` reads it back out of the fetched remote ref") and names the
    three refusals.
  - The three functions exist: **`chooseViewSource`** (:181 — refuses neither-source and
    both-sources, neither defaulted), **`checkViewProvenance`** (:228 — refuses a `--from=` view on a
    repo whose transport branch exists on origin, naming PR #1542 in the error), **`checkViewFreshness`**
    (:291).
  - `.github/workflows/stage-pr-view.yml` exists (the separate read-direction workflow the card
    costed). Shared constants live in `scripts/lib/pr-view-transport.mjs`.
  - Tests in `scripts/operations/__tests__/stage-pr-view.test.mjs` match the clause names verbatim:
    `describe('exactly one view source, chosen in writing')` (:253 → clause 1),
    `describe('a hand-supplied view is REFUSED wherever CI can serve — the structural half')` (:283 →
    clause 2), the **booby-trapped-`read`** transport test (:466 → clause 3), the freshness/forged-ref
    tests (:365, :688-731 → clause 4), plus an explicit *"refuses the #1542 shape end to end"* case
    (:379).
  - The `_stagedFrom` provenance stamp the card promised is written at
    `stage-pr-view.mjs:424`.
- **suggested action:** **resolve.**

## #3286 — A quoted invocation ships with a result nobody re-ran
- **verdict:** OK
- **confidence:** medium
- **evidence:** No implementation of either half exists — nothing in `scripts/` re-runs quoted
  commands or inspects *Done when* fixtures (the only related tool is
  `scripts/lib/claim-sweep.mjs`, which is #3307's sweep for the **#3290** class and explicitly cites
  `3290`, not this card). All four sibling refs are live and correctly characterised: **#3287 open**,
  **#3288 open**, **#3289 open**, **#3290 open**; #3147 / #3035 / #3239 / #3165 / #3118 all
  `resolved`, matching the card's narrative.
  **Caveat I could not clear:** every fixture this card pins (`fed61bc5`, `13f2da58`, `50bcc3f6`,
  `bb914a00`, `77f69705`) is a PR-#1560 *lane* commit, and none resolves in this shallow clone. If
  those lane branches were deleted after landing, *Done when* 1/4/5 lose their `git show` fixtures —
  worth one `git cat-file -e` check on a full clone before pickup.
  Cosmetic: the filename slug still carries the superseded title
  (`3286-a-done-when-criterion-names-a-fixture-whose-stated-outcome-i.md` vs the heading *"A quoted
  invocation ships with a result nobody re-ran"*) — the card itself flags the retitle.
- **suggested action:** none (verify fixture-SHA reachability on a full clone before building).

## #3287 — A PR body's frontmatter claims are never checked against the diff
- **verdict:** OK
- **confidence:** medium
- **evidence:** No implementation exists. `scripts/check-backlog-item.mjs` (the parser the Sketch
  leans on) **does** exist. Sibling framing is accurate: #3286 / #3288 / #3289 / #3290 all `open`;
  #3147 `resolved`, #3165 `resolved`, #3118 `resolved` — and #3118 is indeed *not* the item #1560's
  diff touched, which is what the binding filter is written for.
  Same shallow-clone caveat as #3286: `12db3256`, `fed61bc5`, `e14e41dd`, `3374b1db` are unverifiable
  here, and *Done when* 1/2/3 all depend on `git show`-ing #3147's card at two of them.
- **suggested action:** none (same fixture-reachability check before building).
