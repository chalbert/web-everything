---
bornAs: xhprieg
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

# Probe Grok (top-tier subscription) as a bulk/high-volume dispatch executor

> **DUPLICATE OF #3664 — resolved as such, not because the work happened twice.** Both cards carry
> `bornAs: xhprieg`. #3664 is the real item — it carries the documentation-grounded PREP research pass
> landed via PR #2194 (preparedDate 2026-09-13), which this bare copy never received.
>
> This copy exists because PR #2194 branched to prepare `x8hzy1m`/`xhprieg`/`xldrls6` before sibling PR
> #2179 (which minted this card as `#3661`) had merged, working directly on its own hash-named copies of
> those three cards rather than waiting on the merge. When #2194 landed, the drain — doing exactly its
> job — JIT-numbered its own copy of the same hash fresh, as `#3664`, independently of `#3661` already
> having claimed that identity. `check:standards`' `duplicateBornAs` rule (#3244/#3650 precedent) caught
> the resulting twin.
>
> Kept rather than deleted, per the backlog's own rule that a file is an audit trail. Nothing selects it
> now.

Operator's own hypothesis, to be TESTED not assumed: a high-tier ('top') Grok subscription may offer very high usage limits, but the model/tooling is probably not suitable for all dispatch operations -- worth evaluating specifically as a bulk/high-volume executor for simpler, lower-judgment tasks, not as a general-purpose delivery or review agent replacement. Same hard prerequisite as the sibling Cursor probe filed this session, mirroring #3371's own finding for Codex verbatim (a real headless/scriptable agentic CLI mode is required for a genuine delivery-agent provider; a chat/completion API is not enough): first determine whether Grok (or xAI's tooling around it) even offers a comparable scriptable CLI/agentic mode suitable for this system's dispatch pipeline, or only a chat API -- if the latter, that alone answers the evaluation. Genuinely open, not pre-decided in favor of adoption. If the prerequisite IS met, mirror #3371's probe method: install/authenticate against the actual top-tier subscription (not an API key -- the whole point is subscription-included high-volume usage), spawn it headless with a schema-constrained ask, break it on purpose (an unsatisfiable schema, a huge/slow request, a quota-exhausted case), and compare its parsing discipline to we:scripts/lib/judge-spawn.mjs's fail-loud approach -- then write a verdict on whether it is genuinely usable as a bulk executor for simple/low-judgment tasks specifically (per the operator's own hypothesis), not a general delivery/review agent, per #3581's risk-tiered framing of dispatch surfaces. Filing only, per the operator's explicit ask -- do NOT build or research deeply now.

## Done when

1. **The prerequisite is answered first, with evidence, not assumed.** This item's own card carries a
   concrete finding on whether Grok (via xAI's own tooling, whatever that turns out to be — a CLI, an SDK
   with an agentic/tool-use loop suitable for headless dispatch, or nothing of the kind) offers a genuine
   headless/scriptable agentic mode, as opposed to only a chat UI or a bare completion/chat API. Cite what
   was actually run or read to establish this, not a guess from marketing copy.
2. **If the prerequisite fails, the item resolves right there** with a written verdict saying so, and does
   NOT force a bulk-executor capability comparison that would have no scriptable surface to run against.
3. **If the prerequisite holds, mirror `#3371`'s probe method** (install/authenticate against the actual
   top-tier subscription — not an API key, since the whole point of this evaluation is subscription-included
   high-volume usage — spawn it headless with a schema-constrained ask, break it on purpose: an unsatisfiable
   schema, a huge/slow request, a simulated quota-exhausted case if possible), and compare its output/parsing
   discipline to `we:scripts/lib/judge-spawn.mjs`'s fail-loud approach.
4. **Test the operator's own hypothesis directly, not just capability in the abstract.** The specific
   question this item exists to answer: is Grok's usage ceiling high enough, and its tool/output discipline
   reliable enough, to serve as a bulk executor for simple, low-judgment dispatch tasks specifically — not
   whether it could replace a general-purpose delivery or review agent. Say plainly whether the hypothesis
   held, and if so, roughly what task shape (by the same size/judgment terms this repo already uses for
   backlog items) it is suited for.
5. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code —
   any wiring is separate, later work, gated on this verdict being a clean yes, exactly as `#3371` deferred
   `#3369` step 3.

## Deliberately NOT in scope

- **Wiring Grok into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port surface.** That is
  later work, gated on this item's own verdict.
- **Re-deciding whether a second/third provider should exist at all.** `#3513` already ruled that on merit
  for the dispatcher generally; this item evaluates one specific candidate, for one specific task class,
  against that already-open door.
- **Evaluating Grok as a general delivery-agent or review-panel replacement.** The operator's own framing
  scopes this to the bulk/high-volume, low-judgment lane specifically; a broader role is a different question
  this item does not answer.

## Lineage

Filed under epic `#3383` (the mechanical dispatcher). Mirrors `#3371`'s probe shape and cites `#3581`'s
risk-tiered surface framing for how to state the verdict. Companion items: the sibling Cursor probe filed the
same session (`#3660`), and the later-filed open-weight PAYG probe (`#3662`, DeepSeek/Qwen/etc.), which
evaluates candidates for this SAME proposed bulk/high-volume executor role — the two are not independent;
whoever prepares either must compare candidates against each other rather than in isolation.
