---
bornAs: x1q7emf
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/backlog/scaffold.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/backlog/__tests__/scaffold.test.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "791a95f338b860408ea254f16d51be92d05246a3"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2892's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4387-review-dispatch-refuse-on-a-stale-clone-only-when-the-missed.md:15` — Add a card-template line, or a file-item lint for cards that relax a refuse/guard behaviour, requiring 'fail-closed on error' and 'non-code inputs enumerated' in the Must list.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2892@10670086483a23b3308329912b76984c4b0ce83b

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/check-standards-rules-content-lint.test.mjs we:scripts/backlog/__tests__/scaffold.test.mjs -t "#4409"` (every new `describe`/`it` name contains "#4409", so the filter cannot match nothing): a card that relaxes a guard without the two Must lines warns, and the scaffold skeleton carries the line (both fail before this lands).

## Design

Premise verified against `main` (791a95f): #4387 (resolved) relaxed the stale-clone refusal in `we:scripts/lib/main-staleness.mjs`; the review found its Must list never said "fail closed on error" or enumerated the non-code inputs. No card template line or lint for this exists (grep for both phrases finds only this card).

Two parts, mirroring the #4332 precedent (`findTestPlanGaps`, warning-only, open/active cards):

1. `we:scripts/backlog/scaffold.mjs:101-106` — extend the `## Done when` skeleton block with a short authoring hint line, worded to match NEITHER lint pattern so it cannot satisfy or trigger the lint if an author leaves it in: "Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously." The pinned text is exported as a constant and asserted verbatim by the test; `findGuardRelaxationGaps` also strips that exact constant line before scanning (belt and braces).
2. `we:scripts/check-standards-rules.mjs` — new pure `findGuardRelaxationGaps(body)` next to `findTestPlanGaps` (~line 941), called from `lintBacklogItemRendering` beside the Test-plan block (~line 1069), `status !== 'resolved'` only, push to `warnings`. Trigger (tightened — bare "gate"/"block"/"only when" alone match hundreds of cards): scan only the digest paragraph, `## Must`/`## MVP` text and Progress-free body top (everything before `## Design`/`## Test plan`), outside fenced code, for a single sentence containing `refus\w*` AND one of `relax\w*|loosen\w*|tolerat\w*|only when|skip\w* the (refusal|guard)`. When triggered, require both `fail[- ]closed` and `non[- ]code` (case-insensitive) in that same scanned region; emit one gap per missing phrase. Scanning only that region also stops this card's own Design prose from satisfying the lint by accident.

Warning, not error: the trigger is prose-heuristic, so a false positive must never block a landing.

## MVP

Musts only: the scaffold hint line; `findGuardRelaxationGaps` + its warning in `lintBacklogItemRendering`; unit tests. Out of scope: promoting to an error, back-filling the resolved corpus, structured frontmatter flag for guard-relaxing cards.

## Test plan

All new test names contain "#4409".

- **Capability** — "relaxing card missing both phrases warns": digest "Relax the refusal only when X" → two gaps. Red today: function absent, no warning.
- **Capability** — "only fail-closed present → exactly one gap (non-code)". Red today: function absent.
- **Capability** — "scaffold skeleton carries the pinned hint verbatim": `renderItem(...)` contains the exported hint constant. Red today: line absent.
- **Capability** — "a freshly scaffolded, relaxing card still warns": hint line left in place must not satisfy the lint. Red today: function absent.
- **Preservation** — "non-relaxing card → no gap": mutation proof: make the trigger always-on and it turns red.
- **Preservation** — "relaxing card with both phrases → no gap": mutation proof: drop the both-phrases check and it turns red.
- **Preservation** — "resolved card → no warning": mutation proof: remove the `status !== 'resolved'` guard and it turns red.
- **Preservation** — "unrelated card with 'only when' and no 'refus' → no warning" (false-positive guard): mutation proof: loosen the trigger to a bare `only when` and it turns red.
- **Preservation** — "a relaxing sentence inside a fenced block does not trigger": mutation proof: stop stripping fences and it turns red.
- **Preservation** — "phrases inside a fenced block do not satisfy": separate mutation proof: same change, distinct assertion.

