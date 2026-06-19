---
type: idea
workItem: story
size: 2
parent: "1095"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webbehaviors: hyphen-in-name validation on define()/defineLazy()

Enforce the spec hyphen requirement (we:src/_includes/project-webbehaviors.njk:83) in we:plugs/webbehaviors/CustomAttributeRegistry.ts:178,227 (throw on a name without a hyphen, mirror customElements.define SyntaxError). Includes renaming existing hyphen-less test fixtures (tooltip/clickable to hyphenated). Demo: unit, define('nohyphen') throws, define('my-attr') succeeds.
