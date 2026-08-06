---
kind: story
size: 5
parent: "x169s8f"
blockedBy: ["xctebq6"]
status: open
dateOpened: "2026-08-06"
tags: []
---

# Evidence block on the PR: red before, green after

The PR body carries the proof its item's criteria were met — each criterion, the command that checks it, and its result against the base commit and against head. A check that already passes on main proves nothing, so the before-and-after pair is what makes a criterion evidence rather than a claim, and it lets the jury confirm a run instead of judging done-ness.

Depends on #xctebq6 — there is nothing to evidence until items carry criteria.

## Red before, green after

A tier-1 criterion that passes on `main` proves nothing. That is the tautology trap: *"the test I wrote passes."* So the evidence is the **pair** — the check run against the base commit and against head, failing then passing. Both runs are mechanical, so this can be a gate rather than a claim, and it is the cheapest possible form of review: a deterministic check replacing a model's judgment (the hookable-vs-judgment rule applied to review itself).

Each executable criterion also becomes a permanent regression check, so the cost compounds downward over time.

## What the PR carries

An `<!-- evidence -->` block alongside the existing lane-manifest block, one row per criterion: the criterion, the command, the base-commit result, the head result. The producer (we:scripts/pr-land.mjs) already composes the body and already embeds a machine-readable manifest, so this rides the same seam.

**The jury's mandate changes shape.** It starts by confirming the evidence reproduces, and only then looks for what the criteria *missed* — a far narrower and cheaper read than "find what is wrong with this diff."

## Cost and scope

Running every check twice is not free. Gate it on care: **required above `low`**, optional at `low`, so routine internal work does not pay for it. A criterion whose base-commit run is impossible (a new file, a new command) records that instead of a false red.

## Build

- we:scripts/pr-land.mjs — compose the evidence block into the PR body at open
- we:scripts/lib/lane-verify.mjs — run each tier-1 criterion against the base commit and head, capture both results
- we:scripts/lib/review-core.mjs — the juror mandate leads with "confirm the evidence, then look for what it missed"
- we:scripts/lib/__tests__/ — block round-trip, the always-green-on-base refusal, the not-runnable-on-base case

## Acceptance

1. **Executable** — a vitest case asserting a criterion whose check passes on **both** base and head is refused as evidence with a named reason, not silently accepted.
2. **Executable** — a vitest round-trip: compose an evidence block into a PR body, parse it back, and get the same rows (the same shape the manifest parser already proves).
3. **Executable** — a vitest case asserting a criterion not runnable on the base commit records `not-runnable`, never a false red.
4. **Observable** — a PR opened above `low` care carries a non-empty evidence block; one at `low` care opens fine without one.
5. **Executable** — `npm run check:standards` green.