## Proof plan

Live before/after on real cards: copy the real #4387 card to a scratch path inside the lane with `status: resolved` flipped to `status: open` (the lint skips resolved cards; 4387's body has neither phrase) and run the lint entry on it — before: no warning; after: a warning naming both missing phrases. Then run the lint over every open/active card and record the warning count; acceptance threshold: at most 10 warnings across the open corpus, each one a genuine guard-relaxing card (else tighten the trigger before landing). Finally print `renderItem({...})` output (there is no scaffold `--dry-run`) showing the hint line.

## Follow-ups

- Promote the warning to an error once the false-positive rate is measured low.
- Structured `relaxesGuard:` frontmatter flag replacing the prose heuristic.
- Audit already-resolved guard-relaxing cards for the same gap.

PR #3154 incident investigation (2026-09-30): the managed daemon's
`we:.operations/completions/ci-heal-3154.json` records a heal starting at
18:11:06.875Z and finishing at 18:11:10.729Z as `not-applicable`.
`we:.operations/delivery-dispatch-logs/ci-heal-3154.log` contains only
“could not acquire a lane on the PR head.” The dispatch at line 39614 of
`we:.conveyor/fix-dispatch-daemon.log` is followed by repeated `ci-heal-escalated`
refusals. The old adapter discarded the acquire subprocess output, so these
records do **not** establish whether capacity, contention, fetch, or configuration
caused the original acquisition failure. Preserve those diagnostics on future
attempts; do not infer missing refs from an empty acquire result. The local live
origin probe during this investigation failed DNS, which likewise establishes
neither presence nor absence. The operator supplied the existing origin head
`e97e86c78ed0d502340454df53bcd3ea9b128cfa`.

The regression in
`we:scripts/conveyor/soak/breaks/ci-heal-acquire-false-escalation.mjs` uses a real
local origin and the real lane acquire subprocess with an empty pool. Restoring
the old classification reproduces false “lane ref gone” escalation. With the fix,
eight successive reconciliation/heal passes retain the acquire error, verify the
origin ref exists, return `blocked-on-infra`, and remain eligible for retry.
Deleting that fixture ref then proves the verified-absence escalation. Existing
legacy acquire-null comments are ignored by their exact old signature, so #3154
can re-enter the normal dispatch path without a new push or manual marker edit.
A genuine current-head escalation carries `review-status:needs-human`, reconciled
from its durable comment and removed after a head change.

The contention regression in
`we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs` now installs a
live scan-lock owner before starting five concurrent contenders. It asserts
contention, an unchanged owner, no lane scan/mutation git calls, and successful
acquisition after release. Ten consecutive integration runs passed. Use this
ownership/order evidence instead of elapsed CI duration or a sleep to guess which
caller acquired the lock first. The test timeout remains a hung-process watchdog,
not the contention-performance assertion.

Validation in the restricted checkout: 241 focused unit tests passed; the new
soak replay passed; `npm run check:standards` reported zero errors. The required
`node we:scripts/verify-lane.mjs` invocation could not write its marker because
this sandbox makes `we:.git` read-only. Its markerless `run` mode, with admission
storage redirected to a disposable writable pool, executed the full selected set:
4,640 passed and six failed across
`we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs`,
`we:scripts/operations/__tests__/http-adapter.test.mjs`, and
`we:scripts/lib/__tests__/gh-app-shim.test.mjs`.
Separate direct probes confirmed `spawnSync /bin/ps EPERM` and
`listen EPERM ... 127.0.0.1`; those failures require host permissions unavailable
here. Re-run the unchanged wider gate in an environment allowing those operations.
No shared agent documentation was edited.
