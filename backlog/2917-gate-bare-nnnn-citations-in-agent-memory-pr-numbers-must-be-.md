---
bornAs: xvjmgrz
kind: task
status: open
dateOpened: "2026-08-05"
tags: [agent-memory, gate, check-standards]
---

# Gate bare #NNNN citations in agent-memory — PR numbers must be namespaced

A bare `#NNNN` in a memory leaf means a BACKLOG item — `we:scripts/lib/memory-freshness.cjs` already resolves
every match that way. But the backlog and PR counters overlap in the 1000s, so a PR number written bare
resolves silently to an unrelated card AND the freshness audit stays green, because it resolved. Found on the
land-bar leaf, where `#1031`, `#1037` and `#1022` all hit real-but-wrong items. Add a signal to
`we:scripts/lib/memory-freshness.cjs`, which already owns the `#NNNN` namespace and the regex, that makes the
namespace convention machine-checked rather than recalled.

**Why non-blocking:** the corpus already uses prefixed forms (`PR #460`, `WE #558`) by convention; this makes
the convention machine-checked rather than recalled. *(Measured false — see `## Design` below: ~950 of ~1000
cites carry no namespace token. Kept as the filing record; do not build to it.)*

**Prevention for:** review finding on PR #1040 (correctness + standards lenses, independently).

**Locus:** `we:scripts/lib/memory-freshness.cjs`

## Design

### The seam

`we:scripts/lib/memory-freshness.cjs` already owns the `#NNNN` namespace end to end and needs no new
plumbing:

- `CITE_RE = /#(\d{3,4})\b/g` (~L177) and `isPrCite(text, idx)` (~L178) — the latter is the ONLY namespace
  awareness that exists today, and it is a 4-character lookbehind for `PR\s*$`.
- `findCites(text)` (~L180) drops `PR #NNNN` and returns every other cite.
- `collectLeafTexts(memDir)` (~L209) gathers `{ file, text }` for every leaf; `isLeaf` (~L36) excludes
  `we:MEMORY.md` and the `index-*.md` files. `MEM_DIR` (~L31) is `.claude/agent-memory`, a symlink to
  `we:agent-memory-src/` — 250 leaves on this tree.
- `auditCiteResolution(leafTexts, backlogIndex)` (~L219) is the existing signal-1 pattern to mirror: pure,
  injected with leaf texts + the backlog index, fixture-testable with no fs. A new signal is a sibling
  function of the same shape, folded into the same `check:standards` call site.

### The premise in the item's own body is wrong, and the build must not follow it

The body says *"the corpus already uses prefixed forms (`PR #460`, `WE #558`) by convention; this makes the
convention machine-checked rather than recalled."* Measured on this tree across all 250 leaves, the
distribution of the token immediately preceding a `#NNNN` is:

| preceding token | count |
|---|---|
| *(none — bare)* | 743 |
| `the` | 63 |
| `PR` | 25 |
| `on` | 22 |
| `and` | 17 |
| `backlog` | 15 |
| `epic` | 13 |
| `WE` | 10 |

So roughly **950 cites carry no namespace token at all** against ~50 that do. A rule that warns on every
bare `#NNNN` emits ~950 warnings on day one — which is not a machine-checked convention, it is a warning
stream nobody reads, and it contradicts the corpus rule the module's own comments cite from
`we:agent-memory-src/land-on-no-regression-not-perfection.md`: *"A bare `#NNNN` in this corpus means a
BACKLOG item. Pull requests are always written `PR #NNNN`."* Under that rule a bare cite is **correct**, not
suspect.

The **real** defect the item found is narrower and still real: a PR number written bare resolves silently to
an unrelated backlog card, and signal 1 stays green precisely *because* the number resolves. `#1031`, `#1037`
and `#1022` on the land-bar leaf are that failure. So the buildable question is *"how do you detect a bare
cite that means a PR"*, not *"flag every bare cite"*.

### Rule the shape before building — three candidates, none pre-ruled here

- **(a) Widen the namespace vocabulary only.** Recognize `WE `, `FUI `, `plateau-app `, `backlog ` alongside
  `PR ` in `isPrCite`'s successor, so an explicitly-namespaced cite is exempted from signal 1's backlog
  resolution. Cheap, correct, and closes nothing — a bare PR number still resolves to the wrong card.
- **(b) Corroboration signal.** Warn on a bare `#NNNN` whose surrounding sentence carries PR-shaped vocabulary
  (`merged`, `landed`, `opened`, `review`, `commit`, `label`) AND whose resolved backlog item's title bears no
  relation to that sentence. Precision-first, in the same spirit as signals 2 and 3, which were both
  calibrated to 0 false positives before landing.
- **(c) Cross-check against the real PR ledger.** A bare `#NNNN` that resolves to a backlog item *and* also
  exists as a merged PR in the overlapping range is inherently ambiguous; flag those.

Whichever is taken, the **calibration bar the module already sets applies**: the docblock at ~L166 records
that all three existing signals were "precision-first, calibrated against the live 240+-leaf corpus", each
requiring an explicit structural marker and *never* a bare proximity heuristic, and were measured at 0 false
positives before landing. A new signal that cannot state its false-positive count on the live corpus does not
meet that bar.

