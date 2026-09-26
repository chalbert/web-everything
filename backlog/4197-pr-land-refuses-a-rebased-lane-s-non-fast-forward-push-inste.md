---
bornAs: xyddtee
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/pr-land.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# pr-land refuses a rebased lane's non-fast-forward push instead of handling it itself

we:scripts/pr-land.mjs's initial lane-ref publish is a plain git push with no rebase/lease handling: gitC(['push', REMOTE, SRC:refs/heads/REF]) — a bare push (line ~788). When the lane branch was rebased locally (its remote ref now diverged), this hits a non-fast-forward rejection and pr-land emits {merged:false, reason:'push-failed'} and exits 3, forcing a manual git push --force-with-lease by the operator (live incident, 2026-09-25). Make pr-land detect a rebased-but-safe lane (the local ref is a rebase of, not a divergent edit from, the remote one) and push it itself with an explicit lease check (--force-with-lease=<ref>:<expected-remote-oid>), never a bare --force.

## Done when

1. **Executable** — a test rebasing a fixture lane branch locally then running `we:scripts/pr-land.mjs`'s publish step shows the OLD code returning `push-failed`/exit 3, and the NEW code pushing successfully with a lease check — fails before this lands and passes after.
2. **Live proof** — reproduce the real incident: rebase a real lane branch onto a moved `main` locally, then run `pr-land`; before this lands the push fails and needs a manual `--force-with-lease`; after, `pr-land` completes the push itself with no manual step, and a genuinely divergent (non-rebase) remote ref still refuses rather than being clobbered.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
