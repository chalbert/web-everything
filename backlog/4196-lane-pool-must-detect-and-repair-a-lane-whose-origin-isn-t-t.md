---
bornAs: xxmkpwu
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
tags: []
---

# lane-pool must detect and repair a lane whose origin isn't the canonical remote

lane-11's origin remote is a local folder path (the operator's own primary checkout), not the canonical GitHub remote every other lane and the primary checkout use (git@github.com:chalbert/web-everything.git, matching we:scripts/lib/constellation-repos.mjs#CONSTELLATION_REPOS.we.slug) — confirmed live 2026-09-25 (git -C <lane-11> remote get-url origin). we:scripts/lane-pool.mjs's status/acquire/refresh paths only check that an origin URL EXISTS (tryGit(['remote','get-url','origin'], ...)), never that it MATCHES the expected canonical remote, so a lane like this silently fetches/pushes against the wrong target forever. Make lane-pool detect a lane whose origin differs from the canonical remote (status flags it; acquire/refresh refuses or repairs it via git remote set-url origin <canonical>).

## Done when

1. **Executable** — a test with a fixture lane whose origin is set to an arbitrary non-canonical URL shows `we:scripts/lane-pool.mjs status` flagging it, and `acquire`/`refresh` either refusing it or repairing its origin to the canonical remote — fails before this lands (today it is silently accepted) and passes after.
2. **Live proof** — before: `git -C /Users/nicolasgilbert/workspace/.lanes/web-everything/lane-11 remote get-url origin` prints the local-folder path, and `node we:scripts/lane-pool.mjs status --json` reports lane-11 as healthy. After the fix runs against the real pool: lane-11's origin is either flagged or repaired to `git@github.com:chalbert/web-everything.git`, matching every other lane.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
