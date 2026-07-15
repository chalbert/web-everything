---
bornAs: xgb0p8o
kind: decision
parent: "2508"
status: open
dateOpened: "2026-07-15"
blockedBy: ["2444"]
tags: [plateau-loop, console, backlog-ui, launch]
---

# Backlog-view Launch control — claim+handoff vs headless build vs enqueue

What does the console's **Launch** control (the #2522 slice) actually *do*? #2522's acceptance says it "starts work through the sanctioned lane / build entry point" and the row reflects "launching → in-flight" — but there is **no headless build entry point in the repo** (the lane scripts acquire lanes and land PRs; none *builds* an item). So "launch" is undefined, and the choice of semantics is a design fork, not an implementation detail. This decision fixes what the button means before #2522 is built.

## Grounding — why this is a decision, and what gates it

- **The write seam is proven** (#2514→#2521): a browser write opens a lane clone, runs `we:scripts/backlog.mjs <verb>` there, gates it, and rides a ready-to-merge PR. Claim/release/resolve/prioritize all fit that seam. **Launch does not** — it isn't a frontmatter splice; it starts *work*.
- **The "actually build unattended" branch is downstream of a parked decision.** Spawning a `claude` agent to build an item is exactly the agent-runner contract in **[#2444 — Plateau Loop phase-1 agent-runner shape](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/)** (`spawn/steer/stop/resume`, headless permission model, subscription auth). #2444 is **deliberately deferred** (`priority: low`, out of auto-select): phase 1 was re-scoped to the resident drain daemon only (#2449), which spawns no agents, so #2444 "has no consumer yet" until the daemon's operating evidence says the loop should grow. **A headless-build Launch button cannot be built without ratifying #2444 first** — hence `blockedBy: 2444` on this card.

## Fork — Launch-control semantics

- **(a — recommended) Claim + provision a lane, hand off.** Launch runs the `claim` verb through the write seam, then acquires a plateau-app lane and surfaces its path. The row goes **claimed · lane ready** (an honest state — nothing is building yet); a human or agent then builds in that lane. Reuses the proven seam, adds no new infra, spawns nothing, and does **not** front-run #2444. Cost: it is a convenience wrapper over what you do by hand today, not one-click autonomous building; and it must not leak a provisioned lane (see residual below).
- **(b) Headless build run.** Launch spawns a supervised `claude -p` child in the lane that actually builds the item, records a run (modelled on `/api/explorer/runs`), and the row shows a true **in-flight ⟳ → PR #NNN**. This is the only option that literally satisfies #2522's "in-flight." **Blocked on #2444** (the runner contract) and carries real autonomous-spend per click — the most dangerous control in the console. A separate, deliberately-gated slice once #2444 ratifies.
- **(c) Enqueue for a resident builder.** Launch writes the item into a build queue a resident loop consumes. No such builder loop exists today (`lane-drain` only *lands* PRs); this needs new always-on infra and is out of scope for a console slice. Available if the Plateau Loop grows a resident builder.

**Default: (a).** It is the only interpretation that is honest *and* buildable now — it spawns nothing, so it is clear of #2444's parked scope, and it reuses the write seam we hardened across #2514→#2521. It also forces a rewrite of #2522's acceptance: drop "in-flight" (a lie under (a)) for **claimed · lane ready**. True one-click building is (b), gated behind #2444.

## Residual to fold into the (a) build

- **Lane-leak.** The write seam's discipline is acquire-and-release inside one job. Naïvely provisioning a lane at Launch and leaving it dangling for pickup is a new footgun. Prefer: Launch does the **claim** only and surfaces the *command* to provision-and-build on demand, OR provisions but tracks the lane so an un-picked-up launch is releasable. Decide this in the (a) build, not here.
- **Eligibility.** "Refuse a blocked / claimed item with the reason" is orthogonal to the fork — every option needs it. The `claim` verb refuses a claimed item; `blockedBy`-based refusal is not in the write seam's `canApply` today and must be added regardless.

## Screen

Clear — not an impl detail behind a stable contract. WHAT the console's Launch button does (hand off a lane vs autonomously build vs enqueue) is a product-behavior call with a real merit + cost + safety difference, and one branch (b) is gated on a separately-parked decision (#2444). A consumer of the console sees a materially different product per branch.
