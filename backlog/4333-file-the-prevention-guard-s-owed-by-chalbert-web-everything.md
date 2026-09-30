---
bornAs: xrm17bt
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/rearm-review.mjs", "we:scripts/review-set-label.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs", "we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/conveyor/__tests__/rearm-review.test.mjs", "we:scripts/__tests__/review-set-label.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "a3c0a91aa598975278b069804080e07bda640b71"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2826's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-red-recovery-watch.mjs:461` — Add a unit test for reconcileAcceptanceAfterRebase that uses the REAL restampAcceptance/spawnCiHealRearm (only mocking spawnSync) with repo:null, asserting the child argv never contains the literal string 'null' as a --repo value -- the same class of gap every other 'falsy repo omits --repo' call site in this file already has covered by convention but not by an automated check.
2. `we:scripts/conveyor/ci-heal-mark.mjs:160` — Add an accepted-only rearm mode validated at the child's mutation boundary, with a deterministic interleaving test that changes accepted to changes between caller and child reads and asserts that changes remains.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2826@a028856115b05f478e82eb3071e4c25a887c4c04

## Premise check

Both owed guards still apply on current `main`: `reconcileAcceptanceAfterRebase` (`we:scripts/conveyor/ci-red-recovery-watch.mjs:463`) has no test using the real `restampAcceptance`/`spawnCiHealRearm` (its tests at `we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs:290-342` all inject `restamp`/`rearm` mocks), and `spawnCiHealRearm` (`we:scripts/conveyor/ci-heal-mark.mjs:143`) always shells `we:scripts/conveyor/rearm-review.mjs`, whose `rearm` target (`we:scripts/review-set-label.mjs:339`) accepts `review:changes` OR `review:accepted`. Nothing on `main` limits a rearm to `accepted` only.

## Design

**Guard 1 (argv never carries a literal `null` repo).** `reconcileAcceptanceAfterRebase` defaults `repo = null` and passes it to `restampAcceptance` (`we:scripts/merge-ai-prs.mjs:774`), which builds `` `--repo=${repo}` `` UNCONDITIONALLY (line 778) — a `null` repo therefore yields the argv `--repo=null`. `spawnCiHealRearm` guards with `if (repo)` (`we:scripts/conveyor/ci-heal-mark.mjs:145`), so only the restamp side is exposed. A `--repo=null` child fails `REPO_RE` in `runReviewLabelCli` and fails closed, so the restamp ALWAYS fails for a null repo and the watcher always falls through to `rearm`, losing a content-preserving carried acceptance: a real defect, so Guard 1 is deterministically RED and includes the fix. Call the REAL `reconcileAcceptanceAfterRebase` with `repo: null`, `readLabels` returning `review:accepted`, and NOT injecting `restamp`/`rearm`; make both real functions' child spawn observable by wrapping them (`(a) => restampAcceptance({ ...a, spawn: fakeSpawn })`, `(a) => spawnCiHealRearm({ ...a, spawn: fakeSpawn })`) so only `spawnSync` is mocked (the fake returns non-zero for the restamp child so `rearm` is reached and its argv is captured too). Assert no captured argv element matches `/^--repo=(null|undefined)$/` or equals `'null'`. Fix `restampAcceptance` to omit `--repo` when falsy (matching `spawnCiHealRearm`) — a one-line guard in `we:scripts/merge-ai-prs.mjs` (in scope), with a restamp-argv test in its existing restamp test file.

