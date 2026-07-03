---
kind: story
size: 3
parent: "2094"
status: resolved
blockedBy: ["2104"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
relatedReport: reports/2026-07-03-delimiter-bundle-grammar-fidelity.md
tags: [custom-nodes, delimiter-grammar, bundle, scorecard, keystone]
---

# Grammar-fidelity scorecard + shared conformance fixture for delimiter bundles

The #2024 analogue for #2094's delimiter bundles: a per-bundle construct checklist scoring each framework construct reproduced / partial / out-of-scope-per-statute (attribute-keyed → the #1986 registry; attribute-value interpolation → sibling surface) / gap (the recipe model can't express it → feeds statute). Fixture pattern mirrors fui:plugs/webexpressions/__tests__/unit/CustomTextNodeParser.test.ts; consumer-at-birth: score FUI's own native grammar (the mustache + polymer interpolation delimiters, post-#2104) as bundle zero. Gap lists publish as we:reports/ topics (the #2022 shape).

## Resolution (2026-07-03, #2113)

Built the #2024-analogue **grammar-fidelity scorecard** for #2094's framework-flavored delimiter bundles — the repeatable, **framework-agnostic** measure of how faithfully a delimiter bundle reproduces a template grammar over the #2074 `CustomNode` recipe model.

- **Scorer (FUI impl):** `frontierui:plugs/webnodes/grammarScorecard.ts` — `scoreGrammar(bundle, reference)` reads the declared static config (`open`/`close`/`value`/`children`/`rendered`) off each bundle recipe and grades every reference construct exactly one of **reproduced** (delimiter + nature match) / **partial** (delimiter claimed, nature diverges) / **out-of-scope-per-statute** (attribute-keyed → the #1986 registry; attribute-value interpolation → sibling surface — declared per construct) / **gap** (no recipe claims it, in scope — the concrete standard increment). Out-of-scope constructs are excluded from the denominator. `renderGrammarReport` formats the `{ construct: verdict, gaps: [...] }` result as the #2022-shape Markdown. **Zero per-framework code** — every framework fact is caller-supplied data.
- **Shared conformance fixture (FUI):** `frontierui:plugs/webnodes/__tests__/unit/grammarScorecard.test.ts` — mirrors the `frontierui:plugs/webexpressions/__tests__/unit/CustomTextNodeParser.test.ts` fixture pattern. Scores **bundle zero** (FUI's native mustache + polymer interpolation recipes) at 100% against its own checklist, then a synthetic Handlebars checklist through the *same* `scoreGrammar` to prove all four verdicts and reproducibility (framework-agnostic proof, the #2024 acceptance-2 analogue).
- **Checklist data (WE):** `we:design-systems/grammars/fui-native.grammar.json` + `we:design-systems/grammars/handlebars.grammar.json` — the per-framework construct checklists. Swapping these is what makes the scorer framework-agnostic; they carry zero scorer logic.
- **Emitter + report (WE):** `we:scripts/grammar-scorecard.mjs` (`npm run grammar:score` / `npm run grammar:check`) transpiles the FUI scorer + bundle-zero recipes across the WE→FUI boundary (esbuild + data-URL, detect-or-skip, like `we:scripts/parity-conformance.mjs`), scores bundle zero against each checklist, and emits the combined report `we:reports/2026-07-03-delimiter-bundle-grammar-fidelity.md` (FUI-native 100%, Handlebars 17% — the gap list that seeds the Handlebars/Mustache bundle #2114). `--check` fails the gate on drift.

Follow-on: #2114–#2119 each author one flavor's bundle + score it through this same scorer; the anticipated mid-region-marker gap (`{{else}}`/`{:else}`/`@else`) gets its decision card from the first confirming gap list here, not a guess.
