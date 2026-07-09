---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# Selector must fetch-and-exclude before ranking: autostash-ff dirty trees, hard-stop stale --select, drop items with an open PR

**Root cause (2026-07-08 mis-pack):** `/batch` offered a pack of items whose PRs were **already open — several
already merged+closed** by the time they were surfaced. Two independent gaps in `we:scripts/check-readiness.mjs`
let that through:

1. **The staleness guard skipped a dirty tree.** The #2204 guard fetches then only auto-fast-forwards a *clean*
   tree (`classifyStaleness`'s `!dirty` gate), yet the pull it runs is `git pull --ff-only --autostash` —
   `--autostash` exists precisely to carry a dirty tree across a fast-forward. So the working tree (a modified
   `we:capacity.json`) fell into warn-only and the ranker read a **stale** local `main`.
2. **Nothing excluded items that already have an open PR.** An item with an open PR is producer-complete
   (resolved in its lane, waiting on the drain). The selector had no notion of PR state, so it re-offered them.

## What was built

- **`we:scripts/lib/main-staleness.mjs`** — `classifyStaleness` now auto-ffs any **non-diverged** tree, dirty or
  clean (the `--autostash` pull handles the dirty case; a failed autostash-ff falls back to a warn). Only a
  *diverged* tree (local commits ahead) is warned, never touched.
- **`we:scripts/check-readiness.mjs`** — `--select` / `--json` now **hard-stop (exit 3)** when staleness stays
  unresolved after the guard (diverged, or a failed ff), instead of ranking against a stale tree. `--allow-stale`
  overrides (known-offline / deliberately-diverged). Passive read views still only warn.
- **`we:scripts/lib/open-pr-items.mjs`** (new) — lists open PRs via `gh` and maps each to the backlog item
  number(s) it lands (lane `head` ref + `#NNN` title, date-prefix-aware). Fail-soft (no gh/offline → skip). The
  CLI boundary drops those items from every selection surface, mirroring the prepare-hold `dropHeld`. Opt-out
  `--no-pr-scan`; skipped under `--no-fetch`.

Both new libs are pure-core + injected-IO and unit-tested (`we:scripts/lib/__tests__/`).

## Acceptance

- A dirty-but-not-diverged local `main` behind origin is autostash-fast-forwarded before ranking (not warned).
- `check-readiness --select` against an un-syncable stale tree exits non-zero; `--allow-stale` forces past it.
- An item with an open PR never appears in `--select` / the batch pack.
- `gh` absent or offline never hard-fails the ranker (fail-soft).
