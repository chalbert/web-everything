---
bornAs: xmb28f4
kind: story
size: 2
status: open
scope: ["plateau:.github/workflows/deploy.yml", "we:.github/workflows/deploy.yml"]
dateOpened: "2026-09-21"
tags: []
---

# Protect deploy secrets with a GitHub environment and SHA-pin third-party Actions

plateau-app's deploy workflow (plateau:.github/workflows/deploy.yml, PR chalbert/plateau-app#156) reads CLOUDFLARE_API_TOKEN, GATE_CODE and GATE_COOKIE_SECRET as plain repo secrets with no protected environment, and cloudflare/wrangler-action@v3 and actions/*@v4 are pinned by mutable tag. Anyone with write access can run a modified copy of the workflow from a branch via workflow_dispatch and read the secrets. Add a protected environment (required branch main) to the deploy job and pin third-party uses by SHA (or Dependabot). Same gap in we:.github/workflows/deploy.yml.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
