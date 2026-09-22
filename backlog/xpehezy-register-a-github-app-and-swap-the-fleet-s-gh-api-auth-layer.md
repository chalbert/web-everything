---
kind: story
size: 5
parent: "3383"
blockedBy: ["3866"]
status: open
scope: ["we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Register a GitHub App and swap the fleet's gh/API auth layer to its installation token (per ratified #3866)

Implements ratified #3866 Fork 1(a): swap we:scripts/lib/gh-throttle.mjs's auth source from a personal PAT/OAuth token to a GitHub App installation access token when configured, minting and refreshing it as needed, falling back to today's PAT/OAuth path when no App is configured. App registration and installation (GitHub's UI) is an operator action outside any agent's tool access and is not this card's scope — this is the code change only. A live probe against real App credentials cannot run here; it is a documented manual operator step, not an automated Done-when.

## Not in this decision

Registering the GitHub App itself — creating it in GitHub's UI and installing it on the org/repos — is an operator action outside any agent's tool access. This card's scope is the CODE change only (minting/refreshing installation tokens, swapping `we:scripts/lib/gh-throttle.mjs`'s auth source), never the registration step.

## Done when

1. **Executable** — a test of `we:scripts/lib/gh-throttle.mjs` shows the wrapper reads an installation-token source when configured (mints/refreshes an installation access token) and passes.
2. **Executable** — a second test shows the wrapper falls back to today's PAT/OAuth path when no installation-token source is configured, unchanged from current behavior.
3. **Manual, documented (not automated)** — a live probe against the operator's real App credentials, run by the operator once the App is registered and installed; this card names it as a manual follow-up step, not a Done-when this card's own tests can satisfy.
