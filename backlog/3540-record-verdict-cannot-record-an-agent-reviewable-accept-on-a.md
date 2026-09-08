---
bornAs: xoghq8y
kind: story
size: 3
status: resolved
scope: ["we:scripts/operations/review-pr.mjs"]
dateOpened: "2026-09-06"
dateStarted: "2026-09-07"
dateResolved: "2026-09-08"
tags: []
---

# `record-verdict` cannot record an agent-reviewable accept on a VM

The VM verdict transport exists precisely because `review-pr`'s `record` step shells `we:scripts/review-set-label.mjs`,
which needs `gh`. But `record-verdict` refuses without a staged write-up — and the ONLY thing that stages one
is `record` itself, effect 0. So on a cloud host the transport built to replace `record` is unreachable until
`record` has partly run. Found driving #1961 to a verdict with no operator.

## The exact deadlock

| step | stages a write-up? | needs `gh`? |
| --- | --- | --- |
| `advise` (effect) | only when `humanRequired === true` — otherwise declares `[]` by design | no |
| `record` effect 0 (`review.write-up`) | **yes**, always | no |
| `record` effect 1 (`review.label`) | — | **yes** |
| `record-verdict` `read` | REFUSES when the write-up is missing | no |

An **agent-reviewable** PR (`humanRequired: false`) is the common case and the one with no advisory note, so it
is exactly the case with nothing staged. `record-verdict` then reports *"staged no write-up to carry"*, which
reads like the review was defective when it was clean.

## The workaround, and why it should not be the answer

`--resume=<runId> --answer=accept` runs `record`: effect 0 (a pure file write) applies, effect 1 halts on
`spawnSync gh ENOENT`, and `record-verdict` then finds the body. Nothing lands remotely — the halt is before any
remote write — but the run ends `effect-halted` with an UNKNOWN outcome recorded against it, so the durable
record of a clean accept is a halted run. An operator reading the run store cannot tell that from a real
failure.

## Done when

1. The write-up is staged by a step that does not also need `gh` — either `advise` stages it unconditionally
   (dropping the `humanRequired` gate, which exists to decide whether to POST, not whether to RENDER), or
   `record`'s effect 0 is split out ahead of the label swap so a VM can reach it without entering `record`.
2. `record-verdict` on a clean, zero-finding accept runs end to end from a host with no `gh`, in one call, with
   no `--resume` of the review run.
3. The refusal message distinguishes "the review staged nothing because it has not recorded yet" from "the
   review produced no write-up", since today both read as the latter.

## Related, not duplicates

- #3539 — the review SKILL's VM write-path gap (the map). This is the mechanism.
- #3267 — the unguarded connector label swap. Different failure: this one never reaches a label at all.

## Progress

Took option (b) from "Done when" #1: split `record`'s effect 0 out into a new `stageVerdict` step, positioned
between `confirm` and `record`, in `we:scripts/operations/review-pr.mjs`. Both steps call a new shared pure
function, `planRecordDecision`, so the write-up `stageVerdict` stages and the `bodyFile` `record`'s label swap
later posts from disk are guaranteed identical — and INVARIANT 2 / the reasonless-bounce guard now refuse at
`stageVerdict`, strictly earlier than before.

Went further than the "either/or" to also close #2: a new self-sufficient CLI wraps the bare
`we:scripts/operations/run.mjs` and, before delegating to it, drives `review-pr`'s `confirm` + `stageVerdict`
locally (a new `advanceReviewPrToWriteUp` in `we:scripts/operations/record-verdict-io.mjs`) when the run is
genuinely `awaiting-confirm` and `--to` names a real answer. See `we:scripts/operations/record-verdict-cli.mjs`.
Calling it with `--runId=<id> --to=accepted` is now the ONE call needed — no separate `review-pr --resume`
first. `record`'s own label/ledger/notice effects are declared (visible on the run record) but never applied by
this path; they still need `gh` and are left for the CI-side applier.

`we:scripts/operations/record-verdict.mjs`'s refusal (#3) now distinguishes: a deliberate `abstain`, a
`confirm` still awaiting an answer, or — unreachable in the ordinary case — a genuine empty write-up.

Updated `we:skills-src/review/SKILL.md` to recommend the new self-sufficient CLI over the bare
`we:scripts/operations/run.mjs` invocation on a host with no `gh`.