## Done when

1. `npx vitest run memory-freshness` fails before and passes after, with fixture cases for the new signal in
   both directions: a leaf line that SHOULD flag, and at least three that must NOT — including a bare cite
   that genuinely means a backlog item (the corpus's overwhelming majority case), an already-namespaced
   `PR #NNNN`, and a `#NNNN` inside a code fence or a `bornAs:`-style quoted value. (Tier 1.)
2. `npm run check:standards` is GREEN, and the run's output records the new signal's finding count on the
   live leaf corpus (239 leaves today). A count in the hundreds means the rule was built to the item's stated premise rather
   than its real defect — treat that as a red result, not a pass. (Tier 1.)
3. The three cites the item names — `#1031`, `#1037`, `#1022` on the land-bar leaf — are each either flagged
   by the new signal or already correct, and which is stated on the item. **Already true as of this prep:**
   `grep` of `we:agent-memory-src/land-on-no-regression-not-perfection.md` shows `PR #1031` and `PR #1037`
   (namespaced by commit `3c4c3a5f`, 2026-08-05 — the same day this item was opened) and no `#1022` at all.
   So the motivating anecdote below is a *historical* record, not a live reproduction: the implementing lane
   must find a fresh instance or state that none exists, rather than assuming the three are still broken.
   (Tier 2.)
4. The signal's own docblock states its measured false-positive count on the live corpus, in the same form
   the existing three signals do at `we:scripts/lib/memory-freshness.cjs` ~L166–172. (Tier 3 — read that
   docblock.)

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — The item's own original premise ("the corpus already uses prefixed forms by convention") is explicitly mutation-tested against the live 238-leaf corpus in `we:agent-memory-src/` and found false (~940-960 of ~960 cites carry no genuine namespace token, only PR/WE do) — a textbook premise-verification-before-building pass, not just an assertion.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Design section measures the real corpus before proposing a rule shape, and Done-when #2 makes a post-hoc blast-radius check mandatory: a finding count in the hundreds on `npm run check:standards` is defined as a red result, not a pass — closing the loop that produced the false premise in the first place.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified against `we:scripts/lib/memory-freshness.cjs` and `we:scripts/check-standards.mjs` (~L1688-1694): the only consumer of the three existing citation signals is `runMemoryCitationLintCheck()`, folded into `check:standards` as blocking `err()` calls, exactly as the card states "folded into the same check:standards call site" — no separate hook/subprocess caller exists to miss.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when #1 requires fixture tests in both directions before/after, mirroring the exact pattern already used for signal 1 in `we:scripts/__tests__/memory-freshness.test.mjs` (e.g. the `auditCiteResolution` describe block) — a real round-trip test at the seam, not a hand-wave.
- **population** (addressed; strategy: name the population each threshold guards) — No single rule shape is picked among the three candidates — deliberately left for build time — but Done-when #2 and #4 impose a hard empirical gate (measured 0-false-positive count, stated in the docblock) before any shape can land, which is the same calibration discipline the existing three signals already used per the docblock at ~L166-172.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when #1 requires `npx vitest run memory-freshness` to fail before the signal exists and pass after, with explicit must-NOT-flag fixtures (already-namespaced, bare-but-genuinely-backlog, code-fence/`bornAs:`) — a guard that cannot be a no-op against its own fixtures.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The Design section's corpus measurement is exactly the "measure the constraint before sizing" strategy, done before any rule is proposed rather than after.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when #2 requires the `check:standards` run to record the new signal's finding count, and Done-when #4 requires the docblock to state the measured false-positive count — the calibration result is required to surface in the output, not just be true somewhere in the author's head.

**Corrections applied by this review:**

- The card's own motivating anecdote ("Found on the land-bar leaf, where #1031, #1037 and #1022 all hit real-but-wrong items") is stale against live `we:agent-memory-src/land-on-no-regression-not-perfection.md`: commit 3c4c3a5f (2026-08-05, same day this item was opened) already rewrote those cites to `PR #1031`/`PR #1037` and removed `#1022` entirely, so none of the three currently reach the resolver as an unnamespaced PR cite — `findCites()` run against that leaf today returns only `#2771`, `#2840`, `#2439`, none of which are PR numbers; Done-when #3's "or corrected in the leaf" clause already anticipates and defuses this, so no action is needed beyond stating the outcome as required.
- The Design section's "250 leaves on this tree" and Done-when #2's "live 250-leaf corpus" overstate the actual `isLeaf`-filtered leaf count in `we:scripts/lib/memory-freshness.cjs` (`collectLeafTexts()` returns 238, from 249 total `.md` files in `we:agent-memory-src/` minus `we:MEMORY.md` and the `index-*.md` files); the existing docblock's own "240+-leaf corpus" phrasing is the more accurate figure to anchor Done-when #2's finding-count report to.

A well-verified preparation that catches and corrects its own false premise with real corpus measurement, ties its Done-when to the existing signals' precision-first calibration discipline, and only slips on one stale illustrative citation that its own Done-when already hedges against.

_Recorded through the declared `review-prep` operation._
