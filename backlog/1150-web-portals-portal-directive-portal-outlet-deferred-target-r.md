---
type: idea
workItem: story
size: 8
parent: "1001"
status: open
blockedBy: ["1148", "1149"]
dateOpened: "2026-06-19"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — portal directive + portal-outlet + deferred target resolution

Slice of #1001 (after #1148/#1149): the high-level API, built in `we:plugs/webportals/`. `PortalDirective` extends `CustomTemplateDirective` — `target`/`disabled`/`required`; resolves the outlet (present→attach; absent→deferred-by-default attach-or-observe via the shared root `InjectorRoot` observer; `required`→synchronous throw; unresolved warned at a STRUCTURAL trigger, DOMContentLoaded / one rAF, never a wall-clock timeout), sets `logicalParent` to the declaration element, wires event proxying (retarget host = declaration element), cleans up on disconnect. Plus the `portal-outlet` element (ordered portals + `onportalchange`) and the `disabled` in-place fallback. Fork-4 residual: confirm the `InjectorRoot` observer is document-rooted; if subtree-scoped add ONE timer-free root-level fallback (never one per portal). Per #1000 Fork 4.
