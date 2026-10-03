---
bornAs: xxxywdz
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "fa7aab527dbd3cb23b633ee402df927dbef4e876"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3172's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the five owed guards: retargeting parity, directory-changing spellings, bounded flag parsing, quoted-checkout noninterference, and leading-whitespace coverage. These did not block the original approval; this item delivers the remaining prevention coverage and the parser corrections it exposes.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3172@dc3fc5d6998659fa65d92145eac501b666320076

## Progress

Preparation research against checkout `fa7aab527dbd3cb23b633ee402df927dbef4e876` (not a preparation stamp):

- **Old premise/scope:** the approval note cited retargeting at line 395, directory handling at 355, flag parsing at 366, and leading whitespace at 349 in `we:scripts/conveyor/fix-procedure.mjs`. It proposed five guards plus a possible repository-wide regex lint, with implementation and tests scoped to `we:scripts/conveyor/fix-procedure.mjs` and `we:scripts/conveyor/__tests__/fix-procedure.test.mjs`.
- **Corrected premise/scope:** the same two-file implementation/test scope remains sufficient. Current loci are `CD_BEFORE` at `we:scripts/conveyor/fix-procedure.mjs:350`, `parseGitPushes` at `we:scripts/conveyor/fix-procedure.mjs:360`, `pushTargetUnreliable` at `we:scripts/conveyor/fix-procedure.mjs:398`, and destination propagation at `we:scripts/conveyor/fix-procedure.mjs:422`. This is parser repair plus prevention tests, not just filing more debt. A repository-wide regex gate is a separate follow-up, not necessary to deliver these five guards.
- **Existing coverage:** `we:scripts/conveyor/__tests__/fix-procedure.test.mjs:274` already exercises the real hook with temporary repositories and a temporary claim store; line 335 starts a global-option parity table, line 352 tests echoed push text *after* a push, line 362 covers plain `cd`, and line 370 covers several HEAD-changing spellings. None substitutes for echoed checkout text *before* an implicit push, directory spelling parity, or a bounded pathological-input test.
- **Observed gaps:** direct parser probes returned `retarget=false` and `unreliable=false` for leading-space `cd`, `pushd`, `popd`, `env -C foo git push`, and `env --chdir=foo git push`; plain `cd foo && git push` returned both true. Echoed quoted checkout text before `git push origin HEAD` incorrectly returned `unreliable=true`. These are parser observations, not claims that each complete hook verdict was reproduced.
- **Boundary evidence:** `we:scripts/guard-bash.mjs:3604` (`computeFixClaimCtx`) trims quote-aware segments and passes earlier segments as a textual prefix to the resolver. Thus leading whitespace is a direct-parser gap even where hook trimming masks it, while quoted earlier text still reaches the unreliable-target classifier. This caller is read-only context; fix classification in the scoped parser and exercise the existing hook fixture.
- **Performance evidence:** a separate Node child parsing 200 repeated `--git-dir=x` flags followed by `push` completed in approximately 0.3 ms; the same flags followed by `status` exceeded a 2,000 ms subprocess timeout and was terminated. The failure-path case must accompany the originally requested successful-push timing test. The item is not already delivered.

## Design

Keep the existing claim policy: a foreign live claim blocks an implicit push when preceding executable commands can change its HEAD or repository; the claim holder and callers with no foreign claim retain their existing exemptions. Explicit destination refs remain precisely matched, with an unknown repository matching claims across repositories. This follows `we:docs/agent/platform-decisions.md#fix-claim-draft-only-on-withdrawal` rather than introducing a new push policy.

In `we:scripts/conveyor/fix-procedure.mjs`, replace the overlapping global-option regex with a forward token scan. Preserve existing public result shapes, ordered pushes, per-push directory/remote/refspec parsing, quoted option values, supported wrappers, and the optional earlier-segment prefix. Each iteration must consume input; a non-push command must terminate without regex backtracking through alternative flag partitions.

Use quote-aware command boundaries and executable words to classify retargeting, rather than searching arbitrary argument text. Recognize `cd`, `pushd`, and `popd` at command starts, including leading whitespace and after separators; recognize `env -C DIR`, `env --chdir DIR`, and `env --chdir=DIR` when they wrap the push. An `env` directory change is local to its wrapped command, not a persistent change for a later sibling command. Retain existing Git/gh HEAD-changing spellings (`checkout`, `switch`, `worktree`, `gh pr checkout`, `gh co`), Git global `--git-dir`/`--work-tree`, and resolvable `git -C` behavior. Do not treat quoted data passed to `echo` as an executed checkout, but retain detection of genuinely executed nested commands already exposed by the hook.

