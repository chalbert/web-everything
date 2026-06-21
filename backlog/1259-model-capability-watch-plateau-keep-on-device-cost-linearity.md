---
kind: epic
ongoing: true
relatedReport: reports/2026-06-20-program-model-capability-watch.md
locus: plateau-app
status: open
dateOpened: "2026-06-20"
tags: []
---

# Model-capability watch

Candidate front-B watch program (Plateau-side): track the AI/LLM model landscape so Plateau's on-device cost-linearity assumptions and vision tiers stay current. Front A: the on-device classifier still meets its accuracy/cost floor. Front B: a new model changes what is feasible or affordable on-device → re-evaluate the vision-tier cascade and the cost-linearity calculus (no uncapped per-call SDK inside flat-rate pricing). L0/candidate. Affects the WE-consumed vision service only through Plateau's no-leakage client boundary. Lower priority; recorded so the watch is not lost.

## The two fronts

- **Front A:** Plateau's on-device classifier still meets its accuracy/cost floor.
- **Front B:** a new model shifts what is feasible or affordable on-device → re-evaluate the vision-tier cascade and the cost-linearity rule (no uncapped per-call SDK inside flat-rate pricing).

## Status — L0 / candidate

Plateau-side; reaches the WE-consumed vision service only through the no-leakage client boundary. Recorded so the watch is not lost; lower priority. Patterned after the platform-standards watch ([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)); classified per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/). Rolls up under the **Self-Driven Project** ([#666](/backlog/666-self-driven-project/)) as part of its monitor/upgrade autonomy.

## Review log

- **2026-06-20 — first run (L0→L1).** Swept the on-device model frontier (small VLMs, browser inference, native browser models). Front-B delta is **favorable** — the model world moved *toward* Plateau's on-device-fixed-cost thesis: small VLMs got far better/smaller (Gemma 3n/4 E2B, Phi-4 mm, Qwen 3.5, SmolVLM, UI-specialized ScreenAI/Ferret-UI), browser inference matured (WebNN/NPU, WeInfer ~3.76×), and Chrome ships a native built-in model (Prompt API / Gemini Nano). Filed 4 slices: #1276 re-eval Tier-2 model choice · #1277 WebNN/NPU + faster runtimes · #1278 defer to native Prompt API · #1279 front-A cost/accuracy floor metric. Front-A floor not yet defined (carved as #1279). Report: `we:reports/2026-06-20-program-model-capability-watch.md`. **Next run:** re-sweep deltas since 2026-06-20.
