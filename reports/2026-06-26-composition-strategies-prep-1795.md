# Decision prep — #1795: HTML-first composition strategies for re-skinning an a11y-complete block

**Date:** 2026-06-26
**Item:** [#1795](/backlog/1795-html-first-composition-strategies-for-re-skinning-an-a11y-co/)
**Research topic:** [/research/html-first-composition-strategies/](/research/html-first-composition-strategies/) (published this pass)

## Standing test outcome (pass 0, post-skeptic)

The item listed five candidate strategies as if choosing among them. The fork-existence test splits them three ways, not "all support-all":

- **Three are cleanly first-class & composable** (support-all): slots, behavior/decoration (`CustomAttribute`), abstract-piece-split (a userland convention). None excludes another.
- **Strategy 2 (sub-component replacement via scoped registry)** is sanctioned **but blocked**: #854's *contract* is ratified, but the webregistries *runtime* is mid-port to FUI (#901's `graduatedTo` file is absent from HEAD; ≥7 open re-home items incl. #1483/#1545). Adopt #854's ruling, mark the build blocked-on the re-home — not "cleanly delegated, done."
- **Strategy 4 (context-driven configuration)** is **not** a free-standing supported strategy for the decision's *visual* use-case — it *is* the "configure-one-block" branch Fork 1 defaults against. It survives only for **non-visual** config (locale, data source, feature flags). So it folds into Fork 1 rather than counting as a fifth support-all strategy.

The skeptic refuted the original "all five support-all" headcount as incoherent with Fork 1's own default (you can't both sanction config-driven visual variants and default against configure-one-block). The genuine either/or is Fork 1.

## Strategy → web-platform primitive (grounding)

| Strategy (React analog) | HTML-first primitive | Tree status |
|---|---|---|
| Slots (inject icon/badge/popover) | shadow `<slot>` named+default; imperative `HTMLSlotElement.assign()` | exists — `we:blocks/renderers/component/__fixtures__/component-cases.ts`, `we:blocks/renderers/jsx/directives.ts:74-80` |
| Sub-component replacement (CustomLink) | scoped custom element registry + IDREF | **ratified #854** (`#component-dc`); build unstarted (#900→#901); no `CustomLink` exists |
| Behavior/decoration (HOC) | `CustomAttribute` | **most mature** — `we:blocks/router/behaviors/RouteLinkBehavior.ts` decorates host `<a>` with `aria-current` |
| Context-driven config | webinjectors IDREF + webexpressions `{{ }}` over #1780 config carve | exists — `we:_site/plugs/webinjectors/declarativeInjector.ts`, `we:conformance-vectors/text-node.vectors.ts` |
| Abstract-piece split | convention (#023 distinct-tags, #715 tree-shakable traits) | userland convention, no WE primitive needed |

**Platform shipped the hard parts:** scoped custom element registries are now default in Chromium 146 + Safari (whatwg/html#10854); imperative slot assignment (`slotAssignment:'manual'`) is native. So strategies 1–2 rest on interoperable native primitives — validating HTML-first over a framework-runtime composition layer.

## The motivating block + the a11y gap are real

`nav-list` (`we:src/_data/blocks/nav-list.json`) is the W3C APG Disclosure Navigation block the decision names — concrete, with a conformance demo (`we:demos/reveal-nav-conformance.html`). A11y vectors exist as a corpus (`we:conformance-vectors/presentation-a11y.vectors.ts`) but **none proves a *composed* variant preserves the base's guarantees** — that suite is the real build gap.

## The one genuine fork (Fork 1) — where a11y-contract ownership lives

Mostly-visual variation forces a real either/or on **who owns the base block's a11y contract**: **(a) compose-over-base** (the a11y-complete base stays ONE block owning its a11y contract; variation by slot/decorate/scoped-replace/theme-token; structural variation → distinct block) vs. **(b) configure-one-block** (one block renders many visual variants from injected config, dissolving the single contract into a config matrix). The two **partly compose at the margin** — config may legitimately *select which presentation-only slots appear* (`show-badge`, `density`) layered over a compose-over-base base — so the carve is a *boundary*, not a clean either/or: config toggles presentation, but never owns the a11y contract. **Default (a)**, argued on native-first + a11y-ownership merit for the block-reskin case directly. #023 ("distinct tags, NOT one configurable element") is cited as **analogy, not controlling precedent** — its ruling is droplist-trait-granularity-scoped, so the reskin case is argued on its own merits.

## Forced invariant (ratify, not a fork) — contract-level non-destructiveness

A11y preservation is a forced invariant, but **not** as a WE-shipped per-strategy vector — the skeptic refuted that: `we:conformance-vectors/presentation-a11y.vectors.ts` is deck/slide-specific (no nav/disclosure vectors exist), a "base + slot P + decoration Q" composed variant is **not expressible** in the vector schema (`we:conformance-vectors/schema.ts:24-82` judges a *standard's* contract, not a base-plus-decorations tuple), and the impl/verifier live in FUI/Plateau per the constellation rule ([conformance-verifier-vs-subject], [we-zero-standard-implementation]). The invariant WE *can* own is **contract-level**: the a11y contract is **single-sourced on the base block**, and any sanctioned composition strategy must be **non-destructive** to it — it may **add** to the base's ARIA/focus surface, never **override or remove** it. *Whether a given composed variant honors that* is a FUI/Plateau conformance-run concern; the build slice WE opens is the contract statement + the nav-block a11y vector corpus (which doesn't yet exist), not a per-strategy proof matrix.

## Overlap (non-duplicative)

#646 = assembler that *consumes* these strategies; #715 = bundler delivery; #748 = anatomy view (resolved); #023 = droplist ruling (resolved, the Fork 1 precedent); #854 = sub-component replacement (ratified, built by #901, *adopted* here not re-decided).

Skeptic verdicts folded into the item body.
