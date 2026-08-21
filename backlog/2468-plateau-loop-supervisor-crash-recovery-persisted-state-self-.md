---
bornAs: xgfj975
kind: story
size: 8
parent: "2445"
status: open
blockedBy: ["2456"]
priority: low
dateOpened: "2026-07-12"
tags: []
---

# Plateau Loop: supervisor — crash recovery, persisted state, self-update-then-reload

The residency layer the red-team flagged: crash recovery, persisted state across sleep/reboot, and the self-hosting boundary (coordinator drains its own PR, restarts, resumes) with #2077-style self-exclusion so it never parallel-edits itself. Parked behind evidence.

## What the phase-1 daemon already delivers — do not rebuild it

Read against `plateau-app` on 2026-08-21. #2449's resident drain daemon already solves most of the
"residency layer" for the *drain* slice, and this item is about extending that shape to the wider
coordinator — not inventing it:

- **Supervision is delegated to launchd, not hand-rolled.** `renderLaunchdPlist` in
  `plateau:tools/drain-daemon/lib.mjs` emits `RunAtLoad` + `KeepAlive`, so residency survives crash,
  logout/login, reboot and sleep by construction. Its doc-comment states the design premise this item
  inherits: *"the daemon only has to be restart-safe … GitHub is the source of truth, the lease is
  TTL-reclaimable, local state is observability only."* Any supervisor this item builds should keep that
  premise or explicitly argue it no longer holds.
- **Persisted state exists and is bounded.** `plateau:tools/drain-daemon/daemon.mjs` reads/writes
  a state file under the resolved state root (`readState`/`writeState`, `:67`/`:70`), folds each pass in
  through the pure `updateStateAfterPass` (`plateau:tools/drain-daemon/lib.mjs`), appends to a pass-history journal with a rotation cap (`shouldRotateHistory`, `HISTORY_MAX_BYTES`), and carries a `starts`
  counter across restarts (`plateau:tools/drain-daemon/daemon.mjs:290-292`).
- **Crash recovery is already observable.** Every (re)start appends a structured `restart` incident marker
  (`:295`), and `deriveIncidents` in `plateau:tools/drain-daemon/lib.mjs` reads `restart` and `lease-loss`
  rows out of that journal. #2456's interim review found 3 restarts in 26 h, **all operator-driven deploys,
  zero autonomous crash-recovery firings** — so this item's crash-recovery half is currently unexercised
  in practice, which is precisely why it is parked behind evidence.
- **Lease re-arbitration on restart works.** `decideLoopAction` (`plateau:tools/drain-daemon/lib.mjs`)
  plus the acquire branch at `plateau:tools/drain-daemon/daemon.mjs:310-314` re-arbitrate the whole-process
  drain lease on every tick, and a restart-while-paused still re-acquires before parking (`:316-321`).
  Shutdown is signal-driven (`SIGINT`/`SIGTERM` → release-and-exit, `:269`) with no cooperative stop flag,
  by design.

