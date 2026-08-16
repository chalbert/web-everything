---
bornAs: x12910p
kind: decision
status: open
dateOpened: "2026-08-09"
preparedDate: "2026-08-16"
relatedTo: ["2844", "2895", "2888", "2439", "2398", "2946", "3006", "3028", "3039", "3055"]
scope:
  - we:scripts/lib/review-independence.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-escalation.mjs
tags: [review, gate, gate-self, self-clear, review-independence, clearance, deadlock]
---

# An operator approval has no recording route on a self-authored `review:pending` PR

An operator verbally approved PR #1128, whose author actor is the approving session itself. Neither sanctioned
route records it: `--to=accepted` is refused as a self-clear, and the `--to=clear-human` ceremony is refused
because the PR carries `review:pending`, not `review:human`. The human-ceremony exemption exists only one tier
up, so a self-authored `review:pending` PR has **no recording route at all**. It matters because a subagent
inherits its parent's `CLAUDE_CODE_SESSION_ID`, so the independence bar #2439 / #2398 define is machine-checked
only at the **clearance** seam, never at the **review** seam.

## Reproduced live, 2026-08-09

Against the real PR — `chalbert/web-everything#1128`, `OPEN`, labels `[review:pending]`, head
`b321c8acf5b81114238e35c76be2de2925ad2421`. Its body carries `<!-- authored-by-actor: 01f39b97-274a-4078-8eeb-e7f8d6008673 -->`,
and the clearing session's `CLAUDE_CODE_SESSION_ID` is that same string. Both commands below exit non-zero
**before** any `gh` write (the mutations live further down in
[we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs), at the `gh pr edit` / `gh pr comment`
calls), so reproducing them changes nothing — the PR's labels were re-read afterwards and were unchanged.

**Route 1 — the agent verdict path.**

```
node scripts/review-set-label.mjs 1128 --repo=chalbert/web-everything --to=accepted \
  --actor="Nicolas Gilbert" --body-file=<path>
```

```
{"error":"SELF-CLEAR REFUSED — the clearing actor (01f39b97-274a-4078-8eeb-e7f8d6008673) is the PR's author;
the clearing agent must not be the author (#2439, applying #2398's distinct-fresh-validator bar). Note that a
subagent INHERITS its parent's CLAUDE_CODE_SESSION_ID, so every agent spawned by the session that opened this
PR is this same actor — nothing was changed (#2844). TWO ROUTES ACTUALLY CLEAR THIS PR, and neither is a flag
on this command. (1) THE HUMAN CEREMONY: if the PR carries review:human, re-run with --to=clear-human
--actor=<name> --reason=\"<the operator instruction authorising it>\" — that target is EXEMPT from this refusal
and the durable comment records the clearance as a human ceremony; it is itself refused when the PR does NOT
carry review:human. (2) A DIFFERENT SESSION: run the review, and this command, from a session that did not open
the PR — its own session id is then the clearing actor and the independence bar is genuinely met. There is no
--force."}
```

**Route 2 — the human ceremony the refusal names first.**

```
node scripts/review-set-label.mjs 1128 --repo=chalbert/web-everything --to=clear-human \
  --actor="Nicolas Gilbert" --reason="<the operator instruction>" --body-file=<path>
```

```
{"error":"no review:human label — nothing to clear (use --to=accepted for an ordinary parked PR)"}
```

**The two refusals point at each other.** Route 1 names route 2; route 2 names route 1. The only escape the
pair leaves is "run it from a different session", which means standing up a whole separate session purely to
record a decision a human already made in this one.

## Why the tier gap exists

The exemption is deliberate and load-bearing, not an oversight — the header of
[we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs) argues it at length: refusing
`clear-human` too "refused the operator's ENTIRE NORMAL WORKFLOW", because the operator's own `/review` shells
the CLI from inside the session that opened the PR. The exemption is safe there because `review:human` is
itself the stronger signal.

