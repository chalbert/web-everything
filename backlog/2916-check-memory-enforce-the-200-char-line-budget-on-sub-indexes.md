---
bornAs: xsc5shk
kind: task
status: open
dateOpened: "2026-08-05"
tags: [agent-memory, gate, context-budget]
---

# check-memory: enforce the 200-char line budget on sub-indexes and gate leaf naming

`we:docs/agent/memory-management.md` states the index-line budget as ≤ 200 chars and
`we:scripts/check-memory.mjs` prints it on every run — but `checkBudget()` is applied to
`we:agent-memory-src/MEMORY.md` only, never to the sub-indexes it already enumerates as `indexSources`. So
sub-index lines have drifted unchecked: the land-bar hook landed at 554 chars (2.7× budget, longest rule line in
the corpus) and the gate reported "within budget". A sub-index loads whole on a keyword match, so an oversized
hook is a recurring context cost, not a one-time one.

Three rules, same file:

1. **Line budget on sub-indexes.** Run `checkBudget()`'s per-line rule over every sub-index (reuse the existing
   `indexSources` list). ~10 pre-existing violations → land warn-only, then ratchet.
2. **No new hand-numbered leaves.** Reject a newly-added leaf whose filename carries a numeric prefix. Max
   existing is 146 and every leaf added since is slug-only, but the land-bar leaf was numbered 232 — the file
   count (231) + 1. Two incompatible "next number" heuristics can coexist today, and the repo already ruled
   against hand-picked ids in `we:agent-memory-src/scaffold-hash-ids-never-hand-number.md`. Also update the
   stale "create the next numbered leaf" line in `we:docs/agent/memory-management.md` so doc and gate agree.
3. **`name:` must equal the filename slug.** `we:scripts/memory-resolve.mjs` matches on the filename slug and
   ignores frontmatter, so a mismatch makes the `[[slug]]` cross-link form dead-end. ~30 pre-existing files
   drift → grandfather via a snapshot list, error only on new/changed leaves.

**Why non-blocking:** all three are convention drift that no current gate can see; nothing is broken today.

**Prevention for:** review findings on PR #1040 (simplicity + standards lenses).

**Locus:** `we:scripts/check-memory.mjs`

## Design

**The seam is one line.** `we:scripts/check-memory.mjs` already reads the sub-indexes: `indexSources` is
built as the index plus `topicFiles.filter(isSubIndex)`, and the loop under it walks each one for pointer
integrity. What that loop does **not** do is call `checkBudget()`. The budget call sits above it, applied once
to `content` (the `we:agent-memory-src/MEMORY.md` read) and nowhere else. So rule 1 is "fold the per-line
half of `checkBudget` into the `indexSources` loop", not a new traversal.

`checkBudget(content)` in `we:scripts/check-memory.mjs` returns `{ v, bytes }` and mixes two rules: a
**whole-file byte** budget (`MAX_BYTES`) that is meaningful only for the always-loaded index, and a
**per-line** budget (`MAX_LINE = 200`) that is meaningful for every index. Split the per-line half out (or
pass a flag) so a sub-index is line-checked without inheriting the byte budget — a sub-index is loaded on a
keyword match, so its total size is a different question from the always-loaded index's.

**`checkBudget` has an ES-import consumer outside its own file, and the split must not break it.**
`we:scripts/__tests__/golden-corpus-snapshot.test.mjs` imports `checkBudget` directly and calls it as
`checkBudget(fx.after)` on `isIndex` fixtures, asserting `v` is empty. So the **byte budget must stay the
default** for a bare one-argument call: a split that makes the caller opt IN to it silently drops that
fixture's coverage while staying green. Add the per-line-only behaviour as an explicit option, never by
changing what the existing signature means. (Raised by the independent review below; the card originally
named only the two call sites inside `we:scripts/check-memory.mjs`.)

**The pre-existing-violation count in the digest above is stale and the build must re-measure it.** Measured
on this branch: **64** sub-index lines exceed 200 chars across all 10 `we:agent-memory-src/index-*.md`
files (longest 904 chars, in `we:agent-memory-src/index-meta.md`), not "~10". Warn-only-then-ratchet is
still the right shape, but a build that lands rule 1 as an error on day one turns `npm run check:memory`
red 64 times.

Rules 2 and 3 are also drifted from the digest: the highest numbered leaf on this branch is **147** (no
`232-`-prefixed leaf exists any more; **145** leaves carry a numeric prefix at all), and **30** of the
**238 leaves** carrying a `name:` frontmatter key disagree with their filename slug — that one figure the
digest got right. (248 memory files carry a `name:` key in total; 10 of them are sub-indexes, not leaves.) `we:scripts/memory-resolve.mjs`
resolves on `slugOf(f)` (the filename with the `N-` prefix and the extension stripped) and never reads
frontmatter, which is why a mismatch dead-ends a `[[slug]]` link.

The test home already exists: `we:scripts/__tests__/check-memory.test.mjs`.

