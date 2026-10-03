---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/backlog.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "e6c5e01ae7849b77d7fc4844505e24b32888f92a"
tags: []
---

# Prevention — A card lint that warns when file paths named in the body are missing from the scope frontmatter. Failin… (from chalbert/web-everything#3398 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xxh4zw8-a-cancelled-required-check-still-strands-a-pr-in-awaiting-ci.md:5` — A card lint that warns when file paths named in the body are missing from the `scope` frontmatter. Failing that, a reviewer lens on card edits.
2. `we:backlog/xxh4zw8-a-cancelled-required-check-still-strands-a-pr-in-awaiting-ci.md:15` — A check:standards rule rejecting 'TODO:' in the Done-when section of open cards at pickup time. Filing is owed if no such gate exists.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3398@31a071b0d6f38e8130f2ae7405c7a7dddf422414

## Done when

1. **Executable** — `npx vitest run -t x5h6m3z` (every new test name carries the id `x5h6m3z`) fails before this item lands (no `findDoneWhenTodo` export; `prepare-stamp` stamps a card whose `## Done when` still holds an unfilled placeholder) and passes after.
2. **Must 1** — `findDoneWhenTodo(body)` returns the offending lines for a `TODO:` outside code spans in `## Done when`, and nothing for a `TODO:` elsewhere, a `TODO:` quoted inside a code span (as this card does), or a resolved card.
3. **Must 2** — `check:standards` warns on an open/active card whose `## Done when` still carries `TODO:`.
4. **Must 3 (on error: refuse)** — `prepare-stamp` (`we:scripts/backlog.mjs`) exits non-zero and writes nothing when the card's `## Done when` still carries `TODO:`; a card with a real Done-when stamps as before.

## Progress

Preparation, 2026-10-02.

- **Old premise/scope:** two guards owed from the #3398 review; scope pointed at the unrelated card `xxh4zw8` (a copy slip from the review's own subject).
- **Corrected premise:** guard 1 (paths named in the body but missing from `scope:`) is already delivered by #4448 as `bodyDeliverablesMissingFromScope` (`we:scripts/check-standards-rules.mjs:3869`), wired as a warning at `we:scripts/check-standards.mjs:1060`, tested at `we:scripts/__tests__/check-standards.test.mjs:574-582`. It deliberately scans only `## MVP` / `## Done when` (`deliverableSections`, line 3856) — the sections that commit to deliverables — so widening it to the whole body is not done here. Guard 2 (`TODO:` in Done-when) is not built: the only `TODO:` source is the scaffold skeleton (`we:scripts/backlog/scaffold.mjs:113`) and nothing reads it back.
- **Overlap:** open siblings `x9t0jzp` and `x2g29ih` ask for a similar Done-when `TODO:` rule. Tie-break: whichever builds first lands the rule; the builder of the others must re-check `findDoneWhenTodo` on `main` and resolve as already-delivered rather than build a second copy. This card is not blocked on them.
- **Corrected scope:** guard 2 only; scope now the four files below.

## Design

`we:scripts/backlog/scaffold.mjs:113` emits `1. **Executable** — TODO: …` on purpose so a fresh card reads as unfinished. A hard `check:standards` error would therefore redden every new card, so the "rejection at pickup" is split: a warning in the gate (visible, never blocking) and a refusal at the one pickup step that makes a card build-eligible, `prepareStamp` (`we:scripts/backlog.mjs:584`). This is a weaker gate than the original "reject at pickup": a card claimed without a prepare pass still gets picked up and only sees the warning. Refusing at `claim` is the full gate, but it runs through the claim operation (`claimViaOperation`, `we:scripts/backlog.mjs:394`), a larger change with its own blast radius, so it is a Follow-up rather than a Must.

- Add pure `findDoneWhenTodo(body)` beside `findMustWithoutDoneWhen` in `we:scripts/check-standards-rules.mjs` (reuses `sectionLines(lines, /^done when\b/i)`, line 1003). Per line it first strips backtick code spans, then matches `/\bTODO:/`, so a card that merely quotes the placeholder (including this one) is not flagged. Returns `{ line, text }`.
- In the open/active-card block near line 1213 (`item.status !== 'resolved'`), push a warning naming the card and telling the author to replace the TODO with a real runnable command.
- In `prepareStamp`, after reading `before`, run `findDoneWhenTodo` on the body and `die(...)` before any write.

## MVP

Musts: the helper, the warning, the `prepare-stamp` refusal (Done-when Musts 1–3), each with a unit test.

Deliberately OUT (see Follow-ups): refusing at `claim`; widening guard 1 beyond MVP / Done-when; promoting the warning to an error; backfilling existing cards.

## Test plan

All test names include `x5h6m3z`.

- `x5h6m3z findDoneWhenTodo flags an unfilled TODO in Done when` — asserts one hit with its line; RED because the export does not exist.
- `x5h6m3z findDoneWhenTodo ignores TODO outside Done when and inside code spans` — a `TODO:` in `## Design`, and a backticked one in Done-when, return `[]`; RED for the same reason.
- `x5h6m3z check:standards warns on TODO in Done when of an open card, not a resolved one` — RED: no such warning exists today.
- `x5h6m3z prepare-stamp refuses a card with TODO in Done when` — extends `we:scripts/__tests__/backlog-prepare-stamp-status.test.mjs`; needs its own fixture with a `## Done when` body and a try/catch around `execFileSync` (the existing `stamp()` helper has no Done-when and throws on non-zero exit); asserts non-zero exit and an unchanged file; RED because it stamps today.
- `x5h6m3z prepare-stamp still stamps a card with a real Done when` — preservation case: GREEN today and after; mutation proof: dropping the refusal makes the refusal case fail while this one stays green.

## Proof plan

Before: run `prepare-stamp` (`we:scripts/backlog.mjs`) on a scratch copy of this card with its TODO restored and show it stamps; run `npm run check:standards` and show no TODO warning. After: the same two commands show the refusal and the new warning, on the real card shape. Then run the full unit suites touched.

## Follow-ups

- Refuse at `claim` as well, if prepare-stamp proves too late.
- Widen guard 1 to every file-shaped `we:` token in the body, if the MVP/Done-when-only scan proves to miss real cases.
- Promote the TODO warning to an error once the open corpus is clean.
