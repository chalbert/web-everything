---
bornAs: xzadt1m
kind: decision
parent: "2822"
status: open
dateOpened: "2026-08-02"
preparedDate: "2026-08-16"
relatedReport: reports/2026-08-16-2854-statute-anchor-build-status-separation.md
tags: [conveyor, statute, governance, authoring, anchor-shape, decision-prep]
---

# Does point-in-time build status belong in a statute anchor, or on the decision item?

A ratified rule is timeless; what is built so far is not. PR #982 put both in the same anchor, and the result is a
655-word rule (doc median 324) whose sentences go false when #2785 lands. Decide where build status lives: inside the
anchor that states the rule, or on the decision item and the open guards. The call also fixes the shape of #2849,
which currently *requires* such prose to name a retiring item — institutionalising it rather than resolving it.

## Why this is open rather than a fix

The reviewer created the tension. Round 2 of the human `/review` on **PR #982** raised two findings — M8 (the anchor
granted the loop clearing authority while conceding its precondition was absent) and M9 (#2771's narrowing is unbuilt
and undisclosed) — and asked for honesty about what is unbuilt. The author read "be honest" as "disclose in the
anchor", which is a defensible reading of the ask. Round 3's simplicity lens then read the result as a layering
violation. Both are right about their half, so this is a genuine fork, not an author error to bounce back.

## The evidence

Measured against `we:docs/agent/platform-decisions.md` on `main` @ `a6ac95e9`:

- `#fix-review-convergence-independent-root-cause` is **655 words** (corpus median 324, p90 633 — top ~8% of 108
  anchors) and grew 427 → 655 (**+53%**) in the round asked to CUT duplication.
- Its invariant 1 is a single **277-word** paragraph. The longest paragraph in each anchor it cites:
  `#review-human-declarative-leash-only` 149, `#agent-convergence-independent-validation` 149,
  `#contract-split-for-tier-ownership` 126, `#small-file-preference` 179.
- Build-status tokens across the ~1,588 added words: `today` 3, `not yet` 4, `status: open` 2, `status: active` 4,
  `build-pending` 1, `still parks` 1, `interim` 4, `owed` 9, `outstanding prevention` 5. The whole pre-existing file
  (108 anchors) has `today` 12, `not yet` 3, and **zero** occurrences of `status: open`, `build-pending`, or
  `outstanding prevention` in any anchor body.

**Confirmed in the wild, during this prep's skeptic pass — the predicted decay has already happened, twice, to this
exact anchor:**

- Invariant 1 still reads *"Build-pending — not yet current fact… still owed"* about the reviewer-id / self-clear
  enforcement. But `we:scripts/lib/invariant-catalogue.json` (entry `review.land-seam-refuses-self-cleared-verdict`,
  its own `anchor` field back-linked to this exact heading) has recorded `"status": "enforced"` since PR #1100
  (2026-08-08), backed by real shipped code (`we:scripts/lib/review-independence.mjs`,
  `we:scripts/lib/auto-land-seam.mjs`, `we:scripts/review-set-label.mjs`). **The anchor's own prose is currently
  false** against ground truth the repo already tracks elsewhere.
- #2842 (resolved 2026-08-16) already had to patch **six** false `OPEN`/`` `status: open` `` claims out of this same
  anchor's body and Lineage paragraph, and #2853 (still open) exists solely to fix the "pending #2853's re-point"
  placeholders #2842 left behind. Two rounds of stale-status correction inside two weeks of the anchor being
  written — this is the anchor's actual maintenance history, not a hypothetical.

## Prior art

Report `we:reports/2026-08-16-2854-statute-anchor-build-status-separation.md`, research topic
[`/research/statute-anchor-build-status-separation/`](/research/statute-anchor-build-status-separation/): three
mature rule-documentation systems face this identical tension and all three keep a rule's text separate from its
status — **ADR** (status is a distinct field, never merged into the decision narrative), **IETF RFC + errata**
(the closest structural analogue to option (a): immutable rule text, status in a wholly separate linked system, at
effectively zero cost), and **MDN/web-features Baseline badges** (option (c)'s pattern: status inlined, but only as
an auto-generated render of a separate machine-readable dataset, never hand-authored prose). None of the three
systems' core rule text carries hand-maintained "not yet built" prose inside the ruling itself — that absence is
evidence against option (b), not silence.

## Fork 1 — where does build status live?

