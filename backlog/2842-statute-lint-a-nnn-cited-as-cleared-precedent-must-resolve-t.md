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
  - we:backlog/2842-statute-lint-a-nnn-cited-as-cleared-precedent-must-resolve-t.md
  - we:backlog/2853-correct-the-owed-work-pointers-in-the-stop-the-line-anchors-.md
scopeRationale: "Adds one pure rule + its wiring to the statute gate in we:scripts/lib/validate-rules-anchors.cjs, fixture-tests it in we:scripts/__tests__/rules-anchors.test.mjs, and clears the stale status claims in we:docs/agent/platform-decisions.md that the new rule fires on. The two backlog files carry the #2853 coordination the card requires be flagged back rather than silently diverged from (see Build note)."
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
cite. **Seventeen** of them exist across the four docs — `(#2398, resolved — …)`, `(#2823, still `status: active`
— …)`, `#1073 (open, to slice)` (`we:docs/agent/vision-tiers.md:26`), `(#1960, resolved …)`
(`we:docs/agent/block-standard.md:351`). This is the repo's own working convention for annotating a cite's
settledness, and it is machine-checkable with no interpretation. *(Corrected on independent re-verification: the
first draft of this section cited `(#1073, open)` and `(#367, parked)`. The first is a mis-transcription of the real
`#1073 (open, to slice)`; the second does not exist in the corpus at all — `we:docs/agent/backlog-workflow.md:184`
reads "#315 → #367 already walks: … scheduled version parked pending a track record", which is proximity, not an
annotation, and the tight grammar correctly declines it.)*

**The drift is live on `main` right now.** **Six** sentences in `we:docs/agent/platform-decisions.md` assert that
#2785 or #2840 is OPEN; both are `status: resolved`. Marked ✅ where the tight grammar below fires, ❌ where it does
not (a deliberate false negative — the claim is still stale and must be corrected, the gate just will not catch it):

- ✅ `:3420` (pattern B) — "#2771's implementation #2785 is `status: open`, so the live gate … still parks **every**
  gate-self/statute diff `review:human` today"
- ✅ `:3422` (pattern C) — "is owed on the **OPEN** conveyor-mechanization line (#2840 …; #2785 …)"
- ✅ `:3426` (patterns B **and** C, two claims on one line) — "its implementation #2785 is `status: open`" and
  "owed on the OPEN items #2840/#2785"
- ❌ `:3440` — "owed on the **open** #2840/#2785 line". Lowercase; pattern C binds only the deliberate uppercase
  `OPEN`, so this is out of the gate's reach by design.
- ✅ `:3446` (pattern C) — "owed on the OPEN conveyor-mechanization line (#2840/#2785)"
- ❌ `:3462` — "Depends on impl #2785 (the base `POLICY_SPEC` path narrowing, `status: open`) landing first". No
  copula, so pattern B's `is|are|stays|remains|still` adjacency does not reach it, and the status token is not
  adjacent to the cite, so pattern A does not either.

