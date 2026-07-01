# #2028 — Persistent light-DOM base-element contract for the soft-7 leaves (prepared)

**Date:** 2026-07-01 · **Item:** [#2028](../backlog/2028-persistent-light-dom-base-element-contract-for-the-soft-7-pr.md)
· **Parent epic:** #2015 · **Blocks:** #1974 · **Status at report:** prepared (not ratified — no `preparedDate`).

This is the autonomous *prepare* pass: bring the fork to Definition-of-Ready for a later fast ratification. It
does **not** make the call.

## TL;DR

- #1962 already ratified the **policy** (soft-7 → light-DOM, no self-erasure) **and** the **shape** in its literal
  text — "emit their natural native tag **inside** a persistent, styleable, nameable host" = **wrap-child**. So the
  originally-framed fork **Q1 (host-styles-itself vs wrap-native-child) is NOT open** — host-styles-itself is
  statute-barred.
- The **one genuine open fork** is narrower and *inside* wrap-child: **does every soft-7 host carry
  `display:contents` (uniform), or only the box-breaking leaves — with inline `display:inline` hosts for badge/tag
  (minimal-node)?** Default: **(b) box-conditional**, tracking #1962's own "where a box would break flex/grid"
  and minimising the one still-broken Safari `display:contents` path for the role/heading leaves.
- **Q2 (where role/aria/naming/CEM land) is derived, not a fork.** Under wrap-child, role/aria land on the native
  child (where they already are today); the CEM documents the host in every branch.
- **Q3 (regression surface) is grounding, not a fork.** There are **zero** `.fui-badge >` / `querySelector('.fui-badge')`
  consumers in either repo; the change is node-count only, and wrap-child keeps `.fui-badge` on the same styled
  node `createBadge` uses today.

## Grounding (real code)

Soft-7 = **badge, tag, section-card, card, auto-heading, meter, progress** — all still extend the self-erasing
[fui:blocks/transient/TransientElement.ts:28-88](../../frontierui/blocks/transient/TransientElement.ts#L28-L88);
there is no persistent light-DOM base class in `fui:blocks/`.

**TransientElement behaviour** ([:53-76](../../frontierui/blocks/transient/TransientElement.ts#L53-L76)):
`connectedCallback` → `resolveTag()` → create the native element → transfer attrs (skipping `is`,
`data-transient-*`, subclass `excludedAttributes`) → `el.append(...this.childNodes)` → `decorate(el)` →
`queueMicrotask(() => this.replaceWith(el))`. The host self-deletes, leaving a **bare** native tag. Idempotent via
`#replaced`; **no `isConnected` guard** (a #1961 gap, owned by #2015, not #2028).

**Two non-symmetric DOM families among the soft-7:**

- **Bare-single-tag** — badge/tag emit a bare `<span class="fui-badge/…">`
  ([fui:blocks/badge/BadgeElement.ts:16-46](../../frontierui/blocks/badge/BadgeElement.ts#L16-L46),
  [fui:blocks/tag/TagElement.ts:34-77](../../frontierui/blocks/tag/TagElement.ts#L34-L77)); auto-heading a bare
  `<hN>` ([fui:blocks/transient/AutoHeading.ts:40-81](../../frontierui/blocks/transient/AutoHeading.ts#L40-L81));
  card/section-card a bare `<article>`/`<section class="fui-card">`
  ([fui:blocks/card/CardElement.ts:17-51](../../frontierui/blocks/card/CardElement.ts#L17-L51),
  [fui:blocks/card/SectionCardElement.ts:21-32](../../frontierui/blocks/card/SectionCardElement.ts#L21-L32)).
- **Already-wrapping** — progress/meter emit `<div class="fui-progress"><progress>` /
  `<div class="fui-meter"><meter>`
  ([fui:blocks/progress/Progress.ts:47-75](../../frontierui/blocks/progress/Progress.ts#L47-L75)). **The real
  `<progress>`/`<meter>` is already a nested child** — transient only ever erased the outer host. So the
  "irreplaceable native tag" was never a style-self candidate; it was always wrapped.

**role/aria attach to the native output, not the host today** — badge sets `role="status"` + tone `aria-label` on
the span ([fui:blocks/badge/BadgeElement.ts:40-45](../../frontierui/blocks/badge/BadgeElement.ts#L40-L45));
progress sets `aria-labelledby`/`aria-valuetext` on the real `<progress>`
([fui:blocks/progress/Progress.ts:71-72](../../frontierui/blocks/progress/Progress.ts#L71-L72)); tag is
decorative-only, no role ([fui:blocks/tag/TagElement.ts:10-13](../../frontierui/blocks/tag/TagElement.ts#L10-L13)).

**A host-ARIA (`ElementInternals`) mechanism already ships in FUI** — declarativeComponent lowers
`default-role`/`default-aria-*`/`states` → `attachInternals()` + `internals.role`/`internals.aria*`/`internals.states`
([fui:blocks/renderers/component/declarativeComponent.ts:101-120](../../frontierui/blocks/renderers/component/declarativeComponent.ts#L101-L120)).
This is the WHATWG surface for host-styles-itself — available, but **not** the ratified path for these leaves.

**CEM** — FUI generates `fui:custom-elements.json` and consumes it in
[fui:blocks/props-table/cemToRows.ts](../../frontierui/blocks/props-table/cemToRows.ts); it documents the authored
custom element (the host), independent of the fork.

**Blast radius** — grep of WE + FUI finds **no** `.fui-badge >` descendant selectors and **no**
`querySelector('.fui-badge')`. CSS is keyed to `.fui-badge` on the styled node; tests assert `el.className` on the
built node. Wrap-child keeps the class on that same node → CSS + tests survive; the only delta is a surviving host
node (node-count).

## Prior art

- **WHATWG `ElementInternals`** — `internals.role` / `internals.ariaLabel` give a persistent custom element real,
  author-overridable default semantics with **no wrapper**; the field's standard way to put default ARIA on a
  light-DOM leaf ([MDN ElementInternals](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals),
  [ariaLabel](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaLabel)). This backs the
  host-styles-itself path — which #1962 nonetheless declined for these leaves.
- **`display:contents` a11y** — the semantics-stripping bug (element dropped from the accessibility tree) was an
  [Interop 2024 focus](https://github.com/web-platform-tests/interop/issues/568) and is **fixed in
  [Chrome (115, after a 113 regression)](https://web.dev/blog/interop-2024-a11y) and Firefox** — but
  **[Safari 17 still breaks buttons and headings](https://github.com/web-platform-tests/interop/issues/512)**
  under `display:contents` (Sept 2023 release notes claimed a fix; buttons/headings remain broken;
  [Roselli survey](https://adrianroselli.com/2022/07/its-mid-2022-and-browsers-mostly-safari-still-break-accessibility-via-display-properties.html)).
  This is the decisive merit input: it disfavours `display:contents` **on the host** exactly for the role/heading
  leaves → favours default (b) (box-conditional), and independently reinforces #1962's wrap-child (semantics on the
  real native tag, not a `display:contents` host).
- **Native leaves** — `<progress>`, `<meter>`, `<output>` are the platform's own behaviour-free leaves; their
  semantics are the tag, which is why the semantic-tag leaves keep the real tag rather than fake a role.
- **Custom-element systems** — [Nord](https://nordhealth.design/web-components/) ships some light-DOM components;
  [Lit renders into light DOM](https://lit.dev/docs/components/shadow-dom/) via `createRenderRoot() { return this }`;
  [Spectrum](https://opensource.adobe.com/spectrum-web-components/tools/base/) assumes shadow DOM with no light-DOM
  leaf base. None self-erase; where they need host default semantics they use `ElementInternals`.

## The fork (prepared)

**Fork 1 — `display:contents` on every host, or only where a box would break flex/grid?** *(the sole genuine fork)*

- **(a) Uniform `display:contents`** — simplest rule; but rides the one still-broken Safari `display:contents`
  path for the role/heading leaves.
- **(b) Box-conditional (bold default)** — `display:inline` host for badge/tag, `display:contents` for the block/
  landmark/nested leaves. Matches #1962's literal "where a box would break flex/grid"; a one-line `hostDisplay`
  getter on the base class carries it.

Reference base class (`LightLeafElement`, persistent sibling of `TransientElement` that does not self-replace) and
the badge pilot DOM are in the item. **Q2** (role/aria on the child; CEM on the host) is derived; **Q3** (node-count
regression, zero consumers) is grounding.

## Skeptic pass (refute-only sub-agent)

The skeptic's decisive contribution: it **killed the originally-framed Q1**. Grounded findings —
(1) progress/meter *already* nest a real native tag
([fui:blocks/progress/Progress.ts:47-75](../../frontierui/blocks/progress/Progress.ts#L47-L75)), so the
"native-semantic leaves forced to wrap" half of the original hybrid default was never a decision;
(2) #1962's ratified text "emit native tag **inside** a persistent host" **is** wrap-child, so host-styles-itself
for badge/tag/card is statute-barred, not a live option;
(3) badge already sets `role`/`aria` on the span and Safari drops role under `display:contents`, reinforcing (2);
(4) there are **no** `.fui-badge` consumer selectors, so the blast-radius argument that had favoured host-styles-itself
is **moot** — wrap-child is the low-blast option. The item was re-scoped: the fork is no longer "style-self vs wrap"
(settled) but the narrower, genuinely-open "uniform vs box-conditional `display:contents`", with Q2/Q3 demoted to
derived/grounding. The re-scoped Fork 1 survives the skeptic; default (b) holds on #1962-text + Safari grounds.

## Residual / not-yet-at-DoR

- **None blocking ratification.** The item is at DoR: one genuine fork with a bold default, a code-level reference
  base class + pilot DOM, prior art, and a folded skeptic pass. `preparedDate` deliberately **not** set (per the
  prepare-pass instruction) — a human sets it at ratification.
- **Deferred to implementation (not this decision):** the exact `hostDisplay` value per leaf (mechanical, from the
  glance table); whether card/section-card ever actually break a flex/grid parent in practice (affects only whether
  their host is `contents` or `block` — a pilot-time observation, not a fork).

## Research topic

`light-dom-leaf-base-element-contract` (published:
`we:src/_data/researchTopics/light-dom-leaf-base-element-contract.json` +
`we:src/_includes/research-descriptions/light-dom-leaf-base-element-contract.njk`).
