# Backlog split analysis — #1255 FUI-convergence umbrella

**Date:** 2026-06-20
**Candidate:** [#1255](../backlog/1255-fui-convergence-umbrella-coordinating-the-scattered-we-front.md) — FUI convergence umbrella (kind: epic, unsliced)
**Verdict:** **Could not split into new child slices** — decomposition already exists by-reference. One buried structural fork de-buried into its own decision card (now unblocked).

## What #1255 is

A *roadmap coordination epic* ("epic of epics"): a deliberately **by-reference** lens over seven sibling
convergence epics. Its body is explicit that it "coordinates the facet epics **by reference rather than
re-parenting them**." The facets:

| Facet | kind | status |
|-------|------|--------|
| [#746](../backlog/746-block-explorer-interactive-fui-block-workbench.md) Block Explorer | epic | open |
| [#170](../backlog/170-plugs-duplicated-across-webeverything-frontierui.md) plugs runtime duplicated/drifting | epic | open (child #1250 open) |
| [#777](../backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit.md) dogfood WE-docs on FUI | epic | open (child #934 ✓) |
| [#728](../backlog/728-component-embedding-capability-embed-a-live-component-exampl.md) component embedding | epic | open |
| #904 block-impl backfill | epic | resolved |
| #658 promote @frontierui/blocks canonical | — | resolved |

## Why it does not split (work-investigation pass)

Verified against the tree (frontmatter scan of all six facets + #487 + #1250): the umbrella's natural
children **already exist as independent open epics** (#746/#170/#777/#728). There is **no undone scope
inside #1255 itself** to carve. Scaffolding child slices would *duplicate* those existing epics — the
"needless split fragments a coherent deliverable" failure the rubric guards against.

**Rubric outcome:** fails *"each slice is a new, independently-deliverable unit"* — there are no new
units; the deliverables are the pre-existing facet epics. A roadmap epic-of-epics whose sub-epics already
exist yields a **could-not-split**, not a fan-out.

## The one actionable seam — now unblocked

#1255 carried an inline **Open structural decision (deferred)**: *re-parent the facet epics under the
umbrella (true `parent:` edges)* **vs** *keep the by-reference map*. It was deferred "until the **#487**
`kind`-axis migration settles, since epic-under-epic parenting interacts with the burndown/sizing rules."

**#487 resolved 2026-06-20 (today).** The deferral is lifted. Per the split rubric, a buried fork is
**de-buried into its own `kind: decision` card** (filed below) — never auto-executed inside a split, since
re-parent-vs-by-reference is a genuine fork that interacts with burndown/sizing.

- **Filed:** decision card (re-parent vs by-reference), `parent: 1255`, no longer blocked (#487 done).
- **De-buried:** #1255's inline "Open structural decision" section replaced with a pointer to the card.

## Could-not-split table

| Candidate | Failing rubric condition | Unblocking action |
|-----------|--------------------------|-------------------|
| #1255 → new child slices | No new independently-deliverable unit (children already exist as facet epics) | None — already decomposed; not splittable, by design |
| #1255 re-parent edges | Blocked on a genuine structural fork (re-parent vs by-reference) | **Resolve the decision card** (now unblocked by #487) — then, if re-parent wins, lay `parent: 1255` edges on the existing facets |

## Deferred carve (not now)

The **standing drift-guard** (the perpetual gate that keeps the single-sourced runtime from re-drifting)
is a front-A *ongoing* candidate. Per #1255's DoD it is carved **at resolve-time**, not now — and it is
blocked by #170 single-sourcing the runtime first. Filing it today would enter a falsely-ready item.

## Net effect

No slices scaffolded. One decision card filed; one buried fork de-buried. #1255 stays `active`/epic
(scope unchanged — it remains the by-reference umbrella until the decision rules otherwise).
