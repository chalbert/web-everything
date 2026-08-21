---
bornAs: xkpyfxj
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate]
---

# Gate finding-CONTRACT parity: neither a new `Finding` field nor a new enum member can land without its producers

Adding a field to the canonical `Finding` shape takes three coordinated edits in three directories with **no
import edge between them**, and the omission is silent. `we:scripts/lib/jury-core.mjs` owns which keys
`normalizeFinding` accepts; `buildSubjectMandate` owns which keys are demanded in prose; and every producer
re-types its own `Return { … }` key list by hand — `we:scripts/workflows/review-parked-prs.mjs` (the drain panel
lens) and `we:skills-src/jury/subject-jury.workflow.js` (the juror + the red-team). Both producers are
Workflow-harness bodies that **cannot `import`**, so nothing links them to the contract they produce, and every
return schema is `additionalProperties: true`, so a missing field raises no error anywhere.

Observed on PR #1046 (`#2942`): `impactIfUnfixed` was added to the `Finding` shape and demanded by the shared
mandate, but no producer prompt or schema asked for it. A juror got the mandate saying impact was required and a
later, more concrete key list that omitted it. An omitted impact fails closed, so the verdict was byte-identical
to pre-change — the whole mechanism shipped **inert**, with a green suite. #2823 hit the same seam and fixed it by
hand-editing the same three lines; the note at `we:scripts/lib/review-core.mjs` even writes the convention down
and names these exact files. A convention two changes have now missed is a gate, not a note.

## The parity owed is CONTRACT parity, not just FIELD parity

The fix for blocker 1 added the field to all three producers — and in doing so hand-copied the field's ENUM
into two of them as a bare array literal:

```js
const IMPACT_LEVEL_VALUES = ['cosmetic', 'degraded', 'broken', 'unrecoverable'];
```

in `we:scripts/workflows/review-parked-prs.mjs` and `we:skills-src/jury/subject-jury.workflow.js`, each feeding a
JSON-schema `enum:`. These twins are **undiscoverable**. The repo's enum-totality gate
(`we:scripts/lib/verdict-totality.mjs`) finds consumers two ways — a symbolic `IMPACT_LEVELS.MEMBER` reference,
or the enum's values in object-KEY position — and an array ELEMENT is neither. So a fifth impact level would land
with two stale producer schemas and a green gate, which is blocker 1 one level down: the level exists in the
contract, no producer offers it, and the model's schema rejects it if a reviewer tries.

So the rule must gate the whole CONTRACT a producer restates, not only the field names:

1. **Single-source the key list.** Export the accepted finding-field list once from `we:scripts/lib/jury-core.mjs`
   — the same constant `normalizeFinding` reads — and render the `Return { … }` line from it, so producers stop
   hand-typing it. The harness sandbox blocks `import`, so this needs a build/inline step or a generated literal,
   not a runtime import.
2. **Gate the coverage, discovery-based.** A `check:standards` rule in the style of
   `we:scripts/lib/verdict-totality.mjs`: mark each finding-producing file `@finding-producer` so coverage is
   DISCOVERED rather than hand-listed, then error when any marked producer omits an accepted field.
   The discovery half is the point — a hand list of the three producers we remember today is the same failure
   this rule exists to stop.
3. **Error on a mirrored enum literal that is not SET-EQUAL to the real exported enum.** In a file marked
   `@finding-producer`, any array/`enum:` literal of string values that overlaps a `Finding`-field enum must be
   set-equal to that enum's values. Not a subset, not a superset, not a re-ordering that hides a rename — the
   same set. This is what makes a hand-copied mirror safe to keep: it may exist (the harness cannot `import`),
   but it can no longer silently disagree.

## Design

