---
bornAs: x8918rc
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-08"
tags: [citation-verification, check-standards, provenance, review-quality]
---

# Provenance lint: a bare backticked identifier in prose must resolve against the tree, or be marked proposed

Seven false symbol/function citations across four review rounds of PR #1112 shared one generator: provenance written from memory and shipped in the past tense without a grep. `check:standards` #2821 gate 5 only resolves `we:path:line` loci, so a bare backticked identifier in prose (`collectOpenItemIds`, `validateTodoMarkerBlock`) is unreachable by any gate. Extend `we:scripts/lib/citation-check.mjs` with an identifier-resolution gate over backlog + docs prose: extract identifier-shaped backticked tokens, resolve each against the tree, and warn on the ones that do not, with an explicit escape for a deliberately-proposed name.

## The failure this closes

PR #1112 (`#3027`) bounced four times. Each round the technical substance held up under an independent
re-measurement, and each round the reviewer found at least one **citation that had never been grepped**:

| round | the cite | reality |
|---|---|---|
| 2 | `collectOpenItemIds` — named as the existing helper the suite reuses | no such symbol, at head or at the merge base |
| 3 | four further cites corrected at once (an item's ratified status, a sibling item's subject, a claimed prior shape, a claimed count) | each written from memory |
| 3 | `validateTodoMarkerBlock` — in `#3025`, the item filed to *remedy* round 2's honesty finding | the function is `validateTodoMarker`; the walk described is inline in `validateContract` |
| 4 | `35 load-time fixtures` in the same item | measured: 15 assertions (12 refusals, 3 accepts) |

The reviewer's read, which the author accepts: it is **not** fabricated cover — the substance behind each has
been sound every time. It is the habit of writing the sentence that *ought* to be true and shipping it in the
past tense. It concentrates in `leash: spec` files (#2564) and backlog bodies, where the prose **is** the
deliverable and no compiler reads it. Four rounds of per-case corrections have not converged; the seventh was
found in the file filed to fix the second.

## Why no existing gate reaches it

`we:scripts/lib/citation-check.mjs` ships the "proven subset" of the #2821 citation-verification family, and
its three gates are all **locus-shaped**: gate 5 resolves a `we:<path>:<line>`, gate 10 resolves a
platform-decisions anchor to its ruling owner, gate 3 catches an out-of-scope hash slug. A backticked
`` `validateTodoMarkerBlock` `` is none of those — no path, no line, no anchor. #2821's own gate 6 (the
symbol-anchor convention) would make `we:<path>#<symbol>` *resolve*, but only for cites already written in
locus form; it does not reach a bare identifier in a sentence, and gate 6 is explicitly outside the shipped
subset. So the highest-frequency citation form in our prose is the one nothing checks.

## Is it mechanisable? Measured, and the answer is "yes, diff-scoped; no, corpus-wide"

Both forms were prototyped against this checkout before filing, because filing an unmeasured claim about a
mechanism would be the exact defect this item exists to close.

**Corpus-wide: not viable as written.** Extracting identifier-shaped backticked tokens (camelCase or
`SCREAMING_SNAKE`) from all 2,998 files in `backlog/` + `docs/agent/` and resolving each against every
identifier in the tree yields **11,381 tokens, of which 1,074 distinct (1,814 occurrences) do not resolve**.
Spot-checking the top of that list — `createRadioGroup`, `detectAnomalies`, `mountLaneBoard`,
`produceFunctionalBytes` — shows the dominant class is **legitimate**: an unbuilt item naming the function it
proposes to write. A gate that fires 1,814 times on correct prose is a gate that gets ignored.

**Diff-scoped: viable, and it catches the real one with no noise.** Restricting the same extractor to prose
lines **added by the change under review** (`git diff <base>...HEAD -- 'backlog/*.md' 'docs/**/*.md'`), over
this PR's own diff: **19 identifier tokens, 1 unresolved — `validateTodoMarkerBlock`, and nothing else.** Zero
false positives on the run that contains the real defect. That is the shape to build.

**The honest residue — the part that stays discipline.** A resolvable name can still be cited *wrongly*: the
round-3 cite said the `appliesTo` walk lives in a separately-named block validator, and every individual
symbol in that sentence exists. Grepping proves a name is real, never that the sentence about it is true. The
same holds for counts ("35 fixtures"), for claims about what a prior item established, and for "verified:"
prefaces. So this gate closes the **name-does-not-exist** class, which is where 2 of the 7 sat, and the
remaining class stays a review-and-author discipline — carried by the agent-memory note filed alongside this
item, not by a script.

## Design

- **Home:** a new `findUnresolvedIdentifiers(text, { resolves })` in `we:scripts/lib/citation-check.mjs`,
  I/O-free like its siblings, with the symbol index injected by `we:scripts/check-standards.mjs`.
