---
type: idea
workItem: story
size: 3
parent: "1090"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webvalidation: commitment-policy standalone model (full/deferred)

New we:commitment-policy/ model (CommitmentPolicy/CommitContext per spec we:src/_includes/project-webvalidation.njk:103-164; built-in full + deferred) + CustomCommitmentPolicyRegistry mirroring we:plugs/webvalidation/CustomValidityMergeRegistry.ts:27-66. Pure model, no element wiring. Demo: unit asserts full commits on input, deferred buffers to blur/submit.
