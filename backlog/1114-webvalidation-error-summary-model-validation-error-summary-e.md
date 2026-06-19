---
type: idea
workItem: story
size: 3
parent: "1090"
status: open
blockedBy: ["1111"]
dateOpened: "2026-06-19"
tags: []
---

# webvalidation: error-summary model + validation-error-summary element

New we:error-summary/ model (DOM-ordered aggregation + field-link, spec we:src/_includes/project-webvalidation.njk:52,221) + we:plugs/webvalidation/ValidationErrorSummary.ts element (role=alert, DOM-ordered, focus-on-blocked) listening to the slice-2 control.* events; define in bootstrap. Demo: e2e submit with 2 invalid fields lists both, click focuses field.
