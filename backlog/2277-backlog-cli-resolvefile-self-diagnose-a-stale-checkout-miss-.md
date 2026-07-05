---
kind: task
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-04"
dateResolved: "2026-07-04"
tags: []
---

# backlog CLI resolveFile: self-diagnose a stale-checkout miss before dying not-found

When a named backlog item resolves to no local file, resolveFile() in we:scripts/backlog.mjs:129 dies with a flat 'no backlog item #NNN on disk' — identical whether the item genuinely does not exist or the checkout is merely behind origin. A stale-checkout miss (the common case for a just-scaffolded item that landed on origin) then sends the agent down a wrong-premise path instead of a git pull. Fix, scoped to the not-found death path ONLY (happy path stays fully offline per Rule #105): git fetch origin main, check whether the padded NNN exists under the backlog dir on the fetched ref; if it exists on origin, die with 'exists on origin/main but not your checkout — you are N behind; run git pull --ff-only and retry'; else keep the current does-not-exist error. Lives in the shared resolveFile so claim/resolve/release all inherit it — a general gate, not a per-skill check. Note the existence-vs-ownership distinction so it does not read as a Rule #105 violation.

## Progress
- **Status:** done (in lane).
- **Done:** added `missingItemMessage(padded)` in we:scripts/backlog.mjs feeding `resolveFile`'s no-local-match branch. On the not-found death path only it `git fetch --quiet origin main`, checks `git ls-tree FETCH_HEAD backlog/` for a `backlog/<padded>-` entry, and if present dies with `#NNN exists on origin/main but not your checkout … git pull --ff-only` (plus an "N commit(s) behind" suffix when `HEAD..FETCH_HEAD` > 0); otherwise the original plain "not on disk" error. All git calls are best-effort (offline/no-remote → plain message). Happy path unchanged: resolves purely from local `files()`, fully offline (Rule #105 preserved — this is an existence probe, not an ownership check).
- **Verified:** (1) nonexistent `#9999` → plain error after fetch; (2) a real origin item hidden locally → enriched "exists on origin/main" message; working tree restored clean afterward.
- **Next:** gate → resolve → PR.

