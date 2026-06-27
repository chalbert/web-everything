---
kind: decision
size: 3
parent: "1855"
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-program-model-usage-watch.md
tags: [memory, write-time, dedup, metadata, model-usage-watch]
---

# Sharpen memory write-time discipline — UPDATE/DELETE/NOOP + recency metadata

**Prepared 2026-06-27.** The 2025–2026 literature treats contradiction-avoidance as a per-write discipline (*Mem0* ADD/UPDATE/DELETE/NOOP) and tags facts with recency+importance (*Generative Agents*). Prep + a skeptic pass found **both proposals largely redundant with the existing four rules** ([we:docs/agent/memory-management.md](../docs/agent/memory-management.md)); both original defaults were **refuted**. The prepared call is narrow — essentially *no new policy*, with one optional one-line wording tweak.

## Concern 1 — adopt explicit ADD/UPDATE/DELETE/NOOP classification? (validation-gate, not a fork)

*Standing test → not a fork.* Rule 3 (`we:docs/agent/memory-management.md:43-46`) already mandates UPDATE-in-place ("update that file"), DELETE ("prune superseded / disproven on sight"), and one-canonical-per-idea (no co-existing contradictions); rule 4 (`:48`) adds merge-at-budget. The Mem0 4-way scheme adds only **NOOP**, which is vacuous for a human author (deciding a fact is noise = simply not writing it). No excluded coherent branch exists — only a go/no-go on importing the classifier as wording.

- **Verdict: NO-GO** on the 4-way classifier. *Optional residual:* tighten rule 3 to name the **conflict→delete** case in one line, so the existing discipline reads as proactive. No parallel rule.
- *Skeptic: REFUTED the original "adopt it" default.* Mem0's classifier constrains an LLM doing automated extraction at scale against a vector store; this is a 142-file hand-maintained corpus with no scorer, so the scheme is process-theater with zero behaviour change over rules 3+4 — and risks making the policy *look* like it needs tooling it lacks.

## Fork 1 — per-fact freshness metadata

*Fork-existence:* a genuine either/or — you either stamp a freshness field on every memory or you don't; the states can't coexist and each is internally coherent (unlike Concern 1).

- **(a) None — default.** Status quo; when freshness is genuinely needed it comes from **git's last-touched** per file (free, never rots). Pruning stays rule-3 prune-on-sight.
- **(b) Minimal `last-affirmed` date** — *rejected.* A frontmatter date with no automated writer rots within weeks (only updated when a human happens to edit the file), then reads authoritative while stale — worse than none, and misleads any consolidation pass that trusts it.
- **(c) Full recency+importance scores** — *rejected.* No retrieval scorer exists to consume importance weights; pure overhead (and it's the eviction infra #1868 already deferred).
- *Skeptic: REFUTED the original "minimal last-affirmed" default → flipped to (a) none.* An unmaintained stamp is misleading and plants the first field of the scorer we rejected; git already records last-touched for free.

Concrete shapes (the fork turns on a frontmatter field):

```
# (b) rejected — a date with no automated writer, only as fresh as the last unrelated edit:
metadata:
  last-affirmed: "2026-06-27"

# (a) default — no field; read freshness from git when actually needed:
git log -1 --format=%cs -- <memory-file>.md
```

Optional rule-3 wording tweak (the only residual from Concern 1):

```
3. One canonical memory per idea. … update that file … When a new fact *conflicts*
   with an existing memory, delete the stale one (don't let both stand). Prune
   superseded / disproven memories on sight.
```

## Net prepared recommendation

Largely **status quo** — the existing rules already deliver the discipline these proposals describe. Ratify: **no 4-way classifier, no freshness field**; optionally apply the one-line rule-3 conflict→delete tweak. A low-leverage decision — safe to ratify fast (or close as no-change).

## Boundaries / lineage

Scope is the **policy + `we:scripts/check-memory.mjs`** surface only — no embeddings/graph store (separately judged not worth it at this scale). Surfaced 2026-06-27 in the second [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) watch run (front B literature sweep, gaps #2 + #3); prepared the same day via standing test + a refute-only skeptic pass, grounded against rules 3–4. Report: [we:reports/2026-06-27-program-model-usage-watch.md](../reports/2026-06-27-program-model-usage-watch.md).
