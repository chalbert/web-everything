---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs", "we:scripts/backlog.mjs", "we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs", "we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "192a449c5584321e74284592d9aa9c84efe97e44"
tags: []
---

# Prevention — reject prepared cards without executable acceptance or linked prevention debt

Close the preparation gaps recorded on approval of chalbert/web-everything#3459: enforce executable acceptance, require linked prevention follow-ups, and specify the missing forged-success regression for #4513.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3459@df41769951e4048a49e1dafd318ae064afd27521

## Progress

Preparation research (unstamped). The original scope named only `we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md`, but requested two executable preparation guards as well as a specification correction. The old line-59 citation is stale; that card's current `## Done when` has prose instead of a numbered executable criterion, its `## Follow-ups` lists generalized guards without owning backlog references, and its `## Design` step 3 describes framing without a per-invocation nonce. The originally named `we:daemon-boot-smoke-prevention.test.mjs` is not a root-level file: the planned test belongs at `we:scripts/lib/__tests__/daemon-boot-smoke-prevention.test.mjs` and is already in #4513's design/test plan.

Corrected scope: implement the shared structural rule in `we:scripts/check-standards-rules.mjs`, with coverage in existing `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs`; enforce the same predicate before mutation in `we:scripts/backlog.mjs`, with coverage in existing `we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs`; amend #4513's specification. The smoke implementation and its future regression remain #4513's delivery, not duplicate implementation in this card.

Source evidence: `lintBacklogItemRendering` in `we:scripts/check-standards-rules.mjs` already supplies both `we:scripts/check-standards.mjs` and `we:scripts/check-backlog-item.mjs`. Existing Must-coverage and dangling-reference checks are warnings, not these preparation refusals. `missingDoneWhenProof` in `we:scripts/audit-backlog-health.mjs` accepts broad path-shaped evidence/exemptions and reports an audit candidate; it does not enforce a numbered Executable line. `prepareStamp` in `we:scripts/backlog.mjs:584` writes the stamps without this body validation. `we:scripts/operations/prepare-stamp-land.mjs:47` delegates to that CLI, so the CLI is the common pre-write boundary.

Observed read-only probes: running the shared rendering lint on #4513 with its prepared metadata returned zero errors. Injecting a child runner that always returns the fixed JSON success object into `checkDaemonEntriesBoot` returned success for all six entries. This latter probe tests parent result acceptance, not a real forged child process. In `we:scripts/lib/daemon-boot-smoke.mjs`, `bootOneEntry` parses whole stdout and coerces its `ok` member; `buildEntryBootScript` has no nonce. The goal is not already delivered.

## Design

1. Add one exported pure preparation-body validator in `we:scripts/check-standards-rules.mjs`. Within the actual level-two `## Done when` section, require a numbered `**Executable**` line containing a nonempty backtick command, or an explicit `why not` line with a nonempty explanation. Ignore fenced examples and HTML comments. A TODO, an empty code span, or evidence only in another section is insufficient. Validate syntax only; never execute author-supplied commands or claim their semantics have been proved.
2. For prevention-debt cards, identified by the existing `approval-prevention-key:` marker, require each Follow-ups or owed section to contain a backlog ID reference. Accept landed numeric and provisional IDs using the repository's existing reference conventions. A mention elsewhere in the card does not satisfy the section. This is the requested structural guard, not an inference that one link proves ownership of every obligation. Keep existing dangling-reference checks; do not turn this into a new global reference policy.
3. Call the validator from `lintBacklogItemRendering` for cards carrying `preparedDate`, reporting errors with the offending section and repair guidance. Call it unconditionally for the candidate passed to `prepareStamp`, before changing status or stamps or writing bytes. Both paths use identical rules; an unstamped draft remains editable, but attempting to stamp it runs the preparation check. Do not replace the broader advisory health audit.
4. Amend #4513's Design and Test plan to require a fresh random nonce per child invocation, passed through argv, and exactly one matching terminal result frame with a boolean result and successful child exit. Its planned prevention suite must import a fixture that prints a fixed forged success frame and exits zero before import completes; expect failure. Include missing, mismatched and duplicate nonce frames, valid completion, and nonzero exit despite a matching frame. Preserve the existing bounded-child failure contract. A nonce visible to the imported module is correlation, not authentication: do not claim this defends against hostile code reading argv and echoing the current nonce.
5. Replace #4513's acceptance prose with concrete numbered executable evidence consistent with its existing test scope, and link its outstanding generalization work to this item's existing provisional ID where this item actually owns it. Other generalized obligations must receive their own backlog ownership during delivery, rather than claiming that this card implements them. This preparation edits only this card; it does not file or modify those cards now.