**The gate to copy is `we:scripts/lib/verdict-totality.mjs`, and its shape maps onto this problem almost
one-to-one.** That module's own header records exactly the meta-finding this item repeats: the first cut of
its fix *enumerated the tables it remembered* and missed two nobody listed, which is why it discovers coverage
from source instead of carrying a list. Its enrolment API is already parameterised — enum object, symbol name,
marker pair, bare-key reach (`IMPACT_ENROLMENT` is the second tenant, added for one call site). Read
`checkVerdictTotality`'s enrolment options before writing a third mechanism; some of clause 3 may be an
enrolment rather than a new gate.

**Wiring point.** The fs walk already exists and already reaches every file this item cares about:
`we:scripts/check-standards.mjs:1930-1962`, block 14 — it walks `scripts/` and `skills-src/`, skips
`__tests__` and `node_modules`, keeps `.mjs`/`.js`, and hands `{file, content}[]` to the pure rule twice (once
per tenant). A third call goes beside those two. **Do not add a second walk.** The pure rule goes in
`we:scripts/lib/` beside `we:scripts/lib/verdict-totality.mjs`; the fs stays in the caller, per the note at
`:1929`.

**Clause 1 — the exported key list.** `normalizeFinding` (`we:scripts/lib/jury-core.mjs:356-418`) currently
encodes the accepted keys as a run of hand-written `if (raw.x …)` statements plus one
`for (const k of ['introduced', 'worseThanBase', 'parallelizable'])` loop. There is **no** exported field
list today — grep `we:scripts/lib/jury-core.mjs` for `FINDING_FIELDS` and you get nothing. So clause 1 has
two halves that must not be split: export the list, **and** make `normalizeFinding` read it, or the export
becomes a fourth hand-maintained copy of the same contract. The `@typedef {Object} Finding` block at
`:42-55` is the human-readable twin of the same list and should be treated as a third reader, not a comment.

