---
kind: story
size: 2
parent: "2387"
status: resolved
blockedBy: ["2394", "2395", "2396"]
dateOpened: "2026-07-10"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
scope:
  - we:skills-src/batch-backlog-items/SKILL.md
  - we:skills-src/batch-backlog-items/parallel-execute.workflow.js
  - we:skills-src/drain/SKILL.md
  - we:skills-src/finish/SKILL.md
  - we:docs/agent/backlog-workflow.md
---

# Document overlap-stacked serial batches end-to-end

Document overlap-stacking, the declared-locus authoritative file-set + push-time subset-of-declared contract, the proof-of-land gate + bornAs single-source contract, the two-lock model, the capability-marker rollout, push-at-close, and the partial-batch repair path across the batch-backlog-items / drain / finish skills and we:docs/agent/backlog-workflow.md; document the parallel path as siblings+deferred and why it differs.

## Progress

- **Status:** done (pending resolve).
- **Done:**
  - `we:docs/agent/backlog-workflow.md` — new **"Overlap-stacked serial batches — end-to-end (#2387)"** section under *Running a batch* (the single-source-of-truth narrative). Covers, in plain prose: overlap-stacking (union-find on declared file-sets, sibling / stack-on-frontier / bridge, depth cap), the declared-locus + `actual ⊆ declared` push-time re-check, the `bornAs` proof-of-land + single-source contract (excluded from the hash→NNN rewrite; ledger vs `bornAs`-on-main), the two-lock model (numbering mutex + whole-process lease), the capability-marker rollout (why stacking can't ship first), push-at-close (detached, lease-checked, correct-when-off), the partial-batch repair path (defer only true overlap-descendants; stowaway-proof), and **why the parallel path stays siblings + deferred**.
  - `we:skills-src/drain/SKILL.md` — new **"Stacked-chain couples — the proof-of-land gate (#2387)"** section: `stackParents`/`base` on the manifest, the positive gate (landed-this-pass or `bornAs`-proven, never ref-absence), the `bornAs` rewrite-exclusion, the couple-granular join, and the two-lock note. Points at the doc for the end-to-end narrative.
  - `we:skills-src/batch-backlog-items/SKILL.md` — pointer blockquote atop the existing overlap-stacking seam-wiring section to the doc's end-to-end narrative (skill = seam-wiring, doc = method).
  - `we:skills-src/finish/SKILL.md` — pointer from the stack-repair step to the doc (why the tail defers, the stowaway defense, `bornAs`-on-main).
  - `we:skills-src/batch-backlog-items/parallel-execute.workflow.js` — header comment documenting **no overlap-stacking; siblings + deferred, by construction**, and why parallel differs (no predecessor tip; drain rebase-retry at land time).
- **Next:** resolve.
