# Working from a cloud VM (Claude Code on the web)

A session started from claude.ai/code, the mobile app, or `claude --cloud` runs in an **ephemeral,
Anthropic-managed container**, not on the workstation. The instruction layer travels there unchanged —
`AGENTS.md` is committed, so the rules load — but almost everything the laptop setup assumes about the
*machine* is false. This page is the delta. Read it when `bootstrap-session` reports `host: ephemeral`.

**One command sets the machine up:** `node scripts/bootstrap-session.mjs`. It is idempotent and host-aware.
On an ephemeral VM it applies and registers itself as a `SessionStart` hook, so the next session in the same
container does it unasked; on a workstation it only reports (see *Installing on a workstation*).
`--dry-run` shows the plan, `--check` reports drift without writing.

## What is different, and why

| | Laptop | Cloud VM |
|---|---|---|
| Clones | full history | **`--depth 1` shallow** (`rev-parse --is-shallow-repository` → `true`) |
| Sibling repos | already siblings on disk | arrive via the harness `add_repo` tool, then a clone |
| Lanes | the clone pool is the unit of work | **still the unit of work — provision one, with the two overrides below** |
| Branch guard | installed at user level (#3074) | user-level one not installed; the **committed** `guard-lane.mjs` hook fires regardless |
| `$HOME` vs checkouts | both under `~/workspace` | **`$HOME=/root`, checkouts under `/home/user`** — `LANE_POOL_ROOT` must be set |
| Skills | `~/.claude/skills` synced, scoped | deployed with `--all` (nothing else lives there) |
| Memory | reserved lane → user-level dir (#2350) | in-repo `.claude/agent-memory` |
| Uncommitted work | survives indefinitely | **lost when the VM is reclaimed** |

## The rules that only apply here

**Push early, push often — this is the one that bites.** The container is reclaimed after a period of
inactivity and the filesystem goes with it; only the conversation is restored. Everything the laptop
learned about lanes being wiped mid-work ([[shared-pool-lane-unsafe-for-manual-work]],
[[lane-refresh-wipes-unmapped-lanes]]) applies here with a blunter cause: there is no refresher to blame,
the whole box goes. A WIP commit pushed to a `lane/*` ref is durable; a working tree is not.

**You still work in a lane here — provision one.** This page used to say the opposite ("no guard to dodge,
so a pool buys nothing"), and that was wrong in a way that DEADLOCKS the box: `guard-lane.mjs` is registered
in the **committed** `.claude/settings.json` `PreToolUse` hooks, so it ships with the repo and denies every
`Edit`/`Write` to a primary checkout on a VM exactly as on a laptop. With no pool there is then no writable
surface at all — the primary is guarded and no lane exists. `#primary-read-only-lanes-only` is not relaxed
here; only the *reasons* the laptop provisions a pool are.

Two things must be overridden first, and neither is optional:

```bash
# 1. `--reference` against a `--depth 1` clone is FATAL, not merely useless:
#    `fatal: reference repository '<path>' is shallow`. Unshallow every repo the pool will clone or reference.
git -C <each constellation checkout> fetch --unshallow

# 2. The pool root defaults to `~/workspace/.lanes`, but `$HOME` is `/root` here while the harness clones
#    into `/home/user` — so the default resolves to a directory that does not exist.
export LANE_POOL_ROOT=/home/user/.lanes
node scripts/lane-pool.mjs provision --count=2 --repo=/home/user/web-everything
```

Two lanes, not one: `review-pr`'s juror is tool-bearing and `assertLaneCwd` refuses to spawn it into the
lane you are driving from (#3151), so a review needs a second one.

The convergence half is unchanged: the transport to `main` is still the PR (`/pr`, `/drain`). What IS
different is that `gh` has no credential here, so `open-pr` and `review-pr` halt at their `submit`/`record`
effects and hand back a plan — submit it through whatever channel does hold one, and re-apply the park label
by hand, per the `/pr` skill's fallback (it is two calls, and the second is not optional).

## Landing work from a VM — the whole arc

The pieces are documented separately (`/pr`, `/review`, [delivery-loop.md](delivery-loop.md)) and each is
correct; what nobody had written down is the ORDER, and which steps behave differently here. Every step below
is the declared operation — never a hand-rolled `gh pr create`, never the connector as a first move.

```bash
# 1. Work in a lane, commit there, publish to a lane/* ref (NEVER a local branch — the #1934 carve-out).
git push origin HEAD:refs/heads/lane/<slug>

# 2. Decide the PR through the operation. It HALTS at `submit` (no gh credential) and returns its plan.
node scripts/operations/run.mjs open-pr --ref=lane/<slug> --title="…" --bodyFile=<path> --json

# 3. Submit that plan's argv, unedited, through the channel that holds a credential. See the losses below.
# 4. Review it. `--cwd` is a lane of the juror's OWN — never the one you are driving from (#3151).
node scripts/operations/run.mjs stage-pr-view --pr=<N> --repo=<owner/name> --from=<payload.json> --dir="$WE_PR_VIEW_DIR"
node scripts/operations/run.mjs review-pr --pr=<N> --repo=<owner/name> --cwd=<the OTHER lane> --json
```

**The `confirm` step is NOT yours to answer.** `review-pr` judges, reduces to a verdict, and then *suspends* —
it writes nothing on that invocation. Per the `/review` skill: present its `verdict`, its `findings.read`, its
`spend` (the dollar figure, never omitted — the operator is on a constrained model budget) and its
`pending.asks` **to the operator, then stop**. Only `--resume=<run-id> --answer=<option>` on the operator's
explicit decision proceeds.

`pending.of` does NOT license you to answer. It is
`humanRequired ? 'human' : 'agent'` — it names which *tier of actor is owed*, separating a gate-self PR (which
needs the distinct `review-set-label.mjs --to=clear-human` ceremony, #2895) from an ordinary one. `"of":
"agent"` means "no human ceremony is required here", not "decide it yourself".

**Why this matters more on a VM, not less.** `accept` swaps the label to `review:accepted`, which releases the
PR to the drain — and the drain merges. Read as an agent-addressed prompt, that is a self-service path from
your own PR to `main`. Worse, `record`'s `actor` defaults to `'operator'`, so the durable verdict comment
("recorded by operator") and the `verdict-ledger` row (`declared: 'operator'`) both name a human who never
decided. The ledger is the merge authority; a row that misattributes the decider corrupts exactly what it
exists to vouch for. Observed 2026-08-24: an agent answered its own `confirm`, `review:accepted` landed, and
the drain merged the PR 60 seconds later.

### What the credential-less fallback silently drops

`pr-land.mjs` does two things besides calling `gh`, and a connector-created PR gets neither. The first is
documented in the `/pr` skill; the second is not, and it is the one that matters.

1. **The park label.** `--park=review:pending` is in the plan's argv, but a create-PR API call has no label
   parameter. Apply it as a SECOND call and re-read the PR to confirm it stuck, per PR, as each is created.
2. **The `authored-by-actor` stamp** (`pr-land.mjs#withAuthorStamp`, #2844). This is the INPUT to the
   self-clear refusal: `we:scripts/lib/review-independence.mjs` compares the clearer's
   `CLAUDE_CODE_SESSION_ID` against the stamp in the PR BODY, and `review-set-label.mjs` refuses the match.
   A body with no stamp resolves to `''` — `unknown-author` — which is TOLERATED, not refused. So a
   connector-opened PR is **exempt from the guard that stops an author clearing their own review**, silently,
   by omission. Nothing warns you; the refusal simply never fires.

   Until `open-pr` carries the stamp through the fallback, treat it as owed by hand: an author clearing their
   own connector-opened PR is on their honour, not on the guard. Prefer a genuinely independent verdict —
   `review-pr` mints its juror a fresh session id, which is what independence means here
   ([delivery-loop.md](delivery-loop.md#spawning-a-reviewer-that-is-actually-independent) — *a subagent is not
   a second actor; a headless process is*) — and say plainly, when you record it, that the PR carries no stamp.

### When an effect halts with its outcome UNKNOWN

`record`'s `review.label-swap` calls `gh`, so it fails here mid-step. It is not declared idempotent, so the
engine REFUSES to replay it rather than risk a double-apply:

```
effect …#4#1 (review.label-swap) was attempted and its outcome is UNKNOWN — it is not declared
idempotent, so replaying it could double-apply. Refusing. Resolve it by hand … and re-run.
```

That refusal is correct and the recovery is manual: read the PR to establish what actually happened, perform
the effect through the channel that works, then mark that entry on the run record
(`.operations/runs/<id>.json`) `applied` — with a `result` saying it was done by the fallback, so the record
does not imply `gh` did it — and re-run `--resume=<run-id>`. Never mark an effect applied you have not
verified against GitHub.

**Unshallow before any history work.** `git log`, `blame`, `bisect`, and anything that walks back past
HEAD need `git fetch --unshallow` first. Cheap to do, silently wrong to skip.

**Siblings are attached, not cloned.** `bootstrap-session` reports which of the constellation are missing
but never fetches them: private repos are cloned through a credential proxy that deliberately keeps
credentials out of the sandbox, so the harness's `add_repo` tool is the only route. Attach, clone, then
re-run the bootstrap.

**Nothing repoints the memory symlink.** The reserved memory lane (#2350) is the laptop's arrangement and
its repoint is human-gated. Here, `check-memory.mjs` and `memory-resolve.mjs` both fall back to the
tracked in-repo `.claude/agent-memory`, so `/note` and `[[slug]]` links resolve with no setup — and
memory written in a VM lands in `agent-memory-src`, where a commit makes it durable.

## This is not the final home

The bootstrap lives in WE today because that is where the lane and delivery machinery is dogfooded, not
because WE is the constellation's hub. It is not: WE is a **public peer**, and the machinery is Plateau's
product, so it moves there eventually. Nothing here is written to assume otherwise —
`bootstrap-session.mjs` derives which checkout it is in rather than declaring it, and takes the
constellation from `scripts/lib/constellation-repos.mjs` rather than a local list. Its `locus:` line reports
what it decided. It does NOT look up the skills CLI in siblings — an earlier cut did, and that was a
cross-repo code-execution path a `/converge` panel rejected; the relocation ordering it bought belongs to
the multi-project registry (#2472), not to a search-and-execute.

Two WE-as-hub assumptions do remain, both in that shared table and both flagged there: `we: { path: '' }`
("the WE primary's own cwd") and `DEFAULT_REPO_KEY = 'we'`. They are the seam the move pulls on, and they
belong to `review-runner.mjs`, not to this bootstrap.

## Installing on a workstation

`npm run bootstrap` **reports** on a workstation; `npm run bootstrap:install` applies. That asymmetry is
deliberate and is the one thing to understand here.

The committed project `SessionStart` hook means the bootstrap runs the moment anyone opens this repo — so
a default run must not reach outside the repository. On a durable host it prints what it would do and
stops: nothing under `$HOME/.claude` is touched, no directory is granted, and no user-level hook is
installed. `npm run bootstrap:install` is the explicit opt-in and `npm run bootstrap:uninstall` reverses it. (Both exist as their own scripts because `npm run bootstrap install` does NOT forward the bare argument — npm swallows it without a `--` separator, leaving the reader silently in report-only mode.)

An **ephemeral** cloud VM writes freely, because its `$HOME` belongs to a container reclaimed on idle —
there is no durable state to consent about, and a session that configures itself is the whole point.

This was not the first design. The first one always wrote, which meant opening the repo on a workstation
silently granted a directory and installed a user-level hook that then fired in **every unrelated repo on
that machine**. A `/converge` panel caught it before it landed (2026-08-18).

Two things it deliberately does not own: the lane pool (`lane-pool.mjs provision`) and the branch guard
(`guard-lane-install.mjs install`). Both are laptop-only, both have their own installer with its own
safety rules, and wrapping them here would put a second source of truth in front of them.

**Nothing about the machine is hand-maintained any more.** The one absolute path that used to be typed by
hand — the primary checkout's `.git`, granted so a `--reference`d lane can read the objects it shares — is
now derived from where the checkout actually is and written to `~/.claude/settings.json`. It was a
`/Users/<name>/…` literal in the COMMITTED `.claude/settings.json`, which made it wrong for anyone else and
dead in every cloud VM; the stale one-off `Bash(cd /Users/…)` allow-rule beside it is simply gone. Machine
state lives at machine level, computed — the same conclusion #3074 reached for the guard.
