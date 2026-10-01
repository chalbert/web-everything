---
bornAs: xuojjv7
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2861's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/__tests__/guard-bash.test.mjs:177` — Add a deterministic test that extracts the brief's command, requires --run and --passWithNoTests, and checks guard non-denial for each dispatch kind; fail if the command is missing. The extraction follow-up is already filed as #4368, but no implementing gate appears in this diff.
2. `we:skills-src/conveyor/delivery-agent-brief.md:188` — Add a test in `we:scripts/__tests__/guard-bash.test.mjs` asserting that `dispatchedAgentVerificationReason` rejects `vitest` invocations missing `--run` or `--watch=false`, forcing the implementation to enforce the safety mechanically instead of relying on prose.
3. `we:skills-src/conveyor/delivery-agent-brief.md:192` — A markdown lint rule that enforces all script references in agent briefs to include their full repo-relative paths when formatted as inline code.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2861@b01a9b50c1da384b10f979dafad2dd01b46994bc

## Done when

1. **Executable** — `npx vitest run` over we:scripts/__tests__/guard-bash.test.mjs passes with the new guard cases from
   the Test plan below; reverting only the `we:scripts/guard-bash.mjs` change turns the deny cases and the mutation-proof case red (the
   allow, interactive and brief-command cases are over-deny guards and stay green).
2. **Executable** — `npm run check:standards` is green.

## Premise check (2026-09-30, main bc9db934c)

- **Item 1 is already delivered** by #4368 (`1e8d39a18`). `we:scripts/__tests__/guard-bash.test.mjs:3447-3482`
  extracts the brief's mid-work fence by markdown parse, asserts `--run` and `--passWithNoTests` are present
  (`:3481-3484`), asserts non-denial for `build`/`fix`/`ci-heal`, and fails loud on a missing marker or fence
  (`:3492-3497`). Nothing further is owed; the review's "no implementing gate" remark predates that commit.
- **Item 2 is still true.** `dispatchedAgentVerificationReason` (`we:scripts/guard-bash.mjs:530`) returns `null`
  for any admitted-wrapper command (`isVerificationRun` is false once the head is the heavy-admission wrapper,
  `:391`/`:405`). It never inspects the wrapped vitest args, so `… run -- npx vitest related <test-file>` (no `--run`,
  so vitest may enter watch mode and hang inside the wrapper) is allowed. The `--run` rule lives only in brief prose
  (`we:skills-src/conveyor/delivery-agent-brief.md:190-193`) and in the #4368 string-contains test.
- **Item 3 is still true but is a different kind of work.** There is no lint over inline-code script references in
  briefs; the only related rule is `findRelativeNodeScriptsAfterLaneCd` in `we:scripts/check-standards-rules.mjs`
  (a `node scripts/` check after `cd "$LANE"`). The cited line (we:skills-src/conveyor/delivery-agent-brief.md:192) names the
  heavy-admission and verify-lane scripts by bare filename in inline code.
- A RAW `npx vitest related` (no wrapper) is already denied by `isHeavyRawRun`; only the admitted-wrapper path
  needs the new check. Line cites above are approximate (brief prose is `:188-193`; the #4368 asserts sit near
  `:3477-3480`). The brief edit must not add an italic-quoted `*"…"*` sentence before the existing cited title.
- **Scope corrected:** item 2 needs a guard change, so `we:scripts/guard-bash.mjs` is added to `scope:`.

## Design

Add one pure predicate in `we:scripts/guard-bash.mjs`, next to `isAdmittedWrapperRun` (`:405`):
`admittedVitestWatchReason(command)`. For each parsed segment whose canonical head is an admitted wrapper
(`ADMISSION_WRAPPER_HEAD`, `:391`), take the wrapped command after `--` and, if it is `npx|pnpx|bunx vitest
related` or bare `vitest related`/`vitest` with no `run` subcommand, require a token `--run` or `--watch=false`
(also accept `--no-watch`). `vitest run <files>` is one-shot by definition and stays allowed. Return a reason
string when the flag is missing, else `null`. Call it from `dispatchedAgentVerificationReason` (`:530`) before the
`isVerificationRun` early return, so it applies only when `dispatchKind` is set (interactive sessions unaffected,
same scoping the function already has). Reuse `parseSegments`/`canonicalCommand`/`shellTokens`; no new parser. The
reason text names the exact fix (`add --run`) and cites the brief's "Keep `--run --passWithNoTests`" paragraph.

## MVP

Musts only:
1. Item 1: record it as delivered by #4368 (this card's Premise check; no code).
2. Item 2: the predicate above, wired into `dispatchedAgentVerificationReason`, with the tests below.
3. Update `we:skills-src/conveyor/delivery-agent-brief.md:190` so the prose says the guard now enforces
   `--run` mechanically (one sentence; keeps the cited test title intact so the #4368 title test stays green).

Deliberately OUT (see Follow-ups): item 3's markdown lint.

## Test plan

In `we:scripts/__tests__/guard-bash.test.mjs`, new `describe('admitted vitest must be one-shot (#4449)')`:
- **related without --run is denied** for each of `build`/`fix`/`ci-heal`: `<admission wrapper> run -- npx vitest
  related <test-file> --passWithNoTests` → reason non-null mentioning `--run`. RED today: the function returns `null`.
- **`--run` or `--watch=false` allows it**: same command with either flag → `null` (guards against over-deny).
- **`vitest run <file>` stays allowed** with no extra flag → `null` (regression guard for the existing test at `:167`).
- **Interactive session unaffected**: `dispatchKind` null → `null` for the denied shape.
- **Brief command still passes**: the existing #4368 case (`:3477`) stays green, proving the documented command is
  not caught by the new rule.
- **Mutation proof**: strip `--run` from the brief-extracted command in-test → now denied for every kind.

## Proof plan

Live before/after on the real hook: pipe a Bash-hook event JSON through the guard (we:scripts/guard-bash.mjs) with
`WE_DISPATCH_KIND=build` for the admission wrapper (we:scripts/readiness/heavy-admission.mjs) running
`-- npx vitest related <test-file> --passWithNoTests` — before: exit 0 (allowed); after: exit 2 with the reason. Then the brief's own documented
command through the same hook → exit 0 before and after. Paste both outputs in the PR body.

## Follow-ups

- **Item 3 — brief lint for repo-relative script paths in inline code** (own story): needs a violation baseline
  across `skills-src/conveyor/*.md`, a decision on warn-first vs hard error, and an exemption for prose that
  names a script by bare filename on purpose. It is a new `check-standards` rule with its own corpus risk, so it is
  not bundled with the guard change. The builder files it (scope: `we:scripts/check-standards-rules.mjs`,
  `we:scripts/check-standards.mjs`).
- Extend the same `--run` check to other wrapped runners if they appear in briefs (none today).
