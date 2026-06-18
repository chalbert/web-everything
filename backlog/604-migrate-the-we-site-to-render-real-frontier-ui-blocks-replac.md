---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-14"
dateResolved: "2026-06-16"
graduatedTo: none
tags: [frontier-ui, dogfooding, blocks, demos, site, embedding, conformance]
crossRef: { url: /backlog/728-component-embedding-capability-embed-a-live-component-exampl/, label: "#728 — embed mechanism this epic consumes" }
relatedProject: webdocs
---

# Embed a live FUI-hosted demo on every WE block page (iframe v1, next to the code sample)

> **Realigned 2026-06-15 by [#707](/backlog/707-reconcile-604-s-we-renders-real-fui-blocks-framing-with-the-/).**
> This epic was authored 2026-06-14 as *"migrate the WE site to render the real FUI block composition"* —
> WE importing/running `frontierui/blocks/*`. One day later the **docs-rendering boundary** ([#700](/backlog/700-component-converter-playground-placement/)
> DC-7 → [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/) → [#705](/backlog/705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the/))
> ruled WE never imports or renders FUI code; it only **embeds** a FUI-hosted demo through an iframe.
> #707 realigned this epic accordingly: the deliverable is now "embed a live FUI demo next to each block's
> code sample," the mechanism is the [#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/)
> embed capability at **v1 = iframe** (`fuiDemo`), `blockedBy: ["170"]` is dropped, and the old "import
> the `@frontierui` surface" fork is struck. Read the body through that lens.

Today the WE docs site **describes** blocks but never shows one **running**: block pages (`/blocks/{id}/`)
show static code samples and the `/demos/*` playgrounds are self-contained harnesses. This epic closes that
gap the way the boundary allows: every block page gains a **live, interactive FUI-hosted demo embedded via
an iframe** (`fuiDemo`, `we:.eleventy.js:38`), next to the code sample — as `we:component.njk:235` already does
for the converter. WE never imports FUI code; it points an iframe at FUI's own demo surface (FUI keeps
branding/provenance). The embed *mechanism* is owned by [#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/);
this epic is the WE-block-page *application* of it at v1 = iframe.

## Why

- **The demo loads next to the spec.** A reader sees the real component working alongside the standard's
  prose and code sample — the highest-fidelity docs experience the boundary permits, without WE taking on
  any FUI runtime.
- **No drift surface, no cross-repo import.** The demo is the FUI-hosted one (a single source on FUI's
  side); WE embeds it. Nothing to vendor, no `@frontierui` import into WE, fully consistent with #700.
- **The stronger "page breaks when the impl breaks" conformance signal lives on FUI's own derived
  catalog** ([#705](/backlog/705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the/)), because
  that is where the impl actually runs. WE's contribution is co-location of a live demo with the spec —
  complementary, not a second rendering of the impl.

## Current state (from a 2026-06-14 survey, reframed for the iframe boundary)

- **Block pages** — `we:src/block-pages.njk` paginates `fui:src/_data/blocks.json`, pulling prose + code samples
  from `src/_includes/block-descriptions/{id}.njk`. **No running component**; examples are read-only code.
  Since `we:src/block-pages.njk:35` includes `block-descriptions/{id}.njk`, any block page can host a demo by
  adding one `{% fuiDemo … %}` line to its description partial.
- **The mechanism already exists.** The `fuiDemo` shortcode (`we:.eleventy.js:38`) renders a sandboxed,
  FUI-branded iframe to `FUI_DEMO_BASE`; `we:component.njk:235` already calls it. Rolling it out is *extending
  a working pattern*, not building a seam.
- **No import seam to FUI exists, by design.** `vite.config.mts` aliases only `@core`/`@web*` → `/plugs/*`
  (no `frontierui` alias); WE cannot resolve FUI block source, which is exactly the boundary #700 set.

## Prerequisites / relations

- **[#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/) — embed capability
  (related, not a hard blocker).** Owns the embed *mechanism* (iframe v1 → alternatives → DI-mount future).
  v1 = `fuiDemo` already ships, so this epic can proceed now; overlay/modal-heavy blocks may soft-depend on
  #728's modal-alternatives investigation (see below).
- **Each block needs a FUI-hosted demo to exist.** The iframe points at a FUI demo URL — so a block whose
  demo FUI hasn't published yet is gated on that demo, not on any WE work. Coordinate per-block with FUI's
  own catalog ([#705](/backlog/705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the/)).
- **[#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/) — Web Docs product
  (related, not blocking).** The served-product surface; this epic is the WE-site consumer.
- **~~#170 plugs consolidation~~ — no longer a blocker.** It was a prerequisite *for importing FUI code
  through one runtime*; an iframe embeds a FUI-served demo (FUI's own vite + plugs) with no shared WE↔FUI
  runtime, so #170 is irrelevant here. Dropped from `blockedBy` per #707.

## Known limitation — overlay/modal components

An iframe clips to its box, so a block whose demo opens a **modal/popover/toast meant to cover the page**
shows it only inside the frame. Acceptable for most blocks; for overlay-heavy ones the fix lives in #728's
alternatives investigation (oversized frame · `postMessage`-to-parent overlay · the DI-mount future). The
iframe v1 ships for the rest regardless.

## Settled by #707 (were open forks)

- **In-page, not linked.** The demo embeds *inside* `/blocks/{id}/` next to the sample (the `fuiDemo`
  in-page pattern), not a click away to `/demos/`.
- **Consumed as an embedded FUI-hosted demo, never imported.** The old "import the `@frontierui` package
  surface vs. source-composition" fork is **struck** — #700 ruled out import.
- **Serve model.** The iframe targets FUI's own served demo surface (`FUI_DEMO_BASE`); no bootstrap
  injection into block pages, no static-HTML generation needed.

## Coverage floor — settled by the slice investigation (2026-06-15)

The "representative set vs. every block?" question is **answered by the external constraint, not an open
fork**: the iframe targets a FUI-hosted demo, and only ~7 of 71 blocks have one today (the rest are gated
on FUI publishing demos — #705/#398, not WE work). So the floor is **"a representative set across the
blocks whose FUI demo already exists; full rollout is demand-driven as FUI demos land."** The POC repoints
off the body's `/blocks/dropdown/` (no FUI demo) onto **`/blocks/autocomplete/`** — `fui:autocomplete-unplugged.html`
is FUI's *"<auto-complete> — droplist demo"*, a droplist-family member. See
[we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md) (`/slice 604`).

## Acceptance (epic-level — delivered across child slices)

- [x] At least one block page (recommend `/blocks/dropdown/` → FUI droplist demo) embeds a **live,
      interactive FUI-hosted demo via `fuiDemo`**, next to the existing code sample.
- [x] The demo is the FUI-hosted one (FUI branding/provenance visible), embedded by iframe — **no FUI
      block code imported into WE**.
- [x] Block pages keep the **static code sample AND** gain the **live embedded demo** (fidelity is additive).
- [x] A repeatable pattern + per-block metadata (which FUI demo URL maps to which block) so remaining
      blocks roll out as follow-on child stories.
- [x] Overlay/modal-heavy blocks are either covered or explicitly deferred to #728's alternatives slice.

## Slicing note

**Sliced 2026-06-15 (`/slice 604`)** — size dropped; this is now a size-less umbrella. Two WE-authorable
child slices were carved (A → B): a POC + repeatable pattern + demo-mapping metadata story (`/blocks/autocomplete/`),
then a rollout story across the other blocks whose FUI demo already exists. Full coverage of the ~60
demo-less blocks stays external-gated (#705/#398, demand-driven); overlay/modal-heavy blocks stay deferred
to #728. See [we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md).
