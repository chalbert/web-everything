---
bornAs: xtjsqio
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs", "we:scripts/__tests__/fixer-merge-ancestry.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "3b938896839d2d70b204d1f4f44ae51bb273eac4"
tags: []
---

# Prevention — Add a brief-lint rule in check:standards that fails when a conveyor fix brief contains git rebase, cher… (from chalbert/web-everything#3322 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs` — Add a brief-lint rule in check:standards that fails when a conveyor fix brief contains `git rebase`, `cherry-pick`, or `--force-with-lease` outside an explicit "never" sentence. At minimum, add absence assertions to the policy test.
2. `we:skills-src/conveyor/fix-agent-ci-brief.md` — Add a deterministic check, either a check:standards rule or a policy-test assertion, that conveyor fixer briefs contain no `git push --force*` in executable bash blocks.
3. `we:scripts/__tests__/fixer-merge-ancestry.test.mjs` — Share the isolated Git environment with the recipe subprocess and add a deterministic regression that runs with an external Git configuration containing merge.ff=only.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3322@c7aa2fa1b44bbc78a155994aa95994e697756cac

## Progress

Preparation research against checkout `3b938896839d2d70b204d1f4f44ae51bb273eac4`:

- **Old premise/scope:** the filing suggested a check:standards brief lint (or, explicitly, policy-test absence assertions), named the CI-heal brief as an edit, and cited line 59 of the policy test and line 57 of the ancestry test.
- **Corrected premise:** the guards are still missing, but both fixer briefs already publish ordinary merge and push recipes. The existing test-only alternative satisfies the filed minimum without a new production lint module or a brief edit. The original line citations are superseded by the named test blocks below.
- **Source evidence:** `we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs` contains seven positive wording/order tests, including the CI-heal sanctioned-catch-up test, but no rewrite-command absence assertions. `we:skills-src/conveyor/fix-agent-brief.md:258-269` and `we:skills-src/conveyor/fix-agent-ci-brief.md:165-177` preserve upstream identity with a live-base fetch/merge/ancestry recipe and explicit never-cherry-pick prose. Their pushes are ordinary pushes. `we:scripts/check-standards.mjs:2918-2923` wires the existing relative-tool-path brief check, not this history-rewrite guard.
- **Environment gap:** in `we:scripts/__tests__/fixer-merge-ancestry.test.mjs`, `fixture()` isolates Git with `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=/dev/null`, but the published-recipe test's Bash subprocess independently spreads the ambient process environment. It can therefore inherit external merge policy that fixture setup excluded.
- **Observed probe:** executed the current CI-heal recipe in a disposable diverged local Git repository, substituting only the read-only GitHub base lookup. An external global config containing `merge.ff=only` produced exit 1, “Not possible to fast-forward, aborting.” The same recipe and graph with the isolated environment produced exit 0. No remote service or tracked file was changed. This proves test-environment leakage; it does not establish that production recipes override user Git policy.
- **Corrected scope:** only the two existing test files above need edits. They are themselves the matching regression-test scope; the briefs and standards runner are read-only inputs. No source implementation is added. Size 3 remains appropriate for bounded text-policy assertions plus the subprocess regression.

## Design

Use the policy-test alternative expressly allowed by the filing. Extend `we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs` to inspect both `we:skills-src/conveyor/fix-agent-brief.md` and `we:skills-src/conveyor/fix-agent-ci-brief.md`. Keep the existing four-brief catch-up assertions intact.

Add a test-local text checker returning violations with line numbers and offending text. Inspect fenced command blocks separately from prose: forbidden command occurrences in command blocks must fail even when another line or an inline comment says “never.” Outside fences, permit a forbidden mention only in the same explicit never sentence. Fold wrapped prose lines before sentence checking so the current CI-heal “never replay” sentence remains valid. A “never” in another sentence must not exempt a command. Cover `git rebase`, `cherry-pick`, `--force-with-lease`, and pushes with `--force` or `--force*` options, including flags after the remote/ref. The check is a bounded brief-text guard, not a general shell interpreter; it must not execute snippets. Ordinary merge, ancestry checks, and ordinary push pass.

