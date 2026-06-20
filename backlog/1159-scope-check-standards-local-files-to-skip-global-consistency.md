---
type: idea
workItem: story
size: 3
parent: "1143"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:scripts/readiness/claimScope.mjs"
tags: []
---

# Scope check:standards --local --files to skip global-consistency rules in isolation

The parallel `/workflow` orchestrator gates each concurrent item in its own worktree via the #1144 `--local --files` mode, but that mode still runs whole-repo **global-consistency** rules (registry/referenceIndex coherence, block contract↔impl drift) a worktree branched from base **cannot** satisfy in isolation. First real multi-lane run (#1153): **4 of 7 concurrent items false-red'd in-worktree** (#1071/#1139/#1058/#1137), then gated green on serial replay — eating the parallel speed-win. Fix: restrict `--local --files` to **file-local** rules; defer global checks to the integrator's full per-merge gate. First diagnose the real per-item red reasons (inferred, not captured this run). Owner: epic #1143; built in resolved #1144; symptom in #1153.

## Resolved (batch-2026-06-19) — `descriptor.global` marker + `--local` demotion

**Diagnosis (inferred — the #1153 reds weren't captured).** The pre-#1159 `--local` only demoted *path-less* findings; the false-reds were file-*attributed* global-consistency rules firing on a lane's own edited file:

- **`block contract↔impl drift` was NOT the culprit** — it already detect-or-skips when `../frontierui` is absent (`we:scripts/check-standards.mjs:763-782`), which is the worktree case (a git worktree of `webeverything` has no sibling `../frontierui`), and its findings are path-less (already demoted). 
- **Real classes**: (1) **cross-registry `unresolved-ref` joins** — a lane edits block/intent X that references entity Y added by a *sibling* lane (disjoint files, but the referent is absent in this worktree branched from base) → `unresolved-ref` reds on X's own file; (2) **the `we:AGENTS.md` `inventory` derived-artifact coherence** (`we:scripts/check-standards.mjs:682-690`) — the integrator regenerates `we:AGENTS.md` once after merge, so an isolated lane that touched any spec source reds stale even though it never runs `gen:inventory`.

**Fix.** A declarative `global: true` marker on the two global-consistency descriptor classes (`dUnresolvedRef` in `we:scripts/check-standards-rules.mjs:58-61`; the `inventory` descriptor at `we:scripts/check-standards.mjs:687`), and `partitionLocal` (`we:scripts/readiness/claimScope.mjs:213`) demotes any `descriptor.global` finding under `--local` **regardless of file membership** (checked before the file-isolation branches, so a global rule on the lane's OWN file still demotes). Default (no `--local`) keeps globals fail-safe blocking; the integrator's per-merge full no-flag gate remains the authority. Tests: `we:scripts/__tests__/claimScope.test.mjs` (+2 cases — demote-on-own-file under `--local`, fail-safe-block without). `check:standards` green.
