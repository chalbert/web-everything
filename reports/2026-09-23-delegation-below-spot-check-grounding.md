# Can a delegated vendor graduate below `spot-check`? — grounding for #3867

Date: 2026-09-23. Grounds decision `#3867` (reopen rule 7 of
`we:docs/agent/platform-decisions.md#delegation-trial-record-graduation`). Builds on
`we:reports/2026-09-20-delegation-graduation-model-grounding.md` (the #3690 survey) rather than repeating it.

## 1. What `spot-check` already is

- `SUPERVISION_LEVELS` has two values, `full` and `spot-check` (`we:scripts/lib/provider-routing.mjs:138-141`).
  `selectSupervisionLevel` returns `spot-check` only on the last branch (`:745`); every other branch is `full`
  (`:736`, `:739`, `:742`).
- Rule 7 defines `spot-check`'s independent pass **by reference** to
  `#every-pr-gets-a-look-advisory-floor` (#3313): one tool-free juror, one round, the diff and the item card,
  capped findings, non-blocking.
- #3313 applies that floor to **every PR** that trips no escalation reason, whoever built it. So a delegated
  triple at `spot-check` is already checked exactly as lightly as an ordinary Claude-built PR. It is at parity,
  not above it.
- #3313 states the floor's bar is "catch the obvious", measured "against zero, not against a full reviewer".
  It is already the minimum-depth independent look the repo recognises.

**Consequence:** "lighter than spot-check" can only mean one of three things.

| Candidate | What it is | Where it is already ruled |
| --- | --- | --- |
| No independent pass | zero coverage for the graduated triple | #3690 Fork 5 (b), rejected; #3313 "capacity floor is never zero" |
| Sample the triple's diffs | coverage < 100%, e.g. 1 in N | #3313 "never a random sample of a few" (three reasons given) |
| A shallower juror than the floor | e.g. cheaper model, fewer findings | not a tier: it is the floor's own cost dial, which #3313 owns and measures for all PRs |

## 2. Was a third tier considered in #3690?

Yes, in its strongest form. #3690 Fork 5 (b) — "drop the independent pass entirely at spot-check" — was the
card's own 2026-09-15 proposal and its earlier recommended default. The prep skeptic refuted it against #3313
and it was rejected before ratification (see `#3690` Fork 5, "Skeptic: SURVIVES-WITH-AMENDMENT"). A tier
*between* the floor and zero was never named, because the floor is already the shallowest non-sampled look.
Rule 7's floor is therefore a considered floor, not a leftover of the `full`/`spot-check` pair.

## 3. What fails if the independent look goes away

- **Demotion stops being reachable.** Rule 6 says demotion is computed from the record and a confirmed miss
  resets the triple (rule 3). A miss is confirmed mostly by the independent pass. Remove it and the triple's
  record stops receiving misses, so the computed demotion can no longer fire. Promotion becomes one-way.
- **The positive control disappears.** Rule 4's `informative` field means "independent review found a real
  problem that was then fixed". No independent review, no informative trials. The re-graduation bar (rule 5)
  also depends on them.
- **The remaining check is not independent.** Layer 1 (the orchestrator reading the diff and the gate output,
  `#model-routing` Inline (2) and (5)) is the party that chose to delegate.
  `#agent-convergence-independent-validation` clause 1: independence rests on "a distinct fresh validator".
- **The exit code hides failure.** `we:scripts/codex-direct-task.mjs` exits 0 on timeout, on a gate FAIL, and
  when the agent commits despite instruction (#3690 Fork 5 crux). Layer 1 must read the report fields; an
  unreviewed path has only that read.

## 4. Composition with the repo axis (rule 6)

- Rule 6: the repo axis says whether a repo permits staged autonomy at all; a repo-level `none` is never
  overridden by a triple's level. There is no code for the repo axis yet — it is prose only
  (`we:docs/agent/platform-decisions.md:4967-4974`).
- A third tier would be a triple-axis value, so rule 6's precedence would still hold.
- One real hazard: the obvious name for "no independent check" on the triple axis is `none`. On the repo axis
  `none` means the opposite — **no** autonomy, maximum checking. Two axes with a shared value name meaning
  opposite things is a misreading waiting to happen. This is a naming hazard, not a composition break.

## 5. Prior art — is the independent look ever removed on track record?

| System | Does a clean record remove the per-item check? | What actually moves |
| --- | --- | --- |
| ANSI/ASQ Z1.4, ISO 2859-1 | No. Reduced inspection still samples every lot; any rejected lot returns to normal. | sample size |
| ISO 2859-3 skip-lot | Yes, for whole lots, after qualification; one rejected lot returns to lot-by-lot. | coverage (a sampler) |
| Renovate automerge / Dependabot | Removes human review for chosen **update types** (lockfiles, devDeps, digests), with CI and `minimumReleaseAge`. | change class, not producer record |
| SLSA source track | Two-party review; an org MAY give a "Trusted Robot" a perpetual exception by governance act. | named exception, not earned |
| Google code review | Every change needs an LGTM; readability only waives the readability co-signer. | who co-signs |
| Chromium Rubber Stamper | Auto-approves clean reverts, clean cherry-picks, benign files; never gives OWNERS approval. | change class, not author |
| SAE J3016 L3→L4 | The human fallback goes away by ODD capability definition, not by accumulated mileage. | scope definition |
| Copilot coding agent, Codex, Devin, Claude Code review | None let agent PRs merge with no review on track record (Sept 2026). | nothing |

Sources:
[Z1.4 switching rules](https://www.sqconline.com/switching-rules-mil-std-105e-z14) ·
[ASQ Z1.4/Z1.9](https://asq.org/quality-resources/z14-z19) ·
[ISO 2859-3](https://www.iso.org/standard/34684.html) ·
[Renovate automerge](https://docs.renovatebot.com/key-concepts/automerge/) ·
[Renovate minimumReleaseAge](https://docs.renovatebot.com/key-concepts/minimum-release-age/) ·
[SLSA source requirements](https://slsa.dev/spec/v1.2/source-requirements) ·
[SWE at Google ch. 9](https://abseil.io/resources/swe-book/html/ch09.html) ·
[Chromium Rubber Stamper](https://chromium.googlesource.com/infra/infra/+/refs/heads/main/go/src/infra/appengine/rubber-stamper/) ·
[SAE J3016](https://blog.ansi.org/ansi/sae-levels-driving-automation-j-3016-2021/) ·
[GitHub Copilot code review](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agents/code-review) ·
[Codex approvals](https://developers.openai.com/codex/agent-approvals-security) ·
[Devin review](https://docs.devin.ai/work-with-devin/devin-review).
(Exact ISO 2859-3 qualification numbers were not confirmed from full text.)

**The shaping finding.** Where real systems do drop the per-item independent look, they key it to the
**class of change** (a pure revert, a lockfile bump), applied to every producer alike — not to the
**producer's track record**. The only record-keyed case, skip-lot, is a sampler, which #3313 already
rejected for this repo. Producer record moves *depth* (sample size, tightened/normal/reduced), never
coverage to zero.

## 6. Verdict for the item

**No** — do not amend rule 7. Both forms of the proposal (absent, lighter tier) are either already excluded
(#3690 Fork 5 (b), #3313) or are the floor's own cost dial, which is builder-neutral and owned by #3313's
cost/yield measurement. The only coherent route to "less checking for some delegated diffs" is a
change-class exemption from the #3313 floor for every builder — a different question that amends #3313, not
rule 7.

## 7. Skeptic amendments (folded into #3867)

- A fourth reading of "lighter": rely on the delegated PR's own review only. That is already what
  `spot-check` is — the trial row is written on `review:accepted` (`we:scripts/review-set-label.mjs:1024-1043`).
- **Known gap:** `we:scripts/review-set-label.mjs:1030` logs a trial only while the triple is not graduated,
  always as a clean `landed` row, so demotion is already unreachable at `spot-check`.
  `we:scripts/conveyor/delegation-trial-gate.mjs:15` infers "informative" from free-text findings and `:23`
  hard-codes `streak >= 5`. Filed as a separate build, linked from #3867.
- #3313's floor binds PRs that trip no escalation reason (`we:docs/agent/platform-decisions.md:4328`); a PR
  that trips one gets more. The codified note was reworded so it does not overstate this.
