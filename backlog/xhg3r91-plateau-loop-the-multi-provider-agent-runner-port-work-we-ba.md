---
kind: story
size: 3
parent: "2445"
status: open
blockedBy: ["3369", "3370", "3371", "3579", "3580", "3581"]
dateOpened: "2026-09-07"
tags: [plateau-loop, agent-runner, multi-provider, constellation-placement]
---

# Plateau Loop: the multi-provider agent-runner port work (we:backlog/3369/3580 families) is the same seam #2444's ratified runner interface already names

we:backlog/2444 (ratified) already fixes the Loop's agent-runner interface as backend-agnostic, with the SDK named as 'a later backend behind the same runner interface.' WE's own work extracting a judge provider port (we:backlog/3370) and a dispatcher provider port (we:backlog/3579) from Claude-CLI-coupled spawn seams, probing Codex CLI (we:backlog/3371), and sequencing a pilot surface (we:backlog/3581), is the identical provider-port pattern. Tracks that the Loop's eventual runner build should reuse this proven port shape rather than re-deriving it; does not rebuild the WE-side work.

## Grounding — checked against we:backlog/2444/2445's actual text, not assumed

- **we:backlog/2444's own ruling** fixes `spawn/steer/stop/resume/observe` as a **backend-agnostic** interface "so an SDK/API backend can slot in later without UI or orchestration changes" — the same requirement, applied to a *second CLI provider* rather than the SDK, is exactly what we:backlog/3369's decomposition builds: "a second provider only has to satisfy `judge(request) → outcome`, not reproduce the harder background-dispatch machinery."
- **we:backlog/2445's own Extraction seams** name "AI enters at exactly three bounded points — lane workers, diff judging, item selection/authoring." The dispatcher-decoupling epic (we:backlog/3580) targets exactly the "lane workers" seam; the judge-decoupling epic (we:backlog/3369) targets exactly "diff judging."
- **The pattern is structurally identical**, not merely analogous: both we:backlog/2444's runner and we:backlog/3370/3579's ports generalize an *existing test-injection seam* (`spawn`/`exec`/`spawnFn`, already present for unit tests) into a *named, backend-neutral contract*, with the incumbent (Claude CLI, or the phase-1 CLI backend) remaining the only implementation until a second is proven. we:backlog/3370's own card states this almost verbatim: "Behaviour is unchanged; Claude remains the only implementation."

## What's actually being generalized

- **we:backlog/3369** (epic) — decouples agent dispatch from the Claude CLI specifically, decomposed leverage-first: judge seam first (lowest risk), dispatcher seam deferred until Claude-only hardening (we:backlog/3331 family) lands.
- **we:backlog/3370** — extracts the provider port from `createDefaultJudge`'s judge-spawn seam; **we:backlog/3371** — probes Codex CLI for real against that port (not from documentation alone).
- **we:backlog/3580** (epic) — the harder dispatcher-decoupling assessment, staged the same way: **we:backlog/3579** extracts the dispatcher's own provider port (unblocked, pure refactor); **we:backlog/3581** (decision) — when/how to actually pilot Codex, recommending independent review/fix-dispatch first (lower blast radius) over full delivery-agent builds.
- **we:backlog/3513** (ratified) already settled the "should we add a second provider" merit question, gated on "a second subscription actually held, or a measured usage-window cap" — this tracker item does not re-litigate that either.

## Not in scope

- Rebuilding, rescoping, or re-deciding any of the WE-side items above.
- Picking Codex vs. Gemini for the Loop's own eventual second backend — that stays whatever we:backlog/3371's probe verdict says for WE's own dispatcher; the Loop's own choice is a later, separate call once a runner exists to make it.
- Any plateau-app-side filing or `locus:` field, per we:docs/agent/platform-decisions.md#backlog-tracking-locus-now-distributed-next.

## Cross-references added

- we:backlog/3369, we:backlog/3580 (the two umbrella epics) — each now carries a short pointer to this item.

## Done when

1. **Executable** — TODO: once we:backlog/3370/3371 (judge port + probe) and we:backlog/3579/3581 (dispatcher port + pilot decision) have landed and the Codex pilot has run against real traffic, this item is `/prepare`d into a concrete scope for the Loop's own runner build (we:backlog/2444/2530) to adopt the proven port shape, rather than left as a placeholder.
