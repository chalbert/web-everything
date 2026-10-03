---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/lib/operator-fix-budget.mjs", "we:scripts/lib/__tests__/operator-fix-budget.test.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon-notes.test.mjs", "we:scripts/lib/env-boolean.mjs", "we:scripts/lib/__tests__/env-boolean.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "7a4e24b3fc03d79cc8d974a934ef98c8d79df256"
tags: []
---

# Prevention — Have the grant require a dedicated, non-free-text marker, such as a distinct human-only ceremony or a b… (from chalbert/web-everything#3431 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-core.mjs:1248` — Have the grant require a dedicated, non-free-text marker, such as a distinct human-only ceremony or a build*Marker-rendered block, and add a test that an operator-credential comment with --actor set to the operator's login does not grant. A lint or standards rule could flag any new trust decision based on `Recorded by` prose.
2. `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:305` — Add a shared env-boolean parser, enforced by a check:standards rule, that treats 0, false, off and no as disabled. Pin it with a test over those values.
3. `we:scripts/conveyor/reconcile-core.mjs:1260` — Add a deterministic parameterized regression test covering send-back renewal when each supported attempt source independently dominates, including counts with missing or lagging comment markers.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3431@0c0b23950e9dc787761645ee1f058579f3328590

## Progress

Premise checked against the current checkout; the prevention is not already delivered.

- **Original premise/scope:** the approval identified prose-derived grants at `we:scripts/conveyor/reconcile-core.mjs:1245`, an env switch at `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:310`, and renewal coverage at `we:scripts/conveyor/reconcile-core.mjs:1260`. Scope listed those two production files and their general test files.
- **Corrected premise:** `operatorFixBudget` in `we:scripts/conveyor/reconcile-core.mjs:1248` still recognizes a `Recorded by <login>` prefix after checking GitHub operator authorship, comment ID, and timestamp. This authenticates the posting credential, not the free-text actor. `buildVerdictComment` in `we:scripts/review-set-label.mjs:1579` emits that attribution from caller input. Its existing sanitized-prose/trusted-marker boundary at `we:scripts/review-set-label.mjs:1681` provides the appropriate structured producer seam.
- **Env evidence:** `defaultNoteCommentDryRun` is now at `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:305`; only exact `0` disables posting. Its existing tests live in `we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon-notes.test.mjs:24`, not the general daemon suite originally scoped.
- **Counter evidence:** `we:scripts/conveyor/reconcile-core.mjs:1258` derives the grant baseline from pre-verdict rearm/advisory comments; `roundAttempts` at `we:scripts/conveyor/reconcile-core.mjs:1462` also takes the maximum with injected `durableCounts`. Existing renewal tests at `we:scripts/conveyor/__tests__/reconcile-core.test.mjs:3203` cover advisory counts, switching to rearm, restart, forgery, and successive grants, but do not parameterize all three sources. The production adapter `durableCountsFrom` at `we:scripts/conveyor/reconcile-pass.mjs:306` currently derives its count from rearm comments; injected counts are not a separate production ledger.
- **Corrected scope:** include the verdict producer, a shared marker builder/parser, a shared env parser, and the standards rule plus its production wiring. Each source has its matching existing or planned test file in scope. The two shared helpers and their tests are planned new files. No change to the production count adapter is needed to test the core's already-supported injected-count input.

## Design

1. Replace prose recognition with an explicit structured grant. Add a proposed `--grant-fix-budget` opt-in to the existing changes-requested ceremony in `we:scripts/review-set-label.mjs`; ordinary `--to=changes --actor=<operator-login>` must never emit it. Validate the opt-in only for `changes`, with explicit actor, quoted reason, and the existing required findings body. Emit a versioned, fixed-purpose HTML-comment marker through a validating builder in planned `we:scripts/lib/operator-fix-budget.mjs`, after the existing prose sanitizer. No caller-supplied numeric allowance: retain the existing two-round allowance. Update rendered-length accounting for the added marker.
2. Consume that marker in `we:scripts/conveyor/reconcile-core.mjs`, retaining the existing operator-author, ID, and valid-timestamp checks. Do not accept legacy attribution as a fallback. Reject malformed, unsupported-version, or ambiguous duplicate grant markers. Marker-looking text supplied through actor, channel, reason, or findings must remain inert after rendering. The explicit opt-in records a ceremony; it does not prove a human was physically at the keyboard. Preserve the existing credential trust boundary rather than claiming a new identity guarantee.
3. Preserve bounded renewal arithmetic: baseline is the maximum of the two pre-grant comment counts; cap is the maximum of the ordinary cap and baseline plus two; spending retains the existing pre/post-grant calculation and the maximum with all current count sources. A larger injected durable count must never be discarded. With missing/lagging comments, a durable count already at the derived cap refuses; do not infer a historical baseline from a current scalar or reset the allowance on each tick. Grants must remain restart-stable and unused allowances must not accumulate.
4. Add planned `we:scripts/lib/env-boolean.mjs` with an explicit default parameter. Normalize whitespace and case; recognize `0`, `false`, `off`, `no` as false and `1`, `true`, `on`, `yes` as true. Unset, empty, or unknown values use the caller's default, preserving the current posting default. `defaultNoteCommentDryRun` in `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs` negates the parsed posting switch with default true.
5. Add a focused pure rule in `we:scripts/check-standards-rules.mjs`, wired through `we:scripts/check-standards.mjs`, requiring the note-posting switch to use the shared parser and rejecting the old direct equality/truthiness implementation. Exercise real caller source and synthetic bypass fixtures. Keep the enforcement domain explicit: this switch, not an unresearched migration of every environment variable.

