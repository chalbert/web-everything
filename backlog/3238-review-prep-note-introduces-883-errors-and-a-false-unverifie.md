---
bornAs: xyg1k8p
kind: task
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-10-03"
preparedDate: "2026-08-25"
relatedTo: ["3233", "3230"]
tags: [operations, epic-3029, review-prep, preparation, gate]
scopeRationale: "we:scripts/check-standards-rules.mjs is an existing read-only detector imported by the regression tests, not an edited deliverable. Frozen card-body fixtures live inline in the scoped test file."
scope:
  - we:scripts/operations/review-prep.mjs
  - we:scripts/operations/review-prep-io.mjs
  - we:scripts/operations/__tests__/review-prep.test.mjs
  - we:scripts/operations/__tests__/review-prep-io.test.mjs
  - we:scripts/backlog/guarded-write.mjs
  - we:backlog/3100-agent-memory-src-is-missing-from-the-at-land-hash-rewrite-sc.md
  - we:backlog/1637-capability-matched-task-queue.md
  - we:backlog/3183-a-cloud-vm-must-unshallow-and-provision-a-lane-pool-or-no-en.md
---

# review-prep note introduces #883 errors and a false unverified-prerequisite flag

The note we:scripts/operations/review-prep.mjs appends is not routed through the lint the CLI write path enforces, so it injects bare code-path refs into the card it just reviewed — 11 of 12 cards on one lane, 8 of 12 on another, on 2026-08-21. A card clean before review is dirty after it, so a caller validating only beforehand ships broken cards. Separately its own risk-strategy wording trips the check:standards non-batchable marker and makes the reviewed item read as non-agent-ready.

## CORRECTION (2026-08-25), itself corrected at review — read the second table, not the first

The original last sentence located the live false positive in a file named
`we:backlog/1637-review-hardcoded-color-lint-scope-alignment-a11y-contrast.md`. **No such file exists**; the
`1637` slot is `we:backlog/1637-capability-matched-task-queue.md`.

**The first correction then over-corrected, and an independent reviewer caught it.** It said "the flag fires
on #3238, #3100, #3103 and #2717 — #1637 is not among them" and treated that as settling the matter. The
*count* is right and reproduces. The *attribution* was wrong, and it made the same mistake the original card
made: a claim wider than what was actually checked. Task 2 below — grep the phrase before reasoning about it
— is exactly the step that was skipped while writing a correction about skipping it.

**Two different questions were being conflated.** Separate them:

**(1) Which cards CARRY the renderer's line?** The emitted text is `PREP_RISKS.PREMISE` —
`'verify by mutation or reversion BEFORE building'` (`we:scripts/operations/review-prep.mjs:95`). Grepping
that phrase returns **five** cards: **#3100, #1637, #3183, #3238, #3103**.

**(2) Which cards WARN at the gate?** Only four, and it is a different set, because
`we:scripts/check-standards-rules.mjs:811` warns only when `item.batchable === true`:

