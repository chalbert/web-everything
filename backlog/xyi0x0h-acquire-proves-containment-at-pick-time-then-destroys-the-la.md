---
kind: task
status: open
dateOpened: "2026-08-05"
relatedTo: ["2452", "2919", "2267"]
tags: [lane-pool, infra, footgun]
scope:
  - we:scripts/lane-pool.mjs
---

# acquire proves containment at pick time, then destroys the lane ~30s later without re-checking

PR #1042 review residue, filed under the land bar's "non-blocking means tracked, never forgotten".
`cmdAcquire` proves `aheadIsProvablyPushed` from one `ls-remote` snapshot, then runs the merge-base
fan-out (29.5s measured, #2920), the O_EXCL claim and `git fetch origin --prune` before
`checkout -B --force` + `clean -fd` — with no re-verification. A `lane/*` ref deleted or force-pushed
on origin inside that window means acquire wipes the last local copy on a pre-deletion snapshot.

## Why it is owed

The operator accepted #1042 with this finding explicitly carried rather than fixed, so the land bar
requires it tracked. Its three siblings from the same review were filed (#2918, #2919, #2920); this one
was named in the acceptance comment and never converted into a card.

The window is **new against main**: before #1042 an ahead lane was never auto-picked at all, so there
was no check-then-act gap to have. Impact if it fires is `unrecoverable` — commits that exist on no
remote are destroyed — but the likelihood is genuinely low, which is why it did not block the land:

- the drain's normal path *merges then* deletes, so the commits survive on `main`;
- `we:scripts/prune-landed-lanes.mjs` only deletes a ref whose three-way merge into `origin/main` is
  byte-identical;
- so the harmful case needs a ref deleted or force-pushed **without landing** inside the window — manual
  branch deletion, an abandoned-PR cleanup, a rebase force-push.

## Build

Re-verify the winner **after** the existing `fetch --prune` (we:scripts/lane-pool.mjs, the reset block)
and before the destructive `checkout -B --force`. At that point the check is network-free: the fetch has
already run, so the lane's own remote-tracking refs are authoritative and `git branch -r --contains HEAD`
answers locally. Re-running `laneDirtyOrAhead` works too — its `ahead` collapses to 0 once
`origin/<branch>` is fresh.

## Acceptance

- The proof that authorises destruction is taken from state no older than the `fetch --prune` that
  immediately precedes it.
- Closes #2919's object-locality limit for free: the fetch brings the containing tip objects locally,
  which is exactly what `merge-base --is-ancestor` needs and what an `ls-remote` snapshot never supplies.
- Still fails closed — an unproven lane stays protected (#2267).