## MVP

- Implement the shared marker builder/parser, explicit producer opt-in, and reconciler consumer together; a consumer with no supported producer is incomplete.
- Preserve ordinary changes-requested behavior except that it no longer implicitly renews the budget. Existing historical prose-only comments do not acquire a grant; a new explicit ceremony is required.
- Implement the shared env parser, migrate the note-posting switch, and wire the targeted standards rule.
- Add the source-dominance regression matrix and retain existing restart, exhaustion-note, mixed-source, and successive-grant coverage. Do not change review clearance, CI-heal caps, conflict-fix caps, or advisory-fix caps.

## Test plan

- `we:scripts/lib/__tests__/operator-fix-budget.test.mjs` (planned): builder/parser round trip, unsupported version, malformed payload, escaped marker, duplicates, and absent marker.
- `we:scripts/__tests__/review-set-label.test.mjs`: through the injected provider seam, prove that an ordinary changes verdict with operator credentials and operator-valued `--actor` does not produce a grant. An explicit valid ceremony emits exactly one marker; wrong target or missing required fields refuses before writes. Inject marker text through every prose field and verify it cannot become a grant. Cover comment-length projection and rendered-byte guard.
- `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`: feed producer-rendered bodies with operator metadata into `planReconcile`. Positive explicit grant; negative old prose-only comment, automation/outsider/missing author, absent ID, invalid timestamp, and malformed marker. Parameterize rearm, advisory, and injected durable counts as independently dominant. For comment-backed baselines, assert dispatch at baseline and baseline plus one, refusal at baseline plus two; for injected dominance with missing/lagging comment markers, assert the exact derived cap and refusal when the count reaches it. Re-run identical input as a simulated restart and check unchanged results. Keep successive grants non-accumulating and mixed-source counts monotonic.
- `we:scripts/lib/__tests__/env-boolean.test.mjs` (planned): table-test both boolean vocabularies, case/whitespace, unset/empty/unknown values, and both defaults.
- `we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon-notes.test.mjs`: table-test all four disable values at the production wrapper; with injected note effects, prove disabled posting makes no comment write and the default still posts.
- `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`: compliant shared-parser fixture, direct comparison and truthiness bypasses, and unrelated prose/test fixtures that must not trigger. `we:scripts/__tests__/check-standards.test.mjs`: prove the production gate actually invokes the rule and reports its file descriptor.

## Proof plan

Run the affected Vitest suites named above and `npm run check:standards` after implementation. The red-before/green-after witnesses are (a) the current producer's ordinary operator-attributed comment receiving a grant, and (b) `false`, `off`, and `no` still permitting note posting. Capture the failing assertions before the fix and passing results after it. New helper tests alone are not sufficient evidence.

Use the real verdict renderer and reconciler with injected provider/comment-write effects for an end-to-end local probe: exhausted PR plus ordinary verdict stays refused; explicit marker grants only the bounded allowance; two spent rounds refuse and surface the exhaustion note; disabled note posting records zero writes. Replay identical snapshots without retained process state. No live grant, GitHub comment, or daemon restart is needed for this proof.

## Done when

- **Executable:** the affected suites in Test plan and `npm run check:standards` pass, with before/after evidence for the two regression witnesses in Proof plan.
- **Must — error posture:** absent or invalid grant evidence never raises the cap; supported attempt counts are never reduced or ignored to manufacture an allowance.
- **Must — input coverage:** the same grant validation applies to PRs changing source, docs, config, or data; changed-file type does not bypass it. Caller prose and environment values remain inputs, never identity evidence.

## Follow-ups

- A broader lint against new trust decisions derived from `Recorded by` prose was suggested in the original review; assess it separately with false-positive fixtures. The direct grant regression is mandatory here; a repository-wide trust-analysis lint is not this MVP.
- Adopt the shared env parser for other boolean switches only after checking each switch's current defaults and unknown-value behavior; this card enforces the named note-posting switch.
- Strong proof of human presence is outside this marker change. Shared operator credentials remain a trust limitation; the structured ceremony prevents accidental grant via free-text attribution, not deliberate credential-holder forgery.
- If a future count adapter introduces an independent durable ledger, design a trustworthy at-grant snapshot before promising two fresh rounds when comment history is missing. The current scalar cannot distinguish pre-grant spending from post-grant spending; keep that case conservative here.
