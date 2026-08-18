# Working from a cloud VM (Claude Code on the web)

A session started from claude.ai/code, the mobile app, or `claude --cloud` runs in an **ephemeral,
Anthropic-managed container**, not on the workstation. The instruction layer travels there unchanged —
`AGENTS.md` is committed, so the rules load — but almost everything the laptop setup assumes about the
*machine* is false. This page is the delta. Read it when `bootstrap-session` reports `host: ephemeral`.

**One command sets the machine up:** `node scripts/bootstrap-session.mjs`. It is idempotent, host-aware,
and registers itself as a `SessionStart` hook so the next session in the same container does it unasked.
`--dry-run` shows the plan, `--check` reports drift without writing.

## What is different, and why

| | Laptop | Cloud VM |
|---|---|---|
| Clones | full history | **`--depth 1` shallow** (`rev-parse --is-shallow-repository` → `true`) |
| Sibling repos | already siblings on disk | arrive via the harness `add_repo` tool, then a clone |
| Lanes | the clone pool is the unit of work | **no pool — work the checkout directly** |
| Branch guard | installed at user level (#3074) | not installed |
| Skills | `~/.claude/skills` synced, scoped | deployed with `--all` (nothing else lives there) |
| Memory | reserved lane → user-level dir (#2350) | in-repo `.claude/agent-memory` |
| Uncommitted work | survives indefinitely | **lost when the VM is reclaimed** |

## The rules that only apply here

**Push early, push often — this is the one that bites.** The container is reclaimed after a period of
inactivity and the filesystem goes with it; only the conversation is restored. Everything the laptop
learned about lanes being wiped mid-work ([[shared-pool-lane-unsafe-for-manual-work]],
[[lane-refresh-wipes-unmapped-lanes]]) applies here with a blunter cause: there is no refresher to blame,
the whole box goes. A WIP commit pushed to a `lane/*` ref is durable; a working tree is not.

**Do not provision a lane pool.** `lane-pool.mjs` exists to dodge the user-global branch guard, to share
git objects with a primary checkout via `--reference`, and to persist between batches. A cloud VM has no
guard to dodge, no full object store to reference (the clones are shallow), and no "between batches" — so
a pool costs an `npm ci` per lane and returns nothing. Edit the checkout, commit, push a `lane/*` ref.
The convergence half is unchanged: the transport to `main` is still the PR (`/pr`, `/drain`).

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
`bootstrap-session.mjs` derives which checkout it is in rather than declaring it, takes the constellation
from `scripts/lib/constellation-repos.mjs` rather than a local list, and looks up the skills CLI
self-then-siblings so the two halves can move in either order. Its `locus:` line reports what it decided.

Two WE-as-hub assumptions do remain, both in that shared table and both flagged there: `we: { path: '' }`
("the WE primary's own cwd") and `DEFAULT_REPO_KEY = 'we'`. They are the seam the move pulls on, and they
belong to `review-runner.mjs`, not to this bootstrap.

## Known rough edge

`.claude/settings.json` is committed and still carries workstation-absolute paths (an
`additionalDirectories` entry and one allow-rule under `/Users/…`). They are inert rather than harmful on
a VM — they simply name nothing — but they are dead weight in every cloud session and want the same
user-level treatment `guard-lane-install.mjs` gave the guard in #3074.
