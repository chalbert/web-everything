---
bornAs: xyg1k8p
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
preparedDate: "2026-08-25"
relatedTo: ["3233", "3230"]
tags: [operations, epic-3029, review-prep, preparation, gate]
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

| item | carries the renderer line? | warns? | why |
| --- | --- | --- | --- |
| #3100 | **yes** — body line 140 | yes | the only true instance of this defect |
| #1637 | **yes** — body line 78, put there by the `review-prep` run that landed as PR #1270 | no | `status: parked`, so not batchable |
| #3183 | **yes** — body line 122 | no | carries `blockedBy: ["3194"]` |
| #3238 | no — *quotes* the phrase in its own problem statement | yes | quoting it is enough to trip the regex |
| #3103 | no — the row that *defines* the phrase in the risk enum | yes | ditto |
| #2717 | no — line 11 reads `verify before claim`, a different phrase about a stale `blockedBy` | yes | unrelated to `review-prep` entirely |

**So #1637 was the right item all along.** The original card had the correct item and a wrong filename; the
first correction turned that into a wrong item. #1637 carries the defect and is silent only because the gate
does not warn on parked cards.

**What this means for the fix:** only **#3100, #1637 and #3183** need rewording as instances of this defect.
#3238 and #3103 warn for legitimate reasons — they discuss the phrase — and #2717 is a false positive of an
entirely different kind that this card does not own.

Baseline: `npm run check:standards` is **0 errors, 1435 warnings**, so every one of these is a warning and
none is breaking the gate.

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
- **Round 1 dropped half the guard, and it is the dangerous half.** `assertPublishableContent` runs
  `scrubPublish` (secrets) **and** `scanRepoLocusPrefixes` (locus). Round 1 covered only locus. So today a
  juror's prose containing a credential goes straight into a committed-and-pushed card. This card's own
  history is the proof: authoring it through the Edit tool was refused **twice** — once for a personal email
  address, once for bare code-path refs. Both gates fired on this very content; round 1's design caught one.

**So (a) becomes: route `record`'s card write through `we:scripts/backlog/guarded-write.mjs#writeBacklogMd`.**
No new detector, no new module, no `bareRefs` plumbing — the writer throws, and the throw already carries
which rule failed and where.

**For (b):** change the emitted risk-strategy sentence so it no longer matches the marker regex. A string
change in the renderer, plus rewording the three cards that carry the emitted line.

## Interfaces

- `recordPrepVerdict` calls `writeBacklogMd` instead of a bare write. On a guard violation the writer
  **throws** before any mutation; `record` catches it and returns
  `{recorded: false, reason: 'guarded-write', detail: <the writer's message>}` — a determinate third
  outcome, the same shape #3230 gives a failed verification, so the operation never reports a bare success.
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
   containing a bare code path makes it return `{recorded: false, reason: 'guarded-write'}` and leaves the
   card on disk **unchanged**. Fails today (the bare write accepts it).
4. **Executable** — the same, for a note containing a **secret-shaped** string. This is the half round 1's
   design missed entirely, so it gets its own case rather than riding on case 3.
5. **Executable** — a case asserting a clean note records normally, so the guard cannot be satisfied by
   always refusing.
6. **Mutation** — reverting to the bare write reddens cases 3 **and** 4 by name; reverting the reworded
   sentence reddens case 1 by name.
7. `npm run check:standards` shows no NEW warnings against the 0-error / 1435-warning baseline, and its
   `unverified prerequisite` count drops by **one** — #3100, the only true instance among the four that
   warn. (#1637 and #3183 carry the line but do not warn, so rewording them changes no count; #3238 and
   #3103 keep warning because they discuss the phrase; #2717 is out of scope.) Stated as a count delta, not
   as pass/fail — the gate is green either way.
