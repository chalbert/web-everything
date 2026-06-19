---
type: idea
workItem: story
size: 3
parent: "1090"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webvalidation: validation.control.* stable-id event surface

Emit spec stable-id events (we:src/_includes/project-webvalidation.njk:184-196) from we:plugs/webvalidation/ValidityMergeField.ts:183-191,156-165 and validate-start/end from we:plugs/webvalidation/AsyncValidatorField.ts:77-83; keep legacy validity-merge event. Demo: e2e asserts events fire with correct detail on input/blur/async-resolve.
