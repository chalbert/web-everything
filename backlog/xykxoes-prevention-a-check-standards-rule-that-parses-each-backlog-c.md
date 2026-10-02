---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4515-should-a-repeatedly-erroring-review-seat-provider-sit-out-fo.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — A check:standards rule that parses each backlog card's Done-when node --test path and fails if that fil… (from chalbert/web-everything#3463 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4515-should-a-repeatedly-erroring-review-seat-provider-sit-out-fo.md:19` — A check:standards rule that parses each backlog card's Done-when `node --test <path>` and fails if that file imports 'vitest'.
2. `we:backlog/4515-should-a-repeatedly-erroring-review-seat-provider-sit-out-fo.md:28` — Add a prepare-card checklist item, or a review lens, for any design that adds an automatic exclusion or circuit-breaker on a review or gating path. It would require the card to state who can trigger it, the blast radius, and whether the skipped coverage is surfaced to a human. Optionally, require the cooldown to count failures across distinct PRs, or to ignore input-attributable errors.
3. `we:backlog/4515-should-a-repeatedly-erroring-review-seat-provider-sit-out-fo.md:38` — Add deterministic unit cases using mixed timestamp formats whose lexical and chronological orders differ, plus an invalid timestamp among otherwise cooling rows; include them in the required unit-test gate.
4. `we:backlog/4515-should-a-repeatedly-erroring-review-seat-provider-sit-out-fo.md:26` — A test plan completeness review lens that ensures all edge-case behaviors stated in the design (such as fail-open on bad data) have a corresponding enumerated test case.
5. `we:backlog/4515-should-a-repeatedly-erroring-review-seat-provider-sit-out-fo.md:26` — A standard state-machine testing guideline that requires testing the transition back to a failed state after a timeout or probe.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3463@1807e6dc53937a98d6104df6f1c5fa2d5ff7a670

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