**Fork-existence check — not a config dimension.** #2849's lint needs ONE corpus-wide, mechanically-enforced rule;
letting each anchor's author freely choose per-anchor is not two composable end-states. The corpus already shows
what that freedom produces: the identical "outstanding prevention … pending #2853's re-point" disclosure is
duplicated near-verbatim across `#fix-review-convergence-independent-root-cause`'s body *and* its Lineage paragraph,
and again across `#deterministic-oracle-clears-slice`'s body and Lineage — proliferating, not composing. (b) also
carries no supporting precedent among the three systems surveyed above, and its one corpus instance has already gone
stale twice (see *The evidence*). That tips this past an even A/B toward a near-forced invariant: (a) is the shape
that holds up, (b) is the flawed branch.

- **(a) On the decision item and the open guards; the anchor states only the rule.** *(bold default)* The anchor is
  cite-able authority and should read the same in a year. Build status is exactly what the backlog already tracks,
  and every reader who needs it has the item id. Cost: an anchor can state a rule that is not yet enforced with no
  in-place warning — mitigated by requiring a link to the enforcing item. **Scope note:** #2844 clause 3 already
  requires this link, but only for *catalogued* operational invariants (`we:scripts/lib/invariant-catalogue.json`,
  gated by `validateInvariantEnforcers`) — this decision extends the same discipline (state the rule, link the
  status) to *every* point-in-time claim an anchor makes, catalogued or not.
- **(b) Inside the anchor, as PR #982 does.** A reader citing the rule sees immediately that it is not in force.
  Cost: the anchor goes stale silently, and this is what produced the 277-word paragraph — and, per *The evidence*
  above, already produced two rounds of drift inside two weeks.
