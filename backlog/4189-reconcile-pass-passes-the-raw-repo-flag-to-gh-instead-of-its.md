---
bornAs: x81m8xx
kind: story
size: 2
parent: "4075"
status: active
scope: ["we:scripts/conveyor/reconcile-pass.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
tags: []
---

# reconcile-pass passes the raw --repo flag to gh instead of its normalised owner/name form

we:scripts/conveyor/reconcile-pass.mjs#runReconcilePass computes repoKey = repoKeyForSlug(repo) and validates it, but then calls readPrs({repo}) and enrichMainRed(rawPrs, {repo, defaultBranch}) with the RAW repo string, not repoKey. we:scripts/conveyor/reconcile-pass.mjs#defaultReadPrs pushes that raw value straight through as gh pr list --repo <raw>, so a caller passing the repo KEY (--repo=we, exactly as we:scripts/lib/constellation-repos.mjs names it) makes gh fail: gh expects OWNER/NAME (chalbert/web-everything), not a bare key. Normalise: pass repoKey (or CONSTELLATION_REPOS[repoKey].slug) to readPrs and enrichMainRed, not the raw input.

## Done when

1. **Executable** — a test calling `runReconcilePass({repo: 'we'})` with a fake `readPrs`/`enrichMainRed` asserts they are invoked with the normalised `owner/name` slug, not the raw `'we'` string — fails before this lands (they receive `'we'` today) and passes after.
2. **Live proof** — before: `node we:scripts/conveyor/reconcile-pass.mjs --repo=we` fails (gh rejects the bare repo key). After: the same command succeeds against the real repo.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
