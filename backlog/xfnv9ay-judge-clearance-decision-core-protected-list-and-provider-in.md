---
kind: story
size: 3
parent: "xaojq81"
status: open
scope: ["we:scripts/lib/judge-clearance.mjs", "we:scripts/lib/gate-config.mjs", "we:scripts/lib/__tests__/judge-clearance.test.mjs", "we:scripts/lib/__tests__/gate-invariants.test.mjs", "we:scripts/lib/__tests__/gate-config.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Judge clearance decision core: protected list and provider independence check

A pure decision function says whether the independent judge may clear review:human on a PR: only when reviewers accepted for the current head and only the human gate remains, never when the diff touches the protected list (merge/approval logic, credentials and secrets, security-check weakening), never when the judge shares the author provider or actor, and never when the kill switch is on or the wait has not elapsed.

Builds rules 1–3 of `we:docs/agent/platform-decisions.md#independent-judge-clears-review-human-outside-protected-list` (decision xne1udi, operator 2026-10-03). No I/O, no spawn, no label write — those belong to `xq3kn88`.

## Design

New pure leaf `we:scripts/lib/judge-clearance.mjs` exporting `decideJudgeClearance(input)` → `{ allowed, refusal, detail }`. `refusal` is one of a closed, frozen set `JUDGE_REFUSALS`:

- `kill-switch` — `input.switches.judgeEnabled !== true` (the switch state from `x6e8z3o`, passed in; this module reads nothing).
- `wait-not-elapsed` — `input.switches.waitHours > 0` and less than that many hours have passed since `input.parkedAt`, the time the PR was parked on `review:human`. With `waitHours` 0 or absent the check is skipped (default off, so a clear is immediate). **Input source for `parkedAt`:** the GitHub issue timeline, the `labeled` event for `review:human` that is the **latest one not followed by an `unlabeled` event for it** (the runner reads it with `gh api repos/<repo>/issues/<n>/timeline`; this module only receives the timestamp). If the timeline cannot be read or holds no such event, `parkedAt` is `null`, and with `waitHours > 0` that is refused as `wait-not-elapsed` (detail `parked-time-unknown`) — never treated as "long enough". The label timeline is written by GitHub, not by the PR author, so the author cannot backdate it.
- `not-human-gated` — the PR does not carry `review:human`.
- `reviewers-not-accepted` — no `advisory:accepted` covering the current head (reuse `advisoryCoversHead` and `latestAdvisory` from `we:scripts/lib/advisory-labels.mjs`), or a live `review:changes`, or red CI.
- `protected-list` — a changed path matches the protected list (below); the matching paths go in `detail`.
- `secret-in-diff` — an added line matches `SECRET_PATTERNS` or a high-entropy token from `we:scripts/lib/secret-scrub.mjs`.
- `independence-unknown` — the author provider or author actor cannot be read from a **trusted source**. **The author's provider is never taken from text the PR author can edit:** not the PR body (so not the delegation marker in it, `parseDelegationMarker`), not the PR title, comments or labels, and not a commit trailer inside the PR's own commits (the lane agent writes those commits). The trusted source is the **dispatch run record**: the record the dispatcher writes in the coordination root (`resolveCoordinationRoot()`, `we:scripts/operations/coordination-root.mjs`) when it chooses and spawns the delivery agent, outside the repo and outside the PR, keyed by the PR's head ref (`lane/*`) and carrying the **executed** provider (the provider that actually ran, as `we:scripts/operations/dispatch-lane.mjs` already distinguishes "chosen" from "executed"). The build's first step confirms which existing dispatch record carries the executed provider; if none does, adding that one field at the dispatcher's write site is part of this story (widen `scope:` in the PR). The runner reads the record and passes `authorProvider` in; this module reads nothing. No record for the head ref, an unreadable record, or a record with no provider → unknown. The PR-side signals (delegation marker, co-author trailer via `isAiCommit` in `we:scripts/lib/ai-pr-authorship.mjs`) may only **add** doubt: if the trusted record says `codex` but the PR carries a Claude co-author trailer, refuse as `independence-unknown` (the sources disagree); they can never turn an unknown into a known. The author actor comes from `parseAuthorActorId` in `we:scripts/lib/review-independence.mjs` and is likewise cross-checked against the run record's session id.
- `same-provider` — the judge provider equals the author provider.
- `same-actor` — the judge actor id equals the author actor, or any reviewer actor recorded on the PR (`cleared-by-actor` markers and the advisory reviewer id).

`input.changedPaths` is the **complete** set of paths the PR changes, computed by the runner from git (the net diff against the base, see `xq3kn88`), never from the capped `gh pr view --json files` list. The module refuses (`protected-list`, detail `changed-paths-incomplete`) when `changedPaths` is missing, not an array, or flagged `truncated`, so a truncated list can never read as "nothing protected touched".

Checks run in that order; the first refusal wins. Any error thrown inside the function is caught and returned as `refusal: 'error'`, `allowed: false` (fail closed).

**The protected list lives in the leash, not in the new module.** Add `JUDGE_PROTECTED` to `we:scripts/lib/gate-config.mjs`. That file is on the `POLICY_SPEC` floor, so every later edit to the list is itself human-gated and judge-protected:

- **(a) merge/approval logic** — every `TRUST_CHAIN` member (`isTrustChainPath`), plus `we:scripts/review-set-label.mjs`, `we:scripts/pr-land.mjs`, `we:scripts/operations/record-verdict.mjs`, `we:scripts/operations/review-dispatch.mjs`, `we:scripts/lib/advisory-labels.mjs`, `we:scripts/lib/verdict-ledger.mjs`, and **the judge's own inputs and control modules**, so a PR cannot rewire the judge and get itself cleared. Four groups, each named so none is left to a reader's guess:
  - the **clearance decision**: `we:scripts/lib/judge-clearance.mjs`;
  - the **runner and its siblings**: `we:scripts/operations/judge-clear.mjs`, `we:scripts/operations/judge-arbitrate.mjs`, `we:scripts/conveyor/judge-pass.mjs`, `we:scripts/conveyor/judge-digest.mjs`, and the seat spawners the runner uses (`we:scripts/lib/judge-spawn.mjs`, `we:scripts/lib/codex-judge-spawn.mjs`);
  - the **switch store** code: `we:scripts/lib/judge-switches.mjs` and `we:scripts/conveyor/judge-switch.mjs` (the store file itself lives outside the repo, see `x6e8z3o`);
  - the **provider-identity source** and independence inputs: `we:scripts/lib/review-independence.mjs`, `we:scripts/lib/delegation-marker.mjs`, `we:scripts/lib/ai-pr-authorship.mjs`, `we:scripts/lib/dispatch-provider-availability.mjs`, `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/operations/dispatch-provider-registry.mjs`, `we:scripts/operations/deliver-item-wrapper.mjs`, and `we:scripts/operations/coordination-root.mjs` (the code that writes or locates the dispatch run record the author provider is read from).
- **(b) credentials and secrets** — `we:scripts/lib/github-app-token.mjs`, any env file (a basename starting with a dot and containing `env`), and any path whose basename matches `secret|token|credential|password|pem|key` outside the `backlog/`, `reports/` and `src/` content trees.
- **(c) security checks** — the guard hooks (`we:scripts/guard-bash.mjs` and its `guard-*` siblings in the same folder), `we:.claude/settings.json`, the git hooks folder `we:.githooks`, `we:scripts/lib/secret-scrub.mjs`, and `we:scripts/rust-scan/src/secret_scrub.rs`. Path matching is the deterministic floor; the judge prompt (`xq3kn88`) adds the judgment half ("does this weaken a security check?") and must refuse on doubt.

Also register `we:scripts/lib/judge-clearance.mjs` as a policy-tier `TRUST_CHAIN` member so its own edits escalate.

## MVP

1. Must refuse with `protected-list` when any changed path is in class (a), (b) or (c), naming the paths.
2. Must refuse with `same-provider` when the judge provider equals the author provider, and with `same-actor` when the judge actor is the author or a recorded reviewer.
3. Must refuse with `independence-unknown` when the author provider or actor cannot be read from the trusted dispatch run record — never assume independence, and never read the provider from the PR body, title, comments or the PR's own commit trailers. Must also refuse when a PR-side signal contradicts the record.
4. Must refuse with `kill-switch` when the judge is off, and must apply no wait when `waitHours` is 0 or absent. With `waitHours > 0`, must refuse `wait-not-elapsed` when the park time (`parkedAt`, from the label timeline) is missing.
4a. Must refuse with `protected-list` when the diff touches any of the judge's own inputs and control modules (the clearance decision, the runner and its siblings, the switch-store code, the provider-identity source) — a PR cannot rewire the judge and clear itself.
5. Must refuse (`error`) on any internal error — fail closed. Must treat docs, config, data and backlog files in the diff the same as code for the protected-list and secret checks (no "it is only prose" exemption).
6. Must return `allowed: true` only when every check passes.

## Done when

1. **Executable — Musts 1–6:** a Vitest run of `we:scripts/lib/__tests__/judge-clearance.test.mjs` passes; the test file does not exist before this item.
2. **Executable — leash:** a Vitest run of `we:scripts/lib/__tests__/gate-invariants.test.mjs` passes with a new assertion that `JUDGE_PROTECTED` covers every `TRUST_CHAIN` member and that the judge decision module is a policy-tier member.

## Test plan

New `we:scripts/lib/__tests__/judge-clearance.test.mjs` (matching source: `we:scripts/lib/judge-clearance.mjs`), table-driven over a fixture PR:

- **A protected-list PR is never judge-cleared:** one case per class — a diff touching `we:scripts/review-set-label.mjs`; `we:scripts/merge-ai-prs.mjs`; `we:scripts/lib/github-app-token.mjs`; a local env file; `we:scripts/guard-bash.mjs`; `we:.claude/settings.json`. Each is refused `protected-list` even when every other check is clean. Red today: `decideJudgeClearance` does not exist.
- An added line carrying a fake token that matches `SECRET_PATTERNS`, in an otherwise unprotected doc file → `secret-in-diff`. Red today: `decideJudgeClearance` does not exist.
- **An author-provider judge is refused:** dispatch run record `provider=anthropic`, judge provider `anthropic` → `same-provider`; record `codex`, judge `anthropic` → passes this check. Red today: `decideJudgeClearance` does not exist.
- **Provider is never read from author-editable text:** a PR body carrying a forged `provider=codex` delegation marker, with no dispatch run record → `independence-unknown`; the same forged marker with a record saying `anthropic` → `same-provider`; a record saying `codex` while the PR commits carry a Claude co-author trailer → `independence-unknown`. Red today: `decideJudgeClearance` does not exist.
- **The judge's own modules are protected:** one case per group — a diff touching `we:scripts/lib/judge-clearance.mjs`; `we:scripts/operations/judge-clear.mjs`; `we:scripts/lib/judge-switches.mjs`; `we:scripts/operations/dispatch-lane.mjs` → each `protected-list`. Red today: `decideJudgeClearance` does not exist.
- Judge actor equal to the author's `authored-by-actor` id, or to a reviewer's `cleared-by-actor` id → `same-actor`. Red today: `decideJudgeClearance` does not exist.
- No delegation marker, or no author stamp → `independence-unknown`. Red today: `decideJudgeClearance` does not exist.
- **The kill switch blocks:** `judgeEnabled: false` → `kill-switch`, before any other check. Red today: `decideJudgeClearance` does not exist.
- **The wait switch off → immediate:** `waitHours: 0` with the park one second old → allowed; `waitHours: 4` with the park one hour old → `wait-not-elapsed`; `waitHours: 4` with `parkedAt: null` → `wait-not-elapsed` (`parked-time-unknown`); `waitHours: 0` with `parkedAt: null` → allowed. Red today: `decideJudgeClearance` does not exist.
- An advisory that covers an old head only → `reviewers-not-accepted`; a live `review:changes` → the same. Red today: `decideJudgeClearance` does not exist.
- `changedPaths` missing, or flagged `truncated` → `protected-list` (`changed-paths-incomplete`), even when every listed path is harmless. Red today: `decideJudgeClearance` does not exist.
- A malformed input that throws → `error`, `allowed: false`. Red today: `decideJudgeClearance` does not exist.
- All checks clean → `allowed: true`. Red today: `decideJudgeClearance` does not exist.

Extend `we:scripts/lib/__tests__/gate-invariants.test.mjs` with the leash assertion in Done-when 2.

Extend `we:scripts/lib/__tests__/gate-config.test.mjs` (matching source: `we:scripts/lib/gate-config.mjs`):

- `JUDGE_PROTECTED` matches one sample path per class (a), (b) and (c), and does not match a plain `backlog/` card or a `src/_data/` entry. Red today: `JUDGE_PROTECTED` does not exist.
- Every existing `gate-config` case unchanged. Preservation: green today; mutation proof — drop a `TRUST_CHAIN` entry and the existing roster cases fail.

## Proof plan

Write the test file first and run it against the missing module to capture the failure. After the build, run that file and the gate-invariants suite and paste the output into the PR. Then run `decideJudgeClearance` from a one-off node script in the lane against two real open PRs' `gh pr view --json files,labels,body,comments` data — one touching a protected path, one docs-only — and show `protected-list` for the first and the real outcome for the second. Finally `npm run check:standards`. This PR edits `we:scripts/lib/gate-config.mjs`, so it parks on `review:human` and must be cleared by the human: it is on the protected list by design.

## Follow-ups

- The judge-side "weakens a security check" reading is in `xq3kn88`'s prompt, not here.
- If a protected class proves too wide in practice (many docs-only PRs refused), narrow it by a new ruling, not an edit.

## Progress

- Prepared 2026-10-03 against the live code: `we:scripts/lib/review-independence.mjs` (author and clearer actor markers, fail-closed independence), `we:scripts/lib/delegation-marker.mjs` (author provider and model on the PR body), `we:scripts/lib/advisory-labels.mjs` (`advisoryCoversHead`), `we:scripts/lib/gate-config.mjs` (`TRUST_CHAIN`, the `POLICY_SPEC` floor), `we:scripts/lib/secret-scrub.mjs` (`SECRET_PATTERNS`).
- Scope widened from the three filed paths to add `we:scripts/lib/__tests__/gate-invariants.test.mjs` (the suite that pins the leash) and `we:scripts/lib/__tests__/gate-config.test.mjs` (the tracked test of the edited roster).
