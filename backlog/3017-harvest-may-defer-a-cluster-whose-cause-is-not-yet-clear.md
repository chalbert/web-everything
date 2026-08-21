---
bornAs: xku0t6u
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
tags: []
---

# Harvest may defer a cluster whose cause is not yet clear

Fork 4 of #2978 rules that a harvest need not drain the whole pool. Archiving is per session FILE today (archivePool in we:scripts/conveyor/learnings-harvest.mjs), and archived entries are unrecoverable, so a file mixing acted-on and deferred notes is all-or-nothing. Keep the append-only design: archive as today, then re-emit deferred clusters as a fresh deferred-<stamp>.jsonl carrying the deferral reason and count. A repeatedly-deferred cluster surfaces as its own finding.

## Design

**Why re-emit rather than partially archive.** `archivePool` (`we:scripts/conveyor/learnings-harvest.mjs:212`)
moves whole **files** — `renameSync` per file into `<pool>/harvested/<stamp>/` (`:246-252`) — and the
harvest's unit of adjudication is the **cluster**, which spans files (`readPool`, `:104`, tags each entry
with the session file it came from; `dedup` then groups across them). So one session file routinely mixes
acted-on and deferred entries, and there is no file-level split that separates them. Splitting `archivePool`
into a line-level mutator would also break the property the review of PR #1068 fought for: archiving is a
bounded, acknowledged move of exactly what step 1 read, refusing to run unbounded (`:234-239`). Re-emission
keeps that property intact — archive everything read, then write the deferred entries back as a **new** pool
file, which the next harvest reads like any other.

**Shape.** A `--deferred=<file>` (or stdin) input to the archive step that writes
`<pool>/deferred-<stamp>.jsonl` **before** the rename, one JSONL line per deferred member, in the same shape
`readPool`/`validateEntry` accept — so the next run needs no special case. Two fields have to ride along and
the current schema has nowhere to put them: the **deferral reason** and the **deferral count**. That is the
sub-decision this card must settle before it is built, and it is a real fork:

- **(a) extend the schema.** Add `deferredReason` + `deferredCount` to `ALLOWED_KEYS`
  (`we:scripts/conveyor/learnings-drop.mjs:60`). Clean for readers; but that allow-list *is* the privacy
  boundary, and every widening of it is a widening of what can be written into the pool.
- **(b) keep them out of the entry, in the filename or a sidecar.** `deferred-<stamp>.jsonl` already carries
  the stamp; a small sidecar meta file beside it, or a `#`-prefixed header line (`readPool` at `:115`
  already skips lines starting with `#`), carries reason and count without touching the schema.

**(b) is still the better default, but not for the reason first given.** An earlier draft argued "the count
is derivable by the next harvest anyway (it re-clusters)" — the independent review falsified that, correctly:
re-clustering the live pool recovers a cluster's *current* member and session counts, **not how many prior
rounds already deferred it**, because each earlier round's session files are archived and unreadable. The
"deferred five times → chronic" signal Fork 4 asks for therefore requires an **explicitly carried-forward
counter**; it cannot be reconstructed. (b) still wins on the remaining grounds — the reason is provenance
rather than content, and the allow-list stays untouched — and a sidecar carries a counter just as well as a
schema field does. Whoever builds this should say which they took and why.

**The repeated-deferral finding.** "Surfaces as its own finding" means: when the next harvest reads a
cluster whose members carry a prior deferral, it reports that fact in the harvest report rather than
silently re-deferring. That is a reporting rule for `we:skills-src/harvest-learnings/SKILL.md`, not a new
script behaviour — the script's job ends at making the prior deferral visible in what it emits.

**What in the skill changes.** `we:skills-src/harvest-learnings/SKILL.md` step 4 currently says *"If you
deliberately left candidates un-acted (below the recurrence floor), do NOT archive"*. Its **reasoning**
survives — an un-adjudicated entry must never be archived — but its trigger does not, because #3019 deletes
the recurrence floor. Re-express it as: archive what you read, re-emit what you deferred, never leave the
pool with unadjudicated entries in the archived set.

## Done when

1. **tier 1 — deferred clusters come back.** `we:scripts/__tests__/learnings-harvest.test.mjs` asserts that
   archiving with a deferred set writes `deferred-<stamp>.jsonl` into the pool dir, that the archived files
   still move, and that a subsequent `harvestPool` over the same dir returns the deferred entries as
   candidates. Fails before — no deferred output exists.
2. **tier 1 — the deferral reason survives the round trip.** The same file asserts the reason recorded on
   deferral is readable from what the next harvest reads, by whichever channel the fork above settles on.
3. **tier 1 — the archive bound is not weakened, including on the new path.** The existing `archivePool`
   cases still pass unchanged (a bare `--archive` with neither `--files=` nor `--before=` still throws; a
   missing pool dir still throws `ENOPOOL`) **and** a new named case covers the new combination:
   `--deferred=<file>` passed *without* `--files=`/`--before=` must still throw. Deferral must not become
   the hole that re-opens the PR #1068 blocker.
4. **tier 2 — the sub-decision is recorded.** The item's close-out names which of (a)/(b) was taken and why,
   and if (a), `ALLOWED_KEYS` in `we:scripts/conveyor/learnings-drop.mjs` carries the new fields with the
   privacy-boundary comment updated to say why the widening is safe.
