---
bornAs: x8918rc
kind: story
size: 8
parent: "2527"
status: open
dateOpened: "2026-08-08"
tags: [citation-verification, check-standards, provenance, review-quality]
scope:
  - we:scripts/lib/citation-check.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/citation-check.test.mjs
  - we:docs/agent/conventions.md
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

**Method, because the first row's verdict depends on it:** each replay builds the resolution index at the
commit's PARENT (period-correct), takes added lines from `git diff --unified=0 M^ M`, and reads file content
at `M`. Row 1's **CAUGHT** holds *only* under a period-correct index — `collectOpenItemIds` (example) was
genuinely implemented later, in `we:scripts/lib/validate-rules-anchors.cjs` (added by `057a98cb`, #2844), so
an index built from today's tree resolves it and the same replay yields **0 findings**. Row 2 does not depend
on the vintage: `enforceFlipReady` (example) fires under both. So row 1 is evidence the detector catches the
real defect *as it was shipped*, not a claim that today's gate would catch it today.

**Done-when status:** 1 met · 2 met · 3 met · 4 **not met as written** (PR #1112's *merge* is the corrected
state, so it yields 0; the round-1 commit that carried the defect yields exactly 1, the right one) ·
5 met (`check:standards` exit 0, **1279** warnings before and after — re-measured directly at the rebase base
`ea66a482` and at the branch tip, both 1279; this card previously said 1278, which was wrong).

**What is still owed (why this stays open):** a proposal-vs-assertion discriminator for `backlog/*.md`. The
filename-based escape was measured and only takes 503 → 339; it is not enough. Until something better
exists, backlog prose stays author-and-review discipline.

*(Sanity re-check while re-scoping this card, 2026-08-13: `npm run check:standards` on this checkout is
**0 errors, 1314 warnings** on this branch — up from the 1279 cited above; that is corpus drift over the intervening
period, not a provenance-gate regression, and the gate still ships at WARN.)*

## Readiness for the remaining scope — sizing, the open design fork, interface, tasks (added 2026-08-13)

The item was filed at `size: 3`. That covered only the `docs/agent/**` + `leash: spec` half, and even that
half turned out to need four defect-fix rounds plus a self-disarm fix before it shipped (see "Built" above) —
already well past a 3. What is **left** to close the item is the `backlog/*.md` half: a proposal-vs-assertion
discriminator that gets the diff-scoped noise on `backlog/` down from the measured 503 findings / 22 of 40
non-clean merges to something a real gate can ship at. Re-sized at **8** (Fibonacci; `FIB` is
`we:scripts/check-standards-rules.mjs:85` → `{1,2,3,5,8,13}`, and `>8` must split per this shaping pass's
brief). 8, not smaller, because the work is design-plus-measure-plus-implement in one bounded slice, and the
measure step's outcome is genuinely unknown until it is run; 8, not 13/split, because it is confined to the
same one gate, the same four files already in `scope:` above, and the measurement METHOD is already fully
specified in prose (below) — a builder is not starting from zero the way the original filing was.

### The open design decision: which discriminator (do NOT pick silently — this is a real, unresolved fork)

The three built escapes (fenced code, `## Done when` / `## Design` heading zones, the `(proposed)` /
`(does not exist)` / `(example)` markers — `we:scripts/lib/citation-check.mjs:279,288`) already apply to
`backlog/*.md` in the 503/339 measurement above; they are not enough on their own, because most of the noise
is plain proposal prose outside those zones (`clearerId` ×108, `authorId` ×99, `buildPassRecord` ×72, per
`we:scripts/lib/citation-check.mjs:450-451` — all cited from **open** items describing work not yet done).
Two real candidates, neither prototyped or measured yet:

- **A. Status-gated file scope (recommended default to try first).** Only lint added prose lines in a
  `backlog/*.md` file whose *own* frontmatter `status:` is `resolved` — a resolved item describes what
  shipped (an assertion surface); an open/active/parked item is still a proposal register by definition. On
  this checkout today (`grep -c '^status:' backlog/*.md`, re-run 2026-08-13): **2561 resolved, 462 open, 33
  parked, 13 active**. Cheap to implement (one frontmatter-status lookup keyed by the file's leading `NNN-`
  number against the already-loaded `backlog` array — see Interface below) and it directly targets the
  measured false-positive source. Known failure mode: a *resolved* item can still carry a legitimate forward
  section (this very card's own "Built" update, still `status: open`, mixes a real "what shipped" account
  with plainly-proposed names elsewhere in the same file) — status is a file-level signal, not a
  paragraph-level one, so it will both under- and over-fire at the margins. Untested how large that margin is.
- **B. Section-level discriminator.** Extend the existing heading-zone mechanism
  (`we:scripts/lib/citation-check.mjs:527-535`) with an *inverse* zone: only lint prose under headings that
  read as retrospective/assertive (`## Built`, `## Resolved`, `## Shipped`, or similar), leaving everything
  else in a `backlog/*.md` file unlinted by default. More precise than A in principle (paragraph-level, not
  file-level) but the heading vocabulary would need to be measured against real cards — not just guessed —
  and no such measurement exists yet.
- **Rejected without measuring:** dropping `backlog/` entirely and closing the item on the docs+leash:spec
  half alone. That is a legitimate outcome (see "Delivery shape" below) but it is a fallback, not the design —
  the card's own "What is still owed" line frames the backlog half as unfinished, not abandoned.

**This fork is not resolved by this readiness pass.** A builder picks up option A first (cheapest, best
grounded in the measured false-positive sources), measures it per the Done-when below, and only reaches for B
or the reject-and-close fallback if A's measured noise is still too high.

### Interface / protocol (matching the shape already in the file — do not invent a new one)

- A new pure predicate in `we:scripts/lib/citation-check.mjs`, same I/O-free contract as its neighbours
  (`findUnresolvedIdentifiers`, `isIndexableSourcePath`):

  ```js
  /**
   * Does this backlog file's frontmatter mark it as an ASSERTION surface (describes what shipped) rather
   * than a PROPOSAL register (describes intended work)? Option A's discriminator (#3026 remaining scope).
   * @param frontmatter { status?: string } — parsed backlog frontmatter, injected by the caller.
   * @returns boolean
   */
  export function isAssertionSurfaceBacklogItem({ status } = {}) { return status === 'resolved'; }
  ```

- Wiring in `we:scripts/check-standards.mjs`'s `inScope` predicate (currently
  `we:scripts/check-standards.mjs:1158-1159`, `PROVENANCE_DOC_DIRS = ['docs/']` at line 1154): add a third
  disjunct gated on `isAssertionSurfaceBacklogItem`, e.g. `(p.startsWith('backlog/') && p.endsWith('.md') &&
  isAssertionSurfaceBacklogItem(statusOf(p)))`, where `statusOf(p)` extracts the leading `NNN` from the
  filename and looks it up in the `backlog` array already loaded at
  `we:scripts/check-standards.mjs:150-151` (`we:src/_data/backlog.js`) — no change to that loader is needed,
  it already carries `.status`; the loader returns a plain ARRAY, not a map — the `byNum` at
  `we:src/_data/backlog.js:135` is local to `deriveProjectReadiness` and is not exported (verified:
  `Array.isArray(b) === true`, `'byNum' in b === false`). A caller that wants lookup-by-number builds it. Only a
  filename→item lookup is new, reusing the leading-number extraction already at
  `we:src/_data/backlog.js:297` (`ID_TOKEN`), not inventing a new regex.