**`disposition` is NOT a pass-through and will need special-casing.** The tail of the function
(`we:scripts/lib/jury-core.mjs:390-417`, the #2950 direction-test loop plus the disposition derivation) does
not simply copy a validated key across: the routing decides, and a self-declared word may only ever make a
finding *more* blocking. So "make `normalizeFinding` read the exported list" applies to the acceptance pass,
not to that derivation — a mechanical rewrite that folds `disposition` into a generic loop would drop that
one-way ratchet.

**Clause 3's target is precise and both instances are live on `main`:**
`we:scripts/workflows/review-parked-prs.mjs:407` and `we:skills-src/jury/subject-jury.workflow.js:302` each
declare `const IMPACT_LEVEL_VALUES = ['cosmetic', 'degraded', 'broken', 'unrecoverable'];` and feed it to a
JSON-schema `enum:` (`:429` and `:308` respectively) and to a prose line (`:706` / `:723`). The real enum is
`IMPACT_LEVELS` (`we:scripts/lib/jury-core.mjs:190`). The existing gate cannot see these: as the enrolment
note at `we:scripts/check-standards.mjs:1953-1961` states, discovery works on a symbolic `ENUM.MEMBER`
reference or on values in **object-KEY** position, and an array **element** is neither. That is the exact
blind spot clause 3 names — confirm it holds before designing around it.

**Why a runtime import cannot always be the answer — but check whether it can HERE first.** The blanket claim
that "the mirror must be allowed to exist" is too strong, and the code says so a few lines above the literal
this item cites. `we:skills-src/jury/subject-jury.workflow.js:298-301` records that **#3057 already eliminated
this mirror for the juror surface**: that prompt + schema moved into `we:skills-src/jury/panel-fanout.mjs`,
an ordinary module shelled via `agent()` that **imports `IMPACT_LEVELS` outright**, and
`we:skills-src/jury/__tests__/panel-fanout.test.mjs` pins the remaining copy against the real enum. Only the
**red-team** surface still reads the literal.

So the honest ordering is: for each mirror, first ask whether the #3057 move-it-to-an-importing-module pattern
retires it. Where it does, retire it — a gate over a mirror that did not need to exist is the more expensive
answer. Where it cannot (a surface genuinely built inside the sandbox), the mirror stays and clause 3 checks
it. Do not build the gate for sites the cheaper fix would have removed, and do not skip the gate on the
strength of one site being fixable.

**A THIRD producer the original locus missed — and it is the card's own named failure class.**
`we:scripts/operations/review-pr.mjs:159-192` exports `REVIEW_JUDGE_SHAPE`, an `additionalProperties: false`
schema with a hand-typed `properties` key list (`summary`, `file`, `line`, `category`, `failure_scenario`,
`verdict`, `impactIfUnfixed`, `disposition`, `introduced`, `worseThanBase`, `parallelizable`, `rootCause`,
`prevention`, `preventionCaptured`) whose output flows straight into `normalizeFindings`
(`we:scripts/operations/review-pr.mjs:461`). Two things about it matter:

- Its **enums are already imported** (`IMPACT_LEVELS`, `DISPOSITIONS` — `:72,81,178`), so clause 3 has nothing
  to catch here. Its **key list is not**, so clause 2 does.
- Nothing references `REVIEW_JUDGE_SHAPE` in any test — grep `we:scripts/operations/__tests__/` and you get
  nothing — so a field silently dropped from it today reddens no named test.

Because it is an ordinary ES module, it is the **cheapest** of the three to fix outright via clause 1's
exported list. It was invisible to the original locus because that locus was built from the two files
`we:scripts/lib/review-core.mjs`'s convention note names, rather than from an independent repo-wide sweep for
schemas mirroring the `Finding` shape — which is precisely the "a hand list of the producers we remember
today" failure this item exists to stop, applied one level up to its own preparation.

**Clause 2's discovery heuristic MUST be narrowed, and the measurement is part of the deliverable.**
`IMPACT_ENROLMENT` sets `genericKeysNeedSymbol` for exactly this reason: `IMPACT_LEVELS`' members are ordinary
English words, so bare-key discovery over them false-fires. `Finding`'s field names are worse — `summary:`
and `file:` as object-literal keys appear together in roughly 15 files under `scripts/` and `skills-src/`
(excluding `__tests__`), most with nothing to do with the jury contract: `we:scripts/autofix/engine.mjs`,
`we:scripts/autofix/modelFixer.mjs`, `we:scripts/backlog/renumber-collisions.mjs`,
`we:scripts/conformance-autofix.mjs`, `we:scripts/conveyor/close-session-sweep.mjs`,
`we:scripts/conveyor/learnings-drop.mjs`, `we:scripts/gen-dogfooding-progress.mjs`,
`we:scripts/lib/nnn-collision-heal.mjs`, `we:scripts/readiness/proposer.mjs`,
`we:scripts/operations/review-prep.mjs`, alongside the genuine producers. A clause-2 rule built by analogy to
`VERDICTS`' *unrestricted* pass would redden `check:standards` across all of them. Build it by analogy to the
**narrowed** `IMPACT_LEVELS` enrolment instead, and run the corpus count as part of the work.

**Scope guard.** This item gates the contract; it does not add a field to it. A build that also changes what
`Finding` accepts has widened past the digest.

## Done when

1. **Executable — the parity gate exists and catches the real defect.** Run, from the WE checkout root:

   ```
   npx vitest run scripts/lib/__tests__/
   ```

   It passes with a new suite for the pure rule, driven by synthetic `{file, content}[]` fixtures (the same
   style `we:scripts/lib/__tests__/verdict-totality.test.mjs` uses), asserting: a `@finding-producer`-marked
   fixture omitting an accepted field errors; one carrying every field passes; and an **unmarked** file that
   nonetheless restates the finding key list is itself flagged, so coverage is discovered rather than listed.
2. **Executable — the mirrored-enum clause catches a set difference in every direction.** The same suite
   asserts a marked fixture whose array literal is a strict **subset**, a strict **superset**, and a
   **renamed member** of the real enum each error, and that a re-ordering of the identical set does **not**.
   Set-equality, not sequence-equality.
3. **Executable — the field list is single-sourced, not merely exported.** A test asserts that
   `normalizeFinding` accepts exactly the keys the new exported list names — feed it an object carrying every
   listed key plus one unlisted key and assert the output's key set equals the list. This is what stops the
   export becoming a fourth hand-maintained copy.
4. **Observable — the gate runs in the everyday gate, on the existing walk.** `npm run check:standards` is
   green on the current tree, and `we:scripts/check-standards.mjs` block 14 gained one call using the
   already-built `docs` array — no second `walkSource`, no second `readdirSync` for this rule.
5. **Observable — ALL THREE real producers are enrolled and clean, discovered not listed.**
   `we:scripts/workflows/review-parked-prs.mjs`, `we:skills-src/jury/subject-jury.workflow.js` **and**
   `we:scripts/operations/review-pr.mjs` (`REVIEW_JUDGE_SHAPE`, `:159-192`) all carry the
   `@finding-producer` marker and pass. A deliberate temporary edit removing one impact level from either
   array literal — or removing one accepted field key from `REVIEW_JUDGE_SHAPE`'s `properties` — turns
   `npm run check:standards` red. Revert the edits before landing. Enrolling the third file is the criterion
   that proves the mechanism is discovery-based rather than a two-file hand list.
6. **Observable — the new heuristic does not over-fire on the real corpus.** `npm run check:standards` on the
   unmodified tree produces **zero** new errors. Concretely: none of the ~15 files that merely use `summary:`
   and `file:` as object keys (listed in *Design*) is flagged. Record the measured count in the rule's
   docblock, the way `IMPACT_ENROLMENT` documents its own narrowing and its blind spot.

**Prevention for:** PR #1046 review, blocker 1 and round-2 finding 2 (`#2942`).

**Locus:** `we:scripts/lib/jury-core.mjs`, `we:scripts/check-standards.mjs`,
`we:scripts/workflows/review-parked-prs.mjs`, `we:skills-src/jury/subject-jury.workflow.js`

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion ahead of the build) — The card's "Why a runtime import cannot be the answer" section asserts the mirror "must be allowed to exist and be checked, not eliminated" for both producers — but we:skills-src/jury/subject-jury.workflow.js's own comment at lines 294-301, immediately above the literal the card cites at line 302, records that #3057 already ELIMINATED this mirror for the juror surface by moving the schema into we:skills-src/jury/panel-fanout.mjs, an ordinary module shelled via agent() that imports IMPACT_LEVELS directly — only the red-team surface still hand-copies it. The card doesn't address why that same proven pattern can't retire the remaining copy there (or the we:scripts/workflows/review-parked-prs.mjs copy), which would make part of clauses 1-3 moot for those sites. Disposition: not introduced by this preparation (pre-existing repo fact the card overlooked), not worse-than-base (the gate is still a net improvement even if a cheaper fix exists elsewhere), and parallelizable (evaluating the elimination alternative doesn't have to block writing the gate) — carve-out, not a blocker. impactIfUnfixed: degraded — a builder may spend the gate-build effort on mirrors that could have been retired outright, but nothing breaks; rootCause: the preparer reasoned from the sandbox constraint at the file's top-of-file header without reading the closer, more specific comment a few lines above the exact code it cites; prevention: a review-lens note (not a deterministic gate — this is a design-completeness judgment call), filed as a carve-out on the card itself; preventionCaptured: false.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/operations/review-pr.mjs's REVIEW_JUDGE_SHAPE (lines 145-176) is a THIRD real Finding-producer with a hand-typed properties key list (summary, file, line, category, failure_scenario, verdict, impactIfUnfixed, disposition, introduced, worseThanBase, parallelizable, rootCause, prevention, preventionCaptured under additionalProperties:false) whose output flows straight into normalizeFindings (confirmed at line 447: `const findings = normalizeFindings(answer.findings)`) — yet it appears nowhere in the card's problem statement, locus, Design section, or Done-when acceptance criteria (Done-when #5 names only we:scripts/workflows/review-parked-prs.mjs and we:skills-src/jury/subject-jury.workflow.js as 'the real producers'). Unlike the two named producers this file is an ordinary ES module that already imports IMPACT_LEVELS/DISPOSITIONS for its enums, so it's the cheapest of the three to fix outright via clause 1's exported list — yet it's invisible to the card. No test in we:scripts/operations/__tests__/review-pr.test.mjs (or anywhere else, grep-verified) references REVIEW_JUDGE_SHAPE at all, so a field silently dropped from it today reddens NO named test. This is exactly the 'enumerated the producers we remembered' failure the card's own text warns against (it says 'a hand list of the three producers we remember today is the same failure this rule exists to stop'), applied one level up to the card's own preparation. Disposition: not introduced by this card (the gap in we:scripts/operations/review-pr.mjs predates it), not worse-than-base (building the two-producer-scoped gate is still strictly better than no gate), parallelizable (widening enrolment to include this file is a small independent addition) — carve-out. impactIfUnfixed: broken — a future Finding field could land silently un-requested on this one review surface, recoverable only if someone notices; rootCause: the locus was built from the two files named in we:scripts/lib/review-core.mjs's own convention note and PR #1046/#2823's history rather than an independent repo-wide grep for every schema that mirrors the Finding shape; prevention: the deterministic fix already IS this card's own clause-2 discovery mechanism — the gap is that Done-when #5's acceptance test scopes 'the real producers' to two files instead of asserting the discovery mechanism actually reaches and requires this third file too; preventionCaptured: false, should be filed (or Done-when #5 amended) before this card is treated as fully scoped.
- **blast-radius** (NOT addressed; strategy: measure against the real corpus before wiring) — Clause 2's 'error when any marked producer omits an accepted field' + Done-when #1's 'an unmarked file that nonetheless restates the finding key list is itself flagged' is a NEW discovery heuristic, and the card never measures its false-positive footprint against the real corpus the way the taxonomy's strategy requires. A quick grep for files under scripts/ and skills-src/ (excluding __tests__) with BOTH `summary:` and `file:` as object-literal keys — two of the plainest Finding field names — turns up 15 files, most unrelated to the jury contract: we:scripts/autofix/engine.mjs, we:scripts/autofix/modelFixer.mjs, we:scripts/backlog/renumber-collisions.mjs, we:scripts/conformance-autofix.mjs, we:scripts/conveyor/close-session-sweep.mjs, we:scripts/conveyor/learnings-drop.mjs, we:scripts/gen-dogfooding-progress.mjs, we:scripts/lib/nnn-collision-heal.mjs, we:scripts/readiness/proposer.mjs, we:scripts/operations/review-prep.mjs, alongside the genuine producers. The card DOES cite the directly relevant lesson (we:scripts/lib/verdict-totality.mjs's IMPACT_ENROLMENT, whose `genericKeysNeedSymbol` narrowing exists precisely to stop generic English words from false-triggering) and tells the builder to read it before writing a third mechanism — but it never runs or reports the equivalent measurement for clause 2's own new heuristic, despite the taxonomy's strategy being exactly 'measure against the real corpus before wiring.' Disposition: this is a property of the NEW gate this card specifies, so if built naively per the letter of clause 2/Done-when #1 it would be introduced by this change; whether it ends up worse-than-base depends on implementation choices the card leaves open (a builder who follows the IMPACT_ENROLMENT pointer would likely narrow correctly) — so worseThanBase is not established either way; and the measurement is squarely this card's own deliverable, not parallelizable. Given worseThanBase is not established, this routes as a carve-out (the risk should be closed by the builder doing the measurement clause 2 needs, not by blocking preparation acceptance on it). impactIfUnfixed: degraded if built narrowly (nothing breaks), broken if built naively (check:standards reddens across ~15 unrelated files, real CI friction someone has to notice and fix); rootCause: the card designed clause 2 by analogy to VERDICTS' unrestricted key-discovery pass rather than IMPACT_LEVELS' narrowed one, without running the corpus check that would show plain Finding field names need the narrower treatment; prevention: the corpus measurement itself, run once at implementation time and pinned as a characterization test (the same treatment IMPACT_ENROLMENT's own doc gives its blind spot) — a deterministic check, not a review lens; preventionCaptured: false, should be filed as part of implementing clause 2.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when #5 explicitly requires a live mutation probe on the real files — 'a deliberate temporary edit removing one impact level from either file's array literal turns npm run check:standards red. Revert the edit before landing' — which is exactly the taxonomy's 'mutate the guarded line; require a NAMED test to redden' strategy, applied to the real producers rather than only synthetic fixtures. Done-when #2 additionally requires the synthetic suite to catch subset/superset/renamed-member mutations specifically, not just presence/absence.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card grounds its cost claim in two concrete, already-occurred incidents rather than a hypothetical: PR #1046/#2942 shipped impactIfUnfixed 'inert' for a full round with a green suite, and #2823 hit the identical seam and required the same three-file hand-edit — this is a measured, repeated cost, not an invented one.

