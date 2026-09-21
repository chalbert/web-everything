---
bornAs: xxpu8tm
kind: decision
parent: "3383"
status: resolved
relatedTo: ["3674", "3653", "3443", "3768", "3804"]
scope: ["we:.github/workflows/ci.yml", "we:.github/workflows/review-gate.yml", "we:scripts/merge-ai-prs.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
codifiedIn: "docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode"
graduatedTo: none
preparedDate: "2026-09-21"
preparedAgainstSha: "4cd769f889f977d7f7ac67288e585c46c46e4b5b"
relatedReport: reports/2026-09-21-prototype-branch-sync-and-ci-grounding.md
tags: []
---

# Decision: run CI on the prototype branch, change the drain's required check, or neither

Rule whether the prototype branch `lane/mechanical-dispatcher` gets real CI, or whether the drain's hardcoded required check changes, or neither. Today the two cards that raised it (#3674 and #3653) each name one half of the fork and rule nothing. Relates #3674 (the drain stalls forever on a base with no `test` check; two candidate fixes, "not deciding here"), #3653 (allow CI for POC branches) and #3443 (graduation: each slice gets its own reviewed pull request to `main`).

*Prepared 2026-09-21 (session prepare-3804-and-3805).* Research topic: [/research/prototype-branch-sync-and-ci/](/research/prototype-branch-sync-and-ci/). Session report: `we:reports/2026-09-21-prototype-branch-sync-and-ci-grounding.md`. Numbers re-measured on 2026-09-21; main at `d6c7f6237`, the branch at `5ab89f87b`.

## Why this is on the critical path

This card gates lines 2 and 3 of the health chain in #3383's `## Priority order` (#3653, #3674). The Priority order's rule 1 says nothing may graduate before the health chain. The worker `build-3653` stopped itself on 2026-09-21 because #3653's card says to hold until this ruling.

## FOUND (re-verified 2026-09-21)

- **CI never runs on the prototype.** `we:.github/workflows/ci.yml:43-47` triggers on `push` and `pull_request` for `branches: [main]` only; `we:.github/workflows/review-gate.yml:43-46` on `pull_request` for `branches: [main]` only. `gh api repos/chalbert/web-everything/branches/lane%2Fmechanical-dispatcher/protection` returns 404 (no protection rule). The branch tip `5ab89f87b` has `total_count: 0` check runs. Main requires `["test","smoke"]`.
- **A workflow filter cannot read the registry.** GitHub's docs: the patterns in `branches` "are evaluated against the Git ref's name" and accept globs; they are static YAML. `we:scripts/lib/poc-branches.json` cannot drive them. The docs also say: "If a workflow is skipped due to branch filtering … checks associated with that workflow will remain in a 'Pending' state." The stopped `build-3653` worker reached the same conclusion: the workable forms are a static list, or a broad trigger (`lane/**`) plus a first job that reads the registry.
- **The drain and the pull-request lander disagree.** `classifyPr` (`we:scripts/merge-ai-prs.mjs:577`) defaults `requiredCheck = 'test'` and calls `isRequiredCheckGreen` (`we:scripts/merge-ai-prs.mjs:462`), so a pull request on a base where `test` never runs waits forever with no error. `classifyChecks` in `we:scripts/pr-land.mjs:508-509` treats zero required checks as `passed` (`no required checks`). The drain's `--base=` filter exists (`we:scripts/merge-ai-prs.mjs:73`, `we:scripts/merge-ai-prs.mjs:3548`); its default is any base.
- **Nobody opens pull requests against the prototype any more.** `gh pr list --base lane/mechanical-dispatcher --state all` shows the last one opened was #2264 (2026-09-15, closed). None is open. Across all three constellation repos, the only non-main PR bases ever used are `lane/mechanical-dispatcher` and one unmerged `lane/skill-integration-gate`. The prototype PRs GitHub shows as merged were not landed by the drain: #2156, #2220 and #2223 were marked merged once their commits were pushed straight to the branch (2026-09-19 to 09-20); #2236 was superseded by a `poc-land` landing; #2198 went through `WE_MERGE_BREAK_GLASS=1`. Prototype work lands by direct push. The statute `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode` clause 2 makes the item's own tests the only gate inside a POC branch. Clause 3 runs the full process once, at the graduation pull request to `main`. `we:scripts/operations/poc-land.mjs` is the gated landing path (it runs the item's tests through `we:scripts/verify-lane.mjs`).
- **The branch's own health is much better than the card said.** `npm run check:standards` on a clean checkout of `5ab89f87b` today reports **1 error** (an opaque-token finding in the #3383 card) and 1815 warnings, not the 15 errors #3768 recorded on 2026-09-20.
- **The drain has a statute contract.** `we:docs/agent/platform-decisions.md#repo-drain-check-contract` (#2315): a repo owes the drain one green required check named `test`, and the drain reads only its name and conclusion.
- **Precedent for the workaround.** #3674 records PR #2198 landing through `WE_MERGE_BREAK_GLASS=1` after the tests were run locally (2026-09-14).

## Prior art, in one paragraph

CI is load-bearing where code enters the protected line. GitHub's merge queue tests each change "with the latest version of the `base_branch`" on a temporary branch and gates the protected branch on it. Trunk-based development keeps changes flowing one way, trunk to branch, and tests at the trunk. gitworkflows(7) keeps integration branches throw-away and never bases work on them. None of these gate a throw-away or prototype line with the protected line's full suite. Full survey on the research topic.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — where the prototype's check comes from | **(c) neither: CI runs at the graduation pull request to `main`; #3653 closes as superseded, #3674 through Fork 2's build** | (b) relax the drain: it weakens the only writer to `main` and rewrites a statute contract for a base with no pull requests |
| 2 — a pull request opened against the prototype anyway | **(a) the drain holds it with a named reason** | (b) leave it stalling silently: the defect #3674 was filed for |

## Supported by default — not forks

- **Main's CI is unchanged.** `push` and `pull_request` on `main` keep `test` and `smoke`. Every graduation slice gets them.
- **Landings inside the prototype are gated by the item's own tests.** Statute clause 2, not re-decided here.
- **A health signal for the branch itself** (#3768 design point 6, "a check that runs `check:standards` on the branch on every push") stays on #3768. It does not need GitHub CI to exist.

## Fork 1 — Where the prototype's check comes from

*Fork-existence:* (a) and (b) both put a CI gate on landings into the prototype; (c) keeps the prototype's only gate as the item's own tests, as statute clause 2 says. They cannot coexist: a CI gate inside the POC branch either exists or it does not.

- **(a) Run CI on pull requests against the prototype.** Widen both workflows' `pull_request.branches` to include the prototype, either as a static list or as `lane/**` plus a first job that reads the registry. Gives a real, visible `test` on any such pull request (#3653's acceptance). **Cost to graduation:** none saved; each slice still runs CI at its graduation pull request. **Health chain:** #3653 is built, and #3674 closes because `test` now reports. Rejected on merit: it adds a second gate inside the POC branch, which statute clause 2 rules out (the item's own tests are the only gate there, and it says "A landing tax of any shape, however small, is exactly the latency the operator ruled out"), and it would gate only the pull-request path while direct pushes, the actual path, stay ungated, so it certifies nothing about the branch. The card's earlier reason, "15 errors, red on day one", is now weak: the branch is at 1 error. Build note: a workflow filter cannot read the registry; a job skipped by `if:` reports "skipped", while a workflow skipped by a filter stays Pending.
- **(b) Change the drain to read the base's real required checks, as `we:scripts/pr-land.mjs` does.** Zero required checks on a base then counts as passed (#3674 candidate b). **Cost to graduation:** none. **Health chain:** #3674 is built, #3653 closes. Rejected: it edits the gate of the only writer to `main` to serve a base that receives no pull requests. It also rewrites the drain's statute contract (`#repo-drain-check-contract`: one green check named `test`). A bug in "zero checks counts as passed", such as an API error read as zero, would let an unchecked pull request reach `main`. If chosen, it must fail closed on any API error and relax only for a base named in the POC registry, and the statute must be amended.
- **(c) Neither — recommended.** Pull requests are not the delivery path for the prototype. Prototype work lands by direct push or `poc-land`, verified by the item's own tests (statute clause 2). Each slice gets full CI at its graduation pull request against `main` (#3443; statute clause 3), the only place CI is load-bearing. #3653 is resolved as superseded by this ruling. #3674 is resolved by Fork 2 (a)'s build, because its real defect, the silent stall, is what Fork 2 fixes. **Cost to graduation:** none added. **Health chain:** #3653 closes without code and #3674 closes with a one-arm drain change, so graduation waits on #3768 and #3772 (through #3804) only. **What (c) leaves untested, named:** nothing runs a suite on the merged prototype tree; clean sync merges are ungated by design, and `poc-land --skip-verify` has been used (PR #2236's closing comment). The cover is #3768 design point 6 (a `check:standards` run on each push to the branch), which does not need GitHub CI; (c)'s build is ruled together with filing that as a card, so the gap has an owner.

```yaml
# Fork 1 (a), the rejected shape, for contrast: we:.github/workflows/ci.yml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main, 'lane/**']   # static; a first `gate` job must then read poc-branches.json
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Citation scope: clause 2 of `#poc-branch-declared-delivery-mode` reaches this case directly, so it is authority for (c), not only context. Attacks: after (c) nothing tests the merged prototype tree, and #3674's defect is fixed by Fork 2's code, so it is not simply "superseded". Fixed: #3674 now resolves through Fork 2 (a)'s build, and the untested tree is named with #3768 point 6 as its owner. Statute overlap: none; `#repo-drain-check-contract` is untouched by (c).
**Screen:** flagged(prio) → fixed. The first draft rejected (a) mostly on cost ("a path nobody uses", "two hand-kept lists"). Restated on merit: (a) adds a second gate inside a POC branch, which clause 2 rules out, and it gates only the pull-request path while the real path, the direct push, stays ungated.

## Fork 2 — A pull request opened against the prototype anyway

*Fork-existence:* only matters under Fork 1 (c). The drain either says why it will not land such a pull request, or it does not. Silence is broken: it is the defect #3674 was filed for.

- **(a) The drain holds it with a named reason — recommended.** The reason reads `base is not main`, so it shows as held instead of waiting forever. The reason is one more arm in `classifyPr`'s existing skip chain. It compares the PR's base with the repo's default branch (or a registered POC branch's `target`), not a hardcoded `'main'`. No legitimate drain landing is lost: no drain-landed PR has ever had a non-main base (FOUND above), stacked couples share lane tips through manifest `base` shas, not PR bases (`we:scripts/merge-ai-prs.mjs:771-779`), and the PR-create path defaults to `main` (`we:scripts/pr-land.mjs:133`). A `--base=main` flag alone would hide such PRs silently, so the code arm is needed. The drain never lands it; a human who opened it on purpose merges it by hand or re-targets it.
- **(b) Leave it as today.** Rejected: it stalls with no message.
- **(c) Close it automatically.** Rejected: a human may have opened it on purpose.

```js
// Fork 2 (a): one more arm in classifyPr's skip chain (we:scripts/merge-ai-prs.mjs:616-629), ahead of the
// required-check arm, so the named reason wins over "required check "test" is not green".
// `baseRefName` is already in the drain's `gh pr list --json` field list (we:scripts/merge-ai-prs.mjs:3547).
// `defaultBranch` is the repo's default branch, passed in by the caller (not a literal 'main').
else if (pr?.baseRefName && pr.baseRefName !== defaultBranch) { decision = 'skip'; reason = `base is not ${defaultBranch} (${pr.baseRefName}) — POC-branch PRs are not drained (#3805)`; }
else if (!testGreen) { decision = 'skip'; reason = `required check "${requiredCheck}" is not green`; }
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. History attack: does the drain legitimately land non-main-base PRs anywhere? Checked across web-everything, frontierui and plateau-app: no. Classification: a `--base=main` config flag alone would hide such PRs silently, so a code arm is justified. Amendment: compare with the repo's default branch or the POC registry target, not a literal `'main'`.
**Screen:** clear. The operator sees the named hold, so it is not an implementation detail; (c), auto-close, is rejected on merit. (b) is the status quo, kept for contrast.

## Concrete code to read before ruling

`we:.github/workflows/ci.yml`, `we:.github/workflows/review-gate.yml`, `we:scripts/merge-ai-prs.mjs` (`classifyPr`, `isRequiredCheckGreen`), `we:scripts/pr-land.mjs` (`classifyChecks`), `we:scripts/operations/poc-land.mjs`, `we:scripts/lib/poc-branches.mjs`.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (the default's only code change is an arm in the drain, which is gate machinery). This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** under the default, coarse and prefix-shaped — `we:scripts/merge-ai-prs.mjs` ·
`we:scripts/__tests__/merge-ai-prs.test.mjs` · `we:backlog/3653-allow-github-actions-ci-to-be-enabled-for-poc-branches-not-j.md` ·
`we:backlog/3674-lane-mechanical-dispatcher-base-branch-has-zero-ci-stalling.md`. The Fork 2 child takes the
first two and resolves #3674; resolving #3653 as superseded takes its card. Under Fork 1 (a) the touch-set is
instead `we:.github/workflows/ci.yml` + `we:.github/workflows/review-gate.yml` + `we:scripts/lib/poc-branches.mjs`
(#3653's build); under (b) it is `we:scripts/merge-ai-prs.mjs` + `we:docs/agent/platform-decisions.md`.

## Ruling — 2026-09-21 (ratified, operator, in conversation)

1. **Fork 1 → (c) neither.** No CI on the prototype branch and no change to the drain's required check. Prototype work lands by direct push or `poc-land` (statute clause 2); full CI runs at each graduation pull request to `main` (clause 3). The untested-merged-tree gap is owned by #3768's Fork 3 (the recurrence guard, design point 6), which needs no GitHub CI, so no new card is filed for it. #3653 is resolved as superseded, with no code.
2. **Fork 2 → (a) the drain holds it with a named reason.** One more arm in `classifyPr`'s skip chain: a pull request whose base is not the repo's default branch is skipped with `base is not <default> (<base>)`, ahead of the required-check arm. The comparison uses the repo's default branch (passed in by the caller), never a literal `'main'`. #3674 is the build card for this arm and resolves on its landing.

**Codified:** `we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode`, new clause 5.
**Follow-ups:** #3674 (build, rescoped to the drain arm and its test); #3653 (resolved, superseded).

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*run-ci-on-the-prototype-branch*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for both forks).
2. After the ruling, `gh pr list --base lane/mechanical-dispatcher --state open` shows no pull request waiting on a check that cannot run (under (c): the drain reports any such pull request as held with the named reason, #3674 is resolved by that build, and #3653 is resolved as superseded).