- Findings shape, escape markers, WARN level, and the `provenance-lint: off`/`on` region mechanism are
  **unchanged** — this only widens *which files* the existing `findUnresolvedIdentifiers` runs its added-lines
  loop over, per `we:scripts/check-standards.mjs:1225-1236`.
- **WARN vs error is already decided, not a new fork:** the three reasons at
  `we:scripts/check-standards.mjs:1145-1152` (matches the sibling gates' posture, the escape vocabulary is
  young, an unresolved token is a smell not a proof) apply identically to the widened `backlog/` scope — stays
  WARN.

### Done when (the remaining scope — testable)

- `isAssertionSurfaceBacklogItem` (or the chosen alternative from the fork above) exists in
  `we:scripts/lib/citation-check.mjs`, is pure, and is covered by fixtures in
  `we:scripts/__tests__/citation-check.test.mjs`, including: a `status: open` item's proposed-but-unbuilt
  name does NOT fire; a `status: resolved` item's genuine unresolved cite DOES fire; the three historical
  regressions (`collectOpenItemIds`, `enforceFlipReady`, `validateTodoMarkerBlock`, all "(example)" above)
  still fire under the new scope exactly as they do today under the shipped scope.
- `we:scripts/check-standards.mjs`'s provenance-gate `inScope` includes `backlog/*.md` gated on the
  discriminator, reusing the existing added-lines / index-building / WARN machinery unchanged.
