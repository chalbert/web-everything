---
kind: epic
status: open
ongoing: true
dateOpened: "2026-06-20"
tags: []
relatedReport: reports/2026-07-01-program-parity-loop.md
---

# Parity Loop

Umbrella epic carved from the #1225 charter (ratified, codified we:docs/agent/platform-decisions.md#reproduction-conformance). Reproduce top design systems (shadcn→Material→Ant→Carbon→Fluent) pixel- and behavior-perfect using ONLY WE intents + webtheme tokens over FUI primitives; the deliverable is the GAP LIST (what theme+intents can't express), not the copy — the exercise-app active-bypass=FAIL analogue. Per-target slices filed as separately prioritized (first: shadcn/ui). The AI-Playwright validator chain (#1167/#1219/#1220/#1221) is a CO-EVOLVING dependency (not a hard blockedBy per Fork 1); every parity claim gates on a confirmed layered-oracle measurement (fuzzy-pixel + structural diff + advisory VLM). Feeds gap-sweep #315.

## Goal-set — the 5 targets + measurement infra

Target systems (explicit sequence): **shadcn → Material → Ant → Carbon → Fluent**. Infra the north star
implies: the thin verdict/gap contract (#1227), a manifest→component loader (#2017), and the measurement
harness / compliance score (#2024). A parity claim requires a *rendered + measured* verdict — a declarative
token/intent scaffold alone is a **stub**, not a covered target.

## Review log

- **2026-07-01 — first run (front-A goal-completeness pass).** Ran the new /review-program completeness
  pass. Coverage **1/8 live** — only the thin contract (#1227) is genuinely in code. shadcn (#1243) is
  **resolved-but-stubbed** (declarative scaffold, nothing rendered/measured); Material/Carbon/Fluent exist
  only as ~5-token `-like` workbench presets; **Ant had no child at all**; both infra keystones (loader
  #2017, harness #2024) are unbuilt and dammed behind the `preparing` decision #2026. Filed the **2**
  goal-set gaps with no existing card: **#2031** (Ant flavor + gap list) and **#2032** (reconcile the
  resolved-but-stubbed #1243 vs the real shadcn flavor #2022). The rest were already filed in the
  2026-07-01 batch (#2017/#2022/#2023/#2024/#2025/#2026) — 0 duplicates. Front B (target-release currency)
  not run this round. Report: [we:reports/2026-07-01-program-parity-loop.md](../reports/2026-07-01-program-parity-loop.md).
  **Next run:** unblock the loader chain (#2026→#2017→#2024), re-measure coverage as flavors render, run the
  front-B target-release sweep.
