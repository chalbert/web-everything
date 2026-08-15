---
bornAs: xaqt5ws
shortTitle: "Decision-record rationale schema"
kind: story
size: 5
parent: "2577"
status: open
dateOpened: "2026-07-20"
scope: ["we:scripts/backlog/ruling-record.mjs", "we:scripts/backlog/__tests__/ruling-record.test.mjs", "we:docs/agent/backlog-workflow.md"]
relatedTo: ["2574", "2576", "2649", "2654", "2641", "355", "xo9tlnu"]
tags: [decision-record, schema, ruler]
---

# Decision-record schema — persist rationale so decisions are explainable and reopenable

Define what a ruled decision persists so it is both understandable later and reopenable. Per decision, keep: the options considered (+ who proposed each), the forks and how each was ruled, the per-juror ratings + reasons, the collisions detected and their resolution, spawned/deferred items (e.g. #2574), and the final pick + rationale + who ruled + date; plus a version history so evolution is visible on reopen. Goal: 'why is A4 octagon-alert?' answerable in one click, and reopen loads the prior context intact. Maps onto the existing decision artifact (prepare/ratify/codifiedIn) — the record IS the decision's durable output, the Ruler is its UI. Parent: #2577.

## Grounding — what already exists (verified against live code/repo state, 2026-08-15)

- **Decision items already persist most of this today, as free-form prose.** [#2574](/backlog/2574-refine-the-scope-breach-card-state-a4-define-its-transition-t/)
  (resolved, `plateau-app` A4 transition-table decision) is the worked example the digest cites — it has lettered
  options per fork, a `Default:`/`Rejected:` ruling per fork, a `Skeptic:` + a narrative "three-lens jury … jury-lines
  5/4/4/5" rating, a `## Ruling (2026-07-20)` section with the final pick + rationale, and inline `#NNN` cross-refs
  for spawned items. **Nothing there is machine-readable** — a Ruler UI cannot query "why is A4 octagon-alert" without
  parsing prose.
- **The jury method (#2576, resolved) and its engine (epic #2649, resolved) are the sibling facet, already shipped.**
  `we:scripts/lib/jury-core.mjs` ships `VERDICTS = { ACCEPT, CHANGES, NEEDS_HUMAN, PREVENTION_OUTSTANDING }`
  (`we:scripts/lib/jury-core.mjs:70`) and `validateJuryEvent()` (`we:scripts/lib/jury-core.mjs:1034`,
  `{valid, errors, event}`, never-throws). The **durable fold** — `we:scripts/lib/jury-ledger.mjs`
  `foldJuryLedger(events)` — already reconstructs, per juror: `{ id, lens, charter, status, verdict, verdictRound,
  findings }` (`we:scripts/lib/jury-ledger.mjs:330-341`), and its own doc comment explicitly scopes the log to
  "a PR, a design, a **decision**" (`we:scripts/lib/jury-ledger.mjs:11`) — decisions are already a named subject.
  **But the log lives under `.conveyor/jury/` and is gitignored** (`we:scripts/lib/jury-ledger.mjs:65-74`) —
  operational scratch for a live run, not a durable, committed record. A decision's ruled juror output must be
  **copied into the committed item**, not just linked to ephemeral state.
- **`we:scripts/lib/decision-prose-adapter.mjs` (#2657) is a DIFFERENT use of "decision"** — it judges a proposed
  *approach* in prose before code exists (the plan-handshake critic, root-cause/completeness lenses), used for any
  story/task's approach review. It is not wired to rule a `kind: decision` item's own forks.
- **"Spawned/deferred items" already has a field — reuse it, don't add one.** `relatedTo` is an existing, widely
  used (221 items, `grep -c '^relatedTo:' we:backlog/*.md`) frontmatter convention for cross-referencing
  sibling/spawned items (e.g. #2641's own frontmatter carries `relatedTo: ["2500"]`). It is validated nowhere
  (freeform), but it is the native, already-adopted answer — no new field needed.
- **"Version history" already exists too — git.** Decision items are committed markdown; `git log --follow --
  we:backlog/<id>-*.md` is the append-only history of every prior ruling. No decision item today embeds a
  `history:` array, and nothing in the constellation invents parallel versioned storage for text already under git
  (native-first, memory rule #75).
- **"Who ruled" already has a field too — `ratifiedBy` — it's just rare (2 of 487).** Corrected during independent
  review: grepping ALL `kind: decision` items in `we:backlog/` (487, not 486 as first counted) for a *structured*
  ratifier field first turned up nothing and the draft wrongly generalized that to "none carry one" — a false
  premise an independent pass caught. `grep -l '^ratifiedBy:' we:backlog/*.md` finds exactly two:
  `we:backlog/2828-ui-fidelity-build-self-review-scope-always-on-vs-care-level-.md:8` and
  `we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md:8`, both
  `ratifiedBy: "Nicolas Gilbert (operator)"`. So the field exists and is the right precedent to extend — not
  the `we:docs/agent/platform-decisions.md` *statute-lineage prose* convention an earlier draft of this section
  proposed instead. `dateResolved` already records *when*; `ratifiedBy` is the sparse-but-precedented *who*. For
  the far more common case of a resolved decision with no explicit `ratifiedBy` — e.g. #2574, the digest's own
  worked example — the value is still derivable, not invented: the backlog workflow's hard ratification gate
  (`we:docs/agent/backlog-workflow.md`, *"Resolving a decision requires explicit ratification … flip active →
  resolved only on an explicit ratification utterance from the decision-owner"*) means every `resolved` `kind:
  decision` item was necessarily ratified by the human operator (the one sanctioned exception — the fork-existence
  test collapsing to a single coherent branch — never needs a `finalPick` at all, since there is nothing to rule
  between). So `FinalPick.ruledBy` reads the item's `ratifiedBy` frontmatter field when present, and otherwise
  defaults to the literal string `"operator"` — grounded in the gate's own invariant, not guessed (see Decided
  design and Tasks).

## Naming collision — do not reuse the identifier `DecisionRecord` (found in prep, would have cost a review round)

`we:blocks/renderers/decision-trace/renderDecisionTrace.ts` already exports an interface literally named
**`DecisionRecord`** (`{ subject, ruleSet, criteria[], outcome, reasonCodes?, at? }`), graduated from
[#355](/backlog/355-explainable-decision-trace-standard/) into the **`project:webdecisions`** WE standard — a
public, documented **"Decision Record Protocol"** (`we:src/_includes/project-webdecisions.njk`) for automated
**rules-engine** explainability (loan underwriting, eligibility, pricing — "why did the *system* decide this",
criteria/threshold/operator/outcome). That is a completely different domain from this story's subject — a
human/AI-ruled backlog fork with options, jurors, and a ratifier ("why did *we* decide this"). Composability probe:
`webdecisions`' `ruleSet`/`criteria[]` shape has no slot for options, proposers, fork rulings, juror findings, or a
ratifier — it cannot host this story's data without contorting a schema built for deterministic rule evaluation.
**Decision:** build a separate shape under a distinct name (`RulingRecord`, not `DecisionRecord`) so neither a grep,
an import, nor a future reader conflates the two "decision record" concepts. This is governance/repo-tooling
(analogous to `we:scripts/lib/jury-ledger.mjs`), not a new WE standard entity — no `project:`/demo/conformance
obligations follow.

## Decided design

**Shape only, mirroring the #2654 precedent exactly** ("Jury ledger event schema — the shape #2641 persists.
Schema only — not the on-disk log or the fold"). This story ships a pure JS shape (JSDoc typedefs) + a pure
validator, in the same style as `we:scripts/lib/jury-core.mjs`'s `validateJuryEvent`. It does **not** ship a
markdown parser/serializer that reads/writes a `kind: decision` item's frontmatter+body into/out of this shape,
does **not** wire jury-core to actually run a jury over a decision's forks, and does **not** build the Ruler UI —
each is a separate, larger, cross-locus follow-on (the natural next children under epic #2577), and bundling any
of them here would repeat the exact over-reach #2654 deliberately avoided.

**Module:** `we:scripts/backlog/ruling-record.mjs` (neighbours `we:scripts/backlog/frontmatter.mjs`,
`we:scripts/backlog/scaffold.mjs`, `we:scripts/backlog/id.mjs` — the backlog-item-specific mechanics directory;
`we:scripts/lib/jury-ledger.mjs` stays in `we:scripts/lib/` because it is subject-agnostic across PR/design/decision,
but this shape is decision-item-specific).

```js
/** @typedef {Object} RulingOption
 *  @property {string} id
 *  @property {string} label
 *  @property {string} [proposedBy] // 'operator' | an agent/seat label | a prior-art source; omitted when the
 *                                  //   item names no distinct proposer (the common case — most decisions in this
 *                                  //   repo research options rather than collect competing named proposals;
 *                                  //   `/design-committee`'s blind per-seat "distinct assigned angle" candidates
 *                                  //   are the concrete case where this IS populated) */

/** @typedef {Object} ForkRuling
 *  @property {string} id                // e.g. 'fork-1' — matches the item's '## Fork N' heading
 *  @property {string} name
 *  @property {string} chosenOptionId    // must reference a RulingOption.id in the same record
 *  @property {string} rationale
 *  @property {string[]} [rejectedOptionIds] */

/** @typedef {Object} JurorRating          // a TERSE PROJECTION of we:scripts/lib/jury-ledger.mjs's FoldedJuror
 *                                         // shape ({id,lens,charter,status,verdict,verdictRound,findings}) —
 *                                         // NOT a verbatim mirror (an earlier draft overclaimed this; corrected
 *                                         // during independent review). A settled record needs only what a
 *                                         // reader wants once ratification is done: which juror, under which
 *                                         // lens, cast which verdict, and why — so `charter`/`status`/
 *                                         // `verdictRound` (run-time process fields) are dropped and `findings[]`
 *                                         // collapses to one terse `reason` string. `id` is renamed `jurorId`
 *                                         // for clarity once embedded outside jury-ledger's own juror-keyed map.
 *                                         // The verdict vocabulary itself IS reused verbatim (see `verdict` below)
 *  @property {string} jurorId
 *  @property {string} lens                // free-form, NOT a fixed enum — jury-core's lens sets vary per subject
 *                                         //   (PR-review's 4 lenses vs decision-prose's root-cause/completeness);
 *                                         //   we:scripts/lib/jury-ledger.mjs itself never hardcodes one either
 *  @property {'accept'|'changes'|'needs-human'|'prevention-outstanding'} verdict  // we:scripts/lib/jury-core.mjs
 *                                         //   VERDICTS — NOT #2576's original "1-5" text; that text was never
 *                                         //   implemented by the shipped engine (verdict is categorical, not 1-5
 *                                         //   numeric). Reconciling #2576's text against what shipped is filed
 *                                         //   separately: xo9tlnu (does not block this story — this field follows
 *                                         //   the LIVE engine, per the "verify against live code" prep discipline)
 *  @property {string} [reason] */

/** @typedef {Object} CollisionNote        // a duplicate/conflicting state or rule detected + how it was resolved —
 *                                         // the #2576 "live truth-check" step, and/or the statute-overlap check
 *                                         // (we:docs/agent/backlog-workflow.md, the #1886 rule)
 *  @property {string} description
 *  @property {string} resolution */

/** @typedef {Object} FinalPick
 *  @property {string} rationale
 *  @property {string} ruledBy   // sourced from the item's EXISTING (if rare — 2 of 487) `ratifiedBy` frontmatter
 *                               //   field when present (e.g. "Nicolas Gilbert (operator)"); otherwise defaults to
 *                               //   the literal "operator" — derivable, not guessed, from the hard ratification
 *                               //   gate's own invariant (only the human operator may supply the ratifying
 *                               //   utterance that flips a decision active → resolved). No new frontmatter field.
 *  @property {string} date      // ISO date — mirrors dateResolved */

/** @typedef {Object} RulingRecord
 *  @property {string} itemId               // the backlog NNN/hash id this record belongs to
 *  @property {RulingOption[]} options       // >= 1
 *  @property {ForkRuling[]} forks           // >= 1
 *  @property {JurorRating[]} [jurorRatings]
 *  @property {CollisionNote[]} [collisions]
 *  @property {string[]} [spawnedItems]      // '#NNN' refs — reuses the item's EXISTING `relatedTo` frontmatter
 *                                           //   field; this is a read/derive convention, not a new field
 *  @property {FinalPick} finalPick
 *  @property {string} [codifiedIn] */       // reused verbatim — the existing #911 resolve-gate field
 *                                           //   (we:scripts/backlog/frontmatter.mjs:164-181)

/**
 * validateRulingRecord(raw) -> { valid: boolean, errors: string[], record: RulingRecord|null }
 * Pure, total, never throws — mirrors we:scripts/lib/jury-core.mjs's validateJuryEvent contract exactly
 * (`we:scripts/lib/jury-core.mjs:1034`). Required: itemId (non-empty string); options (array, length >= 1, each
 * {id,label} non-empty, ids unique); forks (array, length >= 1, each {id,name,chosenOptionId,rationale}
 * non-empty, chosenOptionId must equal some options[].id); finalPick ({rationale, ruledBy, date} all non-empty
 * strings). Optional, type-checked when present: jurorRatings (each verdict must be a VERDICTS-enum-equivalent
 * value), collisions, spawnedItems (strings), codifiedIn (string). No new dependency: verdict membership is
 * checked against a local copy of the 4-value literal set (importing `we:scripts/lib/jury-core.mjs`'s VERDICTS
 * from `we:scripts/backlog/` would reach across a directory boundary for 4 string literals — the values are
 * frozen/stable, so a literal re-list is lower-risk than an import here; call this out explicitly in the module's
 * header comment so it is never mistaken for silent drift).
 */
export function validateRulingRecord(raw) { /* … */ }
```

**"Version history" is deliberately NOT a field.** It is git's commit history over the item's own file
(`git log --follow -- we:backlog/<id>-*.md`) — documented as the answer in the schema doc, not built as new
machinery.

## Interfaces / protocol

- **Only export surface:** the JSDoc typedefs above (compile-time only, no runtime cost) + `validateRulingRecord(raw)`.
  No file I/O, no `Date.now()`, no network — pure, unit-testable in isolation exactly like `validateJuryEvent`.
- **Consumers (none built by this story, named for the interface they'll need):** a future `kind: decision`
  markdown ⇄ `RulingRecord` serializer (parses `## Fork N` / `## Ruling` sections into the shape — a real chunk of
  work, its own story); the Ruler UI in `plateau-app` (reads a `RulingRecord`, renders "why is A4 octagon-alert" in
  one click); a future jury-core wiring that runs `/jury` over a decision's forks and folds its ledger into
  `jurorRatings` at ratification time.
- **Error shape:** `{ valid: false, errors: string[] }` — one string per violation, each naming the field and the
  concrete problem (e.g. `"forks[1].chosenOptionId 'opt-9' does not match any options[].id"`), matching
  `validateJuryEvent`'s error-message style so both validators read the same way to a caller.

## Tasks

1. Add `we:scripts/backlog/ruling-record.mjs` — the typedefs + `validateRulingRecord()`, pure, header comment
   citing this item and the naming-collision note (so a future reader who greps `DecisionRecord` finds the pointer).
2. Add `we:scripts/backlog/__tests__/ruling-record.test.mjs` — two valid-record fixtures built from REAL ratified
   items, not synthetic-only data: (a) **#2574** for the options/forks/collisions/jurorRatings shape (4 forks,
   each with a chosen option and a rejected alternative; its `## Ruling (2026-07-20)` three-lens jury narrative
   maps to `jurorRatings`) — #2574 itself names no ratifier, so its fixture's `finalPick.ruledBy` is `"operator"`,
   the documented no-explicit-field default (NOT invented — see Grounding), with a code comment saying so
   explicitly; (b) **#2851** (or #2828) for the `finalPick.ruledBy` case where the item's own `ratifiedBy`
   frontmatter field ("Nicolas Gilbert (operator)") is read verbatim, proving the field-present path. Plus one
   targeted failure case per required-field omission, a `chosenOptionId` that doesn't match any option, and an
   out-of-enum `verdict`.
3. Add a new section to `we:docs/agent/backlog-workflow.md` (near the existing ratification-gate / fork-readiness
   guidance) documenting: the schema's purpose and module path; the field ↔ existing-convention mapping
   (`codifiedIn` reused verbatim, `relatedTo` reused for `spawnedItems`, git log as version history, `ratifiedBy`
   reused when present else defaults to `"operator"` per the ratification-gate invariant); the `DecisionRecord`/
   `webdecisions` naming-collision note; and an explicit **out-of-scope** list (no serializer, no jury-core wiring,
   no Ruler UI, no new frontmatter field, no `check:standards` gate) so a later reader doesn't assume more shipped
   than did.
4. Run `npm run check:standards` and `npx vitest run we:scripts/backlog/__tests__/ruling-record.test.mjs`.

## Done when

- [ ] `we:scripts/backlog/ruling-record.mjs` exists, exports `validateRulingRecord`, and importing it has zero
      side effects (no fs/network calls at import time).
- [ ] `validateRulingRecord()` returns `{valid: true, errors: []}` for a record built from #2574's real ratified
      content (not a synthetic-only fixture) AND for one built from #2851's (or #2828's) real `ratifiedBy` field.
- [ ] `validateRulingRecord()` returns `{valid: false, errors: [...]}` (non-empty, field-naming messages) for each
      of: missing `options`, a `forks[].chosenOptionId` with no matching option, an out-of-enum `jurorRatings[].verdict`,
      a missing `finalPick.ruledBy`.
- [ ] `npx vitest run we:scripts/backlog/__tests__/ruling-record.test.mjs` passes.
- [ ] `we:docs/agent/backlog-workflow.md` carries the new schema section with the naming-collision note and the
      explicit out-of-scope list.
- [ ] `npm run check:standards` is 0 errors.

## Delivery shape

**One piece, single PR.** Purely additive — one new module, one new test file, one new doc section; no existing
runtime file is modified (not `we:scripts/lib/jury-core.mjs`, not `we:scripts/lib/jury-ledger.mjs`, not
`we:scripts/backlog/frontmatter.mjs`, not `we:scripts/backlog.mjs`'s CLI). No shared gate is touched, so there is
no incremental-landing constraint and no sequencing risk with concurrent lanes.

## Out of scope (explicit — the natural next children under epic #2577)

- A markdown ⇄ `RulingRecord` parser/serializer for `kind: decision` items.
- Wiring `/jury` (jury-core + jury-ledger) to actually run and persist a jury over a decision's own forks at
  ratification time — today no decision ratification runs through that machinery; it's ad hoc narrative prose
  (per #2574's "three-lens jury … jury-lines" example, authored before jury-core existed).
- The Ruler UI itself (`plateau-app`) that reads/renders a `RulingRecord`.
- Any new hard-gated frontmatter field or `check:standards` rule enforcing this shape on decision items — 487
  existing decision items predate it (only 2 already carry `ratifiedBy`); retroactively gating would be an
  unmeasured, repo-wide blast-radius risk this story does not take on.
- The #2576-vs-jury-core rating-scale reconciliation — filed separately as
  [xo9tlnu](/backlog/xo9tlnu-reconcile-2576-per-option-1-5-ratings-text-against-jury-core/) (a `kind: decision`,
  since it's a real either/or on which text is authoritative, not a build).

## Independent review (2026-08-15)

A fresh-context reviewer checked every file:line citation against the live tree (all confirmed accurate) and
found two real defects in the first draft, both fixed above: (1) the "no decision item carries a structured
ratifier field" grounding claim was false — `#2828` and `#2851` both carry `ratifiedBy`, which is now the field
`FinalPick.ruledBy` reuses, replacing the weaker prose-convention design; (2) the #2574-only test fixture couldn't
truthfully supply a `ruledBy` value — the task/Done-when now specify a documented `"operator"` default (grounded
in the ratification-gate invariant, not invented) plus a second real fixture (#2851/#2828) exercising the
field-present path. The `JurorRating`/`FoldedJuror` "mirrors verbatim" overclaim was also corrected to state the
actual (deliberate) differences. Confidence after fixes: **High** — naming-collision, sibling-item (xo9tlnu), and
scope/blast-radius findings all held up under independent verification; the two defects found were corrected in
place rather than deferred.
