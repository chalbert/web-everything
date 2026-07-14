---
bornAs: xhakcai
kind: epic
parent: "2445"
status: resolved
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, ui, console, observability]
---

# Loop console — health & anomaly detection (turn the mirror into a smoke detector)

The operable console ([#2474](/backlog/2474-plateau-loop-operable-console-manage-and-operate-the-drain-d/))
made the resident drain daemon **observable and operable**, but it is a mirror, not a smoke
detector. Every panel either reflects current state or shows a reactive incident row keyed on a
non-zero pass exit. A loop meant to run unattended must **self-report when it is stuck** — this
epic adds the trend analysis that turns the console from a mirror into a smoke detector, and
surfaces the verdict on the CLI, in the browser, and into the [#2456](/backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence/)
evidence gate.

## Why (the evidence — a real, invisible stall)

On 2026-07-13 the daemon was deadlocked for **70+ minutes** landing a multi-PR batch
(`rebaseDropManifest` force-pushed a rebuilt tip every pass → CI restarted → 0 merges; fixed in
we #477). Throughout, **the console looked fine**: green badges, counters ticking, every pass
exited `0`. The stall was found only by grepping the CLI logs by hand. The failure was structural,
not incidental: the daemon's health signals are per-pass-reactive or cumulative, so a
"healthy-looking but not progressing" state is invisible by construction.

## The gap, precisely

`deriveIncidents` (`plateau:tools/drain-daemon/lib.mjs`) fires an incident ONLY on `exit !== 0`,
`dup-NNN`, or a lease-loss event. There is **no trend analysis across the history window**. The
data to detect a stall already exists — `plateau:.drain-daemon/history.jsonl` records `considered`,
`merged`, `mergedPrs`, `parked`, `exit` per pass — but nothing reads it as a **series**. The 70-min
deadlock was a run of `considered>0, merged 0, exit 0` passes: every field individually healthy,
the trend pathological.

## Design — one pure detector, three surfaces

A new PURE, unit-tested `detectAnomalies({ history, state, queue, events, nowMs })` returning an
ordered list of `{ type, severity, since, detail, evidence }`, sitting beside `deriveIncidents` /
`summarizeQueue` in `plateau:tools/drain-daemon/lib.mjs` (same defensive, dependency-free,
never-throws contract). It is fed by the pass history + the existing dry-run queue plan
(`summarizeQueue`) + the events journal, and in turn feeds:
- the **CLI** `status` health line (the surface the operator actually used last arc),
- the **console** health badge + anomalies panel (`plateau:tools/dev-panel/drain-daemon.html`),
- the **#2456 evidence gate** ("did drain-class incidents stop" is exactly this signal over time).

Health verdict rolls up to `healthy` / `degraded` / `stuck` in `buildStatusReport`, so every
consumer reads one authoritative verdict.

## Slices (value-first — the keystone catches the 70-min deadlock alone)

1. **A — detector core + stall/zero-merge signals + health verdict.** The `detectAnomalies` pure
   function with the two headline signals: STALL (`considered>0 && merged 0` for ≥N consecutive
   recent passes) and ZERO-MERGE-WITH-READY (merge rate 0 while the queue board shows ready/toMerge
   > 0). Severity escalates with run-length. Roll the verdict into `buildStatusReport`. lib-only
   + unit tests — no `plateau:tools/drain-daemon/daemon.mjs` edit, no restart. This alone would have
   caught the 70-min deadlock.
2. **B — head-churn detector.** The we #477 signature: the same PR reconsidered pass after pass,
   never merging. Needs a small daemon-side data addition — each pass records WHICH PRs it
   considered (numbers), not just the count — then the detector flags a PR considered ≥N passes with
   0 merges.
3. **C — degradation signals.** Rising failed-pass rate over the window, repeated pass-timeouts
   (`exit null`), and parked-PR staleness (a `parkedNow` entry persisting ≥N passes / ≥T minutes
   with no review panel clearing it — "nobody is coming"). Computable from existing history +
   `parkedNow`.
4. **D — console health surface.** A top-level health badge (green/amber/red) that goes red on any
   active anomaly, plus an anomalies panel listing each active signal with since-when + evidence —
   distinct from the reactive incident timeline. The at-a-glance "is the loop actually working"
   that green counters currently fake.
5. **E — out-of-console alerting.** The console is not always open, so when an anomaly persists past
   a threshold, surface it OUT of the browser: a launchd-level notification and a prominent CLI
   `status` health line. This is the "self-report when stuck" the north star demands — the loop
   tells the operator instead of waiting to be noticed.

## Definition of Done

The daemon self-reports a `stuck` / `degraded` verdict — on the CLI and in the console — whenever
it is not making progress despite green per-pass exits, within N passes of the stall starting, with
the specific signal and since-when; and the anomaly history feeds #2456. Concretely: the 70-min
deadlock class (all passes green, 0 merges, ready queue non-empty) is detected and alerted without
a human grepping logs.

## Lineage

Surfaced 2026-07-14 (handoff analysis, top recommended-next gap) after the we #477 batch-loop fix
prod-validated. The console (#2474) is observational but not diagnostic — the daemon ran deadlocked
70+ min while the console looked healthy. Sibling to #2474 under the Plateau Loop epic (#2445).

Supersedes [#2485](/backlog/2485-loop-console-health-anomaly-detection-alerting-turn-the-mirr/) — a
near-identical single-story duplicate filed hours earlier the same day (same #477 grounding, same
detector set); folded in here as slices A–E and resolved for trace.

## Resolution (2026-07-14) — all slices delivered, live in production

The daemon self-reports a `stuck` / `degraded` verdict on the CLI and in the console, and the 70-min
deadlock class is now detected without a human grepping logs. All children shipped and are live
(the daemon was restarted so slice B's per-pass recording and slice E2's alert step are active):

- **A — detector core** ([#2488](/backlog/2488-loop-console-detectanomalies-core-stall-zero-merge-with-read/)) — pure `detectAnomalies` with the STALL and ZERO-MERGE-WITH-READY signals + the rolled-up `health` verdict in `buildStatusReport`.
- **C — degradation signals** ([#2491](/backlog/2491-loop-console-degradation-signals-failure-rate-timeouts-parke/)) — elevated-failure-rate, repeated-timeouts, parked-staleness (agent-clearable parks only).
- **D — console health surface** ([#2490](/backlog/2490-loop-console-health-badge-anomalies-band-surface-the-verdict/)) — the green/amber/red badge + anomalies band.
- **E1 — CLI health line + wider window** ([#2492](/backlog/2492-loop-console-cli-health-line-wider-detection-window-self-rep/)) — `status` self-reports; the STALL signal can reach `critical`.
- **B — considered-never-merged + per-pass PR identity** ([#2496](/backlog/2496-loop-console-considered-never-merged-detector-per-pass-pr-id/)) — names the specific wedged PR; records `consideredPrs`/`deferredPrs` (also unblocks time-to-land).
- **E2 — out-of-console launchd alert** ([#2493](/backlog/2493-loop-console-out-of-console-launchd-alert-when-an-anomaly-pe/)) — a persistent degraded/stuck loop fires a de-duped desktop notification.
- **Operating-evidence view** ([#2495](/backlog/2495-loop-console-operating-evidence-view-summarizeevidence-cli-e/)) + **browser panel** ([#2494](/backlog/2494-loop-console-evidence-panel-in-the-browser-render-the-operat/)) — `summarizeEvidence` + `cli evidence` + the console panel; turns the journal into the #2456 evidence (a single command instead of hand-grepping).

Slices B and E2 each rode a fresh-context 2-lens adversarial review panel (both required daemon-adjacent
changes); the panels caught + fixed a real false-positive (parked/deferred PRs reading as wedged) and two
robustness should-fixes (an unbounded per-pass journal read; notification spam under a flapping anomaly set).
