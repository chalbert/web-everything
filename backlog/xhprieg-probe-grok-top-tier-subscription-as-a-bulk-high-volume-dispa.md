---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-13"
preparedDate: "2026-09-13"
relatedTo: ["3581", "3513", "3371", "x8hzy1m", "xldrls6"]
tags: []
---

# Probe Grok (top-tier subscription) as a bulk/high-volume dispatch executor

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
same session (`#x8hzy1m`), and the later-filed open-weight PAYG probe (`#xldrls6`, DeepSeek/Qwen/etc.), which
evaluates candidates for this SAME proposed bulk/high-volume executor role — the two are not independent;
whoever prepares either must compare candidates against each other rather than in isolation.

---

# PREP — documentation-grounded research pass, 2026-09-13

Answers the stated prerequisite from current, cited xAI documentation and pricing sources (WebFetch/
WebSearch, not training-data recall), then drafts the forks this item's own hypothesis opens up. Does
**not** perform `#3371`'s live install/spawn/break probe (see "What still needs a live probe" below) —
consistent with Done-when item 5 and the operator's prepare-only instruction.

## Prerequisite verdict: PASSES — and the card's own premise needs updating, not just confirming

**The card was filed hedging on whether xAI had any scriptable CLI at all ("whatever that turns out to
be... or nothing of the kind"). It does, and it is a real agentic CLI, not merely a chat/completion API.**

1. **Grok Build** — [xAI Build docs](https://docs.x.ai/build/overview) and multiple independent trade
   coverage ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/2584/grok-build-xai-cli-2026),
   [Mervin Praison](https://mer.vin/2026/05/grok-build-cli-xai-terminal-coding-agent-with-plan-mode-subagents-and-headless-ci/),
   [DevOps.com](https://devops.com/xai-opens-grok-build-0-1-to-developers-via-api/)): an agentic CLI with
   **three** interfaces — an interactive terminal UI, **headless scripts** (`grok -p "prompt"`, streaming
   JSON output), and an Agent Client Protocol for embedding into other tools. It writes/edits files, runs
   shell commands, queries documentation, and proposes a plan a human can approve before execution — shape-
   comparable to `codex exec`/`claude -p`, the same bar `#3371` set for Codex.
2. **Launch timeline, so the finding is dated rather than assumed permanent:** beta opened 2026-05-14 for
   SuperGrok Heavy subscribers only; expanded 2026-05-25 to all SuperGrok and X Premium+ subscribers.
   [DevOps.com](https://devops.com/xai-opens-grok-build-0-1-to-developers-via-api/) confirms xAI *also*
   opened the underlying model via bare API key in public beta, without requiring any subscription.
3. **Authentication is dual-mode, and this matters for the card's own framing.** [docs.x.ai/build/overview](https://docs.x.ai/build/overview):
   either browser-based login on first launch, **or** an `XAI_API_KEY` env var. The card's premise ("not
   an API key — the whole point is subscription-included high-volume usage") is a real, statable choice,
   not a settled fact about the tool — Grok Build itself does not force a subscription; the card's own
   operator hypothesis specifically wants to test the subscription path, but a bare-API path exists as an
   alternative this item's Fork 1 below addresses.

The prerequisite — "a genuine scriptable CLI/agentic mode, not just a chat API" — is answered **yes**,
correcting the card's own hedge rather than merely confirming a guess.

## Scope note — subscription seat, not bare API key (not a fork: a scope boundary)

A fresh-context screen on an earlier draft of this prep correctly caught that this was originally
overwritten as a `## Fork` with a manufactured "Skeptic"/"Screen" pass, when the actual reasoning
underneath is a scope-allocation call, not a merit choice between two equally-eligible branches — logged
here rather than silently fixed, per this repo's own convention of correcting in place.

Grok Build authenticates two ways: browser-based login for a human subscription seat, or a bare
`XAI_API_KEY` env var, pay-as-you-go, no seat at all. **This item evaluates the subscription-seat path**,
because that is the operator's own stated hypothesis ("a high-tier ('top') Grok subscription may offer
very high usage limits"). The bare-API-key path is not rejected on any merit — it is simply the **same
cost/access shape as the sibling open-weight PAYG item** (`#xldrls6`: metered per token, no seat), so
evaluating it here would duplicate that item's own scope rather than answer a different question. Per
`#xldrls6`'s own Done-when item 2 and this card's Lineage cross-link, any Grok-via-API-key evaluation
belongs in the cross-candidate comparison both items already carry (see "Grok and open-weight PAYG add up"
below), not as a second access-model branch inside this card.

## Recommended tier to probe first — base SuperGrok, not Heavy (a cost-staged build order, not a merit fork)

Also relabeled after the same screen: the original draft argued Heavy is a *capability* mismatch for a
low-judgment role (paying for 16-agent reasoning that low-judgment work doesn't need). Under a genuine
free-and-instant-maintenance test that argument does not hold — remove cost from the picture and Heavy's
"maximum rate limits across all features" cuts the OTHER way, since a higher rate ceiling directly serves
the "bulk/high-volume" framing this item is about. The real, honest basis for preferring the cheaper tier
is cost-staged rollout, not a forced merit exclusion — stated as that, not dressed up as a fork:

- **Base SuperGrok (~$30/mo)** is the tier to probe first. Confirmed
  ([dynalord.com](https://dynalord.com/blog/grok-build-pricing)): "Grok Build comes with SuperGrok, X
  Premium+ and SuperGrok Heavy... Grok Build usage scales with [tier]" — the base tier already grants Grok
  Build access, at a tenth of Heavy's (~$300/mo) cost. No source found here states a precise rate-limit
  number for either tier, which is exactly the figure `#3371`'s own discipline says must be measured
  against a real account, not taken from vendor copy.
- **Escalate to Heavy only if a live probe finds the base tier's rate limits genuinely insufficient** for
  the target task volume. This is a reversible, evidence-gated staging decision, not a one-time capability
  ruling — if the base tier's ceiling turns out too low, Heavy's higher limits (and, incidentally, its
  16-agent reasoning tier that is otherwise wasted on low-judgment work) become the fallback, not a wrong
  choice being corrected.

## Supported by default — Grok and open-weight PAYG add up, not a fork

Required explicitly by `#xldrls6`'s own Done-when item 2 and this card's Lineage cross-link. This is a
support-both conclusion, not a forced either/or — nothing here is excluded, so it is filed as "supported by
default" rather than a `## Fork` carrying a manufactured winner. **Verdict: Grok's subscription seat and
open-weight PAYG models ADD UP as a two-tier strategy**, on real cited pricing:

- **Grok (subscription)** is a **flat-rate** cost (~$30/mo at the base tier) regardless of throughput up to
  the tier's rate-limit ceiling — the right fit when task volume is **high and steady**, since marginal
  dispatches cost nothing once the seat is paid for.
- **Open-weight PAYG (DeepSeek/Qwen, per `#xldrls6`'s own prep)** is **metered per token** (DeepSeek V4.1
  Flash: $0.30/$1.20 per 1M input/output tokens peak, $0.15/$0.60 off-peak; Qwen3-235B-A22B: $0.70/$2.80
  per 1M) — the right fit when volume is **low, spiky, or single-shot**, since there is no flat seat cost
  wasted during quiet periods, and per `#xldrls6`'s own prep, DeepSeek's API can in some cases be reached
  through this repo's *already-validated* `claude` wrapper via base-URL redirection, at near-zero
  integration cost.

**Neither replaces the other.** A dispatcher facing steady bulk low-judgment volume should prefer a Grok
subscription seat once `#3513`'s gate fires; one facing occasional or spiky low-judgment calls (or a task
needing a specific open-weight model's characteristics) should prefer metered PAYG. This is stated here,
in this card, per `#xldrls6`'s own requirement, rather than left to whichever item resolves second.

## What still needs a live probe

1. **Does browser-based subscription auth persist across headless invocations** the way Codex's ChatGPT
   login did for `#3371` (`codex login status` surviving between spawns)? Unconfirmed from docs.
2. **Real rate-limit numbers** (requests/day, tokens/week) at the base SuperGrok tier — no source cited
   here states a number; `#3371`'s own discipline (measure against a real account, don't trust vendor
   copy) applies directly.
3. **Schema-constrained output.** `docs.x.ai/build/overview`'s headless mode confirms streaming JSON output
   for tasks like codebase explanation, but did not surface a cited structural forced-schema guarantee
   equivalent to `we:scripts/lib/judge-spawn.mjs`'s `--json-schema`. Unverified — treat as a request, not a
   guarantee, until probed.
4. **Failure-mode shape** (quota exhaustion, malformed schema, timeout) — unprobed; `#3371`'s probes 5/6/8
   are the template.

## Verdict

**The operator's own hypothesis is plausible and worth a live probe, starting at the base tier, not
"top."** Grok Build clears the prerequisite (a genuine headless agentic CLI exists). For the stated
bulk/low-judgment role, base SuperGrok — not SuperGrok Heavy — is the tier to probe live first, as a
cost-staged rollout (escalate only if its rate limits prove insufficient), not because Heavy is
capability-mismatched on the merits. Per the "Grok and open-weight PAYG add up" section above, this
candidate does not compete winner-take-all with `#xldrls6`'s open-weight PAYG candidates — the two serve
different volume shapes and should both remain live options. Nothing is wired into the dispatcher; probing
the actual rate-limit ceiling and schema-enforcement behavior against a real base-tier account remains open
work per Done-when item 5.
