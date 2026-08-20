---
kind: task
status: open
dateOpened: "2026-08-20"
tags: []
---

# Declare an open-pr operation so the PR-opening guards cannot be walked around

pr-land already refuses a non-lane ref, refuses a bodyless PR, resolves the park label and applies the lane-verification finish-guard. Three PRs in one session skipped every one of those by calling the GitHub connector directly, because on a credential-less host the home appears not to work and the connector obviously does; one of the three shipped with a red suite. This declares the step over that home so it is reachable as an operation instead of by reaching around it, and re-decides none of the guards it routes to.

## The failure is a bypass, not a bug

`we:scripts/pr-land.mjs` is the home for opening a PR, and it is not thin. It refuses a ref that is not
`lane/*` (the #1934 carve-out), refuses a bodyless PR (#2332, because the drain gate rejects one at land
and stalls the queue), resolves the park label (#2622), heals id collisions after a land (#2071) — and
applies the #2833 LANE-VERIFICATION FINISH-GUARD via the shared `we:scripts/lib/lane-verify.mjs`.

All of it was skipped in one step, three times in one session, by calling the GitHub connector instead.
Not through malice or even carelessness: on a host with no `gh` credential the home *appears not to work*
and the connector obviously does, so the bypass is the path of least resistance and it looks like
resourcefulness. One of those three PRs shipped with a red suite — exactly what #2833 exists to catch.

**An operation is how a step stops being reachable by "just do it another way."** The declaration names
the home; the payload a caller submits is the one the operation computed, not one composed freehand.

## It re-decides nothing — especially not verification

This is the trap the `verify` operation fell into against its own single home, and it is a live risk here
because a verify check is exactly what one would reach for. `verifyGateDecision` has one home and
`we:scripts/pr-land.mjs` already calls it. So `planOpen` takes no marker, reads no sha, and its output mentions no
verification at all — asserted structurally, along with an assertion that the argv it builds carries no
flag capable of turning the home's guard off.

The pre-flight refusals it *does* make (ref shape, non-empty body) are the home's own rules restated
early, before a push has happened, and the home still applies them.

## Two defaults that are decisions

- **Park is the default MODE.** An agent that opens a PR for its own work and lets it march toward
  `ready-to-merge` unreviewed is the shape #2171/#2262 park exists to stop. The un-parked modes are then a
  deliberate flag rather than an omission.
- **The default park is `review:pending`, NOT `review:human`** — and the home's first listed label *is* the
  human label, so the obvious implementation is the wrong one. `review:human` is the human-only gate;
  applying it to routine agent work pushes every PR into the one queue the AI review pass cannot clear,
  which is the dilution #2563 caps the scored rubric to avoid. Derived from the home's list rather than
  typed, so it cannot name a label the home refuses.

## The credential boundary is declared, not papered over

`we:scripts/pr-land.mjs` needs `gh`. Where `gh` cannot authenticate, the `submit` effect FAILS and says so. It does
**not** degrade to a direct API call — a fallback that quietly skipped the home would reintroduce the
bypass this exists to close, which is the one thing it must never do.

What the operation always produces is the `plan`: the exact argv for the home. A caller holding a
credential submits that, unedited. The same split as `record-verdict`, where the decision is made locally
and the credentialed executor is CI.

The three submission outcomes are `opened` / `refused` / `unrun`, kept apart for the reason `verify`
keeps three: a home that refused has ANSWERED and named the guard that fired; a home that could not run
has not. Only the first tells the caller what to fix.

## Done when

1. **Executable** — `npx vitest run` over `we:scripts/operations/__tests__/open-pr.test.mjs` passes 22
   assertions; defaulting the park to the home's first label reddens 1, collapsing `unrun` into `refused`
   reddens 1, marking the submission idempotent reddens 2.
2. **Structurally anti-bypass** — a test asserts the io shell imports `child_process` and none of
   `node:https` / `node:http` / `node:net` / a fetch library: the home is its only route to GitHub.
3. **Derived** — `open-pr --help` through `we:scripts/operations/run.mjs` prints usage the CLI adapter
   derived from the declaration, with no argv parser written for it.
