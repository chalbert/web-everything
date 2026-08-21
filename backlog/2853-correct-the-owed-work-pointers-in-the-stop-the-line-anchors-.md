---
bornAs: xat9huz
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute, governance, prevention]
---

# Correct the owed-work pointers in the stop-the-line anchors — name #2843/#2844/#2848, not #2840/#2785

Four statute anchors landed by PR #982 say their owed enforcement is "owed on the OPEN conveyor-mechanization line
(#2840 / #2785)", and the decision item says the guards were "filed under those open items". Both are wrong: the
guards are filed as #2842–#2850 under epic #2822, and neither #2785 nor #2840 has any reviewer-id or session/service
work in scope. **The fix is no longer a repoint:** #2854 (ratified 2026-08-17) ruled build status out of anchor
prose entirely, so the four anchor clauses get DELETED and only the backlog-item line gets corrected — see
*SUPERSEDED APPROACH* below before building.

## Gap

Verified on `main` @ `a6ac95e9`: #2842–#2850 all carry `parent: "2822"` with no `blockedBy`/`parent` edge to #2840
or #2785, and a grep for reviewer-id / session-service wording returns **zero** hits in both
`we:backlog/2785-implement-the-narrowed-review-human-rubric.md` and
`we:backlog/2840-human-principle-not-implementation-narrow-gate-self-from-pat.md`.

Affected sentences in `we:docs/agent/platform-decisions.md`:

- `#fix-review-convergence-independent-root-cause` invariant 1 — "owed on the **OPEN** conveyor-mechanization line
  (#2840 …, #2785 …)" → should name **#2844** (reviewer id in the verdict; land seam refuses a self-clear).
- `#fix-review-convergence-independent-root-cause` **Lineage** — same substitution.
- `#deterministic-oracle-clears-slice` body — the `human-verify` reader is **#2848**; the oracle spec-tier +
  non-author signal is **#2843**.
- `#deterministic-oracle-clears-slice` **Lineage** — same.
- `we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md` — "The enforcement each guard
  names lands under the open conveyor-mechanization line (#2840 …, #2785 …)" → filed under epic **#2822**.

## Why it matters

#2840 and #2785 can both resolve while #2843, #2844 and #2848 are still open. A reader watching the *named* items
sees them close and treats the independence precondition as satisfied — retiring the `review:human` interim rail
while nothing records or compares reviewer identity. The statute then asserts owed enforcement that nothing on the
board is accountable for.

While in the file, also fix the review-round token that leaked into permanent case law: "filed under those open
items **at accept**" — "accept" refers to a PR review round the future reader has no access to.

## Mechanical fix

Edit the four anchor sentences plus the item line to name #2843 / #2844 / #2848 and epic #2822. Frontmatter and
anchor ids unchanged.

**Note on routing:** this edits the cite-able statute layer, so the PR parks `review:human` and needs its own
deliberate human pass. That is why it is filed rather than patched inline at accept time.

## Flagged back from #2842 — the prescribed repoint does NOT satisfy the new statute lint

**#2842 landed first** (the ordering in its card was inverted: this item was still open and unbuilt when #2842
built). #2842 ships a gate that fails `check:standards` when statute prose asserts a cited item's status and the
assertion is false — including an uppercase **`OPEN`** governing a cite run whose members are `resolved`. Two
consequences for this item:

1. **#2844 is `status: resolved`.** Re-pointing "owed on the **OPEN** conveyor-mechanization line …" at #2844
   would fire #2842's pattern C on the *corrected* sentence and red the gate repo-wide. Of the three targets this
   card names, only **#2843** and **#2848** are open. Either name only the open owners, or drop the "OPEN"
   framing from the sentence that names #2844 — do not carry both.
2. **The status half of these sentences is already corrected; the pointer half is not.** #2842 removed the false
   `OPEN` / `` `status: open` `` claims at `we:docs/agent/platform-decisions.md:3420`, `:3422`, `:3426`, `:3440`,
   `:3446` and `:3462` but left **every #2840/#2785 cite exactly where it was**, so this card's whole job is
   intact. Each of those sentences now reads "pending #2853's re-point", which is the text to replace. The
   "filed under those open items **at accept**" round-token this card also flags was dropped from `:3422` as a
   side effect of that edit; the remaining instances are still this item's.

## SUPERSEDED APPROACH — #2854 ruled the status prose out of the anchor entirely (read this first)

**The "repoint the cites" fix this card was filed with is no longer the right one**, and the reason is a
ruling that landed after it was filed. [#2854](/backlog/2854-does-point-in-time-build-status-belong-in-a-statute-anchor-o/)
(`status: resolved`, ratified 2026-08-17 by the operator, codified as
`we:docs/agent/platform-decisions.md#statute-anchor-states-rule-not-status`) ruled **Fork 1 = (a)**: a statute
anchor states only the **timeless rule**; point-in-time build status — what is enforced today, what is still
owed, which item retires a gap — lives on the **decision item and the open guards**, linked by id, and is
**never narrated in the anchor body**.

#2854's evidence section names *this very card*: it observes that `#fix-review-convergence-independent-root-cause`
grew 427 → 655 → 714 words in successive rounds asked to *cut* duplication, precisely because status prose kept
needing correction in place; that #2842 already had to patch six false status claims out of the same anchor; and
that "#2853 exists solely to fix the `pending #2853's re-point` placeholders #2842 left behind". Two rounds of
stale-status correction in two weeks is the anchor's real maintenance history — and a third round of the same
move is exactly what the ruling forbids.

**So the corrected job is DELETION, not substitution.** Remove the point-in-time status narration from the four
anchor sentences; keep the anchor's timeless rule text; let the tracking live where #2854 put it. That also
removes the #2844-OPEN-framing hazard below, because there is no owed-work clause left to frame.

**And one of the claims being deleted is now simply false.** `we:scripts/lib/invariant-catalogue.json`'s entry
`review.land-seam-refuses-self-cleared-verdict` — whose own `anchor` field back-links to
`#fix-review-convergence-independent-root-cause` — has read `"status": "enforced"` since PR #1100 (2026-08-08),
backed by shipped code in `we:scripts/lib/review-independence.mjs`, `we:scripts/lib/auto-land-seam.mjs` and
`we:scripts/review-set-label.mjs`. Invariant 1's "Build-pending — not yet current fact … still owed" prose is
therefore **wrong about the world**, not merely pointed at the wrong item. Deleting it is the fix; repointing it
at #2843/#2848 would have preserved a false claim with better citations.

**What survives from the original framing.** Sentence 5 — the `we:backlog/2851-…md` body line — is a *backlog
item*, not an anchor, so #2854's rule does not reach it. That line should still be corrected to name epic
**#2822**, and its stale `both `status: open`` claim about #2840/#2785 (both now `resolved`) fixed. Status
belongs on the item; it just has to be *true* there.

## Design — the exact sentences, re-located at prep time (2026-08-21)

The line numbers in *Gap* have drifted since filing; these are current. Every one of them now ends in the
phrase **`pending #2853's re-point`** (or, at `:3442`, `while #2853 re-points this sentence…`), so that phrase
is both the locator and the text to remove:

| # | locus | action under #2854 |
|---|---|---|
| 1 | `we:docs/agent/platform-decisions.md:3442` — `#fix-review-convergence-independent-root-cause` invariant 1 | **DELETE** the build-pending / still-owed narration (it is also false — the catalogue reads `enforced`). Keep the timeless rule. |
| 2 | `we:docs/agent/platform-decisions.md:3446` — same anchor, **Lineage** | **DELETE** the same duplicated disclosure. |
| 3 | `we:docs/agent/platform-decisions.md:3460` — `#deterministic-oracle-clears-slice` body | **DELETE** the "still owed, filed against …" clause; the `human-verify` reader (#2848) and the oracle spec-tier / non-author signal (#2843) are tracked on those open items. |
| 4 | `we:docs/agent/platform-decisions.md:3466` — same anchor, **Lineage** | **DELETE** the same duplicated disclosure. |
| 5 | `we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md:98-100` | **CORRECT** — name epic **#2822**, and drop the false "both `status: open`" claim (#2840 and #2785 are both `resolved`). A backlog item is the right home for status; it just has to be true. |

**Statuses re-verified on this tree, because the whole defect class is confident claims about other items
written without opening them:** #2843 `open`, #2848 `open`, #2844 **`resolved`**, #2842 `resolved`,
#2849 `open`, #2785 `resolved`, #2840 `resolved`, #2851 `resolved`.

**The #2844 hazard dissolves under deletion — but the guard is real, so do not reintroduce it.** #2844 (*land
seam refuses a self-cleared verdict*) is `status: resolved`, so an uppercase `OPEN` governing a cite run that
names it fires #2842's pattern C and reds the gate repo-wide. Mutation-tested during the 2026-08-21 review:
calling `validateCitedItemStatusClaims` with a synthetic line placing #2844 under an uppercase `OPEN` cite run
reddens; an `OPEN` run naming only #2843/#2848 passes clean. Deleting the owed-work clauses removes the
occasion for either. The guard remains live for any future author tempted to re-add one.

**Two flags in this card are already closed — do not re-fix them.**

- The `at accept` round-token is **gone**: grep `we:docs/agent/platform-decisions.md` for `at accept` and it
  returns nothing. #2842's edit removed the remaining instances, not just `:3422`.
- The uppercase `OPEN` framing is **gone** from all four sentences: they now read "filed against #2840/#2785,
  both since resolved without carrying them". So #2842's pattern C is not currently firing on them — but it
  **will** fire if a re-point reintroduces an uppercase `OPEN` governing a cite run that includes #2844.

**Why sentence 5 is safe to edit but is not gated.** `validateCitedItemStatusClaims`
(`we:scripts/lib/validate-rules-anchors.cjs:444-473`) iterates `srcByDoc`, which is built from `RULE_DOCS`
(`we:scripts/lib/rules-loader.cjs:29-34`) — the four `docs/agent/` files only. It never reads `backlog/*.md`.
That is why #2851's body still asserts "#2840 … and #2785 …, both `status: open`" with a green gate, and why
correcting it is this item's job rather than a gate's.

**Routing.** This edits statute rule-text, so the PR is a `review:human` park by
`#human-is-principle-surface-not-path` trigger 1 and must carry **no** enforcement code — the #2849 widening
below is a separate impl PR under `#principle-and-impl-two-pr`.

## Done when

- **No tier-1 criterion is possible for this item, and here is why.** The whole change is prose repointing
  inside a statute document: it alters no behaviour, no data shape and no code path, so there is no command
  that is red before and green after. The nearest executable proof — a lint that would have *caught* the
  wrong pointer — is #2849's bidirectional widening, which is a different item and a different PR (the
  two-PR rule above forbids shipping it here). Criteria 1–4 below are therefore tier-2 and tier-3.

1. **Observable — no sentence still defers to this item.** One grep over
   `we:docs/agent/platform-decisions.md` for `pending #2853` returns nothing, and one grep for
   `#2853 re-points` returns nothing. Those two phrases are the complete set of placeholders this card
   installed.
2. **Observable — the owed-work narration is GONE from the anchors, not repointed.** In the two anchor bodies
   and their two Lineage lines (`we:docs/agent/platform-decisions.md`, lines 3442 / 3446 / 3460 / 3466), no
   build-status clause remains at all: greps for `still owed`, `Build-pending`, `outstanding prevention` and
   `not yet current fact` return nothing within those two anchors. Cites of #2840 / #2785 elsewhere in the
   document — genuine lineage, dependency or precedent framing — are untouched and must stay. This is the
   criterion that distinguishes conformance with #2854 from a third round of substitution.
3. **Observable — the gate is still green and no new status claim is false.** `npm run check:statute` and
   `npm run check:standards` both pass on the edited tree. This is a regression bar, not a before/after
   proof: they pass on `main` today, and the point is that a re-point which reintroduces an uppercase `OPEN`
   over #2844 would turn them red.
4. **Assertable — #2851's body names its real owner and its status claim is true.**
   `we:backlog/2851-…md` no longer says the enforcement lands under the #2840/#2785 line; it says epic
   **#2822**, and it no longer asserts either item is `status: open` (both are `resolved`). Read the paragraph
   immediately above the `B1 → filed #2842` bullet list.
5. **Assertable — nothing true was lost in the deletion.** The facts removed from the anchors are still
   findable: the reviewer-id / self-clear enforcement reads `"status": "enforced"` in
   `we:scripts/lib/invariant-catalogue.json` (`review.land-seam-refuses-self-cleared-verdict`, whose `anchor`
   field back-links to the anchor), and the remaining owed guards are `#2843` and `#2848`, both `open` on the
   board. Check those two places; deletion is only correct because the tracking already exists elsewhere.
6. **Assertable — the ruling is cited, not re-derived.** The PR body (and the anchors' own Lineage, if it
   changes) cites `#statute-anchor-states-rule-not-status` (#2854) as the authority for removing the prose, so
   a future reader sees why the status disappeared rather than reading it as an accidental drop.

## Prevention

Widen **#2849** (the temporal/owed-work statute lint) from a status test to a **bidirectional** one: an owed-work
sentence must cite a non-resolved item **whose own body cites this anchor id or the described mechanism**. As #2849
is specified today ("must name the OPEN item"), the #982 diff passes it — #2840 and #2785 are open, just not the
owners. Without the back-link clause the guard does not close this class.

## Provenance

Round-3 finding **R1** from the human `/review` on **PR #982**, raised independently by the correctness and
standards-conformance lenses and verified against `main`. Accepted over at ratification and filed here. Fourth
instance of the defect class that recurred through all four review rounds — a confident claim about another item,
written without opening it. Related: #2849, #2843, #2844, #2848.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion ahead of the build) — The card exhaustively re-verifies backlog item statuses (#2843/#2844/#2848/#2842/#2849/#2785/#2840/#2851, all confirmed accurate) but never checks for a newer RATIFIED statute rule governing the shape of the prose it edits. we:backlog/2854-does-point-in-time-build-status-belong-in-a-statute-anchor-o.md (status: resolved, ratified 2026-08-17, codified as we:docs/agent/platform-decisions.md#statute-anchor-states-rule-not-status) explicitly REJECTS narrating point-in-time build status inside an anchor body (shape (b), PR #982's pattern) in favor of moving it to the backlog item / we:scripts/lib/invariant-catalogue.json (shape (a)). #2854 even names #2853 by number as evidence the shape-(b) pattern decays, but the card shows no awareness of #2854 and proceeds to keep shape (b), just with corrected item numbers.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Card's claimed set of 4 owed-work sentences in we:docs/agent/platform-decisions.md is exactly complete — confirmed via a full-file grep for 'owed'/#2840/#2785, which found no missed instances and correctly excludes genuine lineage/dependency mentions (we:docs/agent/platform-decisions.md:3440, :3480, :3482) that the card's Done-when criterion 2 says must stay untouched.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Mutation-tested directly: calling validateCitedItemStatusClaims from we:scripts/lib/validate-rules-anchors.cjs with a synthetic line placing #2844 (resolved) under an uppercase OPEN cite-run reddens with pattern C; the card's recommended 'safe wording' (no OPEN framing around #2844) and an OPEN run naming only #2843/#2848 both pass clean. The gate underpinning the card's #2844-handling design decision is real, not decorative.

**Corrections recommended:**

- none — the preparation held up as written.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** The `premise` finding is correct and is the most consequential thing this
review produced — it changes the card's action, not just its wording. Verified: #2854 is `status: resolved`,
ratified 2026-08-17, codified at `we:docs/agent/platform-decisions.md#statute-anchor-states-rule-not-status`,
and its ruling text states build status belongs on the item and the open guards, never in the anchor body. Its
evidence section names this card by number. Separately verified that
`we:scripts/lib/invariant-catalogue.json`'s `review.land-seam-refuses-self-cleared-verdict` reads
`"status": "enforced"` and back-links to the very anchor whose prose still says that enforcement is owed — so
the clause being removed is **false**, not merely mis-cited.

The card is rewritten accordingly: a *SUPERSEDED APPROACH* section leads, the action table says **DELETE** for
the four anchor sentences and **CORRECT** only for the `we:backlog/2851-…md` line, the digest says so, and
Done-when #2 now demands the narration be *absent* rather than repointed — the criterion that distinguishes
conformance with #2854 from a third round of substitution. New criteria 5 and 6 require that nothing true was
lost (the catalogue and the two open guards still carry it) and that #2854 is cited as the authority for the
removal.

`decorative-guard` and `blast-radius` were both marked addressed and needed no change; the mutation result they
report (an `OPEN` run over #2844 reddens, over #2843/#2848 it passes) is folded into the *#2844 hazard*
paragraph.
