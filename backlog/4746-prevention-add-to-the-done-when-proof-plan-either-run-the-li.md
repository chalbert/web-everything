---
bornAs: x7wn7rl
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4443-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/lib/approval-prevention-integrity.mjs", "we:scripts/lib/__tests__/approval-prevention-integrity.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "9022027b3338d274e023296ea23aeebb908f5f36"
tags: []
---

# Prevention — Add to the Done-when/Proof plan: either run the live suite on every platform that runs deliveries, or a… (from chalbert/web-everything#3301 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4443-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:58` — Add to the Done-when/Proof plan: either run the live suite on every platform that runs deliveries, or add the explicit '.git/**' deny unconditionally as defense in depth. Do this regardless of the observed result on one host. A review lens on sandbox-claim items asking 'which platforms did this run on?' would catch the class.
2. `we:backlog/4443-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:18` — A `check:standards` rule that enforces that the text block between 'Filed mechanically ON APPROVAL' and the idempotency key remains unmodified after initial file creation.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3301@7b6a70aa5349bd2abacbb5c0b9b8179505de568b

## Progress

- **Old premise/scope:** mechanically copied review findings cited lines 58 and 18 of `we:backlog/4443-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` and scoped only that card. The request contains two guards: stronger platform evidence in its completion criteria, and executable preservation of the original review text.
- **Corrected premise/scope:** #4443 is resolved, and commit `b88de0fed` delivered the opt-in live suite, but did not deliver these two prevention guards. The current `## Proof plan` and `## Done when` still accept a run on one capable host. Its progress records macOS Seatbelt with codex-cli 0.155.1; that is evidence for that host, not all delivery platforms. Refer to those named sections instead of the stale line 58 citation. Line 18 is the card title, not the protected digest; the digest begins at the `Filed mechanically ON APPROVAL` marker. Preserve the copied findings above as historical evidence; these corrections supersede their line anchors.
- **Source evidence:** `buildNativeDenyCodexArgs` in `we:scripts/lib/isolation-provider.mjs` currently concatenates supplied denies and writable-root grants without adding Git-metadata exclusions. `we:scripts/operations/__tests__/codex-delivery-provider-sandbox.test.mjs` contains four live cases gated by `WE_CODEX_SANDBOX_TEST`; its header requires `WE_TEST_SANDBOX=0` as well. The older card's proof command omits that setup override. Preparation inspected these sources; it did not run the live sandbox or establish additional platform coverage.
- **Integrity evidence:** `buildApprovalPreventionFilingInput` in `we:scripts/lib/approval-prevention-notice.mjs` produces the filing marker, digest and key. Its filing coverage is in `we:scripts/__tests__/review-set-label.approval-prevention-filing.test.mjs`. Inspection of `we:scripts/check-standards.mjs` and `we:scripts/check-standards-rules.mjs` found no historical digest comparison. The existing provenance section compares against a merge base for a different lint; it does not preserve filing text.
- **Scope correction:** retain the older card for acceptance-criteria corrections; add the standards entry point and its existing test, plus the planned focused integrity helper and matching test. Runtime builder/provider changes are not required to add the requested disjunctive completion criterion. Every planned source change has a matching test in scope. No preparation stamp is added by this worker.

## Design

Two bounded changes discharge the original review debt.

First, amend `## Done when` and `## Proof plan` in `we:backlog/4443-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` to require either successful live-suite evidence on every platform actually running deliveries, or an explicit unconditional Git-metadata descendant deny for each extra writable root. A passing result on one host must not waive that requirement. Keep the existing positive write control and metadata mutation checks. Correct the live command to include both environment switches. Preserve the recorded macOS observation and resolved frontmatter; adding an acceptance criterion must not fabricate new evidence or retrospectively claim it was met. Include the review question “Which delivery platforms did this run on, and what evidence covers each?” in the proof checklist. This item records the existing alternative; it does not choose or implement a new sandbox policy.

Second, add a focused history-backed checker in `we:scripts/lib/approval-prevention-integrity.mjs` and invoke it from `we:scripts/check-standards.mjs`. For changed approval-prevention cards, compare the exact text from the filing marker through the text immediately before the idempotency-key line against the first committed version carrying that key. Keep the key as the stable identity across sanctioned card renames. Inspect both prior and current versions so removing the marker, key, protected region, or entire card cannot evade the check. A changed key on an existing card is not a new filing. Report the card, original commit and integrity failure with instructions to put corrections in `## Progress` outside the digest.

