# Build-queue prioritization — prior-art survey

**Date:** 2026-07-16 · **For:** decision `we:backlog/xuzne08-plateau-build-queue-prioritization-system-design-forks.md` · **Parent:** [#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/) (Plateau Loop coordinator)

The Plateau Loop's AI-build UI needs a **full but configurable** prioritization system: the user decides which backlog items an autonomous agent builds next, and in what order. This surveys how leading backlog / project-management systems model prioritization, plus the queue-scheduling theory for an agent that drains a queue one item at a time. Three parallel surveys (dev issue-trackers · scoring frameworks · configurability + queue scheduling); findings converge.

## 1. Dev issue-trackers (Jira, Linear, GitHub Projects, Shortcut, Azure DevOps, GitLab)

- **Importance and sequence are always two different fields.** A coarse *priority* (4–5 fixed buckets — Linear/Shortcut deliberately refuse more) and an exact *rank/order*. Jira states it outright; Azure hides its order field so people don't conflate it with Priority.
- **Manual rank is stored as a "between-able" key** so a drag is one write, not a renumber: **LexoRank** string (Jira), `Double` stack-rank (Azure), `relative_position` (GitLab), fractional index (Linear/GitHub). Keys drift longer → periodic background rebalance.
- **None ship native numeric scoring** (RICE/WSJF/…). It's always a plugin or a hand-entered number field you sort by. The market treats scoring as opt-in, not a primitive.

## 2. Scoring frameworks + product tools (Aha!, Productboard, Jira Product Discovery, ClickUp, Asana)

- **RICE / WSJF / ICE / weighted-scoring are all the same engine** — `Σ(criterion × weight)` — offered as presets or user-built formulas. No serious tool hard-locks one framework.
- **WSJF** (`Cost of Delay ÷ Job Size`, SAFe) is a *sequencing* model — the closest fit to "what does the machine pull next." Its numerator (value + time-criticality + risk/opportunity-enablement) captures what matters for a build queue; RICE's effort/reach discounting matters less when an agent (not a team) does the build.
- Purpose-built discovery tools give first-class **weighted-criteria editors** (define criteria, weights sum to 100%, normalize count-like inputs so Reach doesn't dominate); general trackers bolt it on via formula fields with real limits.
- Computed scores stay **advisory** — they sort a column; a human can still reorder. Override kept legible, never a baked "+1000 fudge" in the score.

## 3. Configurability as data + queue scheduling

- **Config lives in one place, logic in one formula:** items store raw input fields; a single read-only formula (Notion/ClickUp pattern) derives the score. Change weights once → everything re-ranks. Version the config for audit.
- **Divergent human priorities → saved views** (filter+sort over the same data), personal vs shared — not per-user mutation of the shared queue.
- **Strict priority starves low-priority work; the fix is aging** — raise effective priority with wait time (classic +1/interval). Tune gently or aged items burst through all at once (oscillation pathology).
- **WIP=1, non-preemptive** for an autonomous builder: a build is a costly stateful unit — let it finish, decide "next" exactly once per completion. FIFO tie-break within a tier for determinism.

## Synthesized model (fixed skeleton + configurable score)

**Fixed primitives:** (1) readiness gate — only ready items eligible (we already compute this via `we:scripts/check-readiness.mjs`); (2) manual rank — a LexoRank field, drag-to-order; (3) a coarse tier (pin); (4) deterministic next-to-build = `filter(ready) → sort(tier, effectiveScore↓, rank, createdAt) → first`, WIP=1, non-preemptive.

**Configurable score:** one weighted engine, WSJF-shaped. Many inputs already exist in our backlog — `JobSize ← size`, `unblocks-others ← blockedBy graph`, `readiness ← status/deps` — so only Value / Time-criticality / Confidence are new human inputs. Aging folded into the score, capped below `pinned`. User edits weights / criteria / aging rate; stored as one versioned config object.

## Sources

Jira LexoRank & priority schemes; Linear priority + manual order; GitHub Projects custom fields/views; Shortcut stack-rank; Azure stack-rank/backlog-priority; GitLab label-priority + relative_position; SAFe WSJF; Intercom RICE; Aha!/Productboard/Jira-Product-Discovery weighted scorecards; Notion/ClickUp formula fields; Figma fractional indexing; OS aging/starvation & WIP-limit / Little's-Law. (Full URLs in the three session survey transcripts.)
