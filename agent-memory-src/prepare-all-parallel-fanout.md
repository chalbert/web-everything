---
name: prepare-all-parallel-fanout
description: /prepare all fans out one Agent per decision item; disjoint files make it collision-free without git lanes
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b582e8c3-9176-45c0-844d-26ab5994bc4b
---

`/prepare all` parallelizes cleanly by spawning **one general-purpose Agent per open decision** — the
orchestrator claims each item `--as=preparing`, dispatches the agents in one message, then centralizes
`check:standards` + `preparedDate` stamp + `release` after they return.

**Why it's collision-free without the `/workflow` git-lane machinery:** each prep writes only *disjoint*
files — its own `backlog/NNN-*.md`, its own `reports/2026-*.md`, and its own research topic, which is
**one-file-per-topic** (`src/_data/researchTopics/<id>.json` + `src/_includes/research-descriptions/<id>.njk`,
per the researchTopics.js loader). No shared registry, so no merge step and no worktree isolation — this is
NOT the [[parallel-workflow-blocked-by-git-guard]] case (that's impl-repo batch *building* needing lane
pushes). Prep touches no impl repo.

**How to apply:** for `/prepare all`, (1) claim all N items `preparing`; (2) fire N parallel Agents, each
told to author its item to prepared-fork shape + publish its own research topic + run its own throwaway
skeptic sub-agent, and explicitly NOT to run the gate / set `preparedDate` / release; (3) orchestrator runs
the gate once, stamps `preparedDate` on all N, releases all to `open`. Proven 2026-07-01: 5/5 prepped, and
the skeptic passes materially moved 4/5 defaults (grounding corrected premises the cold items had wrong).
Force-claim (`--force`) any item with its own uncommitted authoring (e.g. just surfaced by a watch run).

**Gotcha (2026-07-02 run, 3/3 prepped but noisy):** a prep agent that spawns its skeptic/screen sub-agents
with `run_in_background` never hears back — background-child completions route to the ORCHESTRATOR, not the
parent, so the parent stops "waiting" forever and the orchestrator must relay findings via a scratchpad file +
SendMessage. Tell each prep agent explicitly to run skeptic + screen as FOREGROUND Agent calls (blocking, result
returned in-call). Also: late-arriving skeptic/screen results can land material amendments after the item looks
done — don't stamp `preparedDate` until every spawned attacker has reported or been superseded by an equivalent
foreground pass.

**Refined protocol (2026-07-02 second run, 6/6 prepped):** "run FOREGROUND" isn't reliably honorable — in some
lanes every Agent call launches async regardless. The working shape: (1) prompt each lane with the foreground
instruction PLUS the fallback "if Agent is async-only for you, run the skeptic/screen analysis yourself inline
on the prescribed axes"; (2) when a lane stops "waiting", SendMessage it that instruction — repeat firmly, it
takes up to three nudges; (3) orphaned skeptic/screen verdicts that land on the orchestrator get written to a
scratchpad file and relayed by path (they carried material amendments both runs — never drop them); (4) the
pass-5 screen needs fresh-context independence an inline self-screen can't give, so the ORCHESTRATOR spawns one
cheap fresh-context screen agent per item itself (~35–45k tokens each, read-only, parallel-safe) and relays any
flag back to the lane before stamping. Screens this run: 13/14 forks clear, 1 flagged(impl) → re-layered.