**So the residual this item owns** is the part the drain slice does *not* cover: state that spans more than
one drain pass (a coordinator's queue/lane-pool/review state machine, resumed from disk after a kill), and
the **self-update-then-reload boundary** — the coordinator draining its own PR, restarting onto the new
code, and resuming — with #2077-style self-exclusion so it never parallel-edits itself. On the WE side that
self-exclusion is `we:scripts/readiness/lane-partition.mjs` (see #2422, which builds the `RUN_TOOLING`
predicate this needs) and `TRUST_CHAIN` in `we:scripts/lib/gate-config.mjs` (which already registers the
daemon's own sources at engine tier, #2480/#2499).

## Why it stays parked, and what unparks it

#2456 sets the gate explicitly: ≥ ~2 weeks of mostly-unattended operation, human-pull rate ≲1/day-equivalent,
zero unresolved drain-class incidents, incident/anomaly trend flat-or-declining — all readable in one
`evidence` command. **Do not start this item before #2456's review closes**; a supervisor built for
crash-recovery paths that have never fired is designed against imagination, not evidence. That gate is now
mechanical, not prose: this item carries `blockedBy: ["2456"]`, the same shape its sibling slices use, so
the readiness ranker drops it out of Tier A until the evidence review resolves.

## Done when

This item is `size: 8` and mostly lives in `plateau-app`, so criteria 1-3 are the buildable core and 4-5 are
the boundary conditions that make it safe.

1. **tier 1 — resume is proven, not asserted.** In `plateau-app`, the drain-daemon unit suite
   (`plateau:tools/drain-daemon/lib.test.mjs`) gains cases for the resume decision over a persisted state
   snapshot: given state written mid-work plus the on-disk journals, the pure resume function returns the
   correct next action for (a) a clean shutdown, (b) a kill mid-pass, (c) a state file that is missing, and
   (d) one that is corrupt. All four are pure over injected state — no daemon process needed.
2. **tier 1 — self-exclusion holds, across a named seam.** The same suite asserts the coordinator refuses to
   apply an update that touches its own executing sources while a run is live, using the `RUN_TOOLING`
   predicate #2422 builds. **State the seam shape explicitly**: plateau-app and web-everything are separate
   repos with no submodule or package link, and #2422 as scoped exports `isRunTooling` from a WE-only ESM
   module — which plateau **cannot import**. The established precedent for this boundary is the daemon's own
   ("ALL review/land logic stays in `we:scripts/`, the child"): a **subprocess shell-out to a WE CLI
   returning JSON**, the way `we:scripts/readiness/file-locks-cli.mjs` wraps a pure readiness module today.
   So the criterion is: the plateau side calls a WE CLI and asserts against its JSON, with the WE side
   owning the predicate. Fails before — neither the refusal nor the CLI exists.
3. **tier 1 — the reload is a real restart, not an in-process patch.** A case asserts the self-update path
   ends in "exit and let launchd relaunch", never in reloading modules inside the running process. The
   existing signal-driven `releaseAndExit` shape is what this must reuse.
4. **tier 2 — every recovery path leaves a marker.** A crash-recovery firing appends a distinguishable
   incident row (not just the existing generic `restart`), so `deriveIncidents` can tell an operator deploy
   from a genuine recovery — the exact ambiguity #2456's interim review had to reason around by hand.
5. **tier 3 — the #2456 evidence gate is cited in the close-out**, with the `evidence` numbers that met it.
   Starting this item without that citation is starting it early.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: confirm by mutation or reversion BEFORE building) — All load-bearing factual claims re-verified against the live plateau-app repo (HEAD 4655dee6, 2026-08-18): renderLaunchdPlist/RunAtLoad+KeepAlive, readState/writeState at we-cited plateau:tools/drain-daemon/daemon.mjs:67/:70, the starts counter and restart-incident append at :290-292/:295, decideLoopAction + acquire branch at :310-313, restart-while-paused re-acquire-before-park at :316-321, SIGINT/SIGTERM->releaseAndExit at :269, deriveIncidents/shouldRotateHistory/HISTORY_MAX_BYTES in plateau:tools/drain-daemon/lib.mjs, and the doc-comment quote at `plateau:tools/drain-daemon/lib.mjs:270-273` — all match verbatim or near-verbatim. The #2456 evidence numbers quoted (26.1h, 3 restarts, 0 autonomous firings) match backlog/2456's own interim-review text exactly, and #2456 is confirmed still open (interim only), so the parked-behind-evidence premise holds against the live repo today.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Criterion 2 has the plateau-app-side `plateau:tools/drain-daemon/lib.test.mjs` suite assert self-exclusion 'using the RUN_TOOLING predicate #2422 builds (we:scripts/readiness/lane-partition.mjs)', but plateau-app and web-everything are separate git repos (chalbert/plateau-app vs chalbert/web-everything, confirmed via `git remote -v`) with no submodule/package link between them. The established precedent for this exact boundary (`plateau:tools/drain-daemon/daemon.mjs`'s own doc-comments: 'ALL review/land logic stays in we:scripts/ (the child)') is subprocess shell-out, not ESM import — but #2422 as scoped builds RUN_TOOLING as a plain exported function in a WE-only module, not a CLI. The card doesn't say which shape crosses the repo boundary, so the WE-side builder (#2422) and the plateau-app-side builder (this item) could each assume a different seam shape and disagree, exactly the interface risk's failure mode.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Criterion 4 (a distinguishable crash-recovery incident row, separate from the generic 'restart' marker) directly targets making the operator-deploy-vs-genuine-recovery ambiguity surface in the journal instead of requiring hand-reasoning, which is exactly the gap #2456's interim review had to work around by hand.

**Corrections recommended:**

- none — the preparation held up as written.

The card's factual grounding in the live `plateau-app` repo (function names, line numbers, doc-comment quotes, #2456's interim evidence numbers) checks out with unusual precision, and the parking rationale is sound — but the card omits the mechanical `blockedBy` gate its own sibling items use, and criterion 2 elides a real cross-repo interface question.

_Recorded through the declared `review-prep` operation._

### Response to that review (2026-08-21)

Both points accepted and fixed above:

- **interface** — Done-when criterion 2 now names the seam shape: a **subprocess shell-out to a WE CLI
  returning JSON** (the daemon's own established boundary), not an ESM import across two unlinked repos.
  Without that sentence the WE-side builder (#2422) and the plateau-side builder could each assume a
  different seam.
- **the missing mechanical gate** — the item now carries `blockedBy: ["2456"]`, matching how its sibling
  slices express the same dependency, so the parking is enforced by the ranker rather than by a paragraph.
