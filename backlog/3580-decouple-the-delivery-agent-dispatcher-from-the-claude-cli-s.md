---
bornAs: x6jk877
kind: epic
parent: "3369"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/operations/dispatch-abort.mjs", "we:scripts/operator/dispatch.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs", "we:scripts/lib/review-independence.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-07"
tags: []
---

# Decouple the delivery-agent dispatcher from the Claude CLI specifically

Requested assessment (operator, 2026-09-07): what it takes to decouple this repo's MECHANICAL DELIVERY system from being Claude-Code-specific, staged leverage-first, so a second provider (OpenAI Codex named specifically) could eventually be plugged in. we:.claude/skills/mechanical-delivery-doctrine/SKILL.md governs #3383's dispatcher; the coupling itself lives in we:scripts/operations/dispatch-lane-io.mjs (exec('claude', argv) at defaultSpawnAgent, the '--bg --session-id'/'--bg --resume <id>' argv contract in buildAgentArgv, 'claude agents --json' liveness polling in defaultListAgents/stampLiveness), we:scripts/operations/explore-io.mjs (same '--bg --session-id' shape for panelists), we:scripts/operations/dispatch-abort.mjs ('claude stop <id>'), and we:scripts/operator/dispatch.mjs ('claude -p --permission-mode bypassPermissions') -- six confirmed literal 'claude' CLI call sites total once we:scripts/lib/judge-spawn.mjs's JUDGE_CLI constant and we:scripts/measure-judge-spawn.mjs's default arg are counted alongside the four #3369 already named. #3369 (filed 2026-08-27, status open) is the existing umbrella epic and already decomposed the JUDGE axis leverage-first -- we:scripts/operations/cli-adapter.mjs's createDefaultJudge already speaks a provider-neutral judge(request)->outcome contract, #3370 (extract the provider port, unbuilt) and #3371 (probe Codex CLI specifically against that contract, unbuilt, blockedBy 3370) are already filed -- but #3369's own text explicitly DEFERS the harder DISPATCHER surface ('blocked on #3331/#3366/#3367 landing for Claude first... do not start it earlier') and never decomposed it. #3331/#3366/#3367 are all still status:open as of 2026-09-07, so wiring a second provider into the dispatcher is genuinely not ready -- but the LOW-RISK, LEVERAGE-FIRST move #3370 already modeled for the judge seam (name the existing spawn/exec injection point as a real provider port, Claude the only implementation, zero behaviour change) is NOT blocked on that hardening and can land now, exactly as #3370 argues for itself. This epic exists to give the dispatcher surface the same staged decomposition #3369 gave the judge surface, plus what is genuinely harder here and not analogous to the judge case: we:skills-src/inspect-agent-health/agent-health.mjs reads Claude's own ~/.claude/projects/<slug>/<session>/subagents/agent-<id>.jsonl transcript format directly (message.content blocks of type text/thinking/tool_use/tool_result -- the Anthropic Messages API shape) with NO neutral health-check contract above it at all, unlike the judge seam which already had one; and we:scripts/lib/review-independence.mjs's self-clear-refusal machinery keys independence on CLAUDE_CODE_SESSION_ID (31 non-test files reference CLAUDE_CODE_* env vars repo-wide, 46 including tests) -- a same-harness signal #2895 already ruled forgeable by 'an agent with shell access on the same machine', which a second, structurally DIFFERENT provider's own independent session identity would make categorically harder to forge (a genuine upside worth designing toward, not just a migration cost, though it does not fully substitute for #2946's harder hardware-presence fix). #3513 (ratified 2026-09-06) already answered the 'should we' question for cross-provider routing on merit (capacity, reviewer diversity, single-provider de-risking) gated on 'a second subscription actually held, or a measured usage-window cap -- not a decision'; this epic is the TECHNICAL prerequisite work #3513's eventual yes depends on for the dispatcher specifically, not a re-litigation of it.

## Staged decomposition, ordered by leverage (highest value / lowest risk first)

