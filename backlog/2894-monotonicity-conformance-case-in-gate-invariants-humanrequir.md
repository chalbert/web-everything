---
bornAs: xvf2vq8
kind: task
status: open
dateOpened: "2026-08-02"
tags: [governance, check-standards, review-integrity]
---

# Monotonicity conformance case in gate-invariants — humanRequired corpus can only shrink via enumerated RATIFIED_SHRINKS

Add a monotonicity conformance case to `we:scripts/lib/__tests__/gate-invariants.test.mjs`: a **frozen
corpus** of `(changedFiles, diffHunks)` inputs that are `humanRequired` under the ratified trigger set must
stay `humanRequired` under **any** new trigger set — with each **intended** narrowing enumerated in an
explicit `RATIFIED_SHRINKS` list. Any narrowing NOT in that list turns the case red and forces a
`POLICY_SPEC` edit (a deliberate, human-gated act) before the trigger set can change.

## Why (the #1002 defect this prevents)

The #2840 anchor originally claimed the new trigger set "can only ever ADD human-gating above today's line,
never shrink below it." That was false against `main`: today `we:scripts/lib/review-escalation.mjs#isStatutePath`
matches `we:docs/agent/platform-decisions.md` **whole-file** (`we:scripts/lib/__tests__/gate-invariants.test.mjs`
pins it), while the ratified trigger (1) fires only on a rule heading / ruling body and exempts
whitespace/reflow/typo — a strict NARROWING of the statute term. The prose fix (#1002) scoped the claim to the
post-#2785 baseline and named the one intended shrink, but nothing MECHANICALLY stops a future trigger-set edit
from silently dropping coverage. This conformance case is that mechanical guard: an un-enumerated shrink cannot
land green.

## Scope

- A frozen `(changedFiles, diffHunks)` corpus in `we:scripts/lib/__tests__/gate-invariants.test.mjs`, each
  case labelled with the trigger it exercises and asserted `humanRequired: true`.
- A `RATIFIED_SHRINKS` list enumerating every intended narrowing (e.g. "statute term: whole-file →
  rule-text edits") with a cite to the ratifying anchor / decision.
- The test recomputes `humanRequired` under the current trigger set and fails on any corpus case that flips to
  `false` unless that exact case is covered by a `RATIFIED_SHRINKS` entry.

Prevention filed against #1002's blocking fix 1 (false monotonicity claim). Mechanical, committee-clearable.

## Design

**The seam already exists.** [we:scripts/lib/__tests__/gate-invariants.test.mjs](scripts/lib/__tests__/gate-invariants.test.mjs)
already imports `scoreEscalation`, `isStatutePath`, `isPolicySpecPath` and the
`we:scripts/lib/gate-config.mjs` rosters (`POLICY_SPEC_BASENAMES`, `RATIFIED_POLICY_SPEC_FLOOR`,
`TRUST_CHAIN`), and already carries deterministic `powerset`/`product` enumerators plus per-tier file lists
(`DECLARATIVE_LEASH_FILES`, `DERIVATION_CODE_FILES`, `ENGINE_FILES`). This case is one more `describe` in that
file, using those same imports — no new module.

**Why the guard lands here specifically.** That test file is itself a DECLARATIVE-LEASH member
(its basename is in `RATIFIED_POLICY_SPEC_FLOOR`), so a diff that edits `RATIFIED_SHRINKS` to
admit a new narrowing is a `gate-self` / `clearance: human` change by construction — which is exactly the
"forces a `POLICY_SPEC` edit, a deliberate human-gated act" property the item asks for. Nothing extra has to be
wired to get it.

**The two frozen constants.**

```js
// we:scripts/lib/__tests__/gate-invariants.test.mjs
/** Inputs that are humanRequired TODAY. Frozen — a case is added, never quietly edited. */
const HUMAN_REQUIRED_CORPUS = Object.freeze([
  Object.freeze({ id: 'statute/whole-file',   trigger: 'statute term',
                  changedFiles: ['docs/agent/platform-decisions.md'], diffHunks: '…whitespace-only reflow…' }),
  Object.freeze({ id: 'statute/rule-heading', trigger: 'statute term',
                  changedFiles: ['docs/agent/platform-decisions.md'], diffHunks: '…a ruling-body edit…' }),
  // one case per DECLARATIVE_LEASH_FILES member, each labelled with the trigger it exercises
]);

/** Every INTENDED narrowing that has ACTUALLY LANDED, each citing the anchor/decision that ratified it.
 *  SHIPS EMPTY — see below. */
const RATIFIED_SHRINKS = Object.freeze([]);
```

**`RATIFIED_SHRINKS` must ship EMPTY, not pre-populated.** The obvious worked example — pre-registering
`statute/whole-file` against #2840 trigger 1 — is **wrong, and this card's own stale-exemption rule is what
catches it**: #2840 ratified the narrowing, but nothing implements it. `isStatutePath` in
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) still matches
`we:docs/agent/platform-decisions.md` by PATH alone, `scoreEscalation` never reads `diffHunks` for the statute
term, and `isPrincipleSurface` — the content-aware predicate the narrowing needs — exists only in comments
(`we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/diff-hunks.mjs`, `we:scripts/merge-ai-prs.mjs`), not
as code. #1002 was a prose-only fix to the statute doc, not a code change. So the whole-file case still reports
`humanRequired: true` today, and an entry claiming it shrank is a STALE exemption — red on day one.

**The list is populated by the PR that lands each narrowing, never ahead of it.** That is the discipline the
mechanism exists to enforce, and shipping it empty is what proves the stale rule works rather than merely
asserting it.

**The assertion, in both directions** — a one-directional check rots the same way the contract's `todo` marker
does (`we:scripts/lib/review-policy.contract.json`'s `todoMarker` block spells out why a STALE marker must also
fail):

- every corpus case recomputes `scoreEscalation({ changedFiles, diffHunks, humanBasisFiles })` and must still
  report `humanRequired: true`, **unless** a `RATIFIED_SHRINKS` entry names that exact `corpusId` — an
  un-enumerated shrink is red;
- a `RATIFIED_SHRINKS` entry whose corpus case still reports `humanRequired: true` is **stale** and is also
  red, so an enumerated exemption cannot outlive the narrowing it was written for;
- every `corpusId` in `RATIFIED_SHRINKS` must resolve to a real corpus case (no dangling exemption).

**Seed the corpus from the roster, not by hand-listing paths**: derive one case per `DECLARATIVE_LEASH_FILES`
entry plus the statute cases, so a file added to the roster without a corpus case is itself a visible gap.

**The population must cover every shape that is `humanRequired` today, not just the direct path hits.** The
same test file already proves three more, and a corpus that omits them lets a narrowing shrink them silently:

- `RELOCATED_LEASH_FILES` — a leash member matched by BASENAME after relocation (the travel property
  `we:scripts/lib/gate-config.mjs` is built around). A narrowing that re-anchors the match to a literal path
  would drop every one of these with the direct cases still green.
- The **cumulative-basis** shape (#2390): `scoreEscalation({ changedFiles: [code], humanBasisFiles: [code,
  leash] })` — a stacked couple whose own `changedFiles` touches no leash file but whose cumulative basis does.
- The **leaf-plus-leash** shape: an ordinary demo page in `changedFiles` with the leash file present
  only in `humanBasisFiles` (the existing test uses we:demos/spa.html).

Each is one more labelled corpus entry, using the same imports; none needs new machinery.

## Done when

1. **Executable** — `npx vitest run gate-invariants` is green with the new monotonicity `describe`, and the
   guard is proven to BITE by a mutation: temporarily narrowing `STATUTE_PATHS` in
   [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) so the whole-file
   `we:docs/agent/platform-decisions.md` case no longer forces the human gate turns the suite RED with a message
   naming the corpus case id; reverting the mutation turns it green again. (This is the "fails before, passes
   after" pair — the defect being guarded is a FUTURE edit, so the mutation is what makes it demonstrable.)
2. **Executable** — a stale-exemption case: a `RATIFIED_SHRINKS` entry pointing at a corpus case that still
   reports `humanRequired: true` fails the suite. Asserted directly against the pure predicate the assertion
   uses, so the rule is proven without leaving a permanently-red fixture in the file.
3. **Observable** — a dangling `corpusId` in `RATIFIED_SHRINKS` (naming no real corpus case) fails the suite;
   every `DECLARATIVE_LEASH_FILES` **and** `RELOCATED_LEASH_FILES` member has at least one corpus case; and
   the corpus includes the two cumulative-basis shapes (`humanBasisFiles` carrying a leash file the
   `changedFiles` list does not). `RATIFIED_SHRINKS` ships **empty** — one `grep` confirms no entry was
   pre-registered ahead of the code that narrows.
4. **Executable** — `npm run check:standards` reports 0 errors, and
   `npx vitest run review-policy.conformance` stays green (the corpus must not require a contract edit).

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: check by mutation or reversion ahead of the build) — The top-level claim (we:scripts/lib/review-escalation.mjs#isStatutePath still matches we:docs/agent/platform-decisions.md whole-file, unlike the ratified #2840 trigger 1) is verified true against the live repo; but the worked example's own premise — that the 'statute/whole-file' shrink can be safely pre-registered in RATIFIED_SHRINKS before the corresponding code change lands — was not verified and is false, per finding 1.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The corpus is scoped to a small, frozen, roster-derived set (DECLARATIVE_LEASH_FILES plus two statute cases) rather than a repo-wide lint, so growth is bounded and proportional to we:scripts/lib/gate-config.mjs's roster.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Purely additive to we:scripts/lib/__tests__/gate-invariants.test.mjs, already a DECLARATIVE_LEASH/RATIFIED_POLICY_SPEC_FLOOR member; no new module or caller is introduced.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The corpus/RATIFIED_SHRINKS mechanism assumes a future state of we:scripts/lib/review-escalation.mjs#scoreEscalation (diffHunks-aware statute narrowing via a not-yet-built isPrincipleSurface) that disagrees with today's actual seam, which only branches on changedFiles/humanBasisFiles paths — see finding 1.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The card's title/goal claims the humanRequired corpus 'can only shrink' broadly, but the seeded population (DECLARATIVE_LEASH_FILES + 2 statute cases) omits RELOCATED_LEASH_FILES and the cumulative-basis (#2390 humanBasisFiles) shapes that INVARIANT 1 in we:scripts/lib/__tests__/gate-invariants.test.mjs already shows are also humanRequired today — see finding 2.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when item 1 explicitly requires proving the guard BITES via a mutation of we:scripts/lib/review-escalation.mjs's STATUTE_PATHS, with revert-to-green — a concrete anti-decorative-guard step.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when item 1 requires the failure to name the corpus case id in the red message, so the failure surfaces rather than occurring silently.

**Corrections applied by this review:**

- The card's 'Design' section worked example pre-populates RATIFIED_SHRINKS with a 'statute/whole-file' exemption as if the #2840-trigger-1 narrowing (content-aware isPrincipleSurface) already exists in we:scripts/lib/review-escalation.mjs, but it does not: isStatutePath matches only by path and scoreEscalation's statute check never reads diffHunks, and isPrincipleSurface appears only in comments as unbuilt future work (confirmed via `git log` on #1002, which is a prose-only fix to we:docs/agent/platform-decisions.md, not a code change).

The goal and seam are sound and well-motivated (the whole-file-vs-ratified-narrowing gap is real and verified against `we:scripts/lib/review-escalation.mjs`), but the card's own worked example pre-registers a `RATIFIED_SHRINKS` exemption for a narrowing that has not actually been implemented in the live repo, which — by the card's own "stale exemption" rule — would redden the suite on day one rather than land green.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** Both NOT-addressed findings are correct and are now fixed in the body.
(1) `premise`/`interface` — the worked `RATIFIED_SHRINKS` entry pre-registered a narrowing that does not
exist: `isPrincipleSurface` appears only in comments (we:scripts/lib/review-escalation.mjs,
we:scripts/lib/diff-hunks.mjs, we:scripts/merge-ai-prs.mjs) and `isStatutePath` still matches by path alone —
verified. The Design now requires `RATIFIED_SHRINKS` to ship EMPTY and to be populated only by the PR that
lands each narrowing, which is exactly what the card's own stale-exemption rule demands. (2) `population` —
the corpus now also seeds `RELOCATED_LEASH_FILES` and the two cumulative-basis (`humanBasisFiles`) shapes,
both confirmed present and humanRequired in we:scripts/lib/__tests__/gate-invariants.test.mjs today, and
`## Done when` item 3 pins their coverage. No finding was judged wrong.