Repository changes set `retarget`, so `resolvePushDestinations` retains its unknown-repository behavior even for explicit refs. HEAD-only changes set implicit-target unreliability without erasing a known repository. Preserve explicit `HEAD:refs/heads/lane/ok` destination handling. Share the command classification between parsing and unreliability checks to prevent their spelling sets diverging.

## MVP

1. Add a named table in `we:scripts/conveyor/__tests__/fix-procedure.test.mjs` covering the existing and owed retargeting spellings. Extend the existing temporary-repository/claim fixture; commands are evaluated by the hook, never actually pushed.
2. Implement the bounded global-option scan and executable-word retarget classification in `we:scripts/conveyor/fix-procedure.mjs`. Cover whitespace, shell separators, quoted arguments, and the hook's prefix input.
3. Add the paired echoed-checkout/actual-checkout regression and a child-process timeout regression for 200 repeated flags on both matching and nonmatching operations.
4. Keep the public parser/resolver interfaces and claim semantics unchanged. The scope contains the matching existing test file for the sole implementation source.

## Test plan

All additions belong in `we:scripts/conveyor/__tests__/fix-procedure.test.mjs`.

- Cross retargeting rows with bare push, remote-only push, and `origin HEAD`/`origin @`. Include `git checkout`, `git switch`, `git -C DIR checkout`, `git worktree`, `gh pr checkout`, `gh co`, plain and leading-space `cd`, `pushd`, `popd`, both long `env --chdir` forms and `env -C`, and both joined/separate Git repository options. Assert parser metadata and a refusal naming the foreign claim through `computeFixClaimCtx` and `guardDecide`.
- Separate expected repository-retarget rows from HEAD-only rows. Verify unknown repository propagation for directory changes, and retain the existing cross-repository `git -C` resolution tests. Use actual temporary directories where resolution requires them.
- Pair each family with allowed controls: no live foreign claim, the holder, and an explicit unclaimed destination. A claimed explicit destination must still be refused. An ordinary implicit push on `lane/ok` must remain allowed when only `lane/claimed` is held.
- On `lane/ok`, with a live foreign claim on `lane/claimed`, assert that `echo "git checkout lane/claimed" && MAIN_PUSH_OK=1 git push origin HEAD` is allowed while an actual checkout followed by the same push is refused. Cover single-quoted text too, executable nested checkout, prefix-fed classification, and `env -C DIR echo ok` followed by a sibling push (no inherited directory change).
- Assert the direct parser handles a leading-space `cd` even though the hook trims segments; retain a hook verdict assertion too. Preserve earlier valid-push/later echoed-push coverage and ordered multiple-push resolution.
- Run each 200-flag parse in an isolated Node child with a 2,000 ms hard timeout. Assert successful exit plus one parsed push for the `push` suffix and zero for the `status` suffix. Include repeated valued flags (`--git-dir=x`) and valueless flags (`--no-pager`); also check quoted values and ordinary mixed flags. A Vitest callback timeout alone cannot interrupt synchronous regex execution.

## Proof plan

Before implementation, add the regressions and run the targeted Vitest file, recording the failing directory/quote assertions and the bounded non-push timeout. After implementation, rerun the same cases and the full file with `npx vitest run` targeting `we:scripts/conveyor/__tests__/fix-procedure.test.mjs` (remove the `we:` locus prefix when passing the filesystem argument). Record the checkout SHA, command, exit code, test counts, and child-process completion results.

The integration evidence must come from the existing real temporary-repository and temporary-claim-store fixture through the actual hook decision path, not only synthetic parser booleans. Use no live claims, network pushes, or shared lock roots. Run `npm run check:standards` for the implementation change. Preparation itself leaves stamping and checks to the runner.

## Done when

The new tests fail against the preparation baseline and pass with the parser correction; all five owed guards are covered in `we:scripts/conveyor/__tests__/fix-procedure.test.mjs`, including the non-push performance case. Existing parser and claim-hook tests pass, exemptions and explicit-ref matching remain intact, and the standards gate passes.

## Follow-ups

A repository-wide nested-quantifier regex lint was suggested by the review but is not required for this bounded fix. Evaluate its false-positive model and coverage separately before proposing a shared gate; do not expand this item into that policy decision. General shell interpretation beyond the hook's supported command grammar is also outside this item. No new backlog item is filed during preparation.
