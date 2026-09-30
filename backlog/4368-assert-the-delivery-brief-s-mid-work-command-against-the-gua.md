---
bornAs: x3zp8nf
kind: story
size: 2
status: active
scope: ["we:skills-src/conveyor/delivery-agent-brief.md", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "b13659525cbcf14cf39ca707cbb7727c377e5cdd"
tags: []
---

# Assert the delivery brief's mid-work command against the guard programmatically, not a hand-copied string

we:skills-src/conveyor/delivery-agent-brief.md's mid-work check (added by #4294) documents a fenced we:scripts/readiness/heavy-admission.mjs run -- npx vitest related command and cites we:scripts/__tests__/guard-bash.test.mjs's non-denial test by title in prose. Nothing ties the two together mechanically: the guard test hard-codes its own command string, so an edit to the brief's documented command (dropping the wrapper, dropping --run/--passWithNoTests, or renaming the cited test) leaves the guard test green while the brief now documents a shape the guard denies or a nonexistent test name. Multiple independent review lenses flagged this same gap while converging #4294 (coverage/claim-accuracy/standards-conformance). Add a test that extracts the fenced bash command from the brief (and, if present, from we:skills-src/conveyor/fix-agent-brief.md / we:skills-src/conveyor/fix-agent-ci-brief.md once we:backlog/4369-fix-briefs-mid-work-gate-command-is-a-bare-verify-lane-invoc.md lands) and asserts we:scripts/guard-bash.mjs's dispatchedAgentVerificationReason is null for it, for every dispatch kind — so a future edit to the documented command that the guard would deny fails a real test instead of silently drifting.

## Done when

1. **Executable** — a new test extracts the fenced mid-work command from
   `we:skills-src/conveyor/delivery-agent-brief.md` (a markdown-fence parse, not a hand-retyped copy) and asserts
   `we:scripts/guard-bash.mjs`'s `dispatchedAgentVerificationReason` is `null` for it, for every dispatch kind
   (`build`/`fix`/`ci-heal`). Mutate the brief's documented command in a scratch copy (e.g. drop the
   `we:scripts/readiness/heavy-admission.mjs run --` wrapper) and confirm the SAME test then reddens — proving it
   actually reads the brief rather than re-asserting a hard-coded string that happens to match today.
2. **Edge case named** — decide and state explicitly what the test does when the fenced command block is
   missing or the brief is restructured (fail loud naming the reason, vs. skip) — a silently-skipped assertion
   is worse than no assertion, since it reads as coverage that isn't there.
3. **Executable** — if `we:backlog/4369-fix-briefs-mid-work-gate-command-is-a-bare-verify-lane-invoc.md` has
   landed by the time this item is worked, extend the same extraction to
   `we:skills-src/conveyor/fix-agent-brief.md` / `we:skills-src/conveyor/fix-agent-ci-brief.md`'s own
   `{{GATE_COMMAND}}`; if it has not landed yet, this item covers the generic brief only and says so rather than
   silently skipping the fix briefs.

## Premise check (2026-09-30)

Still true on `main` (b13659525). The brief's fenced command is `we:skills-src/conveyor/delivery-agent-brief.md:184`
(under the `**Mid-work check` paragraph, step 4, before `### 4a`), and its cited test title is at `we:skills-src/conveyor/delivery-agent-brief.md:197-198`. The guard
test at `we:scripts/__tests__/guard-bash.test.mjs:174-182` hard-codes its own string; nothing reads the brief.
`we:backlog/4369-fix-briefs-mid-work-gate-command-is-a-bare-verify-lane-invoc.md` is still `open` and the fix briefs
still carry a bare `{{GATE_COMMAND}}` (`we:skills-src/conveyor/fix-agent-brief.md:335`, `we:skills-src/conveyor/fix-agent-ci-brief.md:285`), so this item covers the
generic brief only. Scope is right: the only file that needs to change is `we:scripts/__tests__/guard-bash.test.mjs`; `we:scripts/guard-bash.mjs` and
the brief are read, not edited (kept in `scope:` as the mutation-proof targets).

## Design

