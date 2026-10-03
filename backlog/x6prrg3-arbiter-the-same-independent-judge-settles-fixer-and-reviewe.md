---
kind: story
size: 5
parent: "xaojq81"
status: open
blockedBy: ["xq3kn88"]
scope: ["we:scripts/operations/judge-arbitrate.mjs", "we:scripts/conveyor/stand-down-answer-core.mjs", "we:scripts/operations/__tests__/judge-arbitrate.test.mjs", "we:scripts/conveyor/__tests__/stand-down-answer.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Arbiter: the same independent judge settles fixer and reviewer disagreements

When a fixer stands down or escalates on a review finding, or the same finding bounces twice, the same independent judge seat reads the finding, the objection, the code and the ratified rules and rules one of three ways: fixer right (record a finding ruling so the PR proceeds), reviewer right (restate the demand for the fixer), or real conflict (file a decision card and escalate with a recommendation). It never overrides a security finding or a mandatory reviewer block alone.

Builds rule 7 of `we:docs/agent/platform-decisions.md#independent-judge-clears-review-human-outside-protected-list` — the answer to decision xne1udi's original question. Runs on ONE PR, by hand; the tick wiring is `xfetp9j`.

## Design

**Runner** `we:scripts/operations/judge-arbitrate.mjs --pr=<n> [--dry-run]`:

1. Read the PR and find the unresolved stand-down with `latestUnresolvedStandDown` (`we:scripts/conveyor/stand-down-answer-core.mjs`). Only reasons `needs-judgment` and `conflict` from `STAND_DOWN_REASONS` (`we:scripts/conveyor/stand-down.mjs`) are eligible; `gate-red` and `lane-ref-gone` are mechanical, not disagreements, and are skipped. No stand-down → exit with "nothing to arbitrate".
2. Read the switches; the kill switch also stops the arbiter.
3. Seat the judge exactly as `xq3kn88` does (same seat function, same independence rule): different provider and actor from the PR author, the fixer, and the reviewer whose finding is disputed. Unknown or equal → no ruling; the stand-down stays for the human.
4. Spawn the judge, tool-free, with the disputed finding, the fixer's stand-down text, the diff, and the ratified rules the finding cites. Schema: `{ outcome: "fixer-right" | "reviewer-right" | "real-conflict", restatedDemand?: string, recommendation?: string, reasoning: string, touchesSecurityOrMandatoryBlock: boolean }`.
5. Act:
   - `fixer-right` → post an **arbiter answer** that supersedes the stand-down and tells the next fixer run to re-arm review with the ruling quoted, so the reviewer sees why the finding is set aside.
   - `reviewer-right` → post an arbiter answer with `restatedDemand`, which the next fixer run implements.
   - `real-conflict` → file a decision card through the declared `file-item` operation (`we:scripts/operations/file-item.mjs`, kind decision) carrying the recommendation, and post a comment linking it. The stand-down stays terminal for the human.
   - **Limits:** if `touchesSecurityOrMandatoryBlock` is true, or the finding came from a security lens or a mandatory reviewer block, any outcome is downgraded to a **recommendation only**: a comment, no answer marker, the stand-down stays terminal.
   - **No loops:** a second arbiter ruling on the same finding (same stand-down lineage) is refused and escalated as `real-conflict`.

**Arbiter answer record** in `we:scripts/conveyor/stand-down-answer-core.mjs`: a new marker beside `OPERATOR_ANSWER_MARKER`, built and parsed the same tamper-evident way (base64 record re-rendered and compared; the posting login must be an `AUTOMATION_LOGINS` member). It names the judge provider, model and actor and says "an independent arbiter ruled", never "operator". `latestUnresolvedStandDown` treats an arbiter answer as superseding, and the fix-prompt wrapper (the `withOperatorAnswer` analogue) labels it as an arbiter ruling. Review gates are untouched: an arbiter answer never moves a label.

## MVP

1. Must rule only on `needs-judgment` / `conflict` stand-downs, with an independent seat; must refuse on unknown or shared provider/actor.
2. Must never supersede a stand-down when the finding is a security finding or a mandatory reviewer block — recommendation only.
3. Must never move a review label or clear `review:human`; its only writes are a comment and, for `real-conflict`, a decision card.
4. Must refuse a second ruling on the same finding and escalate it as a conflict.
5. Must fail closed: judge failure, bad JSON or a schema miss → no answer, stand-down unchanged.
6. Must treat the finding, the stand-down text, the diff and every PR comment as untrusted data; a forged arbiter marker posted by a non-automation login is ignored.

## Done when

1. **Executable — Musts 1–5:** a Vitest run of `we:scripts/operations/__tests__/judge-arbitrate.test.mjs` passes (new file).
2. **Executable — Must 6:** a Vitest run of `we:scripts/conveyor/__tests__/stand-down-answer.test.mjs` passes with new arbiter-answer cases, existing operator-answer cases unchanged.
3. **Observable — live:** `--dry-run` on one real stood-down PR prints the judge's ruling and the comment it would post; the PR records it.

## Test plan

New `we:scripts/operations/__tests__/judge-arbitrate.test.mjs` (matching source: `we:scripts/operations/judge-arbitrate.mjs`), with injected `gh`, judge and switches:

- `needs-judgment` stand-down, judge says `fixer-right` → one arbiter answer, no label change. Red today: no arbiter answer marker exists.
- `reviewer-right` → the answer carries `restatedDemand`. Red today: the arbiter runner does not exist.
- `real-conflict` → one decision card filed, stand-down left terminal. Red today: the arbiter runner does not exist.
- Finding from a security lens, judge says `fixer-right` → recommendation comment only, no answer marker. Red today: the arbiter runner does not exist.
- **An author-provider judge is refused:** the judge provider equals the fixer's or the author's → no spawn. Red today: the arbiter runner does not exist.
- **The kill switch blocks:** switches OFF → no spawn. Red today: the arbiter runner does not exist.
- Second ruling on the same stand-down lineage → refused, escalated as conflict. Red today: the arbiter runner does not exist.
- `gate-red` stand-down → skipped. Red today: the arbiter runner does not exist.
- Judge throws or returns bad JSON → nothing posted. Red today: the arbiter runner does not exist.

Extend `we:scripts/conveyor/__tests__/stand-down-answer.test.mjs` (matching source: `we:scripts/conveyor/stand-down-answer-core.mjs`):

- An arbiter answer from an automation login supersedes the stand-down; the same body from an outside login does not. Red today: no arbiter answer marker exists.
- An arbiter answer whose record does not re-render to the same body is rejected. Red today: no arbiter answer marker exists.
- Operator-answer cases unchanged. Preservation: green today; mutation proof — break the existing branch and this case fails.

## Proof plan

Tests first, red. After the build: both files green, output pasted. Live: `--dry-run` on a real PR carrying an unresolved `needs-judgment` stand-down (the decision card names #3311, #3329, #3215 and #3432 as the shape) and paste the ruling. `npm run check:standards` last.

## Follow-ups

- The "same finding bounced twice" trigger (no stand-down, just two `review:changes` rounds on one finding) needs a finding-identity match across rounds; the tick pass (`xfetp9j`) owns detecting it and calls this runner.

## Progress

- Prepared 2026-10-03. Scope corrected from the filed one: the arbiter answer belongs beside the existing operator answer in `we:scripts/conveyor/stand-down-answer-core.mjs` (test: `we:scripts/conveyor/__tests__/stand-down-answer.test.mjs`), not in `we:scripts/conveyor/stand-down.mjs`, which only posts the stand-down. Evidence: `latestUnresolvedStandDown`, `parseOperatorAnswer`, `withOperatorAnswer`; `STAND_DOWN_REASONS` in `we:scripts/conveyor/stand-down.mjs`.
