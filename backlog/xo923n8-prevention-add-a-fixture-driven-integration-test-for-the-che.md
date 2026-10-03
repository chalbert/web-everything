---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs", "we:scripts/check-standards-rules.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "a4687bea96bcde71038823a9ffeee3ff774c04f2"
tags: []
---

# Prevention — Add a fixture-driven integration test for the check-standards frontmatter scan and for check-backlog-it… (from chalbert/web-everything#3335 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards.mjs:944` — Add a fixture-driven integration test for the check-standards frontmatter scan and for check-backlog-item. Alternatively, add a check:standards rule that every rule-emitting call site has a test referencing its message.
2. `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs:5` — Add deterministic CLI regression tests using malformed non-colon frontmatter and asserting an actionable diagnostic and nonzero exit status for both entry points.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3335@a51aeb9e2788a232f2887b8e1610e05dde931c2c

## Done when

1. **Executable** — `npx vitest run check-backlog-item check-standards-frontmatter-parse` (name filters for we:scripts/__tests__/check-backlog-item.test.mjs and we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs) passes, and each new CLI case goes RED when its emit site (`we:scripts/check-backlog-item.mjs:86-89` or `we:scripts/check-standards.mjs:944-949`) is deleted.
2. **Refuse on error** — a card with non-colon malformed frontmatter makes both CLIs exit 1 with the "unparseable frontmatter" diagnostic.
3. **Other input kinds** — a valid card and a no-fence card stay clean (exit 0) through both CLIs.

## Progress

- Premise check (2026-10-03): the rule itself landed in #4451 (`a51aeb9e2`): `describeUnparseableFrontmatter` returns `parseReason`, emitted at `we:scripts/check-standards.mjs:944-949` and `we:scripts/check-backlog-item.mjs:86-89`. Only unit tests of the helper exist (`we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs`). The CLI-level regression tests this card asks for are NOT delivered, so the goal stands.
- Premise finding (review, verified 2026-10-03): the rule is DEAD in both CLIs. gray-matter caches by content string and only the first parse of a string throws; the loader (check-standards) or the earlier try/catch (check-backlog-item) parses first, so `describeUnparseableFrontmatter` at we:scripts/check-standards-rules.mjs:954 silently gets no error. A fixture with `kind: "story` exits 0 from both CLIs today. The helper unit tests pass only because they call it cold. So this card must fix the helper too, then prove it.
- Scope corrected: old scope named `we:scripts/__tests__/check-standards.test.mjs`, which has no CLI cases. New scope is the two test files below; `we:scripts/check-standards.mjs` stays listed only for the alternative rule.

## Design

First the source fix: in `describeUnparseableFrontmatter` (we:scripts/check-standards-rules.mjs:954) call gray-matter with an explicit options object (`matter(content, {})`), which bypasses its string-keyed cache so a prior parse cannot mask the error. Add a unit test that parses the same string once (caught) then calls the helper and still gets a `parseReason`.

Then the CLI tests. Both CLIs resolve `backlog/` from their own location with no override, so tests follow the precedent in `we:scripts/__tests__/check-backlog-item.test.mjs` (header, lines 1-20): write a fixture card with a reserved hash id into `backlog/`, spawn the real CLI with `spawnSync(process.execPath, [CLI, ID])`, assert exit code and output, and delete the card in `finally` plus `afterEach`. Add a `describe` there for `check-backlog-item` using `kind: "story` (unclosed quote). For `we:scripts/check-standards.mjs` the full gate is slow, so add one case to `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs` that spawns it once with the same fixture and asserts exit 1 and a line naming the fixture id and "unparseable frontmatter". Use a distinct reserved id (e.g. `x0zzzz8`) so it never clashes with the existing fixture.

## MVP

Musts only: (0) the cache-bypass fix plus its warm-cache unit test; (a) check-backlog-item CLI test with malformed non-colon frontmatter (exit 1, message names the item and "unparseable frontmatter"); (b) check-standards CLI test with the same fixture (exit 1, same diagnostic); (c) clean-card and no-fence controls for check-backlog-item (exit 0), matching Done-when #3. The check-standards CLI case needs a raised vitest timeout (about 180000 ms; a full gate run takes about 80 s). Out of scope: the generic "every rule-emitting call site has a test" check:standards rule (Follow-up).

## Test plan

- `check-backlog-item` rejects unclosed-quote frontmatter: fails RED if the `parseReason` branch at `we:scripts/check-backlog-item.mjs:87` is removed (exit would be 0).
- `check-standards` rejects the same fixture: fails RED if `we:scripts/check-standards.mjs:944-949` is removed, since no other rule sees the skipped item.
- Warm-cache unit test: fails RED today (helper returns null after a prior parse of the same string).
- Valid card control passes check-backlog-item with exit 0: guards against the diagnostic firing on good input.
- Fixture cleanup: the card file is gone after each case, even on failure.

## Proof plan

Before: with the fixture in backlog/, show both CLIs exit 0 and print clean. After the cache fix, show both exit 1 with the diagnostic. Run the two test files green. Then temporarily comment out the emit block in each CLI, re-run, and show the matching new case turns red; restore and show green again. Quote both runs in the PR body.

## Follow-ups

- A `check:standards` rule that every rule-emitting call site has a test referencing its message (the alternative named in item 1 of the review).
- An `--root` override for both CLIs so fixtures need not touch the real `backlog/`.
