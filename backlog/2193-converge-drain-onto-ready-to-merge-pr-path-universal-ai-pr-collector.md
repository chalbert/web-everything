---
kind: epic
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
relatedTo: ["2162", "2188", "2153", "2138"]
---

# Converge /drain onto the ready-to-merge PR path and make it the universal AI-PR collector (#2188 follow-on)

**The `/drain` skill was never converged onto the #2188 label-lander substrate.** Under #2183/#2188 a
producer no longer marks a `we:queued.json` couple — it **opens a `ready-to-merge` PR per item**, landed by the
ONE label-scoped lander `we:scripts/merge-ai-prs.mjs --label=ready-to-merge`. But `/drain` (and
`we:scripts/lane-drain.mjs`) still poll the legacy `we:queued.json` queue, which producers no longer populate —
so `/drain watch` idles forever on an empty queue while real producer output (the labelled PRs) piles up
unattended. Observed live 2026-07-03: `/drain watch` reported "queue drained/stuck" for 50+ idle polls while
PRs #40/#41/#42 sat open with the `ready-to-merge` label; only a manual `we:scripts/merge-ai-prs.mjs
--label=ready-to-merge` landed #41.

**End-state:** `/drain` **is** the label lander with a watch loop, the label-scoped merge accepts
mixed-authorship AI PRs, and **every** AI-edit path (not just `/workflow`) tags its PR `ready-to-merge` — so
the drain becomes the single collection point for all AI-generated work, whatever session shape produced it.

## Slices

- **#2194 — converge `/drain` onto the label lander + add `--watch/--interval`.** Retire the `we:queued.json`
  poll from the drain trigger; `/drain` routes to `we:scripts/merge-ai-prs.mjs --label=ready-to-merge`, which
  today is **one-shot** — add the missing `--watch`/`--interval`/`--max-idle` poll loop (parity with the old
  `we:scripts/lane-drain.mjs` watch). *Ready now — core.*
- **#2195 — relax the AI-gate on the label-scoped path** so a labelled PR collects even with mixed human+AI
  commits (green + mergeable still enforced). *blockedBy #2196 — must not land before the label is
  producer-certified, or it opens an unreviewed-merge hole.*
- **#2196 — every AI-edit path applies the `ready-to-merge` label**, not just `/workflow` (`/pr`, solo #2123
  lanes, `/batch` closeout, …). *Ready now.*

## The coupling to lock (contract)

Slices #2195 and #2196 are **coupled**: relaxing the every-commit-AI gate (#2195) makes the `ready-to-merge`
label the **sole authorization** for auto-merging human commits unreviewed. That is safe **only if** the label
is applied exclusively by a deliberate producer/closeout step (#2196) — never by hand casually. So #2195 lands
**after** #2196, and the invariant "`ready-to-merge` means a producer certified this couple" is the contract
the relaxed gate depends on.

The legacy `we:queued.json` / `we:scripts/lane-drain.mjs` path stays as a no-op fallback for any stragglers but
is no longer the `/drain` trigger's primary mechanism.
