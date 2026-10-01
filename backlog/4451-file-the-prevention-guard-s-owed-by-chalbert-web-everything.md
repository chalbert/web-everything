---
bornAs: xw9pg4u
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs", "we:scripts/check-backlog-item.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2863's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4370-lane-lifecycle-audit-journal.md:2` — A `check:standards` rule that validates the YAML frontmatter schema of all items in `backlog/` to ensure required fields are present.
2. `we:backlog/4371-lease-reaper-reaps-hand-briefed-leases.md:2` — A `check:standards` rule that validates the YAML frontmatter schema of all items in `backlog/` to ensure required fields are present.
3. `we:backlog/4372-health-watch-reclaim-resets-live-pushed-lane.md:2` — A `check:standards` rule that validates the YAML frontmatter schema of all items in `backlog/` to ensure required fields are present.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2863@bcc4263060ced5381a43cfd6a0351e15986c7c2c

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs` (drop the `we:` when typing it) fails before
   this item lands (no `findUnparseableFrontmatter` export) and passes after.
2. **Live proof** — a scratch card whose frontmatter has a non-colon YAML error (an unclosed quote) makes
   `npm run check:standards` exit non-zero naming that card; before the change the loader only warned and the
   gate stayed green.

## Progress

- **Premise check (2026-09-30, against `main` bc9db934c).** The three cited lines (`backlog/4370|4371|4372-*.md:2`)
  are each just `bornAs:` — boilerplate from the mechanical filer; the three guard descriptions are identical and
  cite no real code. The *named guard* ("a `check:standards` rule validating the frontmatter schema of all
  `backlog/` items for required fields") is **mostly delivered already**:
  `we:scripts/check-standards-rules.mjs:370` (`validateBacklogItem`) errors on a missing `id`/`title`/`kind`/
  `status`/`summary`/`dateOpened`, and `we:scripts/check-standards.mjs:815` runs it over every loaded item.
  It has existed since the kind-axis refactor (`4e75771b7`, #487) and its field list since 2026-06-10.
- **Old scope:** three resolved cards (not code; wrong). **Corrected scope:** the gate + rules files and the tests
  that pin them, per the Design below.
- **Residual gap found (the real, goal-preserving work).** `we:src/_data/backlog.js:372-375` drops any item whose
  frontmatter fails YAML parsing and only `console.warn`s (`:408-413`). The gate's one catch for that is the
  unquoted-colon scan (`we:scripts/check-standards.mjs:940`, `findUnquotedColonScalars`), which covers only that
  one cause. An unclosed quote, a tab indent or a bad flow collection vanishes the card from `backlog` — so the
  required-field rule above never sees it and the gate stays green. Also: no test pins `validateBacklogItem`'s
  required-field rule for backlog items (the only `missing required field` tests are for registry validators).

## Design

Close the "vanishes before validation" hole, and pin the rule that already exists.

1. **Pure helper** `findUnparseableFrontmatter(content)` in `we:scripts/check-standards-rules.mjs`, next to
   `findUnquotedColonScalars` (`:916`): runs `gray-matter` on the raw file and returns `{ reason }` when it
   throws, else `null`. It reuses the same parser the loader uses (`we:src/_data/backlog.js:372`), so "gate
   says unparseable" and "loader skipped it" cannot disagree.
2. **Gate wiring** in the existing §6d-quinquies loop (`we:scripts/check-standards.mjs:940`): per file, if
   `findUnquotedColonScalars` already reported it, skip (no duplicate error); otherwise call the new helper and
   `err()` with the file id, the parser's reason, and "the loader silently SKIPS the whole item". To keep the
   dedup + message testable, the helper is `describeUnparseableFrontmatter(raw)` returning
   `{ colonHits, parseReason }`; the gate loop just formats its result. Also fix the stale comment at
   `we:scripts/check-standards.mjs:984` (it claims the colon scan reports every parse failure — false for
   non-colon causes).
2b. **Scoped-validator parity** (`we:scripts/check-backlog-item.mjs:72`): its raw-parse fallback calls
   `matter(content)` unguarded (crashes on a bad card) and it runs only the colon scan. Guard the call and report
   the same `describeUnparseableFrontmatter` finding, so the scoped lint cannot disagree with the gate.
3. **(Nice-to-have, cheap — not part of the guard)** **Pin the existing rule**: a new `describe` in the new test file asserting `validateBacklogItem` errors on a
   missing `kind`, `status` and `dateOpened` (the frontmatter-sourced required fields) for a backlog item.

## MVP

Musts only: the helper, its gate call-site, the scoped-validator parity fix, the new test file. Out of scope (see Follow-ups): changing the
loader, a required-fields rule for `bornAs`/`preparedDate`, and any change to the colon scan.

## Test plan

New file `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs` (all cases import
`describeUnparseableFrontmatter`, so every case is RED before — the export does not exist; the cases below say
what each asserts after):

- *unclosed quote*: `'---\nkind: "story\n---\n'` → `parseReason` set, `colonHits` empty (the case the colon scan misses).
- *unquoted colon* (a `graduatedTo: x: y` line): `colonHits` non-empty and `parseReason` set — the dedup input
  the gate formats (it prints the colon message only).
- *valid frontmatter*: both empty (guards against a rule that flags everything).
- *no frontmatter fence*: both empty — plain markdown is "no frontmatter"; missing fields are the required-field
  rule's job.
- *(nice-to-have pin, green today)* `validateBacklogItem` with `kind`, `status`, `dateOpened` each removed yields
  `missing required field "<f>"`; reuses a local copy of the `baseItem`/context shape.

## Proof plan

Before/after on the real gate. The scratch card (unclosed-quote frontmatter) is untracked, created in the lane and
removed in a `finally`/trap; each gate run's output is saved to a log file in the lane as evidence. Pre-change tree:
`npm run check:standards` exits **0** with only the loader's `[backlog] 1 item(s) skipped` warning. Post-change
tree: exits non-zero with the new error naming the scratch card. Same for `npm run check:item` (`we:scripts/check-backlog-item.mjs`) on
the scratch card (pre: crash; post: reported error). Then the clean tree stays green.

## Follow-ups

- Make the loader (`we:src/_data/backlog.js`) expose its `malformed` list so the gate can consume it directly
  instead of re-parsing (removes the double parse).
- Optional required-field rules for `bornAs` (JIT-numbering identity) and `preparedDate` on prepared items.
- Fix the filer that emitted this card so its guard descriptions and `file:line` cites are specific, not
  copy-pasted boilerplate.
