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
preparedDate: "2026-09-13"
relatedTo: ["3581", "3513", "3371", "3663", "3664", "xjo6uux"]
tags: []
---

# Probe open-weight PAYG models (DeepSeek, Qwen) as a bulk/high-volume dispatch executor

> **Resolved as a completed PREP-only pass, per the operator's explicit "filing/prep only" instruction
> (PR #2194).** The prerequisite is answered for both DeepSeek and Qwen with a written verdict. What is
> NOT done — by this card's own Done-when items 3-4 and PR #2194's own unchecked test-plan line — is the
> live quality-trial and schema-fidelity probe. That work is carried forward to a fresh successor item,
> `#xjo6uux`, rather than left half-tracked on this card, so this PREP deliverable can close cleanly.
> `graduatedTo: none` because no new standard entity was spawned — the successor is a plain backlog item.

Operator's own hypothesis, to be TESTED not assumed: pay-as-you-go API access to open-weight "minimal"-tier models (DeepSeek, Qwen, and other similarly-priced/smaller models) might handle SOME class of dispatch task in this system well enough to reduce load on the top agents (Claude, Codex) with no quality impact -- not a general "replace everything" proposal. This item sits alongside the sibling Grok probe (#3664) and Cursor probe (#3663) filed the same session under this same epic, and is explicitly NOT independent of the Grok item: Grok's own card frames a top-tier subscription as a candidate bulk/high-volume executor for simple, low-judgment dispatch tasks. Open-weight PAYG models are a candidate for that SAME role -- either REPLACING Grok's proposed bulk-executor slot or ADDING TO it as a second/cheaper option alongside it. Whoever prepares this item later must compare candidates against each other for that shared task-executor role, not evaluate each in isolation. Same hard prerequisite as the sibling probes, mirroring #3371's own finding for Codex verbatim (a real headless/scriptable agentic mode with tool use is required for a genuine delivery-agent provider; a bare chat/completion API is not enough): first determine whether any of these open-weight models even offer a usable interface for this system's dispatch pipeline -- most are API-only (chat/completion endpoints), not agentic-CLI-with-tools like Codex/Claude Code, so likely candidates are narrower, lower-judgment tasks: simple classification, formatting/lint-style fixes, generating a commit message from structured data, drafting a PR description from a diff summary -- NOT full delivery-agent work requiring tool use and judgment, unless research shows otherwise. Genuinely open, not pre-decided. The "no impact" bar is explicit: any candidate task needs a real quality comparison against the current agent doing that task today, not just cost savings, before being trusted -- same discipline used for Codex validation (#3371). Filing only, per the operator's explicit ask -- do NOT build or research deeply now.

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
2. **The relationship to the sibling Grok probe (#3664) is resolved explicitly, not left implicit.**
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
- **Picking a winner between this item and #3664 (Grok) in isolation.** Per point 2 above, the
  comparison between them is part of THIS item's own done-when, not deferred to a separate reconciliation
  item.

## Lineage

Filed under epic `#3383` (the mechanical dispatcher), the same session as the sibling Grok probe (`#3664`)
and Cursor probe (`#3663`). Mirrors `#3371`'s probe shape (the prerequisite-first method) and `#3581`'s
risk-tiered surface framing for how to state the verdict. Explicitly cross-referenced against `#3664`:
both evaluate candidates for the same proposed bulk/high-volume, low-judgment task-executor role, and a
later preparer must compare them against each other rather than in isolation.

---

# PREP — documentation-grounded research pass, 2026-09-13

Answers the stated prerequisite from current, cited sources (WebFetch/WebSearch, not training-data recall)
and drafts the forks the finding opens up. Does **not** perform the live quality-comparison trial Done-when
item 3 requires — that stays open work (see "What still needs a live trial" below) — consistent with
Done-when item 5 and the operator's prepare-only instruction.

## Prerequisite verdict: PASSES for BOTH candidates — correcting the card's own pessimistic premise

**The card's own filing text predicted "most are API-only... likely candidates are narrower [non-agentic]
tasks... unless research shows otherwise."** Research shows otherwise, for both named candidates, through
**three** distinct access paths — a richer picture than the card anticipated, in the same spirit as
`#3371` Probe 12's "correction, in place" convention (the earlier text is left as-is; this section
supersedes it rather than rewriting it).

1. **Qwen has an OFFICIAL agentic CLI.** [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) — Alibaba's
   own open-source terminal agent (~27k GitHub stars, Apache-2.0), forked from Google's Gemini CLI and
   tuned for Qwen3-Coder models. Per [Qwen Code docs](https://qwenlm.github.io/qwen-code-docs/en/users/overview/)
   and [DataCamp's tutorial](https://www.datacamp.com/tutorial/qwen-code): it directly reads, writes, and
   edits files, runs shell commands (`!<cmd>` or a persistent shell mode), connects to MCP servers, and
   coordinates sub-agents — genuine tool-use parity with Claude Code/Codex CLI in shape, not a bare
   chat/completion API. Installed via `npm i -g @qwen-code/qwen-code`.
2. **DeepSeek has NO official CLI, but a well-established third-party one exists — meeting the card's own
   stated bar** ("official or well-established third-party"). **DeepSeek-TUI** amassed **5,000+ GitHub
   stars in days** ([Cybernews](https://cybernews.com/ai-news/deepseek-claude-code-clone-popularity-github/)),
   and per its own docs page ([deepseek-ai/awesome-deepseek-agent](https://github.com/deepseek-ai/awesome-deepseek-agent/blob/main/docs/deepseek-tui.md))
   it reads/edits files, runs shell commands, searches the web, manages git, connects to MCP servers, and
   coordinates sub-agents — again genuine tool use, not a bare API wrapper. (A second, much smaller
   community tool, `PierrunoYT/deepseek-cli`, exists at only 78 stars — not "well-established" by
   comparison, and not the candidate this prep recommends.)
3. **A third path, structurally cheaper than either dedicated CLI: DeepSeek's platform accepts the
   Anthropic Messages API format.** Multiple independent sources on pointing Claude Code at third-party
   models ([atlascloud.ai](https://atlascloud.ai/blog/guides/claude-code-third-party-api-setup),
   [morphllm.com](https://www.morphllm.com/use-different-llm-claude-code),
   [imfing.com](https://imfing.com/til/use-custom-llm-providers-in-claude-code/)) confirm Claude Code's
   `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_MODEL` env vars let it talk to **any**
   Anthropic-Messages-API-compatible endpoint, and that DeepSeek is named among the providers publishing
   such an endpoint. If DeepSeek's endpoint faithfully implements Anthropic's structured-output semantics
   (unverified — see below), **this repo's own already-validated `claude` wrapper** —
   `we:scripts/lib/judge-spawn.mjs` and `we:scripts/operations/dispatch-lane-io.mjs`, including its
   `--tools ""` removal guarantee and `--json-schema` forced-tool-call guarantee — could point at DeepSeek
   with **zero new provider code**, just an env-var swap.

The prerequisite is answered **yes, and more richly than assumed**: this is not a "narrow it to
non-agentic tasks" outcome per the card's own pessimistic default — it is a genuine three-way choice.

## Recommended integration path to probe first (a build-order/cost note, not a fork)

A fresh-context screen on an earlier draft of this prep correctly caught that this section was originally
written as a `## Fork` carrying a manufactured "Skeptic"/"Screen" pass, when the actual choice underneath
is a **build-sequencing decision**, invisible to anything outside this repo (no external consumer of the
dispatch system's output would ever see or care whether DeepSeek was reached via a base-URL swap or a
dedicated CLI wrapper, as long as the resulting guarantees hold) and gated purely on **which is cheaper to
try first**, not on a forced either/or between two equally-eligible candidates. Logged here rather than
silently fixed, per this repo's own convention of correcting in place.

Two integration paths exist for a tool-using open-weight candidate:

- **Base-URL redirection through the existing `claude` wrapper** (DeepSeek's Anthropic-compatible
  endpoint) — **the cheaper path, recommended to try first for DeepSeek.** If a live probe confirms the
  endpoint's structured-output enforcement is faithful to real Anthropic semantics (not just
  request-shape-compatible), this delivers the SAME guarantees `we:scripts/lib/judge-spawn.mjs` already
  validates for Claude, at near-zero build cost — no new provider module, no new argv/parsing/failure-mode
  code. The real, open risk that a live probe (not this prep pass) must settle: "Anthropic-compatible"
  commonly means request/response **shape** compatibility, not necessarily identical **enforcement
  fidelity** — an endpoint could accept a `--json-schema`-shaped request and still silently return
  free-form prose where Anthropic's own API would force a tool call.
- **A dedicated new provider wrapper** (Qwen Code officially; DeepSeek-TUI as the well-established
  third-party fallback for DeepSeek) — full parity with whatever discipline the model's own tooling
  actually enforces, at the same build cost `#3371` already paid once for Codex. For **Qwen**, this is
  already the cheapest, best-supported path available — no redirection trick to probe, no fidelity risk,
  ~27k-star official tooling — so it is the one to try first for Qwen specifically, not a fallback. For
  **DeepSeek**, treat this as the fallback if the base-URL path's fidelity probe fails, not a preemptive
  build.

**Recommended order:** DeepSeek via base-URL redirection first — the fastest possible signal on whether
the zero-new-code path works at all, and a finding reusable for any future Anthropic-compatible open-weight
candidate, not just DeepSeek — then Qwen Code directly (its own official CLI, not the redirection path)
if DeepSeek's probe or task-fit findings warrant a second candidate.

## Supported by default — Grok and open-weight PAYG add up, not a fork

Per this item's own Done-when item 2 and Lineage, and mirrored in `#3664`'s own prep pass (also filed as
"supported by default" there, not a forced fork, after the same screen): **Grok's subscription seat and
open-weight PAYG models ADD UP rather than compete winner-take-all.** Grok (flat ~$30/mo once `#3513`'s
gate fires) fits steady, high-volume low-judgment traffic; open-weight PAYG (DeepSeek V4.1 Flash:
$0.30/$1.20 per 1M input/output tokens peak, $0.15/$0.60 off-peak per
[layer3labs.io](https://www.layer3labs.io/guides/deepseek-pricing) and
[benchlm.ai](https://benchlm.ai/deepseek/api-pricing); Qwen3-235B-A22B: $0.70/$2.80 per 1M per
[deepinfra.com](https://deepinfra.com/blog/qwen-api-pricing-2026-guide)) fits low/spiky/single-shot volume
where a flat seat would sit idle, and DeepSeek specifically offers the near-zero-integration-cost path
identified above. Stated once, in both cross-linked cards, per the operator's explicit instruction that
neither item may resolve this in isolation.

## Task-class scoping — unchanged from the card's own framing, still correct

The card's own named task classes — classification, formatting/lint-style fixes, commit-message generation
from structured data, PR-description drafting from a diff summary — remain the right STARTING scope
**regardless of which integration path wins**, since even a fully tool-capable candidate (Qwen Code,
DeepSeek-TUI) does not need tool use for a single-shot classification call. This is **supported by
default**, not re-forked: nothing in this prep pass's findings argues for widening scope toward full
delivery-agent work, and `#3581`'s risk-tiered framing (cited in this card's own Done-when item 4) already
argues the opposite — a classification/formatting task carries far less risk than anything touching a
repo write, so starting there needs no new justification.

## What still needs a live trial — not resolvable by documentation alone

This prep pass cannot satisfy Done-when item 3 (a real quality comparison against the agent doing each task
today) or Done-when item 4 (a per-task-class adopt/reject/needs-larger-trial verdict) — those require actually
running candidate tasks through a real account and scoring the output, the same live-fire discipline
`#3371` applied to Codex. Sharpened by this pass rather than left blind:

1. **Schema/tool-fidelity of DeepSeek's Anthropic-compatible endpoint** (Fork 1(a)) — the single highest-
   leverage thing to probe first, since a positive result unlocks the cheapest path for any future
   Anthropic-compatible open-weight candidate, not just DeepSeek.
2. **A real quality comparison, per task class**, against whichever of Claude/Codex currently performs it
   — sample size and scoring method stated plainly, mirroring `#3371`'s own evidentiary bar.
3. **Failure-mode shape** (quota exhaustion, malformed schema, timeout, auth loss) for whichever path is
   probed — `#3371`'s probes 5/6/8 are the template.

## Verdict

**Buildable, on a path cheaper than the card itself anticipated.** Both named candidates clear the
prerequisite — Qwen via an official, well-supported agentic CLI; DeepSeek via a well-established
third-party CLI (DeepSeek-TUI, 5,000+ stars) **and** a structurally cheaper base-URL-redirection path
through this repo's own already-validated `claude` wrapper, pending a fidelity probe. Per the "Grok and
open-weight PAYG add up" section above, this candidate class does not compete winner-take-all with
`#3664`'s Grok subscription — the two add up across different volume shapes. The card's own non-agentic task-class scope (classification, formatting,
commit messages, PR descriptions) remains the right starting point regardless of which path is probed
first. Nothing is wired into the dispatcher; the quality-comparison trial and schema-fidelity probe remain
open work per Done-when items 3-5.
