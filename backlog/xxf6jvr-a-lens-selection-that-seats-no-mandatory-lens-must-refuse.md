---
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/operations/review-pr.mjs
tags: []
---

# A lens selection that seats no mandatory lens must refuse

Pointing `--lens` at an advisory lens silently replaces the mandatory correctness seat, dropping the run's blocking floor with no signal at all. Two sessions were burned by it in one day, from opposite directions.

## The mechanic

`MANDATORY_LENSES` is `[correctness, security]` (`we:scripts/lib/jury-core.mjs:694`).
`ADVISORY_LENSES` is `[simplicity, standards-conformance, claim-accuracy]`
(`we:scripts/lib/jury-core.mjs:698`).
Both draw from the one `MANDATE_LENSES` vocabulary (`we:scripts/lib/jury-core.mjs:666`).
The distinction is what a finding can *do*: a mandatory lens's findings block, an advisory lens's findings
inform.

`--lens` is a **single scalar input with a default**, not a list:

```js
lens: { type: 'string', required: false, default: DEFAULT_LENS, enum: [...PANEL_LENSES] },
```

(`we:scripts/operations/review-pr.mjs:471`.)
That default is `DEFAULT_LENS` (`we:scripts/operations/review-pr.mjs:103`), which is `MANDATORY_LENSES[0]`.
Exactly one seat consumes it — the `judge` step (`we:scripts/operations/review-pr.mjs:560`).
It reads `view.input.lens` (`we:scripts/operations/review-pr.mjs:564`) and hands that one value on as the
whole run's lens.

So passing `--lens` does **not** add a lens — it **substitutes** the default one. `--lens=claim-accuracy` does
not mean "also check claim accuracy"; it means "review this PR with **no blocking lens seated at all**". The
run completes, renders a verdict, and reports findings that cannot block, and nothing anywhere says the floor
was removed.

## The evidence this is not a documentation gap

Two independent sessions hit it the same day, arriving from **opposite directions**:

- One recommended `--lens=claim-accuracy` for a prose-heavy PR, reasoning that claim accuracy was the relevant
  property. A reviewer caught that the recommendation silently unseated correctness. Withdrawn.
- The other told its reviewers that **omitting** `--lens` would let the care model pick a panel. It does not —
  it takes the default. A reviewer on a different PR caught that too.

One of those is "narrowed too far", the other is "assumed it widened". Both produced a run whose blocking floor
was not what the operator believed. **A footgun that fires on people reasoning in opposite directions is not
something better prose fixes** — the two sessions between them already held every fact needed to avoid it.

## Why refuse rather than warn

A warning is the obvious cheaper move and it is the wrong one here. These runs are **headless** — the juror is
spawned by an operation and the output is consumed by a reduction step. A warning on stderr reaches no human at
the moment it matters, and that is precisely how the second case above got through: the run was dispatched, not
watched.

The refusal should name what is missing rather than restating the flag, e.g. *"`--lens=claim-accuracy` seats no
mandatory lens — this run would have no blocking floor. `MANDATORY_LENSES` is `[correctness, security]`."*

Note this becomes **less** likely to bite once [#3319](/backlog/3319/) lands a second, non-CLI-reachable
`judgeSecurity` seat pinned to `MANDATORY_LENSES[1]`, since a mandatory lens then sits regardless of `--lens`.
That is a reason the refusal is small, **not** a reason to skip it: #3319 makes the invariant true by
construction for one specific seat, while this makes the *rule* explicit and survives a future run shape where
the pinned seat is conditional or removed. Sequence it after #3319 and check whether the condition should read
"no mandatory lens seated **across all judge steps**" rather than "the `--lens` input is advisory" — the
former is the property actually wanted.

## Related

Distinct from [#3322](/backlog/3322/) (refuse a self-clear at `read`, before the juror is billed), though the
same instinct: **refuse early, and refuse rather than warn, when the caller is a machine.** Worth landing the
two consistently.

## Done when

1. **Executable** — a test asserting that a `review-pr` run whose lens selection seats no mandatory lens is
   refused **before** a juror is spawned, and that a selection which does seat one proceeds normally. The
   negative half matters as much as the positive: a refusal that also blocks legitimate runs is worse than the
   hole.
2. `npm run check:standards` — 0 errors.