## MVP

1. **Must** — Reject prepared cards missing the required executable line or explained why-not line, using the shared validator and standards error channel.
2. **Must** — Reject preparation of prevention-debt cards whose Follow-ups or owed section lacks a backlog reference.
3. **Must** — Refuse invalid stamp attempts before any file mutation; preserve valid stamp status handling and repeat-call idempotence.
4. **Must** — Correct #4513's nonce/forged-success specification, executable acceptance and prevention-debt ownership without implementing its smoke harness in this change.

## Test plan

- Capability (red on base), `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs`: prepared cards with absent Done when, unnumbered Executable, empty command, TODO, evidence in another section, fenced/commented fake criteria, and empty why-not reason produce errors. Prevention-marker fixtures with Follow-ups and owed sections lacking local references fail independently; a reference elsewhere is insufficient.
- Preservation (green on both), the same suite: valid numbered command and explained why-not variants, numeric/provisional references in the relevant sections, ordinary unprepared drafts, and ordinary cards without the prevention marker remain accepted. Mutation proof: remove the prepared/marker predicates or reject all inputs; these cases must fail. Add mixed-case headings and section-boundary fixtures to pin the intended parsing.
- Capability (red on base), `we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs`: invalid first stamp and invalid re-stamp exit nonzero in a scratch repository and leave the complete card byte-identical, including existing status/date/SHA. Valid fixtures exercise absent/open/active/preparing/parked statuses and repeat-call idempotence. Update existing bare-body fixture builders to include valid acceptance. Preservation mutation proof: move validation after writing or normalize active status to open; the byte/status assertions must fail.
- Specification proof for Must 4: inspect the diff of `we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` for the fixed forged-frame early-exit fixture, nonce/exit validation, nonce threat-model limit, executable command and owning follow-up IDs. The matching runtime test is planned at `we:scripts/lib/__tests__/daemon-boot-smoke-prevention.test.mjs` under #4513; executing that regression belongs to its implementation, not this documentation amendment.

## Proof plan

During delivery, add focused negative fixtures first and capture failures against the base. Run the two scoped Vitest suites and retain counts/exit statuses. Demonstrate invalid stamping only in disposable scratch repositories: compare bytes before/after refusal, then stamp an otherwise identical corrected fixture. Run `npm run check:standards` and the existing scoped item checker on the amended #4513; record any pre-existing corpus failures separately rather than weakening the guard to obtain green. Inspect both integration paths to verify they call the same validator. No command extracted from a card is executed by the validator.

This preparation's observations are recorded above; delivery regressions have not been implemented or claimed green. The runner owns preparation checks and stamping.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs` verifies Musts 1–3 with red/green evidence; remove the `we:` reference prefixes when executing these WE-relative paths.
2. **Executable** — `npm run check:standards` passes with the new prepared-card checks enabled (Musts 1–2).
3. **Observable** — The reviewed #4513 diff contains all specification corrections and linked debt from Must 4; its runtime implementation remains owned by #4513.

## Follow-ups

#4513 owns implementation and execution of the smoke nonce/forged-success regression, alongside its other smoke/watchdog guards. #4075 remains the parent tracking prevention work. File distinct owners during delivery for the unrelated generalizations already listed in #4513; do not treat a parent link as evidence those guards shipped. No additional runtime generalization is introduced by this card.
