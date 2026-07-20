---
bornAs: xhmav8a
kind: epic
status: open
dateOpened: "2026-07-11"
relatedReport: "reports/2026-07-12-program-plateau-loop.md"
tags: [delivery-machinery, coordinator, plateau]
---

# Plateau Loop — extract the delivery machinery into a coordinator product

Long-lived coordinator owning the backlog→lane→PR→review→drain state machine across a registry of projects (WE, FUI, plateau-app), spawning Claude CLI agents as supervised children; phase 1 local + subscription auth.

## Why (the reliability argument)

Today's coordination lives in skill prompts, file locks, detached processes, and lease
conventions that every session must correctly re-interpret — the model sits in the loop for
pure state-machine work. The recent patch trail is the evidence: whole-process drain leases
(#2391), push-at-close (#2395), stale-lane guards, workflow-lane ownership (#2427),
self-modifying-item exclusion (#2077). Each hardens "sessions coordinating by convention."

A resident coordinator inverts that: **one process owns the state machine** (queue, leases,
lane pool, drain scheduling, review labels) and spawns agents as supervised children. Locks
become in-process, retries/timeouts become code, crash recovery is one supervisor instead of
N sessions guessing. Claude stays only where judgment lives: building, judging diffs,
authoring items.

## Strategy

- **Multi-project registry.** The Loop instance manages a list of projects — WE, Frontier UI,
  plateau-app — each with its own backlog, lane pool, and gate config. The machinery is
  already keyed by repo name; the registry makes it first-class.
- **Self-hosting boundary.** Plateau Loop's own improvements stay managed through Claude Code
  until the Loop can improve itself in a lane and reload (coordinator drains its own PR,
  restarts, resumes from persisted state). Needs #2077-style exclusion so it never
  parallel-edits itself.
- **Configuration over convention.** Gating, review escalation, drain policy, model choice
  become platform config (like other development aspects), with a UI to inspect and operate
  gating / review / drain / finish.
- **Phase-1 runtime = spawn the local `claude` CLI** (`-p --output-format stream-json`) on the
  user's subscription — the pattern the dev-panel / spec-explorer already proves. The Agent
  SDK requires an API key, so it is a later backend behind the same runner interface.
  Steering headless: PreToolUse hook-gate injection (mid-turn) + kill-and-`--resume`
  (between-turn). SaaS later = coordination plane only; execution stays local per-user
  (subscription ToS forbids pooling consumer auth server-side).

## Phase 1 re-scoped (2026-07-11 red team — operator call)

Phase 1 is now the **resident drain daemon only** ([#2449](/backlog/2449-ship-the-phase-1-resident-drain-daemon-merge-queue-only/)):
a resident process owning the merge queue — leases, ordering, review labels, sole-writer drain — and
nothing else. Sessions keep building and reviewing exactly as today. Agent spawning, steering, UI, and
the multi-project registry wait for the evidence the daemon produces; the runner decision (#2444) and
the placement decision (#2446) are deferred until then (`priority: low`, pickable, out of auto-select —
same discipline the triage rubric below applies to #2442/#2417). The daemon is hosted **provisionally in
plateau-app** next to the dev-panel (the #1565/#1579 devtools-are-Plateau-owned priors) — a cheap-to-move
start, explicitly without prejudice to #2446's eventual full-engine placement call.

## Red-team risks (2026-07-11 — must be answered before scope grows past phase 1)

- **Mixed mode is permanent.** Interactive sessions don't go away, so the session-choreography
  conventions can't be "retired" wholesale — any grown scope must specify how outside sessions and the
  coordinator co-exist, or it runs two coordination dialects at once. The DoD's "conventions retired"
  line is qualified accordingly.
- **Residency relocates fragility.** Crash recovery, persisted state, self-update-then-reload on a
  laptop that sleeps and reboots — the supervisor layer can end up bigger than the conventions it
  replaces. Sessions-by-convention are restartable by construction; a resident state machine must earn
  that with code.
- **The phase-1 runtime bets on unstable ground.** Subscription quota is a hard wall for a resident
  spawner; `-p --output-format stream-json` / hook-gate steering / kill+`--resume` are observed CLI
  behavior, not a stable API; steering only reaches an agent when it calls a tool. Captured on #2444.
- **Gate-self un-anchors on extraction.** The trust-chain path checks are WE-path literals; moving the
  engine silently disables the `review:human` invariant — now its own child task
  ([#2448](/backlog/2448-re-anchor-the-gate-self-trust-chain-when-the-delivery-engine/)), owed on
  every variant including the phase-1 daemon.
- **Osborne effect on parked items.** Deferring cheap fixes because "the coordinator obsoletes them"
  bets on this epic's timeline; the parked items (#2442, #2417) stay pickable and should be re-checked
  if phase 1 slips.
- **The coordinator doesn't remove git-level races.** Parallel *workers* still conflict over lanes and
  files (#2427, #2077); centralizing lease bookkeeping narrows, not removes, that class.

## Extraction seams (what moves, what stays)

The deterministic substrate is a self-contained node+git+`gh` engine: lane-pool + leases,
pr-land, merge-ai-prs (drain), the three guards, review-escalation/review-core contracts,
lane-partition, backlog CLI. AI enters at exactly three bounded points — lane workers, diff
judging, item selection/authoring — each behind a stable contract (Finding shape, manifest
schema, escalation rubric). WE keeps its *rules* (check-standards content, backlog content);
the Loop ships the *harness* (gate runner, item format, labels, drain policy).

The parallel orchestrator is the one Claude-Code-coupled piece (Workflow sandbox); it gets
rewritten as plain Node fan-out over the runner interface — removing today's inline-mirror
duplication of `we:scripts/readiness/lane-partition.mjs`.

## Triage rubric applied to open machinery items

- **Feeds the coordinator** → re-parented here (script-delegation and transport-parity work
  carries straight into the Loop): [#2418](/backlog/2418-main-loop-as-coordinator-delegate-the-review-pipeline-script/),
  [#2241](/backlog/2241-constellation-ci-pr-merge-parity-bring-frontierui-plateau-ap/).
- **Efficiency polish of choreography the coordinator obsoletes** → `priority: low` with a
  pointer here (stays pickable, out of auto-select — parking is not a prioritisation escape):
  #2442 (push-at-close idle poll), #2417 (drain sweep read fan-out).
- **Correctness fixes still owed while the machinery lives** → untouched: #2424 / #2443
  (whole-process drain lease — an observed double-drain), plus drain/review *policy*
  (merge-anyway timeout #2412, run-tooling-last #2422, escalation relief #2423, gate
  hardening under #2405, convergence loop #2410); policy carries into the Loop regardless
  of host.

## Definition of Done

A locally-running Plateau Loop instance coordinates backlog→lane→PR→review→drain for at
least two projects of the constellation end-to-end (build sessions spawned, reviews judged,
drain as sole writer), with gating/review/drain operable from its UI and its config in
platform config — and the session-choreography conventions it replaces retired from
docs/skills *for the flows the coordinator owns* (interactive sessions remain first-class:
the conventions governing how an outside session co-exists with the coordinator are part of
the deliverable, not retired — see the mixed-mode red-team risk above).

## Review log

- **2026-07-12 — first run (completeness pass).** Front A: the phase-1 daemon (#2449) + dev-panel seed
  (#2454) shipped and are live in code, but the DoD's whole second half was unfiled. Goal-set coverage
  went 9/17 filed → **17/17** this run. Filed 17 children — the operable-console sub-epic (#2474) + 6
  UI slices (daemon-lifecycle-first), multi-project registry (#2472) + per-repo-backlog (#2475),
  config-over-convention (#2465), supervisor (#2468), orchestrator-as-Node-fanout (#2469),
  ≥2-project milestone (#2462), runner-build (#2464) + steering (#2463) under #2444, and the
  plateau-app product-separation decision (#2476). Deferred residuals set `priority: low`. Front B
  light (internal-incompleteness dominated). Report:
  [we:reports/2026-07-12-program-plateau-loop.md](../reports/2026-07-12-program-plateau-loop.md).
  **Next run:** re-check after a UI slice lands; prepare #2444 + #2446 once #2456's daemon evidence exists.

## Closed-world design refinement + delivery-machinery session (2026-07-13)

A working session refined the operating vision and shipped the first autonomy increments.

### The closed-world model (the operating vision)

- The Loop is a resident process that OWNS the lanes it launches, so its coordination is in-process (Node), not choreographed via GitHub labels. Labels remain ONLY as the seam with outside interactive sessions the Loop did not spawn.
- The LANE is the unit of serialization. Review happens in-lane (author + reviewer agents); a human is asked ONLY on genuine agent disagreement (deadlock), or when a change touches the gate's own policy or the statute layer.
- Delivery = a wait-for-ready queue + one sole-writer-to-main lock. Interactive sessions are a separate world; that lock is the only thing the two worlds share.
- Same-lane co-allocation of conflicting items was investigated and judged largely redundant with the shipped #2387 overlap-stacking — not pursued.

### Shipped this session (all merged to main)

- #455 — negotiation round cap 3→5 (more iteration before a human handoff).
- #456 — two-tier trust chain: the lander (engine tier) is agent-reviewable and auto-lands on a converged verdict; only the leash-defining POLICY tier (rubric, disposition router, roster, invariants) + the STATUTE layer stay `review:human`.
- #2439 (PR #457) — independent hardened validator + `redteam:accepted`: a fresh-context adversary jury re-judges the final diff (never the peers' self-assessment) and gates every engine-tier auto-land.
- The phase-1 resident drain daemon (#2449) was INSTALLED and STARTED (launchd, 60s interval) — it now lands `ready-to-merge` PRs autonomously and is the sole full-sweep drain owner. See agent-memory `drain-is-a-resident-daemon`.

### Guardrails (must hold as the Loop grows)

- INVARIANT 2 (a human-gated PR never auto-merges without a human accept) is sacred: relaxations may only narrow CLASSIFICATION (which files are policy-tier), never enforcement.
- The gate cannot be relaxed by an agent approving its own gate change — every edit to the policy tier self-gates to `review:human`. That bootstrap is not skippable.
- Respect the epic's sequencing: the agent runner (#2444 → #2464) stays deferred until the daemon produces real operating evidence (#2456). Running the daemon IS the work that unblocks it; do not force the decision early.

### Next-slice framework

1. Once daemon evidence exists (#2456): prepare/ratify #2444, then build the runner (#2464) — the step from "the drain runs itself" to "the building runs itself."
2. Until then: the operable console (#2474, dev-panel seed at `plateau:plateau-app/tools/dev-panel/drain-daemon.html`) is buildable now — makes the running daemon observable/operable.
3. Favor the smallest bounded slice that advances the north star; plan epics before building.
