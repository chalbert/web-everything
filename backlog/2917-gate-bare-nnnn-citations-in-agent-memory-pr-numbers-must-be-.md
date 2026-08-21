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
   live 250-leaf corpus. A count in the hundreds means the rule was built to the item's stated premise rather
   than its real defect — treat that as a red result, not a pass. (Tier 1.)
3. The three cites the item names — `#1031`, `#1037`, `#1022` on the land-bar leaf — are each either flagged
   by the new signal or corrected in the leaf, and which of the two happened is stated on the item. One
   `grep` of that leaf shows the current text. (Tier 2.)
4. The signal's own docblock states its measured false-positive count on the live corpus, in the same form
   the existing three signals do at `we:scripts/lib/memory-freshness.cjs` ~L166–172. (Tier 3 — read that
   docblock.)
