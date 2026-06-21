---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: open
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

**Scope settled by [#1347](/backlog/1347-does-1120-define-name-validation-apply-beyond-customattribut/)
(resolved 2026-06-21 → ruling (a), [we:docs/agent/platform-decisions.md#registry-name-guard-namespace](/docs/agent/platform-decisions.md)).**
Rename set is **CustomAttribute-only**: the parser / expression / text-node registry names
(`value`/`pipe`/`call`/`mustache`/`polymer`) **stay bare and are untouched**. This story therefore (i)
turns on the `#assertValidName` throw in `fui:plugs/webbehaviors/CustomAttributeRegistry.ts`, (ii)
renames only whichever bare *CustomAttribute* names exist (markup + companion `*-when` attrs +
`querySelector` call sites), and (iii) adds the one-line *"guard the namespace you share with the host"*
note to the base `we:plugs/core/CustomRegistry.ts` `define()` doc-comment so the rule is discoverable
there.

Demo: unit — `define('nohyphen')` throws `SyntaxError`, a hyphenated/colon name succeeds; full
`fui:plugs/webbehaviors` suite green.
