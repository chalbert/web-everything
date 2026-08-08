---
kind: task
status: open
dateOpened: "2026-08-08"
tags: []
---

# review-set-label --to=accepted leaves a stale review:changes label behind

Accepting a PR that carries review:changes adds review:accepted but never drops review:changes, so the label set contradicts itself. The rearm target that would clear it is not on main.

## What happened

Hit live on PR #1024 (2026-08-08). The PR sat at `review:changes`; its two blockers were
fixed and re-verified, so the reviewer ran:

```
node scripts/review-set-label.mjs 1024 --repo=chalbert/web-everything --to=accepted
```

It returned `{"ok":true,...,"labels":["ready-to-merge","review:accepted","review:changes"]}`
— success, and a label set that says both "changes requested" and "accepted" at once.

## Why

`decideSetLabel` in `we:scripts/review-set-label.mjs` drops only `review:pending` on the
`accepted` target. The documented path out of `review:changes` is the `rearm` target
(`changes → pending`, #2630), but **`rearm` is not on main** — main's CLI rejects it:

```
{"error":"invalid --to — expected 'accepted', 'changes', or 'clear-human'"}
```

So today there is *no* supported path from `review:changes` to `review:accepted`. The
reviewer has to drop the label by hand with `gh pr edit --remove-label`, which is exactly
the out-of-band label editing the CLI exists to prevent.

## Severity

Cosmetic **today**, not a hold: `hasUnclearedReviewLabel`
(`we:scripts/lib/review-escalation.mjs:714-719`) short-circuits to `false` the moment
`review:accepted` is present, so the drain still lands the PR. The damage is that the
label set lies — a human reading the PR sees "changes requested" on something that was
accepted and merged.

## What to consider

- Land `rearm` on main (it exists on a branch), and make `/review`'s fix→re-review loop
  call it, so `changes → pending → accepted` is a real path.
- **Or** have the `accepted` target drop `review:changes` as well as `review:pending`.
  Cheaper, but it erases the "this was bounced once" signal that `rearm` preserves —
  weigh that before picking.
- Either way, `--to=accepted` on a `review:changes` PR must not return `ok:true` while
  leaving a self-contradictory label set. If the swap is refused, say so and exit non-zero.

## Acceptance

- A PR at `review:changes` can be moved to `review:accepted` through the CLI alone, with
  no `gh pr edit` by hand.
- The resulting label set never carries `review:changes` and `review:accepted` together.
- A test pins the refusal-or-swap behaviour for every `REVIEW_LABEL_TARGETS` member
  against every starting label set.