- **Scope:** added prose lines only, in `backlog/*.md`, `docs/**/*.md`, and JSDoc/comment blocks of files on
  the `leash: spec` tier (`we:scripts/lib/gate-config.mjs`) — the three places the failure has actually
  occurred. Not the whole corpus (see above). Only the first two were measured before filing (the diff-scoped
  run above is over `backlog/*.md` and `docs/**/*.md`); the `leash: spec` JSDoc surface is included by design,
  not by measurement — see Known gaps.
- **Extraction:** backticked spans matching camelCase or `SCREAMING_SNAKE`, outside fenced code blocks, with a
  trailing `()` tolerated.
- **Resolution:** a token resolves if it appears anywhere in the tree's source files. Deliberately loose — the
  gate answers "does this name exist at all?", which is the question the seven misses failed, and a tighter
  "is it defined here" check re-introduces the proposed-name false positives.
- **The escape, explicit:** a proposed name is written `` `newThing` (proposed) `` — or lives under a
  `## Done when` / `## Design` heading, which are already the conventional homes for names that do not exist
  yet. Both are cheap to detect and both make the author's intent legible to a reader too.
- **Level:** warn first (the `CITATION_GATES_ENFORCED` pattern already in that file), with the diff scope
  making a clean baseline reachable immediately rather than after a corpus triage.

## Known gaps