The gap is that **the two tiers are assigned by a rubric that never asks who authored the PR.**
`scoreEscalation` in [we:scripts/lib/review-escalation.mjs](../scripts/lib/review-escalation.mjs) returns
`humanRequired` only for a declarative-leash or statute path. Scored against #1128's real file list it returns:

```
escalate: true, humanRequired: false, careLevel: "high"
reasons: [ "blast-radius (scripts/lib/__tests__/output-mix.test.mjs, scripts/lib/output-mix-paths.json,
            scripts/lib/output-mix.mjs)",
           "size (587 ≥ 400 changed lines)" ]
```

So #1128 escalated on blast-radius and size — real reasons — but landed on `review:pending`, the tier with no
ceremony, and self-authorship was never an input to that choice.

## The larger finding — independence is checked at one seam only

The refusal's own words: *"a subagent INHERITS its parent's `CLAUDE_CODE_SESSION_ID`, so every agent spawned by
the session that opened this PR is this same actor."* Verified twice, independently:

- **This session, 2026-08-09.** A subagent's `CLAUDE_CODE_SESSION_ID` read `01f39b97-274a-4078-8eeb-e7f8d6008673`
  — byte-identical to its parent's. `CLAUDE_CODE_CHILD_SESSION=1` is also present, but it is a boolean flag, not
  a finer id, so nothing distinguishes the child as an actor. A headless `claude -p` spawned from the same
  session minted a **fresh** id (`8f57f787-…`), confirming the CLI is a genuinely distinct actor.
- **#3006 recorded the same measurement on 2026-08-08** (parent `01f39b97…`, child `f4386de9…`). Two runs on
  two days agree, and the fresh ids differ from each other exactly as expected.

Therefore **an "independent adversarial review" run as a subagent is, by this repo's own standard, the same
actor as the author.** Nothing checks this. [we:scripts/lib/review-core.mjs](../scripts/lib/review-core.mjs) and
[we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs) import nothing from
[we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs); they assert independence in
prompt prose only — [we:scripts/lib/review-core.mjs](../scripts/lib/review-core.mjs) literally tells the model
*"A reviewer subagent (independent of you and of the PR's original author) reported these findings"*. The only
machine-checked consumers of the independence decider are the two clearance seams,
[we:scripts/pr-land.mjs](../scripts/pr-land.mjs) (which stamps the author) and
[we:scripts/lib/auto-land-seam.mjs](../scripts/lib/auto-land-seam.mjs) plus the invoked CLI (which compare).

**State this carefully — it is not a claim those reviews were worthless.** Four PRs merged 2026-08-09 (#1122,
#1124, #1125, #1126) and the still-open #1128 were reviewed this way, and those reviews found real defects,
including an untested delivery path that left the whole suite green when the fix was deleted. The claim is
narrower and structural: **they do not meet the independence bar #2844 / #2439 define, and the gap was
invisible because the tooling only checks at the clearance seam.** A review seam that asserts independence in
prose while the clearance seam machine-refuses the same actor is an inconsistency in the standard itself.

## Prior-art grounding (no browser-standard survey — this is internal governance tooling, not a WE
standard/intent/protocol/adapter, so the *design-first* web-platform survey does not apply; the concrete-refs
check below is the substitute)

