---
bornAs: xy69r60
kind: task
parent: "3963"
status: open
scope: ["plateau:.github/workflows/deploy.yml", "plateau:scripts/deploy-config.test.mjs", "plateau:scripts/wip-postdeploy-smoke-build.ts"]
dateOpened: "2026-09-23"
preparedDate: "2026-10-02"
preparedAgainstSha: "8de0bb0afaf2adf8229782a605c6e674d4e3c255"
tags: []
---

# pin plateau deploy's sibling checkouts to a SHA

Pin Plateau's WE and FUI deploy checkouts to reviewed, full commit SHAs. Both currently omit `ref`, while Plateau itself uses `DEPLOY_SHA` (we:../plateau-app/.github/workflows/deploy.yml:133–151). Keep the separate snapshot-build and token-bearing publish steps (we:../plateau-app/.github/workflows/deploy.yml:261–269).

Path convention: body citations use WE-relative sibling paths with the requested `we:` prefix; machine-readable scope retains the canonical Plateau locus required by we:docs/agent/platform-decisions.md:5521–5522 (`#conveyor-multi-repo-model`).

## Progress

Preparation checked WE main/HEAD `8de0bb0afaf2adf8229782a605c6e674d4e3c255` and Plateau HEAD `5e483a481602a512aaa9aacecac1118203a7b965` on 2026-10-02. No implementation or deploy was performed.

- **Original premise:** sibling default-branch checkouts execute code during deployment; the #170 smoke split “contains the token exposure.” **Corrected premise:** the unpinned checkouts are still present (we:../plateau-app/.github/workflows/deploy.yml:139–151). The split removes direct token injection into the snapshot-build step, but both steps share one job; it is not proof of isolation against malicious earlier code (we:../plateau-app/.github/workflows/deploy.yml:261–269). Retain that defense without claiming comprehensive secret containment. The build script imports and invokes `readWip` (we:../plateau-app/scripts/wip-postdeploy-smoke-build.ts:52–65).
- **Original scope:** deploy workflow only, with an executable-acceptance TODO. **Corrected scope:** include its existing YAML-parsing regression suite (we:../plateau-app/scripts/deploy-config.test.mjs:76–109), and update the smoke-build header's soon-stale default-branch explanation (we:../plateau-app/scripts/wip-postdeploy-smoke-build.ts:44–50); no runtime change to that script. The suite already checks credential persistence, but has no sibling-ref assertion in that block.
- WE has a similar unpinned FUI checkout (we:.github/workflows/deploy.yml:160–165). It is not needed to pin Plateau's consumers and remains a separate follow-up. Plateau's required CI job also follows sibling defaults (we:../plateau-app/.github/workflows/ci.yml:56–66); a green ordinary CI run alone therefore does not establish compatibility of the proposed pinned pair.

## Design

1. Add a literal, full 40-hex commit `ref` to each of the two sibling checkout steps in we:../plateau-app/.github/workflows/deploy.yml:139–151. Keep repository identities, checkout directories, private FUI authentication and `persist-credentials: false`. Keep Plateau's own `DEPLOY_SHA` selection and admission behavior. Do not resolve a branch tip at deploy time or fall back to a default branch when a commit is unavailable.
2. At implementation time select reviewed commits from each sibling's main history, verify their repository identity and commit existence, and exercise the exact Plateau/WE/FUI tuple before accepting the pins. Record full SHAs, review/check evidence and tuple test results in the implementation review. No SHA is certified by this preparation; a syntactically valid SHA is not compatibility evidence. Pin bumps repeat that process.
3. Update default-branch comments in the workflow and we:../plateau-app/scripts/wip-postdeploy-smoke-build.ts:44–50. Preserve the two smoke commands and their env separation (we:../plateau-app/package.json:28–30; we:../plateau-app/.github/workflows/deploy.yml:261–269). Pinning does not justify combining them or relaxing secret handling.
4. Extend the existing YAML-based tests in we:../plateau-app/scripts/deploy-config.test.mjs:76–109. Require exactly the expected WE and FUI checkout entries and full literal SHA refs; do not hard-code the selected SHA values in the assertions. This permits a reviewed pin bump while preventing a return to branch/tag/expression refs.

