---
type: idea
workItem: story
size: 3
parent: "1090"
status: open
blockedBy: ["1112", "1110"]
dateOpened: "2026-06-19"
tags: []
---

# webvalidation: live commitment plug + staleness data-validation-* surface

we:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts live injector-chain registry (mirror we:plugs/webvalidation/CustomValidatorResolutionRegistry.ts:28-67), wire <validity-merge-field> to resolve per-scope and reflect data-committed/data-validation-sync/-generation/-timestamp (spec we:src/_includes/project-webvalidation.njk:198-206); define in we:plugs/bootstrap.ts. Shares the attr-reflection seam with slice 1. Demo: e2e deferred field shows stale then current.