Found by the round-4 review of `#3027` (PR #1112), which asked that these be carried honestly rather than
silently widened past what was actually measured:

- **The `leash: spec` JSDoc surface is unmeasured.** The corpus-wide and diff-scoped numbers above (11,381
  tokens / 1,074 unresolved; 19 tokens / 1 unresolved) both come from `git diff … -- 'backlog/*.md'
  'docs/**/*.md'`. JSDoc/comment blocks of `leash: spec` files were never run through the extractor — they are
  in the Design scope on judgment (round 3's biggest false claim lived in exactly such a comment), not because
  the measurement covers them. Whoever builds this should either measure that surface too or file it as the
  untested half.
- **The escape set is under-specified for a name quoted as an example or a historical citation.** The declared
  escapes are `` `name` (proposed) `` and living under a `## Done when` / `## Design` heading. Running the
  design over this item's own body fires on three tokens that are none of the false-citation class it targets:
  `collectOpenItemIds` and `validateTodoMarkerBlock` in the failure table above (quoted *as* the historical
  defects being described) and `detectAnomalies` / `mountLaneBoard` in the "Is it mechanisable?" section
  (quoted as examples of legitimately-proposed names). "Zero false positives" held for the diff this item
  measured; it does not hold for this item's own prose. A third escape — a name quoted as an example or a
  historical citation — is needed, or the residual false-positive rate should be carried honestly rather than
  implied to be zero.

## Done when

- `findUnresolvedIdentifiers` exists in `we:scripts/lib/citation-check.mjs`, is pure, and is covered by
  fixtures in `we:scripts/__tests__/citation-check.test.mjs` — including the real regression:
  `validateTodoMarkerBlock` fires, `validateTodoMarker` does not.
- `check:standards` reports unresolved identifiers for added prose lines, naming the token and the file.
- The proposed-name escape is documented in `we:docs/agent/conventions.md` alongside the repo-locus section,
  and a fixture proves an escaped token does not fire.
- Running the gate over PR #1112's own diff reproduces the measurement above: 1 finding, and it is the right
  one.
- The gate is silent on a clean `main` (no new warnings introduced for untouched prose).

## Built 2026-08-09 — what shipped, and the two claims above that did NOT survive re-measurement

The gate is built and wired, at WARN, in `we:scripts/lib/citation-check.mjs`
(`findUnresolvedIdentifiers` (example), `buildIdentifierIndex` (example)) + `we:scripts/check-standards.mjs`
section 6f-iii, with 62 fixtures and the escape documented in `we:docs/agent/conventions.md`. The item stays
**open**: the `backlog/*.md` half of its Scope is measurably not shippable, and that is a real result, not a
deferral.

**Re-derived corpus-wide (reproduces).** 11,779 identifier tokens over the 3,040 md files in `backlog/` +
`docs/`, **1,068 distinct unresolved (1,808 occurrences)** — against this card's 11,381 / 1,074 / 1,814. The
corpus grew from 2,998 to 3,040 files in between. Corpus-wide remains non-viable, as filed.

**Diff-scoped "zero false positives" does NOT reproduce at the filed scope.** This card measured ONE
hand-picked diff (19 tokens, 1 unresolved). Over the **40 most recent merges into `main`**:

| scope | findings | merges non-clean |
|---|---|---|
| `backlog/` + `docs/` + `leash: spec` (as filed) | **503** | 22 / 40 |
| the same, plus a "token is in the item's own filename" escape | 339 | 20 / 40 |
| `docs/` + `leash: spec` (**shipped**) | **0** | 0 / 40 |

The 503 are overwhelmingly correct prose — `clearerId` (example) ×108 and `authorId` (example) ×99 are
parameters an open item accurately describes as not yet existing. The dividing line is what a surface is
FOR: `backlog/` is a **proposal register**, so an unresolved name there is the norm; `we:docs/agent/` and the
`leash: spec` contracts are **assertion surfaces**. The shipped zero is not vacuous — a positive control
(same 40 merges, resolver forced false) shows **271 tokens actually went through resolution across 12 of the
40 merges** and none was flagged. *Re-measured after the self-disarm fix below, with the method stated so it
is checkable — index rebuilt at each merge, added lines from `git diff --unified=0 M^1 M`: the 40 most recent
`--merges` put **174** tokens through resolution across **10** merges. The shipped scope still reports
**0** — on those 40, on the 40 most recent first-parent merges, and on 120 merges. The 271/12 figure above
is not reproducible from any window this session tried; treat 174/10 as the measured one.*

**Three defects in this card's design, each found by observation:**

1. **The extractor as specified misses the most important real cite.** "A trailing `()` tolerated" does not
   match the statute's `` `enforceFlipReady({ ciStatus, reviewShadowLedger })` `` (example) — a call written
   with its arguments, which is the *strongest* existence claim. Now matched with or without arguments.
2. **A single-backtick regex reads `we:docs/agent/conventions.md` as empty.** That file uses the doubled
   `` `x` `` form throughout. First wiring reported CLEAN on a page seeded with two bad names. Both forms
   are now extracted.
3. **A naive index lets a false cite resolve against itself.** Replaying PR #1112 round 1,
   `collectOpenItemIds` (example) did not fire: the index included the very JSDoc block that invented it.
   Comments are now stripped, test files excluded, and a comment resolves against the tree plus *its own
   file's code* (excluding test files outright over-corrected — 6 legitimate test-local helpers went red).

**A fourth defect, found in review of the build itself — the gate DISARMED ITSELF.** The region-escape regex
was tested against the raw line, so any sentence merely *containing* the words `provenance-lint: off` opened
a region whose "reason" was the rest of the sentence. The paragraph added to `we:docs/agent/conventions.md`
by this very change documents the escape and therefore matched — switching the gate off for the whole
remainder of that page, and for every section anyone appends to it later. Reproduced by seeding a fake
identifier before and after the section: the first fired, the second was silent. The marker is now read only
from a line's **comment payload** — an HTML comment in markdown, a `//` or `/* … */` comment in a spec source
— with inline code spans masked first, so a marker that is quoted, fenced, or written in running prose is
inert while a real one still works. Fixture: a test that seeds that probe into the **real** shipped
`we:docs/agent/conventions.md` and asserts both tokens fire. Same round: a reasoned `off` left open at end of
file is now reported (it still suppresses to EOF, but no longer silently), and the index's test-file
exclusion — the gate's most mutation-fragile line, previously covered only end-to-end — moved into
`isIndexableSourcePath` with its own units.

**Both "Known gaps" above are now resolved.** The `leash: spec` JSDoc surface is measured, not asserted — it
is where historical miss 3 is caught. The missing third escape exists: the marker vocabulary is exactly
`(proposed)`, `(does not exist)`, `(example)`, plus a reason-requiring `provenance-lint: off`/`on` region for
blocks of such names.

**Historical replay — the proof it works on real defects, not just fixtures:**

| miss | diff | shipped scope |
|---|---|---|
| `collectOpenItemIds` (example) in a conformance suite's JSDoc | `2423f255` (PR #1112 round 1) | **CAUGHT** (1 finding) |
| `enforceFlipReady` (example) call-form in the statute | `dd9f7db2` (#2838/#2839/#2840 ratification) | **CAUGHT** |
| `validateTodoMarkerBlock` (example) | `ccec4a17` (PR #1112 round 3) | caught by the detector, but the file is `backlog/` — **out of shipped scope** |

**Done-when status:** 1 met · 2 met · 3 met · 4 **not met as written** (PR #1112's *merge* is the corrected
state, so it yields 0; the round-1 commit that carried the defect yields exactly 1, the right one) ·
5 met (`check:standards` exit 0, **1279** warnings before and after — re-measured directly at the rebase base
`ea66a482` and at the branch tip, both 1279; this card previously said 1278, which was wrong).

**What is still owed (why this stays open):** a proposal-vs-assertion discriminator for `backlog/*.md`. The
filename-based escape was measured and only takes 503 → 339; it is not enough. Until something better
exists, backlog prose stays author-and-review discipline.

## Provenance

Filed out of round 4 of the independent review of PR #1112 (`#3027`), which asked for a durable fix rather
than a fifth round of per-case corrections. Sibling of `#2821` under the same epic; extends the same
"a reference asserted without resolving it against the source it points at" root class to the one citation
form the shipped subset does not reach. The judgment half of the same finding is recorded in agent memory as
`grep-every-name-you-cite-in-prose`.
