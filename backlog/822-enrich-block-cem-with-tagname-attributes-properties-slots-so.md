---
kind: decision
size: 3
status: resolved
codifiedIn: docs/agent/platform-decisions.md#tagname-naming
parent: "746"
relatedProject: webdocs
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
crossRef: { url: /backlog/821-consume-mode-per-framework-wrapper-generator-block-cem-react/, label: "Wrapper generator (#821)" }
tags: [webdocs, cem, blocks, adapters, api-viewer]
---

# Enrich block CEM with tagName + attributes/properties/slots so wrappers/api-viewer get a real custom-element surface

The wrapper generator (#821) and every structural CEM consumer (api-viewer, Storybook, polyglot panel #753) need custom-element declarations, but fui:src/_data/blocks.json carries no tagName/attributes/properties/slots — so we:gen-cem.mjs emits 0 custom-element declarations (class+events only) and the generator has no real block to wrap. Enrich fui:blocks.json (or derive) with a tagName + attribute/property/slot surface so gen:cem projects real custom-element declarations. Unblocks real-block wrapping for #753.

**Retyped `decision` 2026-06-16 (batch pre-flight).** The body carries a genuine constellation-boundary fork, not a mechanical build — it can't be batched until ratified.

## Ruling (ratified 2026-06-17) — Fork 1 **dissolves** (the custom-element surface is a WE-owned contract; FUI conforms); the genuine remaining call (naming convention) is carved to a sibling decision

**Fork 1 was mis-framed at the root.** Both A ("WE authors, *mirroring* FUI's `define()`") and B ("WE *ingests* from FUI") treated **FUI's `customElements.define()` as the source of truth** for the tag/attribute/slot surface. That is backwards. **WE is the standard; the custom-element surface (tagName + attributes/properties/slots) is a WE-owned *contract*, and FUI is one implementation among many that must conform to it** — the impl-is-not-a-standard rule; the polyglot/forward-adapter vision (#463, ratified — neutral WE contract is SoT, impls/forward-adapters in .NET/Java/Go *generate to* it); #783's FUI manifest already points *back* at WE via `weSpecPath`. The surface lives in WE `fui:src/_data/blocks.json` (mechanically what old-"A" did) **because WE defines it**, not because WE records FUI. Consequences:

- **B is a category error, not merely a costlier seam.** An implementation cannot be the source of the contract it implements. WE's `we:gen-cem.mjs` ingesting a FUI artifact would invert the constellation arrow (standard depending on impl) and contradict #783 (*"not the portable standard reaching into FUI's habits"*). There is also no FUI CEM artifact to ingest (thin `weSpecPath`/`sourcePath` manifest, no gen-cem).
- **The surface is the same contract tier as `events`.** WE fui:blocks.json already carries `events` (12 blocks — the `CustomEvent`s the element dispatches), `exports`, `intentDimensions.register`, `webStandards`: the block's observable contract, exactly what a CEM (#653) documents. There is **no principled line** that admits `events` but excludes `tagName`. The implementation is the class body in FUI; the tag/attr/slot surface is the contract WE owns.
- **`gen-cem` already half-implements this** (`we:scripts/gen-cem.mjs:71,77` emits `customElement`+`tagName` when present, never fabricates). Build = add `tagName`/`attributes`/`members`/`slots` to the relevant WE entries + extend `cemModule` to project them.

**Conformance gate (the right drift direction).** The check is *not* "WE mirrors FUI's tags" — it is **FUI conforms to WE**: extend #783's Check-2 so every FUI `customElements.define`/`attributes.define` name must equal the `tagName` its WE spec entry declares. WE→impl, the standard conformance direction (#463) — not impl→standard. (File against the #783 Check-2 build, not here.)

**The genuine remaining fork — what name WE *specifies* (a WE-contract call, deferred to a sibling decision).** The `tagName` value is **WE's to define**, never read from FUI. FUI's *current* registrations are irregular — `nav:section`, `on:click`, `auto-complete`, `type-ahead`, `auto-heading` (colon-namespaced, no prefix, tag ≠ `id`) — but that irregularity is a fact about **FUI's tree, not a constraint on the WE contract**. So:
- **Static HTML / npm** has no runtime choice — the element registers under whatever WE specifies (impl-swap portability *requires* WE to pin the literal tag, else a document isn't portable across impls). The **consume modes** (JSX `<component>`, MaaS) *dissolve* the runtime tag (compile-time / import / DI-key resolved), but WE still owns the contract name across them.
- Open: **a WE-defined regular convention** (e.g. prefix + `id`, *derivable*; FUI's current irregular names then **migrate to conform** — FUI is the conformer, not the source) **vs. WE authoring a per-entry value** where a regular scheme is wrong for a block. **Adopting** an existing FUI name is allowed *only* as WE **ratifying** it into the contract (a migration call WE makes), **never** as WE deferring to FUI as the source.
- **The convention binds only where the tag binds *globally*; deep compile-time/JSX consumption stays totally flexible.** Two names exist: the **contract `tagName`** (the CEM value — conventioned because static-HTML / global-`define` / impl-swap modes make it a real global identifier) and the **consume-site binding** (the JSX `<component>` identifier / import alias / DI key — *always* free). A project consumed *deeply through the JSX format* never materializes a runtime global tag, so the convention is **advisory there, not binding** — totally-flexible naming is legitimate (most-flexible-default: the convention is the floor *only* for the global-registration modes, never a project-wide mandate). The DI-replace-a-badly-named-component case is one instance of this freedom, not its limit. **The naming sibling must preserve this** — govern the global tag, leave compile-time consumption free.
- **This gates the `tagName` value, not the projection mechanism.** #822's build splits: (a) extend `gen-cem`'s `cemModule` to project `tagName`/`attributes`/`members`/`slots` (value-agnostic — unblocked) + author the **structural surface** (attributes/properties/slots), which is WE-owned and derives from each block's intent/`webStandards` contract; (b) author the **`tagName` value**, which is `blockedBy` the naming-convention sibling — so a real `customElement` declaration (which needs a tag) lands only once that names ruling exists. The build carries the `blockedBy`, not this decision.

**Scope:** only `type: Component` blocks registered via `customElements.define` get a `tagName` + custom-element declaration; behaviors registered via `attributes.define` (`on:click`, `nav:list`) are custom *attributes*, not custom elements — they stay plain `class` declarations (no tagName). `gen-cem`'s "no tag fabricated" invariant already enforces this.

**Confidence the surface is WE-owned & FUI conforms: ~90%** (firm constellation principle — impl-is-not-a-standard + #463). The residual is the naming-convention value-policy (the sibling) and the build-split sequencing — not a boundary fork.

### Original fork framing (pre-ruling, retained for record)

**Fork 1 — where does the custom-element surface live?**
- **A — WE `fui:src/_data/blocks.json` holds the surface.** gen-cem reads it directly; WE owns the projected CEM. (Con as originally stated: pushes impl detail into the standard layer — *refuted above by the `events` precedent / WE-owns-the-contract*.)
- **B — surface sourced from FUI** (FUI's `fui:blocks.json`/manifest or a CEM analyzer over FUI's tree), WE consumes the output only. (Originally recommended on no-leakage — *reversed above: B is a category error, an impl cannot source the contract*.)

**Fork 2 — tag naming convention**
- `fui-<id>` vs deriving from `registryName` vs authored `tagName` per entry. Subordinate to Fork 1.
