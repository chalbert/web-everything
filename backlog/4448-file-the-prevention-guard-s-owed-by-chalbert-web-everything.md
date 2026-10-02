---
bornAs: xu97sqw
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2858's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4364-drafts-belong-to-their-author-no-generic-fix-ci-heal-on-a-dr.md:141` — Add a story-preparation checklist item: for any card that removes an automatic actor, name who covers the abandoned case and require that fallback to land in the same step or earlier. Otherwise the card must say the interim is unsafe.
2. `we:backlog/4366-prevent-prs-that-open-with-red-ci-local-pre-flight-mirrors-e.md:57` — Have check:standards flag a backlog card where one backtick-quoted function name appears with different parameter lists in different sections.
3. `we:backlog/4364-drafts-belong-to-their-author-no-generic-fix-ci-heal-on-a-dr.md:72` — When a dependency edge is deliberately withheld, require a machine-readable frontmatter note (e.g. deferredBlockedBy) so prose and frontmatter can't disagree unnoticed.
4. `we:backlog/4364-drafts-belong-to-their-author-no-generic-fix-ci-heal-on-a-dr.md:6` — A `check:standards` validation step that requires if a source file is scoped, its corresponding test file must also be scoped if the card mandates testing.
5. `we:backlog/4366-prevent-prs-that-open-with-red-ci-local-pre-flight-mirrors-e.md:6` — A `check:standards` rule that flags any `we:...` file paths explicitly mentioned as deliverables in the text body that are missing from the `scope:` array.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2858@ce172108402e578b298190afb69cdac0421bd381

## Done when

1. **Executable** — `npx vitest run -t "#4448"` over `we:scripts/__tests__/check-standards.test.mjs` fails before this item lands (the new rule functions are not exported) and passes after; and `npm run check:standards -- --files=<fixture card>` on a throwaway card that scopes a source file but not its tracked test, or lists a `we:` deliverable under `## MVP`/`## Done when` that is missing from `scope:`, emits the matching warning.
2. `we:docs/agent/backlog-workflow.md` "Authoring an item" carries the removed-automatic-actor checklist line (guard 1).
3. `deferredBlockedBy` is a validated frontmatter field (guard 3), and the five guards' status (four built, guard 2 deferred) is recorded in `## Progress`.

## Progress

