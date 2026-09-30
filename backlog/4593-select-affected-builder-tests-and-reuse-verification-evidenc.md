---
bornAs: x990o2k
kind: story
size: 5
status: open
dateOpened: "2026-09-30"
tags: []
---

# Select affected builder tests and reuse verification evidence for unchanged inputs

The 4295 worker spent 10.42 minutes in test-bearing calls, including 7.65 minutes in two broad runs. Separate useful regression coverage from redundant execution; bind reusable evidence to tree, toolchain, suite and environment. See we:reports/2026-09-30-builder-postmortem.md.

## Evidence and cost

T4295 lines 109–111 and 159–160 in the report source index: **7.65 minutes** in two broad test-bearing calls, within **10.42 minutes** of worker testing. The second followed a failed edit. T4341 lines 71–78 show a **0.08-minute** no-edit WIP suite repeat. Wrapper verification totaled **39.27 minutes** across the cohort; this is gross cost, not all redundant. T4336 lines 34–42 took 0.03 minutes for targeted tests while verify record `9f4f7e2d-b9bb-472e-adf7-e2b363260c0f` took 7.01 minutes.

## Root cause and change

Worker tests and wrapper verification do not share selection rationale or reusable evidence identity. Extend the existing diff-selected gate with receipts keyed by tree, dependency lock, toolchain, environment and suite. Explain selected coverage and instrument admission versus execution; use exact-input reuse only. A new source change invalidates affected evidence; mutation RED tests stay intentional. Diagnose the seven-minute gate before claiming its cause.

## Done when

Add tests at the existing verification planner seam proving unchanged inputs reuse evidence, changed source/dependencies/environment invalidate it, and missing evidence fails closed. Live proof: run an unchanged repeated gate and an edited-tree gate; the first reuses valid covered results, the second executes required impacted tests. Preserve standards and final required coverage. Report measured admission/execution savings, never just fewer commands.
