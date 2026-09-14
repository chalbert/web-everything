---
bornAs: x8hzy1m
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-13"
dateResolved: "2026-09-13"
graduatedTo: none
tags: []
---

# Probe Cursor as an additional dispatch provider

> **DUPLICATE OF #3663 — resolved as such, not because the work happened twice.** Both cards carry
> `bornAs: 3663`. #3663 is the real item — it carries the documentation-grounded PREP research pass
> landed via PR #2194 (preparedDate 2026-09-13), which this bare copy never received.
>
> This copy exists because PR #2194 branched to prepare `3663`/`3664`/`3665` before sibling PR
> #2179 (which minted this card as `#3660`) had merged, working directly on its own hash-named copies of
> those three cards rather than waiting on the merge. When #2194 landed, the drain — doing exactly its
> job — JIT-numbered its own copy of the same hash fresh, as `#3663`, independently of `#3660` already
> having claimed that identity. `check:standards`' `duplicateBornAs` rule (#3244/#3650 precedent) caught
> the resulting twin.
>
> Kept rather than deleted, per the backlog's own rule that a file is an audit trail. Nothing selects it
> now.

Operator wants to know Cursor's likely strengths/weaknesses relative to the already-integrated we:scripts/operations/dispatch-lane-io.mjs providers (Claude Code, and Codex CLI per #3581/#3371's precedent) and, specifically, what CLASS of dispatch task suits it best -- not an assumption that it fits everywhere. Hard prerequisite, mirroring #3371's own finding for Codex verbatim (a real headless/scriptable agentic CLI mode is required for a genuine delivery-agent provider; a chat/completion API is not enough): first determine whether Cursor even offers a comparable headless/scriptable agent CLI mode at all, since it is primarily known as an IDE -- if it does not, that alone answers the evaluation and the item resolves on that finding rather than forcing a capability comparison. Genuinely open, not pre-decided in favor of adoption. If the prerequisite IS met, mirror #3371's probe method: install/authenticate against a real subscription, spawn it headless with a schema-constrained ask, break it on purpose (an unsatisfiable schema, a huge/slow request, a quota-exhausted case), and compare its parsing discipline to we:scripts/lib/judge-spawn.mjs's fail-loud approach -- then write a verdict on which task CLASS (build/delivery-agent vs. independent review/fix-dispatch vs. neither) it is actually suited for, per #3581's own risk-tiered framing of dispatch surfaces. Filing only, per the operator's explicit ask -- do NOT build or research deeply now.

## Done when

1. **The prerequisite is answered first, with evidence, not assumed.** This item's own card carries a
   concrete finding on whether Cursor offers a genuine headless/scriptable agentic CLI mode (something
   in the shape of `codex exec`/`claude --bg` — a mode that can be launched non-interactively, given a
   task, and produces tool-driven edits/output on its own) as opposed to only an IDE plugin, a chat pane,
   or a completion/chat API. Cite what was actually run or read to establish this, not a guess from the
   product's marketing.
2. **If the prerequisite fails, the item resolves right there** with a written verdict saying so, and does
   NOT force a capability comparison against Claude Code / Codex CLI that would have no CLI surface to
   compare.
3. **If the prerequisite holds, mirror `#3371`'s probe method** (install/authenticate against a real
   subscription, spawn it headless with a schema-constrained ask, break it on purpose — an unsatisfiable
   schema, a huge/slow request, a simulated quota-exhausted case if possible — and compare its output/parsing
   discipline to `we:scripts/lib/judge-spawn.mjs`'s fail-loud approach), then write a verdict on which task
   CLASS it is actually suited for (full delivery-agent build vs. independent review/fix-dispatch vs.
   neither), per `#3581`'s own risk-tiered framing of dispatch surfaces (surface risk differs sharply:
   review/fix-dispatch needs no repo-write ownership or lane-lease semantics; full delivery-agent builds need
   the hardest, most provider-specific machinery this repo has).
4. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code —
   any wiring is separate, later work, gated on this verdict being a clean yes, exactly as `#3371` deferred
   `#3369` step 3.

## Deliberately NOT in scope

- **Wiring Cursor into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port surface.** That is
  later work, gated on this item's own verdict.
- **Re-deciding whether a second/third provider should exist at all.** `#3513` already ruled that on merit
  for the dispatcher generally; this item evaluates one specific candidate against that already-open door.

## Lineage

Filed under epic `#3383` (the mechanical dispatcher). Mirrors `#3371`'s probe shape and cites `#3581`'s
risk-tiered surface framing (review/fix-dispatch vs. full delivery-agent builds) for how to state the verdict.
Companion item: the sibling Grok probe filed the same session.
