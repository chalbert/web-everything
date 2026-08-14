---
bornAs: x09pzox
kind: story
size: 3
parent: "2822"
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/lib/validate-rules-anchors.cjs
  - we:scripts/__tests__/rules-anchors.test.mjs
  - we:docs/agent/platform-decisions.md
scopeRationale: "Adds one pure rule + its wiring to the statute gate in we:scripts/lib/validate-rules-anchors.cjs, fixture-tests it in we:scripts/__tests__/rules-anchors.test.mjs, and corrects the three sentences in we:docs/agent/platform-decisions.md that the new rule fires on today."
tags: [conveyor, statute-lint, prevention, precedent]
---

# Statute-lint: a #NNN cited as cleared precedent must resolve to a resolved item

A statute anchor that asserts a cited item's status — "#2398, resolved", "#2785 is `status: open`", "owed on the
**OPEN** line (#2840/#2785)" — has no gate holding that assertion true, so the claim silently goes false the day
the item's status changes. Add a status-assertion rule to the statute gate
(`we:scripts/lib/validate-rules-anchors.cjs`): where an anchor body explicitly claims a cited `#NNN`'s status, that
claim must match the item's real frontmatter `status`, failing `check:standards` otherwise.

## Premise check — what the original card got wrong, and what is true instead

This card was re-verified against `main` before preparation, and **its stated framing does not exist in the corpus**.
The original text said anchors cite precedent as `Concrete precedent:` / `cleared by #NNN` / `proven by #NNN`. A
grep of all four `/rules/`-rendered docs returns **zero** hits for any of those three phrases. Building the rule as
originally written would have shipped a gate that matches nothing.

What the corpus *actually* uses is a tighter and far better target: an **inline status parenthetical** next to the
cite. Fifteen of them exist across the four docs — `(#2398, resolved — …)`, `(#2823, still `status: active` — …)`,
`(#1073, open)`, `(#367, parked)`. This is the repo's own working convention for annotating a cite's settledness,
and it is machine-checkable with no interpretation.

**The drift is live on `main` right now.** Three sentences in `we:docs/agent/platform-decisions.md` assert that
#2785 and #2840 are OPEN; both are `status: resolved`:

- `:3420` — "#2771's implementation #2785 is `status: open`, so the live gate … still parks **every**
  gate-self/statute diff `review:human` today"
- `:3422` — "is owed on the **OPEN** conveyor-mechanization line (#2840 …; #2785 …)"
- `:3426` / `:3446` — "owed on the OPEN items #2840/#2785" / "owed on the OPEN conveyor-mechanization line
  (#2840/#2785)"

So this item is **not built, not partially built** — and its subject matter has already rotted in exactly the way it
predicted, which is the strongest possible argument for shipping it. (The same stale claim had also propagated into
this card's own Provenance section; corrected below.)

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` polices the anchor↔cite *edges* — a `codifiedIn:` that 404s
(`validateRulesAnchors`), a duplicate `{#id}` (`findDuplicateAnchors`), a dead anchor (`findOrphanAnchors`), an
anchor with no prose (`validateAnchorSubstance`), and an invariant with no enforcer (`validateInvariantEnforcers`,
#2844). None of them read the *status of an item the prose cites*. The machinery to do so already exists and is
already exported: `collectOpenItemIds` at `we:scripts/lib/validate-rules-anchors.cjs:307-322` reads every item's
frontmatter `status` — it just throws the value away, keeping only a live/not-live boolean.

## Design decision — bind on explicit assertions, not on proximity (measured)

The real fork this card left unaddressed is **what counts as a status claim**. It was resolved by measurement, not
argument. Two candidate grammars were prototyped against the live docs:

| Grammar | Candidates | Findings | False positives |
| --- | --- | --- | --- |
| **Loose proximity** — any status word within 60 chars of a `#NNN` | 52 | 26 | **~20 (≈75%)** |
| **Tight assertion** — the cite itself carries the status token | 21 | 9 | **0** |

The loose form is unshippable: it fires on `#670).** Without --session a scaffolded item is born `status: open``
(the word describes a *mechanism*, not #670), on "Rule #105) … the `open→active→resolved` backlog flow" (a state
machine), and on "#1034 Fork 3 → closed scored axes + open findings" ("open findings"). A gate that is 75% noise
gets suppressed — the same reasoning the file's own #2844 scope note already records for not classifying statute
prose heuristically (`we:scripts/lib/validate-rules-anchors.cjs:216-220`).

**Ruling: ship the tight grammar only.** Three patterns, all anchored on the cite itself:

- **A — adjacent parenthetical.** `#NNNN` followed by `,` or `(`, an optional hedge (`still` / `now` / `already`),
  then a bare status word. Must equal the item's real status.
- **B — explicit `status:` token.** `#NNNN` … `is|are|stays|remains|still` … `` `status: X` ``, within a short
  same-sentence adjacency. Must equal the item's real status.
- **C — a deliberate uppercase `OPEN`** (optionally bolded) governing the cite run that immediately follows it.
  Every cite in that run must be non-`resolved` and non-`dropped`.

Two guards found by the prototype and required by spec:

1. **`(?![-\w])` after the status word.** Without it, `#086 (open-core constellation)`
   (`we:docs/agent/platform-decisions.md:629`) is a false positive — "open" matched inside "open-core".
2. **Pattern C's cite run stops at the first clause boundary**, not a flat character budget. A 120-char window
   swept `#2851` into "owed on the OPEN items #2840/#2785, tracked as outstanding preventions on #2851" — the
   OPEN claim governs the slash-run, not the trailing attribution. This is the attribution-precision class #2861
   owns; keep C's run to the parenthetical / slash-run directly after the token.

**Deliberately out of scope (stated, not silent):** soft precedent framing with no status word — `precedent
#840/#844/#477` (`:987`, `:1023`), `#1163 (golden precedent)` (`:474`). The corpus has 28 uses of "precedent" in
`we:docs/agent/platform-decisions.md` and nearly all are lineage lists making no settledness claim. Hard-erroring
them would require judging whether a lineage cite *asserts* settledness — the coin-toss this rule refuses to make.
The rule binds the claims that are written down, and authors who want the check opt in by writing the annotation.

## Interfaces

New pure + injectable rule, matching the shape of `validateInvariantEnforcers`
(`we:scripts/lib/validate-rules-anchors.cjs:249`) so it is fixture-testable without the real tree:

```js
/**
 * #2842 — an explicit status claim about a cited #NNN must match that item's real status.
 * @param {Record<string,string>} srcByDoc  doc path → source text (the four RULE_DOCS)
 * @param {(nnn: string) => string|null} statusOf  real frontmatter status, or null when no item exists
 * @returns {Array<{message: string}>}
 */
function validateCitedItemStatusClaims(srcByDoc, { statusOf }) {}

/** Widen the existing reader from a live/not-live Set to the actual status value. */
function collectItemStatuses(backlogDir) {} // → Map<nnn|bornAs, status>
```

Touch points, all read from the file:

- `collectOpenItemIds` — `we:scripts/lib/validate-rules-anchors.cjs:309-322`. Already reads
  `status:` out of every item's frontmatter and discards it. Refactor to `collectItemStatuses` returning the value;
  keep `collectOpenItemIds` as a thin derivation over it so #2844's caller (`:355-358`) and its test
  (`we:scripts/__tests__/rules-anchors.test.mjs:237`) are untouched.
- `runStatuteCheck` — `we:scripts/lib/validate-rules-anchors.cjs:328-363`. It already builds `srcByDoc` for all four
  docs at `:349-350` for the substance rule; the new rule reuses that map — no extra file reads.
- `module.exports` — `we:scripts/lib/validate-rules-anchors.cjs:365-370`. Export the new rule + reader for tests.
- Doc set — `RULE_DOCS` at `we:scripts/lib/rules-loader.cjs:29-34` (platform-decisions, block-standard,
  backlog-workflow, vision-tiers). `we:docs/agent/memory-management.md` is **not** in that set, so its two stale
  `**OPEN**` rows for #1878/#1879 (both `resolved`) are correctly out of this gate's reach — note only.
- Consumers of the gate, unchanged: `we:scripts/check-standards.mjs:1612-1617` and `we:scripts/check-statute.mjs:22-25`.

## Done when

1. `validateCitedItemStatusClaims` is exported from `we:scripts/lib/validate-rules-anchors.cjs` and is pure —
   it takes `srcByDoc` and an injected `statusOf`, and touches no filesystem.
2. Given a fixture doc containing `` (#111, resolved) `` and a `statusOf` reporting `open` for `111`, it returns
   exactly one error naming the doc, the line, the claimed status, and the real status.
3. Given the same fixture where `statusOf` reports `resolved`, it returns zero errors.
4. Given `` #222 is `status: open` `` where `statusOf` reports `resolved`, it returns one error (pattern B).
5. Given `owed on the **OPEN** line (#333/#444)` where `statusOf` reports `resolved` for `333`, it returns one
   error for `333` and none for `444` when `444` is `active` (pattern C, per-cite).
6. Given `#086 (open-core constellation)`, it returns **zero** errors — the `(?![-\w])` guard.
7. Given `owed on the OPEN items #333/#444, tracked as preventions on #555` where `555` is `resolved`, it returns
   **no** error for `555` — pattern C's run stops at the clause boundary.
8. Given a claim about a `#NNN` with no backlog file at all, it returns one error saying the cite is dangling.
9. `runStatuteCheck()` over the **real** tree returns zero errors — i.e. the three stale sentences at
   `we:docs/agent/platform-decisions.md:3420/:3422/:3426/:3446` are corrected in the same change.
10. `npm run check:standards` is at 0 errors and `npm run test:unit` is green.

## Tasks

1. Widen `collectOpenItemIds` → `collectItemStatuses` (return the status value); re-express `collectOpenItemIds`
   over it so the #2844 call site and its existing test are byte-compatible.
2. Write `validateCitedItemStatusClaims` with patterns A, B, C and the two guards. Error messages name doc, line,
   claimed status, real status, and the fix ("update the annotation, or re-point the cite").
3. Wire it into `runStatuteCheck` reusing the existing `srcByDoc` map; export both new functions.
4. Add the fixture tests for Done-when 2–8 as a new `describe('#2842 — …')` block alongside the #2844 block at
   `we:scripts/__tests__/rules-anchors.test.mjs:144`.
5. Correct the four stale sentences in `we:docs/agent/platform-decisions.md`. #2785, #2840 and #2851 are all
   `resolved`; re-point the owed enforcement at the items that actually hold it — #2843 / #2844 / #2848 — which is
   the correction #2853 independently filed. Coordinate with #2853 so the edit lands once, not twice.
6. Run `npm run check:standards` (0 errors) and `npm run test:unit`.

## Delivery shape

**One piece.** Splitting the agent-clearable gate from the human-gated doc correction was considered and rejected:
landing the gate first turns `main` red (Done-when 9 fails until the doc is fixed), and the alternative — the repo's
warn-first → ERROR rollout precedent (`we:docs/agent/platform-decisions.md:976`, `:1023`) — exists for *open-ended*
sets needing curation. This set is closed and already measured at 9 findings over 4 lines, so warn-first would only
leave the live drift in place for another cycle. And the PR touches the statute layer either way, which fires the
`statute` escalation token (`clearance: human`, `we:scripts/lib/review-policy.contract.json`), so it parks
`review:human` whether it is one PR or two — splitting buys no autonomy.

**Size 3.** Basis: one new pure rule of roughly the span of `validateInvariantEnforcers`
(`we:scripts/lib/validate-rules-anchors.cjs:249-305`, ~57 lines), a mechanical widening of a 14-line reader, ~7
fixture tests mirroring an existing describe block, and a 4-sentence doc correction. No new file, no new consumer,
no schema change — and the detection grammar is already prototyped and measured against the live corpus, which is
the part that would otherwise carry the estimate risk.

## Provenance

Outstanding prevention **B1** from the human `/review` on **PR #982** (the stop-the-line conveyor-governance
statute, `we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the
prevention-introspection discipline (#2823, `status: active`). *Corrected during preparation:* the original card
said enforcement "belongs on the open conveyor-mechanization line (#2840 / #2785)" — both are now `status:
resolved`, and neither ever held reviewer-id scope. Enforcement is filed under epic #2822 as this item and its
siblings, which is the same repoint #2853 makes for the anchor prose. This item does not reopen the resolved
decision.
