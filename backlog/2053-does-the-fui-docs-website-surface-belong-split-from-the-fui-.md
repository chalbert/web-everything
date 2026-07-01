---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
preparedDate: "2026-07-01"
relatedReport: reports/2026-07-01-fui-docs-site-placement.md
relatedProject: webcomponents
tags: [constellation, placement, boundary, docs-site, reference-implementation, decision]
---

# Does the FUI docs-website surface belong split from the FUI implementation, mirroring #2006?

## Grounding digest

Frontier UI (GitHub `chalbert/frontierui`) intermingles a docs-site render with the reference-implementation
library it documents. **The render:** [fui:.eleventy.js](../../frontierui/.eleventy.js) (Eleventy, input
`fui:src/` → output `fui:_site/`), `fui:src/*.njk` pages
([fui:src/index.njk](../../frontierui/src/index.njk),
[fui:src/blocks.njk](../../frontierui/src/blocks.njk), plugs / adapters / traits / demos / about),
[fui:src/_data/*.js](../../frontierui/src/_data/) loaders, `fui:src/_layouts/base.njk`. Built by
`npm run build:docs`; dev-served at port 6080. **What it renders:** a
dogfood reference-showcase of the library — [fui:src/_data/demos.js](../../frontierui/src/_data/demos.js)
scans repo-root `fui:demos/*.html`; `fui:src/_data/blocks.json` / `fui:src/_data/plugs.json` /
`fui:src/_data/traits.json` mirror the catalog; runnable demos link out to the library's own Vite origin
(`site.demosUrl`, dev port 6002). **Not the docs-site:** [fui:webdocs/](../../frontierui/webdocs/) is a docs
*toolchain* (Mintlify/Storybook export adapters + coverage/generator), and
[fui:vite.config.mts](../../frontierui/vite.config.mts) builds the *demos* bundle — neither is the website
surface in question.

Prior art ([/research/fui-docs-site-placement/](/research/fui-docs-site-placement/)): re-running #2006's
survey against the *right* peer set — UI **component/implementation libraries** — inverts #2006's answer.
Component libraries overwhelmingly **co-locate** their docs-site in the library's own repo (the docs are a
live dogfood showcase importing the components): the exact match is **Shoelace / Web Awesome** (a
web-components library whose docs site is an Eleventy site in the same repo rendering its own custom
elements), plus Material Web, Adobe React Spectrum, MUI, Chakra, Mantine, Ant Design, Carbon, Fluent. The
**separate-repo** camp (React, Vue, Tailwind, TypeScript, JSON Schema) is *framework/standard-scale*
marketing **products** — the shape that argues for extraction, and the shape FUI's docs-site is not.

## The reframe (what is actually open — and what is not)

The temptation is to transfer #2006 mechanically ("WE split its website out, so FUI should too"). **That
transfer is invalid, and naming why is most of this decision.** #2006's driver was constellation rule 1's
**zero-implementation** invariant ([we:platform-decisions.md:70-74](../docs/agent/platform-decisions.md#L70-L74)
— "WE holds zero implementation"): WE's artifact-producing 11ty+Vite render was *mis-homed delivery runtime*
in a repo forbidden to host any. **FUI is the implementation tier and legitimately holds runtime**, so that
driver does not reach it — FUI is precisely where runtime is *supposed* to live. The distinguishing test is
therefore **product-vs-render, not impl-vs-contract**. **The load-bearing authority is constellation rule 1's
own routing** ([we:platform-decisions.md:70-74](../docs/agent/platform-decisions.md#L70-L74)):
*artifact-producing* code → **FUI**. An 11ty static-site render is artifact-producing, and rule 1 routes it
*to* FUI — so co-location is not merely "legal," it is rule 1's *affirmative* home for this kind of code. The
product-frontend statute ([we:platform-decisions.md:1579](../docs/agent/platform-decisions.md#L1579)) only
**corroborates** the "not a product" characterization — its authored turf is *component composition* (title /
footer / items), and it says product-*composition* does not live in FUI; it does not itself author a general
render-vs-product placement test, so it is supporting context, not the authorizing citation. A
reference-implementation library documenting/showcasing **itself** composes no product; it renders the
library's catalog and links the library's demos. So the genuinely-open call is a single one: **the end-state
home of the docs-site** (co-located vs extracted). Cite **rule 1's artifact-producing→FUI routing** as
primary (:1579 as corroboration); do **not** cite #2006's zero-impl reasoning as if it applied — that clause
is a predicate on the *WE repo* ("WE holds zero implementation"), and rule 1 routes runtime *to* FUI.

## Recommended path at a glance

| Fork | Question | Recommended default |
|---|---|---|
| **1** | End-state home of the FUI docs-site surface | **(a) co-locate in FUI** — it is a reference-showcase render of the library, legitimately co-located per the constellation facts + the component-library peer norm |

**Supported by default (not forks):**
- **No fail-closed standard-vs-site classifier** (the #2006 Fork 2 mechanism) — that gate existed only to
  protect WE's zero-impl invariant, which FUI lacks. FUI already de-facto separates the docs-site
  (`fui:src/` + `fui:.eleventy.js`) from the library (`fui:blocks/`, `fui:plugs/`, `fui:adapters/`); no
  machine-legible classifier is owed here.
- **Naming** needs no disambiguation act — "FUI" already denotes the implementation, and the docs-site is
  "the FUI docs site". This is *not* the WE naming-confusion case (#2006), where one name conflated a
  zero-impl standard with an 11ty app.

## Fork 1 — End-state home of the FUI docs-site surface

*Fork exists because:* the docs-site resolves to **exactly one** terminal home — {co-located in FUI,
extracted to its own product-tier surface} genuinely cannot both be it. Note the branch structure **differs
from #2006's Fork 1** — and it is *strongly* settled toward the default, not 50/50. In #2006, permanent
co-location was the *excluded/broken* branch (rule 1 forbids a standing WE-resident delivery tier). Here the
opposite: co-location is not merely legal, it is **rule 1's affirmatively-routed home** (artifact-producing →
FUI). Extraction (b) is a *coherent* alternative — the docs-site does have one terminal home, and a decider
could reasonably re-home it if it grows product features — but it is the weakly-supported branch, kept as a
fork (not collapsed to a bare ratify) precisely so the decision turn sees the reserved-(b) trigger. So this
is a genuine either/or with a *heavily*-defaulted answer, and the recommended branch is the *opposite* of
#2006's.

- **(a) Co-locate in FUI** *(default)* — the docs-site stays in the FUI repo alongside the library it
  documents and showcases. This is where runtime legitimately lives (rule 1), the docs-site is a
  render-not-product (statute :1579), and it matches the dominant component-library pattern — most tellingly
  the Shoelace/Web-Awesome Eleventy precedent (web-components library + Eleventy docs + one repo). The docs
  move version-locked with the components; the live showcase reads the library's own catalog with zero
  cross-repo seam.
- **(b) Extract to a product-tier surface** — move the docs-site to its own repo/package consuming a
  published FUI. *Coherent but not recommended now.* It becomes the right call only if the FUI docs-site
  grows **genuine independent product features** (its own marketing funnel, an app beyond showcasing the
  library) — the point at which it stops being a reference-showcase and becomes the #2006 product shape, and
  the extract-to-product-tier reasoning would begin to apply. Absent that, extraction pays a cross-repo
  publish/consume cost for a site whose whole value is rendering the co-resident library.

**Default rationale (red-teamed):** (a) because rule 1 *affirmatively routes* artifact-producing render to
FUI (the docs-site's home is where the rule puts it, not merely where it is tolerated), and both constellation
tests that condemned WE's website *acquit* FUI's — the zero-impl clause is a WE-repo predicate that doesn't
reach FUI, and the docs-site composes no product (:1579 corroborating) — and the correctly-scoped peer survey
(component libraries, not frameworks) co-locates by a wide margin, with an exact Eleventy+web-components
structural match. The one real counter — `fui:src/index.njk` carries a
tagline + call-to-action, so "isn't it a marketing product like WE's #184 landing?" — fails on inspection:
it is a docs-*home* whose CTA points into the library's own blocks catalog, with no independent client
product-features (no board/burndown/graph/funnel). A docs-home is not product composition; every peer
component-library docs site has one.

**Concrete shape** (Fork 1 turns on a repo-layout choice):

```
# Fork 1(a) default — co-located (status quo, blessed)
frontierui/                         # the reference-implementation library repo
  .eleventy.js  src/*.njk  src/_data/*.js  _site/    # the docs-site render (dogfood showcase)
  blocks/  plugs/  adapters/  charts/  webtheme/     # the library runtime it documents
  demos/*.html   (Vite :6002)                        # runnable demos the docs link out to
# docs read the co-resident catalog directly; no cross-repo publish/consume seam.

# Fork 1(b) alternative — extracted (only if the site grows real product features)
frontierui/            # library only
frontierui-docs/       # separate product-tier surface, consumes a PUBLISHED @frontierui + its catalog
# pays a cross-repo publish/consume cost; justified only when the site is a product, not a showcase.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (attacked in prep by a throwaway refute-only `general-purpose`
sub-agent, four axes; the default could not be broken on merit). Axis-0 **classification**: the re-routes
(config-dimension / support-both / settled-by-precedent) all failed — but the attack rebounded to show the
item *understated* the default: co-location is closer to **rule-1-routed** (artifact-producing→FUI) than
"neither branch broken" implied. *Folded:* reframed Fork 1 as heavily-defaulted (not 50/50), with (b) the
weakly-supported coherent alternative kept only for the reserved trigger. Axis-1 **merit** (the hardest
sub-attack — `fui:src/index.njk` tagline+CTA ⇒ "product like WE's #184"): REFUTED on inspection — the CTAs
point into the library's own catalog / out to WE, and `fui:src/` has **none** of WE's product signatures
(no board/burndown/graph/funnel); `fui:src/_data/demos.js` reads the co-resident `fui:demos/` off disk, so
co-location creates *zero* boundary violation while extraction would *introduce* a cross-repo seam. Axis-2
**statute-overlap**: no hard collision (the drafted claim's turf — docs-site repo placement — is disjoint
from :1579's component-composition turf and from #2006's WE-website-scoped amendment). *Folded:* the ratify's
one-line note must be phrased as an explicit **distinction from :1579's "WE website" product example**
(a reference-impl self-showcase docs-site is render-not-product and is *not* the :1579 "product's own
frontend" case), or a reader will over-read :1579 as reaching FUI. Axis-3 **citation-scope**: the item's two
*negative* claims (zero-impl and #2006 don't reach FUI) are correct and survive; but its *positive* citation
was mildly mis-scoped — :1579 authors a composition-substrate test, not a general render-vs-product placement
test. *Folded:* rebased the authorizing citation onto **rule 1's artifact-producing→FUI routing** as primary,
demoting :1579 to corroboration (mirrors #1948's prep re-basing rule 2 as primary).

## Downstream / unblocks

- Closes the open FUI-vs-#2006 parallel with a *grounded distinction* rather than a reflexive mirror — future
  placement calls can cite "reference-impl docs-sites co-locate (product-vs-render test)" instead of
  re-deriving it, and won't mis-apply WE's zero-impl reasoning to FUI runtime.
- Does **not** block #2006 (that decision is already ratified and unaffected). On ratify, this would add at
  most a one-line clarifying note under constellation placement — phrased as an **explicit distinction from
  the :1579 "WE website" product example** (a reference-impl library's self-showcase docs-site is
  render-not-product and is *not* the ":1579 product's own frontend" case), so a reader won't over-read :1579
  as reaching FUI's docs-site. It does **not** open a new platform-decisions anchor.
- If Fork 1(b)'s trigger ever fires (the docs-site grows genuine product features), that is a *new* item to
  file at that time, citing this decision's reserved-(b) condition — not a commitment made now.
