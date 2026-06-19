---
type: idea
workItem: story
size: 3
parent: "1096"
status: open
blockedBy: ["1125"]
dateOpened: "2026-06-19"
tags: []
---

# webexpressions: explicit-API trigger parity (detached/self-replacing HTML insertion)

Cover the genuinely-detached APIs the observer cannot see (createContextualFragment/setHTMLUnsafe/outerHTML) by calling customTextNodes.upgrade, reusing the scaffold at we:plugs/core/utils/pathInsertionMethods.ts:46-49 and the pattern in we:plugs/webcomponents/Element.insertion.patch.ts:140-157 (spec we:src/_includes/project-webexpressions.njk:85-99). MECHANISM NOD NEEDED before batch — cross-plug boundary (#817/#854): recommend extending the existing webcomponents innerHTML patch rather than duplicating it. Demo: e2e per API.
