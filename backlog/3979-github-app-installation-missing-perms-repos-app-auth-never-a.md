---
bornAs: x8mpubm
kind: task
parent: "3383"
status: open
scope: ["we:scripts/lib/github-app-auth-env.mjs", "we:scripts/conveyor/github-app-status.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# GitHub App installation missing perms/repos — App auth never applies, fleet silently uses personal gh auth

Live-caught 2026-09-23 investigating plateau-app PR #181's review session failure (`GraphQL: API rate limit already exceeded for user ID 760299` — the operator's own personal GitHub account, not the App). Root cause: the GitHub App installation #3881 registered (App id 5037855, installation id 163880042) has never actually been granted the permissions or repository access `we:scripts/lib/github-app-auth-env.mjs#REQUIRED_APP_PERMISSIONS`/`REQUIRED_APP_REPOS` require. `ensureFreshGithubAppEnv`'s fail-safe check (added same day, for exactly this failure mode — see its own docblock and `THE LIVE CASE` test) correctly refuses to apply an under-scoped token and leaves `GH_TOKEN` unset — but that means it has NEVER once applied since the App was registered: `~/workspace/wev-review-daemon/.conveyor/review-daemon.log` shows `insufficient-access` on every tick, every permission AND all three repos reported missing, every time. Consequence: every `gh` call fleet-wide — the daemon's own ticks AND every session `we:scripts/operations/review-dispatch.mjs`/`we:scripts/conveyor/reconcile-fix-dispatch.mjs` spawns via `claude --bg` (which inherits `process.env` at spawn with no explicit override, confirmed by direct read of `we:scripts/operations/dispatch-lane-io.mjs#defaultSpawnAgent` and `we:scripts/operations/review-pr-io.mjs#ghPrView`) — has been silently drawing on the operator's own personal `gh auth login` credential this whole time. This is NOT the "spawned session doesn't inherit the env" bug the review-dispatch/fix-dispatch wiring was suspected of; that wiring and the inheritance are both correct. The gap is that this fail-closed degradation is invisible: it only ever surfaces as raw text in a daemon log nobody watches, until a rate-limit incident like PR #181's makes it visible the hard way.

Two owed things, sequenced:
1. **Operator action (github.com, not code, not doable from an agent session — never touch the private key)**: on the App's settings, grant the 8 `REQUIRED_APP_PERMISSIONS` (metadata:read, pull_requests:write, issues:write, contents:write, workflows:write, checks:read, statuses:read, actions:read) and select the 3 constellation repos (chalbert/web-everything, chalbert/frontierui, chalbert/plateau-app) for installation 163880042, then approve the resulting permission-request if GitHub prompts one.
2. **Code (this item)**: make the fail-closed state observable so it can never again silently persist through a whole incident unnoticed. `ensureFreshGithubAppEnv` now also records its outcome (`applied`, `reason`, `missingPermissions`, `missingRepos`, `checkedAt`) to a small status file beside the token cache, and a new `we:scripts/conveyor/github-app-status.mjs` reads it back and prints a plain-language status plus the exact remediation steps when it is not applied — one command an operator (or a future monitoring skill) can run instead of grepping a daemon's raw log.

## Progress

Code (owed thing 2, above) done in this PR: `we:scripts/lib/github-app-auth-env.mjs#ensureFreshGithubAppEnv` now records `{applied, reason, missingPermissions?, missingRepos?, checkedAt}` to a status file beside the token cache on EVERY path (including `not-configured`), via a new best-effort, atomic, never-throwing `writeStatusFile` — a caller that does not pass `statusPath`/`writeStatus` sees byte-identical behavior to before (existing tests, unmodified, still pass). `we:scripts/conveyor/github-app-status.mjs` is the new one-command reader: `formatGithubAppStatus` (pure, fully unit-tested) renders it as a plain-language report naming the exact permissions/repos still missing, and the CLI exits non-zero on anything but a confirmed `applied:true` so it doubles as a scriptable health check. 45 new/updated tests pass (`we:scripts/lib/__tests__/github-app-auth-env.test.mjs`, `we:scripts/conveyor/__tests__/github-app-status.test.mjs`); `check:standards` is clean on both new files.

Owed thing 1 (the operator's github.com action — grant the 8 permissions and select the 3 repos on installation 163880042) is NOT done and cannot be done from this session (never touches the private key, no browser). Until it is, `we:scripts/conveyor/github-app-status.mjs` will keep correctly reporting `NOT APPLIED — insufficient-access` — that is the intended, now-visible behavior this item set out to produce, not a residual bug. Left `status: open` rather than resolving: the card's own title ("App auth never applies") stays true until the operator acts, and resolving it now would misrepresent that as fixed.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/github-app-auth-env.test.mjs we:scripts/conveyor/__tests__/github-app-status.test.mjs` passes (proves the code half). The card's own title is true only once `node we:scripts/conveyor/github-app-status.mjs` also prints `APPLIED` — which additionally requires the operator to have granted installation 163880042 the permissions and repos named above on github.com; this item cannot do that step for itself.
