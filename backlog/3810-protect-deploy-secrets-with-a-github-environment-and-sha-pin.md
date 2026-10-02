---
bornAs: xmb28f4
kind: story
size: 2
status: open
scope: ["plateau:.github/workflows/deploy.yml", "plateau:scripts/deploy-config.test.mjs", "plateau:docs/alpha-deploys.md", "we:.github/workflows/deploy.yml", "we:scripts/__tests__/deploy-security.test.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-10-02"
preparedAgainstSha: "32240fa1b0c13d0c848b496fa295be97892e1390"
tags: []
---

# Protect deploy secrets with a GitHub environment and SHA-pin third-party Actions

Protect production deploy credentials with a GitHub `production` environment restricted to the branch `main`, and replace mutable Action tags with verified full commit SHAs. Both deploy jobs still lack an environment: we:../plateau-app/.github/workflows/deploy.yml:118-129 and we:.github/workflows/deploy.yml:80-100. This remains work to deliver; preparation changes only this card.

## Progress

Prepared against WE `32240fa1b0c13d0c848b496fa295be97892e1390` and Plateau `5e483a481602a512aaa9aacecac1118203a7b965`. Paths beginning `we:../plateau-app/` denote the Plateau source inspected in the primary checkout; machine-readable scope retains the canonical `plateau:` locus.

- **Old premise:** three Plateau repository secrets, mutable Action tags, and an identical WE gap; scope named only two workflows. **Corrected:** Plateau also supplies `WIP_PUBLISH_TOKEN`, the account ID and the sibling read token (we:../plateau-app/.github/workflows/deploy.yml:27-35, :149, :176-202, :264-269). WE consumes the sibling read token, Cloudflare token and account ID (we:.github/workflows/deploy.yml:164, :192-193); do not invent WE gate-secret uploads from Plateau's behavior. Plateau explicitly documents the distinction at we:../plateau-app/.github/workflows/deploy.yml:34-35.
- **Old wording overstated an observed exploit.** The workflows establish secret references, not their storage scope or successful exfiltration. Read-only GitHub metadata probes during preparation found only `alpha` in Plateau's environments, no WE environments, and Plateau repository secret names `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `FUI_READ_TOKEN`, `GATE_CODE`, `GATE_COOKIE_SECRET`, `WIP_PUBLISH_TOKEN`. Commands: `gh api repos/chalbert/plateau-app/environments`, `gh api repos/chalbert/web-everything/environments`, and `gh api repos/chalbert/plateau-app/actions/secrets` (names only). No secret values were read and no attack workflow was run. The branch-workflow exposure is also acknowledged in we:../plateau-app/docs/alpha-deploys.md:50-53.
- **Existing defenses stay:** Plateau's separate admission job checks the main tip/latest test and supports break-glass; the deploy job retains admitted-job concurrency and credential-free checkout persistence (we:../plateau-app/.github/workflows/deploy.yml:70-151). WE already checks same-repository push admission, ancestry and latest required checks with break-glass (we:.github/workflows/deploy.yml:91-148). An editable workflow guard does not replace server-enforced secret release policy.
- **Corrected scope:** add Plateau's existing deployment regression suite and its production-secret limitation documentation, which must change with the cutover; add a dedicated WE deployment regression suite (proposed new file). Existing Plateau assertions are at we:../plateau-app/scripts/deploy-config.test.mjs:51-114 and its test discovery includes these files at we:../plateau-app/vitest.config.ts:31.

## Design

1. Configure `production` separately in each repository with selected deployment branches: branch `main` only, no tag rule. Bind the secret-bearing deploy job to that environment; keep Plateau's admission job secret-free. A YAML environment name alone is insufficient: configure the GitHub policy and migrate credential storage too. GitHub matches the run ref, not an arbitrary checkout SHA, so retain all existing artifact admission checks. See [GitHub environment rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
2. Move Plateau's `CLOUDFLARE_API_TOKEN`, `GATE_CODE`, `GATE_COOKIE_SECRET`, and `WIP_PUBLISH_TOKEN` to `production`; keep the account ID there as the same named secret to preserve existing inputs. For WE, migrate the Cloudflare token/account ID. Remove repository-level copies and audit applicable organization secrets for an alternate source of the same production credentials. Provision values through the authorized secret owner; GitHub cannot return existing secret plaintext. Keep the current production values so Worker cookies and laptop publishing continue working. Pause deploys during cutover; do not call the protection complete while repository copies remain.
3. Preserve `alpha` isolation and its distinct secrets (we:../plateau-app/docs/alpha-deploys.md:33-59). `FUI_READ_TOKEN` is a shared read-only checkout credential, not a production deploy credential; leave its existing CI availability unchanged, documenting that this item does not protect all repository secrets (we:../plateau-app/.github/workflows/deploy.yml:28, :149).
4. Pin every external `uses` in each production workflow, including checkout, setup-node and wrangler-action, to a verified 40-character upstream commit with a readable release comment. Current Plateau sites are we:../plateau-app/.github/workflows/deploy.yml:134, :140, :146, :153, :187; WE sites are we:.github/workflows/deploy.yml:155, :161, :167, :190. Resolve release-to-commit provenance during implementation; do not guess SHAs. Preserve Wrangler `4.106.0` (we:../plateau-app/.github/workflows/deploy.yml:202; we:.github/workflows/deploy.yml:197). Dependabot may maintain pins later; tag-update automation is not an immutable pin. See [GitHub secure Action use](https://docs.github.com/en/actions/reference/security/secure-use).
5. Break-glass remains an artifact-admission override, never an environment-policy bypass. A branch dispatch cannot acquire production secrets even with break-glass. Do not silently add a branch exception to preserve that old capability; any request for one needs an explicit decision. Main-triggered normal deployment must still work. This change does not claim to make checked-out sibling code reproducible (the current gap is documented at we:../plateau-app/.github/workflows/deploy.yml:37-38).

### Proposed per-repo delivery split (#4289)

Retain the complete mixed scope in this preparation; do not disguise it as a single-repo build. Before dispatch, split into two independently useful deliveries, with their own lane, tests, environment cutover and PR. No contract dependency exists between these workflows, so no artificial `blockedBy` edge is needed:

- **Plateau slice (retain #3810 when the split is authored):** we:../plateau-app/.github/workflows/deploy.yml, we:../plateau-app/scripts/deploy-config.test.mjs and we:../plateau-app/docs/alpha-deploys.md. Acceptance: Plateau production credentials are environment-only, branch dispatch cannot obtain them, pins are immutable, normal deploy and all existing live probes pass.
- **WE slice (proposed new card, not created here):** we:.github/workflows/deploy.yml and proposed we:scripts/__tests__/deploy-security.test.mjs. Acceptance: WE Cloudflare credentials are environment-only, branch dispatch cannot obtain them, pins are immutable and the verified-main deploy succeeds. Store setup and evidence in that future card plus workflow comments.

This applies the operator's per-repo decomposition direction while preserving coupled delivery as a supported future capability. Ruling lineage: we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:18-20. Standing per-repo capability/gate rule: we:docs/agent/platform-decisions.md:5511-5533, anchor `#conveyor-multi-repo-model`. No split cards or dependency metadata are authored in this card-only task.

## MVP

Implement just the production environment bindings, verified Action pins, regression coverage, and the documented credential cutover for each slice. Update workflow setup comments and Plateau's production-secret limitation. Preserve admission, permissions, concurrency, checkout refs, existing gate-secret presence checks, live privacy/publish probes and post-deploy smoke separation (we:../plateau-app/.github/workflows/deploy.yml:174-269). Do not extend the pinning campaign to unrelated workflows or change runtime code.

## Test plan

- Extend we:../plateau-app/scripts/deploy-config.test.mjs with parsed-YAML assertions for `jobs.deploy.environment` resolving to `production`, no production environment or deploy-secret access in `admit`, and full SHA pins on every external Action reference. Retain the existing assertions at :81-114.
- Add proposed we:scripts/__tests__/deploy-security.test.mjs with equivalent environment/pin checks and preservation checks for same-repo push admission, candidate SHA checkout and required-check enforcement (we:.github/workflows/deploy.yml:91-159). Do not reuse we:scripts/__tests__/workflow-invariants.test.mjs:2-5, which tests backlog workflow rules, not GitHub deployment security.
- Mutation-probe the assertions: remove/misspell the environment, replace one SHA with a tag, or remove an admission predicate; each must fail with a named invariant. Test the real YAML as well as negative fixtures. Syntax tests cannot prove remote environment configuration or credential migration.
- Executable acceptance commands, run in the owning checkout: Plateau `npx vitest run` filtered to we:../plateau-app/scripts/deploy-config.test.mjs; WE `npx vitest run` filtered to we:scripts/__tests__/deploy-security.test.mjs (strip the documented locus when passing the local filename). New environment/pin assertions must fail on the current workflow and pass after the edit. Run each repo's required lane gate before delivery.

## Proof plan

1. Before cutover, inspect environment policies, secret **names**, organization-secret applicability and consumers in each repo; confirm the private Plateau repository's GitHub plan supports branch-restricted environment secrets. If support or secret reprovisioning is unavailable, report that operational blocker rather than claiming a YAML-only completion.
2. Record environment API evidence that only branch `main` is permitted, expected names exist in `production`, and no repository/organization fallback exposes the production credentials. Never log secret values or transformed values. Preserve `alpha` configuration.
3. In an authorized live verification window, use a minimal non-deploying branch probe bound to `production`: both ordinary and break-glass cases must be rejected before a secret-bearing step starts. Separately probe an unbound branch job for only a boolean presence result: production secrets must be unavailable. Also test a tag ref to catch an accidental tag allowance. Remove temporary probes afterwards; no exfiltration, secret output or real branch deployment is required.
4. Run normal main CI-triggered deploy and main manual dispatch, capture run URLs, deployed SHA and successful completion. For Plateau retain evidence of privacy probes, unauthenticated publish returning 401 and authenticated publish smoke (we:../plateau-app/.github/workflows/deploy.yml:211-269). For WE confirm its candidate/main/checks gate and deployment result (we:.github/workflows/deploy.yml:115-148, :189-201).
5. Record upstream Action repository/release/commit mappings. Completion requires both the executable regression suite and the live secret-boundary proof. Preparation does not perform this cutover or any deployment.

## Done when

Both proposed repo slices satisfy their tests and live proof, with no production credential remaining available to an unbound branch workflow. A protected environment reference alone, a passing YAML test alone, or Dependabot on mutable tags does not satisfy this card.

## Follow-ups

- Consider automated Action-pin maintenance separately; verify upstream commit provenance on every update.
- Track sibling source pinning and shared read-token isolation separately; this card does not solve those distinct trust boundaries (we:../plateau-app/.github/workflows/deploy.yml:28, :37-38).
- Keep the testing lesson here: a local workflow assertion proves wiring, while remote policy and removal of secret fallbacks require API evidence and controlled negative runs. Do not amend shared agent documentation for this preparation.
