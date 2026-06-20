---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: open
blockedBy: ["1347"]
dateOpened: "2026-06-20"
tags: [plugs, webbehaviors, naming, validation]
---

# Enforce #1120 name-validation throw in fui:webbehaviors + rename in-scope bare CustomAttribute names

Mirror WE #1120 (size 2) into `fui:plugs/webbehaviors/CustomAttributeRegistry.ts`: turn on the throwing
`#assertValidName` guard (hyphen-**OR**-colon, mirroring the `SyntaxError` of `customElements.define`).
Then rename whichever bare CustomAttribute names
[#1347](/backlog/1347-does-1120-define-name-validation-apply-beyond-customattribut/) rules in-scope —
markup + companion `*-when` attrs + `querySelector` call sites. Carved out of #1333 (`/slice`
2026-06-20).

**Blocked by [#1347](/backlog/1347-does-1120-define-name-validation-apply-beyond-customattribut/)** —
the naming-scope decision sets the rename set: under its lean (a, CustomAttribute-only) the parser/
expression registry names (`value`/`pipe`/`mustache`) stay bare and only bare *CustomAttribute* names
rename; under (b) the parser-registry names rename too.

Demo: unit — `define('nohyphen')` throws `SyntaxError`, a hyphenated/colon name succeeds; full
`fui:plugs/webbehaviors` suite green.
