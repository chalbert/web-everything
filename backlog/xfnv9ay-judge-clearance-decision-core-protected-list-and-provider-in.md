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
- `wait-not-elapsed` — `input.switches.waitHours > 0` and less than that many hours have passed since the PR was parked on `review:human`. With `waitHours` 0 or absent the check is skipped (default off, so a clear is immediate).
- `not-human-gated` — the PR does not carry `review:human`.
- `reviewers-not-accepted` — no `advisory:accepted` covering the current head (reuse `advisoryCoversHead` and `latestAdvisory` from `we:scripts/lib/advisory-labels.mjs`), or a live `review:changes`, or red CI.
- `protected-list` — a changed path matches the protected list (below); the matching paths go in `detail`.
- `secret-in-diff` — an added line matches `SECRET_PATTERNS` or a high-entropy token from `we:scripts/lib/secret-scrub.mjs`.
- `independence-unknown` — the author provider or author actor cannot be read. The author provider comes from the delegation marker (`parseDelegationMarker` in `we:scripts/lib/delegation-marker.mjs`) — today only non-Claude builds carry one (`delegationForBuild` in `we:scripts/operations/deliver-item-wrapper.mjs`) — and otherwise is `anthropic` when the PR's commits carry the Claude co-author trailer (`isAiCommit` in `we:scripts/lib/ai-pr-authorship.mjs`). Neither present → unknown. The author actor comes from `parseAuthorActorId` in `we:scripts/lib/review-independence.mjs`.
- `same-provider` — the judge provider equals the author provider.
- `same-actor` — the judge actor id equals the author actor, or any reviewer actor recorded on the PR (`cleared-by-actor` markers and the advisory reviewer id).

Checks run in that order; the first refusal wins. Any error thrown inside the function is caught and returned as `refusal: 'error'`, `allowed: false` (fail closed).

**The protected list lives in the leash, not in the new module.** Add `JUDGE_PROTECTED` to `we:scripts/lib/gate-config.mjs`. That file is on the `POLICY_SPEC` floor, so every later edit to the list is itself human-gated and judge-protected:

- **(a) merge/approval logic** — every `TRUST_CHAIN` member (`isTrustChainPath`), plus `we:scripts/review-set-label.mjs`, `we:scripts/pr-land.mjs`, `we:scripts/operations/record-verdict.mjs`, `we:scripts/operations/review-dispatch.mjs`, `we:scripts/lib/advisory-labels.mjs`, `we:scripts/lib/verdict-ledger.mjs`, and the judge's own modules (`we:scripts/lib/judge-clearance.mjs`, `we:scripts/lib/judge-switches.mjs`, `we:scripts/operations/judge-clear.mjs`, `we:scripts/operations/judge-arbitrate.mjs`, `we:scripts/conveyor/judge-pass.mjs`).
- **(b) credentials and secrets** — `we:scripts/lib/github-app-token.mjs`, any env file (a basename starting with a dot and containing `env`), and any path whose basename matches `secret|token|credential|password|pem|key` outside the `backlog/`, `reports/` and `src/` content trees.
- **(c) security checks** — the guard hooks (`we:scripts/guard-bash.mjs` and its `guard-*` siblings in the same folder), `we:.claude/settings.json`, the git hooks folder `we:.githooks`, `we:scripts/lib/secret-scrub.mjs`, and `we:scripts/rust-scan/src/secret_scrub.rs`. Path matching is the deterministic floor; the judge prompt (`xq3kn88`) adds the judgment half ("does this weaken a security check?") and must refuse on doubt.

Also register `we:scripts/lib/judge-clearance.mjs` as a policy-tier `TRUST_CHAIN` member so its own edits escalate.

## MVP

1. Must refuse with `protected-list` when any changed path is in class (a), (b) or (c), naming the paths.
2. Must refuse with `same-provider` when the judge provider equals the author provider, and with `same-actor` when the judge actor is the author or a recorded reviewer.
3. Must refuse with `independence-unknown` when the author provider or actor cannot be read — never assume independence.
4. Must refuse with `kill-switch` when the judge is off, and must apply no wait when `waitHours` is 0 or absent.
5. Must refuse (`error`) on any internal error — fail closed. Must treat docs, config, data and backlog files in the diff the same as code for the protected-list and secret checks (no "it is only prose" exemption).
6. Must return `allowed: true` only when every check passes.

## Done when

1. **Executable — Musts 1–6:** a Vitest run of `we:scripts/lib/__tests__/judge-clearance.test.mjs` passes; the test file does not exist before this item.
2. **Executable — leash:** a Vitest run of `we:scripts/lib/__tests__/gate-invariants.test.mjs` passes with a new assertion that `JUDGE_PROTECTED` covers every `TRUST_CHAIN` member and that the judge decision module is a policy-tier member.

## Test plan

New `we:scripts/lib/__tests__/judge-clearance.test.mjs` (matching source: `we:scripts/lib/judge-clearance.mjs`), table-driven over a fixture PR:

- **A protected-list PR is never judge-cleared:** one case per class — a diff touching `we:scripts/review-set-label.mjs`; `we:scripts/merge-ai-prs.mjs`; `we:scripts/lib/github-app-token.mjs`; a local env file; `we:scripts/guard-bash.mjs`; `we:.claude/settings.json`. Each is refused `protected-list` even when every other check is clean. Red today: `decideJudgeClearance` does not exist.
- An added line carrying a fake token that matches `SECRET_PATTERNS`, in an otherwise unprotected doc file → `secret-in-diff`. Red today: `decideJudgeClearance` does not exist.
- **An author-provider judge is refused:** author delegation marker `provider=anthropic`, judge provider `anthropic` → `same-provider`; author `codex`, judge `anthropic` → passes this check. Red today: `decideJudgeClearance` does not exist.
- Judge actor equal to the author's `authored-by-actor` id, or to a reviewer's `cleared-by-actor` id → `same-actor`. Red today: `decideJudgeClearance` does not exist.
- No delegation marker, or no author stamp → `independence-unknown`. Red today: `decideJudgeClearance` does not exist.
- **The kill switch blocks:** `judgeEnabled: false` → `kill-switch`, before any other check. Red today: `decideJudgeClearance` does not exist.
- **The wait switch off → immediate:** `waitHours: 0` with the park one second old → allowed; `waitHours: 4` with the park one hour old → `wait-not-elapsed`. Red today: `decideJudgeClearance` does not exist.
- An advisory that covers an old head only → `reviewers-not-accepted`; a live `review:changes` → the same. Red today: `decideJudgeClearance` does not exist.
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
