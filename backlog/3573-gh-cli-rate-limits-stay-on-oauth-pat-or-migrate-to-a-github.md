---
bornAs: xnvjq2r
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-07"
tags: [infra, gh, rate-limit, cost, decision]
---

# gh CLI rate limits: stay on OAuth/PAT or migrate to a GitHub App installation token?

gh CLI in this repo authenticates via a GitHub OAuth token through the keyring (`gh auth status`: account chalbert, scopes admin:public_key/gist/read:org/repo). Checked live 2026-09-07: `gh api rate_limit` core bucket is 5000/hr, 0 used. we:scripts/conveyor/infra-blocked.mjs already reactively retries on rate-limit/abuse-detection errors (classifyPrOpenFailure), confirmed working, with unit test coverage — but no log evidence found of an actual rate-limit exhaustion event ever firing it; the retry path exists pre-emptively. Researched whether a GitHub App migration is a real upgrade, verified against GitHub's own current REST API rate-limit docs (2026-09-07): installation access tokens use the SAME 5,000/hr base as a PAT/OAuth token, but scale +50/hr per repository over a 20-repo threshold and +50/hr per organization-user over a 20-user threshold, capped at 12,500/hr — this scaling applies even to an installation on a personal (non-org) account, not only organizations. `gh api users/chalbert/repos --paginate` counts 36 public repos on this account, so an installation here would land near roughly 5,800/hr (16 repos over the 20-repo floor x 50/hr) — about +16% over the flat PAT/OAuth limit, far short of the 12,500 cap since there is no organization to add the +50/user side. Migrating is a real, non-trivial auth-plumbing change: registering a GitHub App, installing it, and swapping every gh-calling script (we:scripts/conveyor/*.mjs, we:scripts/operations/*.mjs, we:scripts/lib/review-label-provider.mjs, and more) from the long-lived OAuth token to short-lived (1hr) minted+refreshed installation tokens — a wide, security-sensitive surface, for a modest, unconfirmed-as-needed headroom gain.

Fork — what to do about it: (a) do nothing now: the existing reactive retry already covers the rare case and a 16% headroom gain isn't worth the auth-surface churn absent evidence of real exhaustion; (b) migrate to a GitHub App now, for the headroom plus the option value of tighter, per-installation-scoped permissions than the current broad OAuth scopes; (c) instrument first — log `gh api rate_limit`'s remaining/used figures on every infra-blocked retry trip (cheap, no auth-surface change) and revisit migration only if real usage data shows sustained pressure.

Recommended default: (c), falling through to (a) unless the data says otherwise — there is no evidence of a live bottleneck tonight, and (b)'s realistic gain for this specific repo's shape (36 repos, no org) is modest, not the 2.5x figure a larger org install would see. This is a genuine infra fork with real migration cost and risk — it should be ratified by the operator, not defaulted into.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
