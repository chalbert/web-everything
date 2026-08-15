---
bornAs: xh0qgf9
kind: story
size: 2
parent: "2676"
status: open
scope: ["we:docs/agent/design-studio-method.md", "we:AGENTS.md", "we:docs/agent/build-ui.md"]
dateOpened: "2026-07-27"
tags: []
---

# Codify the proven design-studio METHOD (invariants + skill folds)

This session ran the design-studio method by hand and it worked; codify the method invariants as a cite-able method doc under the design-studio tool epic, and fold them into the build-ui and jury skills (items 4-5). The invariants are what made the result trustworthy.

The ratified method invariants — (a) DECIDE ON BUILT VISUALS, never prose (build + render candidates, then rule); (b) EVERY design update re-enters the committee (no solo edits to a ratified design); (c) RED-TEAM AFTER THE JURY (a high jury score is necessary not sufficient — the adversarial pass caught contradictory numbers, false-precision forecast, and unproven scale the jury missed); (d) REFINE FROM THE RATIFIED ARTIFACT, not rebuild from spec (rebuild re-diverges and reintroduces fixed defects); (e) FAIL CLOSED on an empty/failed stage — never synthesize on empty input (the empty-jury foreman fabricated ratings); (f) COMPLETENESS-CRITIC on every enumeration (it finds whole missing families); (g) INTEGRATION is its own phase at full scale; (h) enumerate ERROR + LATENCY, not just happy path. Dogfooding the method IS the tool's backlog.

Ratified in the feature-tracking-screen design session (committee → 10-juror jury → red-team → Round 2 → integration → frame committee → MASTER-DETAIL). Decision-view/trace artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d · Live integrated page: https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046

## Readiness note (prepared 2026-08-15) — most of the original scope is already delivered by this card's own children; one invariant is the real remaining gap

