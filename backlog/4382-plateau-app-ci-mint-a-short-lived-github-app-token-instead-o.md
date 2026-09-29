---
bornAs: x8x0ris
kind: story
size: 5
tier: pinned
status: open
scope: ["plateau:.github/workflows/ci.yml", "plateau:.github/workflows/deploy.yml", "plateau:.github/workflows/deploy-alpha.yml"]
dateOpened: "2026-09-28"
tags: []
---

# plateau-app CI: mint a short-lived GitHub App token instead of the static FUI_READ_TOKEN secret

plateau-app PR #187's `test` and `e2e` jobs fail at step "Checkout FUI (sibling, private)" with "Bad credentials" — the repo secret FUI_READ_TOKEN (a static PAT) is invalid/expired. This blocks EVERY plateau-app PR; ci-heal correctly escalated needs-human (2026-09-28 ~5:31 PM ET).

## Full design

plateau-app's CI, e2e, and deploy workflows (`plateau:.github/workflows/ci.yml`, `plateau:.github/workflows/deploy.yml`, `plateau:.github/workflows/deploy-alpha.yml`) each check out the private chalbert/frontierui sibling using a static fine-grained PAT (`secrets.FUI_READ_TOKEN`). A static PAT expires/rotates silently and has no automated renewal, so this class of failure recurs. The durable fix is to mint a short-lived GitHub App installation token at CI-run time instead of relying on a long-lived secret:

- Register (or reuse) a web-everything GitHub App with `contents:read` on chalbert/frontierui, installed on that repo.
- Store the App id + private key as plateau-app repo secrets (e.g. `WE_APP_ID`, `WE_APP_PRIVATE_KEY`).
- In each workflow's sibling-checkout step, run `actions/create-github-app-token` (or equivalent) to mint an installation token scoped to chalbert/frontierui, and pass that token to the `actions/checkout` step in place of `secrets.FUI_READ_TOKEN`.
- Add a CI preflight / health smell that checks the sibling-checkout credential BEFORE the real checkout (or wraps the checkout's failure) and reports "invalid sibling-checkout credential" clearly, rather than surfacing an opaque "Bad credentials" only inside the checkout step's raw log.
- frontierui's own CI (`frontierui:.github/workflows/ci.yml`) was checked: it checks out webeverything as a PUBLIC sibling with no token, so it does NOT share this mirror-dependency failure mode — no matching change needed there.

## Explicit MVP cut

MVP = in plateau-app's workflow(s) under `plateau:.github/workflows/`, mint an installation token with `actions/create-github-app-token` (or equivalent) from the web-everything GitHub App and use it for the sibling checkout in `plateau:.github/workflows/ci.yml`'s `test`/`e2e` jobs (the two failing on PR #187); keep the static PAT as a fallback only during the switch (e.g. `token: ${{ steps.app-token.outputs.token || secrets.FUI_READ_TOKEN }}`). Include the CI preflight / health smell for an invalid sibling-checkout credential. `plateau:.github/workflows/deploy.yml`/`plateau:.github/workflows/deploy-alpha.yml`'s own sibling-checkout steps use the same pattern once the App token is proven in `plateau:.github/workflows/ci.yml`, but are not MVP-blocking for this card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
