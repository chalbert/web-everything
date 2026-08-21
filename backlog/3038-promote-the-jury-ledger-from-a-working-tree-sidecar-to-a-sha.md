---
bornAs: xmhw1m5
kind: story
size: 5
parent: "2572"
status: open
dateOpened: "2026-08-08"
tags: []
---

# Promote the jury ledger from a working-tree sidecar to a shared store

The durable jury log lives at .conveyor/jury/ inside a working tree and is gitignored, so it is host-bound state. Ruling R7 on #2572 had to point the converge daemon at the operator primary checkout via CONVEYOR_JURY_DIR, and no other host can run a shadow pass at all. Promote it to a store any host can read so the ledger stops pinning the daemon to one machine.

## Why this is filed, and what it is NOT

Ruling R7 (#2572, 2026-08-08) scheduled the converge daemon as a **local launchd job**, and named **two**
things pinning it to the operator's Mac:

1. **Auth** — the enforce-era pass spawns the `claude` CLI on the operator's *subscription*, and #2444
   ([#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)) settled that
   SDK-on-subscription is broken rather than merely worse. **Not fixable here, and not what this item is about.**
2. **State** — this item. The ledger is a working-tree sidecar, and that is an accident of convenience, not a
   forced constraint.

Fixing (2) alone does not move the daemon off the Mac. It *does* mean the **shadow half** could run anywhere —
including as a scheduled CI job — because a shadow pass spends **no model context at all**: it is `gh` reads plus
a ledger fold. That is the whole prize.

## What is actually host-bound

- [`we:scripts/lib/jury-ledger.mjs`](../scripts/lib/jury-ledger.mjs) — `juryLogDir()` resolves
  `<REPO_ROOT>/.conveyor/jury`, anchored to the *script* location, with `CONVEYOR_JURY_DIR` as the only override.
- [`we:.gitignore`](../.gitignore) — `.conveyor/jury/` is gitignored, so it never travels with a clone. A fresh
  checkout has an **empty** ledger.
- The fold is **fail-closed**: no ledger → no roster → keep parked. So an empty ledger does not error, it silently
  reports "keep everything parked" — which looks exactly like a healthy, working daemon and is not.

That last point is why R7 had to wire `CONVEYOR_JURY_DIR` explicitly and why
[`we:scripts/converge-daemon-install.mjs`](../scripts/converge-daemon-install.mjs) refuses to install when the
configured ledger dir is missing. Those are compensations for this defect, and they should be *deleted* by this
item, not kept.

## Scope of the call

The store is the fork; do not pre-empt it here. Candidates worth pricing: a committed-but-append-only location in
the repo (cheapest, but a gitignored operational log became gitignored for reasons worth re-reading first); a
sibling git repo the daemon pulls; SQLite on a shared path; or a real remote store. The **acceptance test** is
the same whichever wins — a converge daemon running from a clone with no local `.conveyor/` produces the same
shadow disposition as one running against the primary checkout.

## Design

**The surface is smaller than it looks — one resolver, threaded through every entry point.** In
`we:scripts/lib/jury-ledger.mjs`, `REPO_ROOT` is derived from `import.meta.url` and `juryLogDir(root =
REPO_ROOT)` returns `CONVEYOR_JURY_DIR` when set, else `<root>/.conveyor/jury`. Everything else in that
module — `juryLogPath`, `appendJuryEvent`, `appendJuryEvents`, `readJuryLog`, `listJurySubjects`,
`foldSubject`, `foldAllSubjects` — already takes a `{ root }` option that flows into `juryLogDir`. So the
store abstraction lands **behind that one function** and every reader/writer inherits it; a design that adds
a second resolution path anywhere else has missed the seam.

**That is only true for a PATH-shaped store, and the fork includes two that are not.** A committed repo
location or a pulled sibling clone is still a directory, so `juryLogDir` alone carries it. **SQLite or a
remote store is not** — those also require replacing the raw `appendFileSync` / `readFileSync` / `mkdirSync`
/ `readdirSync` / `existsSync` calls inside `appendJuryEvent`, `appendJuryEvents`, `readJuryLog` and
`listJurySubjects`, i.e. a storage-adapter seam rather than a path resolver. Price that difference when
ruling the fork; it is most of the size delta between the candidates. (Raised by the independent review
below.)

**The two env vars are distinct and both must be accounted for.** `CONVERGE_DAEMON_JURY_DIR` is the
*daemon's config* (read in `we:scripts/converge-daemon-pass.mjs`, defaulted to `<primary>/.conveyor/jury`,
rendered into the launchd plist and the systemd unit by `we:scripts/converge-daemon-install.mjs`).
`CONVEYOR_JURY_DIR` is the *ledger module's* override, which the daemon sets on the spawned runner's
environment from its own config value. A build that removes one and leaves the other in place has moved the
coupling, not removed it — which is why the criterion below names both.

**What the gitignore comment says, and why it is a fork and not an oversight.** `we:.gitignore` classifies
`.conveyor/jury/` as *"Operational observability state (the #2612 single source of truth), machine-local,
never committed"*, next to the identically-classified `.conveyor/micro-decisions/`. The governing statute
[`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
names two homes — transient session intent in a gitignored sidecar, durable item readiness in committed
frontmatter — and this ledger is **neither**: it is durable, machine-written, high-volume observability. So
"why was it gitignored" has an answer worth reading before overturning it, and whichever store wins, this
item is also asking the statute a question it does not currently answer. Say so in the ruling rather than
committing a JSONL stream and calling it settled.

**The failure mode this exists to kill is a silent one, so the proof has to be a comparison, not a green
run.** The fold is fail-closed: no ledger → no roster → keep everything parked. An empty ledger therefore
produces a plausible, non-erroring "keep parked" disposition. A test that asserts "the bare-clone pass
succeeded" would pass today, against the bug. The criterion below is deliberately a **differential**: same
subject, two hosts, same disposition — and it must be run with a NON-EMPTY ledger, because two empty
ledgers also agree.

**Do not delete the compensations before the store works.** `installBlockers` in
`we:scripts/converge-daemon-install.mjs` refuses to install when the configured ledger dir is missing, and
that refusal is the only thing today standing between an operator and a soak that records nothing. Replace
it with the equivalent check against the shared store in the same commit; do not drop it in an earlier one.

## Done when

- `juryLogDir()` returns the same path for two different working trees. Pinned in the existing suite —
  the assertion fails before (it is a function of `REPO_ROOT`) and passes after:

  ```
  npx vitest run scripts/lib/__tests__/jury-ledger.test.mjs
  ```

- The differential: with a NON-EMPTY ledger, a shadow pass run from a bare clone that has no local
  `.conveyor/` folds the **same** verdicts and produces the **same** disposition as one run against the
  primary checkout. Not "it ran" — the two dispositions are compared and equal.
- Neither `CONVERGE_DAEMON_JURY_DIR` nor `CONVEYOR_JURY_DIR` is required for a correct pass. Cheap check:
  grep `we:scripts/` for both names; every surviving hit is a documented legacy override, not a load-bearing
  wire, and `we:scripts/converge-daemon-pass.mjs` no longer needs to inject one onto the spawned runner.
- `installBlockers` either no longer has a ledger-dir blocker or checks the shared store, and its unit cases
  in `we:scripts/__tests__/converge-daemon.test.mjs` are updated in the SAME commit — the install must never
  be left able to schedule a silently-empty soak.
- The store choice is recorded with its reasoning, including why the `we:.gitignore` "machine-local, never
  committed" classification no longer applies — or, if the store stays uncommitted, how it is shared.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — Every load-bearing claim (we:scripts/lib/jury-ledger.mjs:71-74 juryLogDir/CONVEYOR_JURY_DIR, we:.gitignore's exact 'machine-local, never committed' comment, we:backlog/2572-...md's R7 ruling text, we:backlog/2444-...md and we:backlog/2612-...md existing) was verified against the live repo and holds verbatim, not just against the card's own stale local citations.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Card names every ES-import consumer of we:scripts/lib/jury-ledger.mjs (we:scripts/conveyor/jury-tree.mjs, we:scripts/review-runner.mjs, we:scripts/lib/pipeline-trace.mjs, we:scripts/lib/micro-decision-surface.mjs — independently confirmed via git grep) and the one subprocess/env wire (we:scripts/converge-daemon-pass.mjs spawning `we:scripts/review-runner.mjs` with CONVEYOR_JURY_DIR injected, we:scripts/lib/gate-config.mjs:246's doc-only mention flagged as non-load-bearing) — both channels covered.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — No seam is built yet (the store choice is explicitly deferred as 'the fork'), but the card substitutes a differential proof (same disposition from two hosts) as the seam's round-trip test in the Done-when section, which is the right stand-in for a not-yet-chosen store; weakened only by the 'one function' overclaim noted in corrections.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card explicitly identifies that a naive 'the bare-clone pass succeeded' test would pass against the bug (fail-closed empty ledger → plausible keep-parked), and requires the differential be run with a NON-EMPTY ledger specifically because two empty ledgers trivially agree — this is exactly the mutate-the-guarded-line discipline the risk calls for, applied in prose since no code exists yet to mutate.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — Card is explicit and correctly scoped about what the fix does and doesn't unblock ('Fixing (2) alone does not move the daemon off the Mac' — auth via #2444 remains local-only) and grounds the actual prize (a context-free shadow pass) rather than overclaiming.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The whole card is organized around the failure surfacing rather than being silent: it requires installBlockers' compensation to stay in place until the store works ('do not delete the compensations before the store works'), so an unready store still refuses to install rather than silently soaking nothing.

**Corrections applied by this review:**

- The Design section's claim that the store abstraction 'lands behind that one function' only holds for path-shaped store candidates (a committed repo location, or a pulled sibling clone); it doesn't hold for the SQLite or remote-store candidates the same section leaves open, since those would also require rewriting the raw fs calls (appendFileSync/readFileSync/mkdirSync/readdirSync/existsSync) inside we:scripts/lib/jury-ledger.mjs's appendJuryEvent, appendJuryEvents, readJuryLog, and listJurySubjects, not just juryLogDir().
- The Design section's remark 'The DoD's third bullet names only the first [env var]' doesn't match the card's own '## Done when' section, whose third bullet already names both CONVERGE_DAEMON_JURY_DIR and CONVEYOR_JURY_DIR — this looks like a stale note left over from an earlier draft of the Done-when list.

A well-grounded preparation: every file/line/citation it makes (juryLogDir, the .gitignore comment, R7's text, #2444/#2612, the two env vars, installBlockers, and the full consumer set) checks out against the live repo (origin/main — the local lane checkout is 167 commits stale and was cross-checked), and its acceptance test is deliberately designed to defeat the exact silent-failure mode (fail-closed empty ledger) it names as the defect; two prose-level issues need fixing but don't undermine the actionable Done-when criteria.

_Recorded through the declared `review-prep` operation._
