---
bornAs: xnnehes
kind: task
status: open
dateOpened: "2026-08-24"
tags: []
---

# A repo onboarding to the verdict transport has no way to create its board branch

we:scripts/operations/record-verdict-io.mjs fetches origin/ops/review-requests and worktree-adds from it. On a repo that has never carried a verdict the branch does not exist, the fetch fails hard, and the FIRST verdict for every newly-onboarded repo therefore fails. Worse, the board cannot be an orphan branch holding only request JSON: GitHub runs a push-triggered workflow from the DEFINITION ON THE PUSHED REF, so the board must be a full branch off main carrying the applier workflow — which is what web-everythings board is, by accident of how it was made rather than by anything that maintains it. Nothing creates the branch, nothing keeps it current with main, and a board branched from a main that predates the applier will silently never run it. Surfaced onboarding plateau-app under #3261.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Two distinct failures, found onboarding plateau-app

### 1. The genesis fetch has no genesis case

`we:scripts/operations/record-verdict-io.mjs` does, unconditionally:

```js
run(['fetch', '--quiet', 'origin', TRANSPORT_BRANCH], { cwd: board });
run(['worktree', 'add', '--force', '--detach', wt, `origin/${TRANSPORT_BRANCH}`], { cwd: board });
```

On a repo that has never carried a verdict, `origin/ops/review-requests` does not exist and the fetch
fails outright. So the FIRST verdict for every newly-onboarded repo fails — and #3261 just made
per-repo boards the standard, which turns a one-time curiosity into the normal onboarding path.

Verified against `chalbert/plateau-app`: `git ls-remote --heads origin 'ops/*'` returns nothing.

### 2. The board cannot be an orphan branch, and nothing says so

The obvious fix for (1) — create an orphan branch holding only request JSON — is WRONG, and the reason
is not obvious. GitHub runs a `push`-triggered workflow from **the workflow definition on the pushed
ref**, not from `main`. So a board that does not itself carry
`we:.github/workflows/apply-review-request.yml` will accept pushes and silently never apply anything.

`we:` board is a full branch off `main`, which is why it works — but that is an accident of how it was
first made, not something any code or doc requires. Nothing creates the branch, nothing keeps it
current with `main`, and a board branched from a `main` that predates the applier will silently never
run it. That is a fail-SILENT, which is the bad direction: a verdict pushed to a dead board looks
staged and is never applied.

## Done when

1. **Executable** — a test drives the sink against a fixture repo whose `origin` has no
   `ops/review-requests`, and asserts it either creates the board from `main` or REFUSES with a message
   naming the onboarding step. It must RED today, where the fetch throws a raw git error.
2. **Executable** — an onboarding path (operation or documented step) that creates the board from
   `main` so the workflow definition rides it, plus a check that refuses to stage onto a board whose
   tree lacks the applier workflow — turning failure (2) from silent into loud.

### 3. `fetch origin <branch>` does not create `origin/<branch>` — hit live

Onboarding plateau-app, the sink's own two-line sequence failed at the second line:

```
$ git fetch --quiet origin ops/review-requests   # succeeds, writes FETCH_HEAD only
$ git worktree add --force --detach $WT origin/ops/review-requests
fatal: invalid reference: origin/ops/review-requests
```

`git fetch origin <branch>` writes `FETCH_HEAD`; it creates the remote-tracking ref
`refs/remotes/origin/<branch>` only when the clone's configured fetch refspec covers it. A full clone
carries `+refs/heads/*:refs/remotes/origin/*` and so it does — which is why this has never been seen
in `we:` — but a narrow or single-branch clone does not, and the cloud session's checkouts are of that
kind. The fix is an explicit refspec (`origin ops/review-requests:refs/remotes/origin/ops/review-requests`)
or using `FETCH_HEAD` directly.

This makes (1) and (3) the same shape of assumption: the sink was written against one repo's clone
geometry and reads it as universal. Worth covering in the same change.

### Status update — plateau-app was onboarded BY HAND

The evidence above ("plateau-app has no `ops/*` branch") was true at filing. The board now exists,
created manually after #145 merged:

```
git push origin origin/main:refs/heads/ops/review-requests
```

That is the whole onboarding step, and it lives nowhere but in this paragraph — which is precisely
the gap. It had to be pushed from `main` *after* the applier landed there, or the board would have
carried a `main` predating the workflow and silently applied nothing (failure 2). Getting that
ordering right was a judgement a human made, not something any code enforces.

It worked: the relocated `plateau-app:ops/review-requests/144-accepted.json` triggered plateau-app's applier on its first run and the
label was applied through the real path. So the mechanism is proven — only its onboarding is manual.