This card names two deliverables: **(1)** "codify the method invariants as a cite-able method doc under the design-studio tool epic," and **(2)** "fold them into the build-ui and jury skills (items 4-5)." Item (2) is **`#2707`** (jury skill: red-team-after-jury + fail-closed) and **`#2708`** (build-ui skill: fold in the proven method steps) — **both `status: resolved`**, both with real landed commits (`5c1c1ab8` for #2708, plus #2707's own commits touching `we:skills-src/jury/SKILL.md` and `we:scripts/lib/jury-core.mjs`). Verified this is genuinely done, not just claimed: `git log --all --grep="2708"` shows the commit; grepping the current docs confirms the content is live —

- `we:docs/agent/build-ui.md`'s "Honesty clauses" section (lines 188–226) already states, near-verbatim, invariants **(a)** ("A fork is ruled on built candidates", line 194), **(d)** ("Refine the ratified artifact, don't rebuild it", line 199), **(f)** ("Enumerate the unhappy path" + its completeness-critic clause, line 196), **(g)** ("The page is the unit, not the part", line 201), and **(h)** (folded into the same line-196 clause: "Error, empty, loading, and latency are cells, not extras"). Its "Related" section (line 232) already cites this exact session and `#2708` by number.
- `we:skills-src/jury/SKILL.md` (lines 50–107, section "The mandatory post-jury red-team + fail-closed posture (#2707)") already states invariants **(c)** and **(e)** near-verbatim, and `we:docs/agent/jury-refinement-method.md` move 6 documents the same rule as the durable method doc.

**By contrast, `#2706` itself (this card) has never had a real commit** — `git log --all --oneline -- backlog/2706-*.md` returns only the drain's JIT-numbering rename (`32d86bd0`, which mechanically renamed `2706`→`#2706` and never touched any doc content). Two *other* cards (`#2696`, `#3124`) assert in passing that there were "two doc skill-fold commits (#2708, #2706)" — that is imprecise: only `#2708` shipped a content commit; the `#2706` mention in that same drain commit's subject line is the rename, not a fold. Not correcting those two cards here (out of scope for this card), but noting it so the next reader isn't misled by that citation.

**The one substantive gap:** invariant **(b)** — "EVERY design update re-enters the committee (no solo edits to a ratified design)" — has **no home anywhere in the repo**. Confirmed by direct search, not assumption:

```
$ grep -rn "re-enters the committee\|solo edit\|no solo edit" docs/agent/ skills-src/
(no output)
```

`#2708`'s own body names exactly five items it folded (decide-on-built, refine-from-ratified, integration-phase, completeness-critic, error+latency enumeration) — (b) was never in its scope. `#2707`'s body names exactly two (red-team-after-jury, fail-closed) — (b) isn't there either. So (b) fell into the gap between the two children, and this parent card is its only remaining home.

**Consumer check (who needs to change alongside a new doc):** a markdown doc under `docs/agent/` has no ES/subprocess consumers, but it does have a *discovery* consumer: `we:AGENTS.md`'s Tier-0 router table, the always-loaded map every agent reads before drilling into `we:docs/agent/*`. Of the 18 files currently under `we:docs/agent/`, every sibling method doc this card's context touches (`we:docs/agent/build-ui.md`, `we:docs/agent/jury-refinement-method.md`) has its own router row (`we:AGENTS.md` lines 60–61); a new doc with no row is effectively unreachable by the normal "where does X live" lookup (3 of 18 existing docs already are, silently — not a precedent worth repeating). A new row is therefore required for the new doc to actually be cite-able, not optional polish.

**Sizing:** re-based from the original `size: 5` (invariants doc + fold into 2 skills) to **`size: 2`** — the fold half is done as two separately-sized (`size: 3` each) resolved children; what's left is one new ~120-line doc modeled on an existing template (`we:docs/agent/jury-refinement-method.md`), one router row, and one new Honesty-clause bullet in an existing file. No code, no tests, no new mechanism.

## Decided design

**Author one new Tier-2 doc, `we:docs/agent/design-studio-method.md`, as the umbrella that names all eight invariants together and is the durable home for invariant (b) — plus a matching Honesty-clause bullet in `we:docs/agent/build-ui.md` so (b) is actually enforced where agents read before building, not just cited in a doc nobody is routed to by default.**

Two design forks this preparation resolves rather than leaving open:

**Fork 1 — does invariant (b) get a brand-new doc, or does it fold into the existing build-ui/jury skills like (a)/(c)/(d)/(e)/(f)/(g)/(h) did?** Rejected "fold only, no new doc": the card explicitly asks for *two* things — a standalone cite-able doc AND the skill folds — and the skill-fold half is already fully spent on the other seven invariants (both #2707 and #2708 are resolved and neither named (b) in scope). A silent third edit to an already-resolved sibling's exact scope, with no doc of its own, would leave the card's first deliverable ("a cite-able method doc under the design-studio tool epic") never done. **Decided: build the doc** — it's also the one place that can name the *whole* session shape (committee → jury → red-team → Round 2 → integration → frame committee → master-detail) and hold the lineage (this card + #2707 + #2708 + the epic + both artifacts) in one place, which no single skill doc currently does.

**Fork 2 — does the new doc alone suffice for (b), or does it also need a line in `we:docs/agent/build-ui.md`'s "Honesty clauses"?** Rejected "doc-only": `we:AGENTS.md`'s router sends anyone "Building a new UI surface" to `we:docs/agent/build-ui.md` (line 60) — that is the doc actually read before/during a build. A rule that lives only in a doc nothing routes to by default is exactly the failure this card's own Readiness note flags above (3 of 18 `we:docs/agent/*.md` files already sit unreferenced from the router). **Decided: add both** — the new doc gets the full statement + lineage; `we:docs/agent/build-ui.md` gets one Honesty-clause bullet (matching the terse style of its 13 siblings) so the rule is where the enforcement actually happens, with the doc as the cite target for "why."

**New doc structure** (mirrors `we:docs/agent/jury-refinement-method.md`'s proven shape — H1 title, a `> Tier-2 reference` blockquote naming when to read it and its epic-home, a body, a closing Related and Lineage section):

```
# Design-Studio Method — governing a session after it's ratified

> Tier-2 reference. Read when running or governing a design-committee session under the
> design-studio product-loop epic (#2676) — what to do once a design/decision has been
> ratified. The proposal/build mechanics live in build-ui.md and jury-refinement-method.md;
> this doc is the post-ratification governance rule those two don't carry, plus the index
> of where every proven step of the session now lives.

## The eight invariants

a. Decide on built visuals, never prose — see build-ui.md, Honesty clauses,
   "A fork is ruled on built candidates" / phase 4.
b. [full statement — see below]
c. Red-team after the jury — see skills-src/jury/SKILL.md, "The mandatory post-jury
   red-team + fail-closed posture (#2707)" / jury-refinement-method.md move 6.
d. Refine from the ratified artifact, not rebuild from spec — see build-ui.md,
   Honesty clauses, "Refine the ratified artifact, don't rebuild it" / phase 2.
e. Fail closed on an empty/failed stage — see skills-src/jury/SKILL.md (#2707) /
   jury-refinement-method.md move 6.
f. Completeness-critic on every enumeration — see build-ui.md, phase 1 and
   phase 7 (convergence completeness-critic).
g. Integration is its own phase, at full scale — see build-ui.md, phase 6 /
   Honesty clauses, "The page is the unit, not the part."
h. Enumerate error + latency, not just the happy path — see build-ui.md,
   phase 1, "Enumerate the unhappy path."

## Related
## Lineage
```

**Invariant (b)'s full statement** (the only genuinely new prose this card needs to author — everything else above is citation, not new rule-writing): state that once an artifact is ratified (by committee, jury, or human-gate), a further edit to it — however small, including what looks like a one-line fix — is not a solo change one agent applies and calls done; it re-enters the **same** review shape (the committee/jury that ratified it, or an equivalent fresh pass) before it counts as ratified again. Ground it against the card's own ratifying session (feature-tracking-screen design session, cited in this card's opening paragraph and its two artifact links) — don't invent session detail beyond what the card states; the artifacts are available if a builder wants to pull a specific incident, but the rule as the card states it is sufficient to write. Frame it as the governance-lifecycle counterpart to the already-documented **"Self-review is not convergence"** clause (`we:docs/agent/build-ui.md` line 208) — that clause governs the *pre-ratification* convergence loop (don't call your own single pass "converged"); invariant (b) governs what happens *after* ratification (don't let a single pass silently un-ratify-and-reratify the artifact by editing it alone). Name that relationship explicitly in the doc so the two clauses read as one lifecycle, not two unrelated rules.

**The `we:docs/agent/build-ui.md` Honesty-clause addition** — one new bullet, placed immediately after "Refine the ratified artifact, don't rebuild it" (line 200) since both concern how a ratified artifact may be touched:

```
- **A ratified design update re-enters the committee.** Once an artifact is ratified, a further edit —
  however small — is not a solo tweak: run it back through the same review shape (the committee/jury
  that ratified it) before it counts as ratified again. A one-line "fix" applied alone and shipped is
  the un-reviewed edit this method exists to prevent (docs/agent/design-studio-method.md, #2706).
```

## Interfaces / protocol at every seam

- **`we:docs/agent/design-studio-method.md`** — new file. No front matter (matches the plain-markdown shape
  of every other `we:docs/agent/*.md`; these are prose docs, not backlog items). Top-level `# ` H1 + a `>` Tier-2
  blockquote (exact convention: compare `we:docs/agent/jury-refinement-method.md` lines 1–8 and
  `we:docs/agent/build-ui.md` lines 1–6). Section anchors a future doc may link into: an "eight invariants"
  heading, a Related heading, a Lineage heading (exact slugs depend on the renderer — verify by rendering).
  Not subject to the `we:` locus-prefix write-gate at all — that gate's corpus only covers `backlog/` and
  `reports/`, so the new doc's own prose uses plain repo-relative links, matching how its siblings already
  do it. Keep every markdown link inside it resolvable relative to the `docs/agent/` folder.
- **`we:AGENTS.md`** — one new row in the Tier-0 router table, inserted directly after the existing
  `we:docs/agent/build-ui.md` row (line 60) and before the `we:docs/agent/jury-refinement-method.md` row
  (line 61), same `| lookup phrase | [link](link) |` format as every other row in that table:

  ```
  | **Governing a design-studio session after a ruling** — every update to an already-ratified
  design/decision re-enters the committee/jury (no solo edits to a ratified artifact); the full committee
  → jury → red-team → integration → frame-committee → master-detail session shape, and where each proven
  step now lives | [docs/agent/design-studio-method.md](docs/agent/design-studio-method.md) |
  ```

- **`we:docs/agent/build-ui.md`** — one new Honesty-clause bullet (exact text specified above, "Decided design"),
  inserted between the existing lines 200 and 201. No other edit to this file — its five already-folded
  invariants (a/d/f/g/h) are untouched; do not re-word or duplicate them.

## Tasks (ordered)

1. Author `we:docs/agent/design-studio-method.md` per the structure above — H1, blockquote, the eight
   invariants (seven as short citations into the build-ui/jury materials, (b) as the full new statement),
   a Related section (cross-link `we:docs/agent/build-ui.md` and `we:docs/agent/jury-refinement-method.md`),
   a Lineage section (cite `#2706`, `#2707`, `#2708`, epic `#2676`, and the two artifact URLs already on
   this card).
2. Add the one Honesty-clause bullet to `we:docs/agent/build-ui.md` (between lines 200/201).
3. Add the one router row to `we:AGENTS.md` (between lines 60/61).
4. Render/sanity-check the new doc's markdown (headings, links resolve, no broken relative link to the
   build-ui or jury-refinement-method docs).
5. Run `npm run check:standards` — 0 errors.

## Done when

- `we:docs/agent/design-studio-method.md` exists, is a Tier-2 reference doc (H1 + `>` blockquote convention
  matching its siblings), and states all eight invariants (a)–(h) — seven as citations to where they're
  already enforced, (b) as a full, self-contained governance rule (not a bare restatement of the card's
  one-line summary).
- The doc's Lineage section cites `#2706`, `#2707`, `#2708`, epic `#2676`, and both artifact URLs from this
  card's opening paragraph.
- `we:AGENTS.md`'s router table has exactly one new row pointing at the new doc, in the same
  `| lookup phrase | [link](link) |` format as its neighbors.
- `we:docs/agent/build-ui.md` has exactly one new Honesty-clause bullet for invariant (b), and its five
  already-landed bullets for (a)/(d)/(f)/(g)/(h) are byte-identical to before this change — verified by
  `git diff` on that file showing a single-bullet insertion, no other lines touched.
- `npm run check:standards` passes with 0 errors.

## Delivery shape

**Lands in one PR, doc-only, incrementally behind `main` — no branch/flag needed.** All three touched files
(the new design-studio-method doc, and one-line/one-row edits to `we:AGENTS.md` and `we:docs/agent/build-ui.md`)
are additive; nothing reads or renders `we:docs/agent/*.md` at runtime (it's agent-facing reference, not
site-built content), so there is no migration and no sequencing constraint with any other in-flight card.

## Preparation status

Items 1–8 of `we:agent-memory-src/story-preparation-checklist.md` are done above (scope+consumers, size+basis,
testable Done-when, decided design incl. both forks this preparation resolved, interfaces at every seam,
ordered tasks, delivery shape; item 8's de-risking probe is the Readiness note's `git log`/`grep` verification
that the fold-half is genuinely done and (b) is genuinely the only gap — not assumed from the card's prose).
**Item 9 (independent review of this preparation) has not happened** — per the checklist this card is
*prepared*, not yet *build-ready*, until that review runs.
