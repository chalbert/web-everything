# Reconciling #658/#697's "delete WE's vendored `blocks/` + repoint imports" with the #604 iframe boundary

**Date:** 2026-06-16
**Context:** grounding for the decision item spun off from #697 (S3 of epic #658).
**Type:** internal ratification/reconciliation — no external prior art (same posture as
`we:reports/2026-06-15-604-iframe-boundary-reconciliation.md`, which #707 used).

## Why no web survey / `/research/` topic

This is a **ratify-existing-internal-ground** decision, not a greenfield design. There is no external
prior art to survey: the question is purely how two parallel constellation rulings (#641 Fork 2-A and
the #700→#707 docs-rendering boundary) should be reconciled inside #697. Per the prepare rubric, a
decision that only ratifies already-decided ground "skips the web survey but still needs the
concrete-refs check." So this report is the grounding artifact and the prior art is the prior rulings
(#641, #604/#707, #606, #765) — not a `we:researchTopics.json` entry. Same posture as
`we:reports/2026-06-15-604-iframe-boundary-reconciliation.md`, which #707 used.

## The contradiction, precisely

Two rulings made in parallel on 2026-06-15/16 now disagree on one load-bearing point:
**may WE's code import `@frontierui/blocks`?**

- **#641 Fork 2-A (resolved 2026-06-15)** ruled FUI owns canonical `@frontierui/blocks`, WE
  **deletes its byte-identical vendored `blocks/`**, and consumes `@frontierui/blocks` "as a #604
  client." Its explicit reasoning: *"'WE imports nothing from FU' binds published `@webeverything/*`
  artifacts, **not the docs site**, so the **site/demos consuming `@frontierui/blocks` is the
  already-ratified #604 seam.**"* → demos importing `@frontierui/blocks` is **allowed**.
- **#700 DC-7 → #701 → #705 → #707 (the docs-rendering boundary, resolved 2026-06-15/16)** ruled
  *"WE never imports or renders FUI block code; it only **embeds** FUI-hosted demos through an
  iframe."* #707 **struck** #604's "import the `@frontierui` package surface" fork outright. →
  WE importing `@frontierui/blocks` is **forbidden**.

#641 leaned on "the already-ratified #604 seam"; #707 then redefined #604 so that seam no longer
exists. The two were never reconciled — #705 even filed "the #604 reconciliation" as a flagged
finding, but that became #707 (site-only) and never touched #658/#697.

## Why it bites now (not before)

WE's `/demos/*` playgrounds import `/blocks/...` as **live runtime today** — 17 files
(`we:data-grid-demo.ts` → `/blocks/data-grid/DataGridBehavior`, `we:background-task-surface-demo.ts`,
`we:view-tabs-demo.html` → `/blocks/tabs`, `/blocks/view`, `we:declarative-spa.html` →
`/blocks/stores/simple`, `jsx-*` → `/blocks/renderers/jsx`, `reorderable-list`, `pagination`,
`data-table`, `wizard-flow`, `loader-background-handoff`, `module-as-a-service`, `code-upgrader`,
`mockup-to-standard`, `component-adapter`, `durable-tier-verification`, …). They import WE's **own
vendored** copies, which is why #707 could correctly call them *"self-contained harnesses … none
import the actual block code from `frontierui/blocks/*`."*

#697 = "delete WE's vendored `blocks/` **and repoint every WE `blocks/…` import** to
`@frontierui/blocks`." The moment the vendored copies are deleted, those 17 demos break unless they
import `@frontierui/blocks` — i.e. #697's "repoint" step **is** the very WE→FUI import seam the
boundary forbids. So #641 Fork 2-A (allowed) and #707 (forbidden) collide exactly inside #697.

The boundary rulings reasoned about the **rendered docs site** (running a FUI block instance on a
`/blocks/{id}/` page via a cross-repo vite alias) and never considered the **dev demo harnesses**;
#641 considered the demos but assumed the now-struck import seam. Neither decision actually settled
the demos-after-deletion question. That is the open fork.

## A wrinkle the partition exposes

WE's demos are **not** cleanly "block-impl demos." Some exercise a WE **standard / reference
runtime** and merely *use* a block to do so (`declarative-spa` uses `/blocks/stores/simple`;
`jsx-*` use `/blocks/renderers/jsx`; `view-tabs` uses `/blocks/view`+`/blocks/tabs` to demonstrate
the custom-events standard). #606 ruled `plugs/` is **reference impl that stays in WE** (demos
exercise the standard itself); #641 ruled `blocks/` is **application impl that moves to FUI**. The
demos straddle that line — several need a block to demonstrate a *standard*. So "which blocks are
reference-runtime vs application-impl" is not as crisp as #641/#606 assumed, and the demos are the
place that ambiguity surfaces.

## The three coherent end-states (merit, not cost)

- **A — Demos MAY import `@frontierui/blocks` (dev-only); the boundary binds only published
  `@webeverything/*` + the rendered docs site.** Literally what #641 Fork 2-A ratified. A dev vite
  alias resolves `@frontierui/blocks` for `/demos/*` and tests; the public `/blocks/{id}/` pages
  still use `fuiDemo` iframes (no import). *Against:* reintroduces the exact WE→FUI import seam
  #700/#707 said does not and should not exist; a standing cross-repo dev-coupling + drift surface;
  reads as a carve-out from a boundary the project keeps reaffirming; in tension with the spirit of
  [[npm-scope-mirrors-layer]] even if that binds published scope only.

- **B — WE keeps a `blocks/` copy as its reference-runtime demo substrate (don't delete).**
  Reframes the demo-needed blocks as reference impl (the #606 plugs analogue) that stays in WE.
  *Against:* directly contradicts #641 Fork 2-A's "WE deletes its byte-identical vendored
  `blocks/`"; reinstates the #170 drift hazard #658 set out to kill; re-opens the settled
  #606/#641 classification that blocks are application impl, not reference runtime. Only coherent
  if that classification was wrong for the demo-needed subset.

- **C — Demos that run block impl migrate to FUI; WE keeps only standard/reference-runtime demos;
  WE docs iframe-embed the FUI-hosted ones.** The boundary made absolute and the constellation kept
  pure: block impl runs where block impl lives (FUI owns impl + its rendered display, #705); WE
  holds standards + contracts + the `plugs/` reference runtime; WE deletes vendored `blocks/` with
  no WE→FUI import anywhere. *Against:* largest scope (partition + migrate ~17 demos cross-repo,
  some entangled per the wrinkle above); FUI must host each; loses WE's local block-conformance
  playground; the partition itself needs the reference-vs-impl line drawn (the wrinkle).

## Recommendation

**C is the most principled end-state** (best on merit, ignoring cost per the fork-not-prioritization
rule): it is the only option with **zero** WE→FUI import, so it needs no carve-out from the
docs-rendering boundary and keeps the constellation layering exact. A is a permanent exception to a
boundary the project has now reaffirmed four times (#700/#701/#705/#707); B re-opens a settled
classification and resurrects the drift hazard. The wrinkle (some demos demonstrate a *standard*
via a block) is handled inside C by the partition: standard-demos stay in WE and, where they need a
block, that need is itself evidence the block is reference-runtime (→ a scoped B-style retention for
exactly those, decided per-block) — i.e. C with a small, explicit reference-runtime carve-out is the
clean synthesis, not blanket A.

Because C is large and partition-dependent, the **decision** is "ratify the end-state + the
partition rule"; the **execution** (the per-demo migration + the residual reference-runtime
retention list) is then re-sliceable under #658 with a coherent target — which is exactly what
#697's own "re-/split S3 once #604 lands" anticipated.
