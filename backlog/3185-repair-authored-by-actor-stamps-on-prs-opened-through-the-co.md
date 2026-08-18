---
bornAs: x157gay
kind: task
status: open
dateOpened: "2026-08-18"
preparedDate: "2026-08-18"
tags: [review, independence, drain, cloud-vm, hygiene]
---

# Repair authored-by-actor stamps on PRs opened through the connector instead of pr-land

Six PRs opened from a cloud VM on 2026-08-18 (#1463, #1465, #1466, #1467, #1468, and #1445's
re-push) were created through the GitHub connector's `create_pull_request` rather than
`we:scripts/pr-land.mjs`, which is what stamps `authored-by-actor` into the PR body. They therefore
carry no author stamp. Today `decideClearerIndependence` reads them as `unknown-author` — TOLERATED
— so nothing is blocked. Once #3067's owed follow-up wires `prCreatedAt` into `we:scripts/review-set-label.mjs`, every one of them reclassifies as `STAMP_LOST`, which is REFUSED.
This repairs the stamps before that lands.

## Why the reclassification happens

`distinguishMissingAuthorStamp` compares the PR's creation time against
`STAMP_REGIME_START` (`2026-08-08T09:17:52-04:00`):

- opened BEFORE the regime, no stamp → `NEVER_STAMPED` → `UNKNOWN_AUTHOR`, tolerated
- opened AT/AFTER the regime, no stamp → `STRIPPED` → `STAMP_LOST`, "NOT tolerated (#3067)"

These PRs were opened 2026-08-18, ten days after the regime began. The only reason they read as
tolerated today is that `we:scripts/review-set-label.mjs` calls the decider WITHOUT `prCreatedAt`, which
`we:scripts/lib/review-independence.mjs` names explicitly as an owed follow-up rather than a settled
state:

```
Both new inputs (`prCreatedAt`, `stampLostMarked`) are OPT-IN: a caller that does not yet pass
either sees byte-identical behaviour … which is why wiring them into `we:scripts/review-set-label.mjs` /
`auto-land-seam.mjs` … is left as this item's own owed follow-up
```

Verified by running the decider directly, same inputs, with and without `prCreatedAt`:

```
as set-label calls it  : unknown-author
with prCreatedAt wired : stamp-lost
```

So this is a latent refusal on six live PRs, armed by a change already owed elsewhere.

## The honest framing

The stamps are absent because the session opening the PRs could not reach `gh` and used the
connector instead. That is a real constraint, not carelessness — but the *record* is now wrong in a
way that matters: a reader cannot tell who authored them, and the independence bar cannot be
evaluated. `--repair` exists precisely for this.

## Done when

1. **Executable** — for each affected PR, this reports a recovered or explicitly-marked stamp rather
   than a missing one:

   ```
   node scripts/pr-body-edit.mjs --pr=<n> --repair
   ```
2. Each of the six PRs either carries an `authored-by-actor` stamp naming the session that opened it,
   or carries the `author-stamp-lost` marker with the investigation recorded — never silently nothing.
3. Re-running `decideClearerIndependence` with `prCreatedAt` supplied no longer returns `STAMP_LOST`
   for any of them.
4. The gap is closed at the source, not just the symptom: opening a PR from a host that cannot run
   `we:scripts/pr-land.mjs` either stamps the body some other way or is refused, so this cannot silently recur.
   If that needs its own item, file it and link from here rather than leaving the hole open.

## De-risked during prep

- `STAMP_REGIME_START` and both branches of `distinguishMissingAuthorStamp` were read directly from
  `we:scripts/lib/review-independence.mjs`, and the two decider outcomes above were produced by
  running the real function, not inferred from the source.
- The affected PR list is the set opened by one session on one day and is enumerable from that
  session's own record; it is not a corpus-wide sweep.
- Confirmed the refusal is NOT live today — `we:scripts/review-set-label.mjs` passes no `prCreatedAt` — so this
  is preventive, and nothing is currently blocked by it. That is why it is a task, not a bug.