- **Premise check (2026-09-30, main `bc9db934`):** none of the five guards exists. `git log --grep 4448` shows only the JIT-number commit; `grep -r deferredBlockedBy` finds only this card; `we:scripts/check-standards.mjs` §6d-sexies/-septies validate `scope:` shape, dir-level scope and unresolved-path typos only (`we:scripts/check-standards.mjs:951-1032`, `we:scripts/check-standards-rules.mjs:3568-3700`). The goal is not delivered.
- **Stale premise corrected:** the cited `4364:141`, `4364:72`, `4364:6`, `4366:57`, `4366:6` line numbers no longer land on the guard text (both cards were re-prepared and rewritten since #2858's review). The five guards are therefore defined here from the card's own wording, not from those lines.
- **Scope corrected:** old `scope:` listed the two *source* cards (`we:backlog/4364-…`, `we:backlog/4366-…`), which the build never edits (they are where the findings were observed). New scope is the real write-set: the standards gate, its rules module, its test file, and the authoring doc.
- **Cut decision:** guard 2 (same backtick function name, different parameter lists across sections) is deferred to Follow-ups — see MVP.
- **Built (2026-10-01):** guards 1 (authoring-doc checklist bullet), 3 (`deferredBlockedByFindings`, error), 4 (`scopeMissingTestFile`, warn), 5 (`bodyDeliverablesMissingFromScope`, warn) shipped with unit tests; guard 2 deferred (Follow-ups). Corpus ratchet ceiling for guards 4+5 measured at 190 findings.

## Design

All four built guards follow the existing pattern in `we:scripts/check-standards-rules.mjs`: a pure, exported rule function over RAW frontmatter + body (like `dirLevelScopeFinding` at `:3568` and `scopeBasenameMismatches` at `:3650`), called from the per-item loop in `we:scripts/check-standards.mjs` §6d-sexies (`:985-1032`), emitting `warn()` (never `err()`) and honoring the same escapes (`status: resolved` skipped; a non-empty `scopeRationale:` clears the finding). Warning, not error, because the ~1400-warning corpus is the false-positive budget and a hard error would redden every existing card.

- **Guard 4 — scoped source ⇒ scoped test.** `scopeMissingTestFile(item, index)`: for each `we:` FILE entry (`isSubtreeEntry` false, imported at `we:scripts/check-standards-rules.mjs:19`) that is a source file (`.mjs`/`.ts`, not already under `__tests__/` or `*.test.*`), derive its sibling test path(s) (`<dir>/__tests__/<base>.test.<ext>`, and the top-level `we:scripts/__tests__/<base>.test.mjs` fallback that `scopeBasenameMismatches`' comment notes 8 `we:scripts/lib/` modules use). Fire only when (a) a tracked test file exists via the `buildTrackedPathIndex` index (`:3629`) and is missing from `scope:`, AND (b) the body has an `## Test plan` heading. Greenfield (no tracked test) stays silent, same as the basename rule. **Deliberately conservative / low recall:** it only recognises the sibling-name convention, so a module tested across several differently-named files (e.g. `we:scripts/check-standards-rules.mjs`, covered by `check-standards-rules-*.test.mjs`) never fires; that is accepted — a false positive costs more than a miss, and the finding names the one test it expects.
- **Guard 5 — body deliverable ⇒ in scope.** `bodyDeliverablesMissingFromScope(item, body)`: extract backtick-quoted `we:<path>` tokens from the body, restricted to the `## MVP` and `## Done when` sections only — the sections that commit to what the build delivers. `## Design` is excluded because it cites read-only references (this very card's Design cites `we:scripts/readiness/scope-lease.mjs`, which is not a deliverable and is rightly absent from scope), as are `## Follow-ups`, `## Progress` and prose elsewhere. The `scopeRationale:` escape also applies, and flag any not covered by `coversFile` (`we:scripts/readiness/scope-lease.mjs`) against `scope:`. File-shaped tokens only (has an extension).
- **Guard 3 — `deferredBlockedBy`.** A new optional frontmatter array of NNN ids: edges the author deliberately withheld from `blockedBy` (so the dispatcher doesn't hold the item) but wants machine-visible. A pure exported `deferredBlockedByFindings(rawFrontmatter, knownNums)` in `we:scripts/check-standards-rules.mjs` validates it, called from the RAW-frontmatter loop in §6d-sexies (`:985`) — NOT the loader-normalized `blockedBy` block at `:1062-1100`, because the loader drops unknown/wrong-typed fields and would hide a non-array value. It returns errors for: not an array, an id that does not resolve in `knownNums` (the `seenNums` set built earlier in the file), a self-edge, and an id present in both `deferredBlockedBy` and `blockedBy`. The loader ignores the field for readiness (it must NOT gate dispatch). `we:docs/agent/backlog-workflow.md` documents it beside `blockedBy` (#291 "Keep the blocker DAG honest"). Prose-vs-frontmatter disagreement is made *impossible to hide* by convention (the authoring doc says a withheld edge named in prose requires the field), not by prose parsing.
- **Guard 1 — removed-actor checklist line.** One checklist bullet in `we:docs/agent/backlog-workflow.md` "Authoring an item" (`:35`): for any card that removes an automatic actor, name who covers the abandoned case and require that fallback to land in the same step or earlier; otherwise the card must state the interim is unsafe. Doc-only because "removes an automatic actor" is not machine-decidable; the prepare briefs read this section already.

## MVP

Musts: guards 1, 3, 4, 5 as specified in Design, each warn-only where it is a lint, with unit tests and a live `check:standards` before/after. The authoring-doc bullet and the `deferredBlockedBy` doc/validation land together.

Deliberately OUT (see Follow-ups): guard 2; promoting any of these warnings to errors; backfilling the existing corpus's warnings; any change to dispatcher readiness semantics for `deferredBlockedBy`.

## Test plan

In `we:scripts/__tests__/check-standards.test.mjs`, a `describe('#4448 …')` block importing the real exported rules (never hand-mirrored copies — the #2751 lesson stated at `we:scripts/check-standards-rules.mjs:3560`):

1. `scopeMissingTestFile` flags `we:scripts/foo.mjs` scoped with a tracked `we:scripts/__tests__/foo.test.mjs` unscoped when the body has `## Test plan`. RED before: function not exported.
2. Same fixture with the test file scoped → `[]`; with no tracked test (greenfield) → `[]`; with no test mandate in the body → `[]`; `status: resolved` or a `scopeRationale` → `[]`.
3. `bodyDeliverablesMissingFromScope` flags a backticked `we:scripts/x.mjs` in `## MVP` or `## Done when` absent from scope; `[]` when covered by an exact entry or a subtree entry; `[]` when the path appears only under `## Design`, `## Follow-ups` or `## Progress` (a read-only reference — regression case built from this card's own Design); ignores non-file tokens (`we:` with no extension).
4. `deferredBlockedByFindings` returns a finding for a non-array, an unresolved id, a self-edge, and an id also in `blockedBy`; `[]` for a clean array or an absent field. RED before: function not exported (each case asserts a specific finding, so each is red for its own reason once the export exists but the check is missing).
5. A corpus ratchet (green-on-arrival, not RED-checkable — it pins the false-positive budget rather than proving the rule): run guards 4 and 5 over the real `we:backlog/` corpus with a git-tracked index and assert the finding count stays at or under the ceiling the builder measures and records at build time.

## Proof plan

Before/after on the real gate: on `main`, craft a throwaway card in the lane that scopes a source file but omits its tracked test and lists an unscoped `we:` deliverable under `## MVP` — `npm run check:standards -- --files=<that card>` prints neither warning; after the build, it prints both. Record the corpus-wide warning delta (a full-gate run's count of each new warning across `we:backlog/`, before vs after) in the PR body so the noise cost is visible. For guard 3, run the gate on a card with a `deferredBlockedBy` id also in `blockedBy` and show the error; remove it and show green. Guard 1: show the checklist bullet in the rendered authoring doc.

## Follow-ups

- **Guard 2 — mismatched parameter lists for one backtick function name across sections.** Deferred: it needs a corpus false-positive study first (call-site examples, overloads and prose like `f(x)` vs `f(x, y)` legitimately differ), and no deterministic definition of "same function" across sections exists yet. File as its own item (warn-only, measured against the corpus before shipping).
- Promote guards 4/5 from warning to error once the corpus is clean.
- Backfill existing cards the new warnings flag.
- A machine-readable "removes an automatic actor" marker so guard 1 could become a lint rather than a checklist line.
