---
kind: task
status: open
relatedTo: ["2383", "2287", "2263"]
tags: [lane, drain, merge-queue, cross-repo, bug]
dateOpened: "2026-07-09"
---

# Drain's remote-manifest `gh api` read POSTs instead of GETs — cross-repo `blockedBy` ordering silently broken

`we:scripts/merge-ai-prs.mjs:737` reads a remote constellation repo's lane manifest with a `gh api …contents…`
call that passes `-f ref=<headRef>` and **no explicit method**. With an `-f`/`--field` param and no method,
`gh api` switches to **POST**, and a POST to the read-only contents endpoint **404s** — which the surrounding
`catch` swallows to `null`. So for **every** PR in a remote repo (frontierui / plateau-app) the drain reads a
null manifest → `item`/`blockedBy` drop → the cross-repo `blockedBy` **ordering the constellation cascade
exists for silently never fires for remote lanes** (they land unordered, un-item-tagged). Verified live: the
`-f ref=` form returns HTTP 404, while the `--method GET` form returns the file.

This is the same defect the #2383 review caught and fixed in `we:scripts/lane-resume.mjs` (there via an
exported `remoteManifestApiArgs()` helper with `--method GET` + a regression test). Port the identical fix
here: add `--method GET` (or fold `ref` into the endpoint path as a query param), and add a unit test
asserting the argv carries `--method GET` so it can't regress.

**Note:** `we:scripts/merge-ai-prs.mjs` is a **gate-self** path (the auto-review trust chain) — the fix PR is
`review:human` and must be cleared by a human, never agent-self-cleared.
