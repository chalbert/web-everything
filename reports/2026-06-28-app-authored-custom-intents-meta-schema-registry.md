# App-authored custom intents — prior-art survey for the meta-schema, namespacing, and registration shape

**Date**: 2026-06-28
**Point**: Survey of how seven established systems let third parties extend a fixed standard vocabulary conflict-free, synthesized into a recommended shape for product-minted WE intents (decision #1913): scope-style ownership namespacing, declarative build-time registration, graceful-ignore default with a must-understand opt-in, and a minimal `extends`-capable meta-schema.

**Plan file**: (decision-prep for `we:backlog/1913`)
**Research page**: `/research/app-authored-custom-intents-meta-schema-registry/`

---

## Question

Intent-UX-Only (`we:docs/agent/platform-decisions.md:378`) ratified that intents are open — "custom non-standard intents must coexist conflict-free; standardize the meta-schema, not the list." That promise is unrealized: WE ships a fixed catalog with no seam for a product to mint its own intent. Decision #1913 needs the shape: how a product declares a custom intent (meta-schema), registers it conflict-free (namespacing), build-time vs runtime resolution against `we:webtraits/intentProfileResolver.ts`, and namespacing against the standard catalog. The system is native-first, so the survey is led by the web platform's own extensibility patterns.

## Recommendation

- **Namespacing**: scope-style `owner:intent` (or `@owner/intent`) anchored to the product's existing app identity. Standard intents stay bare → a scoped id can never collide with a standard one. Reject status prefixes (`x-`, `custom-`) per RFC 6648. Keep a schema.org-style graduation path (alias, never rename).
- **Registration**: declarative / build-time — a per-product intent manifest globbed into the registry like `we:src/_data/intents/*.json`. Optional runtime register-API as an escape hatch (the CSS `@property` / `CSS.registerProperty()` duality), JS wins on tie.
- **Unknown-intent**: graceful most-permissive ignore by default (JSON-Schema unknown-keyword + WE most-permissive-default); per-intent `mustUnderstand:true` opt-in for fail-fast (JSON-Schema `$vocabulary` required-flag).
- **Meta-schema (min)**: scoped `id` + `dimensions{ name → { values, default } }`; recommended `extends` (compose off a standard intent), `provenance` (owner anchor), `mustUnderstand`; optional `$extensions` preserve-unknown sidecar.

## Key Findings

1. **Native namespacing = a reserved structural marker, not a managed prefix table.** Custom elements' mandatory hyphen ("no elements will be added to HTML/SVG/MathML with hyphen-containing local names going forward"), CSS custom props' `--` ("&lt;dashed-ident&gt;s will never be defined in CSS"), and DTCG's reserved leading `$` ("token and group names MUST NOT begin with `$`") all concede one side of a syntactic boundary to authors and keep the other for the standard forever — collision-free vs current AND future standard names, zero central registry. Collision detection degrades to a cheap local check; when one namespace is too tight, the answer is scoping (per-subtree registries), not a bigger table.

2. **Cross-author collision-avoidance anchors to owned identity — by ownership, never status.** RDF/XML (IRI), Java (reverse-DNS), npm (`@scope/`), DTCG `$extensions` (reverse-DNS recommended) all anchor names to a globally-unique thing the author already controls. npm's short scope beats reverse-DNS verbosity when an app-identity registry already exists. **RFC 6648 deprecated the `X-` status-prefix** because experimental names leak into the standard space and force interop-breaking renames on promotion (`x-gzip`). Namespace by ownership; promotion is an alias, not a rename.

3. **Declarative/build-time is the schema-world norm; runtime registries pay for it.** DTCG, OpenAPI, Tailwind `@theme`, Style Dictionary all register build-time → vocabulary is statically analyzable. Only code-valued web-platform registries (`customElements.define`, `CustomStateSet`) go runtime, and they lose static analyzability (custom states have no declarative surface). An intent is data, not code, and `we:webtraits/intentProfileResolver.ts` is already a pure build-time function (scope per #776: "build-time inclusion + delivery only") → build-time is the native fit. CSS `@property` shows the canonical duality: declarative-first + optional runtime hatch, JS wins on tie.

4. **Closed-vs-open is per-term, decided by who must interoperate on the meaning.** ARIA roles are closed (cross-actor contract with AT; unknown ignored; fallback-token chain the only extension). Custom states are open (component-private; fenced behind `--`/`:state()`). WE already does this at value level (open-numbered `variant`/`tone`/`disposition` per #1318); custom intents are the same open-but-fenced discipline one ring out.

## Per-system source bank

**W3C Design Tokens (DTCG)** — closed type catalog; `$extensions` reverse-DNS sidecar with MUST-preserve-unknown; leading-`$` reserved for format props; declarative.
- https://tr.designtokens.org/format/ (→ https://www.designtokens.org/TR/drafts/format/)
- https://www.alwaystwisted.com/articles/understanding-extensions-in-the-design-tokens-spec
- https://github.com/design-tokens/community-group

**CSS custom properties / `@property`** — `--` marker guarantee; `@property` (declarative) + `CSS.registerProperty()` (runtime, JS wins on tie); runtime cascade resolution.
- https://drafts.csswg.org/css-variables/
- https://developer.mozilla.org/en-US/docs/Web/CSS/dashed-ident
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@property
- https://developer.mozilla.org/en-US/docs/Web/API/CSS/registerProperty_static

**Custom Elements** — mandatory hyphen (namespacing + forward-compat); runtime `define()`, re-define throws `NotSupportedError`; scoped registries emerging.
- https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
- https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define
- https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/CustomElementRegistry
- https://wicg.github.io/webcomponents/proposals/Scoped-Custom-Element-Registries.html

**JSON Schema / OpenAPI** — OpenAPI `x-*` (3.1 relaxes the prefix inside the JSON-Schema Schema Object); JSON Schema unknown-keyword-as-annotation + `$vocabulary`/`$schema` dialect handshake; declarative. RFC 6648 cautionary tale.
- https://spec.openapis.org/oas/v3.0.3.html
- https://spec.openapis.org/oas/v3.1.1.html
- https://json-schema.org/draft/2020-12/json-schema-core
- https://datatracker.ietf.org/doc/html/rfc6648

**ARIA roles vs custom states** — roles closed (unknown ignored, fallback-token chain); custom states open via `ElementInternals.states`, originally `--`-fenced (`:--checked`) now `:state()`; custom states runtime-only.
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles
- https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet
- https://developer.mozilla.org/en-US/docs/Web/CSS/:state
- https://github.com/WICG/custom-state-pseudo-class/issues/6

**Tailwind / Style Dictionary / Radix-shadcn** — default closed set + merge/extend hatch; namespace by key, last-write-wins; build-time config.
- https://tailwindcss.com/docs/theme · https://tailwindcss.com/blog/tailwindcss-v4
- https://styledictionary.com/reference/api/
- https://www.radix-ui.com/themes/docs/theme/color · https://ui.shadcn.com/docs/theming

**Reverse-DNS / URI / scope registries** — anchor to owned identity (DNS domain or issued scope); schema.org core + `pending` + external extensions; declarative.
- https://schema.org/docs/extension.html
- https://www.w3.org/TR/rdf11-concepts/ · https://www.w3.org/TR/xml-names/
- https://docs.npmjs.com/about-scopes/
- https://docs.oracle.com/javase/tutorial/java/package/namingpkgs.html

## Caveats

- DTCG is an unratified Community Group Editor's Draft (dated 2025.10), not a W3C Rec — pin to the dated draft.
- OpenAPI `x-oai-`/`x-oas-` reserved sub-prefix detail is paraphrase (the spec HTML truncated before that section).
- The exact technical reason CSSWG reverted `:--foo` → `:state(foo)` is not stated verbatim in any source (the Chromium thread itself calls it unexplained); the documented driver is cross-vendor/WHATWG consensus + the move into the HTML Standard.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:src/_data/researchTopics/app-authored-custom-intents-meta-schema-registry.json` | Created — registry entry (status: open, decision-prep for #1913) |
| `we:src/_includes/research-descriptions/app-authored-custom-intents-meta-schema-registry.njk` | Created — full research write-up |
| `we:reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md` | Created — this report |
