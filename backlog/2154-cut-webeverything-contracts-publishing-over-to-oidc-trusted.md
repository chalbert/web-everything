---
kind: task
status: open
blockedBy: ["907"]
relatedTo: ["877", "907"]
dateOpened: "2026-07-02"
tags: [npm, publishing, oidc, security, ci]
---

# Cut @webeverything/contracts publishing over to OIDC trusted publishing (drop the long-lived NPM_TOKEN)

The first publish (#907) is bootstrapped with a long-lived npm **automation token** stored as the
`NPM_TOKEN` GitHub Actions secret. That's the right way to get the package onto the registry the first
time, but it leaves a durable credential sitting in GitHub — something to leak, rotate, and scope. Once
`@webeverything/contracts` exists on the registry, cut publishing over to **OIDC trusted publishing** so
CI mints a short-lived, per-run credential from GitHub's OIDC identity instead — no stored token at all.

**Pure security hardening, not a blocker** — #907 already publishes **public with `--provenance`** using the
token (`we:.github/workflows/publish-contracts.yml`, #877), so provenance is live and nothing here gates a
release. This item only removes the long-lived credential. **Sequenced after #907**: npm trusted publishing
requires the package to already exist before a trusted publisher can be configured, so the first release
goes out on the automation token first.

## Human-gate (kind: setup) — npm package Settings

The cutover's key step is a dashboard action only the npm org owner can do:

- On npmjs.com → `@webeverything/contracts` → **Settings → Trusted Publisher**, register the publisher as
  repo `chalbert/web-everything` + workflow file `we:.github/workflows/publish-contracts.yml`.

## Agent-doable follow-up (once the trusted publisher is registered)

- Confirm `permissions: id-token: write` is set on the publish job (already required by `--provenance`;
  verify it's present, not just implied).
- Remove the `NODE_AUTH_TOKEN` / `secrets.NPM_TOKEN` wiring from `we:.github/workflows/publish-contracts.yml`.
- Delete the `NPM_TOKEN` GitHub Actions secret (`gh secret delete NPM_TOKEN --repo chalbert/web-everything`)
  and revoke the automation token on npm.
- Verify the next `contracts-v*` tag publishes cleanly with no token in scope.

Gate clears when a `contracts-v*` tag publishes via OIDC with `NPM_TOKEN` fully removed from the repo and revoked on npm.
