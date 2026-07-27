---
bornAs: x5wqget
kind: story
size: 3
parent: "2612"
status: resolved
scope:
  - we:scripts/pr-land.mjs
  - we:scripts/__tests__/pr-land.test.mjs
dateOpened: "2026-07-23"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: [plateau-loop, pr-land, drain, backlog, tooling]
---

# pr-land --park mode: open a review:human/pending PR without stranding its hash ids

Give [`we:scripts/pr-land.mjs`](../scripts/pr-land.mjs) a first-class **park mode** — `--park=<review:human|review:pending>` — that opens the PR **with that review label already on it** *and* runs the same JIT numbering / land-prep the normal path runs. Today an agent that needs a *parked* PR has no clean way to get one from pr-land, so it falls back to `gh pr create` — and that bypass is what strands hash ids.

**Why it happens.** pr-land's default path waits-and-drains (it expects the PR to auto-land), and `--no-wait` opens the PR **unlabelled**. Neither opens a PR that is deliberately held for human review. So an agent needing a parked PR reaches for `gh pr create` instead. But `gh pr create` never runs pr-land's numbering step, so any **new hash-keyed backlog item** the parked PR carries lands with its `xNNNNNN` hash **stranded** — a not-yet-numbered id sitting on `main`. This was observed this session (#2319): a `gh pr create` park left a hash stranded until the drain's land-numbering healed it.

**The fix.** Add `--park=<label>` to pr-land that:
- opens the PR with the given review label (`review:human` or `review:pending`) set at open time — the same determinism [#2307](/backlog/2307-producer-tags-the-review-escalation-label-at-pr-open-determi/) wants for escalation labels;
- runs the identical numbering / land-prep the normal path runs, so a parked PR's new hash items are JIT-numbered on the same footing as an auto-landing PR — no strand;
- does **not** wait-and-drain (a parked PR is meant to sit for review), i.e. it composes park + the `--no-wait` open semantics but keeps the numbering step.

**Not urgent — a polish, not a hole.** The drain's land-numbering (per [#2288](/backlog/2288-jit-backlog-numbering-drain-assigns-the-nnn-at-land-from-a-h/)) already **auto-heals** a stranded hash at the next land, and the number-stranded heal (#2319) mops up any that slip through. So this only removes the **transient red gate** between the `gh pr create` park and the next drain pass — it makes the clean path the easy path rather than fixing a permanent failure.

Refs [#2319](/backlog/2319-number-the-stranded-hash-id-s-already-on-main-add-a-hash-on-/), [#2288](/backlog/2288-jit-backlog-numbering-drain-assigns-the-nnn-at-land-from-a-h/), [#2307](/backlog/2307-producer-tags-the-review-escalation-label-at-pr-open-determi/).

## Progress

Done. `we:scripts/pr-land.mjs` now has a first-class `--park=<review:human|review:pending>` mode:

- **`resolveParkLabel(park)`** (pure, exported) validates the flag against `PARK_LABELS` — the two held-for-review labels (`review:human`, `review:pending`), sourced from `REVIEW_LABELS` so the names never drift. A missing/off-list value is a **fail-fast** (`reason: 'bad-park'`, exit 3) *before* any push/create — never a silently-ignored flag.
- **`planPrLand`** gained a fourth mode, `park`: it composes the `--no-wait` open semantics (no green-wait, no `ready-to-merge`, no drain trigger) **with** the caller-chosen review label applied at open. Park **takes precedence** over `--label-on-green`/`--no-wait` (a held PR must never also carry the auto-land signal).
- The PR is opened through the **same producer create path** the normal modes use (locus-prefix re-check, `prCreateBodyGuard`, manifest embed, derived title) — the land-prep the `gh pr create` bypass skipped. The drain still JIT-numbers any born-as-hash item **at land** once a human clears the review, the same footing as an auto-landing PR (numbering stays deferred per #2288 — never minted early on the branch, which would defeat parallel-lane collision avoidance).
- Emits `reason: 'parked'` (exit 0), with `reviewLabel`/`reviewLabelApplied` in the JSON. Dry-run plan renders park-aware lines.

Tests in `we:scripts/__tests__/pr-land.test.mjs`: `resolveParkLabel` (valid/absent/bare/off-list), `planPrLand` park mode + precedence, and a source-level guard that the park branch sits before the wait loop and never labels ready-to-merge. Full `check:standards` green.
