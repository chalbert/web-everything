---
bornAs: xzu9e9p
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/telemetry.mjs", "we:scripts/operations/telemetry-store.mjs"]
dateOpened: "2026-09-13"
relatedTo: ["3383"]
tags: []
---

# Telemetry system has no tool-use-count tracking (design decision needed)

**Rescoped 2026-09-14** — this card originally filed four "live gaps" in the unified delivery telemetry
system (we:scripts/operations/telemetry.mjs, we:scripts/operations/telemetry-store.mjs, we:scripts/operations/telemetry-cli.mjs), claiming "no PR
title or branch references any of the four." That check was stale: PR #2198
(`telemetry: stop test pollution, unify storage across clones, isolate tick-metric failures (#3383)`,
branch `lane/3383-telemetry-bugfixes`) already existed at the time this card was filed and its diff
genuinely fixes 3 of the 4 gaps with real code (confirmed by reading its diff directly, not just its
description):

1. **Test-suite pollution** — fixed: a new `we:vitest.setup.ts` defaults `WE_TELEMETRY=0` for the whole
   unit/integration run unless a test opts in with `enabled:true`, wired into both `we:vitest.config.ts`
   and `we:vitest.integration.config.ts`.
2. **Fragmented per-clone storage** — fixed: `TELEMETRY_ROOT` in `we:scripts/operations/telemetry-store.mjs`
   now derives from `workspaceFor()` (`we:scripts/lib/lane-pool-paths.mjs`) instead of the invoking
   script's own on-disk location, so every clone under one workspace (primary checkout + every
   `we:.lanes/*` lane) shares one telemetry directory. A new `CHECKOUT_ROOT` keeps the per-clone
   git-resource (branch/commit) detection separate from the shared storage root.
3. **Host metrics silently dropped mid-tick** — fixed: each metric group in `emitTickMetrics` now runs
   through its own `emitMetricGroup` try/catch and logs a non-fatal warning on failure, instead of one
   catch-all around the whole tick silently swallowing everything after a partial throw.

As of this rescoping, PR #2198 is **open, not yet merged** — its 3 fixes are real but not yet on `main`.
This card should track only the one gap #2198 does **not** touch, so it isn't re-describing already-fixed
work as outstanding. If #2198 fails to land, gaps 1-3 above need a fresh look; don't assume they're solved
until #2198 (or its successor) is actually on `main`.

**The one remaining gap — no tool-use-count tracking (design decision needed, not a plain bugfix):**
a repo-wide grep for `toolUseCount`/`tool_use_count` returns zero hits under `we:scripts/` or
`we:skills-src/`, so no per-agent tool-call count exists anywhere in the telemetry schema, despite being
named as one of the golden signals in the commit that introduced the system. This was explicitly
investigated-not-built: the schema has no field for it yet, and adding one is a design decision (where does
the count come from — the driver's own tool-call loop, a wrapper around `judgeSpawn`/dispatch, or parsed
after the fact from a transcript; per-span or per-delivery granularity; whether it belongs in
`we:scripts/operations/telemetry.mjs`'s existing span/metric shape or needs a new event kind) rather than a
mechanical fix like the other three. Needs that design call made (or at minimum a concrete proposed schema
field + emission call site) before it's buildable.

**No hook point exists to feed it, and closing that is a repo-wide expansion, not a small fix.** The schema
question above is downstream of a bigger gap: today `we:.claude/settings.json` declares hook matchers for
only `Edit|Write` (PreToolUse + PostToolUse) and `Bash` (PreToolUse) — there is **no matcher that fires on
every tool call**, so a `Read`, `Grep`, `Glob`, `Agent`, or any other tool invocation is invisible to any hook
right now. Making a tool-use tally possible at all means adding a hook point with unrestricted (or
near-unrestricted) matcher coverage across every tool, in every session — a **repo-wide hook-scope
expansion**, not an isolated change alongside the schema/emission-site design above.

**Open design question this surfaces, not just missing code: does interactive-session tool use even belong in
this telemetry stream?** `we:scripts/operations/telemetry.mjs` is currently scoped to **dispatched-agent**
spans (a lane's build, a judge run, etc.) — not to the operator's own interactive Claude Code session. A
hook that fires on every tool call fires in BOTH kinds of session; widening hook coverage to make the tally
possible would, by construction, also start observing interactive-session tool calls. Whether interactive
tool-use counts should feed this same dispatched-agent-scoped stream, a separate stream, or nothing at all is
a real judgment call — not resolved by this card, and needs deciding before (or alongside) the schema design
above, not after building the hook expansion.

## Done when

1. **Executable** — a command that fails before this item lands and passes after: a per-agent tool-use
   count is recorded somewhere in the telemetry schema (we:scripts/operations/telemetry.mjs) and a test
   asserts a delivery span/metric carries a non-null tool-use count for a dispatch that made at least one
   tool call.
