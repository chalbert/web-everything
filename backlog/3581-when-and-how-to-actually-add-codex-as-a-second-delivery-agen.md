---
bornAs: xzf5v6w
kind: decision
parent: "3580"
status: resolved
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/review-dispatch.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs", "we:scripts/lib/review-independence.mjs"]
dateOpened: "2026-09-07"
dateResolved: "2026-09-08"
codifiedIn: one-off
tags: []
---

# When and how to actually add Codex as a second delivery-agent provider

The fork this epic's staged decomposition defers rather than answers inline: once we:scripts/operations/dispatch-lane-io.mjs's provider port is extracted (this epic's step 1) and #3371's Codex-CLI probe reports back (already filed against the judge seam, blockedBy: 3370), WHEN does Codex actually get wired into the dispatcher, and on WHAT surface first. #3369's own text already sketches the shape for the judge axis -- 'seated as ONE panelist... gated behind explicit opt-in' -- and this decision extends the same reasoning to the harder dispatcher axis, where the candidate surfaces differ sharply in risk: (a) independent PR review / fix-dispatch (we:scripts/operations/review-dispatch.mjs and friends) needs no repo-write ownership, no lane-lease semantics, and gets STRUCTURALLY MORE independence value from a second provider than a second Claude session ever could -- we:scripts/lib/review-independence.mjs's self-clear refusal keys on CLAUDE_CODE_SESSION_ID, a same-harness signal #2895 already ruled forgeable by 'an agent with shell access on the same machine'; a reviewer running under an entirely different provider's own auth/session mechanism cannot forge that signal by exporting one env var, which is a genuine structural upside discussed with the operator tonight, not merely a migration cost; (b) full delivery-agent builds (we:scripts/operations/dispatch-lane-io.mjs's DISPATCH_EFFECT sink) need the hardest, most Claude-specific machinery this repo has built -- session-liveness polling (dispatchStillHolds), resume-vs-relaunch semantics (the single-flag '--resume' constraint #3557 measured), lane-lease ownership, and the full converge-before-PR loop -- none of which we:skills-src/inspect-agent-health/agent-health.mjs's Claude-specific JSONL-transcript reader has any equivalent for on a second provider yet. Recommended default, stated so it is not left implicit: pilot Codex narrowly on independent-review/fix-dispatch ONLY after this epic's port-extraction step lands and #3371's probe confirms Codex CLI is buildable against the judge contract -- never start with full delivery-agent builds. This matches the operator's own product-fit reasoning discussed tonight: Codex's agentic coding-tool shape is a closer match to this system's own shape than to a pure judge/review role, which argues for eventually extending it toward delivery-agent work, but the INDEPENDENCE and RISK profile argues for starting on review/fix-dispatch regardless of that longer-term fit, because that is where a wrong integration costs a bad verdict, not two agents racing one lane clone. #3513 (ratified 2026-09-06) already gates ANY cross-provider routing on 'a second subscription actually held, or a measured usage-window cap -- not a decision'; this card's fork is scoped entirely inside that gate, deciding SEQUENCE and SURFACE once/if that trigger fires, not whether it fires.

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

1. Land this epic's step 1 (`#3579` — pure port extraction, unblocked, no new provider).
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

## Recommended sequence — pacing amendment (operator, 2026-09-08)

**Step 4's timeline is tightened.** The sequence above still stands as ordered — step (a)/review-pilot-first
is still correct, for exactly the risk reasoning stated in the Fork above (blast radius of a bad Codex verdict
vs. two agents racing one lane clone) — but the *pacing* between step 3 and step 4 is no longer open-ended.
The operator's explicit instruction tonight: once step 3 (Codex wired as an opt-in review/fix-dispatch
panelist, proven against real PR traffic) lands cleanly, step 4 (the full delivery-agent build/prepare-capacity
pilot) should follow **soon after** — not on the indefinite "only once proven, never as default, whenever that
naturally happens" pacing this card's step 4 text otherwise implies. This is a timeline tightening only: it
does not re-open the sequence itself, does not move step 4 ahead of step 3, and does not weaken the risk-based
reasoning for why review-first is still correct — it only shortens how long step 4 is allowed to sit
unstarted once step 3 has actually held up.

## Ratified (Fork — Option a) — 2026-09-08

**Ratified 2026-09-08 by the operator (Nicolas Gilbert).** Fork default taken as ruled: **(a) — pilot Codex
narrowly on independent review/fix-dispatch first**, per this card's own recommended default and the
concretely stated sequence above (land `#3579` → let `#3371`'s Codex-CLI probe report back → wire Codex as an
opt-in review panelist, extended to `we:scripts/operations/review-dispatch.mjs`'s fix-dispatch path
specifically → only later, and now on the tightened "soon after" pacing above, pilot full delivery-agent
builds). Option (b) — starting on full delivery-agent builds first — is not taken, for the reasons this card's
Fork section already states (the hardest, least-proven machinery this repo has, attempted first, with the
named worst-case failure — two agents in one lane clone — as the downside).

