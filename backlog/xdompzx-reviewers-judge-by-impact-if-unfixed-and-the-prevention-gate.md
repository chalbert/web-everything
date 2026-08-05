---
kind: task
status: resolved
dateOpened: "2026-08-05"
dateResolved: "2026-08-05"
tags: [review, jury, gate]
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/review-render.mjs
  - we:scripts/lib/verdict-totality.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/conveyor/jury-tree.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:skills-src/jury/subject-jury.workflow.js
  - we:skills-src/drain/SKILL.md
  - we:scripts/lib/__tests__/jury-core.test.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/lib/__tests__/review-render.test.mjs
  - we:scripts/lib/__tests__/verdict-totality.test.mjs
  - we:scripts/lib/__tests__/doc-prose.mjs
  - we:scripts/lib/__tests__/doc-prose.test.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/conveyor/__tests__/jury-tree.test.mjs
---

# Reviewers judge by impact-if-unfixed, and the prevention gate scales to a strictness dial

Findings carried `severity` (how bad the defect looks to its lens) but nothing about what it COSTS to ship,
so the panel could only count objections, never rank them by consequence. Adds `impactIfUnfixed` to the
finding contract and gates the prevention demand on it via a tunable bar.

## Why it is owed

Observed on PR #1042. The mandate demanded prevention introspection "for EVERY finding — at every severity,
nits included", and `deriveVerdict` blocked acceptance on any uncaptured guard with no severity threshold.
A dead struct field and a stale comment each arrived carrying a proposed new `check:standards` rule, and the
mechanical verdict came back `changes` on a diff whose only mandatory-lens objection was a race requiring a
branch deleted without landing inside a ~30s window. Six of seven findings blocked; two had real cost.

The operator framing that fixed it: judge by **what is the impact if we don't fix**. That is not expressible
in a shape that records only severity, so the reduction had to change, not just the prompt.

## Build

- `IMPACT_LEVELS` (`cosmetic` < `degraded` < `broken` < `unrecoverable`) + `IMPACT_STRICTNESS` (the ranks) +
  `IMPACT_GLOSS` (what each level MEANS, as data), both total over the enum and asserted at module load.
  `IMPACT_GLOSS` is the single definition: the reviewer-facing mandate renders each level's meaning from it, and
  the JSDoc points at it rather than restating it, so the prompt and the doc cannot drift.
- **Every lookup table this change touches is null-prototype**, built through a shared exported `frozenLookup`,
  and every membership test on them goes through `Object.hasOwn`. SIX tables: `IMPACT_STRICTNESS`, `IMPACT_GLOSS`,
  the pre-existing `VERDICT_STRICTNESS`, plus the three sibling render tables `VERDICT_LABELS`
  (`we:scripts/lib/review-render.mjs`) and `VERDICT_MARKERS` + `STATUS_MARKERS`
  (`we:scripts/conveyor/jury-tree.mjs`). All are read with keys that can arrive as free-form model JSON; on a
  normal object literal `toString` / `constructor` / `valueOf` / `hasOwnProperty` / `__proto__` validate as real
  members. The rank tables then compared as `NaN` (failing OPEN); the render tables' `??` / `||` defaults never
  fired, so `renderPanelComment({ verdict: 'toString' })` printed the native function into a posted PR comment and
  `renderJuryTree` with a juror status of `'toString'` printed it into the live conveyor tree. `VERDICT_MARKERS` is
  now also keyed from `VERDICTS` symbolically rather than re-typing its string values.
  (`STATUS_MARKERS` was found in round 4 — the round-2 sweep had claimed "every module-level lookup table on this
  path", twenty lines above a table it missed. The class is now asserted as a class, over this module's exported
  tables, rather than table by table. It is still a claim about the tables named here, not about the repo.)
- **One rank accessor.** `verdictStrictness` and `impactStrictness` were a hand-copied twin pair; both now
  delegate to a shared `rankIn(table, key, label)` beside `frozenLookup`.
- `impactIfUnfixed` on the `Finding` shape. An unrecognised value adds no key, so it reads as undeclared.
- `PREVENTION_IMPACT_BAR` — the dial, shipped at `broken` for the current solo/internal-tooling context.
- `blocksAcceptance(finding, { bar })`, split from `hasUncapturedPrevention`. The split is deliberately
  asymmetric: **notice-wide, verdict-narrow**. Every reporting surface reads the wide predicate; only the verdict
  reducers read the narrow one. `deriveVerdict` / `derivePanelVerdict` both take `bar`, so the dial is turnable
  per call.
