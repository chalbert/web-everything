---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-05-31"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [gap-analysis, project, intent, scroll, observation]
relatedReport: reports/2026-06-11-webscroll-project.md
preparedDate: "2026-06-11"
---

# Decide on Scroll/Observation project — `webscroll` (gap #7)

Gap #7 names a sprawling scroll surface — `IntersectionObserver`, scroll-driven animations (`animation-timeline`), CSS scroll-snap, virtualization, infinite scroll, `content-visibility`, scroll restoration — and asks one structural question: is "Scroll / Observation" a Web Everything **project**, a new **intent**, or neither? No design exists yet. The three forks below are grounded in a prior-art survey (IntersectionObserver, scroll-driven vs scroll-triggered animation, scroll-snap, `content-visibility`, `History.scrollRestoration`, `scrollend`), published as the [Scroll / Observation](/research/web-scroll-observation/) research topic. Each names a recommended default in **bold**.

The platform does **not** model "scroll" as one domain — it ships several independent primitives that merely share a scrollbar, each a distinct concern WE either already owns or should own as a small piece. The load-bearing seam is that `IntersectionObserver` is a *shared mechanism*, already used by three correctly-separated intents: Collection Operations' `advance:auto` sentinel ([we:intents.json:1622](../src/_data/intents.json#L1622), wired at [fui:blocks.json:2354](../src/_data/blocks.json#L2354)), Prefetch's `eagerness: viewport` ([we:intents.json:419](../src/_data/intents.json#L419), [fui:blocks.json:1484](../src/_data/blocks.json#L1484)), and visibility-gated trait activation ([we:traits.json:78](../src/_data/traits.json#L78), framed as the scripting analogue of `content-visibility:auto` at [we:traits.json:83](../src/_data/traits.json#L83)). Virtualization already lives in [Windowed Collection](/intents/windowed-collection/) ([we:intents.json:332](../src/_data/intents.json#L332)) above the native `content-visibility` floor; URL/scroll state already binds to the History API via Collection Ops' `urlSync` ([we:intents.json:1630](../src/_data/intents.json#L1630)). So the real question is not "project vs intent" but "decompose onto native seams, or coin a monolith?".

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · project vs intent vs decompose** | **decompose — no project, no monolith** | `webscroll` project *(rejected)* | **High** — no single provider-shaped problem |
| **2 · the shared IntersectionObserver mechanism** | extract a thin `viewport-presence` intent the 3 consumers compose | leave it triplicated | **Med-high** — DRY vs three copies |
| **3 · `advance:auto` ownership** | stays in Collection Operations; composes the trigger | move auto-advance to the scroll domain *(rejected)* | **High** — closes the dated seam |

## Fork 1 — Project vs intent vs decomposition (the headline call)

The survey shows IntersectionObserver is a *shared mechanism* used by three already-separated intents ([we:intents.json:1622](../src/_data/intents.json#L1622), [we:intents.json:419](../src/_data/intents.json#L419), [we:traits.json:78](../src/_data/traits.json#L78)), and every other scroll primitive already has a home (scroll-driven animation = motion; scroll-snap = carousel/layout; `content-visibility` + JS windowing = [Windowed Collection](/intents/windowed-collection/) at [we:intents.json:332](../src/_data/intents.json#L332); `History.scrollRestoration` = navigation; `scrollend` = raw event). A project is a top-level standard with one owner and a `/projects/` tile ([we:projects.json](../src/_data/projects.json)) — webpositioning qualified because anchoring is *one* coherent provider-shaped problem. "Scroll" is not.

- **(A) `webscroll` project.** A top-level standard owning the whole surface. Rejected — no single coherent provider-shaped problem; it would claw three correctly-separated intents into one home and duplicate Windowed Collection.
- **(B) One monolithic "scroll observation" intent.** Same fatal flaw at the intent layer — conflates fetch-more, prefetch, and activation under one UX label they don't share.
- **(C — recommended) Decompose; no new top-level entity.** Confirm each native primitive's existing/adjacent home; the only genuinely unowned reusable residue is the low-level "is-in-view trigger" — that is Fork 2.

**Default: (C) — close the gap as "no project, no monolith — already homed."**

## Fork 2 — The shared IntersectionObserver mechanism: extract `viewport-presence`, or leave it triplicated?

Three intents independently wire IntersectionObserver ([fui:blocks.json:1484](../src/_data/blocks.json#L1484), [fui:blocks.json:2354](../src/_data/blocks.json#L2354), [we:traits.json:81](../src/_data/traits.json#L81)) with the same `root`/`rootMargin`/`threshold` vocabulary.

- **(A — recommended) Extract a thin `viewport-presence` mechanism intent** owning only the observe-vocabulary (`root`, `rootMargin`, `threshold`, enter/leave) that the three consumers *compose* — as Collection Ops already composes Loader/Windowed Collection rather than re-implementing them. It does **not** own the UX decision (fetch vs prefetch vs activate); those stay where they are. Dissolves the "two homes for scroll-triggering" risk: trigger gets one home, intent stays three.
- **(B) Leave it triplicated.** Cheapest now; but a `rootMargin`-defaulting fix must land in three places and a fourth consumer copies it again.

**Default: (A)** — most-flexible default; the restriction (keeping it inline) is the regression.

## Fork 3 — The `advance:auto` seam: who owns it after decomposition?

**Seam to resolve (added 2026-06-03):** the Collection Operations `advance:auto` page trigger is an IntersectionObserver scroll-proximity concern ([we:intents.json:1622](../src/_data/intents.json#L1622), wired at [fui:blocks.json:2354](../src/_data/blocks.json#L2354)). Decide whether it stays owned by `collection-operations` or delegates to this domain — it overlaps directly with the infinite-scroll / IntersectionObserver surface above. See [pagination-windowed-collection-seam](/backlog/062-pagination-windowed-collection-seam/) and the 2026-06-03 pagination research report. Folds 1+2 answer it.

- **(A — recommended) `advance:auto` stays a Collection Operations dimension; only the *trigger* delegates to `viewport-presence`.** The *intent* ("scroll to the boundary → fetch the next slice") is a pagination UX decision and stays put — infinite scroll = `append + auto`, a derived opt-in already correctly modeled. The shared observe-mechanism moves to Fork 2's intent; the dimension does not move. No two homes: trigger has one, semantics has one.
- **(B) Move auto-advance to the scroll domain.** Rejected — splits pagination across two homes and re-opens the "infinite scroll is a third mode" confusion the intent explicitly closed.

**Default: (A)** — resolves the dated seam.

## Resolution — ratified 2026-06-11

- **Fork 1 — (C) decompose; no project, no monolith**: "scroll" is not one provider-shaped problem — every native primitive already has a home (motion, carousel/layout, Windowed Collection, navigation, raw event), so a top-level entity would only claw three correctly-separated intents into one place and duplicate Windowed Collection. Close the gap as "already homed."
- **Fork 2 — (A) extract a thin `viewport-presence` mechanism intent**: the three consumers triplicate the same `root`/`rootMargin`/`threshold` observe-vocabulary; extracting the trigger (not the UX decision) gives it one home while the consuming intents stay three, per the most-flexible-default / DRY bias.
- **Fork 3 — (A) `advance:auto` stays in Collection Operations; only the trigger delegates to `viewport-presence`**: scroll-to-boundary-→-fetch is a pagination UX decision (`append + auto`), so the dimension stays put while the shared observe-mechanism moves to Fork 2 — closing the dated seam without splitting pagination across two homes.

**Follow-on builds (not yet scaffolded):**

- Author `viewport-presence` mechanism intent (observe-vocabulary only: root/rootMargin/threshold/enter-leave) · intent / size 3 · blockedBy: none → #320
- Re-point Collection Ops `advance:auto`, Prefetch `eagerness:viewport`, and the visibility-gated trait to compose `viewport-presence` instead of inlining IntersectionObserver · build / size 3 · blockedBy: the `viewport-presence` intent above (#320) → #321
