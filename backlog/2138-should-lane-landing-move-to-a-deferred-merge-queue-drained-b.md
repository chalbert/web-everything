---
kind: decision
status: open
dateOpened: "2026-07-02"
relatedTo: ["1143", "2123"]
tags: [lane, merge-queue, integrator, pr-flow, session-hygiene, decision]
---

# Should lane landing move to a deferred merge queue drained by a unified merge command?

Today lanes land on main **live, inside the producing run** — correct within one run, but two concurrent runs race on the shared primary checkout, and every session babysits a 20–70 min integration. Proposal (user direction, 2026-07-02): **every lane-producing session stops at "lane pushed + item marked ready-to-merge"** — parallel `/workflow` and solo lanes (#2123) alike — and landing moves to a **unified merge command** the human launches as ready items accumulate, draining the queue serially under the existing integrator contract (full gate per merge, rebase-and-retry, impl-repos-first/WE-last).

The drain command relocates the integrator half of [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js](.claude/skills/batch-backlog-items/parallel-execute.workflow.js) out of the producing session: merge one lane at a time, gate, delete the ref after landing. Concurrent-run races over the primary checkout (claim commits, serial lane, integrator merges, derived regen — one working tree) disappear structurally because producers never touch main.

**Which layer:** agent-workflow / session-tooling — nothing crosses the WE↔FUI standard boundary or touches a registry. Codifies as session house rules extending [we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](docs/agent/platform-decisions.md).

## Why

- **Kills the multi-run race structurally.** Across two concurrent runs, the pre-claim (`status:active` + we:claims.json), the central write-time lock dir, and slug-named `lane/*` refs already compose; the shared primary checkout during integrate/serial/regen does not. The alternatives — an integrator merge lock (coarse: must also cover the serial lane and regen, so runs mostly take turns) or a per-run integration clone (works, but each run still owns a landing pipeline) — both keep landing inside runs. A merge queue removes it: producers never touch main, one drain command owns it.
- **Converges every landing path.** `/workflow`, solo-session lanes (#2123), and the gated-PR direction all land through one door — closer to the PR-flow target state where main is convergence-only for automation.
- **Decouples sessions from landing.** A session ends at lane-push; no in-run liveness heartbeat for the integration half.

## Why the card is enough context for the merging session

The current design already relies on exactly this: the integrator's surviving-conflict fallback is **serial-replay from the item card**, with none of the original lane's session context; the carry/reopen model likewise assumes any fresh session resumes an `active` item from its card. Agent-ready-from-the-card is the standing invariant, and the **full gate per merge is the landing authority** ([we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](docs/agent/platform-decisions.md)), not the merger's understanding. The one thing live-merging genuinely does better is freshness (short base-to-merge window); the human controls that by draining the queue often.

## Forks to prepare

1. **Relation to the #1996 "landing is fully automatic" call.** Queue-drain-on-human-launch defers *when* landing happens but keeps the merge itself automatic and gate-authorized — amendment or compatible refinement of the anchor? (The drain command could itself later be scheduled, restoring full automation as a maturity step.)
2. **Durable lane metadata.** The in-run integrator holds cross-repo coupling in memory (which repos' `lane/*` refs form one item, impl-first/WE-last order, blockedBy edges between queued items). Deferred landing needs it written down — a per-item manifest (in the WE lane commit, or a ref-name convention) the merge command reads.
3. **Merge-risk lock lifetime.** Write-time locks currently protect concurrent *editing*; if a lane releases at push but sits queued, a later lane can edit the same denylist file against a main that doesn't yet contain the queued change — the clean-but-wrong structured-merge window reopens. Candidates: the merge command detects denylist overlap among queued lanes and serial-replays the second, or locks are held until merged (lease/TTL implications for ended sessions).
4. **A real ready-to-merge state.** Queued items must not be re-claimable or read as abandoned by reopen/closeout. Note the `active→resolved` flip already lives in the WE lane commit and only lands when that lane merges — so the #1869 reconcile semantics survive unchanged; the state is needed for claim/health logic, not for resolve integrity.

Successor to the two-concurrent-runs question raised against the #1933 clone model (2026-07-02 session); builds on #1933 lanes + #1995 push-retry; sibling of #2123 (solo-session lanes — a producer feeding the same queue).
