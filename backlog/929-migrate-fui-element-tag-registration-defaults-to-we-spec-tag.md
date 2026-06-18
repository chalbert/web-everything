---
type: issue
workItem: story
size: 3
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: [frontierui, cem, conformance, tagname]
---

# Migrate FUI element-tag registration defaults to we-* spec tags (#908-A); flip the #844 gate to enforce

The #908-A downstream build the #844 gate's warns guide. Flip FUI's element-tag registration defaults to the we-* spec tagNames (custom-elements.json): the 5 hard-coded customElements.define literals (auto-complete→we-autocomplete, auto-heading→we-transient-component, background-tasks→we-background-task-surface, route-view→we-route-view, route-outlet→we-route-outlet) become register*(tag = 'we-…'), and the 2 already-parameterized defaults flip (page-nav→we-pagination, data-table→we-data-table). Pretty names live on as documented consumer overrides (#843). Then flip TAGNAME_GATE_ENFORCED=true in fui:scripts/check-standards.mjs so the #844 Check-2b gate promotes warn→error. locus frontierui. Ready: #844 gate + #908 ruling both landed.
