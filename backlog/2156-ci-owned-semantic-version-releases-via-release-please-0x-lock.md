---
kind: task
status: open
relatedTo: ["877", "907", "2138", "2152", "2154"]
humanGate: { kind: deploy, what: "release-please wiring is complete + verified end-to-end (Release PR #2 honored the 0.x lock). All remaining residuals are owner-gated, not agent-executable: pin/merge the first Release PR for a clean 0.1.0, the 1.0 graduation owner-go (flip the pre-major flags), and the credentialed npm publish of 0.1.0 (tracked in #2157)." }
dateOpened: "2026-07-02"
tags: [npm, publishing, ci, release-please, versioning, pr-flow]
scope:
  - we:release-please-config.json
  - we:.release-please-manifest.json
  - we:.github/workflows/release-please.yml
  - we:.github/workflows/publish-contracts.yml
  - we:contracts/package.json
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

## Verified still true, 2026-08-21

Re-read against the tree before writing criteria; every line of *Wired* above still holds:

- `we:release-please-config.json` carries both `bump-minor-pre-major` and `bump-patch-for-minor-pre-major` as
  `true`, with one package `contracts` (`release-type: node`, `include-component-in-tag: true`).
- `we:.release-please-manifest.json` reads `{"contracts": "0.1.0"}` — the baseline advanced past `0.0.0`, so the
  first release did cut.
- `we:contracts/package.json` is at `0.1.0` with `repository.url` pointing at `chalbert/web-everything`.
- The tag `contracts-v0.1.0` exists locally, and `we:.github/workflows/release-please.yml`'s inline publish job
  is gated `if: always() && needs.release-please.outputs.releases_created == 'true'`, with a repo health-gate
  step ahead of `Publish` — the coupling #2157 records as the reason npm never received the package.

So the *agent-executable* half of this item is complete and observable. What remains is only what the
`humanGate` already names.

## Done when

**This item cannot carry a tier-1 criterion, and the reason is structural, not a write-up gap.** Every residual
is a credentialed or owner-gated action — merging a Release PR, an `npm publish` with `NPM_TOKEN`, and the 1.0
graduation owner-go — none of which an agent can execute and none of which a test can stand in for. That is the
same fact its `humanGate: { kind: deploy }` already declares. The criteria below are therefore observables a
single cheap command settles, not judgments.

- **Tier 2** — the 0.x lock is intact and did not silently drift: `we:release-please-config.json` still has
  **both** pre-major flags `true`. Flipping either is the 1.0 graduation and must never be a side effect —
  `git log -p` on that file shows no unexplained change.
- **Tier 2** — the package is actually on the registry: `npm view @webeverything/contracts version` returns
  `0.1.0` (today it is an E404, per #2157). This is the one residual that closes the item; it is owner-gated on
  a credentialed publish, so it is an observation, not an agent task.
- **Tier 2** — versions agree across the three files that carry one: `we:.release-please-manifest.json`,
  `we:contracts/package.json`, and the newest `contracts-v*` tag all read the same version. A mismatch means a
  release half-landed.
- **Tier 3** — the multi-package residual has not become silently wrong: while `we:release-please-config.json`
  declares exactly one package, the publish job may stay gated on `releases_created`. Read the `if:` line in
  `we:.github/workflows/release-please.yml` — the moment a second `@webeverything/*` package is declared, that
  gate must move to the per-path `contracts--release_created` output or every package publishes on any release.
- **Tier 3** — the manual fallback still exists and is still reachable:
  `we:.github/workflows/publish-contracts.yml` is present with a `workflow_dispatch` trigger, which is the
  route #2157's recovery depends on.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — The card's central claims were verified against a real production run, not just re-read: we:.release-please-manifest.json reads {"contracts":"0.1.0"}, we:contracts/package.json is at 0.1.0 with repository.url corrected to chalbert/web-everything, the tag contracts-v0.1.0 exists in git history (commit 6b80064e "chore(main): release contracts 0.1.0", preceded by 63e1c0b2 wiring the workflow), and an independent `npm view @webeverything/contracts version` reproduces the E404 the card attributes to #2157. The 2026-08-21 re-verification section holds against the live tree.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The publish job's whole-repo `npm run check:standards` gate did fire broadly and block the first real publish (0.1.0 tagged but unpublished) — but git log on we:.github/workflows/publish-contracts.yml shows that exact gate step ("Repo health gate") predates this card (added under #877, commit 27182925); 2156 only replicates it inline in we:.github/workflows/release-please.yml. So the over-broad blast radius is inherited from base, not introduced here, and the card correctly tracks the fallout in #2157 rather than silently absorbing it.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Grepped for other ES/subprocess consumers of the five scoped files (we:release-please-config.json, we:.release-please-manifest.json, both workflow files, we:contracts/package.json) across scripts/, docs/, and .github/workflows/ — the only other hits (we:.github/workflows/update-visual-baselines.yml's GITHUB_TOKEN-recursion comment, we:scripts/lib/output-mix-paths.json's file-classification blurb) are documentation/commentary, not live dependents. we:backlog/2138-*.md and we:backlog/2152-*.md, cited as the PR-flow items this composes with, are both status: resolved, so there is no live overlapping-scope item to conflict with.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card doesn't just assert release-please works — it cites an actual end-to-end run (Release PR #2 opened and merged, tag cut, publish job fired) as the measurement, and separately measures that the remaining gap (npm publish) is credential-and-main-health gated, not agent-executable, which is why humanGate:{kind:deploy} is the declared stopping point rather than an unmeasured guess.

**Corrections recommended:**

- none — the preparation held up as written.

All five scoped files and both workflows verify cleanly against the live repo — the 0.x-lock config, manifest, corrected repository.url, the inline always()-gated publish job, and the demoted manual-fallback workflow all match the card's description, and the one open residual (npm publish still E404) is independently reproducible and already tracked in #2157, not silently absorbed by this card.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** Verdict High, no corrections owed; nothing to apply. The reviewer
independently reproduced the `npm view @webeverything/contracts version` E404 this card's exemption line rests
on, and separately established that the whole-repo health gate blocking the publish predates this item (it was
added under #877 on we:.github/workflows/publish-contracts.yml) — so the blast radius is inherited, not
introduced here, and #2157 remains the right owner. Two of its own citations needed `we:` prefixes to satisfy
#883; those were added by the driver.