This decision does not mint any new vocabulary — it extends a shipped clearance mechanism
([we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs), `clear-human`, #2895) to a second tier.
Two facts, verified directly against the tree rather than assumed, govern both forks below:

- [we:scripts/lib/gate-config.mjs](../scripts/lib/gate-config.mjs)'s `TRUST_CHAIN` classifies
  `we:review-escalation.mjs` as `tier: 'policy', leash: 'code'` (derivation code — committee-clearable while
  behaviour-preserving) and `we:review-independence.mjs` as `tier: 'policy', leash: 'spec'` (declarative leash —
  always `review:human`, per its own roster comment: "no conformance suite backstops its behaviour… so the
  fail-closed leash is `spec`"). `we:review-set-label.mjs` itself is **not a `TRUST_CHAIN` member at all** — it
  carries no gate-self escalation weight of its own today, which shapes the touch-set below.
- [we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json) has no
  `authoredByActor`/self-authorship dimension anywhere (grepped, zero hits) — self-authorship is not
  currently expressible as a contract parameter; adding it is a new contract *dimension*, not a value tweak.

## Fork 1 — how does an operator's verbal approval get recorded, mechanically?

**Fork-existence justification.** Once Fork 1(a) is scoped to *only* fire on a PROVEN self-authored PR (its
final shape, below — tightened from an earlier draft that scoped it to any `review:pending` PR and thereby
risked overlapping (b), see the red-team note), the two branches solve the *same* narrow gap by construction
and cannot both be needed: under (b), a self-authored PR never reaches `review:pending` at all (it is
auto-escalated to `review:human` before any clearance is attempted), so (a)'s self-authored-gated ceremony
would have zero PRs it is ever reachable on — dead code. Under (a), no escalation-rubric change is needed.
Exactly one is the mechanism; building both wastes one branch.

### (a) Mint `clear-operator` — `clear-human`'s twin at the `review:pending` tier, gated to a PROVEN self-clear

Add `'clear-operator'` to `REVIEW_LABEL_TARGETS`
([we:scripts/review-set-label.mjs:100](../scripts/review-set-label.mjs#L100)). `decideSetLabel` grows a
branch parallel to the existing `clear-human` one
([we:scripts/review-set-label.mjs:152-170](../scripts/review-set-label.mjs#L152-L170)), keyed on
`REVIEW_LABELS.pending` instead of `REVIEW_LABELS.human` — label-shape only, exactly like every other branch
in this pure core:

```js
// we:scripts/review-set-label.mjs — decideSetLabel, new branch alongside the existing clear-human one
if (to === 'clear-operator') {
  if (!hasReviewLabel(currentLabels, REVIEW_LABELS.pending)) {
    return {
      allowed: false, addLabel: '', removeLabels: [], keepsHuman: isHuman,
      reason: 'no review:pending label — nothing to clear (use --to=clear-human for a review:human PR, or '
        + '--to=accepted for an ordinary parked PR)',
    };
  }
  return {
    allowed: true,
    addLabel: REVIEW_LABELS.accepted,
    removeLabels: [REVIEW_LABELS.pending, REVIEW_LABELS.changes],
    keepsHuman: isHuman, // clear-operator never touches review:human — INVARIANT 2 is untouched
    reason: 'operator-approved via --to=clear-operator — review:pending cleared, review:accepted added',
  };
}
```

**The WHO-check — deliberately NOT inside `decideSetLabel`, and deliberately NOT absent either.**
`clear-human`'s own doc says plainly "nothing here checks WHO is asking" — safe there because the
`review:human` label itself is the rare, gated signal (only leash/statute diffs ever earn it). `review:pending`
is the *default* parked state nearly every PR passes through, so the same "label presence is enough" logic
would turn `clear-operator` into a general bypass of ordinary independent review for the common case, not just
the self-authored edge case #3048 reports — a real hole an earlier draft of this fork missed. The fix: reuse
the SAME `decideClearerIndependence` call `runReviewLabelCli` already makes for `--to=accepted`
([we:scripts/review-set-label.mjs:489-505](../scripts/review-set-label.mjs#L489-L505)), but invert the
requirement — `clear-operator` is refused UNLESS independence reads `SELF_CLEAR` (the accepted path's refused
case becomes this path's REQUIRED case):

```js
// we:scripts/review-set-label.mjs — runReviewLabelCli, alongside the existing independence computation
if (to === 'clear-operator' && (!independence || independence.status !== INDEPENDENCE.SELF_CLEAR)) {
  fail(
    `--to=clear-operator is for a PROVEN self-authored review:pending PR only (#3048) — this PR's clearer/`
    + `author independence read "${independence ? independence.status : 'unknown'}", not a self-clear. Use `
    + '--to=accepted if you are not the author, or run this from the authoring session\'s own /review.',
  );
}
```

This keeps `clear-operator`'s blast radius scoped to *exactly* the reported gap — it can never be used as a
general override on a PR someone else authored — while inheriting the honesty tax verbatim (`--actor` +
quoted `--reason`, mandatory, posted verbatim —
[we:scripts/review-set-label.mjs:354-379](../scripts/review-set-label.mjs#L354-L379)) and a new
`allowClearOperator` DI boolean mirroring `allowClearHuman`
([we:scripts/review-set-label.mjs:281-293](../scripts/review-set-label.mjs#L281-L293)). The durable comment
gets a THIRD phrasing alongside "a human ceremony cleared it" / "an established-independent agent cleared
it": *"an operator ceremony cleared it (review:pending tier, proven self-authored)"* — satisfying the
acceptance bullet that the record must distinguish the three.

*Known occurrence:* not a new pattern — `clear-human` (#2895, shipped) is this exact shape already in
production, one tier up. (a) is that shape, reused where the hole actually is, with its precondition swapped
from "rare label present" to "self-authorship proven" to match the risk profile of the tier it now covers.

*Residual cost, accepted:* the honesty tax (a written `--actor` + `--reason`) is still the only thing standing
between a legitimate operator ceremony and a fabricated one — #2895 ruled the unforgeable-actor-signal deferred
(#2946 is the durable fix) and this fork inherits that residual unchanged, at a tier it did not previously
reach. No new residual is introduced; an existing, already-accepted one now applies in one more place.

### (b) Auto-escalate: self-authorship becomes a third `humanRequired` trigger, so `clear-human` (unchanged) applies

Add self-authorship as an input to `scoreEscalation`
([we:scripts/lib/review-escalation.mjs:574](../scripts/lib/review-escalation.mjs#L574), currently
`leashFiles.length > 0 || statuteFiles.length > 0`):

```js
// we:scripts/lib/review-escalation.mjs — scoreEscalation, hypothetical third humanRequired input
const selfAuthored = authoredByActor && requestingActor && authoredByActor === requestingActor;
const humanRequired = leashFiles.length > 0 || statuteFiles.length > 0 || selfAuthored;
```

**Statute-overlap — a real collision, not a stated inconvenience.**
[#review-human-declarative-leash-only](../docs/agent/platform-decisions.md#review-human-declarative-leash-only)
(#2771, ratified 2026-07-28) rules `review:human`'s trigger set closed at exactly three members — a
declarative-leash edit, a raw new statute rule, or an un-ratified decision — in these words: *"`review:human`
means genuine human judgment is essential… **not** 'an agent might be policing its own leash.'"* That rejected
phrase is not merely analogous to self-authorship — "an agent policing its own leash" and "the same actor
authoring and clearing its own PR" are the same structural case (the actor evaluating its own prior act), so
(b) proposes exactly the trigger #2771 names and excludes. Confirmed independently at the code layer:
`we:review-escalation.mjs` is `leash: 'code'` (committee-clearable while conformance stays green,
[we:scripts/lib/gate-config.mjs:101-107](../scripts/lib/gate-config.mjs#L101-L107)), but the contract has no
self-authorship dimension to preserve (prior-art grounding above), so this change reddens
`we:review-policy.conformance.test.mjs` and forces a `we:review-policy.contract.json` edit — a `leash: 'spec'`
file ([we:scripts/lib/gate-config.mjs:114-124](../scripts/lib/gate-config.mjs#L114-L124)) — which is itself
`review:human`-gated. It also reopens #3039-shaped work (drain re-hold must not silently strip a clearance) for
the NEW trigger — #3039 is resolved for the existing one, but that fix does not transfer automatically to a
newly-added trigger. Net: (b) either amends a ratified statute (a separate, larger decision this item has no
authority to make) or ships an unratified widening of it — either way, a cost this item cannot absorb on its
own authority. This is the deciding fact, not the drain interaction alone.

## Default: (a). Skeptic: attacked on all four axes; SURVIVES on statute-overlap and citation-scope (the (b)
collision is real and, on re-reading #2771's own rejected-alternative clause, is a *closer* textual hit than
first drafted — "an agent policing its own leash" directly names self-authorship's structure); SURVIVES on
classification once (a) is gated to proven self-clear (see fork-existence justification — an earlier,
un-gated draft of (a) risked coexisting with (b) rather than excluding it, weakening the fork; the gate fixes
this); REFUTED-AND-FIXED on merit — the un-gated draft of `clear-operator` would have let an operator
ceremony-bypass ordinary independent review on ANY `review:pending` PR (the common tier nearly every PR
passes through), not just the self-authored edge case reported; fixed by requiring `decideClearerIndependence`
read `SELF_CLEAR` before `clear-operator` is reachable at all (code above). No citation-scope issue found on
either branch — #2771/#2840 govern the escalation TRIGGER set, which (b) edits and (a) never touches; citing
them against (b) and not against (a) is scoped correctly on both sides.

Screen: clear. Q1 (impl-detail-as-standard) — not applicable by the item's own nature: this is pure
engine/tooling-layer governance code, not a WE standard/intent/protocol with a WE↔FUI boundary to mis-draw. Q2
(merit vs. prioritization) — a genuine merit gap survives even under a "both free to build" hypothetical: (b)
would still re-litigate a ratified statute regardless of engineering cost, so this is a real either/or, not
prioritization dressed as a fork.

**Skeptic (fresh-context, 2026-08-16):** An independent fresh-context agent (not the author) subsequently
re-verified this pass. Every citation was re-checked exactly against live code —
[we:scripts/lib/gate-config.mjs](../scripts/lib/gate-config.mjs)'s `TRUST_CHAIN` entries, the verbatim quote at
[#review-human-declarative-leash-only](../docs/agent/platform-decisions.md#review-human-declarative-leash-only),
[we:scripts/lib/review-escalation.mjs:574](../scripts/lib/review-escalation.mjs#L574), and
[we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs)'s `clear-human` branch and
independence-check block — all checked out exactly as quoted above. All four skeptic axes survive re-attack,
including a genuine attempted counter-exploit against the SELF_CLEAR gate on the recommended `clear-operator`
mechanism: forging `CLAUDE_CODE_SESSION_ID` to a victim's public author id was tried directly and confirmed to
grant no capability beyond what the pre-existing, unforged `--to=accepted` path already allows — no new
residual was found. One strengthening note on the "no new residual" claim in (a)'s "Residual cost, accepted"
paragraph above (correct, but under-argued): forging session identity toward `clear-operator` is strictly
dominated by the pre-existing, unforged, zero-identity-gated `accepted` path, since that path already grants
the same capability to anyone able to forge an id, with no forgery even required — worth stating explicitly
rather than leaving implicit. The original self-run pass's conclusions are independently corroborated, not
merely repeated.

**Screen (fresh-context, 2026-08-16):** Re-run independently against the same two-confusion test. Both Q1
(impl-detail-as-standard) and Q2 (merit vs. prioritization) came back clear, matching the self-run screen's
findings above.

## Supported by default (not a fork) — the review-seam half (acceptance bullet 5)

**Standing test:** can "the review seam checks reviewer ≠ author" and "the review seam stops claiming
independence in its prompts" coexist? Yes — the second is cheap and ships now; the first requires a review
call that can actually MINT a distinct actor id, which an in-process `Task`/`Agent`-tool subagent structurally
cannot (the #2844/#3006 measurement: a subagent inherits its parent's `CLAUDE_CODE_SESSION_ID`). That minting
capability already exists on a *different* path — [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs)
(#3028, resolved) spawns a `claude -p` juror with `--session-id <runId-derived>`, which does mint a fresh id —
but wiring `we:review-core.mjs`'s pre-PR editor↔reviewer loop through that spawn mechanism instead of an
in-process subagent, for every review call in the repo, is precisely the cost/latency/cache-behaviour research
epic #3006 (open, explicitly "research first") already exists to derisk. Jamming that migration into this
item's build would risk an unbudgeted cost regression #3006 is chartered to prevent. **This is a cost-driven
sequencing call, correctly NOT written as a `## Fork N`** (confirmed by the two-confusion screen: under a
"both free to build" hypothetical you would just build both at once — the deferral is prioritization, which is
exactly why it belongs here and not in Fork 1).

- **Now, in this item's own build (small, in-scope):** reword the prompt
  [we:scripts/lib/review-core.mjs:351](../scripts/lib/review-core.mjs#L351) — `'A reviewer subagent (independent
  of you and of the PR\'s original author) reported these findings:'` — to drop the actor-identity claim it
  cannot back up today, e.g. *"A fresh-context reviewer subagent reported these findings:"* (fresh CONTEXT is
  true; independent ACTOR is not, until #3006 lands).
- **Also now, cheap and additive (skeptic-pass addition — a log-only interim step, not a refusal):** wherever
  the review seam's verdict is later posted to an open PR, durably record the reviewing session's own
  `CLAUDE_CODE_SESSION_ID` alongside the verdict (mirroring how `we:pr-land.mjs` already stamps
  `authored-by-actor` at open) — recorded, not yet gated, the same "prove it's knowable before you refuse on
  it" discipline #2844 itself modeled at the clearance seam before enforcement existed. This makes a future
  audit (or #3006's eventual machine check) a read of history rather than something only provable going
  forward.
- **Later, under #3006/#3028 (already filed, not re-opened here):** once review calls route through
  `we:judge-spawn.mjs`'s CLI spawn (or an equivalent that mints a fresh session id), wire an actual
  reviewer-≠-author machine check into the review seam itself, mirroring `decideClearerIndependence`, not only
  the clearance seam. Filed as this item's owed cross-reference on #3006, not a new item.

Skeptic: attacked the "defer to #3006" answer as a possible cop-out; SURVIVES — the we:review-core.mjs pre-PR loop
runs on nearly every change in the repo, so an unresearched migration risks the exact cost blowup #3006 exists
to prevent; the interim durable-logging step (added above) closes the "silence is not acceptable" bar without
paying that cost. Screen: clear (see Fork 1's Q1/Q2 notes above — same reasoning applies; this section is
already correctly framed as prioritization, not a fork).

### Review jury (provisional — pre-registered #2638)

Care level: `high` (the item's scope touches `we:scripts/lib/review-independence.mjs` — declarative leash,
always human-gated — and the escalation/clearance derivation code directly). This jury binds against the
item's predicted scope (`we:scripts/lib/review-independence.mjs`, `we:scripts/review-set-label.mjs`,
`we:scripts/lib/review-escalation.mjs`) and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

## Acceptance

- [ ] Fork 1 is ratified — (a) or (b) — with the losing option's cost recorded (already drafted above; the
      ratifying turn confirms or overrides the recommended default).
- [ ] Given a PR that is `OPEN`, carries `review:pending`, and whose `authored-by-actor` equals the current
      `CLAUDE_CODE_SESSION_ID`, **some** sanctioned command records an operator approval and exits 0 — no raw
      `gh` call, no second session. A test asserts this on a fixture in that exact state.
- [ ] The recorded clearance is attributable: it names the operator, quotes the authorising instruction, and
      the durable record distinguishes THREE outcomes — "a human ceremony cleared it" (review:human tier), "an
      operator ceremony cleared it" (review:pending tier, proven self-authored — only if (a) is ratified), and
      "an established-independent agent cleared it" — the distinction
      [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs) already draws for the
      first and third.
- [ ] No route added here can clear a `review:human` PR without the existing ceremony, and INVARIANT 2 in
      `decideSetLabel` is unchanged. A test asserts the old refusals still fire.
- [ ] If (a) is ratified: a test asserts `--to=clear-operator` is refused on a PR whose independence reads
      anything other than `SELF_CLEAR` (proven non-self-authored, or unknown) — the blast-radius fix the
      skeptic pass added.
- [ ] The refusal messages no longer name a route that cannot work from the refusing context — whatever the
      ruling, route 1 and route 2 must stop pointing at each other.
- [ ] The review-seam half is delivered as part of this item's own build (it is not a fork, see "Supported by
      default" above): the `we:scripts/lib/review-core.mjs:351` prompt no longer claims actor-level
      independence it cannot prove, and the reviewing session's id is durably logged alongside its verdict.

## Neighbours — related, not duplicated

- **#2844** (resolved) built [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs)
  and is the source of refusal 1. Resolved, so it cannot absorb this.
- **#2895** (resolved) built `--to=clear-human` and is the reason refusal 2 fires. Also resolved.
- **#2888** (open) is the closest existing card and the **one-tier-up twin**: it asks for a sanctioned gate-self
  override on a `review:human` PR — the question #2895 answered. It says nothing about `review:pending`.
- **#3006** (open epic) records the session-id inheritance measurement and is the closest thing to the second
  half — but it frames the CLI move as a **cost / migration** epic whose "done when" is cost and coverage. It
  never states that independence is checked at the clearance seam and not the review seam.
- **#3028** — **status corrected during prep: `resolved` (2026-08-09), not open.** It shipped
  [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs), a headless `claude -p` juror spawn that
  mints a fresh session id (`--session-id <runId-derived>`) and so is a genuinely different actor. It is the
  **mechanism** the review-seam "supported by default" section above points to for the eventual machine check —
  it exists today, but wiring the pre-PR review loop through it is #3006's job, not #3028's (framed purely as
  context/cost reduction there, never actor identity).
- **#2170** (resolved) installed the pre-PR subagent review seam on the rationale that "a fresh subagent has the
  same independent-eyes property as a separate review session" — the claim the measurement above falsifies at
  the actor level.
- **#2946** (open, `someday`) is the durable fix for the *forgeability* residual (a hardware human-presence
  gesture). Orthogonal: this item is about a route that does not exist, not one that can be faked.
- **#2439** / **#2398** (both resolved) define the independence bar being applied.
- **#3039** (resolved) is the drain re-hold notification fix for an operator's `clear-human` clearance being
  silently revoked. Cited in Fork 1(b)'s cost above: that fix does not automatically cover a NEW `humanRequired`
  trigger (b) would add — it would need re-verifying (or re-doing) for the new escalation path, one more reason
  (b) is more expensive than it first looks.
- **#3055** (open decision, prepared in parallel — not coordinated with here, cross-referenced because it is
  genuinely adjacent) reports a DIFFERENT gap in the SAME two files: the independence check reads only the
  PR-opener's stamped id, never a co-author who lands a commit on the branch without opening the PR — so a
  session that never opened the PR can still pass as "independent" while having authored code on it. Orthogonal
  to this item (that is a capture/scope gap in WHO counts as author; this item is a missing RECORDING ROUTE once
  authorship is already known) but any eventual build for either should check the other did not just land, since
  both touch `we:scripts/review-set-label.mjs` and `we:scripts/lib/review-independence.mjs`.
- **Trust-chain classification (verified during prep, not previously stated in this item):**
  [we:scripts/lib/gate-config.mjs](../scripts/lib/gate-config.mjs)'s `TRUST_CHAIN` marks
  `we:review-independence.mjs` `leash: 'spec'` (always `review:human` to edit) and `we:review-escalation.mjs`
  `leash: 'code'` (committee-clearable while behaviour-preserving); `we:review-set-label.mjs` is not a
  `TRUST_CHAIN` member at all. This is the concrete-refs grounding behind Fork 1's statute-overlap argument and
  the pre-registered jury's `high` care level.
