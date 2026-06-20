---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webportals/PortalDirective.ts"
tags: []
---

# Port we:plugs/webportals → fui:plugs/ (contract-anchored)

Full port of the 5-file webportals domain (PortalDirective, PortalOutlet, Event.logical.patch, Node.logical.patch, index) to FUI, contract-anchored. Consumer: webportals-conformance-demo.

## Progress

Ported the full webportals domain into FUI (FUI had no webportals plug):

- `fui:plugs/webportals/` — byte-replicated all 5 source files (`fui:plugs/webportals/PortalDirective.ts`, `fui:plugs/webportals/PortalOutlet.ts`,
  `fui:plugs/webportals/Event.logical.patch.ts`, `fui:plugs/webportals/Node.logical.patch.ts`, `fui:plugs/webportals/index.ts`) + `fui:plugs/webportals/conformance/ssrVectors.ts` + the 4
  unit tests (event/portal/ssr/logical). Cross-deps resolve to FUI's existing `../webinjectors/HTMLInjector`
  and `../webdirectives/CustomTemplateDirective` (the latter just reconciled in #1300). No `@webeverything`
  alias needed — the tests are self-contained with a local conformance vectors file.
- `fui:src/_data/plugs.json` — registered the `webportals` plug (type `Portal`), clearing the
  catalog-completeness gate for the new dir.

FUI webportals tests green (47). FUI `check:standards` red only on the 2 pre-existing
notification/signature-pad catalog errors (unrelated, stepped over). The WE-side copy stays for now
(its #449 retirement is out of this port's scope).
