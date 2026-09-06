---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/review-pr.mjs"]
dateOpened: "2026-09-06"
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

- #xkomby1 — the review SKILL's VM write-path gap (the map). This is the mechanism.
- #3267 — the unguarded connector label swap. Different failure: this one never reaches a label at all.
