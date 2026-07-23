---
bornAs: xn2zs79
kind: decision
parent: "2527"
status: open
dateOpened: "2026-07-23"
tags: [plateau-loop, conveyor, architecture, storage]
---

# Operational state store: session-local sidecars now, a shared store (DO/D1) at product

Discussed 2026-07-22: do we stand up a real DB now for the conveyor's queue plus other non-repo Plateau state, or keep today's session-local sidecar files until the product needs a shared store? Recommended default, for the human to ratify: **defer the DB.**

## Split state by its nature

Per the ratified [`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates):

- **Durable** state — backlog items, status, scope, PRs, merges — already has a single source of truth in **git + GitHub**. A DB there would be a **parallel store** (sync bugs, the "no parallel store" rule).
- **Transient operational** state — the queue, live lease coordination, in-flight tracking — genuinely can't live in git, and today uses **session-local gitignored sidecars**: `we:.conveyor/queue.json`, `we:.claude/lane-ports.json`, and the drain's `we:queued.json`.

A sidecar is sufficient for the single-operator interim conveyor. A DB's payoff — concurrent multi-actor coordination — only appears in the **PRODUCT**: a live UI operator + multiple sessions + the daemon, all writing shared state at once.

## Ruling direction (recommended default)

**Defer the DB. Keep the store-interface seam clean now** — put all transient state behind a small store module (e.g. `we:scripts/conveyor/queue-store.mjs`) so the file→DB/API swap is one implementation change — and stand up the shared store **only when the product is multi-actor**.

**On the store choice when the time comes:** prefer **Cloudflare Durable Objects** (single-writer lease / lane-arbitration coordination — exactly the hard part) + **D1** (queryable queue / history) over MongoDB. The constellation is already Cloudflare-shaped.

Left **OPEN** for the human to ratify.

Refs [#2527](/backlog/2527-plateau-loop-autonomous-ai-build-queue/) · [#2612](/backlog/2612-conveyor-skill-main-session-lane-operator/) · [`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates).