- The discriminator is re-measured with the **same method already on this card** ("Method, because the first
  row's verdict depends on it", above: index built at each merge commit's parent, added lines from
  `git diff --unified=0 M^1 M`) over the 40 most recent merges into `main`. No harness for this is checked in
  — a builder re-derives the loop from that prose, the same way this card's own measurements were produced.
  The resulting (findings, non-clean-merge count) is written onto this card, honestly, whatever it is.
- **Threshold, stated up front so it isn't picked after seeing the number:** ship (flip `backlog/` into
  scope) only if the re-measured non-clean-merge rate is materially below the filed-scope baseline (22 of 40)
  — a good target is single-digit merges out of 40, matching the noise level the shipped docs+leash:spec half
  already achieved (0 of 40). If option A's measurement doesn't clear that bar, do **not** ship it silently
  quieter-but-still-noisy; try option B, or close this item's backlog half as a documented won't-fix (fall
  back to "backlog prose stays author-and-review discipline", already true today) and say which, with the
  number, on this card.
- `we:docs/agent/conventions.md`'s existing provenance-escape section (~line 108-138) gets one added
  paragraph naming which parts of a `backlog/*.md` card are checked once this ships, so an author isn't
  surprised by a warn on a card they thought was exempt.
- `npm run check:standards` stays 0 errors throughout (WARN posture unchanged).

### Tasks (ordered)

1. Implement option A's discriminator (`isAssertionSurfaceBacklogItem`) + unit fixtures.
2. Re-derive the 40-merge measurement loop (prose method above) and run it with `backlog/` added to scope,
   gated by the new discriminator. Record findings + non-clean-merge count on this card.
3. Decision point: if the threshold above clears, wire `inScope` in `we:scripts/check-standards.mjs` to
   include `backlog/*.md` (gated), add the historical-regression + open/resolved fixtures, update
   `we:docs/agent/conventions.md`, and re-confirm `check:standards` is 0 errors. If it does not clear, try option
   B (measure the same way before wiring anything) or close the backlog half as won't-fix — either way, write
   the measured number and the decision on this card before resolving the item.
4. Either way, resolve the item's remaining `## Done when` items above against whichever branch of step 3 was
   taken.

### Delivery shape

Lands as **one piece**, not incrementally — the discriminator function, its wiring into `inScope`, and its
fixtures are one small, mutually-dependent change (a discriminator with no wiring does nothing; wiring with no
fixtures is unverified). It ships at **WARN** (already decided, see Interface above), so unlike an
error-level rule it does **not** need a staged rollout or an allowlist to land safely — a false-fire warns,
it does not red the gate. That is also why the measure-then-decide sequencing in Tasks is safe to do inside
one PR rather than needing a separate "measure" slice merged first: a WARN-level change that turns out too
noisy is a revert, not an incident.

## Provenance

Filed out of round 4 of the independent review of PR #1112 (`#3027`), which asked for a durable fix rather
than a fifth round of per-case corrections. Sibling of `#2821` under the same epic; extends the same
"a reference asserted without resolving it against the source it points at" root class to the one citation
form the shipped subset does not reach. The judgment half of the same finding is recorded in agent memory as
`grep-every-name-you-cite-in-prose`.
