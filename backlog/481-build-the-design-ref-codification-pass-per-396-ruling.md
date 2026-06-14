---
type: idea
workItem: story
size: 8
parent: "382"
status: open
blockedBy: []
dateOpened: "2026-06-13"
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, codification, paradigm-harvest]
---

# Build the design-ref codification pass (per #396 ruling)

Implement the codification pass ruled in [#396](396-design-ref-phase-3-vision-codification-of-the-corpus-into-in/):
the `analyzeForCodification` call on the shared Plateau vision client (a no-leakage second client,
per #475) over the gated corpus, turning reference screenshots into standards input. Per shot it
fills the *reliable* taxonomy facets + loose pattern notes; cross-shot it proposes candidate intents
for human ratification. Blocked on **#480** (wants the gated corpus + the shared vision-client seam).

## Spec (per #396 ruling — all forks ratified)

- **Per shot (F1):** fill only the reliable facets (`surface`, `productRegister`/`visualStyle`,
  `theme`, `layout`) into the `meta.json` sidecars + **loose, lossy-OK pattern observations** (free
  tags/notes). **No formal per-shot neutral structure** (would couple to unbuilt #086 and bake
  low-fidelity structure into the corpus).
- **Provider (F2):** `analyzeForCodification` is the *second method* on the shared vision client #480
  establishes — no separate integration; **no-leakage invariant** holds (only outputs reach the standard).
- **Harvest → candidate (F3):** cluster recurring paradigms across shots; propose candidates as a
  **session report + scaffolded `type:idea` candidate items** for human ratification via the
  new-standard flow. The formal standard-vocabulary / #086-neutral-structure expression lives **only
  at this reviewed promotion boundary**.
- **Soft dep:** the formal-promotion half leans on #086's neutral structure existing; until then,
  promotion proposes in loose form for a human to formalise.
