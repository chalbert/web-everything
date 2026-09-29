---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/soak-replay-gate.mjs", "we:scripts/lib/__tests__/soak-replay-gate.test.mjs", "we:scripts/lib/__tests__/fixtures/soak-replay-gate-real-prs.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Soak-replay gate: don't read "not a bug fix" as a bug fix

The gate's bug-fix classifier in `we:scripts/lib/soak-replay-gate.mjs` OR's three signals — `FIX_TITLE_RE`, `FIX_HEADER_RE`, and `FIX_WORD_RE = /\b(bug|broke|broken|regression|incident)\b/i` — against the raw PR body. `FIX_WORD_RE` has no negation awareness, so it fires on the word "bug" inside "not a bug fix" exactly as it would on a real bug-fix disclosure. Evidence: chalbert/web-everything#2939, a verified behavior-preserving refactor, said in its own body "This is a refactor, not a bug fix." — the gate read that sentence as a bug-fix disclosure and demanded soak-break evidence the PR never needed. The operator had already approved it; it sat blocked roughly 2 hours until someone added a waiver line by hand.

## Design

Two independent, non-exclusive fixes named by the operator:
1. Negation-aware matching — before testing `FIX_WORD_RE`, detect and skip clauses matched by a small negation pattern ("not a bug", "no bug", "isn't a bug fix", "wasn't a regression", etc.) so a denial doesn't count as a disclosure.
2. Classify from the linked backlog card's `kind` (bug/story/etc.) when the PR names one, so the source of truth is the card's own type rather than free-text pattern matching on the PR body.

MVP ships (1); (2) is a stretch goal if it fits in this size, otherwise a follow-up.

## MVP

- Add a small negation-detector helper in `we:scripts/lib/soak-replay-gate.mjs` (e.g. `hasNegatedFixMention`) that runs before the raw `FIX_WORD_RE.test(b)` check, so a sentence like "not a bug fix", "no bug", "isn't a bug fix", "wasn't a regression" does not trip the bug-fix branch.
- Leave the title/header signals (`FIX_TITLE_RE`, `FIX_HEADER_RE`) untouched unless they show the same false-positive shape.
- No new config or flag — this narrows existing gate logic, it does not add a new mode.

## Test plan

- Unit test in `we:scripts/lib/__tests__/soak-replay-gate.test.mjs` using PR #2939's actual body as a fixture (add it to `we:scripts/lib/__tests__/fixtures/soak-replay-gate-real-prs.mjs` alongside the existing real-PR fixtures) — asserts the gate does NOT classify it as a bug fix.
- Companion true-positive fixture (a body that says "this fixes a bug" or "regression from #x") still classifies AS a bug fix — proves the fix narrows detection, it does not disable it.
- Inline cases for the other negation phrasings ("no bug", "isn't a bug fix", "wasn't a regression").

## Proof plan (soak break)

Before/after on the live case, not only new unit tests:
- Before: run the current classifier against PR #2939's real body and show it returns "bug fix" / demands soak-break evidence.
- After: same input against the patched classifier returns "not a bug fix" / no soak-break evidence required.
- This is the before/after evidence the "failures improve the product, never manual fixes" doctrine calls for — no hand-added waiver line should be needed the next time this exact shape recurs.

## Follow-ups

- Classify-from-linked-card-kind (option 2 above) as a separate item if it does not fit in this size-2 slice.
- Sweep other regex-based classifiers in the conveyor for the same negation blind spot.


## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
