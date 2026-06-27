---
name: project_blocks_no_typecheck_gate
description: "WE never tsc-typechecks blocks/ — latent type errors ride along until FUI's @frontierui/blocks build catches them at"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b0823df-0773-4ade-bab0-d78bce1e29ce
---

WE has **no typecheck gate over `blocks/`**: `check:standards` skips the build entirely, and `build:plugs` is the tree-polluting footgun ([[project_build_plugs_pollutes_tree]], [[project_check_standards_skips_the_11ty_build]]). So a `blocks/` family can carry a **latent TS error that no WE gate catches** — it only surfaces when FUI's stricter standalone `@frontierui/blocks` build (`npm run build -w @frontierui/blocks`, `tsc -p`) compiles the family during the #658 migration cascade.

**Why:** discovered in batch 2026-06-15 — #695's `background-task-surface/reloadDurabilityAdapter.ts` had a feature-detect where `typeof reg === 'function'` narrowed a non-function object union to `never` (then `reg.prototype` errored). WE's toolchain didn't flag it; FUI's did. Real bug, invisible in WE.

**How to apply:** when migrating a `blocks/` family up to `@frontierui/blocks` (S2 slices of #658: #694✓/#695✓/#696/#704), run the FUI workspace build and expect it to surface latent type errors. The ratified fix is **option-A**: type-harden the feature-detect/cast in **both** repos' copies, kept byte-identical *to each other* (#170 guard) — e.g. cast `ServiceWorkerRegistration` to `(Function & { prototype?: object }) | undefined` so the `typeof === 'function'` guard narrows usefully. Pure type change, no runtime effect. The gap is transient — it closes when #658/#697 deletes WE's copies and repoints WE's build to `@frontierui/blocks` (the FUI build then *is* the gate).
