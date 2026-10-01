---
bornAs: xmace53
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "c7b7f1cb259e3e2a1363784296ddb1e24b6f1f3d"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2886's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md:38` — Add a Must line to the card's Tasks/Done-when: routing to non-native providers requires every reason token to be recognized and at least one present, otherwise native. Longer term, a shared strict-care-level helper that gating callers must use, enforced by a conformance check.
2. `we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md:175` — Card template or prepare rule: each 'never/cannot/fails closed' sentence in Design must map to a named test line in Tasks, checked by a lint on prepared-style cards.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2886@4d7d65d79b547a5f80eb982c0236219d662f3da2

## Design

**Premise check (done against `main` @ c7b7f1cb).** Both guards are still owed. `git log --grep=4431` shows only the JIT-numbering commit; `we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md` still carries no Must/Done-when line about reason-token recognition (its Tasks item 5, line ~163, only says "fail-closed fallback … on any allowance/availability ambiguity"), and `findTestPlanGaps` in `we:scripts/check-standards-rules.mjs:962` covers Test-plan classification and state-literal coverage (#4332) but has no check mapping negative claims ("never / cannot / fails closed") in `## Design` to a Test-plan case. The card's own line refs (`:38`, `:175`) have drifted as 4374 was edited; the substance (Design line "no routing…", Done-when #1 "any allowance ambiguity fails closed") still holds.

**Scope correction.** The card's `scope:` named only 4374's file; the real touch-set is that card plus the gate rule and its test file (updated in frontmatter).

**Guard 1 — a Must on 4374 (a card edit, no code).** Add to `we:backlog/4374-…md` Tasks item 5 and Done-when #1 a Must: *routing to a non-native provider requires every care-level reason token to be recognized and at least one present; an unknown/empty reason set routes to native Claude.* This is the "unknown token ⇒ native" rule a reviewer found missing: `careLevelFromReasons` (`we:scripts/lib/review-core.mjs:663`, imported by the CLI) tolerates unknown tokens and maps reasons to a level, so an unrecognized token must not silently read as `low`. The "shared strict-care-level helper enforced by a conformance check" half is a longer-term ask and goes to Follow-ups.

**Guard 2 — a third lint in `findTestPlanGaps`.** Extend `we:scripts/check-standards-rules.mjs:963` (`findTestPlanGaps`) with a `negative-claim-without-case` gap kind `{kind, detail}`. Mechanism: outside code fences, join each Design / `## Interfaces & protocol` paragraph's hard-wrapped lines with spaces, split into sentences on `. `/`? `/`! `, and keep sentences matching exactly the card's stated triggers (`\bnever\b|\bcannot\b|\bfails? closed\b`). For each, extract backticked identifiers and quoted literals **that are not bare common words** (skip tokens of ≤4 letters and the care-level words `none|low|high|elevated`, to cut incidental matches). The claim is "covered" when the Test plan mentions at least one remaining token (word-boundary match, as `untested-condition` does). **A claim with no extractable token is NOT reported** (prose-only claims can't be cleared by adding a token, so warning on them would be unfixable noise); `detail` is the first 60 chars of a flagged sentence. Wire the kind into the warning builder at `we:scripts/check-standards-rules.mjs:1071-1081` as a third ternary arm with its own advice ("name a Test-plan case that exercises the claim's identifiers"), not the trailing capability/preservation sentence. Like #4332 it is **WARNING only**, open/active cards, and inert when there is no `## Test plan` (so unprepared cards and the resolved corpus are untouched).

## MVP

**Musts:** (1) the reason-token Must added to 4374; (2) `negative-claim-without-case` gap kind in `findTestPlanGaps` + its warning text + unit tests; (3) the lint run over the open corpus once to confirm it does not flood (count reported in the PR).

**Deliberately OUT (Follow-ups below):** a shared strict-care-level helper + conformance check; promoting the lint from warning to error; a card-template / prepare-brief line telling preparers to map each negative claim to a test.

## Test plan

Unit tests in the content-lint test file (`we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`), beside the #4332 cases:
- **Negative claim with no matching test — capability. Red today:** a card whose Design says "a `changes` verdict must never flip the panel" and whose Test plan has one properly classified bullet ("Red today: …") naming neither `verdict` nor `flip`, yields exactly `[{kind:'negative-claim-without-case', detail:'a `changes` verdict must never flip the panel'}]` (the plan bullet avoids also firing `unclassified-case`); today `findTestPlanGaps` returns `[]`. A second sub-case: a claim with no backticked/quoted token yields `[]`. A third: a hard-wrapped claim spanning two lines is still detected.
- **Negative claim covered by a named test — preservation. GREEN today** (returns `[]` on both): Test plan names `verdict`; mutation proof: drop that Test-plan bullet → the gap appears, so the test is sensitive to the coverage check and not vacuous.
- **Claim inside a code fence is ignored. GREEN today; mutation:** remove the fence-skip → a fenced "never" comment wrongly gaps.
- **No `## Test plan` → `[]`. GREEN today; mutation:** removing the early return makes an unprepared card gap.
- **`lintBacklogItemRendering` emits the warning text for the new kind and stays warning-only for resolved cards. Red today:** no such message exists.
- **Guard 1 (card edit)** is checked by a grep assertion in the PR's proof, not a unit test: 4374 contains the reason-token Must.

## Proof plan

- **Before/after on a real card (not 4374 — it has no `## Test plan`, so the lint is inert there by design):** during the build, find a prepared open card that HAS a Test plan and an uncovered never/cannot/fails-closed Design claim (the corpus dry-run below lists them), run `npm run check:item -- <NNN>` on `main` (no warning) and on the branch (the new warning names that claim). If none exists, say so and use a fixture card committed under the test file instead.
- **Corpus dry-run:** run the new check over every open card that has a `## Test plan` (~81 of 4637 backlog files today) via a one-off node call to `findTestPlanGaps`; record cards newly warned and the 3 noisiest false positives. If more than ~20 of the ~81 warn, tighten the triggers/token filter before landing.
- `grep -n "reason token" we:backlog/4374-…md` shows the new Must.

## Follow-ups

- Shared strict-care-level helper that gating callers must use, enforced by a conformance check (guard 1's longer-term half).
- Promote `negative-claim-without-case` from warning to error once the corpus is clean.
- Add a one-line rule to the prepare-item brief / card template: each negative claim in Design maps to a named Test-plan case.

## Done when

1. **Executable** — `npx vitest run check-standards-rules-content-lint` passes including the new `negative-claim-without-case` cases (they fail on `main`), and `grep -q "reason token" backlog/4374-*.md` succeeds (it fails on `main`).
2. **Proven live** — the before/after and corpus dry-run in the Proof plan are recorded in the PR.
