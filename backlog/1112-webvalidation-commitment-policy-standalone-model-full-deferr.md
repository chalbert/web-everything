---
kind: story
size: 3
parent: "1090"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:commitment-policy/provider.ts"
tags: []
---

# webvalidation: commitment-policy standalone model (full/deferred)

New we:commitment-policy/ model (CommitmentPolicy/CommitContext per spec we:src/_includes/project-webvalidation.njk:103-164; built-in full + deferred) + CustomCommitmentPolicyRegistry mirroring we:plugs/webvalidation/CustomValidityMergeRegistry.ts:27-66. Pure model, no element wiring. Demo: unit asserts full commits on input, deferred buffers to blur/submit.

## Progress

Shipped the standalone dependency-free `we:commitment-policy/` model (mirrors `validity-merge/`):
- `we:commitment-policy/contract.ts` — `CommitContext` (fieldId/event/value/validity/interaction/
  submitted/validationPending) + `CommitmentPolicy` interface (shouldCommit, onValueInput, the staleness
  observables getValidationSync/Generation/Timestamp, dispose), per spec njk:103-164. Types only.
- `we:commitment-policy/provider.ts` — built-in `FullCommitmentPolicy` (commits on every event) +
  `DeferredCommitmentPolicy` (buffers on input, commits on blur/submit/explicit), over a shared
  `BaseCommitmentPolicy` tracking per-field generation/timestamp/sync (onValueInput bumps + marks stale; a
  settled-validation decision marks current). `assertCommitmentPolicy` surface guard.
- `we:commitment-policy/registry.ts` — `CustomCommitmentPolicyRegistry` mirroring
  `we:plugs/webvalidation/CustomValidityMergeRegistry.ts:27-66`: `register(name, policy, asDefault?)` /
  `define(policy)` value-first / `getProvider(name?)` with default fallback + `UnknownCommitmentPolicyError`
  (name/key agreement enforced). `we:commitment-policy/index.ts` + `createDefaultCommitmentPolicyRegistry()`
  (full default + deferred).
- `we:commitment-policy/__tests__/commitment-policy.test.ts` — 8 green (full commits on input, deferred
  buffers to blur/submit/explicit, staleness generation/timestamp/sync, dispose, registry resolve/default,
  name/key mismatch + unknown lookup). Registered the dir in `we:vitest.config.ts`.

Pure model, no element wiring (the runtime plug fulfils the same API later, like CustomValidityMergeRegistry
does for validity-merge/). WE `check:standards` 0 errors.