## Done when

- A new case in the existing suite feeds a sub-index holding a >200-char line through the sweep and asserts
  a violation is reported. Fails before (the sub-index is never budget-checked), passes after:

  ```
  npx vitest run scripts/__tests__/check-memory.test.mjs
  ```

- `npm run check:memory` names every over-budget sub-index line by file and line number, and the count it
  reports for the new rule matches this. Two independent measurements disagreed by one (**64** here, **63**
  in the review below's checkout) — which is exactly why this is re-measured at build time and never
  hardcoded:

  ```
  awk 'length($0)>200' agent-memory-src/index-*.md | wc -l
  ```

- Adding a leaf whose filename carries a numeric prefix (e.g. `we:agent-memory-src/999-x.md`) makes
  `npm run check:memory` exit non-zero, while the **145** existing numbered leaves keep it green — rule 2
  needs the same explicit grandfather that rule 3 has, because the sweep is a `readdirSync` walk with no
  notion of "new". The same leaf renamed slug-only makes it exit zero.
- A leaf whose `name:` differs from its filename slug is reported, and the 30 pre-existing drifters are
  grandfathered by an explicit snapshot list in `we:scripts/check-memory.mjs` — so `npm run check:memory`
  stays green on an unmodified tree.
- The "create the next numbered leaf" line in `we:docs/agent/memory-management.md` no longer says to pick a
  number by hand, matching `we:agent-memory-src/scaffold-hash-ids-never-hand-number.md`.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — Verified against live repo and git history: we:scripts/check-memory.mjs's checkBudget(content) is called only on the we:agent-memory-src/MEMORY.md read (line 156), never inside the indexSources loop (line 167-187) that already walks index-*.md sub-indexes for pointer integrity. The card's central claim is also corroborated by a real prior incident: commit 3c4c3a5f shows a human review pass on PR #1040 manually caught and fixed a hand-numbered '232-' leaf (max existing was 146) and a 554-char index line, exactly the defect class this card proposes gating.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The card re-measured against the live branch rather than trusting its own digest: it corrected the digest's stale '~10' sub-index violations to a measured count, corrected 'max leaf 146'/'232 exists' to the current state, and confirmed the 30-file name-mismatch count. My own remeasurement lands at 63 over-200-char sub-index lines (card says 64) and confirms 147 as the highest leaf number and 30 name-mismatches — close enough that the card's ratchet-not-block sizing decision (rule 1) is sound regardless of the off-by-one.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card discusses checkBudget's two call sites inside we:scripts/check-memory.mjs (the --pre hook and the sweep) but doesn't mention the ES-import consumer at we:scripts/__tests__/golden-corpus-snapshot.test.mjs:153, which calls checkBudget(fx.after) directly for isIndex fixtures and asserts v is empty. The proposed split ('pass a flag' so sub-indexes skip the byte budget) is compatible with this consumer if the byte check stays the default, but the card never says so explicitly.
- **population** (addressed; strategy: name the population each threshold guards) — Each rule names its guarded population precisely: rule 1 guards every line across the indexSources set (`we:agent-memory-src/MEMORY.md` + all index-*.md); rule 2 guards newly-added leaf filenames; rule 3 guards leaves whose name: frontmatter disagrees with their filename slug, with the 30 pre-existing drifters named as a population to grandfather.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when requires a new vitest case that reddens before the change (sub-index never budget-checked) and greens after, plus CLI exit-code assertions for adding/renaming a numeric-prefix leaf and for a name:-slug mismatch — all framed as before/after behavioral checks, not just presence checks.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The 200-char and byte budgets are pre-existing and unchanged; what's newly sized is the ratchet decision for rule 1, which the card explicitly re-measured (64 claimed / 63 confirmed violations) before committing to warn-only-then-ratchet rather than hardcoding the stale '~10' digest figure.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when requires 'npm run check:memory names every over-budget sub-index line by file and line number' and requires rule 3's mismatches to be individually reported — the failure is required to surface with enough detail to act on, not just flip an exit code.

**Corrections applied by this review:**

- The design section states 64 sub-index lines exceed 200 chars on this branch; `awk 'length($0)>200' agent-memory-src/index-*.md | wc -l` (the card's own acceptance command) currently returns 63.
- The design section states 30 of 248 leaves carrying a name: frontmatter key disagree with their filename slug; the live corpus has 237 leaf files (excluding index-*.md/MEMORY.md) with a name: field (247 including the 10 sub-indexes), not 248 — the 30-mismatch count itself is confirmed correct.

The core premise (checkBudget never applied to sub-indexes, and the 232/554-char land-bar incident) is real and independently verified against the live repo and git history, but rule 2's "reject a newly-added numeric-prefix leaf" is left without the explicit grandfather mechanism that rules 1 and 3 spell out for the same git-unaware sweep surface, and the design doesn't call out an existing ES-import consumer of checkBudget.

_Recorded through the declared `review-prep` operation._
