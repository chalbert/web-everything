---
kind: decision
status: open
dateOpened: "2026-06-21"
tags: []
---

# Audit isExec build-kind vocabulary — which kinds gate G2/G3 now that idea/issue are gone?

The backlog-health audit's exec gate is dead vocabulary. After the kind-axis migration, the loader read fm.type (now always undefined; fixed to fm.kind in we:scripts/audit-backlog-health.mjs) AND the exec gate still tests it.type==='idea'||'issue' — kinds that no longer exist (current kinds: story/decision/task/epic). So G2 (built-ahead-of-ruling) and G3 (ungoverned-architecture) silently never fire. Decide which kinds are 'exec/build' for G2/G3: story/task/epic (all non-decision), or a narrower set (e.g. leaf builds only, excluding epic umbrellas). Likely collapses to a forced-invariant ratify (the broken branch — idea/issue — does not exist), but the epic-inclusion edge is a genuine small call. Surfaced 2026-06-21 while validating the G4 merit-vs-effort tell sharpening; the kind-field fix already resurrected G4-G7 (G4 now auto-flags #1457).
