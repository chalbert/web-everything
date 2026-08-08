---
kind: story
size: 5
parent: "2612"
status: open
dateOpened: "2026-08-08"
relatedTo: ["2832"]
tags: [conveyor, drain, merge-ordering, review-integrity, ordering-engine]
---

# Redo the couple-join decoupling that was split out of PR #984 (a held+stripped WE carrier must still gate its impl half)

The couple-join decoupling was split out of PR #984 after regressing in three review rounds; redo it in `we:scripts/merge-ai-prs.mjs`, handling (a) `--only`/`--repos` scope-completeness — the carrier is indexed from an `--only`-blind context, so the gate then cannot find it and defers every impl half forever; (b) fail-closed against BOTH `NaN` and `0`, because `parseManifest`/`asItemId` coerces a missing item to `NaN` and a JSON-null to `0`, so `item == null` never fires; (c) idle accounting — a held couple defers its impl every pass, so `--watch --until-batches-idle` never idles; (d) tests driving `runCli`'s real narrowing, not hand-built literals.

## Why this is a separate item

PR **#984** (#2832) carries two independent concerns. The **label/hold half** — the write-time
"held ⇒ never ready-to-merge" invariant plus the park-time atomic strip — survived five review rounds with no
finding against it. The **couple-join decoupling** riding alongside it produced a *blocking* finding in rounds
2, 3 and 5. It was removed from #984 so the correct half could land; this item carries the removed work.

## The hazard (still real — do not drop it)

`we:scripts/merge-ai-prs.mjs` collects candidates with `--label ready-to-merge`. #984's park-time strip removes
that label from a HELD WE carrier, so the carrier **leaves** the candidate `verdicts`. `joinImplToCouples`
builds its `byRef` index from `verdicts` alone, so the couple's lane refs disappear; the manifest-less impl
half (frontierui / plateau-app), which is still labelled, inherits nothing, reads as an always-ready orphan and
**lands ALONE** — no WE resolve, and the couple's `blockedBy` / #2393 `stackParents` proof bypassed.

## What the redo must get right

1. **`--only` / `--repos` scope-completeness.** The supplementary carrier index is built from a context that is
   itself `--only`-blind. Under `--only`, the gate then cannot find the carrier at all, and it defers **every**
   impl half forever. The carrier set and the gate must agree on scope, or the gate must degrade open when the
   context provably cannot see the carrier.
2. **Fail closed against BOTH `NaN` and `0`.** `parseManifest` / `asItemId` in
   `we:scripts/merge-ai-prs.mjs` coerce a **missing** item to `NaN` and a **JSON-null** item to `0`. So a plain
   `item == null` check never fires on any real manifest — the "unidentifiable carrier" branch is dead code as
   written. Test the coercion, not the literal.
3. **Idle accounting.** A held couple defers its impl on every pass. With `--watch --until-batches-idle` that
   is an eternally non-idle pass, so the watch never exits. A permanent defer must either count as idle or be
   surfaced and bounded.
4. **Tests that drive the real narrowing.** Exercise `runCli`'s actual manifest → verdict narrowing rather than
   hand-built object literals. The FAILS-CLOSED test removed with this work was green only against a literal no
   production path emits, so it documented a guarantee the code did not provide.

## Acceptance

- A HELD carrier stripped of `ready-to-merge` still gates its impl half: the impl **defers**, never orphan-lands.
- Under `--only <repo>` the gate does **not** deadlock the impl halves it cannot see a carrier for.
- A carrier whose manifest `item` is missing (`NaN`) or JSON-null (`0`) fails **closed**, proven by a test that
  goes through `parseManifest` / `asItemId`, not a literal.
- `--watch --until-batches-idle` still reaches idle in the presence of a permanently-held couple.
- No regression to #984's label/hold half (`shouldLabelOnGreen` hold refusal, the park-time atomic strip,
  `decideHoldReadyStrip` in `we:scripts/pr-land.mjs`).