**`#3513`'s graduation trigger is confirmed FIRED.** `#3513`'s own text (`## Supported by default — not
forks`) gates any cross-provider routing on "a second subscription actually held, or a measured usage-window
cap — not a decision." The operator explicitly confirmed tonight that this trigger has now fired: tonight's
session's real token consumption counts as satisfying it, not merely as a general priority bump. The concrete
evidence cited is this same session — an extremely high-volume overnight session responding to a real
capacity incident, involving dozens of concurrent subagents over many hours. This does not reopen `#3513`'s
own ruling (still `#3513`'s to record); it is recorded here because it is what makes this card's Fork
decision live rather than hypothetical — the gate this card's own body says its Fork is "scoped entirely
inside" has now actually opened.

## Gemini sequencing — pacing amendment (operator, 2026-09-08)

**Supersedes an earlier, looser draft of this same amendment.** A same-day earlier draft (opened as PR #2067,
branch `lane/3581-gemini-pacing-amendment`, never merged) recorded the operator's mid-session remark that
Gemini should follow Codex "soon after," "not gated behind Codex fully maturing first." That draft was
overtaken before it landed: in further discussion the same night, the operator weighed the capacity/usage-limit
risk of running two still-immature provider integrations at once and revised the pacing to the stricter rule
below. **The rule stated in this section — wait for Codex to be hooked in before activating Gemini — is the
operative one and supersedes the earlier "soon after, not gated" language.** The earlier draft is noted here
only so a future reader who encounters it (e.g. via PR #2067's history) does not mistake it for standing
guidance; it does not coexist with the rule below as an alternative reading.

**The operator's explicit instruction:** "let's wait for codex to be hooked before we add gemini, but work
for it can continue." Recorded here as a card-note-only amendment, the same way the step-4 pacing amendment
above was recorded — no new tracking item filed, for the same reasoning that amendment used.

**What this sequences.** Actually wiring/adding Gemini as a second delivery-agent/review provider waits until
Codex is genuinely hooked in — meaning this card's own step 3 (Codex wired as an opt-in review/fix-dispatch
panelist, proven against real PR traffic, per the Recommended sequence above) has actually **landed and held
up**, not merely been decided or scheduled. Deciding to pilot Codex first is not the same event as Codex
working in production; this amendment gates Gemini activation on the latter.

**What is explicitly NOT blocked.** Preparatory work FOR Gemini may continue in parallel right now —
research/probe-shaped work such as a Gemini-CLI probe analogous to what `#3371` ran for Codex against the
judge contract, or adapter-shape scoping against the provider-port extraction (`#3369` step 1). Only the
actual wiring-in/activation of Gemini as a live provider waits on Codex's own hook landing; investigation and
design work do not.

**Why the pacing tightened.** The earlier "soon after, not gated" draft under-weighted a real operational
risk: running two still-immature cross-provider integrations at once (Codex not yet proven, Gemini freshly
wired) compounds the failure surface this whole card exists to manage carefully (session-liveness, resume
semantics, lane-lease ownership — see the epic's own body above) at exactly the moment neither integration has
track record to lean on. Sequencing Gemini's activation strictly after Codex's step 3 has held up removes that
compounding risk while still letting Gemini prep work proceed now, which is what "work for it can continue"
preserves.

**What this does not decide.** This is a sequencing/pacing note only. It does not pick Gemini as the
confirmed second-provider candidate — that choice, if and when it is made, is still open per this card's own
"Deliberately NOT in scope" section below (`#3371` decided Codex over Gemini for the *judge* seam specifically;
this amendment does not extend or reopen that call to the dispatcher/delivery-agent seam). It does not reopen
anything else this card has already ratified.

## Claude/Codex load balancing — pacing addendum (operator, 2026-09-08)

**Card note only, same doctrine as the amendment above** — nothing to build yet, so no new tracking item
filed; this depends on this card's own step 3 (Codex wired and proven) landing first to have real numbers to
tune against.

**Why not fully automatic.** There is no live usage/rate-limit API to read for any provider today — confirmed
in-session: no `claude usage` CLI command, no local cache file either provider exposes. A fully automatic
capacity-aware router is not buildable right now for lack of a signal to route on.

**Accepted near-term approach.** Once Codex is actually hooked into review/fix-dispatch (this card's step 3),
balance load with a manually-tuned routing weight/percentage per provider on the dispatch-lane's provider-port
selection (e.g. "70% Claude / 30% Codex"), adjusted by the operator over time based on observed rate-limit
hits — not a fully automatic algorithm.

**Related but separate, not to be built now.** Reactive rate-limit-triggered failover — falling back to the
other provider when one actually hits a limit — composes with the static weight above as a backstop for when
the weight guess is wrong. Mentioned here only because the operator raised it alongside the weighting idea; it
is not scoped or committed by this note.

## Deliberately NOT in scope

- **Whether to add a second provider at all.** `#3513` already ruled that on merit.
- **Picking Codex over Gemini CLI for the dispatcher specifically.** `#3371` already made that call for the
  judge seam with stated reasoning (closest argv/session-continuity match); this card does not re-open it,
  only sequences what happens once that verdict is in hand.
