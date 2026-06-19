---
type: idea
workItem: story
size: 3
parent: "1091"
status: open
blockedBy: ["1115"]
dateOpened: "2026-06-19"
tags: []
---

# webcontexts: strict vs flexible lookup modes consulting claim()

Add a claim-aware resolution path to we:plugs/webcontexts/Node.contexts.patch.ts:78-91,152-159: strict = first claim()-ing context; flexible = walk the injector chain when a provider declines (spec we:src/_includes/project-webcontexts.njk:78-79,95). Default flexible per the Most-Flexible-Default rule (#911) — note it in the body, do not re-decide. Demo: integration test, child declines so flexible resolves to parent, strict to child.
