---
bornAs: x5ljiz4
kind: decision
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/", "we:scripts/conveyor/"]
dateOpened: "2026-09-22"
dateResolved: "2026-09-23"
codifiedIn: one-off
tags: []
---

# Decide the credential/token scoping model for the conveyor's daemonized processes

Daemonizing the conveyor runner (epic #3383, see #3860 and its sibling slices) splits one process into several long-lived ones. Today every mechanical pass inherits the SAME operator environment and GH credential; no mechanism exists to give one daemon (e.g. a read-only watcher) a narrower credential than another (e.g. the Fix-dispatch or Review daemon, which can spawn agents and post to PRs). This is an open design fork, not a code gap: options include a GH App with per-daemon-role installation tokens, fine-grained personal-access tokens scoped per role, or accepting today's full-environment inheritance as the status quo (unchanged, not worsened, by the split itself) until a real incident forces the question. Explicitly carved out of #3860's build slices per this repo's split-safety rubric (a slice cannot bury an unresolved decision) -- filed here as its own decision so it can be prepared and ratified on its own timeline without blocking any of #3860's sibling build slices, none of which depend on it landing first.

## Superseded by #3866 (2026-09-23)

This card and #3866 ask the same question — which GitHub identity the fleet's automation authenticates as.
#3866 was filed a day earlier, fully prepared (grounded against GitHub's own rate-limit docs, skeptic-attacked,
screened) and ratified by the operator on 2026-09-22: **Fork 1(a), a GitHub App installation token,
app-to-server**. Its build story is #3881. This card was never prepared and adds no fork #3866 does not
already rule on, so it closes here rather than sit as a second, stale open decision on the same turf.

The one angle this card names that #3866 does not — a NARROWER credential per daemon role (e.g. a read-only
watcher vs. a daemon that posts to PRs) — is not lost: a single App installation's permissions are set once
at the App level, so per-role narrowing would mean multiple Apps. Nothing today motivates that; revisit only if
a real incident does.

## Done when

1. **Observable** — `grep -l '^## Superseded by #3866' backlog/3872*.md` lists this card.
