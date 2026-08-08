---
bornAs: xl5dnuc
kind: task
status: open
dateOpened: "2026-08-02"
relatedTo: ["2832"]
tags: [conveyor, merge-ordering, review-integrity]
---

# `blockWait` can clear a dependent's edge on a blocker whose WE carrier landed but whose impl half is still open+red

> **Against #999's change, not #2832's.** This was surfaced by the human `/review` of PR **#984** (#2832) but
> the defect is in **#999**'s liveness fix (`we:scripts/merge-ai-prs.mjs` — the `blockWait` / `provenLanded`
> predicate), not in #2832's label/hold work. Filed standalone so #984 lands without folding an unrelated fix.

## The defect

`we:scripts/merge-ai-prs.mjs` `planLabelDrain` clears a cross-item `blockedBy` edge as soon as the blocker is
`provenLanded`:

```js
const provenLanded = (id) => landedThisPass.has(id) || provenOnMain.has(id);
const blockWait = (Array.isArray(c.blockedBy) ? c.blockedBy : [])
  .map(asItemId).filter((b) => openItems.has(b) && !provenLanded(b));
```

`landedThisPass` is keyed on the **WE-carrier merge** (the resolve carrier, where `bornAs` is stamped). But a
couple is impl-first/WE-last across repos, and a blocker's WE half can land while its **impl half is still
open — or red**. In that window the blocker reads as `landedThisPass`, `blockWait` drops the edge, and the
dependent merges even though the blocker is not fully landed.

## Reproduction (from the reviewer)

```js
planLabelDrain(
  [{ num: 20, item: 100, decision: 'skip', hasManifest: true },
   { num: 30, item: 101, blockedBy: [100], decision: 'merge', hasManifest: true }],
  { landedThisPass: new Set([100]) })
// → ready [30]   deferred []
// #30 merges because item 100 reads "landed this pass" — but its carrier's impl half could still be open/red.
```

## Severity: low

Requires the merge ordering to already be in a partially-broken state (a couple whose WE half landed while its
impl half is still open or red — itself abnormal). The stowaway guard (#2393) covers the common cases, and the
couple gate that would cover the rest is pending in **xzzbn7i** (split out of #984). Tracked, not urgent.

## What to consider

- `landedThisPass` should register a blocker as landed only when the **whole couple** landed (impl + WE), not
  the WE carrier alone — mirror the positive-proof shape of `we:scripts/merge-ai-prs.mjs` `joinImplToCouples`,
  so a blocker with an open/red impl half stays a live edge.
- Coordinate with **xzzbn7i** (the couple gate, split out of #984) so `provenLanded` and that gate agree on
  what "landed" means rather than each inventing its own proof.

## Acceptance

- A dependent does **not** clear its `blockedBy` edge while the blocker's impl half is still open or red.
- The reproduction above yields `deferred [30]`, not `ready [30]`.
- No regression to #999's chain-liveness fix (a fully-landed blocker still frees its dependent same-pass).
