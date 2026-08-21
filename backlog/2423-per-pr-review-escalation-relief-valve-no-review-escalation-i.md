---
bornAs: x2u9e9d
kind: story
size: 3
status: open
dateOpened: "2026-07-10"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/__tests__/review-escalation.test.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:skills-src/drain/SKILL.md
---

# per-PR review-escalation relief valve — --no-review-escalation is pass-wide and unguards every unlabelled candidate

The documented stuck-park relief valve (--no-review-escalation on we:scripts/merge-ai-prs.mjs) was pass-wide: relieving ONE stuck review:pending PR disabled the escalation rubric — including fresh gate-self/human-required detection — for every unlabelled candidate in the same pass (panel security finding on PR #401 round 1, 2026-07-10). The durable fix — a per-PR override so the rubric stays live for the rest of the pass — **appears to have landed on 2026-07-20 in commit `ae35067a`, and the card was never flipped.** Re-verify against the tree and resolve; this is a stale-open card, not a build.

## Prepared 2026-08-21 — the build appears DONE; this is now a verify-and-resolve card

Everything the original body asked for is present on `main` today. Verified by reading the tree, not by
trusting the commit subject:

| the card asked for | what exists now |
|---|---|
| a per-PR override, repeatable | `parseNoReviewEscalation(argv, name)` — [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:177`, doc at `:166-176`: repeatable **and** comma-separated (`--no-review-escalation=12,34 --no-review-escalation=56` → `{ passWide: false, prs: [12,34,56] }`) |
| the rubric stays live for the rest of the pass | `:2551` — `REVIEW_ESCALATION = label && !escalationRelief.passWide`, driven off `passWide`, **not** flag presence |
| the override still refuses `review:human` / `review:changes` | `applyEscalationRelief` `:194-219`, gating on `hasUnclearedReviewLabel(..., { allowPending })`; the merge half threads the same waiver through `classifyPr` (`:544`, `:1244`) and `labelOnGreenVerdict` (`:1707`) |
| bare flag deprecated with a loud pointer | `:2553` — a stderr `⚠ --no-review-escalation (bare) is DEPRECATED …` naming the per-PR form |
| the `we:skills-src/drain/SKILL.md` stopgap replaced by real guidance | `:272-282` — **PREFERRED** per-PR form vs **DEPRECATED** bare form, written out |
| tests | `describe('#2423 per-PR --no-review-escalation relief valve')` — [we:scripts/__tests__/merge-ai-prs.test.mjs](scripts/__tests__/merge-ai-prs.test.mjs) `:2425`, plus `:205` and `:892-897`. Includes the #2409 case that a STALE-acceptance re-park is never waived even though it carries `review:pending` |

Two things the card did *not* ask for and that were also decided along the way, worth knowing before
re-reading: the `review:relieve` **label** alternative named in the original body was not built (the flag form
won), and the bare pass-wide form was kept-but-deprecated rather than removed.

## Done when

Because the build appears complete, these are **verification** criteria: they should already pass. If any one
fails, that names the real remaining work; if all pass, the item's remaining action is the `status` flip, not
code.

- `npx vitest run` against [we:scripts/__tests__/merge-ai-prs.test.mjs](scripts/__tests__/merge-ai-prs.test.mjs)
  is green, including the `#2423 per-PR --no-review-escalation relief valve` describe block and its
  `applyEscalationRelief` cases (relieved `review:pending` → waived; `review:human` → refused;
  `review:changes` → refused; stale-acceptance re-park → refused).
- `node we:scripts/merge-ai-prs.mjs --dry-run --label=ready-to-merge --no-review-escalation` prints the
  deprecation warning on stderr and `… --no-review-escalation=1 --dry-run` does not — the per-PR form is
  scoped, the bare form is loud.
- `node we:scripts/check-standards.mjs` → 0 errors.
- **Every criterion above is verification, not construction** — the work landed before the card was prepared — commit `ae35067a` (2026-07-20), *"WE #2423: per-PR --no-review-escalation relief valve so
  relief stays scoped to one PR"*. That is stated explicitly rather than dressed up as a build criterion.
- **The one real gap the review found: pin `REVIEW_ESCALATION` against mutation.** Changing
  `we:scripts/merge-ai-prs.mjs:2551` from `const REVIEW_ESCALATION = label && !escalationRelief.passWide;`
  back to the pre-#2423 `const REVIEW_ESCALATION = label;` leaves the whole
  `we:scripts/__tests__/merge-ai-prs.test.mjs` suite green — no named test reddens, so the single line the
  fix rests on is unguarded. That line sits inside `runCli`, which the suite does not execute, and the file's
  own convention for exactly this case is a source-contract regex assertion against the raw source text (the
  `#984 F2` and `#x9xqexm` describe blocks in the same file). Add one such assertion. This is the only piece
  of #2423 that is genuinely unbuilt, and it IS a proper tier-1 criterion: it fails today and passes after.
- The residual is otherwise a status question a human or the resolve verb settles: confirm nothing above
  regressed, then `resolve` it. This preparation pass deliberately did **not** change `status`.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Mutating we:scripts/merge-ai-prs.mjs's `const REVIEW_ESCALATION = label && !escalationRelief.passWide;` (the single line the card credits as "the durable fix", :2551) back to `const REVIEW_ESCALATION = label;` (the pre-#2423 pass-wide-only behavior) leaves all 397 tests in we:scripts/__tests__/merge-ai-prs.test.mjs green — no named test reddens. The file's own documented convention (the #984 F2 and #x9xqexm describe blocks in the same file) is to pin exactly this class of un-executed-runCli line with a source-contract regex assertion against the raw source text; that convention was not applied to this line.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Both ES-import consumers of the waiver were checked: we:scripts/merge-ai-prs.mjs's own `classifyPr`/`labelOnGreenVerdict`/`buildCarrierHealth`/`planDrainPass` chain (all thread `escalationRelief`/`allowPendingReview` end-to-end from CLI parse at :2550 through to :3487 and :2953/:3655), and the shared we:scripts/lib/review-escalation.mjs `hasUnclearedReviewLabel`'s `allowPending` parameter that both the `we:scripts/merge-ai-prs.mjs` non-scoring path and its own test suite (we:scripts/__tests__/review-escalation.test.mjs:772-773) independently exercise.

**Corrections recommended:**

- none — the preparation held up as written.

The card's core claim holds against the live repo: every line/file citation checks out exactly, all 906 tests across the four declared test files pass, check-standards is clean at 0 errors, and the deprecation-warning behavior matches the stated done-when criteria — this is a legitimate stale-open resolve, not a build.

_Recorded through the declared `review-prep` operation._