**Repo boundary / #4289:** implementation and tests are Plateau-only. The WE card is tracking metadata, not a WE implementation dependency. No mixed-repo delivery is needed. If the analogous WE deploy change is pursued, propose a separate WE workflow-and-regression-test card with its own acceptance; neither pinning task depends on the other. This follows the independently useful split test in we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:23–25 and :53–55. Do not silently widen this card to repair both deploy workflows.

## MVP

- Two reviewed literal sibling SHA refs, plus corrected comments in the scoped Plateau files.
- Regression coverage in the existing deploy-config suite, including malformed/missing refs and preservation of checkout credentials and smoke-step separation.
- Exact-tuple install/build/test evidence and a subsequent admitted deployment record identifying the two resolved sibling SHAs. Existing checkout logs can supply those IDs; no new reporting subsystem is required.
- CI pin synchronization, automatic dependency updates, action-version pinning and broader runner isolation are outside this slice. CI/deploy tuple parity remains an explicit follow-up, not a claim made by this change.

## Test plan

Extend we:../plateau-app/scripts/deploy-config.test.mjs:76 with a reusable assertion over the parsed workflow:

- Require one checkout for each expected sibling repository, with the existing expected directory and a literal string matching `^[0-9a-fA-F]{40}$`.
- Run that assertion against the actual workflow and cloned negative fixtures: absent/empty `ref`, `main`, a tag, shortened SHA, expression-based ref, missing sibling and duplicate sibling. Each mutation must fail; a valid two-SHA fixture must pass.
- Retain the existing credential-persistence and admission checks (we:../plateau-app/scripts/deploy-config.test.mjs:98–109). Add assertions that snapshot building precedes publishing, the build has no publish token at workflow/job/step env level, and only the publish smoke step receives that token; secret-requiring deploy steps elsewhere remain valid (we:../plateau-app/.github/workflows/deploy.yml:261–269).
- Run the focused suite from the Plateau implementation lane with the command below (path relative to that repo). The test is already collected by we:../plateau-app/vitest.config.ts:31; the package test script is Vitest (we:../plateau-app/package.json:14). Run Plateau's required unit suite and build against the selected sibling SHAs; follow the existing FUI-first build ordering (we:../plateau-app/.github/workflows/deploy.yml:161–174).

Run from the Plateau implementation lane:

```bash
npx vitest run scripts/deploy-config.test.mjs
```

## Proof plan

1. **Red/green:** add the ref assertions first and run the focused command above against today's workflow; record failures for both missing refs. Apply the pins and record a green run, including the negative-fixture tests. Existing tests passing without new assertions is not proof of this fix.
2. **Exact inputs:** in isolated sibling checkouts, record each `git rev-parse HEAD`, compare both to the proposed refs, and run the FUI install/build followed by Plateau install/test/build. Record the Plateau SHA and results with the two sibling SHAs. A checkout failure stops the run; no branch fallback.
3. **Runtime acceptance:** after normal implementation review and admission, inspect the deploy run's resolved sibling SHAs and require successful build, gate probes, locked publish endpoint and both smoke steps. Those checks exist at we:../plateau-app/.github/workflows/deploy.yml:205–269. Capture the run URL and tuple. Do not trigger a production deployment as part of this card-only preparation, and do not substitute a local YAML assertion for live smoke evidence.

## Done when

The focused regression command fails on the original missing-ref workflow and passes with both verified pins; the selected tuple builds and passes Plateau tests; a normally admitted deploy resolves exactly those pins and retains passing privacy/publish smoke checks. All changed comments describe pinned inputs accurately. No WE runtime or workflow change is necessary.

## Follow-ups

- Prepare a separate WE deploy pinning card if still needed: we:.github/workflows/deploy.yml:160–165 is the independently observed gap. Give it its own WE tests and proof, following #4289 rather than coupling two otherwise independent fixes.
- Align Plateau CI and deploy sibling inputs in a subsequent Plateau card: current CI omits refs (we:../plateau-app/.github/workflows/ci.yml:56–66). Until then, preserve explicit exact-tuple verification for every pin update.
- Consider stronger job isolation separately. The existing smoke steps share the same deploy job (we:../plateau-app/.github/workflows/deploy.yml:261–269); pinning and split envs must not be described as a complete sandbox.
- Testing lesson: YAML shape checks prove immutable selection syntax; repository existence, compatibility and live smoke need distinct observed evidence. Keep those evidence requirements here rather than editing shared agent documentation.
