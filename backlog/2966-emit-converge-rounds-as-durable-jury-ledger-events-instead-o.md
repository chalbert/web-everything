---
bornAs: x43il30
kind: story
size: 2
status: open
dateOpened: "2026-08-06"
tags: []
---

# Emit /converge rounds as durable jury-ledger events instead of a private temp trail

The extracted convergence core keeps its own history and dismissed trail inside an ad-hoc temp state file rather than emitting the repo's durable jury ledger events (JURY_EVENT_TYPES / we:scripts/lib/jury-ledger.mjs). So the conveyor's jury tree and the #2642 console show NOTHING for pre-PR convergence work, and the parked-PR migration under #2970 would inherit two parallel trails for one loop. Emit the same ledger events the parked-PR path already appends, keeping the in-state history as the pure core's own audit record.

## Where the seam is

The split is already right and should not move: the CORE stays pure (no I/O, no clock) and keeps building the
`history` / `dismissed` arrays as a total function of its arguments; the CLI owns every effect. So the emission
belongs in we:scripts/converge-cli.mjs, next to where it already writes the state envelope — one ledger append
per round transition, derived from the `history` entry the core just returned.

## Design

**The exact write points.** `we:scripts/converge-cli.mjs` calls its `writeState` helper in three places:
once in `init` (seeds the envelope — this is where the roster is known), once in the accepted-invite branch
of `step` (after `applyJurorInvite`), and once on the ordinary path of `step` (after `convergeStep`).

**But a `writeState` is NOT the same thing as a round transition, and emitting on every one over-fires.**
`convergeStep`'s PANEL and RED_TEAM branches — and `applyJurorInvite`'s rejected-invite fallback — return
the state **unchanged**, with no new `history` entry; only the terminating and round-advancing branches
append one. So the emission must be gated on "the core appended a history entry this call", not on "the CLI
wrote state". (Raised by the independent review below.)

**And the history entry is not a sufficient source.** `we:scripts/lib/converge-core.mjs` builds
`historyEntry` with `findings: findings.length` — a **count**, not the finding objects. The objects live only
on `convergeStep`'s own return value. So a ledger append that needs per-finding events must read the step's
return, exactly as the cited precedent does (`we:scripts/workflows/review-parked-prs.mjs` passes
`findings: last.findings`, not a value read back out of history). Use the history entry for the round/verdict
shape and the step return for the findings; an earlier draft of this card said "never from a local
recomputation", which was wrong and would have made per-finding events impossible.

`JURY_EVENT_TYPES` lives in `we:scripts/lib/jury-core.mjs` (not in the ledger module, which re-exports the
builders over it). The four non-roster builders — `jurorRunningEvent`, `findingEvent`, `verdictEvent`,
`roundAdvancedEvent` — plus `appendJuryEvent` / `appendJuryEvents` are all exported from
`we:scripts/lib/jury-ledger.mjs`; `rosterPickedEvent` is in `we:scripts/lib/jury-core.mjs`. Every builder
validates its own shape and throws on a bad one, and the stream is validated again at append time, so a
malformed emission is caught at the seam rather than corrupting the log.

**The parked-PR path does NOT append event-by-event, and that is the shape to match.**
`we:scripts/workflows/review-parked-prs.mjs` hands a converged **state** to a recorder that shells the
ledger CLI's `record` subcommand:

```
node scripts/lib/jury-ledger.mjs record --subject=<key> --file="$TMP/converged-state.json"
```

`record` calls `buildReviewLedgerEvents` — the ONE tested place event construction lives — and appends the
batch in one go. So the DoD
line "the event shape matches" is best satisfied by **reusing that same builder** rather than hand-assembling
events in the converge CLI. If the converge state cannot be lowered to what `buildReviewLedgerEvents` takes
(`{ activeLenses, lensVerdicts, findings, rounds, reviewedSha }`), that mismatch is the real work of this
item and should be named in the PR, not papered over with a second construction site.

**The unsettled part: the subject key — and it is harder than it looks.** `appendJuryEvent(subjectKey, …)`
writes one JSONL file per subject, and the schema carries no subject field: a log IS the subject. The
parked-PR path keys on `repo#pr`. A pre-PR converge run has **no PR** — `envelope.ctx` holds only
`{ laneRoot, baseRef, changedFiles, goal }`.

The obvious candidate, the backlog item id, is **not readable from the lane at that moment**: `/converge` is
step 6 of the delivery brief ("converge BEFORE the PR") and `we:.lane-manifest.json` is written at step 8
(commit + publish), so the manifest does not exist in the lane yet. Nor is `laneRoot` usable — it is a pool
slot that gets recycled. So the realistic option is to **pass the item id in** (a new `--item=` flag on
`init`, which the delivery agent already knows), and the alternative is to accept a lane-scoped key and
reconcile at #2970 migration time. Pick one and say why in the PR; the requirement is that a pre-PR run and
the later parked-PR run of the same work land on the SAME subject log, or the console shows two runs where
there was one.

