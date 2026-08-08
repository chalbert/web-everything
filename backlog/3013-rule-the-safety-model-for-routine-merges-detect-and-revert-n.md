---
bornAs: xzrs9xf
kind: decision
size: 3
status: open
dateOpened: "2026-08-08"
relatedTo: ["2948", "2830", "2820", "2979", "3007"]
tags: [governance, review-integrity, drain, throughput, statute-candidate]
---

# Rule the safety model for routine merges: detect-and-revert, not prevent-everything

Rule what `main` is allowed to cost. Today every routine machinery diff gets the prevention treatment —
8–10 full reads (#2948), re-review after every mechanical rebase, and a human serializer — because the gate
treats a bad merge as unacceptable. But this is a pre-release standards repo: a bad routine merge costs one
revert, while a stalled queue costs the whole week (measured: 90th-percentile open→merged is 77 hours, all
of it review wait). #2948 already states the bar as "better than main, not perfect"; this decision draws
the conclusion nobody has drawn — for routine work, post-merge detection can replace pre-merge re-review.
Un-prepared — run /prepare before ruling.

## The fork

- **Option 1 — detect-and-revert for the routine tier** (the delivery review's recommendation). Routine
  PRs (no statute, no gate-self, no dismissed findings) merge on: required `test` green + one review pass +
  a ledger-recorded verdict (#3007). No re-review after content-identical rebases (#2979). A post-merge
  audit pass reads what landed and files or reverts what it finds; the ledger is the audit trail. Hard
  prevention gates remain exactly where reversal is genuinely expensive: statute and gate-self changes
  (human gate), backlog numbering, branch deletion, pushes to a constellation `main`.
- **Option 2 — keep prevention everywhere**: every merge keeps the current bar. Honest cost, now measured:
  the 77-hour tail, the re-review treadmill, and the operator as first reader on every hold. Choosing this
  option means accepting that throughput, not safety, is the sacrificed variable.

## Why this is one ruling and not per-item tuning

The enforce flip (#2830's deferred half), proportional review (#2948), and accept-survives-rebase (#2979)
are all individually stuck on the same unstated question — "is a wrong routine merge tolerable if it is
cheap to see and cheap to undo?" Answering it once, as statute, unsticks all three; leaving it unstated
means each one re-fights the same argument in review. The ruling should land in
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) with the routine/irreversible tier
boundary stated explicitly.
