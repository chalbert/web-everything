---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Register the review-label CLI on the trust chain's POLICY tier — it now decides what clears the gate

Since #2895 gave it the clear-human target and its human-ceremony tty gate, we:scripts/review-set-label.mjs holds the one barrier between an agent and a self-cleared gate-self edit, but it is still unregistered in we:scripts/lib/gate-config.mjs — so an agent-clearable PR could delete the tty check and then self-clear the PR that deleted it. Deliberately split out of #2895 to avoid a bootstrap hazard: registering it in the same PR would have made that PR gate-self, clearable only by the tool it was adding, leaving no path at all if the tool had a bug.

## Why it is policy tier, by the roster's own rubric

[`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs) draws the line at code that decides *whether the
gate fires and what clears it*. Before #2895, [`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs)
only APPLIED a swap decided elsewhere, so leaving it off the roster was defensible. #2895 changed that: it now
owns the `clear-human` target and the tty ceremony — literally the definition of what clears a gate-self PR.
The roster's own `auto-land-seam` entry already describes it as the INVARIANT-2-guarded clearance writer, so it
was treated as trust-critical in prose while staying unregistered in the matcher.

## The loop this closes

Today an agent-authored PR deleting the `decideHumanCeremony` tty check scores `blast-radius` only
(`humanRequired: false`), so a converged agent verdict can clear it. Once merged, the same agent can clear any
gate-self PR — including the one that removed the check.

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
- A test pins that a diff touching it derives `humanRequired: true`.
- Landed only AFTER #2895 is on `main` and `clear-human` has been exercised at least once — this PR will itself
  be gate-self, so it is the tool's first real customer.
