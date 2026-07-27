# Operational state store — session-local sidecars now, a shared durable store (DO/D1) at product

Prep trace for decision #2626. Full prepared record lives on the item (`we:backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-.md`); this is the durable reasoning trace.

## Question

Do the conveyor's transient operational-state artifacts stay session-local gitignored sidecars, or move to a shared durable store (Cloudflare Durable Objects / D1) — and when?

## Grounding — the sidecar inventory today (from `we:.gitignore` + `we:scripts/conveyor/`)

Shared-truth (a session-free product with multiple actors must read cross-process): `we:.conveyor/queue.json` (cleared-for-build queue, #2613, already behind the store seam `we:scripts/conveyor/queue-store.mjs`); `we:.conveyor/jury/*.jsonl` (jury event ledger, #2641, one shared fold `we:scripts/lib/jury-ledger.mjs`, two consumers — the conveyor tick and the plateau-app #2642 console); `we:.conveyor/infra-blocked.json` (#2659).

Machine-local (local by nature, never migrate): advisory `we:.conveyor/*.lock` (#2681, subsumed by a single-threaded DO), `we:.claude/lane-ports.json`, the learnings drop-box `we:.conveyor/learnings/` (#2614). The runner lease `we:skills-src/conveyor/runner-lock.mjs` (#2702) is HOME-level and bundles two concerns — see the split below.

## Findings (after a red-team + fresh-context screen)

1. **The timing question is not a ratifiable fork — it dissolves.** Both "DB now" and "DB later" end at DO/D1 at the product; strip cost + substrate-readiness and no merit unknown survives; the transition is forced by physics (a product process not sharing the operator's filesystem cannot read a gitignored sidecar). Per #2092 it dissolves to accepted-on-merit + a tracked trigger, not a weigh.

2. **The one genuine live fork is the runner lease.** A single machine-global HOME lock cannot arbitrate two machines. The lease bundles a machine-local process singleton (stays local forever — a DO can't tell if a process is alive on your host) with cross-actor write-arbitration (DO-shaped iff runners go multi-host). "Machine-local forever" was too absolute; the ruling splits it. Default: split, arbitration migrates conditional on multi-host runners.

3. **Statute reconciliation.** This extends the *animating principle* of `#state-lives-where-its-nature-dictates` (rule-105) — "state lives where its nature dictates" — to a THIRD home (a shared durable store, neither committed git nor a #2302-guarded card) that rule-105's two-home git-vs-sidecar taxonomy never contemplated. Cite the principle, not the taxonomy. Rule-105 clause 1 names the queue as its type-case of session scratch; no collision, because the queue's nature is tier-dependent — session-scratch per-operator today, shared-truth at the product.

4. **The trigger has not fired yet.** The plateau-app console reads operational state through an `/api/backlog/overlay`-style HTTP boundary co-located with the session; it does not consume the jury ledger, and #2642 (the ledger console consumer) is still `open`/unbuilt. So DEFER holds today. The un-gate trigger is tracked by #xj5jzz5 (`blockedBy: #2703`).

## Recommendation

Accept-on-merit: DO/D1 at the product, shared-truth subset only. Ratify Fork 1(b): split the runner lease. Store lean: DO (single-writer lease / lane arbitration) + D1 (queryable queue/history) over MongoDB. Un-gate mechanism: #xj5jzz5.

Precedent: mirrors the already-ratified #2692 and #2701 (*interim mechanics local, durable at product*).
