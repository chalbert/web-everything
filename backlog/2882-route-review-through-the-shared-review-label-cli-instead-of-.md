---
bornAs: xd6yhuu
kind: story
size: 2
status: resolved
relatedTo: ["2409", "2644", "2470"]
scope: ["we:skills-src/review/SKILL.md", "we:scripts/review-set-label.mjs"]
dateOpened: "2026-08-02"
dateStarted: "2026-08-03"
dateResolved: "2026-08-03"
costTokens: "in:200 cw:192600 cr:13236200 out:67100"
costUsd: 10.22
costSessions: 1
tags: [review, gate, skill, invariant]
---

# Route /review through the shared review-label CLI instead of hand-rolling gh pr edit

The `/review` skill swaps the verdict label with raw `gh pr edit`, bypassing the module #2644 designates as the single home of that swap — so the accept loses its `reviewed-sha` stamp and INVARIANT 2 goes unenforced.

## What's wrong

`we:scripts/review-set-label.mjs` is documented as "the SINGLE HOME of the shared review-label CLI harness (#2644)": a pure `decideSetLabel` decides the swap, a thin `runReviewLabelCli` does the `gh` observe→edit→comment→re-read arc, and on an `accepted` verdict it stamps `buildReviewedShaMarker(headRefOid)` into the durable accept comment. The conveyor's re-arm tool was collapsed into a thin shim over it precisely so nothing re-implements the swap.

`we:skills-src/review/SKILL.md` never calls it. Steps 4 and 5 tell the operator to run `gh pr edit … --add-label review:accepted` and `gh pr comment …` by hand.

## Two consequences, both observed

**1 — the accept loses its `reviewed-sha` marker.** This is what happened on PR #983 on 2026-08-02. The human accept posted no marker, so `parseReviewedSha` took the newest marker from any comment — the drain's own advisory-review stamp, two rounds old — and `acceptanceCoversHead` judged the acceptance stale and re-parked. The PR was re-parked five times and finally landed only through the `--no-review-escalation` operator valve.

**2 — INVARIANT 2 is unenforced on the human path.** The refusal to clear a `review:human` PR to `review:accepted` lives in `decideSetLabel`'s pure core and is described as "unbypassable — the CLI cannot route around it". That is true of the CLI; the skill routes around the *module*. Nothing else catches it — no workflow under `we:.github/workflows/` references the review labels — so a raw `gh pr edit --add-label review:accepted` on a gate-self PR simply succeeds. The one invariant the whole `review:human` tier exists to protect has no enforcement on the exact path a human uses.

## Also: undo the wrong fix in PR #1001

The first attempt at (1) added prose to the skill telling it to hand-stamp `buildReviewedShaMarker` alongside the raw `gh` calls. That treats the symptom and entrenches the hand-rolled path — a second implementation of a contract that already has a single home, which is the same defect class the #983 review itself raised (one on-disk format, two readers, only one hardened). Replace that prose rather than build on it.

## Definition of done

- `/review` steps 4-5 invoke `we:scripts/review-set-label.mjs` (`<pr> --repo=<owner/name> --to=accepted|changes [--actor=<name>]`) for both verdict paths; the raw `gh pr edit` / `gh pr comment` instructions are gone.
- The hand-stamping prose added in #1001 is removed, not extended.
- The re-accept-after-rebase procedure #1001 added is kept (it is still correct) but re-pointed at the CLI.
- A guard proves the skill cannot regress: `check:standards` errors when `we:skills-src/review/SKILL.md` contains a bare `gh pr edit … --add-label review:` — the swap must go through the single home.
