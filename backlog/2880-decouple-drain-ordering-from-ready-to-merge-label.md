---
bornAs: xq985wu
kind: task
status: open
dateOpened: "2026-08-02"
tags: [conveyor, drain, merge-ordering, review-integrity]
---

# Decouple the drain's merge-ORDERING from the `ready-to-merge` label scope

The drain's cross-item merge order must derive from the **full set of open PRs**,
not from the `--label ready-to-merge`-scoped candidate list. Today it derives
from the scoped list on a full sweep, which couples ordering to label membership
and makes it unsafe to strip `ready-to-merge` from a held PR.

**Blocks: #984 / #2832 WE-side strip.** #984 strips `ready-to-merge` from a held
PR (so a merely-reordered PR stops advertising itself as landable). That strip is
UNSAFE until this decouple lands — see the hazard below.

## The problem

In `we:scripts/merge-ai-prs.mjs`:

- `planLabelDrain(candidates, { extraOpenItems })` computes its cross-item
  `openItems` set from the candidate `list`. A candidate whose item is in
  `openItems` keeps its dependents deferred — their `blockedBy` / `stackParents`
  edges resolve against `openItems`.
- The `/drain` full sweep passes `verdicts` (the `--label ready-to-merge`-scoped
  candidate list) as `candidates`, and `orderExtraOpenItems` was
  `onlyPr ? openPrContext.openItems : null` — so on a FULL sweep it was `null`.
  Ordering therefore derived SOLELY from the label-scoped list.
- Consequence: once #984 strips `ready-to-merge` from a held PR, that held PR
  drops out of the candidate list, drops out of `openItems`, and a dependent PR
  `blockedBy` the held item resolves the edge as "landed" and lands EARLY / out
  of order.
- The comment at `collectOpenPrContext`'s reconcile note documented this
  explicitly: `ready-to-merge` was *deliberately not stripped* because stripping
  "would drop a still-open, merely-reordered PR out of the SAME PASS's
  `--label`-scoped `verdicts` listing, which derives `planLabelDrain`'s
  cross-item `openItems` set." This item removes that coupling so the strip
  becomes safe.

## The fix (surgical — ONLY the decouple, NOT the strip)

`collectOpenPrContext()` already lists every open PR with **no `--label` filter**
and builds a label-blind `openItems` set (`openPrContext.openItems`), populated
whenever `RECONCILE` is true (`RECONCILE = label && !flags['no-reconcile-labels']`
— true for the `--label ready-to-merge` /drain role).

Feed that full-open, label-blind item set as `extraOpenItems` on **every** pass,
not just `--only`:

```
const orderExtraOpenItems = openPrContext.openItems;
```

A superset is safe by construction (`planLabelDrain`: "A superset is safe: it can
only ADD a defer, never drop one"). When RECONCILE did not run (no label — the
orphan sweep), `openPrContext.openItems` is an empty Set, which degrades to
today's behavior (the candidate list already IS the full open set when
unfiltered).

Do NOT strip `ready-to-merge` here — that is #984's job. Do NOT touch
`classifyPr` (#975 owns it) or `shouldLabelOnGreen`.

## Loci

- `we:scripts/merge-ai-prs.mjs` — `planLabelDrain` (the `openItems` /
  `extraOpenItems` merge-ordering gate)
- `we:scripts/merge-ai-prs.mjs` — `orderExtraOpenItems` (the wiring, now
  label-blind on every pass)
- `we:scripts/merge-ai-prs.mjs` — `collectOpenPrContext` (the label-blind
  full-open `openItems` source)

## Acceptance

- **AC1 — decoupled ordering.** With the held blocker ABSENT from the candidate
  list (simulating #984's strip) but its item present in `extraOpenItems`, a
  dependent `merge` candidate `blockedBy` the held item is DEFERRED. The mirror:
  with the held item absent from BOTH the candidate list and `extraOpenItems`
  (truly landed) the dependent is READY — proving the defer comes from open-set
  membership, not from nothing.
- **AC2 — superset safety / no regression.** A full candidate list with
  `extraOpenItems` a superset (extra unrelated open items) produces the SAME
  ready/deferred partition as today for the non-held items.
- **AC3 — the wiring.** `orderExtraOpenItems` is sourced from the label-blind
  full-open context on a full sweep, not gated on `onlyPr`.
