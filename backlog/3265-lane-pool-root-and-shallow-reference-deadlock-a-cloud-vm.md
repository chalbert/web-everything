---
bornAs: xcvm3ka
kind: story
size: 3
status: open
dateOpened: "2026-08-24"
tags: []
---

# lane-pool's root and `--reference` deadlock a cloud VM: no writable surface at all

On a cloud VM the primary checkout is unwritable (`we:scripts/guard-lane.mjs` ships in the **committed**
`we:.claude/settings.json` `PreToolUse` hooks, so `#primary-read-only-lanes-only` is enforced there exactly as
on a laptop) **and** no lane can be provisioned. Both halves fail, so the box has nowhere legal to write a
single character until an operator finds two undocumented overrides by hand.

Two independent defects, both in `we:scripts/lane-pool.mjs`:

1. **The pool root is derived from `$HOME`, which is not where the checkouts are.**
   `POOL_ROOT = expandHome(LANE_POOL_ROOT) || join(homedir(), 'workspace', '.lanes')`. On a VM `$HOME` is
   `/root` while the harness clones into `/home/user`, so the default resolves to `/root/workspace/.lanes` —
   a directory that does not exist. `status` reports that phantom root cheerfully. Note `we:scripts/guard-lane.mjs`
   already solves the same problem correctly: it *derives* the workspace from where the checkout actually
   is, which is why it fires on `/home/user/web-everything` while the pool looks in `/root`. One component
   derives the path and the other assumes it.

2. **`git clone --reference` against a `--depth 1` clone is fatal, not merely useless.**
   `fatal: reference repository '/home/user/web-everything' is shallow` — `cloneLane` (in `we:scripts/lane-pool.mjs`) dies with a raw
   `execFileSync` throw. `we:docs/agent/vm-sessions.md` described shallow clones as merely "sharing nothing via
   `--reference`", which reads as a lost optimisation rather than a hard stop. Sibling clones fail the same
   way and are only warned about, so a lane provisions with no `frontierui`/`plateau-app` beside it.

Found while doing ordinary work on a VM (2026-08-24). Worked around by hand with
`git fetch --unshallow` on all three repos plus `LANE_POOL_ROOT=/home/user/.lanes`; both lanes then
provisioned cleanly, siblings and deps included, in ~30s — so the laptop-only reasoning the doc gave for
skipping the pool ("costs an `npm ci` and buys nothing") does not survive contact either.

## Done when

1. **Executable** — a unit test pins that the pool root is derived from the checkout's own location the way
   `we:scripts/guard-lane.mjs` derives its workspace, not from `homedir()`, so a `$HOME` that disagrees with the
   checkout parent resolves to the real one. `LANE_POOL_ROOT` stays the explicit override.
2. **Executable** — a unit test pins that `cloneLane` (in `we:scripts/lane-pool.mjs`) drops `--reference` (or uses `--reference-if-able`)
   when the reference repo is shallow, rather than passing a flag git rejects. A shallow reference must
   degrade to a plain clone, never a fatal.
3. **Executable** — the sibling-clone failure path is a reported drift the caller can act on, not a warn-and
   -continue that leaves a lane silently unable to build.
4. **Observed** — on a cloud VM, `we:scripts/lane-pool.mjs provision --count=2` succeeds with no env
   override and no manual `fetch --unshallow`, and `we:scripts/guard-lane.mjs` then admits an edit inside the lane.
5. `we:docs/agent/vm-sessions.md` no longer tells the reader to skip the pool. (Corrected ahead of this item in
   the #1537 lane; keep the two consistent.)
