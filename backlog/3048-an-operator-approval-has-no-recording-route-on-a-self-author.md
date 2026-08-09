---
bornAs: x12910p
kind: decision
status: open
dateOpened: "2026-08-09"
relatedTo: ["2844", "2895", "2888", "2439", "2398", "2946", "3006", "3028"]
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

## The design question — NOT ruled here

Two candidate shapes, deliberately left open:

1. **Make an operator approval recordable on any tier** — a ceremony that works on `review:pending` as well as
   `review:human`, carrying the same honesty tax (`--actor` + quoted `--reason`, both posted verbatim).
2. **Auto-escalate to `review:human`** — when a PR's `authored-by-actor` equals the requesting actor, raise it
   to `review:human` so the existing #2895 ceremony applies unchanged, adding no new target to the closed
   `REVIEW_LABEL_TARGETS` set.

Each has an obvious cost — (1) widens the set of states a ceremony can clear; (2) routes more PRs through the
human tier and interacts with the drain's re-hold behaviour (#3039). Ruling this is the point of the item.

## Acceptance

- [ ] The fork above is ruled, with the losing option's cost recorded.
- [ ] Given a PR that is `OPEN`, carries `review:pending`, and whose `authored-by-actor` equals the current
      `CLAUDE_CODE_SESSION_ID`, **some** sanctioned command records an operator approval and exits 0 — no raw
      `gh` call, no second session. A test asserts this on a fixture in that exact state.
- [ ] The recorded clearance is attributable: it names the operator, quotes the authorising instruction, and
      the durable record distinguishes "a human ceremony cleared it" from "an established-independent agent
      cleared it" — the distinction [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs)
      already draws.
- [ ] No route added here can clear a `review:human` PR without the existing ceremony, and INVARIANT 2 in
      `decideSetLabel` is unchanged. A test asserts the old refusals still fire.
- [ ] The refusal messages no longer name a route that cannot work from the refusing context — whatever the
      ruling, route 1 and route 2 must stop pointing at each other.
- [ ] A separate, explicit answer is recorded for the review seam: either the review seam checks reviewer ≠
      author, or it stops claiming independence in its prompts. Silence is not an acceptable outcome.

## Neighbours — related, not duplicated

- **#2844** (resolved) built [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs)
  and is the source of refusal 1. Resolved, so it cannot absorb this.
- **#2895** (resolved) built `--to=clear-human` and is the reason refusal 2 fires. Also resolved.
- **#2888** (open) is the closest existing card and the **one-tier-up twin**: it asks for a sanctioned gate-self
  override on a `review:human` PR — the question #2895 answered. It says nothing about `review:pending`.
- **#3006** (open epic) records the session-id inheritance measurement and is the closest thing to the second
  half — but it frames the CLI move as a **cost / migration** epic whose "done when" is cost and coverage. It
  never states that independence is checked at the clearance seam and not the review seam.
- **#3028** (open) is the likely **mechanism** for the review-seam half — a headless `claude -p` juror spawn,
  which mints a fresh session id and so is a genuinely different actor. It is framed purely as context/cost
  reduction and never mentions actor identity, so it does not carry this finding.
- **#2170** (resolved) installed the pre-PR subagent review seam on the rationale that "a fresh subagent has the
  same independent-eyes property as a separate review session" — the claim the measurement above falsifies at
  the actor level.
- **#2946** (open, `someday`) is the durable fix for the *forgeability* residual (a hardware human-presence
  gesture). Orthogonal: this item is about a route that does not exist, not one that can be faked.
- **#2439** / **#2398** (both resolved) define the independence bar being applied.
