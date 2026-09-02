---
bornAs: xf38r2m
kind: story
size: 5
parent: "3279"
status: active
scope: ["we:scripts/operations/review-dispatch.mjs", "we:skills-src/review/review-agent-brief.md"]
dateOpened: "2026-08-31"
dateStarted: "2026-09-02"
tags: []
---

# Technically enforce review-dispatch's never-merge rule, and review:human's never-self-accept rule, against a compromised dispatched session

Independent-review finding (PR #1756 r1, security lens, CONFIRMED): the dispatched review session's "never self-accept, never merge" rule lived only as PROSE in we:skills-src/review/review-agent-brief.md. Nothing technically restricted its tools, so a prompt-injection payload embedded in the reviewed PR's own diff/description could in principle talk it into running `--answer=accept` or a merge command directly, bypassing we:scripts/operations/review-loop-cli.mjs's own code-enforced refusal entirely. Needs a technical mitigation (a restricted tool/permission default, or a wrapper refusing that argv) rather than prose alone. Filed rather than blocking #3279's land, mirroring the #2895 precedent: state the residual honestly, defer the hardening.

## Re-scoped for `#3434` (2026-09-01) — RECONCILIATION, per that decision's own "Done when" #4

`#3434` (ratified) made a genuinely independent `accept` verdict on a `review:pending` PR clear MECHANICALLY —
`we:scripts/lib/review-loop-policy.mjs`'s `reviewLoopAutoConfirm` itself now answers `accept` (and, per `#3442`,
`prevention-outstanding` too) for that tier, unattended, by design. That REMOVES this item's original premise
for `review:pending`: a dispatched session recording an accept on that tier is no longer a bypass to harden
against — it is the ratified mechanism working as intended, and its own independence guard (the two-juror
read→judge→reduce pipeline, unrelated to tool restriction) is what actually backs it, not a "never self-accept"
rule. Narrowed accordingly, never left standing against the new doctrine:

- **STILL IN SCOPE — `review:human`'s never-self-accept.** `#3434` explicitly left this tier's human-only
  ceremony (`--to=clear-human`) UNCHANGED ("yes review human are for human," operator, 2026-09-01) — a dispatched
  session must still never be able to talk itself into clearing a `review:human` PR. This is exactly the
  original PR #1756 finding, just scoped to the ONE tier where "never self-accept" is still the rule.
- **STILL IN SCOPE — never-merge, both tiers.** `#3434` does not touch `gh pr merge` / `gh pr merge -X PUT` at
  all; a dispatched review session (whichever tier's PR it is reviewing) running that command directly is
  unrelated to the accept-mechanism change and remains exactly the vulnerability class PR #1756 flagged.
- **DROPPED — `review:pending`'s self-accept.** No longer a thing to harden against; hardening it would fight
  the ratified mechanism `#3434`/`#3442` intentionally built.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after, covering ONLY the two
   still-in-scope cases above: (a) a compromised dispatched session cannot clear a `review:human` PR's
   `review:accepted`, and (b) a compromised dispatched session cannot merge the PR it is reviewing, on either
   tier.

## Progress

Closed both, technically, via a `--disallowedTools` deny list `dispatchReview` now bakes into EVERY spawned
review session's own `claude` argv (`REVIEW_DISPATCH_DISALLOWED_TOOLS` in we:scripts/operations/review-dispatch.mjs)
— a harness-enforced refusal, never something the model's own judgment mediates:

- `Bash(gh:*)` — the WHOLE `gh` CLI, not just `gh pr merge` — case (b), both tiers. (r1 finding, see below: a
  narrower merge-only deny still left a self-accept and a raw-API merge reachable.)
- `Bash(node <path>:*)` for we:scripts/review-set-label.mjs, we:scripts/apply-review-request.mjs, and
  we:scripts/operations/run.mjs — every script that can reach the `--to=clear-human` ceremony (the direct #2895
  single home, the cloud-VM applier whose `clear-human` guard is a named field rather than a verified one, and
  the `record-verdict` operation's staging path) — case (a).

**r1 self-review finding (CONFIRMED, fixed before opening the PR):** the first draft denied only
`Bash(gh pr merge:*)`. The adversarial reviewer found `gh pr edit --add-label review:accepted --remove-label
review:human` reaches the SAME case-(a) outcome with no merge verb at all, and `gh api repos/*/pulls/*/merge -X
PUT` reaches the same case-(b) outcome under a different verb. Both close by denying `gh` wholesale (the
sanctioned arc never calls `gh` directly at all, so this costs nothing legitimate) rather than by enumerating
GitHub-mutation shapes one at a time. While testing this finding by hand, the reviewer's live `gh` probe
accidentally added `review:accepted` to a REAL PR (chalbert/web-everything#1) — that PR had already been merged
back in 2026-06, so nothing auto-landed off it, and the label has been removed.

**r2 self-review finding (CONFIRMED, fixed before opening the PR):** the r1 fix's own
`reviewDispatchDisallowedToolsArgs()` returned `['--disallowedTools', '<joined-value>']` as TWO separate argv
elements. `--disallowedTools` is a VARIADIC CLI option, and the real `claude` binary was confirmed — twice, by
independent review passes, plus a local `claude -p` smoke test run directly against this fix — to keep
consuming subsequent argv tokens as MORE tool patterns, swallowing the review PROMPT itself and starting the
dispatched session with nothing to review at all. Every earlier version of this deny list would have silently
no-op'd 100% of dispatched reviews. Fixed by joining flag and value into ONE `--disallowedTools=<joined-value>`
argv element (`=`, not a space) — confirmed correct by re-running the smoke test with the real 4-pattern list.

The brief in we:skills-src/review/review-agent-brief.md's own sanctioned arc (lane-pool acquire, the
review-loop CLI, lane-pool release) never calls any of the four, so nothing legitimate is lost. Not a sandbox —
a literal `Bash(<prefix>:*)` rule does not catch a `bash -c '...'` or path-indirection rewrite — see the
constant's own header for the residual this narrows to.

Executable proof (Done-when #1): the test suite at we:scripts/operations/__tests__/review-dispatch.test.mjs —
the new `REVIEW_DISPATCH_DISALLOWED_TOOLS (#3433)` describe block fails on pre-change code (verified:
`reviewDispatchDisallowedToolsArgs is not a function`) and passes after.
