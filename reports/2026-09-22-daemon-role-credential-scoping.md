# Daemon-role credential scoping — prior-art + fork prep for #3872

**Date**: 2026-09-22
**Point**: fine-grained PATs per daemon role are the pragmatic near-term default (zero code change, reuses the
`GH_TOKEN` env-var precedence `gh` already honors); GitHub Apps are the correctness-grade upgrade, deferred until
a real incident or an infra change (leaving the single-operator laptop) raises the stakes enough to justify the
minting-step engineering cost.
**Plan file**: n/a (dispatched directly from `we:backlog/3872-decide-the-credential-token-scoping-model-for-the-conveyor-s.md` via `/prepare`, no `plans/` inbox file)
**Research page**: `/research/daemon-role-credential-scoping/`

---

## Question

Daemonizing the conveyor runner (epic #3383) turned one process into several long-lived ones, each spawned by its
own `launchd` agent. Today every daemon inherits the SAME GitHub credential the operator's shell already has —
should a read-only watcher daemon get a narrower credential than a write-capable one (Fix-dispatch, Review), and
if so, via what real mechanism?

## Recommendation

Adopt fine-grained personal access tokens, one per daemon role (read-only watchers vs write-capable
Fix-dispatch/Review), wired via each daemon's own `launchd` plist `EnvironmentVariables` dict (which already
carries `PATH` today — a `GH_TOKEN` entry is one more line, no code change). Reserve GitHub Apps (per-installation
scoped, hour-lived tokens) as the upgrade path once a concrete trigger fires. Full fork writeup with the skeptic
and screen passes lives on the item itself.

## Key findings

1. **Status quo, confirmed by direct read.** `gh auth status` shows one OAuth token (`gho_…`, `repo`+`workflow`+
   `read:org`+`gist` scopes) on a personal account (`chalbert`, not an org). `we:scripts/lib/gh-throttle.mjs`'s
   `runGhSync` wraps `execFileSync('gh', args, opts)` with `opts` passed through unchanged — no credential
   injection point exists in the wrapper today. `~/Library/LaunchAgents/com.we.review-daemon.plist`'s
   `EnvironmentVariables` dict sets only `PATH`.
2. **GitHub Apps** mint hour-lived installation tokens narrowable per-mint to a `permissions` subset and a
   `repositories` list (up to 500) — but `gh` CLI has no native App auth (confirmed via `cli/cli` discussions
   #5081/#5095/#8747); every workaround mints the token out-of-band and feeds it to `gh` via `GH_TOKEN` anyway,
   which means real code (a minting step/dependency) added to every daemon or a shared broker.
3. **Fine-grained PATs** are scoped to specific repos + one of 50+ granular permissions at creation, expire in
   1–366 days (personal account, no non-expiring option), and slot straight into the existing `GH_TOKEN`
   env-var-precedence mechanism `gh`'s own docs confirm (`cli.github.com/manual/gh_help_environment`) — zero code
   change, at the cost of manual rotation.
4. **No existing statute anchor governs this.** `we:docs/agent/platform-decisions.md`'s only credential/token/blast-radius
   hits are about PR-review care levels and design tokens — nothing rules GitHub credential custody today, so this
   decision creates new statute rather than reconciling an old one.

## Files created/modified

| File | Action |
| --- | --- |
| `we:src/_data/researchTopics/daemon-role-credential-scoping.json` | created — registry entry |
| `we:src/_includes/research-descriptions/daemon-role-credential-scoping.njk` | created — full write-up |
| `we:backlog/3872-decide-the-credential-token-scoping-model-for-the-conveyor-s.md` | rewritten to the prepared-fork shape |
| `we:reports/2026-09-22-daemon-role-credential-scoping.md` | this report |
