---
kind: story
size: 3
parent: "2289"
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
graduatedTo: none
tags: []
---

# Lane provisioning must refresh a stale clone to origin/main before scaffold/claim — a behind-main lane mints colliding/low-gap NNNs from a pre-#2288 allocator

Observed 2026-07-07: a pool lane handed out **19 commits behind origin/main** ran its *stale* `we:scripts/backlog.mjs` — the pre-#2288 "next free NNN" allocator — and minted **#119** (a low free-gap) and a **colliding #2259** for two new scaffolds; both were wrong and had to be discarded, and only a manual `git reset --hard origin/main` flipped the lane to the correct #2288 hash-birth (`2319`, `2320`). Root cause: `we:scripts/lane-pool.mjs` can lease a clone whose checkout (and therefore whose `scripts/`) predates a landed change, so an item-mutation runs **old code** against a **stale backlog view**. Fix: provisioning must `fetch` + fast-forward/reset the leased clone to `origin/main` **before** any `scaffold`/`claim` (or the mutation must refuse on a behind-main HEAD and tell the caller to refresh). Distinct root cause from `2319` (a hash reaching main) and #2267 (don't hard-reset a *dirty* lane) — here the lane is clean but *behind*. A stale-lane guard also protects every other lane-run CLI, not just numbering. relatedTo #2288, #2267, #2275, #2289.

**Resolution:** `we:scripts/lane-pool.mjs`'s `acquire` already fetches + hard-resets the leased lane to `origin/<branch>` by default (landed with #2275, before this incident's fix point) — so the *acquire* path was not the residual hole. The actual gap was that `we:scripts/guard-bash.mjs`'s existing lane-vs-primary backlog-mutation guard (#2302) only checked *"is this cwd a lane clone"*, never *"is this lane's HEAD current"* — so a human/agent that `cd`s straight into an already-cloned-but-not-freshly-acquired lane (e.g. resuming a stale session across days, or a lane pool provisioned before a later `main` landed) could still run `claim`/`scaffold`/etc against stale `scripts/`. Added a second, orthogonal check: the CLI wrapper now computes commits-behind-upstream (`git rev-list --count HEAD..@{u}`, impure, gated to only run when cwd is a lane AND the command is a backlog mutation) and `reason()` denies the mutation when `staleBehind > 0`, telling the caller to `git fetch && git reset --hard origin/main && git clean -fd` first (sanctioned override `STALE_LANE_OK=1`). This protects every lane-run backlog mutation, not just NNN allocation, per the item's ask. Unit-tested in `we:scripts/__tests__/guard-bash.test.mjs` (pure `reason()`/`isLaneCwd` cases; the git-call itself is the thin impure CLI boundary, consistent with how `primaryCwd` is already handled).