1. **Extract the dispatcher's own provider port** (small, no new provider yet — mirrors #3370's judge-port
   extraction, applied to the harder seam). `we:scripts/operations/dispatch-lane-io.mjs`'s `defaultSpawnAgent`
   and `we:scripts/operations/explore-io.mjs`'s panelist spawner both already inject `spawnAgent`/`exec` for
   testing; name that seam as a real port (`spawnAgent(argv-shape-neutral-request) → handle`) the way
   `createDefaultJudge` already does for judges. Behaviour unchanged, Claude remains the only implementation.
   **Not blocked on anything** — this is a pure refactor over an existing injection seam, the same argument
   #3370 already makes for itself, and it should land regardless of whether a second provider ever ships.
2. **Give the dispatcher its own probe**, once #3371 (already filed, recommends Codex CLI, `blockedBy: 3370`)
   reports its verdict. Reuse that verdict rather than re-probing from scratch — the judge probe already
   answers "does the schema constraint hold, what does quota exhaustion look like, is stdout parseable" for
   the SAME CLI; what the dispatcher needs on top is specific to background/resumable sessions: does
   `codex exec resume $SESSION` (session id ISSUED BY the CLI, per #3369's own research table) actually
   survive the same liveness-polling discipline `we:scripts/operations/dispatch-lane.mjs#dispatchStillHolds`
   applies to Claude's minted `--session-id`, and does a comparable `codex agents`-shaped listing exist at
   all (unconfirmed — #3371 only probes the judge/schema surface, not this one).
3. **Adapter, not port, for `we:skills-src/inspect-agent-health/agent-health.mjs`.** This is the one piece of
   this epic genuinely harder than the judge case, and the honest call is: build a real per-provider transcript
   adapter, not just a wider interface. The tool reads Claude's own on-disk JSONL directly (`message.content`
   blocks of type `text`/`thinking`/`tool_use`/`tool_result`, the Anthropic Messages API's own shape) with no
   neutral contract above it — unlike the judge seam, which already had `judge(request) → outcome` waiting to
   be named. A second provider's session/transcript format is genuinely unknown until step 2's probe answers
   it, so this step is explicitly gated on that probe landing first, not assumed buildable now.
4. **Wire the probed provider as a SECOND dispatcher implementation, piloted on the narrowest possible surface
   first — NOT full delivery-agent builds.** See the companion decision item for the recommended fork and
   default. This is where #3513's "should we" turns into a real second subscription's usage window.
5. **`we:scripts/lib/review-independence.mjs`'s `CLAUDE_CODE_SESSION_ID`-keyed self-clear refusal is NOT
   blocking work here, and is a genuine structural upside once step 4 exists** — see the epic digest above.
   No code change is proposed for it in this epic; it is named so the eventual design does not treat a second
   provider as pure migration cost when part of it is a free independence-signal upgrade.

## Deliberately NOT in scope

- **Re-litigating whether to add a second provider.** #3513 already ruled that on merit; this epic is the
  technical prerequisite work its "yes" depends on, not a re-opening of the fork.
- **Duplicating #3369/#3370/#3371's judge-axis work.** Those items already exist, are unbuilt, and are not
  refiled here — this epic covers exactly the surface #3369 named and deferred (the dispatcher), not the
  judge seam #3369 already decomposed.
- **Picking the second provider for the dispatcher independently of #3371's probe.** Step 2 above reuses that
  verdict rather than re-deciding a candidate from the research table alone — #3369's own epic already warns
  against designing on the search table instead of a real spawn.
- **Building the hardened Claude-only liveness/resume machinery this depends on.** That is #3331/#3366/#3367,
  already filed, already in progress, and not re-scoped here.

## Lineage

Filed 2026-09-07 at the operator's request for a staged, leverage-first assessment of decoupling the
mechanical delivery system from Claude specifically, ending in a recommended sequence for adding Codex. Child
of #3369 (the existing multi-provider epic), scoped to exactly the surface #3369's own text named and
deferred ("blocked on #3331/#xnukacf/#x4iwn55 landing for Claude first… do not start it earlier").
