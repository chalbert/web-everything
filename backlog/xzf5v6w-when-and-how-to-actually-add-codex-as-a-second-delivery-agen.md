---
kind: decision
parent: "x6jk877"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/review-dispatch.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs", "we:scripts/lib/review-independence.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# When and how to actually add Codex as a second delivery-agent provider

The fork this epic's staged decomposition defers rather than answers inline: once we:scripts/operations/dispatch-lane-io.mjs's provider port is extracted (this epic's step 1) and #3371's Codex-CLI probe reports back (already filed against the judge seam, blockedBy: 3370), WHEN does Codex actually get wired into the dispatcher, and on WHAT surface first. #3369's own text already sketches the shape for the judge axis -- 'seated as ONE panelist... gated behind explicit opt-in' -- and this decision extends the same reasoning to the harder dispatcher axis, where the candidate surfaces differ sharply in risk: (a) independent PR review / fix-dispatch (we:scripts/operations/review-dispatch.mjs and friends) needs no repo-write ownership, no lane-lease semantics, and gets STRUCTURALLY MORE independence value from a second provider than a second Claude session ever could -- we:scripts/lib/review-independence.mjs's self-clear refusal keys on CLAUDE_CODE_SESSION_ID, a same-harness signal #2895 already ruled forgeable by 'an agent with shell access on the same machine'; a reviewer running under an entirely different provider's own auth/session mechanism cannot forge that signal by exporting one env var, which is a genuine structural upside discussed with the operator tonight, not merely a migration cost; (b) full delivery-agent builds (we:scripts/operations/dispatch-lane-io.mjs's DISPATCH_EFFECT sink) need the hardest, most Claude-specific machinery this repo has built -- session-liveness polling (dispatchStillHolds), resume-vs-relaunch semantics (the single-flag '--resume' constraint #xu2krte measured), lane-lease ownership, and the full converge-before-PR loop -- none of which we:skills-src/inspect-agent-health/agent-health.mjs's Claude-specific JSONL-transcript reader has any equivalent for on a second provider yet. Recommended default, stated so it is not left implicit: pilot Codex narrowly on independent-review/fix-dispatch ONLY after this epic's port-extraction step lands and #3371's probe confirms Codex CLI is buildable against the judge contract -- never start with full delivery-agent builds. This matches the operator's own product-fit reasoning discussed tonight: Codex's agentic coding-tool shape is a closer match to this system's own shape than to a pure judge/review role, which argues for eventually extending it toward delivery-agent work, but the INDEPENDENCE and RISK profile argues for starting on review/fix-dispatch regardless of that longer-term fit, because that is where a wrong integration costs a bad verdict, not two agents racing one lane clone. #3513 (ratified 2026-09-06) already gates ANY cross-provider routing on 'a second subscription actually held, or a measured usage-window cap -- not a decision'; this card's fork is scoped entirely inside that gate, deciding SEQUENCE and SURFACE once/if that trigger fires, not whether it fires.

## Fork — which surface does Codex pilot on first, once the gate trigger fires

**Fork-existence justification.** The branches cannot coexist: a first Codex integration either starts on
independent review/fix-dispatch, or it starts on full delivery-agent builds. Piloting both at once would
conflate two very different failure costs (a wrong verdict vs. two agents racing one lane clone) in one
uncontrolled experiment, so one must be chosen first.

- **(a) Independent review / fix-dispatch first (`we:scripts/operations/review-dispatch.mjs` and the judge
  seam #3369/#3370/#3371 already targets).** No repo-write ownership, no lane-lease semantics to get wrong.
  Gets a genuine independence upgrade for free: a Codex-run reviewer cannot forge `CLAUDE_CODE_SESSION_ID`
  the way a same-harness Claude subagent structurally can (per #2895's own ruling on that signal). Blast
  radius of a bad Codex output is a bad verdict a human or a second lens can catch, not a corrupted lane.
- **(b) Full delivery-agent builds first (`we:scripts/operations/dispatch-lane-io.mjs`'s `DISPATCH_EFFECT`
  sink).** Matches the operator's own product-fit observation (Codex's agentic coding-tool shape is a closer
  match to THIS system's shape than to a pure judge role) more directly and sooner. But it requires this
  epic's hardest, least-proven piece first — a `we:skills-src/inspect-agent-health/agent-health.mjs`-equivalent
  transcript adapter, resume-vs-relaunch semantics for a CLI #3371 has not yet probed for this purpose, and
  lane-lease ownership under a provider this repo's guard machinery has never seen. A wrong integration here
  costs two agents in one lane clone, this repo's own named worst-case dispatch failure.

**Default: (a).** Not because (b) is a bad long-term goal — the operator's product-fit reasoning for (b) is
sound and should shape where this eventually goes — but because (a) is available sooner (needs only this
epic's step 1 + step 2, both already scoped), costs less when wrong, and its own success is what actually
de-risks attempting (b) at all: a Codex reviewer proving out under real PR traffic is direct evidence about
whether Codex's dispatch/session model can be trusted with anything, before betting a lane clone on it.

## Recommended sequence, stated concretely

1. Land this epic's step 1 (`#x11ujy1` — pure port extraction, unblocked, no new provider).
2. Let `#3371` (already filed, `blockedBy: 3370`) report its Codex-CLI probe verdict against the judge
   contract — reuse it rather than re-probing.
3. Wire Codex as a second judge/reviewer implementation per `#3369` step 3 (opt-in, one panelist among several)
   — this already covers review generally; extend the SAME wiring to `we:scripts/operations/review-dispatch.mjs`'s
   fix-dispatch path specifically, since that is the dispatcher-shaped analogue of "independent review."
4. Only once step 3 has run against real PR traffic and the operator has watched it hold up: build this
   epic's step 3 (the `we:skills-src/inspect-agent-health/agent-health.mjs`-equivalent adapter) and pilot
   Codex on a narrow, reversible slice of full delivery-agent dispatch — never as the default provider, and
   never before `#3513`'s own gate (a real second subscription or a measured usage-window cap) has actually
   fired.

## Deliberately NOT in scope

- **Whether to add a second provider at all.** `#3513` already ruled that on merit.
- **Picking Codex over Gemini CLI for the dispatcher specifically.** `#3371` already made that call for the
  judge seam with stated reasoning (closest argv/session-continuity match); this card does not re-open it,
  only sequences what happens once that verdict is in hand.