5. **tier 2 — the chronic-cluster signal actually surfaces, and the skill's step 4 is rewritten.** This is
   the card's headline promise and the first draft's Done-when never operationalized it, so it is explicit
   now: `we:skills-src/harvest-learnings/SKILL.md` instructs the reader to report a cluster carrying a prior
   deferral **as its own finding** rather than silently re-deferring it, its Report template has a line for
   it, its step-4 paragraph no longer keys on the recurrence floor and states the
   archive-what-you-read / re-emit-what-you-deferred rule, and `npm run skills:sync:check` exits 0. A build
   that ships single-round deferral with no chronic signal does not satisfy this card. Coordinate with
   #3019, which edits the same step-4 paragraph (`we:skills-src/harvest-learnings/SKILL.md:156`).

The commands that decide 1-3 and 5:

```
npx vitest run scripts/__tests__/learnings-harvest.test.mjs
npm run skills:sync:check
```

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: confirm by mutation or reversion BEFORE building) — The core premise (we:scripts/conveyor/learnings-harvest.mjs's archivePool moves whole files, is unrecoverable, and the current 4-key ALLOWED_KEYS in we:scripts/conveyor/learnings-drop.mjs has nowhere to put deferredReason/deferredCount) is verified true against the live repo. But the specific premise used to justify picking option (b) over (a) -- 'the count is derivable by the next harvest anyway (it re-clusters)' -- does not hold for the cross-round 'chronic cluster' signal #2978 Fork 4 asks for; re-clustering the live pool only recovers a cluster's CURRENT member/session count, not how many prior harvest rounds already deferred it, since earlier rounds' session files are gone once archived.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Grepped the repo for every caller of archivePool / `--archive` (ES import and subprocess/doc-example forms): the only real consumer is we:skills-src/harvest-learnings/SKILL.md step 4's example command, which the card's own 'What in the skill changes' section already updates. we:package.json's `harvest`/`harvest:status` scripts never invoke `--archive`, and we:scripts/conveyor/tick-core.mjs (the future cadence hook, #3014) does not call it yet.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:skills-src/harvest-learnings/SKILL.md step 4's 'below the recurrence floor' sentence (verified at `we:skills-src/harvest-learnings/SKILL.md:156`) is edited by BOTH this card and #3019 (we:backlog/3019-harvest-synthesizes-a-cluster-into-a-cause-story-not-an-elec.md, which deletes the --min-sessions floor per #2978 Fork 2). The card names this collision explicitly ('Coordinate with #3019, which edits the same paragraph') rather than leaving it a buried fork, though the mitigation is verbal coordination, not a structural `blockedBy` in either card's frontmatter (contrast we:backlog/3016-shrink-1068-to-the-ruled-design-delete-the-recurrence-admiss.md, which does declare `blockedBy: ["3015"]`).
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Tier-1 Done-when item 3 keeps the existing PR #1068 bound-refusal tests (we:scripts/__tests__/learnings-harvest.test.mjs, the 'REFUSES an unbounded archive' and 'THROWS when the resolved pool dir does not exist' cases at lines 213-217 and 251-254) passing unchanged, which guards against the new `--deferred` path quietly reopening that hole. It does not, however, name a NEW test for the untested combination of `--deferred=<file>` passed WITHOUT `--files=`/`--before=` -- so whether that specific new path still throws is left to the builder's judgment rather than pinned by a named assertion.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card's own opening sentence and Design section state a requirement -- 'a repeatedly-deferred cluster surfaces as its own finding' / 'reports that fact in the harvest report rather than silently re-deferring' -- but none of the five Done-when items (tier 1: items 1-3; tier 2: items 4-5) test or require it. Item 5 only requires the step-4 paragraph to state the archive/re-emit rule and to drop the recurrence-floor language; it says nothing about the reporting-rule addition the Design section promises for the harvest skill's red-team or report steps. A builder can satisfy every checkbox while shipping single-round deferral only, with the 'chronic cluster' signal never surfacing anywhere.

**Corrections applied by this review:**

- The card frames deferredCount as freely 'derivable by the next harvest anyway (it re-clusters)', but the cross-round 'a cluster deferred five times is chronic' signal Fork 4 asks for needs an explicitly carried-forward counter that re-clustering the live pool cannot reconstruct once earlier deferral rounds' session files are already archived away.

The preparation's factual citations (line numbers, quotes, PR #1068 history, the #2978 Fork 4 ruling it implements) all check out against the live repo, and the (b)-over-(a) schema fork is well-reasoned, but its own Done-when checklist never operationalizes the "repeatedly-deferred cluster surfaces as its own finding" promise stated in the card's own opening sentence — a real, filable gap, not a blocker.

_Recorded through the declared `review-prep` operation._

### Response to that review (2026-08-21)

Both "NOT addressed" risks accepted and fixed above:

- **premise** — the (b)-over-(a) rationale is rewritten. "The count is derivable by re-clustering" was
  false for the cross-round chronic signal, exactly as the review says; the counter must be carried
  forward explicitly. (b) still wins, on the two grounds that survive.
- **legibility** — Done-when criterion 5 now requires the chronic-cluster signal to actually surface in
  `we:skills-src/harvest-learnings/SKILL.md`'s instructions and Report template. A build shipping
  single-round deferral no longer satisfies the card.
- The reviewer's smaller note — no named test for `--deferred` passed without a bound — is folded into
  criterion 3.
