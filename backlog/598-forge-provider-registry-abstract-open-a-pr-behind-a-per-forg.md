---
kind: story
size: 5
status: resolved
blockedBy: ["575"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/dev-browser/forge/
tags: []
---

# Forge provider registry — abstract "open a PR" behind a per-forge provider (GitHub first)

Build the forge provider registry ruled by #578: "open a PR" abstracted behind a per-forge provider (GitHub/GitLab/Gitea/Forgejo/Bitbucket), every present provider used, precedence + degradation the only rules — the twin of #576's IDE-bridge registry. Prior art: Renovate Platform, Woodpecker forge.Forge, go-git-providers. v1 ships the GitHub provider first (prioritization, not a fork). Layer: Plateau (the dev-browser acts on the repo). Gated on the resolver (#575) that tells the loop which repo/file:line a fix targets.

## Progress

- **Resolved 2026-06-14.** Built the forge provider registry (#578) — the **"open a PR" twin of #576's
  IDE-bridge registry** — in `plateau-app/src/dev-browser/forge/` (mirrors the IdeBridgeRegistry layout:
  `we:types.ts` / `we:registry.ts` / `plateau:providers.ts` / `we:index.ts` / `plateau:forge.test.ts`). A runtime-DI registry the
  dev-browser consults to open a PR once a resolver (#575) yields the `file:line`.
  - **`ForgeProviderRegistry`** resolves the highest-precedence provider that `handles(repo)` (host match)
    **and** `isAvailable()` (configured), skipping the rest and degrading to a clear reason when none
    matches — same precedence + degradation mechanic as the IDE-bridge chain. `openPullRequest` returns a
    `ForgeOutcome` naming the serving provider, never throws.
  - **GitHub provider first** (`createGitHubProvider`, v1 — prioritization, not a fork): handles its
    configured host (github.com or a GH-Enterprise host), available only with a token, opens the PR via an
    **injected `createPr` seam** (default REST `POST /repos/{o}/{r}/pulls`) so it's testable with no network
    / token; defaults the base branch to `repo.defaultBranch ?? 'main'`. GitLab / Gitea / Forgejo /
    Bitbucket are **reserved precedence slots** in `FORGE_PRECEDENCE` (future same-shape providers).
  - Layer: Plateau (the dev-browser acts on the repo) — lands alongside #576's IdeBridgeRegistry.
  - **Verified:** 11 forge tests pass; plateau-app gate `npm test` green (113 tests); forge dir
    `tsc --noEmit --strict` clean. Commit → plateau-app.

**Graduated to** `plateau-app/src/dev-browser/forge/` — ForgeProviderRegistry + GitHub provider (twin of #576 IdeBridgeRegistry).
