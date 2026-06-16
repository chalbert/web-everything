---
type: decision
workItem: story
size: 3
status: resolved
relatedReport: reports/2026-06-16-we-demos-blocks-deletion-boundary-reconciliation.md
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-16"
tags: [blocks, demos, boundary, reconciliation, constellation]
---

# Reconcile #658/#697 delete-and-repoint with the #604 iframe boundary: what happens to WE's demos that import blocks/

**Resolved 2026-06-16 — ratified Fork 1 = C, Fork 2 = principled rule (see Ruling below).**

## Ruling (2026-06-16)

- **Fork 1 — end-state: C.** Migrate block-impl demos to FUI; WE keeps **only**
  standard/reference-runtime demos; WE docs **iframe-embed** the FUI-hosted ones. **Zero WE→FUI
  import** — no `frontierui` vite alias is added, `@frontierui/blocks` never enters WE's
  `node_modules`. A (dev-only import) and B (keep a `blocks/` copy as substrate) rejected: A
  reintroduces the WE→FUI import seam #700/#701/#705/#707 struck 4×; B re-opens #641's resolved
  blocks=application-impl classification and the #170 drift hazard #658 set out to kill. The
  red-team (A's "the boundary binds only published artifacts + the rendered site, not dev harnesses")
  fails: #707 *struck #604's import fork outright* and #765's relax is "runtime SDK only — never the
  #700 source import", so there is no sanctioned WE→FUI source import at any tier.
- **Fork 2 — partition: the principled reference-vs-impl rule** (not a hand-curated list):
  > A block **stays in WE** (a small reference-runtime `blocks/` subset, #606-class) **iff its demo
  > exists to exercise a WE *standard*** (the block is that standard's reference runtime). A
  > **block-impl demo** — one whose subject is the block itself, i.e. one of the **9 WE-only impl
  > families already migrated UP** by #694/#695/#696 (`audit`, `background-task-surface`, `data-grid`,
  > `lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`, `type-ahead`) — **moves to
  > FUI** and WE shows it via the embed SDK (iframe → #765 in-document).

  Concrete keepers today: `stores/simple` (declarative-spa), `renderers/jsx` (jsx-*), `view`+`tabs`
  (custom-events). The finalized keep-list is the **output of applying the rule** during the #697
  re-slice, not part of this decision.
- **Consumption mechanism = settled (not a fork):** runtime federation via the FUI embed SDK
  (iframe now → #765 in-document later); never a pinned `@frontierui/blocks` install in WE. Agrees
  with #604/#707 and #765.
- **Amendment to #641 Fork 2-A** (noted on #641): C **refines** "WE deletes its vendored `blocks/`
  and consumes as a #604 *import* client" → WE deletes the **impl** families, **retains the
  reference-runtime subset**, and consumes via **iframe embed (no import)**, per the #707 boundary.
- **#697 re-scoped:** drop the #791 block; the "repoint every WE `blocks/…` import →
  @frontierui/blocks" premise is struck (it was the forbidden import seam); S3 re-slices under #658
  as "delete impl families + migrate their demos to FUI embeds; retain the reference-runtime subset".

**This is a ratify-existing-internal-ground decision, not greenfield** — so there is no `/research/`
topic: the prior art is prior *constellation rulings* (#641, #604/#707, #606, #765), not external
ecosystem patterns (same posture as the [#604 iframe-boundary reconciliation](../reports/2026-06-15-604-iframe-boundary-reconciliation.md),
which #707 used — see *Why no research topic* in the [relatedReport](../reports/2026-06-16-we-demos-blocks-deletion-boundary-reconciliation.md)).
Two forks reach the decider at the Definition of Ready, each with a **bold** recommended default
grounded in the real tree: **Fork 1** (the end-state — **C**) and **Fork 2** (how to partition — a
**principled rule**, not a curated list). The consumption mechanism is *not* a fork — it was settled
twice (#604+#765); see *Supported by default*. Full grounding sits below the `## Context` divider.

## The axis it decomposes into

`#641 Fork 2-A` (resolved 2026-06-15) and the `#700→#707` docs-rendering boundary (resolved
2026-06-15/16) collide on **one** load-bearing question: *may WE's code import `@frontierui/blocks`?*
#641 said yes ("the site/demos consuming `@frontierui/blocks` is the already-ratified #604 seam");
#707 then **struck** that seam ("WE never imports or renders FUI block code; it only embeds
FUI-hosted demos through an iframe"). Neither ruling actually settled WE's **dev demo harnesses** after
the vendored `blocks/` is deleted. That gap factors cleanly into two orthogonal axes:

- **Axis 1 — the end-state for the 41 demo files that import `/blocks/…` today** (`grep -rlE "blocks/"
  demos/` → 41 on 2026-06-16, incl. `demos/declarative-spa.html`, `demos/jsx-adapter-demo.tsx`,
  `demos/view-tabs-demo.html`, `demos/data-grid-demo.ts`, and the `loan-origination/` + `auto-insurance/`
  exercise apps). #697 deletes WE's vendored copies and repoints every import to `@frontierui/blocks` —
  and that repoint **is** the WE→FUI import seam the boundary forbids. There is **no `frontierui` alias**
  in [vite.config.mts:167-179](../vite.config.mts#L167-L179) (only `@core`/`@web*` → `/plugs/*`), so WE
  cannot resolve FUI block source today, by design — A would have to *add* one.
- **Axis 2 — if the end-state retains a `blocks/` subset in WE, how is the keep-list decided** — a
  *principled reference-vs-impl rule* vs a *hand-curated retention list*. The keepers visible today are
  reference runtimes for WE standards: [blocks/stores/simple](../blocks/stores/simple) (declarative-spa),
  [blocks/renderers/jsx](../blocks/renderers/jsx) (jsx-*), [blocks/view](../blocks/view) +
  [blocks/tabs](../blocks/tabs) (custom-events). The impl families already migrated UP are the 9 of
  #694/#695/#696 ([/backlog/694](/backlog/694-migrate-the-6-single-file-we-only-block-families-up-to-front/)
  `graduatedTo: …/blocks/{audit,lifecycle,master-detail,selection,stepper,tree-select}` + #695
  `background-task-surface` + #696 `data-grid`,`type-ahead`).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|---------------------|------------------|------------|
| **1 — End-state** | **C** — migrate block-impl demos to FUI; WE keeps only standard/reference-runtime demos; WE docs iframe-embed the FUI-hosted ones (zero WE→FUI import) | A (dev-only import of `@frontierui/blocks`) · B (keep a `blocks/` copy as substrate) | **High** — A reintroduces a seam the boundary reaffirmed 4×; B re-opens #641's resolved classification |
| **2 — Partition mechanism** | **Principled reference-vs-impl rule** (reference-runtime-stays / impl-demo-moves) | Hand-curated retention list finalized per-demo | **Med-high** — the rule is mechanical; the residual is finalizing the keep-list against it during the #697 re-slice |

## Fork 1 — the end-state

**Crux:** what becomes of the 41 `/demos/*` that import `/blocks/…` once #697 deletes WE's vendored
copies, given the boundary forbids WE→FUI imports. Three coherent end-states:

- **A — demos MAY import `@frontierui/blocks` dev-only; the boundary binds only published
  `@webeverything/*` + the rendered site.** Literally what #641 Fork 2-A ratified: a dev vite alias
  resolves `@frontierui/blocks` for `/demos/*`+tests, public `/blocks/{id}/` pages still iframe.
  *Rejected* — reintroduces the exact WE→FUI import seam #700/#701/#705/#707 said does not and should
  not exist; a standing cross-repo dev-coupling + drift surface; in tension with the spirit of
  the npm-scope-mirrors-layer principle (#239). And it **is** the pinned-dep / reinstall-on-FUI-change mechanism
  that #604 *and* #765 both reject in favour of runtime federation (see *Supported by default*) — so
  federation doesn't open A, it removes it more firmly.
- **B — WE keeps a `blocks/` copy as its reference-runtime demo substrate (don't delete).** *Rejected* —
  contradicts #641 Fork 2-A's "WE deletes its byte-identical vendored `blocks/`"; resurrects the #170
  drift hazard #658 set out to kill; re-opens the settled blocks=application-impl classification.
- **C — migrate block-impl demos to FUI; WE keeps only standard/reference-runtime demos; WE docs
  iframe-embed the FUI-hosted ones.** **← recommended default.** The only end-state with **zero**
  WE→FUI import, so it needs no carve-out from the docs-rendering boundary and keeps constellation
  layering exact (impl runs where impl lives, #705); deletes vendored `blocks/` cleanly via the
  [fuiDemo](../.eleventy.js#L38) embed (already used on block pages). Cost: largest scope,
  partition-dependent — handled by Fork 2.

**Red-team note for the decider:** A's strongest case is "the boundary text binds *published artifacts +
rendered site*, and dev harnesses are neither" — exactly #641's reading. The default survives it because
#707 didn't merely scope the boundary, it *struck #604's import fork outright*, and #765's relax for
in-document mount is explicitly "runtime SDK only — never the #700 source import"; so there is no
sanctioned WE→FUI source import at *any* tier, dev or prod. C honours that without exception.

## Fork 2 — how to partition reference-runtime (stays) from block-impl (moves)

**Crux:** C retains a small `blocks/` subset; deciding *which* blocks stay must not become an ad-hoc
carve-out (or it quietly re-opens B). Two ways:

- **A principled rule.** **← recommended default.**
  > A block **stays in WE** (a small reference-runtime `blocks/` subset, #606-class) **iff its demo
  > exists to exercise a WE *standard*** — the block is the reference runtime for that standard. A
  > **block-impl demo** — one whose subject is the block itself, i.e. one of the **9 WE-only impl
  > families already migrated UP** by #694/#695/#696 (`audit`, `background-task-surface`, `data-grid`,
  > `lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`, `type-ahead`) — **moves to FUI**
  > and WE shows it via the embed SDK (iframe → #765 in-document).

  This is mechanical for #697 to apply and makes the retained subset *principled* (reference runtime,
  exactly like `plugs/` under #606), so it does **not** contradict #641 Fork 2-A's "delete vendored
  `blocks/`" — it deletes the **impl** families and retains only the **reference-runtime** ones standards
  demos need. Concrete keepers today: `stores/simple`, `renderers/jsx`, `view`+`tabs`.
- **A hand-curated retention list.** *Rejected* — an ad-hoc keep-list is exactly the carve-out
  bias-to-separation and #606 warn against; it re-opens the classification per-demo with no invariant,
  reading as B-by-the-back-door. (The *finalized* keep-list is still produced — but as the **output of
  applying the rule** during the #697 re-slice, not as the decision.)

## Supported by default (not decisions)

- **Consumption mechanism = runtime federation via the FUI embed SDK** (iframe now → #765 in-document
  runtime-SDK later), **never a pinned `@frontierui/blocks` install in WE.** Settled twice: #604/#707
  (iframe page-embed, no WE-side install) and #765 (future in-document mode C, "runtime SDK only — never
  the #700 source import"). Consequence: `@frontierui/blocks` (#693) is FUI's internal build/publish
  artifact — FUI's own SDK consumes it; **WE never installs it**, it never enters WE's `node_modules`.
  This is not a fork (both prior rulings agree); it is recorded here so the decider doesn't re-open it.

---

## Context

### The contradiction (load-bearing)

- **#641 Fork 2-A (resolved 2026-06-15):** *"'WE imports nothing from FU' binds published
  `@webeverything/*` artifacts, **not the docs site**, so the **site/demos consuming
  `@frontierui/blocks` is the already-ratified #604 seam**."* → import **allowed**.
- **#700/#701/#705/#707 docs-rendering boundary (resolved 2026-06-15/16):** *"WE never imports or
  renders FUI block code; it only **embeds** FUI-hosted demos through an iframe."* #707 **struck**
  #604's "import the `@frontierui` package surface" fork. → import **forbidden**.

#641 leaned on "the already-ratified #604 seam"; #707 then redefined #604 so that seam no longer
exists. Neither decision settled what happens to WE's **dev demo harnesses** after the vendored
`blocks/` is deleted — the boundary rulings reasoned only about the rendered docs site; #641 assumed
the now-struck import seam. That gap is this fork.

### Why it bites inside #697

WE's `/demos/*` import `/blocks/...` as **live runtime today** — **41 files** (`grep -rlE "blocks/"
demos/`, 2026-06-16; the original "17" undercounted — it missed the `loan-origination/` +
`auto-insurance/` exercise apps and the `__fixtures__`/test surface). They import WE's **own vendored**
copies (which is why #707 could call them *"self-contained harnesses … none import the actual block
code from `frontierui/blocks/*`"*). #697 deletes those copies **and repoints every import to
`@frontierui/blocks`** — i.e. #697's "repoint" step **is** the WE→FUI import seam the boundary forbids.

### The wrinkle (the partition isn't clean)

WE's demos are not all "block-impl demos." Several exercise a WE **standard / reference runtime** and
merely *use* a block to do so: `declarative-spa` → `/blocks/stores/simple`; `jsx-*` →
`/blocks/renderers/jsx`; `view-tabs` → `/blocks/view`+`/blocks/tabs` (custom-events standard). #606
ruled `plugs/` is **reference impl that stays in WE**; #641 ruled `blocks/` is **application impl that
moves to FUI**. The demos straddle that line — a block needed to demonstrate a *standard* behaves like
reference runtime. So "which blocks are reference-runtime vs application-impl" is fuzzier than
#606/#641 assumed, and the demos are where it surfaces. **Fork 2's rule resolves exactly this wrinkle.**

### Sequencing

This decision **blocks the executable cutover #697** (S3 of epic #658). #697's own note —
*"re-/split S3 once #604 lands"* — anticipated this: #604 landed in a shape (#707, iframe boundary)
that contradicts #697's "repoint WE imports → @frontierui/blocks" premise. The decision here is "ratify
the end-state + the partition rule"; execution (per-demo migration + the finalized keep-list) then
re-slices under #658 against a coherent target.

## Decision done when

- [ ] End-state ratified (A / B / C) and the **partition rule** (reference-runtime-stays,
      impl-demo-moves) recorded — not a hand-curated list.
- [ ] Consumption mechanism recorded as **settled** (runtime federation via the FUI embed SDK,
      iframe → #765 in-document; never a pinned `@frontierui/blocks` install in WE).
- [ ] #697 re-scoped/`blockedBy` updated to match (drop #791; re-sliced under #658 if C).
- [ ] If the call diverges from #641 Fork 2-A's "delete + consume as import client", note the
      amendment on #641 so the constellation record stays consistent.
