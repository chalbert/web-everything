---
type: idea
workItem: story
size: 3
parent: "507"
status: resolved
blockedBy: []
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: src/_includes/research-descriptions/adapter-driven-source-form.njk + adapter-driven-source-form research topic + ServeForm seam note in blocks/renderers/module-service/moduleService.ts
relatedProject: webdocs
crossRef: { url: /backlog/646-devtools-composition-assembler-build-your-own-component-for-/, label: "Generalizes the assembler emit-format axis — informs #652" }
tags: [generation-adapter, framework-adapter, assembler, source-form, react, tsx, native-first, adapter-as-normalization-hub]
---

# Adapter-driven source form — a framework adapter emits its native dialect (React adapter → TSX, not HTML)

Today the assembler/generation adapter treats HTML (declarative `<component>` source) as THE source form — but that only fits plain web components. The emitted source dialect should be ADAPTER-DRIVEN: a plain-WC adapter emits HTML; a React adapter emits TSX; a Vue adapter emits SFC; etc. So "source form" becomes an axis a registered framework adapter resolves, not a fixed HTML default — the adapter declares its native authoring dialect and the assembler/origin emits in it. Generalizes the MaaS FORMS catalog (html/jsx/functional) into adapter-selected output, and informs the assembler emit-format decision (#652). Honours native-first (plain WC = HTML default) + adapter-as-normalization-hub.

## The shape

- **Source form is an adapter capability, not a fixed default.** The MaaS `FORMS` catalog already lists
  `html` / `jsx` / `functional`, but `html`/declarative is privileged as "the source." Reframe: each
  registered **framework adapter** declares the native authoring dialect it emits — plain-WC → HTML
  (declarative `<component>`), React → TSX, Vue → SFC — and the assembler/generation origin emits in that
  dialect. The catalog of dialects stays open (intents-open-design style), not a closed enum.
- **Native-first default.** With no framework adapter selected, the default stays plain WC → HTML
  (the web-platform-standard form). A framework dialect is the adapter author's opt-in, never the floor.
- **Relationship to the assembler (#646/#652).** The composition assembler emits an ejectable recipe;
  #652 is settling its emit format. This card says that format is *not one fixed dialect* but whatever the
  active framework adapter resolves — so #652 should treat the emit dialect as adapter-driven rather than
  baking HTML/JSX. Likely a dimension to fold into that decision, or a follow-on once #652 lands.
- **Dimension settled (multi-dialect).** Does the adapter emit a *single* canonical dialect, or can one
  component be served in *multiple* dialects (the MaaS multi-form serve path) with the adapter supplying
  the transform per dialect? **Resolved → multi-dialect**, per the most-flexible-default rule: the serve
  path already serves many forms off one definition, so exposing the whole axis is the most permissive
  end-state; a single-dialect restriction is the adapter author's opt-in, never the floor.

## Progress

- **2026-06-15 — codified (design story, materialized).** Seam codified in
  [`we:blocks/renderers/module-service/moduleService.ts`](../blocks/renderers/module-service/moduleService.ts)
  — the `ServeForm` doc-comment now states source form is adapter-driven (open multi-dialect set, not a
  closed HTML-privileged enum), native-first default (plain WC → HTML), and that the assembler emit
  format (#652) inherits the adapter-resolved dialect. Design rationale published as the
  `adapter-driven-source-form` research topic (`we:src/_data/researchTopics.json`). Open dimension resolved
  toward multi-dialect (most-flexible-default). No we:standards-protocol/adapters.json change — this is a
  framing/codification under the open generation-adapter epic #507; the concrete build it informs is
  #652's emit-format decision. graduatedTo: the research topic + the we:moduleService.ts seam note.
