---
name: capability-search
description: Search for an existing operation/skill AND an existing filed backlog item that already matches a concept, before proposing or building something new. Use when the user or a session is about to propose an idea, scaffold a script, or build a new capability, or runs /capability-search or /exists. Shells the read-only search core (we:scripts/capability-search.mjs) — never re-derives the matching logic. Read-only: never files, edits, or judges anything itself; it only surfaces candidates and reports one of exact / partial / genuinely-nothing-found for the session to act on.
---

# Search before you build

Two real misses on 2026-09-06 — a tool rebuilt from scratch that already had a near-match, and an idea
proposed as brand-new that was already filed two weeks earlier — happened because nothing made "search
first" a routine step. This skill is that step: one command, two surfaces, a verdict you act on.

## The one hard rule: search, then judge — never skip straight to building

Before proposing a new operation/skill, scaffolding a new script, or filing a backlog item for an idea that
feels new, run the search. An `exact` verdict means read the top hit before writing anything — it is very
likely the thing you were about to build. A `partial` verdict means read the closest few hits and use your
own judgment on relevance (the script scores term overlap, it does not know whether two things are "the
same"). `none` means it's genuinely safe to proceed.

## Steps

1. **Run the search** against the concept, in your own words — a sentence, not a single keyword (the scorer
   matches on the query's own tokens, so a fuller sentence surfaces more of what's actually relevant):

   ```bash
   node scripts/capability-search.mjs "<concept — one sentence, what it would do>" --json
   ```

   Drop `--json` for a human-readable listing instead; add `--limit=N` to widen or narrow each surface's
   result count (default 5).

2. **Read `verdict` first.**
   - `exact` — a near-exact match exists on the operation/skill surface, the backlog surface, or both.
     Open the top hit(s) (`operations[].id` / `backlog[].id` + `.path`) and read them before doing anything
     else. If it's the same thing, use it (or extend it) instead of building fresh; if it's genuinely
     already filed, don't re-file it.
   - `partial` — related hits exist but no strong match. Skim the top few `matched` term lists; if none of
     them are actually the same concept, proceed — this is not a stop, just a look-before-you-leap prompt.
   - `none` — nothing found on either surface. Safe to propose or build.

3. **Report what you found, briefly, before proceeding** — which hit you checked and why it was or wasn't
   the same thing. This is the habit the skill exists to make routine; skipping straight to "nothing found,
   proceeding" without naming what you actually saw defeats the point.

## What this skill is not

- **Not a relevance judge.** The script scores deterministic term overlap; deciding whether a partial match
  is actually the same capability is the session's job, not the script's — see
  [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment).
- **Not a gate.** Nothing currently blocks on this skill being invoked — it is discretionary today (#3559's
  own open question on whether to also wire it as a referenced step is deliberately left for a later item,
  once real invocations exist to judge that from).
- **Not a backlog or operation search UI.** It has no `op()` declaration and writes nothing; it is a plain
  read-only script, the same shape as `we:scripts/gap-sweep-status.mjs` or `we:scripts/check-readiness.mjs`.
