---
bornAs: xj4zte0
kind: story
size: 2
parent: "2527"
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/check-standards.mjs
  - we:scripts/lib/citation-check.mjs
tags: [citation-verification, check-standards, performance, gate-hygiene]
---

# Citation-gate wiring: dedupe findings per file and stop re-reading the corpus on every locus

The CITATION-VERIFICATION block in [we:scripts/check-standards.mjs](scripts/check-standards.mjs) emits one
warning per *occurrence* and re-reads every cited file once per citation. Both are wiring-level waste that
grows with the corpus, not defects in the pure detectors.

## Provenance

Filed from the independent `/review` of PR #974 (the CITATION-VERIFICATION gate, a proven subset of #2821).
Measured during that review; dispositioned as optional-not-blocking because the gate ships warn-only
(`CITATION_GATES_ENFORCED = false`).

## The three measured problems

- **Per-occurrence emission.** `findOutOfScopeHashSlugs` returns one finding per match and the caller warns
  on each, so the current corpus produces **85 warnings for 30 distinct slugs**. One slug alone yields 11.
  A slug written in both cited forms — the hash cross-ref and the file-link — yields three findings for
  what a reader sees as one problem. Every duplicate carries the same `{kind, file}` descriptor, so
  `--scope` cannot tell them apart — the opposite of the per-file keying #1389 established for the sibling
  repo-locus rule two blocks above in the same file.
- **Unmemoized re-reads.** The injected `relLineCount` closure re-reads and re-splits the cited file on
  every locus occurrence. Measured: [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md)
  (355 KB) read and line-split **145 times**, [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)
  (207 KB) **40 times** — **113.7 MB** of redundant I/O and string splitting in one gate pass, across only
  279 distinct files out of 1513 reads. Cost is O(citations × file size) and grows every time a popular
  file gains another citation.
- **Whole-corpus materialization.** `scanFiles` reads all 3848 scanned files into one array before
  scanning — ~54 MB resident, 73 MB peak — when every detector is per-file and stateless.

## Approach

- Dedupe by `(slug, form)` inside the pure core, with a unit fixture asserting a slug repeated N times
  yields one finding. Keep the dedupe in the core, not the caller, so every consumer inherits it.
- Memoize the line-count reader with a `Map` keyed on the repo-relative path (one line).
- Stream the scan — read and scan one file at a time instead of collecting first. Nothing needs two files
  at once.

## Durable guard (the prevention, not just the fix)

Two candidates surfaced in review; pick whichever is cheaper to land:

- A `check:standards` self-test asserting **no two emitted findings share an identical
  `(message, descriptor.file)` pair** — this mechanically enforces the #1389 per-file convention for every
  rule, present and future, instead of relying on each new rule's author recalling it.
- A wall-time budget assertion in the check-standards test suite, which catches the whole repeated-read /
  re-parse / per-file-recompile class without naming each instance.

## Acceptance

- A slug cited N times in one file produces exactly one finding.
- No file is read more than once per `check:standards` pass (assert via a counting reader in a test).
- The gate's contribution to `check:standards` wall time and peak RSS is measurably lower than before, and
  a regression guard exists so it cannot silently drift back.