- **The demand is unconditional; only the gate scales.** `buildSubjectMandate` demands `rootCause` /
  `prevention` / `preventionCaptured` on EVERY finding, at every impact, exactly as before this change — plus
  `impactIfUnfixed`. It then says where the bar bites: reporting is unconditional, blocking is not. A demand a
  reviewer can opt out of by declaring a finding cheap would starve the reporting surfaces of the very guards
  they exist to show, on exactly the path the bar un-blocks.
- **The producers actually ask for the field.** All three hand-typed `Return { … }` key lists — the drain panel
  lens (`we:scripts/workflows/review-parked-prs.mjs`) and the subject-jury juror + red-team
  (`we:skills-src/jury/subject-jury.workflow.js`) — now request `impactIfUnfixed` and state its enum values, and
  `LENS_SCHEMA` / `JUROR_SCHEMA` / `RED_TEAM_SCHEMA` declare it (with the #2823 prevention triple) rather than
  merely tolerating it under `additionalProperties: true`.
- **The audit trail rides the merge path, is WIRED there, and the wiring is a COMMAND.** Three halves, all needed:
  (1) `renderFindingLine` (`we:scripts/lib/review-render.mjs`) prints `impactIfUnfixed` and the owed `prevention`
  for every finding in the posted PR comment; (2) the drain's `land` / `autoLand: true` branch
  (`we:skills-src/drain/SKILL.md`) must POST that comment before it applies the accept labels whenever a finding
  satisfies `hasUncapturedPrevention(f) && !blocksAcceptance(f)` — a guard the BAR un-blocked; (3) that test is
  a subcommand, `unblocked` in `we:scripts/review-core-cli.mjs`, printing `{ bar, mustPost, unblocked, checked }`,
  so the branch reads an answer instead of an agent re-deriving a predicate by hand. (3) exists because the same
  failure mode broke this control twice: round 2, the renderer existed but the land branch called nothing; round
  4, the skill named `blocksAcceptance` while the documented facade `we:scripts/lib/review-core.mjs` did not
  export it, so following the instruction literally threw. `blocksAcceptance`, `PREVENTION_IMPACT_BAR` and
  `IMPACT_LEVELS` are now re-exported from that facade, and a test pins the general rule: every function the drain
  skill's branch blockquotes name must be a real export of a module the skill points its reader at.
  The emission is deliberately **conditional** — a clean accept with nothing un-blocked posts nothing, so an
  ordinary land stays quiet. The guarantee is therefore narrow and exact: no land that the bar un-blocked happens
  silently. Every doc, mandate and comment states it that way; an unconditional claim would be false.
- `IMPACT_LEVELS` is enrolled in the repo's discovery-based enum-totality gate
  (`checkVerdictTotality`, `check:standards` §14), which is now parameterised on the enum's symbol name, its marker
  pair, and how wide its bare-key discovery reaches. **What the enrolment delivers, exactly:** a third structure
  total over impact that references the enum SYMBOLICALLY (`[IMPACT_LEVELS.X]:` — how both existing consumers and
  every `frozenLookup` rank table in this repo are written) must carry `@impact-total` or the gate errors. That is
  real coverage the module-load assert cannot give, because that assert checks `IMPACT_STRICTNESS` and
  `IMPACT_GLOSS` BY NAME and is blind to any third table.
  **What it does NOT deliver:** every `IMPACT_LEVELS` value is an ordinary English word, so bare-key discovery is
  restricted for this enrolment (`genericKeysNeedSymbol: true`) — otherwise any unrelated
  `const HEALTH = { ok, degraded, broken }` becomes a false error whose cheapest escape is a bogus
  `@impact-partial` on innocent code. A table that spells the levels as bare keys and never names the enum
  (`{ cosmetic: 0, degraded: 1, broken: 2, unrecoverable: 3 }`) is therefore INVISIBLE to this gate. That hole is
  pinned as a characterization test, not left to be rediscovered. The coverage for the two named tables, and for a
  fifth level added to the enum, remains the module-load totality assert in `we:scripts/lib/jury-core.mjs`.
  The restriction is a property of the ENROLMENT and is decided ALL-OR-NOTHING PER SPAN. `VERDICTS` does not set
  it, so the incumbent gate keeps exactly the reach it had on main. (Round 3 put the restriction on the SHARED
  matcher as a per-VALUE filter and silently regressed the incumbent gate three ways — see `keyRefsEnabled` in
  `we:scripts/lib/verdict-totality.mjs`.)
- `renderPreventionSummary` leads with **"Prevention owed"**, not the `prevention-outstanding` verdict token, and
  says guards are *owed* rather than "must be filed before accept". The summary now fires on runs that reduce to
  `accept`, so leading with another verdict's name printed a verdict the reduction never produced.

## Acceptance

- Undeclared, invented, **or prototype-inherited** impact FAILS CLOSED — identical to pre-change behaviour, so
  this is a strict relaxation that can only un-block a finding which explicitly declared itself cheap. Every
  old-shape finding and every existing caller is byte-stable. Tested against the real `Object.prototype` members,
  across all six lookup tables listed in Build (both rank tables and all three render tables), not a hand-picked
  invented word — and, for `we:scripts/conveyor/jury-tree.mjs`, asserted over that module's exported tables as a
  CLASS, so a sixth table added there cannot slip the sweep the way `STATUS_MARKERS` did.
- The dial REACHES PRODUCTION: every finding-producing prompt and schema asks for `impactIfUnfixed`, so a real
  panel run populates it rather than omitting it and failing closed into pre-change behaviour.
- Nothing the bar un-blocks lands silently. A resolved below-bar finding with an uncaptured guard yields
  `accept`, its declared impact + owed guard appear in the rendered panel comment (asserted on the rendered
  SURFACE, not on the predicate), and the drain's auto-land branch is instructed to post that comment before the
  accept labels whenever such a finding exists (asserted against the skill text itself).
- The instruction the skill gives is EXECUTABLE, not just readable. The `unblocked` subcommand answers it in one
  command, and every function the skill's branch blockquotes name resolves from a module the skill points at —
  asserted by extracting the names from the doc and the exports from the modules, with no hand list on either side.
- No surface claims more than the wiring delivers: the emission is conditional, and the mandate, the JSDoc and
  the skill all state the conditional guarantee. Asserted as a `not.toMatch(/always visible/i)` **scoped to the
  block that makes the claim**, so an unrelated later use of the phrase elsewhere in a 400-line skill does not
  fail it.
- Assertions against markdown prose survive a reflow. Every one goes through a shared whitespace-normalizing
  matcher (`we:scripts/lib/__tests__/doc-prose.mjs`) that collapses whitespace and strips blockquote markers —
  never a raw `toContain` that pins a wrap point and an indent depth, which is how the round-3 assertion was
  written and how this repo's own `review-skill-guard` rule was first written wrong.
- No notice prints a verdict name it did not reduce to — asserted generically: on an ACCEPT reduction, no other
  `VERDICTS` member's name (token or spaced form) appears anywhere in the rendered notice.
- The mandate's prevention demand is never conditioned on the bar — asserted as a `not.toContain` on the
  conditioning wording, so it cannot creep back.
- The `VERDICTS` enrolment's DISCOVERED SITES are UNCHANGED by the `IMPACT_LEVELS` enrolment — the same nine
  SYMBOLS, not merely the same count, and 0 errors, before and after. (Count-only was too weak: round 3 held the
  count at nine while losing the whole bare-key class, because the nine real consumers all also reference the enum
  symbolically. Regression fixtures now exercise a bare-key-only consumer of the two most generic verdicts
  directly.)
- Turning the bar to `cosmetic` restores the previous gate with a one-line change and no consumer edits.
- Replayed against the #1042 panel: blockers drop from 6-of-7 to 2-of-7, and the two are the check-then-act
  window (`unrecoverable`) and the unrecorded item state (`broken`) — the two independently ranked as
  mattering.

## Follow-up not bundled

Tightening the bar as the constellation grows is a deliberate operator call, not a schedule — the dial and
its rationale are documented at `PREVENTION_IMPACT_BAR`.

Four deterministic guards this change's own review rounds named are filed rather than built here, because each is
a `check:standards` rule of its own: **finding-CONTRACT parity** (neither a new `Finding` field nor a new enum
member can land without its hand-typed producers), **lookup-table safety** (null-prototype tables through
`frozenLookup`, no defaulted bare-bracket reads, one shared rank accessor), **compensating-control wiring** (a
relaxation's control must be asserted on the outcome path it opens, not on the renderer in isolation), and
**in-flight hash citations** (an `x……` backlog hash outside the drain's rewrite scope dangles permanently).
