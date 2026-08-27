---
bornAs: xdiub6l
kind: task
status: resolved
dateOpened: "2026-08-24"
dateResolved: "2026-08-27"
tags: []
---

# apply-review-request must run review-set-label from the VERDICTED repo, not its own checkout

we:scripts/apply-review-request.mjs pins the child to cwd: REPO_ROOT — its own script dirname. In web-everything that IS the verdicted repo, so it was correct. plateau-app PR #145 makes WE a SIBLING checkout (webeverything/) beside the verdicted repo, so the child now runs from the wrong tree: computeNetDiffText fetches the PR head ref against web-everything origin, fails to resolve, and reviewedDiff silently degrades to empty via the fail-soft path. we:scripts/review-set-label.mjs already states the contract in its header — EVERY CALLER MUST GUARANTEE cwd IS THE NAMED REPOs CHECKOUT — and names this caller class. Effect is degradation not corruption: no marker falls back to SHA-identity, which is stricter, so a content-preserving rebase re-parks an already-accepted PR. Found by the PR #145 correctness juror; disposition carve-out.

## What is wrong

`we:scripts/apply-review-request.mjs` spawns the label CLI with an explicit `cwd`:

```js
const r = spawnSync(process.execPath, buildLabelArgv(request, bodyFile), {
  encoding: 'utf8', env: buildEnv(request), cwd: REPO_ROOT,
});
```

`REPO_ROOT` is `resolve(HERE, '..')` — the applier script's OWN checkout. That was right while the
only applier lived in the repo it verdicted. It stops being right the moment the script is run from
a sibling checkout, which is exactly the layout `plateau-app:.github/workflows/apply-review-request.yml`
introduces: the verdicted repo is the workspace root and web-everything is checked out at
`webeverything/`. The child then runs with `cwd` = `.../plateau-app/webeverything`.

## Why that matters

`we:scripts/review-set-label.mjs` computes the `reviewed-diff` fingerprint with **no explicit `cwd`**,
and its header states the contract in capitals:

> NO EXPLICIT `cwd` HERE: THIS READS THE PROCESS'S OWN CWD, AND EVERY CALLER MUST GUARANTEE THAT IS THE
> NAMED REPO'S CHECKOUT (PR #1087 review note 2; #3202).
>
> For the NEXT caller: run this CLI from the named repo's checkout, or pin the child process to it.

The plateau-app applier IS that next caller, and it does not satisfy the contract. `computeNetDiffText`
fetches the PR's head ref against **web-everything's** origin, cannot resolve it, and the `catch`
degrades `reviewedDiff` to `''`.

## Blast radius — degradation, not corruption

Fails toward the STRICTER path, never a false accept. With no `reviewed-diff` marker,
`acceptanceCoversHead` falls back to SHA identity, so a content-preserving rebase re-parks an
already-accepted PR. Cost is an unnecessary re-review, not a merge that should not have happened.
That is why PR #145 was accepted with this carved out rather than sent back.

## The fix

Pin the child to the VERDICTED repo's checkout, not the script's. `process.cwd()` is already correct
in both layouts — web-everything's own applier runs from its repo root, and the plateau-app workflow
runs from the plateau-app root with WE as a subdirectory — but the value must be chosen deliberately
and named, not inherited. Prefer an explicit input on `we:scripts/apply-review-request.mjs` that defaults to
`process.cwd()`, mirroring the `--repoRoot` seam `we:scripts/operations/record-verdict-io.mjs` took
for the writer half (#3261), so a wrong tree is a refusal rather than a silent empty fingerprint.

Note the `--body-file` allowlist is rooted at `process.cwd()` too, so a `cwd` on the single
`computeNetDiffText` call is NOT enough — the process's location is the contract.

## Done when

1. **Executable** — a test in `we:scripts/__tests__/apply-review-request.test.mjs` runs the applier
   with a `--repo` naming a repo whose checkout differs from the script's own `REPO_ROOT`, and
   asserts the spawned child's `cwd` is the verdicted repo's checkout. It must RED on today's
   `cwd: REPO_ROOT` — the existing suite asserts argv shape only, so nothing currently reddens.
2. **Mutation** — reverting the pin to `REPO_ROOT` reddens that named test.
