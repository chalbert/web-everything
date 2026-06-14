---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-14"
tags: []
---

# graduatedTo field hygiene — normalize to entity-id + check:standards rule

The #607 audit found graduatedTo is pervasively polluted: many entries hold multi-sentence implementation narratives instead of an entity id, and conventions are mixed (project:webcompliance vs bare webcompliance vs webcompliance/gate.ts vs prose). Project-id spelling also diverges between a project-creation item and its slices (weblifecycle #353 vs lifecycle #380/#391; webaudit #357 vs audit-trail #399), defeating entity-graph joins and the audit's lineage walk. Add a normalizer + a check:standards rule constraining graduatedTo to {project:|protocol:|intent:|block:|adapter:}<id> or a repo path, moving any narrative to the body. Unblocks reliable G3 lineage analysis.
