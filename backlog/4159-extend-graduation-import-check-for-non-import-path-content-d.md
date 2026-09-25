---
bornAs: x87prxg
kind: task
parent: "3443"
status: resolved
scope: ["we:scripts/graduation-import-check.mjs", "we:scripts/__tests__/graduation-import-check.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Extend graduation-import-check for non-import path/content-drift deps and cross-batch cycle safety

Live failure: #3906 dropped with 24 test failures in 7/22 files because we:scripts/graduation-import-check.mjs only scans static import statements, so it missed non-import dependencies on later/unordered sibling slices - a path built via path.join() (we:scripts/operations/deliver-item-run.mjs spawned by we:scripts/operations/dispatch-providers/build.mjs, owned by #3903), a vi.mock()-interleaved import block that broke the header-scan boundary (we:scripts/operations/prepare-scope-run.mjs, we:scripts/operations/__tests__/helpers/fake-claude.mjs), and content drift on files that already exist on main but whose branch delta has not landed (we:scripts/operations/completion-record.mjs missing kind task, we:docs/agent/dispatcher-runbook.md, we:skills-src/conveyor/fix-agent-brief.md). Worse, #3903/#3904/#3905 are already blockedBy #3906 while #3906 needs their files, an ordering the tool must detect as a cycle and resolve automatically. Extend the tool: (1) extractPathLiteralSpecifiers for join()/new URL()/bare literal path references, existence-gated at the snapshot; (2) content-drift detection promoting an on-main path to a later:#N hazard when an open sibling owns it and its snapshot content differs from main, excluding json data files and a cards own scope; (3) a moveIn fix path for the impl-file blockedBy-would-cycle case, relocating the specific dependency file into the importing cards own scope instead of the cycling edge; (4) a shared/multi-owner-file carve-out so a shared append-only file (we:scripts/operations/run.mjs) is never wholesale relocated, only added as a new co-owner; (5) createCycleGuard, a batch-level cycle backstop, since two findings computed independently in the same run can each look safe alone yet jointly close a cycle the per-finding wouldCycle check never sees. Also fixed importHeader to tolerate vi.mock() calls and simple mock-setup consts interleaved between import blocks, a real repo-wide test-file pattern the header boundary previously mis-terminated on.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/graduation-import-check.test.mjs` passes (100+ cases, including the new `extractPathLiteralSpecifiers`/content-drift/`createCycleGuard`/shared-file-co-owner suites).
2. **Live proof** — `node we:scripts/graduation-import-check.mjs --snapshot=600acc14f --parent=3443` reports the #3906 dependencies on #3903/#3904/#3905/#3907 the old tool missed; `--apply`, re-run to convergence (repeat until 0 findings), and a DFS cycle check over the full epic `blockedBy` graph shows no cycle.
3. **Executable** — `npm run check:standards` reports 0 errors.