**Fail-open is not automatic — but the failure mode is not the one you would guess.** `appendJuryEvent` does
**not** throw on an invalid event; it returns `{ ok: false, errors }`, so a malformed emission is a silent
no-op unless the caller inspects the result. What DOES throw is the pure builders (`jurorRunningEvent`,
`findingEvent`, `verdictEvent`, `roundAdvancedEvent`, `rosterPickedEvent`) on a bad raw shape, and the
`mkdirSync` / `appendFileSync` underneath on an unwritable dir. So the emission point needs BOTH: a
try/catch around the builders and the write, AND a check of the returned `ok` so a rejected event is
reported to stderr rather than vanishing.

## Done when

- Every round transition appends its ledger events, and a run whose ledger directory is **unwritable** still
  prints its verdict and exits with the same code as a run with a writable one. Both pinned in the existing
  CLI suite; both fail before and pass after:

  ```
  npx vitest run scripts/__tests__/converge-cli.test.mjs
  ```

- `we:scripts/lib/converge-core.mjs` imports nothing from `we:scripts/lib/jury-ledger.mjs` or
  `we:scripts/lib/jury-core.mjs`'s event surface — the core stays pure. Cheap check: grep the core for
  `jury-ledger` and get no hits.
- After a converge run against a temp `CONVEYOR_JURY_DIR`, `foldJuryLedger` over the written log yields a
  non-empty roster and the run's verdict — i.e. the events are readable through the SAME fold the #2642
  console and the conveyor tree use, not merely written.
- Event construction happens in exactly one place. Either the converge CLI shells / calls
  `buildReviewLedgerEvents`, or the PR states explicitly why the converge state cannot be lowered to it.
- The chosen subject key is stated in the PR body with its rationale, and is stable across a pre-PR run and
  the later parked-PR run of the same work.

Found in the PR #1064 human review.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion, ahead of implementation) — Two of the card's settled design claims do not hold against the live repo: (1) it instructs deriving ledger events 'from the history entry the core just returned... never from a local recomputation', but we:scripts/lib/converge-core.mjs's historyEntry stores `findings: findings.length` (a count, not the finding array) - the actual finding objects live only in convergeStep's/applyJurorInvite's own return value, which is exactly the 'local recomputation' the card forbids, and which is precisely what we:scripts/workflows/review-parked-prs.mjs (the card's own cited precedent) uses (`findings: last.findings`) rather than reading from persisted history; (2) it proposes keying the ledger subject on 'the backlog item id (readable from the lane's manifest)', but we:scripts/readiness/lane-manifest.mjs / we:scripts/lane-manifest-write.mjs write `we:.lane-manifest.json` into the lane's git commit only at delivery-brief step 8 (commit+push), which is AFTER step 6 ('converge BEFORE the PR') where /converge actually runs, so the manifest will not exist at the /converge `init` call site in the normal flow.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — `we:scripts/converge-cli.mjs` is invoked from exactly one place (we:skills-src/converge/SKILL.md) plus its own test file, verified by a repo-wide grep for 'converge-cli' - and the card correctly names the ledger's real consumers (the #2642 console and the conveyor jury tree via we:scripts/lib/jury-ledger.mjs's foldJuryLedger). No unnamed consumer surfaced.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card correctly insists emission must not become a silent gate (explicit try/catch, report to stderr, continue) - the right shape given appendFileSync/mkdirSync can throw on an unwritable dir. One factual slip (see corrections): it attributes the throw to `appendJuryEvent` itself, which actually returns `{ok:false, errors}` on an invalid event; only the builders throw. The overall try/catch guidance is still correct regardless.

**Corrections applied by this review:**

- we:scripts/lib/jury-ledger.mjs's `appendJuryEvent` does not throw on an invalid event - it returns `{ok:false, errors}`; only the pure builders (`jurorRunningEvent`, `findingEvent`, `verdictEvent`, `roundAdvancedEvent`, and `rosterPickedEvent` in we:scripts/lib/jury-core.mjs) throw on a malformed raw shape, so the card's 'appendJuryEvent throws on an invalid event' should read 'the event builders throw'.
- The 'ordinary path of step (after convergeStep)' write point in we:scripts/converge-cli.mjs does not fire only on round transitions: convergeStep's PANEL, RED_TEAM, and continue-with-EDIT branches (and applyJurorInvite's rejected-invite fallback) all return the state unchanged with no new we:scripts/lib/converge-core.mjs `history` entry, so most `step()` calls have no 'freshly appended' history entry to emit from.
- `we:.lane-manifest.json` is not present in a lane's working tree at the point /converge runs: per we:skills-src/conveyor/delivery-agent-brief.md, /converge is step 6 ('converge BEFORE the PR') while the manifest is written at step 8 (commit/push, via `we:scripts/lane-manifest-write.mjs`), so 'readable from the lane's manifest' is not achievable at the CLI's `init` call site as described.

The seam identification and reuse-vs-hand-build framing are sound, but two "settled" design claims fail against the live repo: the instruction to derive ledger events from the core's persisted `history` entry (which only stores a findings count, not the objects) contradicts the very precedent it cites, and the proposed subject-key source (the lane manifest) does not exist at the time /converge actually runs.

_Recorded through the declared `review-prep` operation._