**Line numbers below are FILE-relative** (1-based from the frontmatter's opening `---`), which is what
`grep -n` reports. The gate's own warnings quote a *body*-relative number, so the two differ by the
frontmatter length — round 1's table mixed the two bases and two of its four cited lines resolved to the
wrong place. Stating the basis because getting this wrong is the same class of defect the table exists to
correct.

| item | carries the renderer line? | warns? | why |
| --- | --- | --- | --- |
| #3100 | **yes** — file line 161 | yes | the only true instance of this defect |
| #1637 | **yes** — file line 78, put there by the `review-prep` run that landed as PR #1270 | no | `status: parked`, so not batchable |
| #3183 | **yes** — file line 122 | no | carries `blockedBy: ["3194"]` |
| #3103 | no — file line 29 is the row that *defines* the phrase in the risk enum | yes | defining it trips the regex |
| #2717 | no — file line 22 reads `verify before claim`, a different phrase about a stale `blockedBy` | yes | unrelated to `review-prep` entirely |
| #3238 | no — this card *quotes* the phrase in its own problem statement | yes | quoting it is enough to trip the regex |

**So #1637 was the right item all along.** The original card had the correct item and a wrong filename; the
first correction turned that into a wrong item. #1637 carries the defect and is silent only because the gate
does not warn on parked cards.

**What this means for the fix:** only **#3100, #1637 and #3183** need rewording as instances of this defect.
#3238 and #3103 warn for legitimate reasons — they discuss the phrase — and #2717 is a false positive of an
entirely different kind that this card does not own.

Baseline: `npm run check:standards` is **0 errors, 1437 warnings**, measured in a clean lane at `main`
`60acbe5f` on 2026-08-25, so every one of these is a warning and none is breaking the gate.

*(An earlier version of this line read **"0 errors, 1435 warnings"** with no basis named. The count itself
was wrong by the time it was read — 1435 was `main` at `b914eca2`, and `main` moved twice more the same day,
to `e7ab2833` and then `60acbe5f`, at both of which the count is 1437. Naming the sha is the actual fix: an unanchored
absolute count is stale the moment `main` moves, which is why Done-when 7 below states a **delta** and
#3233's Done-when 8 forbids hard-coding a number at all.)*

## The two defects are independent — say so, because the fixes differ

**(a) The note bypasses the locus-prefix lint.** Confirmed by construction, not inference:
`we:scripts/lint-locus-prefix.mjs` is wired as a `PreToolUse(Edit|Write)` hook in `we:.claude/settings.json`,
so it fires for an agent's file edit and cannot fire for a `node` process writing the same bytes directly.
`recordPrepVerdict` writes with `fs`, so every bare path in a juror's prose lands unchecked. (Live
demonstration: authoring *this* card through the Edit tool was refused twice — once for a personal email
address, once for four bare code-path refs — which is exactly the lint the node write path never reaches.)

**(b) The risk-strategy wording trips the non-batchable marker.** A phrase the note itself emits reads to
`we:scripts/check-standards.mjs` as the card asserting an unmet prerequisite, so an otherwise-batchable card
drops out of the agent-ready pool. This is a *wording* fix in the renderer, not a lint-routing fix.

## The decided design — round 2: use the writer the repo already has

**Round 1 proposed reusing `we:scripts/lib/citation-check.mjs` and returning a `bareRefs` array. Both halves
were wrong, and an independent reviewer showed why.**

- `we:scripts/lib/citation-check.mjs` **does not implement this check.** It owns dangling loci,
  anchor/ruling mismatches and the provenance gate. The detector the hook actually runs is
  `scanRepoLocusPrefixes`, exported from `we:scripts/check-standards-rules.mjs:1754` and imported by
  `we:scripts/lint-locus-prefix.mjs:32`. A builder working to round 1's declared scope would have edited the
  wrong module. (The same card cited `we:scripts/check-standards-rules.mjs` **correctly** for
  `findNonBatchableMarkers`, one section earlier.)
- **The repo already closed this exact mechanism gap, under this exact epic.**
  `we:scripts/backlog/guarded-write.mjs` is "THE ONE CARD-MUTATION WRITER", extracted under #3034 so a
  declared operation could call the same guard chain instead of re-deriving it. Its
  `assertPublishableContent` throws **before** the write, and its header names this gap verbatim: *a CLI
  writes straight to `fs`, so the PreToolUse hooks never see it — enforce at the SOURCE.*
- **Four sibling operations already route through it** — `we:scripts/operations/claim-io.mjs`,
  `we:scripts/operations/resolve-io.mjs`, `we:scripts/operations/scaffold-io.mjs`,
  `we:scripts/operations/explore-io.mjs`. The first states the rule outright at its line 21: *never a bare
  `writeFileSync`*. `we:scripts/operations/review-prep-io.mjs:195` is the **lone bare `writeFileSync`** on a
  card in that directory. This card is not adding a guard; it is bringing the one straggler into line.
- **Round 1 dropped part of the guard, and it is the dangerous part.** `writeBacklogMd` runs **three**
  refusals, not the two round 2 described: `laneGuardDecision`
  (`we:scripts/backlog/guarded-write.mjs:56` — lane ownership, no override), then `scrubPublish` (`:113` —
  secrets), then `scanRepoLocusPrefixes` (`:121` — locus). Round 1 covered only locus, so today a juror's
  prose containing a credential goes straight into a committed-and-pushed card. This card's own history is
  the proof: authoring it through the Edit tool was refused **twice** — once for a personal email address,
  once for bare code-path refs. Both content gates fired on this very content; round 1's design caught one,
  and neither round mentioned the lane guard at all.

**So (a) becomes: route `record`'s card write through `we:scripts/backlog/guarded-write.mjs#writeBacklogMd`.**
No new detector, no new module, no `bareRefs` plumbing — the writer throws, and the throw already carries
which rule failed and where.

**For (b):** change the emitted risk-strategy sentence so it no longer matches the marker regex. A string
change in the renderer, plus rewording the three cards that carry the emitted line.

## Interfaces

- `recordPrepVerdict` calls `writeBacklogMd` instead of a bare write. On a violation the writer **throws**
  before any mutation; `record` catches it and returns a determinate third outcome — the same shape #3230
  gives a failed verification, so the operation never reports a bare success.
- **`reason` distinguishes the three gates**, because they have different causes and different remedies:
  `'lane-guard'` (wrong tree — the caller must move, and there is no override), `'secret'` (the juror's
  prose carries a credential — it must be rewritten, and the value rotated), `'locus'` (bare code-path refs
  — prefixable). Collapsing them into one `'guarded-write'` would tell a caller a write failed and nothing
  about what to do, which is the failure mode this whole card is about.
- `renderPrepReviewSection` is **unchanged**. Round 1's second return form is dropped: the guard belongs at
  the write, not in the renderer, which is the whole point of a single card-writer.

## The marker is a named regex — the criterion can assert on it directly

The check is not a fuzzy scan. `we:scripts/check-standards-rules.mjs` exports `findNonBatchableMarkers`,
whose `unverified prerequisite` entry is the regex
`/\b(verify|unverified|unconfirmed)\b[^.\n]{0,60}\bbefore\s+(claim|build)/i`. The renderer's risk-strategy
sentence puts "verify" within sixty characters of "before build", which is the whole of the false positive.

That matters for acceptance: because the rule is an exported pure function, the criterion can call it
instead of eyeballing gate output. Round 1 wrote "`npm run check:standards` fails before and passes after",
which the `acceptance` juror correctly refuted — the gate exits **0** both before and after (all four are
warnings against a 0-error baseline), so exit code proves nothing and the criterion was unfalsifiable as
written.

## Tasks

1. **Grep the repo for the exact emitted phrase FIRST** — this is task 1, not task 2, because skipping it is
   what produced both the original card's wrong filename and round 1's wrong item set.
2. Reword the risk-strategy sentence in the renderer so it no longer satisfies the regex.
3. Reword the three cards that carry the **renderer-emitted** line: **#3100, #1637, #3183**. Explicitly NOT
   #3238 or #3103 (they discuss the phrase, and warn legitimately) and NOT #2717 (an unrelated phrase and a
   different defect this card does not own).
