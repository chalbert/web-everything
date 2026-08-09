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

## Provenance

Filed out of round 4 of the independent review of PR #1112 (`#3027`), which asked for a durable fix rather
than a fifth round of per-case corrections. Sibling of `#2821` under the same epic; extends the same
"a reference asserted without resolving it against the source it points at" root class to the one citation
form the shipped subset does not reach. The judgment half of the same finding is recorded in agent memory as
`grep-every-name-you-cite-in-prose`.
