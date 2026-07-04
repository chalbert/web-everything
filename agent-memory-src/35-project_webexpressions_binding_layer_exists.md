---
name: project_webexpressions_binding_layer_exists
description: "WE already ships a {{ }}/[[ ]] expression-binding layer (webexpressions plug, status:active runtime interpreter) — binding work is NOT greenfield; the"
metadata: 
  node_type: memory
  type: project
  originSessionId: d62619a3-60c7-4f31-82fd-7ae24c9092ec
---

WE already ships a declarative `{{ }}`/`[[ ]]` expression-binding layer — do **not** treat
component/template binding as greenfield. The `webexpressions` plug family is `status: active`
(ratified contracts) in `src/_data/plugs.json`: `CustomExpressionParserRegistry` +
`CustomExpressionParser` (the restricted-sublanguage grammar seam), `CustomTextNode(Parser)(Registry)`,
`DoubleCurlyBracketParser` (`{{ }}`), `DoubleSquareBracketParser` (`[[ ]]` — Polymer one-way/two-way
split already built), and `InterpolationTextNode` — a **runtime interpreter** (parses + evaluates on
`connectedCallback` via the injector-chain-resolved registry; "Phase 1: evaluates once on connect, no
auto-update"). Runtime impl is vendored in `plugs/webexpressions/` (FUI-owned, pending #170 re-point).

**#792 (DC-4) ruling that depends on this:** the `<component>` declarative binding is the **unplugged /
compile-time twin** of this shipped runtime layer, NOT a new contract. The split: plugged = runtime
interpret via the registry off the injector chain; unplugged = `generateClassSource` lowers the same
authored spelling to `static observedAttributes` + `attributeChangedCallback` (no injector chain at build
time). Reuse seam is the **grammar/parser contract** (`CustomExpressionParser`), never the runtime
*registry resolution* (`InjectorRoot.getProviderOf` has no build-time analogue). This **killed** DC-4's
original sub-decision 4 ("never browser-interpreted") — WE ships an interpreter. Build slice = #825 under
[[project_dogfood_we_site_on_fui_components]]'s sibling epic #076.

**Why durable:** the prepared #792 report (§2) listed Polymer `{{ }}`/`[[ ]]` as "prior art to borrow"
when WE had already built it — a research gap caught only when the user pushed. Same lesson as
[[feedback_verify_grounding_claims_before_ratifying]]: trace a prepared decision's report to the real tree
(grep plugs.json + blocks/parsers/) before ratifying.
