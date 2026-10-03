---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "ec69dabc893991cdb891e41ae58509051403476b"
tags: []
---

# Prevention — Extend the new negative-claim-without-case lint to scan MVP and Musts sections, or have prepare require… (from chalbert/web-everything#3291 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md:56` — Extend the new `negative-claim-without-case` lint to scan MVP and Musts sections, or have prepare require a Test-plan row for every Must line.
2. `we:scripts/check-standards-rules.mjs:1050` — Add a unit test with a bulleted Design, and make the paragraph splitter flush on list-item starts.
3. `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:708` — A coverage threshold (e.g., 100% branch coverage on new logic) or a mutation-testing gate would require the filter conditions to be exercised by a test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3291@877ebb2b0b4b6f7f57f6191547d08d538f056c64

## Design

The lint lives in `we:scripts/check-standards-rules.mjs`. `findTestPlanGaps` (line 1014) computes `design` from the `## Design` and `## Interfaces & protocol` sections only, then calls `findNegativeClaimGaps(design, planText)` (line ~1052; defined ~1062). Two gaps follow from that:

1. **MVP/Musts are never scanned.** A negative claim written in `## MVP` (e.g. a Must saying "must never route to a non-native provider") needs a Test-plan case just as much as one in Design, but the lint cannot see it. Fix: build a second line set with `sectionLines(lines, /^(?:mvp|explicit mvp cut)\b/i)` (both spellings are in use; `findMustWithoutDoneWhen` at line ~1093 already uses the long one) and pass `[...design, "", ...mvp]` (a blank separator so an unterminated paragraph or fence cannot bleed across sections) to `findNegativeClaimGaps`. The literal-state check (`TEST_PLAN_STATE_LITERAL_RE`) stays Design-only: it reads code fences, which MVP sections do not carry.
2. **The paragraph splitter glues list items together.** `findNegativeClaimGaps` flushes a paragraph only on a blank line or a code fence, so consecutive bullets (`- ...`, `1. ...`) become ONE paragraph; `para.split(/(?<=[.?!])\s+/)` then still splits on sentence ends, but a bullet with no terminal punctuation fuses with the next bullet's first sentence, so a negative claim in one bullet is judged against the next bullet's identifiers (or vice versa). Fix: also flush when a line starts a list item (`/^(?:[-*]|\d+\.)\s+/`, the same regex `findTestPlanGaps` already uses for Test-plan bullets), keeping hard-wrapped continuation lines joined to their bullet. This matters directly for item 1, because Musts are numbered list items.

The prepare-side alternative named in the finding ("require a Test-plan row for every Must line") is a different, stricter rule; it is deliberately not taken here (see Follow-ups). The finding's item 3 (coverage threshold / mutation gate) is a repo-wide tooling policy, not this lint.

## MVP

**Must:**

1. `findTestPlanGaps` scans the MVP / Explicit MVP cut section for negative claims, with the same identifier-coverage rule and the same `negative-claim-without-case` gap kind.
2. The negative-claim paragraph splitter flushes at list-item starts, so each bullet / numbered Must is judged on its own sentences; hard-wrapped continuation lines still join their item.
3. Existing behaviour is unchanged: fenced code is ignored, claims with no backticked/quoted identifier are not reported, resolved cards stay silent, and the warning stays WARNING-only.

Out of scope (Follow-ups): a rule requiring a Test-plan row for every Must; a coverage threshold or mutation-testing gate for new lint logic; any change to the #4374 card, which was only the example the finding cited.

## Test plan

All cases go in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`, in the existing `#4431 negative-claim-without-case` describe block (line ~750), using its `card` helper extended with an optional MVP section.

- **MVP claim with no case is flagged (capability, Red today):** a card whose `## MVP` says "A `changes` verdict must never flip the panel." and whose Test plan never names `changes` yields one `negative-claim-without-case` gap. Fails before the fix because MVP is never read, so the result is `[]`.
- **MVP claim in a numbered Must is flagged and cleared (capability, Red today):** the same claim as `1. ...` under `**Must:**` is flagged; adding a Test-plan bullet naming `changes` clears it. Fails before because MVP is not scanned. Mutation: drop the covering bullet → the gap returns.
- **`## Explicit MVP cut` heading also scanned (capability, Red today):** same claim under the long heading is flagged.
- **Bulleted Design, claim bullet is judged alone (capability, Red today):** Design is `- A \`changes\` verdict must never flip the panel` (no final period) followed by `- Covered \`alpha\` token stays.`; the Test plan names `alpha` but not `changes`. Expect one gap. Fails before because the two bullets fuse into one paragraph, the claim's sentence is merged with the next bullet and `alpha` wrongly covers it.
- **Bullet continuation lines still join (preservation; GREEN today, mutation: let the list regex match indented lines (`^\s*`) → a continuation line starting with `- ` splits the bullet and this case fails; the splitter tests the TRIMMED line against the anchored list regex, so only column-0 list markers flush and an indented continuation never does):** `- A \`changes\` verdict\n  must never flip\n  the panel.` is still one gap.
- **Existing cases keep passing (preservation; GREEN today):** the seven existing `#4431` cases are untouched and must stay green; mutation: removing the fence skip fails `ignores claims inside a code fence`.
- **`lintBacklogItemRendering` surfaces an MVP-sourced gap as a warning for open cards, silent for resolved (capability, Red today).**

## Proof plan

1. Before: run `findTestPlanGaps` (via `node -e` importing `we:scripts/check-standards-rules.mjs`) on a scratch body with a negative claim only in `## MVP`; show `[]`. After the change, show the one gap.
2. Splitter probe: `findTestPlanGaps` on a Design of two bullets with no final period (claim bullet naming `changes`, second bullet naming `alpha`, Test plan naming only `alpha`); show `[]` before and one gap after.
3. Live corpus check: run `npm run check:standards` before and after on current `main` and diff the warning lists; list any NEW `negative claim` warnings on open cards (these are real, newly visible gaps, not regressions). Warnings are non-blocking, so the gate stays green.
4. Run `npx vitest run check-standards-rules-content-lint` and `we:scripts/__tests__/check-standards-rules.test.mjs` green.

## Follow-ups

- Require a Test-plan row for every MVP Must line (stricter than identifier coverage; the finding's alternative).
- Coverage threshold or mutation-testing gate for new lint logic (finding item 3) — a repo-wide tooling decision.

## Progress

- Prepared 2026-10-03. Premise check against current `main`: no delivery found (`git log` for `xhmrj66` shows only the filing commit; `findTestPlanGaps` still passes `design` only, and the splitter still flushes only on blank/fence). Citations corrected: finding 2 cited `we:scripts/check-standards-rules.mjs:1050`, now the `findNegativeClaimGaps` call at ~1052 / definition ~1062. Scope narrowed: dropped the #4374 card (only the example the finding cited; nothing there to edit).

## Done when

1. **Executable** — `npx vitest run check-standards-rules-content-lint` fails before this lands (the new MVP and bulleted-Design cases) and passes after (Musts 1-3).
2. **Proof** — the before/after `findTestPlanGaps` probe and corpus warning diff from the Proof plan are recorded (Musts 1-2).

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
