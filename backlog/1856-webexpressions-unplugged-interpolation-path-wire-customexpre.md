---
kind: story
size: 5
parent: "1836"
status: open
dateOpened: "2026-06-27"
tags: []
---

# webexpressions unplugged interpolation path — wire customExpressionParsers/textNodeParsers/textNodes without bootstrap + e2e binding test

Re-audit #1840 found the headline webexpressions capability (`{{ }}`/`[[ ]]` interpolation) has no unplugged path: binding needs customExpressionParsers/customTextNodeParsers/customTextNodes set on a document injector, which fui:plugs/bootstrap.ts:195-221 builds but fui:plugs/unplugged.ts never does. Build an unplugged way to wire those registries (an unplugged-injector or injector-less seam) and an end-to-end interpolation-binding test. Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.
