---
bornAs: xq9zmea
kind: task
status: open
relatedTo: ["1770", "872"]
dateOpened: "2026-08-17"
tags: [constellation, placement, drift, cross-repo]
---

# Gate the 61 drifted same-path WE↔FUI file pairs — nothing reconciles them today

Measured during the 2026-08-17 prep pass on #1770: **91** tracked files sit at the *same relative path* in both
`webeverything` and `frontierui` across `.ts`/`.js`/`.mjs`/`.cjs`/`.json`/`.css`/`.html`; **30** are
byte-identical and **61 have drifted**, with no reconciliation gate live in either repo. #1770's own instrument
does **not** cover this set: its part 1 re-points `validatePlugWeFuiDrift` at a *hand-authored* pair list aimed
at the two headline generators, which sit at *different* relative paths and so are invisible to a path-equality
sweep. The same-path set is the mirror-image gap — findable by path equality, covered by nothing.

## Why this is filed rather than folded into #1770

#1770's prep deliberately kept its instrument narrow, and widening part 1's pair list to all 91 same-path pairs
would re-import exactly the breadth that prep rejected. But "narrow" must not mean "graduated to nobody" — this
item is the concrete owner the finding was previously routed to only in the abstract.

## The first question to settle (not assumed)

**Not every drifted pair is a defect.** Some same-path files legitimately differ per repo (config, per-repo
wiring, generated lockfiles). So the first pass is a **triage**, not a gate: classify the 61 into

- **must-match** — a shared contract substrate that has silently diverged (the `PLUG_SHARED_CORE_FILES` shape);
- **must-differ** — per-repo wiring where identity would itself be the bug;
- **should-not-exist** — a WE-resident copy that #1282 says should not be in WE at all, which routes to #872's
  contract-distribution end-state rather than to a parity gate.

Only the first bucket earns a byte-parity gate. Publishing the triage is the deliverable even if the gated set
turns out small.

## Done when

1. **Executable** — a script (or a `check:standards` arm) enumerates the same-path WE↔FUI pairs, classifies each
   into the three buckets above from a checked-in declaration, and **fails** on (a) a must-match pair that has
   drifted and (b) a same-path pair present in neither bucket list — so a newly-introduced duplicate cannot be
   added silently.
2. The declaration file records the 2026-08-17 measurement (91/30/61) as its baseline, and the check reports its
   own covered-pair count, so a shrinking subject surfaces rather than passing quietly (#1770 part 3's rule).

## Grounding

- #1770 (`we:backlog/1770-audit-the-end-state-constellation-placement-once-all-relocat.md`), *Cross-repo
  duplication* in the 2026-08-17 inventory — the measurement this item owns.
- `we:reports/2026-08-17-zero-impl-boundary-enforcement.md` — the survey, including why the count is
  definition-sensitive (a wider file-set definition yields 109/30/79; the method is stated, not the number).
- #872 — the contract-distribution end-state that retires byte-replication, which is the disposition for the
  *should-not-exist* bucket.
