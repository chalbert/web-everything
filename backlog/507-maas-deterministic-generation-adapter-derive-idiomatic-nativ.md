---
type: issue
workItem: epic
parent: "081"
status: resolved
blockedBy: ["505", "506"]
dateOpened: "2026-06-13"
dateResolved: "2026-06-15"
graduatedTo: none
relatedReport: reports/2026-06-14-backlog-split-analysis.md
tags: []
---

# MaaS deterministic generation-adapter — derive idiomatic native origin per language (AI-improved adapter, human-reviewed) + first .NET/Java target

Ratified in #463 (fork a): build the deterministic generation-adapter that derives an idiomatic, native MaaS origin per language (own repo) from the neutral contract (#505). Generation is deterministic — same source always yields byte-identical code; NO AI in the generation path. AI operates at adapter-development time only: it improves the deterministic adapter (rules/templates, against a regression corpus) until output is perfect-idiomatic — every change human-reviewed (a full-AI cycle is out of scope now). Deterministic-core / HTTP-shell split; fidelity gated by the #506 suite. Ships a first native target (.NET or Java) as proof; Wasm is exotic-only; runtime stays AI-free pure-native.

## Sliced into agent-ready children (epic — 2026-06-14)

Split analysis: [reports/2026-06-14-backlog-split-analysis.md](../reports/2026-06-14-backlog-split-analysis.md). Pure volume — the fork was settled in #463 fork a; both inputs (#505 neutral-contract IR, #506 conformance suite) are resolved.

- **#547** — Generation-adapter core: deterministic IR→emit engine + core/shell split (proof: regenerate the JS reference origin byte-identically). *No blocker.*
- **#548** — First foreign native target: **.NET** backend. *blocked-by #547.*
- **#549** — Conformance-gate the generated .NET target through #506. *blocked-by #548.*
- **#551** — Adapter dev-time regression corpus (no AI automation). *blocked-by #547, parallels #548/#549.*

Spine `#547 → #548 → #549`, with `#551` branching off `#547` in parallel. **.NET** chosen as first foreign target (which-first prioritization, not a fork); **Java** is a future sibling target reusing #547 / #549 / #551.
