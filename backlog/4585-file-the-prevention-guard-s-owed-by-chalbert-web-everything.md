---
bornAs: xxwaayo
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-memory.mjs", "we:scripts/__tests__/check-memory.test.mjs", "we:agent-memory-src/index-*.md"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "22570e96570ea3579bac37a9bdaa411283d232d1"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3080's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:agent-memory-src/index-meta.md:92` — A regex check in `check:standards` asserting that all list items in `we:agent-memory-src/index-*.md` files end with a `(YYYY-MM-DD)` date.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3080@7676f830dfa368785acf58002163fa079131800d

## Done when

1. **Executable** — `npm run check:memory` rejects a category-index entry without a terminal `(YYYY-MM-DD)` suffix, reports its file and line, and accepts the same entry after correction. The existing `npm run check:standards` integration surfaces that failure.
2. All tracked category-index entries conform, with dates backed by existing entry/leaf evidence or version history rather than an invented affirmation date.
3. The regression suite in `we:scripts/__tests__/check-memory.test.mjs` covers both the validator and the actual CLI sweep.

## Progress

- **Original premise/scope:** the independent review of PR #3080 requested a regex guard for all category-index list items, but this card scoped only `we:agent-memory-src/index-meta.md` and cited line 91.
- **Corrected premise/scope:** commit `7676f830dfa368785acf58002163fa079131800d` added the undated Night mode entry; it is now at `we:agent-memory-src/index-meta.md:92`, while line 91 names author attribution. The guard is still absent. A read-only scan found 292 bullet entries in ten tracked category indexes, 285 without a terminal date. Therefore implementation needs the existing memory gate, its matching test file, and the narrowly bounded category-index corpus backfill, not just one memory file.
- **Source evidence:** `we:scripts/check-memory.mjs:166` identifies category indexes and its sweep checks reachability but no terminal dates. `we:scripts/check-memory.mjs:150` currently exits successfully when the selected memory map is absent. `we:scripts/check-standards.mjs:2383` already invokes the memory CLI and turns its violations into errors. `we:scripts/__tests__/check-memory.test.mjs` exists but currently tests path predicates. The separate `we:scripts/check-memory-freshness.mjs` audits citations, not date suffixes. The reviewed commit delivered the memory entry, not this prevention guard.

## Design

Extend `we:scripts/check-memory.mjs` with an import-safe date-suffix validator and a scan of the tracked canonical `we:agent-memory-src/index-*.md` files. Reuse the existing standards-to-memory CLI integration; no second registration or change to `we:scripts/check-standards.mjs` is needed.

Inspect Markdown body list entries, excluding YAML frontmatter and fenced examples. Cover unordered markers and ordered list markers, including the existing numbered-memory form inside a bullet. Require the terminal pattern `\(\d{4}-\d{2}-\d{2}\)\s*$`; a date embedded earlier in the entry or followed by commentary does not satisfy it. This is the requested formatting guard, not calendar arithmetic, age-based eviction, or a claim that a memory was recently reaffirmed. Preserve headings, prose, and continuation lines.

Scan the canonical tracked directory independently of the user-memory-directory preference. Do not let the existing missing-map early return skip this check. Merge findings into the CLI's violation count and existing nonzero/text/JSON behavior, with each text diagnostic naming the actual index and one-based line. Keep existing budget, reachability, and secret checks intact.

Backfill missing suffixes across `we:agent-memory-src/index-*.md` in the same implementation change. Retain existing valid suffixes. Use an explicit date already attached to that memory when supported; otherwise use the commit date that introduced the entry, tracing moves through history as needed. Record provenance in the implementation review. Never label the migration date as historical creation or reaffirmation. Preserve entry wording and links.

## MVP

1. Add the pure validator and canonical-directory sweep in `we:scripts/check-memory.mjs`, wired into its normal CLI error path.
2. Extend `we:scripts/__tests__/check-memory.test.mjs` with fixture cases and isolated subprocess coverage for the normal sweep. Its corpus smoke also covers the scoped Markdown files.
3. Backfill the ten category indexes with evidenced dates and prove that removing one suffix reopens the failure through the existing standards integration.

## Test plan

- In `we:scripts/__tests__/check-memory.test.mjs`, accept dated linked and numbered-memory bullets, ordered items, trailing whitespace, and CRLF. Reject missing dates, non-padded dates, dates only in the middle, and text after the suffix; assert exact file and line diagnostics.
- Cover frontmatter, headings, prose, fenced examples, and continuation lines without false positives. Exclude the map, leaf files, and similarly named non-Markdown files from the directory scan.
- Exercise the actual CLI against a disposable fixture checkout containing its required imports: undated canonical entry fails, corrected entry passes, and JSON violation count agrees with exit status. Cover a missing legacy map and a preferred user-memory directory so neither bypasses canonical validation. Keep fixtures isolated from real user memory.
- Add a live canonical-corpus assertion after backfill. Run the focused suite with Vitest against `we:scripts/__tests__/check-memory.test.mjs`, then `npm run check:memory` and `npm run check:standards`.

## Proof plan

Before implementation, run the new negative fixture against the old CLI and capture its failure to reject the undated entry. After implementation, capture rejection with the index filename and line, then acceptance after adding a valid suffix. In a disposable checkout with the backfilled corpus, remove the Night mode suffix in `we:agent-memory-src/index-meta.md` and run `npm run check:standards`; capture its memory-index error, restore the suffix, and rerun. Distinguish unrelated baseline failures from this signal. Preserve the test output and the backfill's date provenance in the implementation review; preparation itself does not claim these future probes passed.

## Follow-ups

No additional feature is required for this prevention guard. Write-time hook enforcement, semantic freshness dates, calendar validation, and expiry rules are outside this item. Any future adoption needs its own scope; this work enforces only the reviewed terminal-date convention.
