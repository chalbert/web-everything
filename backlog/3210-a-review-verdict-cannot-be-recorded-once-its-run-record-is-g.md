---
bornAs: x5royou
kind: story
size: 5
status: open
dateOpened: "2026-08-20"
tags: []
---

# A review verdict cannot be recorded once its run record is gone with the host

record-verdict reads every fact from the run record the review wrote, which is the whole point: nothing is retyped. But that record lives in the gitignored operations sidecar on local disk, and a cloud VM reclaims its container. Two reviews costing two dollars forty-five were run, reduced to accept, and became unrecordable when the container was replaced, because the operation correctly refuses a runId it cannot read. The verdict survives only if review and recording happen in one session.



## The dependency, and why it is deliberate

`record-verdict` (#3206) takes `--runId` and pointedly **no** `--pr`: the subject, the repo, the
juror's session id and the staged write-up are all read back out of the run record the review itself
wrote, so none of them can be mistyped onto another PR. That is the defect it closes and it is worth
keeping.

The cost is that the run record becomes load-bearing infrastructure. It is written by
`we:scripts/operations/run-store.mjs` into the gitignored `.operations/` sidecar on local disk — scratch,
by design, because a run record is per-host working state.

## What that costs on a reclaimed host

Two reviews were run in one session (PRs #1496 and #1498), each spawning a real juror, costing $2.45
between them, both reducing to `accept`. The container was then replaced. Both run records went with it,
along with the staged write-ups.

`record-verdict --runId=<either>` now correctly refuses — *"no run record … the verdict is read from the
run the review wrote, never retyped"*. The refusal is the operation working exactly as designed. The
verdicts are simply unrecoverable, and the only way to record them is to pay for the reviews again.

So on an ephemeral host the real rule is: **a review and its recording must happen in one session, or the
money is spent for nothing.** Nothing says that anywhere, and nothing warns at review time.

## Not the obvious fix

"Commit the run record" is wrong: run records are per-host scratch containing local paths, and versioning
them puts working state in the tree the #2644 discipline keeps clean.

Three shapes worth weighing, none obviously right:

- **(a) Record at review time.** Fold the transport write into `review-pr`'s own `record` effect on a
  credential-less host, so the verdict reaches `ops/review-requests` while the record still exists. Most
  direct; couples two operations that are currently independent.
- **(b) Make the write-up durable and the record reconstructible.** The transport request needs the
  subject, the juror session id and the body — all of which could be staged to the transport branch as a
  *draft* request at review time, with recording promoting it. Survives the host by construction.
- **(c) Warn, do not fix.** `review-pr` reports at suspend that the run record is host-local and will not
  survive. Cheapest, honest, and does nothing for an unattended run.

(b) looks strongest because it makes the durability property structural rather than procedural, but the
call belongs to the operator.

## Done when

The fork is settled and the chosen shape is implemented, such that a verdict reduced on one host can
still be recorded after that host is gone — or, if (c) is chosen, that the cost is stated before the
juror is paid for. A test drives a run record that no longer exists and asserts the chosen behaviour.
