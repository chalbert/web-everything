# Backlog split analysis — #728 (component embedding capability)

**Date:** 2026-06-15 · **Focus:** `/slice 728` (single unsliced epic) · **Verdict:** could **not** split into a
≥2-slice batchable set today — but **one inline fork must be de-buried** into its own `type:decision`
child.

[#728](../backlog/728-component-embedding-capability-embed-a-live-component-exampl.md) is an unsliced epic
(`workItem: epic`, `size: 13`, no child names it as `parent` — confirmed by tree scan). As an epic it
skips the should-we-decompose question; the test is only whether ≥2 agent-ready slices fall out of the
**real tree** (not the body's framing).

## Work-investigation pass — what actually exists

- **v1 is already shipped.** The iframe mechanism (`fuiDemo`) is built and resolved under
  [#701](../backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo.md):
  `we:.eleventy.js:38` defines the `fuiDemo` Eleventy shortcode (sandboxed, lazy, FUI-branded `<iframe>` at
  `FUI_DEMO_BASE`), with CSS in `we:src/css/style.css` (`.fui-demo*`). There is **no v1 build slice left to
  carve** — the epic's "v1 = iframe" section describes shipped code.
- **One consumer, no second.** Only `we:src/_includes/block-descriptions/component.njk:235` calls
  `{% fuiDemo … %}`. Tree-wide grep for a third-party-embed surface (`oembed`, `youtube`) and for any
  other `addShortcode(...)` embed primitive → **none**. The body's "many use cases (YouTube/Facebook-style
  third-party embeds)" axis has **zero consumers in the tree**.
- **The per-block rollout is not this epic's.** Embedding `fuiDemo` across the ~21 block pages is the
  *consumer* work, owned by [#604](../backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac.md)
  (ruled in [#707](../backlog/707-reconcile-604-s-we-renders-real-fui-blocks-framing-with-the-.md)).
  #728 is the *mechanism*; the rollout cannot be borrowed as a #728 slice.
- **The DI-mount path is explicitly out of scope.** Per #728 §Future and the #707 ruling, every non-iframe
  mechanism needs FUI code in WE's runtime — the cross-repo import seam #700 (DC-7) ruled out. It is gated
  on **reopening #700**, an unresolved external decision.

## Could split

*(none — see rubric failures below)*

The single genuinely-ready piece is the **overlay/modal escape** question — but it is itself an
**unresolved fork** (oversized/auto-resizing frame · `postMessage`-to-parent overlay protocol · defer to
DI-mount). You cannot split a *build* slice away from a fork (rubric 1), so it is not a batchable slice —
it is a **decision card**. With every other candidate premature or out-of-scope, no ≥2-slice batchable
set exists.

## Could not split

| Candidate (from body) | Failing rubric condition | Unblocking action |
|---|---|---|
| **Generic embed primitive** ("reusable embed component generalised beyond `fuiDemo`") | (2)/(3) no real home — one consumer (`we:component.njk:235`), no second; abstraction with no forcing consumer = premature, fake agent-ready work | Lands when a **real second embed consumer** appears (a marketing/protocol page, or the third-party case below) — then refactor `fuiDemo` into a generic primitive + FUI-branded wrapper |
| **Per-use-case third-party adapter** (YouTube/Facebook-style `<iframe>` + oEmbed) | (2)/(3) no consumer surface in the tree (zero `oembed`/`youtube` references) | File only when a docs/marketing page actually needs a third-party embed |
| **DI / Shadow-DOM component mount** (v2) | (5)/(1) gated on an unresolved external decision — needs the cross-repo import seam **#700 ruled out** | **Reopen #700** (the cross-repo-import ruling); out of scope until then |
| **Overlay/modal escape** (oversized frame · postMessage · defer-to-DI) | (1) it *is* a fork — you can't split a build slice away from it | **File it as a `type:decision` card** (below) — the post-decision build slice becomes carve-able once it rules |

## Mandated move regardless of the split verdict — de-bury the fork

#728 §"Known limitation — overlay/modal components" is an **inline fork** living in the epic body
("Investigate (a slice): an oversized/auto-resizing frame, a `postMessage`-to-parent protocol …, or
deferring … to the DI-mount path"). Per the backlog workflow and
`[[feedback_decisions_are_workitems_not_plan_mode]]`, a fork must live in its own card, not as a "a slice
investigates …" line in a parent. This is correct independent of the ≥2-slice split test.

**Recommended single carve (one child, not a multi-split):**

- **#NNN — Overlay/modal escape for embedded demos** · `type:decision`, `workItem:story`, `size:2`,
  `parent:728`. Forks: (A) oversized/auto-resizing iframe; (B) `postMessage`-to-parent overlay protocol
  (host renders the overlay); (C) defer overlay-heavy components to the DI-mount path (#700-gated).
  Deliverable: a `/research/` topic + ruling. Replaces the inline fork in #728's body with a pointer.

This flips #728 to a sliced umbrella (drop its `size:13`) and gives the one ready question a real home.
Everything else stays as documented future scope with the explicit unblocking actions above — **not**
manufactured as premature build slices.

## DAG

```
#728 (epic, umbrella)
└── #NNN  overlay/modal escape  (decision, size 2)   ← the only ready child
        ⋯ post-ruling build slice           → carve-able after #NNN rules
        ⋯ generic embed primitive            → carve-able when a 2nd consumer exists
        ⋯ DI/Shadow-DOM mount                → carve-able only if #700 reopens
```
