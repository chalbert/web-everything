# Launch-control semantics — prep grounding for #2525

**Date:** 2026-07-16 · **For:** decision [#2525](/backlog/2525-backlog-view-launch-control-claim-handoff-vs-headless-build-/) (Backlog-view Launch control) · **Parent epic:** [#2508](/backlog/2508-backlog-view-operable-actions-claim-prioritize-launch-resolv/)

## What this prepares

The plateau-app backlog console (Plateau Loop, epic [#2505](/backlog/2505-plateau-loop-operable-backlog-console-built-fresh-in-plateau/)) has shipped read + four operable write actions (claim / release / resolve / prioritize) over a lane-gated write seam. The last operable slice, [#2522](/backlog/2522-backlog-view-launch-work-on-an-item-from-the-ui/) ("launch work on an item from the UI"), can't be built blind: its acceptance says Launch "starts work through the sanctioned lane / build entry point" and the row goes "in-flight" — but **no headless build entry point exists in the repo**. So "what does Launch do" is a genuine fork. This report grounds it; #2525 is the prepared decision.

## Prior art — this is internal orchestration, not greenfield web-standard design

No browser-standard vocabulary to survey (Launch is an operational control, not a new intent/component), so the prep grounds against the *existing* machinery rather than MDN/WHATWG:

- **The lane-gated write seam** (shipped [#2514](/backlog/2514-backlog-view-write-seam-foundation-resolve-from-the-ui/)→[#2521](/backlog/2521-backlog-view-change-an-item-s-priority-from-the-ui/)). A browser write is never a direct write: `POST /api/backlog/write {id, verb}` opens a lane clone, runs `plateau:` the in-lane `we:scripts/backlog.mjs <verb>`, gates it (gen:inventory + check:standards), pushes a num-leading `lane/<num>-<verb>-ui` branch, opens a ready-to-merge PR, releases the lane — async job, client polls. The safety envelope (execFile no-shell, verb allowlist, num `/^\d+$/`, primary-checkout-never-written, coordination guard, CSRF content-type) is the pattern any new verb inherits. claim/release/resolve/prioritize all fit this seam because they are frontmatter splices.
- **The agent-runner decision [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/)** and its research topic [/research/claude-cli-agent-runner-headless-contract/](/research/claude-cli-agent-runner-headless-contract/). Spawning a `claude` agent to *build* an item is exactly #2444's `spawn/steer/stop/resume` CLI contract. #2444 is **deliberately deferred** (operator call 2026-07-11, `priority: low`): phase 1 was re-scoped to the resident drain daemon only ([#2449](/backlog/2449-ship-the-phase-1-resident-drain-daemon-merge-queue-only/)), which spawns no agents, so #2444 "has no consumer yet." Its red-team also names the hard walls a spawner hits: subscription quota exhaustion, the CLI contract being observed-not-promised, steering only reaching an agent at a tool call.
- **The explorer runs infra** (`plateau:tools/explorer/cli.ts`, `POST /api/explorer/runs`) — the existing precedent for "kick off a headless run, record it, poll for status." It stress-tests a URL; it does **not** build a backlog item. So option (b) would model its shape but needs a new executor.

## The fork, in one line

"Launch" is undefined because the word implies *work starts*, but the only proven seam is a frontmatter splice. Three coherent meanings: **(a)** claim + provision a lane + hand off (buildable now, spawns nothing); **(b)** headless `claude -p` build (the literal "in-flight", but downstream of the deferred #2444); **(c)** enqueue for a resident builder loop (doesn't exist). (a) and (b) are genuinely mutually exclusive as the *meaning of one button*.

## Recommendation

Default **(a)** — the only branch that is honest *and* buildable now without front-running the parked #2444. (b) is the "true" launch, correctly gated behind #2444; (c) needs infra out of a console slice's scope. See #2525's `## Fork 1` for the prepared shape, code examples, skeptic verdict, and screen.
