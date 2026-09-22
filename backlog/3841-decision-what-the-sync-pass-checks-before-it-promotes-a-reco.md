---
bornAs: x86eyvl
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/conveyor/poc-branch-sync.mjs", "we:scripts/conveyor/branch-sync.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "8154ea239d1b07d02060f7c265ef59f1c66f40da"
tags: []
---

# Decision: what the sync pass checks before it promotes a reconcile agent's resolution that changed tests or gate files

Security finding 6 of the advisory review on PR #2415 (the #3804 ruling): the promotion gate (a true fast-forward plus tests green at that commit) does not stop the reconcile agent from editing the tests or gate config it is judged by; today only the agent brief forbids it. Ruling the guard is a real choice between stricter-than-ratified and brief-only. Relates #3804, #3607, #3797, we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync.

This card does NOT reopen #3804. The ratified promotion (point 2 of `#poc-branch-mechanical-sync`: a true fast-forward, the tests green at that exact commit as the pass itself runs them, the same lock and `autoSync` gate) stands. The question is whether the pass adds one more check before it promotes, and how strict it is. Filed 2026-09-21 by the follow-up session to PR #2415 (session followup-3804), from the draft of the cancelled fix worker `fix-pr-2415`.

## FOUND (2026-09-21)

- **The only guard is prose.** #3804 Fork 2 (a) names the residual risk: "the agent that resolves a conflict in a test file could weaken the test to make it pass. The agent's brief must send any resolution that changes a test's assertions back as a decision card." Statute point 2 repeats it as a brief rule. Nothing the pass runs checks it.
- **The attack, from the advisory review.** The agent weakens or deletes an assertion, or edits a test, `vitest` or `check:standards` config or a gate script, so the staging ref goes green. It may be steered there by text in conflicting content from `main`. The pass sees green and fast-forwards the shared branch with no human review. Likelihood low, failure silent.
- **Blast radius.** The prototype branch only. A slice reaches `main` only through its own pull request, review and CI (#3443 Done-when 3; statute clause 3 of `#poc-branch-declared-delivery-mode`).
- **What the base had.** Before #3804, the operator fast-forwarded the staging ref by hand for the first catch-up (#3803), which was a human check on the resolution. #3804 Fork 2 (b), the manual fast-forward, was rejected on merit: the alert sat unread for a week.
- **No alert state exists for a refusal.** The ratified lines are `agent-failed`, `gate-red` and `unknown` (#3804 Fork 3 wording spec). A refusal by a new check needs its own line, ruled with it.

## Fork 1 — What the pass checks about test and gate files before it promotes

*Fork-existence:* the pass either inspects what the resolution did to the files it is judged by, or it does not; a check that runs only sometimes is not a guard. "Tests green" cannot be the check on its own, because the tests are among the files the agent may change.

- **(a) Nothing beyond the ratified gate; the brief rule is the guard.** As ratified today. Rejected: the guard is an instruction to the same agent it guards against, so an injected or mistaken agent that ignores it is caught by nothing before the shared branch moves. The cover left is the graduation review, which sees a slice, not the resolution.
- **(b) The pass refuses promotion whenever the resolution changes any test file, `vitest` or `check:standards` config, or gate script, compared with what a plain merge of the two parents would produce.** The advisory review's proposal. Rejected: a conflict in a test file (the first catch-up had one, `we:scripts/operations/__tests__/http-adapter.test.mjs`) always needs a hand resolution of that file, so every such conflict goes to the operator. That rebuilds the human step Fork 2 (b) of #3804 was rejected for, for the most common kind of conflict.
- **(c) The pass refuses promotion when the agent changed a test file, `vitest` or `check:standards` config, or gate script OUTSIDE the conflicting file set — recommended.** Files inside the conflicting file set (`git merge-tree --name-only`, the same set the one-attempt cap is keyed on) must be resolved by hand, so a change there is expected and promotes on green. A change to such a file the merge did not conflict on has no reason to exist, so the pass refuses it, pushes nothing, and raises a new alert line. **Residual risk, named:** an assertion weakened inside a conflicting test file still promotes on green; the brief rule and the graduation review stay its cover. Covers the injected-edit case the advisory review names, where the agent edits a gate file that was not in conflict.

**Fork 1 sub-fork — the alert line for a refusal (only if (b) or (c) is ruled).** Proposed exact line, in the style of #3804 Fork 3's spec:

| State | The line, exactly |
| --- | --- |
| `gate-files-changed` | ⚠ Prototype sync held for {age}: the resolution of the merge into {branch} changes test or gate files the check does not allow ({files}), so nothing was pushed. Next: review those files on {staging}; revert them, or resolve the merge by hand. |

- **(a) Add this fourth line to the Fork 3 spec — recommended.** It is raised only when the operator must act, like the other two, and it names the files.
- **(b) Reuse the `gate-red` line.** Rejected: its next step, "fix the tests", is wrong when the tests pass, and it hides that the pass refused a green run.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Merit attack on (c): it does not stop the exact case the advisory review leads with, an assertion weakened inside a conflicting test file. Accepted: now named as (c)'s residual risk, with the brief rule and the graduation review as its cover; (b) is the option that closes it, at the cost stated in its rejection. Classification attack: this is a build detail of #3607. Refuted: each option changes what reaches the shared branch without a person and whether the operator gets a new alert, which the operator sees. *Inline, this session's own attacks; no independent `judgePanel` run.*
**Screen:** clear. Policy the pipeline and the operator see; the file lists are examples, the exact globs are the build's.

## Done when

1. **Executable** — `grep -l '^## Ruling' backlog/*what-the-sync-pass-checks-before-it-promotes*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for Fork 1 and, if (b) or (c), its sub-fork).
2. The ruling is written into #3607 Done-when 8 (a named test row for the check), into point 2 of `we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`, and, for a new line, into the #3804 Fork 3 wording spec that #3835 builds.