In `we:scripts/__tests__/fixer-merge-ancestry.test.mjs`, construct one fixture environment and return it with the fixture. Use it for both the Git helper and recipe subprocess, adding `GIT_MERGE_AUTOEDIT=no` without losing isolation. Add an explicit hostile external configuration regression for both briefs and both existing base kinds (`main` and a stacked base). Supply the hostile environment as fixture input rather than mutating process-global environment: apply isolation after ambient/input values so the subprocess cannot accidentally restore the hostile global config. Preserve the existing ancestry, two-dot/three-dot diff, and upstream-identity assertions.

No runtime interface, standard, migration, or production Git policy changes. Deliver the two test-file changes together; review must distinguish the passing isolated recipe from the deliberately failing external-policy control.

## MVP

- **Must 1:** Both fixer briefs are guarded against the listed rewrite commands outside explicit never prose, and against force-push commands in executable fences regardless of nearby prohibitions.
- **Must 2:** Positive fixtures retain ordinary merge/push and wrapped never prohibitions; negative fixtures prove the checker actually rejects each forbidden form and cannot be disabled by an unrelated never sentence or comment.
- **Must 3:** Git setup and recipe execution share the isolated environment; an external `merge.ff=only` config cannot leak into the isolated recipe subprocess. Both briefs retain ancestry and diff guarantees for ordinary and stacked bases.

Implementation order: add the text checker and fixture matrix, apply it to the real briefs, then share the Git environment and add the hostile-config regression. Keep all changes within the two scoped test files.

## Test plan

- In `we:scripts/__tests__/conveyor-brief-main-catchup-policy.test.mjs`, add table-driven rejection cases for rebase, cherry-pick, force-with-lease, and force push, in prose without a prohibition and in executable fences. Include a comment containing never beside an executable command, an unrelated never sentence, flags before/after push destinations, and multiple fenced blocks.
- Add passing cases for the real briefs, normal fetch/merge/merge-base/push commands, and explicit never sentences including the currently wrapped CI-heal prohibition. Assert violation locations as well as presence, so failures identify the offending brief text.
- In `we:scripts/__tests__/fixer-merge-ancestry.test.mjs`, write a temporary external global config with `merge.ff=only`. Verify Git reads that value under the hostile environment. On a diverged fixture, the non-isolated recipe is a negative control and must fail with the fast-forward refusal; the isolated invocation must succeed with the original parent/diff assertions. Exercise both briefs and both base kinds, clean temporary files with the existing cleanup hook, and avoid modifying real user config.
- Run targeted Vitest for the two repository-qualified paths above (strip `we:` when supplying local CLI arguments), using the repository's admitted test execution workflow. No browser tests apply to these test-only changes.

## Proof plan

1. Capture the targeted test result against the final implementation, including all four recipe/base combinations and the external-config negative control.
2. Demonstrate sensitivity using in-memory brief mutations: inject each forbidden command into an otherwise passing brief and require the checker to report it. No working-tree brief mutation is necessary.
3. Temporarily restore the old recipe-subprocess environment in a disposable copy and confirm the hostile-config regression fails, then confirm the shared-environment version passes. Record exit status and failure cause rather than treating an arbitrary subprocess error as proof.
4. Run check:standards through the repository's required verification workflow and record its result. This remains a policy-test implementation; do not claim check:standards itself now owns the rewrite lint.

## Done when

1. **Musts 1-2:** Targeted policy tests pass for the real briefs and accepted prohibitions, and each forbidden mutation is rejected with its location.
2. **Must 3:** Targeted ancestry tests pass for both briefs and both base kinds with hostile ambient Git configuration; the external-policy negative control and old-environment sensitivity check fail for the expected fast-forward reason.
3. Both scoped test files pass together and check:standards passes, with observed results recorded during implementation review.

## Follow-ups

A shared check:standards lint remains optional future consolidation; the filed minimum explicitly permits policy-test assertions, so it is not required for this slice. General shell parsing, discovery of additional brief families, short force aliases, and production handling of external Git policy are outside this bounded prevention task. Independent preparation review and stamping belong to the runner; this edit neither stamps nor claims delivery.