**Guard 2 (accepted-only rearm validated at the child's mutation boundary).** `spawnCiHealRearm` is called by the CLI (`we:scripts/conveyor/ci-heal-mark.mjs:210`) after the caller's own label read saw `accepted`; the child (`we:scripts/conveyor/rearm-review.mjs` → `runReviewLabelCli`, `we:scripts/review-set-label.mjs:995`) does a FRESH `provider.readPrState` and applies `decideSetLabel({to:'rearm'})`, which also re-arms a `review:changes` bounce. If a reviewer flips `accepted → changes` between the caller's read and the child's read, the heal hand-back would wrongly swap that live `changes` verdict to `pending`. Fix: add an opt-in `--only-if=accepted` flag to `we:scripts/conveyor/rearm-review.mjs`, threaded into `decideSetLabel` as a new `requireLive: 'accepted'` input on the `rearm` branch, which refuses (`allowed:false`, nothing written) when `review:accepted` is not live in the CHILD's own read. `runReviewLabelCli` parses its own argv, so it gets a new `--only-if` parse that fails closed on any value other than `accepted`; `decideSetLabel`'s param docs and the rearm refusal reason are updated. This SHRINKS the race window to the child's read-to-write gap (the check is not atomic with `provider.setLabels`); it does not fully close it — residual race is a Follow-up. `spawnCiHealRearm` gains an `onlyIfAccepted` option (default true for both existing callers — both only ever rearm a stale acceptance) that appends `--only-if=accepted`. The decision lives in the pure `decideSetLabel`, so the validation is at the mutation boundary, not the caller.

## MVP

Musts only:
1. Test: real `reconcileAcceptanceAfterRebase` + real `restampAcceptance`/`spawnCiHealRearm`, `spawnSync` faked, `repo:null` → no argv carries a literal `null` repo plus the `restampAcceptance` omit-`--repo`-when-falsy fix it proves necessary.
2. `--only-if=accepted` on `we:scripts/conveyor/rearm-review.mjs` + `requireLive` in `decideSetLabel`'s rearm branch + `spawnCiHealRearm` passing it.
3. Deterministic interleaving test: through `runReviewLabelCli` with a stub provider that returns `accepted` on the caller's read and `changes` on the child's read, the child refuses and `setLabels` is never called (`changes` remains).

Out of scope (Follow-ups): the other `restampAcceptance` callers' repo handling; a general TOCTOU harness for all label writers; the same guard for `restamp`.

## Test plan

- `reconcileAcceptanceAfterRebase — real restamp/rearm children never receive a literal null repo` (`we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs`) — RED before: `restampAcceptance` emits `--repo=null`.
- `restampAcceptance omits --repo when repo is falsy` (`we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs`) — RED before, same cause.
- `decideSetLabel rearm with requireLive:'accepted' refuses when only review:changes is live` (`we:scripts/__tests__/review-set-label.test.mjs`) — RED before: the parameter does not exist, so rearm is allowed.
- `decideSetLabel rearm with requireLive:'accepted' still re-arms a live review:accepted` — the positive case (NON-RED: passes before too; a regression guard).
- `runReviewLabelCli interleaving: only-if=accepted, child's read returns changes → refused, setLabels never called` (covers caller-read→child-read only, not the child's read-to-write gap) (`we:scripts/__tests__/review-set-label.test.mjs` or `we:scripts/conveyor/__tests__/rearm-review.test.mjs`) — RED before: `--only-if=accepted` is ignored and `changes → pending` is written.
- `spawnCiHealRearm passes --only-if=accepted by default and omits it when onlyIfAccepted:false` (`we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs`) — RED before: argv lacks the flag.
- `we:scripts/conveyor/rearm-review.mjs` without the flag still re-arms `review:changes` (NON-RED regression guard for the fix-agent path, `we:scripts/conveyor/__tests__/rearm-review.test.mjs`).

## Proof plan

Live, on the real modules: (1) run the new named tests and paste the pass output; (2) BEFORE/AFTER on the interleaving: run the `we:scripts/conveyor/rearm-review.mjs` logic through the stub-provider test with the flag stripped from the child argv and show the `changes → pending` write happen (RED), then with the flag show the refusal `{ok:false, reason}` and zero label writes; (3) print the actual argv captured by the Guard 1 test to show no `null` value.

## Follow-ups

- Close the residual child read-to-write race (post-write re-read that reports a mismatch, or an atomic label swap).
- Audit every other `--repo=${repo}` template in `scripts/` for unconditional interpolation of a nullable repo.
- Extend the `requireLive` boundary check to `restamp` and other child label swaps.

## Done when

1. **Executable** — run vitest on the four test files listed in the scope (review-set-label, ci-heal-mark, ci-red-recovery-watch, rearm-review) with `-t "requireLive|only-if|null repo|interleaving"` fails before the change and passes after.