Add one `describe` to `we:scripts/__tests__/guard-bash.test.mjs`, next to the #4294 test (`we:scripts/__tests__/guard-bash.test.mjs:174`). It reads
`we:skills-src/conveyor/delivery-agent-brief.md` with `readFileSync` (path from `import.meta.url`, as the file already
does for other reads) and parses it in a small local helper `extractMidWorkCommand(markdown)`:

1. Find the line starting `**Mid-work check`. Missing → throw `mid-work check paragraph not found in the brief`.
2. From there, take the first ```` ```bash ```` fence and stop at its closing fence. Missing/unclosed → throw naming
   the reason. Empty body → throw.
3. Join continuation lines (`\` at line end) and swap the `<touched-file-N> …` placeholders for two real repo paths
   (a convenience: the guard returns null either way, but a concrete command reads truthfully).
4. Assert the extracted command starts with `node we:scripts/readiness/heavy-admission.mjs run --`, so a reordered brief
   whose first post-marker fence is a different command fails loud instead of being accepted.

The test then runs `dispatchedAgentVerificationReason(cmd, kind)` for `build`, `fix`, `ci-heal` and asserts `null`,
plus `isAdmittedWrapperRun(cmd)` true. A second case extracts the italic-quoted test title the brief cites
(`*"…"*`, `we:skills-src/conveyor/delivery-agent-brief.md:197`). The title wraps a line break and holds inline
backticks, so the extractor joins lines, collapses whitespace, and matches on the raw text between the outer `*"` and
`"*` (never stopping at a backtick), then asserts that exact string appears as an `it('…')` literal in the guard test
source. A rename of either side reddens. A third assertion requires the command to contain `--run` and
`--passWithNoTests` (the brief says "always"), since the guard itself ignores those flags.

**Missing/restructured edge case (decided):** fail loud. The helper throws with the specific missing piece; a
restructured brief must update the marker deliberately. No skip path exists.

## MVP

Musts only:
- The extraction helper + the three-kind null assertion against the brief's real fenced command.
- Loud failure when marker, fence, or body is missing.
- The cited-test-title existence check.
- A mutation proof (scratch copy: drop the `we:scripts/readiness/heavy-admission.mjs` run -- wrapper) showing the
  guard assertion reddens; dropping `--run`/`--passWithNoTests` is caught by the separate flag-presence assertion
  (the guard ignores those flags, so it cannot catch them). Run in the builder's scratch, not committed.
- A one-line note in the test naming that the fix briefs are not yet covered (4369 open).

Out of scope → Follow-ups.

## Test plan

- `brief's mid-work command is not denied for any dispatch kind` — passes green today; RED proof: feed the helper a
  copy with the wrapper dropped (`npx vitest related …`) → `dispatchedAgentVerificationReason` returns a denial for
  `build`/`fix`/`ci-heal`, so the assertion fails. (Written test-first against a mutated fixture string to see red.)
- `extractMidWorkCommand throws when the marker is missing` / `…when no bash fence follows` / `…when the fence is
  unclosed` — each fails RED before the helper exists (import error) and pins the fail-loud edge case.
- `brief's cited guard-test title exists in the guard test file` — RED when the title is renamed in a scratch copy.
- `the extracted command keeps --run and --passWithNoTests` — RED against a scratch brief with either flag dropped
  (the guard ignores them, so this substring assertion is the only thing that catches it).
- `the extracted command is the admitted wrapper form` — `isAdmittedWrapperRun` true; reddens if the wrapper is dropped.

## Proof plan

Show before/after on the real files: (1) `npx vitest run we:scripts/__tests__/guard-bash.test.mjs` green on the real
brief; (2) in a scratch copy of the brief, delete `we:scripts/readiness/heavy-admission.mjs` run -- and rerun the helper/assertion against
that copy — output shows the denial reason and a red assertion; (3) rename the cited title in a scratch copy — title
check reddens; (4) truncate the brief (delete the marker) — helper throws with the named reason. Paste the four
outputs in the PR body.

## Follow-ups

- Extend the same extraction to `we:skills-src/conveyor/fix-agent-brief.md` / `we:skills-src/conveyor/fix-agent-ci-brief.md` `{{GATE_COMMAND}}` once #4369 lands
  (its own item; do not fold in now).
- Generalize the extractor into a shared test helper if a second brief-vs-guard assertion appears.
