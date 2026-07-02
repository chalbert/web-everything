---
kind: decision
parent: "2079"
status: open
relatedReport: reports/2026-07-02-backlog-split-analysis.md
dateOpened: "2026-07-02"
tags: []
---

# Spec register — home, skeleton house style, and scope policy for normative WE specs

Decides where a W3C-spec-shaped normative write-up lives and in what form (per-standard file, njk section, or a new gated collection), the skeleton house style (section order, RFC-2119 boilerplate, conformance-class + error-model convention, IDL convention — shape template: the #2074 conformance table), and the scope/maturity policy: which of the 279 registry standards (81 blocks / 98 intents / 59 plugs / 41 protocols) owe a spec at which status tier. Gates every authoring wave of epic [#2079](/backlog/2079-author-w3c-spec-shaped-normative-standards-for-every-we-stan/).

## Forks

1. **Home + form.** Where does a per-standard normative spec live, and in what format? No surface exists
   today: a block's prose is an njk description partial (`we:src/_includes/block-descriptions/<id>.njk`),
   an intent's is an inline JSON `description` field, a plug is a bare 10-line registry entry, a protocol
   points at a section of its owning project page. Candidate shapes: extend the existing per-category
   prose surfaces with a normative section; a new one-file-per-standard spec collection with its own
   detail pages (the `we:src/research-topic-pages.njk` pattern, gate-required like research partials); or
   a structured JSON conformance field the templates render. The choice sets the gate story
   (`check:standards` can require a spec per in-scope standard) and the authoring ergonomics for ~N specs.
2. **Skeleton + house style.** Section order, the RFC-2119 conformance boilerplate, the
   conformance-class + error-model convention (every rejected input names its typed error — the
   [#2074 conformance table](/backlog/2074-customnoderegistry-node-kind-extensibility-standard/) is the
   shape template), and the IDL/interface-definition convention. The codify step of ratification authors
   the skeleton doc itself.
3. **Scope + maturity policy.** Which standards owe a spec at which status tier. Writing MUST/MUST-NOT
   prose for a `concept`/`poc` stub is undone design work in disguise — a maturity ladder (e.g. `active`
   blocks first; stubs exempt until designed) decides the real work-list, and therefore the contents and
   size of every downstream authoring wave. Includes confirming the pilot choice
   ([#2097](/backlog/2097-pilot-normative-spec-customnoderegistry-2074-in-the-ratified/) proposes
   CustomNodeRegistry, whose conformance spine already exists).

Grounding: we:reports/2026-07-02-backlog-split-analysis.md (the `/slice 2079` work-investigation pass).