**Corrections applied by this review:**

- The card's 'Why a runtime import cannot be the answer' section overstates its case: we:skills-src/jury/subject-jury.workflow.js's own comment at lines 294-301 (adjacent to the exact IMPACT_LEVEL_VALUES literal the card cites at line 302) documents that #3057 already eliminated this mirror for the juror surface by moving it into an ordinary, importing module (we:skills-src/jury/panel-fanout.mjs) shelled via agent() — so 'the mirror must be allowed to exist' is true only of the remaining red-team surface and of we:scripts/workflows/review-parked-prs.mjs, not a blanket property of 'both producers' as stated.
- normalizeFinding in we:scripts/lib/jury-core.mjs has grown past the card's cited range of lines 356-402: it now runs to line 418, and the additional block at lines 390-417 (the #2950 direction-test loop plus the disposition-derivation logic) is not a simple field-acceptance pass-through like the rest of the function, so clause 1's 'make normalizeFinding read [the exported list]' will need special-casing for `disposition`, which the card's description of the function ('a run of hand-written if (raw.x …) statements plus one for loop') doesn't anticipate.

The design (reuse we:scripts/lib/verdict-totality.mjs's discovery-based enrolment pattern, single-source the field list, gate producer key-list coverage + enum-mirror set-equality) is well-grounded against the live repo — every cited line number, file, and mechanism checks out — but the card misses a real third Finding-producer (we:scripts/operations/review-pr.mjs) matching its own named failure class, and never measures the false-positive footprint of its own proposed "restates the finding key list" discovery heuristic, which a quick corpus check shows would plausibly over-fire.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** All four findings verified against the tree and applied — this review
materially improved the card.

- **consumer** — confirmed. `REVIEW_JUDGE_SHAPE` (`we:scripts/operations/review-pr.mjs:159-192`) is a real
  third producer, `additionalProperties: false`, hand-typed key list, feeding `normalizeFindings` at `:461`,
  with **no** test referencing it anywhere. *Design* now names it (including that its *enums* are already
  imported at `:72,81,178`, so only clause 2 applies to it), and Done-when #5 requires all three producers
  enrolled — that criterion is what proves the mechanism is discovery-based rather than a two-file list.
- **premise** — confirmed. `we:skills-src/jury/subject-jury.workflow.js:298-301` records #3057 already
  retiring the juror-surface mirror into `we:skills-src/jury/panel-fanout.mjs`, an importing module. The
  "must be allowed to exist" framing is corrected to a per-site question, with the elimination pattern tried
  first.
- **blast-radius** — confirmed and folded in as a required deliverable: the ~15-file `summary:`+`file:`
  corpus count is listed in *Design*, clause 2 must copy the **narrowed** `IMPACT_LEVELS` enrolment rather
  than `VERDICTS`' unrestricted pass, and new Done-when #6 pins zero new errors on the unmodified tree.
- **normalizeFinding line range** — corrected to `:356-418`, with a note that `disposition` (`:390-417`) is a
  derivation with a one-way ratchet, not a pass-through, so clause 1 must not fold it into a generic loop.