4. Replace `we:scripts/operations/review-prep-io.mjs`'s bare write with
   `we:scripts/backlog/guarded-write.mjs#writeBacklogMd`.
5. Catch the writer's throw in `record` and return the `guarded-write` third outcome.
6. Tests for all of it.

## Delivery shape

Incremental behind `main`. Can land in #3233's PR or its own; no ordering constraint beyond touching the same
renderer, so if it lands separately it should land **after** #3233 to avoid a textual conflict in `record`.

## Done when

1. **Executable** — a vitest case imports `findNonBatchableMarkers` from
   `we:scripts/check-standards-rules.mjs`, feeds it the output of `renderPrepReviewSection` for a verdict
   **whose risks include a PREMISE entry with `addressed: false`**, and asserts the returned array is
   **empty**. The fixture shape is named rather than left as "a representative verdict": the PREMISE risk's
   strategy text is the only thing that trips the regex, so a verdict omitting it would pass trivially both
   before and after and prove nothing (red-team finding). It is non-empty today, so this fails before and
   passes after — by assertion, not by exit code.
2. **Executable** — a second case asserts the same over a **frozen fixture** copy of the **three** bodies
   being reworded (#3100, #1637, #3183), checked in beside the test. Deliberately not a live read of
   `we:backlog/*.md`: this test's purpose is "the reworded text no longer trips the marker", not "the repo
   currently contains that text", so unrelated edits must not redden it.
3. **Executable** — a case asserting `recordPrepVerdict` routes its write through `writeBacklogMd`: a note
   containing a bare code path makes it return `{recorded: false, reason: 'locus'}` and leaves the card on
   disk **unchanged**. Fails today (the bare write accepts it).
4. **Executable** — the same, for a note containing a **secret-shaped** string, asserting `reason: 'secret'`.
   This is the half round 1's design missed entirely, so it gets its own case rather than riding on case 3.
4b. **Executable** — the same for a write attempted from a tree the lane guard refuses, asserting
   `reason: 'lane-guard'`. Three cases, three reasons: a single shared `reason` fails all three.
5. **Executable** — a case asserting a clean note records normally, so the guard cannot be satisfied by
   always refusing.
6. **Mutation** — reverting to the bare write reddens cases 3 **and** 4 by name; reverting the reworded
   sentence reddens case 1 by name.
7. `npm run check:standards` shows no NEW warnings against **the baseline measured at build time** — do not
   hard-code a number: `main` moved three times on 2026-08-25 alone while this card was being prepared
   (`e9aa38f6` → `b914eca2` → `e7ab2833` → `60acbe5f`). An earlier draft said *"the 0-error / 1435-warning
   baseline"*; the figure was 1435 at `b914eca2` and is 1437 at `60acbe5f`. And its
   `unverified prerequisite` count drops by **one** — #3100, the only true instance among the four that
   warn. (#1637 and #3183 carry the line but do not warn, so rewording them changes no count; #3238 and
   #3103 keep warning because they discuss the phrase; #2717 is out of scope.) Stated as a count delta, not
   as pass/fail — the gate is green either way.

## Progress

2026-10-03 — implemented in the checkout based on `8385e39a454fd3b580e9a991217bfa660d35294a`.

- First probe: exact emitted-phrase grep found the renderer and #3100, #1637, #3183,
  plus the intentional discussions in #3103 and this card. Direct marker scans of the three
  affected cards each returned one unverified-prerequisite marker.
- Before: `npm run check:standards` against the original HEAD contents returned **0 errors,
  5511 warnings**. This is the measured build-time baseline, not the historical count above.
- Routed the card write in we:scripts/operations/review-prep-io.mjs through
  we:scripts/backlog/guarded-write.mjs. Guard errors retain their messages and identify the
  refusal through `Error.cause`; the sink returns `recorded: false`, `verified: false`, and
  the distinct `lane-guard`, `secret`, or `locus` reason before staging or publication.
  Unexpected filesystem failures still propagate.
- Reworded the PREMISE strategy in we:scripts/operations/review-prep.mjs and only the three
  emitted notes named in scope. Added frozen full-body copies inline in
  we:scripts/operations/__tests__/review-prep.test.mjs, avoiding helper files and live-card reads.
- Mutation proof: temporarily restoring the bare write failed the three named cases
  `locus refusal leaves the card unchanged and performs no publication`,
  `secret refusal leaves the card unchanged and performs no publication`, and
  `lane-guard refusal leaves the card unchanged and performs no publication`.
  Restoring the original strategy failed
  `unaddressed PREMISE strategy does not assert an unverified prerequisite` with a marker at
  rendered line 7. Both mutations were restored immediately afterward.

- Current attribution differs from the historical acceptance note: #3100 is now resolved,
  #1637 remains parked, and #3183 now warns (its blocker #3194 is resolved). The first
  changed-tree scan reduced unverified-prerequisite warnings from **4 to 3**, removing #3183.
  It also exposed a newly displaced line citation to we:scripts/operations/__tests__/review-prep.test.mjs
  from #4684; placing the added import in the existing import separator preserves the cited lines.

- Focused verification: **81 tests passed** across
  we:scripts/operations/__tests__/review-prep.test.mjs,
  we:scripts/operations/__tests__/review-prep-io.test.mjs, and
  we:scripts/backlog/__tests__/primary-write-guard.test.mjs. Existing clean-note recording,
  staged-byte verification, and guarded-writer contracts remain green.
- Required wider run: `node we:scripts/verify-lane.mjs` selected 18 targets and completed
  **7238 passing / 6 failing tests**. All six failures are the real process-table cases in
  we:scripts/operations/__tests__/restart-runner-io-real.test.mjs and
  we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs. Directly spawning
  `/bin/ps` returned `EPERM`. Re-running those two suites with all three changed production
  modules temporarily restored to HEAD reproduced the **same six failures** (11 other tests
  passed). The changed modules were restored afterward. This run recorded a red lane marker;
  no tests, exclusions, or gates were weakened to hide the sandbox limitation.

- Final `npm run check:standards`: **0 errors, 5524 warnings** after resolution. Compared
  warning identities against the measured 5511-warning baseline: **no new warnings from this
  change**; 16 additional remote-main nonnumeric-ID diagnostics appeared during the run,
  while three card warnings disappeared (the #3183 premise marker, this card's marker after
  resolution, and this card's legacy scope warning). Those external diagnostics account for
  the raw count increase. Before resolution the premise-marker count was **4 → 3**;
  resolving this quoting card then made it **3 → 2**. The scope rationale documents that
  we:scripts/check-standards-rules.mjs is a read-only test dependency, not an edited deliverable.
- `node we:scripts/operations/run.mjs resolve --ref=3238` completed with one effect applied;
  the card is resolved. `git diff --check` passed. No helper files, commits, pushes, or PRs
  were created for this change.

## Follow-ups

- Re-run `node we:scripts/verify-lane.mjs` in an environment permitted to read the process
  table. This sandbox cannot grant that permission; the six baseline failures above are
  outside the card's declared implementation scope.

- Temporary primary-checkout fixtures must use a realpath-normalized root on macOS, where
  the temporary directory can be reached through a symlink. Otherwise the lane test compares
  different root spellings and does not exercise the intended refusal.
