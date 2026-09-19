---
bornAs: xc1idt1
kind: epic
parent: "3456"
status: open
blockedBy: ["3610"]
dateOpened: "2026-09-07"
tags: []
---

# Hardware-usage-aware heavy-command capacity control — a staged self-learning admission project

The operator reviewed we:scripts/readiness/heavy-admission.mjs's flat cap=2 semaphore (#3461, ratified #3456) and judged it naive for a real project: it counts commands, not actual host headroom. #3456 already named this explicitly as future work it deliberately did NOT ship in v1 — 'a measured/adaptive classifier' and 'real-time adaptive load-sampling... would better address the actual root cause... not shipped in v1 only because that measurement/hysteresis layer does not exist anywhere in this repo yet.' This epic is that deferred project, staged rather than big-bang: Stage 1 real CPU/memory usage sampling correlated with heavy-admission slot data (visibility only, no policy change — first buildable slice filed as its own story, built on/with we:backlog/3569-a-rolling-24h-delivery-capacity-monitor-artifact-lane-utiliz.md's rolling-24h capacity monitor rather than a second parallel telemetry pipeline, since both need the same underlying host-usage + heavy-command-correlation data); Stage 2 a simple adaptive policy (e.g. an EWMA-based headroom estimate driving a dynamic concurrency cap in place of the fixed constant, mirroring how GNU Parallel's --load polls ps for an instantaneous signal rather than the too-slow os.loadavg(), per #3456's own prior-art survey we:reports/2026-09-02-heavy-command-admission-queue.md); Stage 3 a genuinely learned/self-correcting policy (per-command weighting, degree-of-parallelism tuning, lane/checkout-level slack reservation) — substantially more complex, and this epic is explicit that Stage 3 is not assumed worth building until Stage 1/2 evidence shows the fixed-cap and simple-EWMA approaches are actually insufficient in practice. Checked and confirmed empty before filing: no OS-level resource sampling anywhere in this repo (no os.cpus()/os.freemem()/os.loadavg() call site), no ps/sample-based process inspection outside we:skills-src/inspect-agent-health's unrelated transcript-reading approach, and no existing adaptive-threshold/self-learning pattern for host resource management to reuse conventions from — this is genuinely new ground, not a reinvention. Ruled out as irrelevant prior art: we:backlog/729-capacity-provider-device-resource-detection-axis-composite-m.md / we:backlog/767-build-capacityprovider-contract-device-capacity-vocabulary-s.md are a browser-client device-capacity WEB STANDARD (navigator-style end-user device detection), a different domain from host-side dev-machine scheduling for the mechanical dispatcher.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
