---
name: drain-is-a-resident-daemon
description: "The drain runs as a resident launchd daemon (installed 2026-07-13) — do NOT manually /drain; it auto-lands ready-to-merge PRs every 60s. Recall before running /drain or wondering why a PR merged with no human."
metadata:
  type: project
---

On 2026-07-13 the phase-1 resident drain daemon (#2449, `plateau-app/tools/drain-daemon/`)
was installed as a launchd LaunchAgent (`com.plateau.drain-daemon`, RunAtLoad + KeepAlive)
and started. It holds the whole-process drain lease and runs `merge-ai-prs.mjs` as one-shot
passes every 60s from a dedicated WE clone (pool `we-drain-daemon`). So the drain now runs
**continuously and unattended** — this is the "AI runs longer by itself" switch, and the
operating evidence it produces is what unblocks the deferred agent-runner decision (#2444).

**Why:** the drain used to be run by hand (`merge-ai-prs --only=NNN`) or by an interactive
`/drain` session. A resident owner replaces that — it is the sole full-sweep drain owner
while resident.

**How to apply:** do NOT manually `/drain` or run a full `merge-ai-prs` sweep while the
daemon is resident — you'll no-op on its lease (or fight it). A `ready-to-merge` PR just
lands within ~60s on its own. Scoped `--only=<pr>` fast drains (via `/pr`) still bypass the
lease and are fine. This is machine-local operational state that can change (the operator
can `cli.mjs uninstall`), so VERIFY before relying on it: `node
plateau-app/tools/drain-daemon/cli.mjs status`. Related: [[backlog-is-the-tracker]].

**It lands, it doesn't run the review panel:** the daemon merges `ready-to-merge` PRs but does NOT run review — escalation/convergence is agent/skill-driven, not part of its `merge-ai-prs` pass. So a PR parked `review:pending` (e.g. by the 1-in-10 sampling floor) or `review:human` STAYS parked until an agent panel or human applies `review:accepted`; the daemon won't auto-land it. Live proof: this session PR #460 was tagged `review:pending` by the sampling floor and did NOT auto-land until a fresh-context review agent applied `review:accepted`.

**It drains ALL THREE repos, not just WE** (verified 2026-07-13, correcting an easy misread): the `merge-ai-prs` pass scopes to `chalbert/web-everything` + `chalbert/frontierui` + `chalbert/plateau-app`, so a `ready-to-merge` plateau-app or frontierui PR auto-lands too — you do NOT have to merge it by hand or via `/merge`. What gets PARKED (needs a fresh review panel to clear before it lands): WE PRs on blast-radius/gate-self paths (`scripts/`, `scripts/lib/review-escalation.mjs`, etc.) → `review:pending` (or `review:human` for gate-self), PLUS the ~1-in-10 sampling floor on any repo. Plateau/FUI PRs don't match the WE-path escalation, so they only park when sampled. Engine-tier `review:pending` is agent-clearable by a fresh-context adversarial panel (add `review:accepted`, remove `review:pending`); `review:human` is NEVER agent-cleared (INVARIANT 2). Any `daemon.mjs` change needs a fresh panel + a `cli.mjs restart` (after pulling the plateau primary) to activate — the running daemon is old code until restarted. See [[approve-verdict-sets-review-accepted-label]].
