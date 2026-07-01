---
kind: story
size: 3
parent: "1994"
status: open
dateOpened: "2026-07-01"
tags: []
---

# Migrate view:if + view:switch directives onto CustomTemplateType (dead-on-site)

Slice A of #1994. Convert ViewIfDirective + ViewSwitchDirective off CustomAttribute onto CustomTemplateType (typed `<template>`, registered by type value per #1993 spelling: condition/match). Move #private marker/state init into connectedCallback (chunk-2 re-prototype constraint: upgrade() re-prototypes, runs no constructor). Drop the two define calls from registerViewDirectives (view:show stays a behavior). Both are dead-on-site (registerViewDirectives never called in either bootstrap) so no live regression is possible; tests drive a local customTemplateTypes.upgrade. Independent — batchable now.
