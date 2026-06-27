---
kind: story
size: 5
parent: "1836"
status: resolved
blockedBy: ["1842"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/plugs/webcontexts/Node.contexts.patch.ts
tags: []
---

# webcontexts + webinjectors unplugged ergonomics — out-of-band (WeakMap) equivalent of the Node.contexts / Node.createElement prototype walk, or mark plugged-only

Re-audit #1840: the ergonomic surfaces are prototype patches — fui:plugs/webcontexts/Node.contexts.patch.ts (Node.prototype context resolution) and fui:plugs/webinjectors/Node.injectors.patch.ts:101 (Document/Node.createElement auto-attach). Neither has an unplugged equivalent or test. Provide the out-of-band WeakMap-keyed equivalent with an unplugged test, OR mark them plugged-only residue per #1839. Blocked by #1842 (shared WeakMap attachment pattern). Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.
