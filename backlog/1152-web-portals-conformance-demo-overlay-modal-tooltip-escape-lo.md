---
type: idea
workItem: story
size: 5
parent: "1001"
status: open
blockedBy: ["1150"]
dateOpened: "2026-06-19"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — conformance demo (overlay/modal/tooltip escape + logical bubbling)

Final slice of #1001 (after the directive #1150): a real-browser conformance demo under we:demos/ (the webidentity/webmanifests pattern) exercising the full stack — a deeply nested component portals a modal/tooltip/toast to an outlet that escapes its stacking context, while CONTEXT preservation (getContext via logical ancestry) and LOGICAL event bubbling (a click/submit inside the portal firing a handler on the logical ancestor via composedLogical) both verifiably hold. Doubles as the platform-first forcing function for #1148/#1149/#1150. Wired into the demo registry + dev-server fallback + quality gates per the new-demo skill.
