---
bornAs: xldrls6
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

# Probe open-weight PAYG models (DeepSeek, Qwen) as a bulk/high-volume dispatch executor

> **DUPLICATE OF #3665 — resolved as such, not because the work happened twice.** Both cards carry
> `bornAs: xldrls6`. #3665 is the real item — it carries the documentation-grounded PREP research pass
> landed via PR #2194 (preparedDate 2026-09-13), which this bare copy never received.
>
> This copy exists because PR #2194 branched to prepare `x8hzy1m`/`xhprieg`/`xldrls6` before sibling PR
> #2179 (which minted this card as `#3662`) had merged, working directly on its own hash-named copies of
> those three cards rather than waiting on the merge. When #2194 landed, the drain — doing exactly its
> job — JIT-numbered its own copy of the same hash fresh, as `#3665`, independently of `#3662` already
> having claimed that identity. `check:standards`' `duplicateBornAs` rule (#3244/#3650 precedent) caught
> the resulting twin.
>
> Kept rather than deleted, per the backlog's own rule that a file is an audit trail. Nothing selects it
> now.

Operator's own hypothesis, to be TESTED not assumed: pay-as-you-go API access to open-weight "minimal"-tier models (DeepSeek, Qwen, and other similarly-priced/smaller models) might handle SOME class of dispatch task in this system well enough to reduce load on the top agents (Claude, Codex) with no quality impact -- not a general "replace everything" proposal. This item sits alongside the sibling Grok probe (#3661) and Cursor probe (#3660) filed the same session under this same epic, and is explicitly NOT independent of the Grok item: Grok's own card frames a top-tier subscription as a candidate bulk/high-volume executor for simple, low-judgment dispatch tasks. Open-weight PAYG models are a candidate for that SAME role -- either REPLACING Grok's proposed bulk-executor slot or ADDING TO it as a second/cheaper option alongside it. Whoever prepares this item later must compare candidates against each other for that shared task-executor role, not evaluate each in isolation. Same hard prerequisite as the sibling probes, mirroring #3371's own finding for Codex verbatim (a real headless/scriptable agentic mode with tool use is required for a genuine delivery-agent provider; a bare chat/completion API is not enough): first determine whether any of these open-weight models even offer a usable interface for this system's dispatch pipeline -- most are API-only (chat/completion endpoints), not agentic-CLI-with-tools like Codex/Claude Code, so likely candidates are narrower, lower-judgment tasks: simple classification, formatting/lint-style fixes, generating a commit message from structured data, drafting a PR description from a diff summary -- NOT full delivery-agent work requiring tool use and judgment, unless research shows otherwise. Genuinely open, not pre-decided. The "no impact" bar is explicit: any candidate task needs a real quality comparison against the current agent doing that task today, not just cost savings, before being trusted -- same discipline used for Codex validation (#3371). Filing only, per the operator's explicit ask -- do NOT build or research deeply now.

## Done when

1. **The prerequisite is answered first, with evidence, not assumed.** This item's own card carries a
   concrete finding on whether any candidate open-weight PAYG model (DeepSeek, Qwen, or another
   similarly-priced/smaller model) offers a genuine headless/scriptable agentic interface suitable for this
   system's dispatch pipeline — tool use, structured output discipline — as opposed to only a bare
   chat/completion API. Cite what was actually run or read to establish this, not a guess from marketing
   copy. Most candidates are expected to be API-only; if so, that alone narrows the evaluation to
   lower-judgment, non-tool-using task shapes (classification, formatting/lint-style fixes, commit-message
   generation from structured data, PR-description drafting from a diff summary) rather than ruling the
   whole item out the way a hard CLI-mode failure would for a delivery-agent candidate.
2. **The relationship to the sibling Grok probe (#3661) is resolved explicitly, not left implicit.**
   Grok's own card proposes a top-tier subscription as a candidate bulk/high-volume executor for simple,
   low-judgment dispatch tasks. This item's verdict states plainly whether open-weight PAYG models compete
   for that SAME role — and if both remain viable, whether one REPLACES the other or they ADD UP (e.g. one
   handles a task class the other doesn't, or one is a fallback/cost hedge for the other) — rather than
   producing two verdicts that never talk to each other.
3. **For each candidate task class identified, a real quality comparison is run against the agent doing
   that task today** (Claude or Codex, whichever currently owns it) — not a cost-only comparison. State the
   basis for the comparison (sample size, what was scored, how) plainly enough that a reader can judge
   whether "no quality impact" is a supported claim or an assumption.
4. **The verdict names, per candidate task class, one of: adopt, reject, or needs a larger trial** — with
   the reasoning, mirroring `#3371`'s own verdict shape for Codex and `#3581`'s risk-tiered framing of
   dispatch surfaces (a classification/formatting task carries far less risk than anything touching a repo
   write or lane-lease semantics).
5. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code —
   any wiring is separate, later work, gated on this verdict identifying at least one clean-yes task class.

## Deliberately NOT in scope

- **Wiring any open-weight model into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port
  surface.** That is later work, gated on this item's own verdict.
- **Re-deciding whether a second/third provider should exist at all.** `#3513` already ruled that on merit
  for the dispatcher generally; this item evaluates a candidate class of models for one specific task
  shape (bulk/low-judgment executor), against that already-open door.
- **Evaluating any of these models as a general delivery-agent or review-panel replacement.** The operator's
  own framing scopes this to the lower-judgment, narrow-task lane specifically; a broader role is a
  different question this item does not answer.
- **Picking a winner between this item and #3661 (Grok) in isolation.** Per point 2 above, the
  comparison between them is part of THIS item's own done-when, not deferred to a separate reconciliation
  item.

## Lineage

Filed under epic `#3383` (the mechanical dispatcher), the same session as the sibling Grok probe (`#3661`)
and Cursor probe (`#3660`). Mirrors `#3371`'s probe shape (the prerequisite-first method) and `#3581`'s
risk-tiered surface framing for how to state the verdict. Explicitly cross-referenced against `#3661`:
both evaluate candidates for the same proposed bulk/high-volume, low-judgment task-executor role, and a
later preparer must compare them against each other rather than in isolation.
