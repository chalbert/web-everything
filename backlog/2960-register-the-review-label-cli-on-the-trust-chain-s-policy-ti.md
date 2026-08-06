---
bornAs: xq01bti
kind: task
status: open
dateOpened: "2026-08-05"
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
tags: [review, gate, gate-self, trust-chain]
---

# Register the review-label CLI on the trust chain's POLICY tier — it now decides what clears the gate

Since #2895 gave it the clear-human target, we:scripts/review-set-label.mjs is where a gate-self PR gets cleared and where the honesty tax that guards that act is enforced, but it is still unregistered in we:scripts/lib/gate-config.mjs — so a diff that loosens the clearance path scores blast-radius only and can be cleared by a converged agent verdict. Deliberately split out of #2895 to avoid a bootstrap hazard: registering it in the same PR would have made that PR gate-self, clearable only by the tool it was adding, leaving no path at all if the tool had a bug.

## Why it is policy tier — argued from the ratified statute, not from a file comment

The authority is [`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`](../docs/agent/platform-decisions.md#review-human-declarative-leash-only)
(#2771, ratified 2026-07-28), not [`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs)'s own file
comment. The first cut of this item argued from that comment, which is backwards: the code is the thing this
item proposes to change, so it cannot also be the thing that justifies the change (the round-4 mistake #2821 is
the retraction of).

**#2771 SPLITS the policy tier, and this item has to say which side it lands on.** That ruling holds the
**declarative leash** at `review:human` — the machine-diffable contract (`we:scripts/lib/review-policy.contract.json`),
the roster (`we:scripts/lib/gate-config.mjs`), and the invariant/conformance suites — while **derivation code**
(`we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-core.mjs`, `we:scripts/lib/review-policy.mjs`,
and the two land seams) routes to the sized independent committee at `review:pending`.

[`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs) is neither, exactly: it is a **writer / acting
seam**. It does not *derive* whether the gate fires, and it is not the declarative spec of the gate — it is the
one place the clearance is *performed*, and since #2895 it owns the `clear-human` target and the honesty tax
(`--actor` and `--reason` mandatory, and a durable comment that states what the record does and does not prove).
The argument for the leash side is that "what may clear `review:human`, and on what stated record" is a policy
statement, and a behaviour-preserving-looking diff here can still delete those requirements without reddening
the conformance suite (which does not cover this file). The argument for the derivation side is #2771's own reason
for the split: any change that alters the gate's *behaviour* necessarily reddens conformance and forces a
contract diff — a property that does NOT hold here, which is precisely why this file needs its own answer rather
than an analogy.

**The choice is not free, and the timing decides it.** Today `humanRequired = gateSelfFiles.length > 0 || …`
fires on any `isPolicyCorePath`, so simply adding the entry produces `review:human` for a diff to this file.
Once #2785 (the implementation of #2771, `status: open`) lands, `humanRequired` narrows to the `POLICY_SPEC`
basenames — and a bare `tier: 'policy'` registration would then STOP forcing a human. So this item must either
(a) place the file in `POLICY_SPEC` and record the #2771-shaped reason (what may clear `review:human` is a
leash statement, and conformance cannot catch its loosening), or (b) register it `tier: 'policy'` for the
escalation/care signal only, and cover the `clear-human` preconditions with a conformance-suite case so the
derivation-code route is honest. Pick one explicitly; do not let #2785's landing silently change the answer.

## The loop this closes

Today an agent-authored PR that drops the `clear-human` preconditions — the `--actor`/`--reason` requirement, or
the `allowClearHuman` opt-in — scores `blast-radius` only (`humanRequired: false`), so a converged agent verdict
can clear it. Once merged, the same agent can clear any gate-self PR, including the one that loosened the path.
The honesty tax is not a barrier (#2895 deferred the unforgeable signal), but it is the record every later
reader relies on, and nothing currently makes weakening it expensive.

Verified on the #2895 lane before the split: adding the entry flips `isGateSelfPath` on
[`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs) to `true`, and the PR's own reasons to
`gate-self (…) — human review required`.

## Why this is NOT in #2895

Registering it in #2895's own PR would have made THAT PR gate-self, so clearing it would have required the
`clear-human` tool the PR was still introducing. If the tool had a bug there would have been no path at all —
strictly worse than the dead end #2895 set out to fix, because the raw label edit is forbidden too. Land the
tool first, exercise it on a real gate-self PR, then tighten the tier.

## Done when

- The clearance writer [`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs) is a `tier: 'policy'`
  member of `TRUST_CHAIN` in [`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs), with a `desc`
  recording why it became leash-defining (it was not, before #2895).
- The item states, in the diff, which side of
  [`#review-human-declarative-leash-only`](../docs/agent/platform-decisions.md#review-human-declarative-leash-only)
  (#2771) this file sits on — declarative leash or derivation code — and what happens to that answer when #2785
  lands. Option (a) or option (b) above, chosen and written down, not left implicit in a tier string.
- A test pins that a diff touching it derives `humanRequired: true`.
- Landed only AFTER #2895 is on `main` and `clear-human` has been exercised at least once — this PR will itself
  be gate-self, so it is the tool's first real customer. **This ordering is prose, not a `blockedBy` edge:**
  #2895 resolves in the same commit that files this item, so an edge on it would report as a stale block from
  the moment it lands (PR #1056 review, round 4). Do not re-add it; check that #2895 is on `main` instead.