- **(c) A dedicated machine-readable field.** **Not hypothetical — a narrower version already ships:**
  `we:scripts/lib/invariant-catalogue.json` records `status: "enforced"|"judgment-only"`, an `owedTo` open-item
  pointer, and an `anchor` back-link for each *catalogued* operational invariant, gated by `validateInvariantEnforcers`
  (#2844) to require every entry name a real enforcer or an open `owedTo`. This proves the field-per-claim shape
  works. What's missing — and genuinely highest-cost — is generalizing it from a curated catalogue to *arbitrary*
  anchor prose (the free-text tokens `today`/`not yet`/`build-pending` #2849 targets), which needs the `/rules/`
  renderer to parse and render an unbounded set of claims rather than a fixed catalogue.

**Code example — the real shape, before/after:**

Current (b) shape, verbatim from the live anchor (`we:docs/agent/platform-decisions.md:3422`):

> "Build-pending — not yet current fact: no label, PR field, or gate records the reviewer's session/service identity
> today, and current reviewers are same-orchestrator subagents given fresh context… The enforcement… is still owed:
> it was filed against the conveyor-mechanization line (#2840 — narrow gate-self to principle-surface; #2785 — the
> narrowed-rubric build), and both of those have since resolved without building it, so it stands as an outstanding
> prevention on #2851 while #2853 re-points this sentence at the items that actually own the work."

Illustrative rewrite under (a) — states the rule, points at the tracked status, carries no narrative that can go
stale:

> "Independence rests on a distinct fresh validator (applies #2398 to the conveyor: the orchestrator wearing a
> reviewer hat is #2398's own non-fresh-context reject case). Enforcement status:
> `review.land-seam-refuses-self-cleared-verdict` in `we:scripts/lib/invariant-catalogue.json`."

(c)'s already-shipped shape, the real catalogue entry this decision's (a) links to rather than duplicates
(`we:scripts/lib/invariant-catalogue.json`):

```json
{
  "id": "review.land-seam-refuses-self-cleared-verdict",
  "anchor": "docs/agent/platform-decisions.md#fix-review-convergence-independent-root-cause",
  "status": "enforced",
  "howChecked": "scripts/lib/review-independence.mjs owns the record format… SAFETY RAIL 4 in scripts/lib/auto-land-seam.mjs#decideAutoLand enforces it fail-closed…"
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — a spawned skeptic sub-agent attacked (a) on all four required axes
(classification, merit, statute-overlap, citation-scope; full transcript basis in
`we:reports/2026-08-16-2854-statute-anchor-build-status-separation.md`). (a) wins on every axis, but the attack (1)
found the anchor's own prose is *currently false* against the catalogue's ground truth (folded into *The evidence*),
(2) found a working narrower (c) already ships and (a)'s option text mischaracterized it as purely hypothetical
(corrected above), and (3) found the #2844-clause-3 citation over-extends past catalogued invariants specifically
(scope note added above). No axis flipped the default.

**Screen:** clear — run inline by the preparer (the second concurrent sub-agent slot was unavailable; see
*Provenance*). (1) Impl-vs-standard: this is a governance/documentation-authoring-layer call with no WE↔FUI
consumer boundary in play, so it isn't an impl-detail-dressed-as-standard confusion. (2) Merit-vs-prioritization: at
zero maintenance cost a merit difference survives — embedding status prose inside the citable rule text still
muddies what is authoritative rule text vs. incidental status commentary for a reader citing the rule from memory
(the exact failure the *Prevention* section below names), independent of any maintenance-cost argument.

## Consequence for #2849 (derived from Fork 1 — not an independent fork)

**Fork-existence check — this failed the standing test as its own fork.** #2849's correct shape is fully determined
by Fork 1's ruling; there is no separate axis of human judgment left once Fork 1 is decided (confirmed by a spawned
skeptic sub-agent: "still mechanically derived from Fork 1, not an independent judgment call"). It is dissolved from
a `## Fork N` into this conditional mapping, per the *no live choice outside a Fork N* rule — a fully-derived mapping
is not a live choice.

| If Fork 1 rules… | #2849 becomes… |
| --- | --- |
| **(a)** | **Split by catalogue membership**, per the skeptic's refinement: (i) for a *catalogued* operational invariant, #2849 does nothing new — `we:scripts/lib/invariant-catalogue.json` + `validateInvariantEnforcers` (#2844) already require a real enforcer or an open `owedTo`; (ii) for *uncatalogued* anchor prose, the lint **errors** on point-in-time tokens (`today`, `not yet`, `build-pending`, `still parks`) and directs the author to either add a catalogue entry or move the prose to the item — keeping the retiring-item pointer only for the narrow "until #NNNN" case. #2849's current token list would hard-error the ~15 pre-existing uses on `main` unless it ships an exemption list for the transition. |
| **(b)** | #2849 stays close to as-filed: an anchor's point-in-time claim must name the open item that retires it (the norm PR #982 already assumes). |
| **(c)** | #2849 is superseded by generalizing the catalogue-driven check to arbitrary anchor prose, rather than a standalone token lint. |

## Prevention (whichever fork wins)

An anchor-shape lint in `we:scripts/lib/validate-rules-anchors.cjs`: **error** when a single paragraph or numbered
list item in an anchor body exceeds ~200 words; **warn** when a whole anchor exceeds the corpus p90 (~630 words).
Both thresholds are computable from the file itself, so the gate self-calibrates as the corpus grows. This is
independent of the fork — a rule that cannot be quoted in one sentence gets cited by title from memory instead of
from text, which is the exact failure mode all four #982 review rounds kept finding. (Not yet filed as its own
item — a natural spin-off once this decision is ratified, alongside #2849's rewrite.)

### Review jury (provisional — pre-registered #2638)

Care level: `high` (this decision's ruling sets `codifiedIn` guidance over the statute layer
`we:docs/agent/platform-decisions.md` and the gate-self file `we:scripts/lib/validate-rules-anchors.cjs` —
`deriveCareLevel` forces `high` on any `humanRequired`/statute touch). Predicted touch-set (#2619) fed as the
charter's `changedFiles`: `we:docs/agent/platform-decisions.md`, `we:scripts/lib/validate-rules-anchors.cjs`,
`we:scripts/lib/invariant-catalogue.json`, `we:backlog/2849-statute-lint-an-anchor-s-interim-point-in-time-claim-must-na.md`.
This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

## Provenance

Round-3 finding **R4** from the human `/review` on **PR #982**, raised by the simplicity lens with measurements.
Accepted over at ratification and filed as a decision because the layering call is a genuine fork and the reviewer
owns part of the pressure that created it. Related: #2849, #2850, `2852` (the duplication lint), #2844.

**Prep methodology note:** the skeptic pass (four required axes) was run by a spawned throwaway sub-agent given only
this item + the linked report and told to refute the default; its findings are folded in above and its full run is
recorded in the linked report. The two-confusion screen was run inline by the preparer, not a second spawned
sub-agent — the concurrent-subagent pool was saturated at prep time and a second concurrent spawn was unavailable —
applying the same two fixed questions cold to each section. Disclosed per standing governance guidance that prep
must not silently skip or fake a required pass.
