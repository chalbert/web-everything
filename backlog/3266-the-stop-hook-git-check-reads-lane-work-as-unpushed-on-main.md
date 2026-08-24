---
bornAs: xk2qd8p
kind: story
size: 2
status: open
dateOpened: "2026-08-24"
tags: []
---

# The stop-hook git check reads every lane's committed work as "unpushed commits on main"

`~/.claude/stop-hook-git-check.sh` (user-level, outside all three constellation repos) fires at the end of
every turn in a lane clone with:

```
There are 1 unpushed commit(s) on branch 'main'. Please push these changes to the remote repository.
```

It is comparing the branch by NAME against `origin/main`. A lane pins its local branch to `main`
(`we:scripts/lane-pool.mjs` does `git checkout -B <branch> origin/<branch>`) so `refresh`'s hard-reset target
is unambiguous, but work leaves a lane via a `lane/*` ref. So a lane whose commit is fully pushed to its own
upstream reads as "1 ahead of main" — permanently, by construction, for every lane with committed work.

Observed 2026-08-24 on a cloud VM: it fired twice on a lane where `git rev-list --count @{u}..HEAD` was `0`,
the working tree was clean, and the commit was already on `origin/lane/cloud-bootstrap-aliases` and open as
a PR. The instruction it gives is not merely noise — complying would mean `git push origin main`, the direct
write to `main` that `#primary-read-only-lanes-only` forbids and `we:scripts/guard-bash.mjs` blocks, and in
that instance it would have bypassed a review that had just returned **changes requested** on the very commit.

An agent that trusts the hook does the forbidden thing; one that does not has to re-derive why it is wrong
every turn. Either way it trains the reader to ignore a stop-hook, which is the expensive part.

## Done when

1. The check compares against the branch's own upstream (`@{u}`) rather than `origin/main` — which is what
   `git status` already reports — so a branch that is level with its upstream is silent regardless of name.
2. **Observed** — in a lane clone with a committed-and-pushed `lane/*` ref, ending a turn produces no
   unpushed-commit warning; with a genuinely unpushed commit, it still does.
3. A lane with NO upstream still warns (that is the real "you will lose this when the box is reclaimed" case
   the hook exists for, and it must not be silenced along with the false positive).

## Note

The file lives in `~/.claude/`, outside every constellation repo, so **no PR in this repo can fix it** — it
needs a change on the operator's machine. Filed here so the finding is durable rather than living only in a
session transcript.
