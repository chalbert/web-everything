---
kind: task
status: open
relatedTo: ["877", "907", "2138", "2152", "2154"]
dateOpened: "2026-07-02"
tags: [npm, publishing, ci, release-please, versioning, pr-flow]
---

# CI-owned semantic-version releases via release-please (0.x-locked, no auto-major)

The merge-PR flow owns versioning, not a human running `npm version` + pushing a tag. Wired **release-please**
(manifest-driven, `googleapis/release-please-action@v4`) so every push to `main` maintains a Release PR that
accumulates the pending bump + CHANGELOG from Conventional Commits; merging it tags `contracts-v*`, cuts a
GitHub Release, and publishes.

## Wired (2026-07-02)

- `we:release-please-config.json` — `bump-minor-pre-major: true` + `bump-patch-for-minor-pre-major: true`
  (the **0.x lock** — breaking → minor, feature → patch, nothing auto-crosses to 1.0.0, per owner). Package
  `contracts`, `release-type: node`, `include-component-in-tag` → `contracts-v<version>` tags.
- `we:.release-please-manifest.json` — baseline `contracts: 0.0.0` (nothing released yet).
- `we:.github/workflows/release-please.yml` — the action + an inline `publish` job gated on
  `releases_created` (public + provenance, `NPM_TOKEN`). Inline because release-please tags with the default
  `GITHUB_TOKEN`, which does not trigger the tag-triggered `we:.github/workflows/publish-contracts.yml`
  (GitHub suppresses that to avoid recursion); `we:.github/workflows/publish-contracts.yml` stays as the
  manual fallback.
- Fixed `we:contracts/package.json` `repository.url` → `chalbert/web-everything` (provenance rejects a
  repo-URL mismatch against the building repo).
- **Repo setting (one-time, per repo):** enabled *Allow GitHub Actions to create and approve pull requests*
  (`can_approve_pull_request_reviews: true` via `gh api -X PUT /repos/chalbert/web-everything/actions/permissions/workflow`).
  Without it release-please fails with "GitHub Actions is not permitted to create or approve pull requests"
  even though the workflow grants `pull-requests: write` — the repo-level toggle overrides. **FUI and Plateau
  will need the same toggle** when they adopt release-please.
- Verified end-to-end (2026-07-02): push → release-please opened Release PR #2 "release contracts 0.1.0"
  (0.x lock honored). Merging that PR tags `contracts-v0.1.0` and fires the publish job.

## Residuals

- **First release:** pin to `0.1.0` via a `Release-As: 0.1.0` footer on the bootstrapping commit for a clean
  first version (else pre-major rules make it `0.0.1`). Then merge the first Release PR.
- **1.0 graduation is manual** — never without explicit owner go, and not until go-public. Flip the
  pre-major flags off at that point.
- **Multi-package:** when a second package (`@webeverything/*` sibling) lands, switch the publish gate from
  `releases_created` to the per-path `contracts--release_created` output so only the changed package
  publishes.
- **PR-flow coupling:** the end-to-end "merge Release PR → release" rides on the branch-protection / PR-merge
  landing flow (#2138/#2152); release-please's tag/Release creation via `GITHUB_TOKEN` needs
  `contents: write` (set) and does not push to protected `main`, so it composes.
- **OIDC:** dropping `NPM_TOKEN` for trusted publishing is optional later hardening (#2154).

## First release lagging — tracked in #2157

0.1.0 was tagged (Release PR #2 merged) but **npm publish never ran**: the publish job's whole-repo
`check:standards` was red from unrelated backlog debt on `main`. Owner kept the gate as-is (2026-07-02), so
publishing is blocked until `main` is reliably green via the PR-lane merge flow (#2138/#2152). Full state +
recovery steps (incl. the auto-lock-on-merge race) live in #2157.
