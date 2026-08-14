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
work in scope. Repoint each sentence at the item that actually owns it.

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
