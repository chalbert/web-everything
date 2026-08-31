---
kind: task
parent: "2405"
status: active
scaffoldedBy: "guard-bash-merge-gate-lane-10-b3fcb952"
dateScaffolded: "2026-08-31"
dateOpened: "2026-08-31"
dateStarted: "2026-08-31"
tags: []
---

# Deny a raw `gh pr merge`/`gh api .../merge` in we:guard-bash.mjs — close the assertMayMerge bypass

`we:scripts/lib/pr-merge-gate.mjs`'s `assertMayMerge` is the documented sole place a PR may merge to `main` (#2290), and it gates the review-escalation check (`review:pending`/`review:human`) that only runs inside the drain's own call path. But it is a plain JS function: nothing stops an agent's Bash tool from running `gh pr merge <n>` or `gh api repos/.../pulls/<n>/merge -X PUT` directly, skipping both the sole-writer invariant and the review gate behind it. Add a PreToolUse(Bash) denial in `we:scripts/guard-bash.mjs` (mirroring its existing `MAIN_PUSH_OK`-gated push-to-main denial, #2203) that blocks a raw merge in either form, names the sanctioned alternative (`ready-to-merge` label + drain / `we:scripts/pr-land.mjs`), and reuses `we:scripts/lib/pr-merge-gate.mjs`'s own `WE_MERGE_BREAK_GLASS=1` escape rather than inventing a second one.

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/__tests__/guard-bash.test.mjs` (or the repo's
   `check:standards`/gate run) is green against a new
   `describe('guard-bash — raw gh-merge bypass (#2290 assertMayMerge)', …)` block in that same test file
   asserting: a bare `gh pr merge <n>` is denied; a `gh api repos/<owner>/<repo>/pulls/<n>/merge -X PUT`
   (and its `--method PUT` / `-XPUT` / disguised-wrapper forms) is denied; `gh pr view`/`gh pr checks`/
   `gh pr comment`/`gh pr edit --add-label` and a GET on the `.../merge` path are allowed; a
   `we:scripts/merge-ai-prs.mjs` / `we:scripts/pr-land.mjs` invocation is allowed (those call
   `assertMayMerge` internally); and the `WE_MERGE_BREAK_GLASS=1` prefix passes the raw command through —
   this test fails before the fix (no such arm exists yet) and passes after.

## Progress

- **Status:** active — implementing the new denial + tests in this lane.
- **Branch:** this lane clone (lane-10).
- **Done:** item scaffolded, parented under #2405 ("Harden and self-improve the PR-validation gate").
- **Next:** add the `reason()` arm in `we:scripts/guard-bash.mjs`, the break-glass audit line in its CLI
  section, unit tests mirroring the #2203 push-to-main block, and the doc-comment bullet.
- **Notes:** gap found by reading `we:scripts/lib/pr-merge-gate.mjs` (`assertMayMerge`) and
  `we:scripts/lib/review-escalation.mjs` this session — a raw `gh pr merge`/`gh api …/merge -X PUT` bypasses
  both the sole-writer invariant (#2290) and the review-escalation check upstream of it. Confirmed (reading
  `we:scripts/pr-land.mjs` and `we:scripts/lane-stack.mjs`) that every PR this repo opens targets `main` —
  lane-stacking rebases a lane's LOCAL git history onto a parent lane's tip, it never changes a PR's GitHub
  base ref — so the new denial is a blanket rule, not one gated on reading the PR's base via `gh pr view`.
