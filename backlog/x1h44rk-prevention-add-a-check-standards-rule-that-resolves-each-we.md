---
kind: story
size: 3
parent: "4075"
status: open
scope: ["plateau:scripts/wip-postdeploy-smoke-build.ts", "plateau:scripts/deploy-config.test.mjs", "plateau:.github/workflows/deploy.yml", "plateau:scripts/check-deploy-pins.mjs", "plateau:scripts/check-deploy-pins.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8a4b96161632caafcc5da32b896d16e3758787ec"
tags: []
---

# Prevention — Add a check:standards rule that resolves each we:-prefixed path against the web-everything checkout and fai… (from chalbert/plateau-app#196 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/wip-postdeploy-smoke-build.ts:44` — Add a check:standards rule that resolves each `we:`-prefixed path against the web-everything checkout and fails when the path does not exist there. Otherwise, drop the prefix on local paths.
2. `we:scripts/deploy-config.test.mjs:103` — Make the build step's env an allowlist test, since it should contain only known non-secret keys. Alternatively, reject any `secrets` reference in the build step at all. Add this as a check:standards rule on we:.github/workflows/deploy.yml, not as a per-name regex.
3. `we:.github/workflows/deploy.yml:43` — Add a CI step or pre-merge check that runs `gh api repos/<repo>/compare/<default-branch>...<sha>` and asserts the SHA is an ancestor of main whenever the pin lines change in we:.github/workflows/deploy.yml.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#196@7d63b8996cd0aa60a47d399528468f915e4e9563

## Progress

- Premise check (2026-10-03): not delivered. `git log --grep=x1h44rk` shows only the card-filing PR #3547.
- Scope drift corrected: the card said `we:scripts/wip-postdeploy-smoke-build.ts`, `we:scripts/deploy-config.test.mjs`, `we:scripts/__tests__/wip-postdeploy-smoke-build.test.mjs`. None of these exist in WE (the last exists nowhere). The first two are chalbert/plateau-app files (`plateau-app/scripts/…`); the `we:` prefix is exactly the bug guard 1 names. WE's own `we:.github/workflows/deploy.yml` is a different file. Corrected scope: `plateau:` paths, plus two new files for guard 3.
- Plateau has no `check:standards`; its standards gate is `npm test` (vitest), which already runs `plateau:scripts/deploy-config.test.mjs` over `plateau:.github/workflows/deploy.yml`. "check:standards rule" in the card therefore means a vitest case there.

## Design

All three guards live in plateau-app, since the audited files are there.

1. **Locus-prefix resolution.** Add a describe block in `plateau:scripts/deploy-config.test.mjs` (which already has `read()` and `siblings`, ~line 60-100). It scans comments in `plateau:scripts/wip-postdeploy-smoke-build.ts` (the `we:.github/workflows/deploy.yml` and `we:src/wip` refs at lines 45-49) and `plateau:.github/workflows/deploy.yml` for `\bwe:([\w./-]+)`, and asserts each path exists in the WE sibling checkout (the `webeverything` dir beside the repo, the same dir `plateau:.github/workflows/deploy.yml` checks out at line 150). Where the sibling is absent (local dev), the case skips with a named reason; in CI the sibling is present. The existing wrong refs are fixed in the same change by dropping the prefix (they mean plateau files): `plateau:.github/workflows/deploy.yml` lines 22, 27 (`plateau:docs/alpha-deploys.md`) and 260; `plateau:scripts/deploy-config.test.mjs` line 227 (`plateau:docs/alpha-deploys.md`); and `plateau:scripts/wip-postdeploy-smoke-build.ts` lines 45, 48 (`plateau:src/wip`, which exists only in plateau) and 49. Known blind spot: `we:.github/workflows/deploy.yml` exists in WE too, so an existence-only resolver would pass it while the comment means the plateau file. The rule therefore also fails when a `we:` path exists in the local plateau checkout AND the same path is a plateau-only file (`plateau:scripts/…`, `plateau:docs/alpha-deploys.md`); the builder lists the ambiguous paths (any path present in both repos) and requires an explicit prefix choice for them.
2. **Build-step env allowlist.** In the same test file, add `assertBuildEnvAllowlist(wf)`: the covered targets are named explicitly: the "Build plateau-app" step (`plateau:.github/workflows/deploy.yml` lines 178-182, which has no `env` today), the `wip:smoke:build` step, the job `env` (none today), the workflow `env` (line 67, only `DEPLOY_SHA`) and workflow/job `defaults`. Each may contain only an explicit allowlist of known non-secret keys (today `DEPLOY_SHA`), and no `${{ … }}` expression anywhere in them may match `\bsecrets\b` (covers `secrets['X']`, `toJSON(secrets)`, `secrets: inherit`). This extends `assertSmokeSeparation` (line ~95), which only forbids the name `WIP_PUBLISH_TOKEN`. Mutation table cases follow the existing `it.each` style.
3. **Pin ancestry.** New `plateau:scripts/check-deploy-pins.mjs`: parses the two `ref:` SHAs from `plateau:.github/workflows/deploy.yml` (lines 151, 158), and for each runs `gh api repos/<repo>/compare/<default-branch>...<sha>` (fetcher injected for tests), requiring `status` of `identical` or `behind`. Wired as a CI step on pull requests that touch the pin lines. Refuses on API error, non-ancestor, or unparseable pin. The FUI compare needs `FUI_READ_TOKEN` (private repo): the CI step passes it from secrets, and on fork PRs, where the secret is absent, the step skips with a visible notice rather than passing silently; same-repo PRs and the deploy-time gate stay fail-closed.

## MVP

Musts:
- Guard 1 test, with the existing bad `we:` refs fixed.
- Guard 2 test: env allowlist + `\bsecrets\b` ban in the build step, job env, workflow env, and `defaults`.
- Guard 3 script + unit test + CI step; refuse-on-error (fail closed).
Out of scope (Follow-ups): applying guards to other workflows; a generic repo-wide `we:` resolver for all file types.

## Test plan

- Guard 1, RED today: a fixture comment `we:scripts/does-not-exist.mjs` must fail; and the real file fails until the bad `we:.github/workflows/deploy.yml` ref is repaired. A valid `we:` path passes.
- Guard 2, RED today: mutations (`secrets.X` in build env, `toJSON(secrets)`, `secrets['X']` under a renamed key, unlisted non-secret key, `secrets: inherit`) all pass the current test and must now throw.
- Guard 3, RED today because the script does not exist: injected fetcher returns `ahead`/`diverged` → throws; `identical`/`behind` → passes; fetch error → throws; malformed pin → throws.

## Proof plan

Before/after on the live repo: run the vitest file `plateau:scripts/deploy-config.test.mjs` (`plateau:` is a locus label, i.e. a path relative to the plateau-app root) from the plateau-app checkout before (shows the bad `we:` ref passes) and after (guards green on the fixed file, red when I temporarily mutate a copy). Run the script `plateau:scripts/check-deploy-pins.mjs` with node from the plateau-app checkout against the real pins live (`gh api` against WE and FUI) and show it passes; show it refusing a SHA first confirmed non-ancestor with `gh api repos/chalbert/web-everything/compare/main...<sha>` (status `ahead` or `diverged`; a PR-head SHA from WE's deploy-gate comments, re-verified live, not assumed).

## Follow-ups

- Extend the `secrets` ban to `plateau:.github/workflows/deploy-alpha.yml` and every `plateau:.github/workflows/*.yml` (see the sibling card `xh69wwb`).
- A repo-wide check that resolves `we:`/`fui:`/`plateau:` locus prefixes in all comments and docs, not just these files.

## Done when

1. **Executable** — in the plateau-app checkout: `npx vitest run` on `plateau:scripts/deploy-config.test.mjs` and `plateau:scripts/check-deploy-pins.test.mjs`, then `node` on `plateau:scripts/check-deploy-pins.mjs`, all from the plateau-app root fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