So this item is **not built, not partially built** — and its subject matter has already rotted in exactly the way it
predicted, which is the strongest possible argument for shipping it. (The same stale claim had also propagated into
this card's own Provenance section; corrected below.)

**Consequence for scope, stated so nobody re-derives it:** "the gate is green" and "the doc is true" are **not** the
same predicate. Done-when 9 is satisfiable with `:3440` and `:3462` still false, so both are listed in the task set
explicitly rather than left to fall out of the gate.

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
| **Loose proximity** — any status word within 60 chars of a `#NNN` | 52–124 | 26–86 | **≈75–95%** |
| **Tight assertion** — the cite itself carries the status token | 17–21 | 5–9 | **0** |

The ranges are the two independent prototype runs (preparation, then review re-derivation). The absolute counts move
with how wide the status-word set and the adjacency budget are drawn, so **only the ratio is load-bearing** — treat
the numbers as directional, not as an acceptance target, and do not build toward "9 findings". What both runs agree
on is the whole ruling: loose is mostly noise at every tuning tried, tight is zero false positives at every tuning
tried.

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

Three guards found by prototyping and required by spec. All three were re-derived independently at review; guards 1
and 2 each have a live corpus line that goes wrong without them, so neither is decorative.

1. **`(?![-\w])` after the status word.** Without it, `#086 (open-core constellation)`
   (`we:docs/agent/platform-decisions.md:629`) is a false positive — "open" matched inside "open-core".
2. **Pattern C's cite run stops at the first clause boundary**, not a flat character budget. A 120-char window
   swept `#2851` into "owed on the OPEN items #2840/#2785, tracked as outstanding preventions on #2851" — the
   OPEN claim governs the slash-run, not the trailing attribution. This is the attribution-precision class #2861
   owns; keep C's run to the parenthetical / slash-run directly after the token. The run must not stop at a `;`
   *inside* a parenthetical: at `:3422` the OPEN claim governs both cites in
   "(#2840 — narrow gate-self …; #2785 — the narrowed-rubric build)", so a naive `[^,;.)]` stop drops #2785 and
   under-reports. **Boundary = the end of the governed parenthetical or slash-run, not the first punctuation mark.**
3. **Pattern B binds the NEAREST preceding cite, not the leftmost.** Found at review, and the very line this card
   leads with is the counter-example: `:3420` reads "**#2771**'s implementation **#2785** is `status: open`". A
   left-to-right regex scan starts at #2771 and attributes the claim to it. Today both are `resolved` so the error
   still fires — but it names the wrong item, which fails Done-when 2's "names the claimed status and the real
   status" for the item actually claimed, and would go **silent on real drift** the moment the two cites' statuses
   differ. Anchor the match on the `` `status: X` `` token and scan **backwards** to the closest `#NNNN`; never
   forwards from the first cite. This is the same attribution-precision class as guard 2 (#2861).

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
8. Given `owed on the **OPEN** line (#333 — a reason; #444 — another)` where both are `resolved`, it returns
   **two** errors — the boundary is the parenthetical, so an inner `;` does not truncate the run (guard 2, second
   clause; this is the shape of the real `:3422`).
9. Given `` #333's implementation #444 is `status: open` `` where `333` is `open` and `444` is `resolved`, it
   returns exactly one error and that error names **#444**, not #333 — the nearest-cite guard 3.
10. Given a claim about a `#NNN` with no backlog file at all, it returns one error saying the cite is dangling.
11. `runStatuteCheck()` over the **real** tree returns zero errors — i.e. the stale claims at
    `we:docs/agent/platform-decisions.md:3420/:3422/:3426/:3446` are corrected in the same change.
12. **Separately from the gate** (a green gate does not prove this): `:3440` and `:3462` no longer assert #2785 or
    #2840 is open. These are the documented false negatives; grep them by hand.
13. `npm run check:standards` is at 0 errors and `npm run test:unit` is green.

## Tasks

1. Widen `collectOpenItemIds` → `collectItemStatuses` (return the status value); re-express `collectOpenItemIds`
   over it so the #2844 call site and its existing test are byte-compatible.
2. Write `validateCitedItemStatusClaims` with patterns A, B, C and the **three** guards. Error messages name doc,
   line, the cite the claim was bound to, claimed status, real status, and the fix ("update the annotation, or
   re-point the cite").
3. Wire it into `runStatuteCheck` reusing the existing `srcByDoc` map; export both new functions.
4. Add the fixture tests for Done-when 2–10 as a new `describe('#2842 — …')` block alongside the #2844 block at
   `we:scripts/__tests__/rules-anchors.test.mjs:144`.
5. **Land #2853 first (this item is `blockedBy: 2853`), then clear only the residual.** #2853 owns the repoint of
   the four owed-work sentences (`:3422`, `:3426`, `:3440`, `:3446`) from #2840/#2785 to the items that actually
   hold the work. Do **not** re-do that edit here — re-run the gate over #2853's result and fix what is left:
   - `:3420` and `:3462` — outside #2853's stated sentence list; both still say #2785 is `status: open`. This item
     corrects them.
   - **#2853's prescribed repoint does not by itself satisfy this rule.** It names **#2844** as the new target of
     the "owed on the **OPEN** … line" sentence, and #2844 is `status: resolved` — pattern C would fire on the
     corrected sentence. Of the three targets #2853 names, only **#2843** and **#2848** are open. Either drop the
     "OPEN" framing where #2844 is named, or name only the open owners. Flag this back onto #2853 rather than
     silently diverging from it.
6. Run `npm run check:standards` (0 errors) and `npm run test:unit`.
7. Hand-verify Done-when 12 — the two false negatives are not covered by the gate.

## Delivery shape

**One piece, after #2853.** Splitting the agent-clearable gate from the human-gated doc correction was considered
and rejected: landing the gate first turns `main` red (Done-when 11 fails until the doc is fixed), and the
alternative — the repo's warn-first → ERROR rollout precedent (`we:docs/agent/platform-decisions.md:976`, `:1023`) —
exists for *open-ended* sets needing curation. Today's finding set is closed and measured, so warn-first would only
leave the live drift in place for another cycle. And the PR touches the statute layer either way, which fires the
`statute` escalation token (`clearance: human`, `we:scripts/lib/review-policy.contract.json`), so it parks
`review:human` whether it is one PR or two — splitting buys no autonomy.

**Blast radius — accept it deliberately, because it is the point.** This rule makes `check:standards` fail
**repo-wide, on a change nobody made to the doc**: the moment a cited item's status flips, every unrelated commit
is blocked until someone edits `we:docs/agent/platform-decisions.md`. That is the rule working as designed, but the
coupling has live triggers today. Three currently-live items are annotated in the statute doc, and an ordinary
`/resolve` on any of them reds the gate for everyone:

| Cite | Where | Annotation | Caught by |
| --- | --- | --- | --- |
| **#2811** (`active`) | `:3444` | "still `status: active` / `human-verify` on `main`" | pattern B |
| **#2823** (`active`) | `:3426` | "still `status: active`" | pattern B |
| **#2834** (`active`) | `:3444`, `:3446` | "also `status: active`", "both `status: active`" | neither (no hedge) |

#2811 is the in-flight console-board oracle — its resolution is expected, not hypothetical. **Required before this
lands:** the error message must say *which doc line to edit* so the person who hit it can clear it in one edit
without reading this card, and `/resolve` should be checked for whether it already sweeps the statute doc (if it
does not, that is a follow-up item, not a blocker). Without the first, the rule converts a routine resolve into a
stop-the-line for an unrelated author with no obvious remedy — the classic reason a gate gets suppressed.

The **future**-prose set is not closed the way today's finding set is, so the "warn-first is for open-ended sets"
argument is weaker than the card first stated. It still holds, on a different ground: a false error here is
"you wrote a status claim that is wrong", and the remedy — reword or re-point — is one line and always available.
No suppression list or escape hatch is needed, and none should be added.

**Size 3.** Basis: one new pure rule of roughly the span of `validateInvariantEnforcers`
(`we:scripts/lib/validate-rules-anchors.cjs:249-305`, ~57 lines), a mechanical widening of a 14-line reader, ~9
fixture tests mirroring an existing describe block, and a 2-sentence residual doc correction (#2853 carries the
other four). No new file, no new consumer, no schema change — and the detection grammar is already prototyped and
measured against the live corpus, which is the part that would otherwise carry the estimate risk. Held at 3: guard 3
and the two extra fixtures are a fraction of a point, and the doc work shrank by the same amount when #2853 took it.

## Build note — the #2853 ordering was INVERTED, deliberately

The card was written `blockedBy: ["2853"]` on the assumption #2853 would land first and this item would clear
only the residual. At build time **#2853 was `status: open`, unbuilt, with no lane and no PR** — so the ordering
was inverted rather than the build stalled. The `blockedBy` edge is removed because it is no longer true: nothing
in this item's Done-when needs #2853.

**The split that made the inversion safe:** the two items touch the same sentences but assert different things.
#2853 owns **WHICH ITEM** the owed work is pointed at (a judgment call about ownership). This item owns **WHETHER
THE STATED STATUS IS TRUE** (a mechanical fact). So this build corrected only the status half — it dropped the
false `OPEN` framing and the false `` `status: open` `` claims at `:3420`, `:3422`, `:3426`, `:3440`, `:3446`,
`:3462` — and **left every #2840/#2785 cite exactly where it was**. #2853's repoint is untouched, still fully
owed, and each of those sentences now says so in the statute prose itself ("pending #2853's re-point"), so a
reader in the interim is told the pointer is wrong rather than being quietly misled.

**Flagged back onto #2853 (per Task 5), not silently diverged from:** its prescribed target **#2844 is
`status: resolved`**, so re-pointing an "owed on the **OPEN** …" sentence at it would fire pattern C of the rule
this item just shipped. Only **#2843** and **#2848** of the three targets it names are open. That note is now
written into #2853 itself.

**`/resolve` does not sweep the statute doc** — checked at build time: `we:.claude/commands/resolve.md` has zero
mentions of `platform-decisions` or the statute gate. Per the card's own instruction that is a **follow-up item,
not a blocker**; the blast-radius mitigation that *is* required — the error message naming the doc line to edit —
is built and pinned by a test.

**Blast radius, re-measured on the tree at build time (not the stale number):** 8 findings before the doc
correction, **0 false positives** — every finding was a genuinely stale claim on one of the four lines the card
named. 0 findings after. Simulating a `/resolve` of the three in-flight items confirms the coupling is real and
lands exactly where the card predicted: #2811 (`:3444`) and #2823 (`:3426`) each fire via pattern B, #2834 does
not (no copula — the documented false negative). Two loose-grammar false positives surfaced during the build
(`we:docs/agent/backlog-workflow.md:43` and `:276`, both the "born `status: open`" / "reading `status: active`"
mechanism sense) and were eliminated by tightening pattern B: the copula must sit **directly on** the status
token, and must not cross a sentence boundary from the cite. Both near-misses are pinned as negative controls.

## Provenance

Outstanding prevention **B1** from the human `/review` on **PR #982** (the stop-the-line conveyor-governance
statute, `we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the
prevention-introspection discipline (#2823, `status: active`). *Corrected during preparation:* the original card
said enforcement "belongs on the open conveyor-mechanization line (#2840 / #2785)" — both are now `status:
resolved`, and neither ever held reviewer-id scope. Enforcement is filed under epic #2822 as this item and its
siblings, which is the same repoint #2853 makes for the anchor prose. This item does not reopen the resolved
decision.