New, uncommitted filings have no historical baseline: validate the single marker/key pair and accept their initial text. For committed cards introduced on the current branch, use their first keyed commit, not merely the merge-base version. Limit historical work to changed cards (including staged, unstaged, branch-committed and untracked candidates), rather than retroactively auditing the entire corpus on every run. Use Git reads through argument arrays; never interpolate card text into shell commands. Preserve bytes, including whitespace, inside the protected span; frontmatter and later planning sections remain editable. Missing or ambiguous markers, duplicate keys, inaccessible history, and failed Git reads must produce an actionable gate error for a candidate needing comparison, never a clean result.

## MVP

1. Update only the named completion/proof sections of `we:backlog/4443-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md`, leaving its mechanically filed digest and historical evidence intact.
2. Implement protected-span extraction and historical comparison in the planned `we:scripts/lib/approval-prevention-integrity.mjs`. Separate pure comparison from Git/file reads so failure cases are testable.
3. Wire findings into the normal error reporting of `we:scripts/check-standards.mjs`; ensure candidate discovery includes deleted and renamed paths and newly committed branch files.
4. Add real temporary-Git-repository regression coverage in the planned `we:scripts/lib/__tests__/approval-prevention-integrity.test.mjs`, and gate integration coverage in `we:scripts/__tests__/check-standards.test.mjs`. Do not change the filing format or regenerate old digests.

## Test plan

- Pure comparison: unchanged bytes pass; changed wording, whitespace, inserted or removed findings fail. Frontmatter changes and edits to later Design/Progress/Proof sections pass. Non-approval cards are ignored. Missing, repeated or reordered markers and malformed/changed keys fail for existing candidates.
- Temporary Git fixtures: create and commit a filing, then exercise unstaged and staged digest edits, a later committed edit, deletion, and rename with/without digest mutation. A newly filed untracked card passes shape validation; a new branch-committed card subsequently mutated is compared to its first keyed commit. An unrelated changed card does not trigger a corpus-wide historical audit.
- Failure controls: simulated unreadable Git objects, insufficient shallow history, and Git command failure yield errors instead of treating a committed card as new. Card names containing spaces are handled without shell interpretation. Duplicate key candidates fail rather than selecting an arbitrary baseline.
- Entry-point coverage in `we:scripts/__tests__/check-standards.test.mjs` proves integrity findings increment gate errors, while permitted planning edits pass this rule. Assert that the amended older card requires the platform evidence/explicit-deny alternative and both live-test environment switches without rewriting its digest.
- Keep existing filing tests in `we:scripts/__tests__/review-set-label.approval-prevention-filing.test.mjs` green, proving the checker accepts the actual generated marker/key format.

## Proof plan

Run the focused helper, gate integration and existing filing suites. The future build's targeted command is `npx vitest run we:scripts/lib/__tests__/approval-prevention-integrity.test.mjs we:scripts/__tests__/check-standards.test.mjs we:scripts/__tests__/review-set-label.approval-prevention-filing.test.mjs` (strip the documentation-only `we:` prefix from each argument when executing in WE).

In a disposable Git fixture, show a committed filing with one digest word changed produces an integrity error and nonzero gate result; restore that word and change only its later planning section to show the rule passes. Include a committed-on-branch mutation and a removed-marker case so the proof cannot pass merely by inspecting the current marker. Save the commands, exit statuses and relevant diagnostic text. Run `npm run check:standards` on the finished implementation and separate unrelated failures from this rule's results.

For the older card, inspect the rendered diff to verify both completion/proof sections contain the same unconditional requirement and the corrected live invocation. Any later live evidence must use both `WE_TEST_SANDBOX=0` and `WE_CODEX_SANDBOX_TEST=1`, name the exact delivery platforms and CLI versions, and preserve positive-control results. This preparation and the documentation/gate build do not themselves claim cross-platform sandbox verification.

## Done when

1. An edited mechanically filed digest fails the executable gate; unchanged digests and edits outside them pass its regression cases, including real Git history and error-path controls.
2. The older card's Done-when and Proof plan require all actual delivery platforms to be exercised or explicit unconditional Git-metadata descendant denies, regardless of a single-host result. Its live command includes the setup override.
3. The focused suites and standards gate pass, with the failing/passing mutation evidence recorded outside the protected digest.

## Follow-ups

The actual collection of additional platform evidence or implementation of unconditional metadata denies remains sandbox delivery work; this card changes the owed acceptance criteria and adds the provenance guard. Do not claim either alternative has been satisfied by this preparation. Linked-worktree indirection and symlink aliases remain outside the older suite's stated coverage. No expansion to other mechanically filed formats or broader sandbox policy is part of this item.
