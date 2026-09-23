---
bornAs: xpehezy
kind: story
size: 5
parent: "3383"
blockedBy: ["3866"]
humanGate: { kind: setup, what: "In GitHub (Settings → Developer settings → GitHub Apps → the fleet App): grant repository permissions Pull requests, Issues, Contents, Workflows = Read & write; Checks, Commit statuses, Actions = Read; then approve the new permissions on the installation and add web-everything, frontierui, plateau-app to its repository access. The code refuses to switch on until all of this is in place." }
status: open
scope: ["we:scripts/lib/github-app-auth-env.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-23"
tags: []
---

# Register a GitHub App and swap the fleet's gh/API auth layer to its installation token (per ratified #3866)

Implements ratified #3866 Fork 1(a): the fleet's `gh`/API calls authenticate as a GitHub App installation
(app-to-server, via its installation access token), drawing from the App's OWN rate-limit bucket instead of
the operator's personal one, falling back to today's personal-token path when no App is configured.

App registration and installation (GitHub's UI) is an operator action outside any agent's tool access —
done by the operator on 2026-09-22 (App ID 5037855, installation 163880042; private key held outside the repo,
chmod 600). This card is the code change.

## What changed from the original sketch — and why

The card as first filed put the swap INSIDE `we:scripts/lib/gh-throttle.mjs`. Two problems surfaced when
building it (2026-09-23, right after the operator's personal bucket was exhausted live by fleet load):

1. **Sync vs async.** The throttle's exec path is permanently synchronous (`execFileSync`-shaped, by design —
   see `we:scripts/lib/gh-throttle.mjs`'s own header). Minting an installation token is an async network
   call. Forcing a sync mint inside the throttle would mean shelling `curl` from inside the one module every
   other call's rate-limit safety depends on.
2. **It would never have reached the drain.** `we:scripts/merge-ai-prs.mjs` does not route any `gh` call
   through the throttle (confirmed by grep — zero references). A throttle-internal swap would have left the
   drain, one of the fleet's heaviest `gh` consumers, on the personal bucket.

So the ratified decision (which credential) stays exactly as #3866 ruled; the wiring moved. A shared on-disk
token cache (`we:scripts/lib/github-app-auth-env.mjs`) is refreshed ASYNC by each long-running process's own
bootstrap, and exposed as `process.env.GH_TOKEN` — which `gh` CLI honors ahead of its stored login, and which
EVERY subprocess (throttled or raw, and every agent a daemon dispatches) inherits by default. No call site
needed to change. The throttle module itself is untouched.

## Wired into (this card)

- `we:skills-src/conveyor/review-daemon.mjs` — refreshed at the top of every tick (`withGithubAppAuth`).
- `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs` — same.
- `we:scripts/merge-ai-prs.mjs` (the drain) — awaited once before any `gh` work, then at the top of every
  `--watch` pass.

Never on a background timer (the first version did this, live-caught 2026-09-23): a daemon tick's blocking
`execFileSync` calls starve the event loop, so a timer refresh stalled, and one caught mid-connection timed out
("fetch failed"). The drain's watch loop even sleeps with `sleepSync`, so a timer there would never fire.

Opt-in only: all three `WE_GITHUB_APP_ID` / `WE_GITHUB_APP_INSTALLATION_ID` / `WE_GITHUB_APP_PRIVATE_KEY_PATH`
env vars must be set, or nothing changes. A mint failure never throws — it logs and falls back to whatever
auth was already in effect.

## Deliberately NOT in this card (tracked, not forgotten)

- **The other daemons** — the Dispatcher (`we:skills-src/conveyor/runner.mjs`), the Verify daemon, and the
  `we:skills-src/conveyor/pass-daemon.mjs` watchers are not wired yet. Filed as its own follow-up.
- **`#3861`'s 78 raw `gh` call sites** are NOT a blocker for credential coverage: a raw `execFileSync('gh', …)`
  already inherits `process.env`, so it picks up `GH_TOKEN` exactly like a throttled call. #3861 remains a
  real, separate concern (burst throttling), unrelated to which account's bucket is spent.
- **Interactive/operator sessions** stay on the personal token on purpose — this separates the fleet's
  budget FROM the operator's, it does not move the operator.
- **Plain `git fetch`/`push`** uses git's own HTTPS credential helper, not the `gh` API quota, and is out of
  scope here.

## Progress

- **2026-09-23 — code built, tests green, live-probed.** Minting against the real App works (its own fresh
  5,000/hr bucket, 0 used, while the operator's personal bucket was exhausted). But the live probe found the
  installation was registered with **no repository permissions** (`{}`) and **no repositories selected** — the
  only thing that worked was reading the public web-everything repo. Applying that token would have broken
  every label, comment and merge, and every call to the two private repos.
- So the module now checks every fresh mint against the permissions and repos the fleet needs BEFORE using
  it, and refuses (staying on personal auth, logging exactly what to grant) otherwise — confirmed live against
  the real under-configured App. Switching on can never make the fleet worse off.
- **Deploy-time incident, same day, fixed.** The first live probe ran BEFORE the access check existed and wrote
  an unvalidated token to the shared cache. Cache hits skip re-validation by design, so both daemons picked it
  up on restart; the review daemon then got `HTTP 403 Resource not accessible by integration` on a label write.
  The bad cache was deleted and the daemons restarted; the old review-daemon process had been force-killed
  mid-call and left a stale lease, which was moved aside (owner pid confirmed dead). Lesson: a cache written
  by an older, laxer version of this module must not outlive the upgrade.
- **Remaining:** the operator's App-settings change (see `humanGate`), then set the three `WE_GITHUB_APP_*`
  env vars on the review daemon, fix-dispatch daemon and drain, then Done-when 3's live confirmation.

## Done when

1. **Executable** — `we:scripts/lib/__tests__/github-app-auth-env.test.mjs` shows a configured process reads
   a fresh cached token without minting, mints + writes back when the cache is missing or inside the refresh
   buffer, and sets `GH_TOKEN` from it.
2. **Executable** — the same file shows an unconfigured (or partially configured) process changes nothing,
   and a mint failure never throws and leaves `GH_TOKEN` untouched — today's personal-token path unchanged.
3. **Manual, documented** — the operator's real App credentials configured on the review daemon, fix-dispatch
   daemon, and drain; a live `gh` call from each confirmed to authenticate as the App installation, not the
   personal account.
