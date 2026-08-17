---
bornAs: xn2zs79
kind: decision
parent: "2527"
status: resolved
dateOpened: "2026-07-23"
dateStarted: "2026-08-17"
dateResolved: "2026-08-17"
codifiedIn: "docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates"
preparedDate: "2026-07-27"
ratifiedBy: "Nicolas Gilbert (operator)"
tags: [plateau-loop, conveyor, architecture, storage]
relatedReport: reports/2026-07-27-operational-state-store-sidecars-vs-durable.md
---

# Operational state store: session-local sidecars now, a shared store (DO/D1) at product

## Ruling (2026-08-17) — Fork 1 = (b) split, plus a vendor-abstraction amendment

**RATIFIED by the operator (Nicolas Gilbert) on 2026-08-17** — Fork 1 = **(b) split**: the runner lease's
process-singleton guard stays machine-local forever; its cross-actor arbitration half becomes a single-writer
Durable Object lease, conditional on runners ever going multi-host. The accepted-on-merit shared-store
migration (queue, jury ledger, infra-blocked recovery → DO/D1 at product) is confirmed, gated on the tracked
trigger already named below (#2703 retiring the main-session loop) — nothing about that timing was reopened.

**Amendment — vendor abstraction is a hard requirement, not an implementation nicety.** The operator's
explicit condition on ratifying: any Cloudflare-specific integration (Durable Objects, D1, or their SDK/API)
must sit fully behind an abstraction seam. Every shared-truth sidecar already routes through a pure-core store
module ([`we:scripts/conveyor/queue-store.mjs`](/scripts/conveyor/queue-store.mjs),
[`we:scripts/lib/jury-ledger.mjs`](/scripts/lib/jury-ledger.mjs),
[`we:scripts/conveyor/infra-blocked.mjs`](/scripts/conveyor/infra-blocked.mjs)) — the migration (#2742) must
keep Cloudflare-specific calls confined entirely to each module's io-shell, never leaking into the pure core or
into any consuming code path, so a future substrate swap away from Cloudflare (should one ever be needed)
touches one shell per artifact, never a rewrite. This generalizes beyond this one decision: the same seam
discipline applies to any future vendor-specific infrastructure integration, not just this store.

Codified as [`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
(a third-home corollary + the vendor-abstraction amendment), composing with — not altering — rule-105's
existing two-home taxonomy.

## Digest — what was decided

Do we stand up a real shared durable store now for the conveyor's operational state — the cleared-for-build queue plus the other non-repo Plateau state — or keep today's session-local sidecar files until the *product* is session-free and multi-actor? **Recommended: the shared store IS coming (DO/D1 at the product), that half is accepted on merit — so the only genuine call left is one sub-fork: how the runner lease splits.** Ruled above; the reasoning below is preserved as the record.

## Digest — what's actually being decided

Prep dissolved the headline "DB now vs later?" question: strip cost and substrate-readiness from it and **no merit unknown survives** — both branches end at DO/D1 at the product, and the transition is *forced by physics* (a product process that does not share the operator's filesystem cannot read a gitignored `we:.conveyor/` sidecar), not by judgment. So per the merit-conceded rule ([#2092](/backlog/2092-a-merit-conceded-not-yet-dissolves/)) the timing question is **not a ratifiable fork** — it dissolves to *accepted-on-merit + a tracked trigger* (you batch-confirm the concession, you don't weigh it). What is left genuinely open is **one live merit fork**: the runner lease (#2702) bundles a machine-local process guard with cross-actor write-arbitration, and "keep it all machine-local forever" is too absolute — the arbitration half is Durable-Object-shaped if runners ever go multi-machine. That is the fork below.

## What the operational state is today — the sidecar inventory

Every one of these is a **gitignored, session-local** file (grep `we:.gitignore`). None is committed repo state — that is the point: they hold *transient operational* state git can't hold. The right column is the migration verdict from the classification below.

| Sidecar | Item | What it holds | Verdict |
|---|---|---|---|
| [`we:.conveyor/queue.json`](.conveyor/queue.json) | #2613 | operator's cleared-for-build queue (intent) | **shared-truth → migrates** |
| `we:.conveyor/jury/*.jsonl` | #2641 | append-only jury event ledger — the console board's single source of truth | **shared-truth → migrates** |
| [`we:.conveyor/infra-blocked.json`](.conveyor/infra-blocked.json) | #2659 | resumable infra-blocked recovery handles (auto-retry/resume) | **shared-truth → migrates** |
| [`we:.conveyor/dispatch-log.json`](.conveyor/dispatch-log.json) | #2680 | dispatch→first-commit timing instrumentation | measurement (borderline; migrates if the product reports it) |
| `we:.conveyor/learnings/` | #2614 | per-session learnings drop-box, consumed at close | **machine-local → stays** |
| [`we:.conveyor/false-green-log.json`](.conveyor/false-green-log.json) / [`we:.conveyor/red-main-freeze.json`](.conveyor/red-main-freeze.json) | #2681 | false-green evidence · stop-the-line marker | machine/CI-local → stays |
| `we:.conveyor/*.lock` | #2681 | advisory locks serializing sidecar writes | **machine-local → subsumed** (a single-threaded DO replaces the lock) |
| [`we:skills-src/conveyor/runner-lock.mjs`](skills-src/conveyor/runner-lock.mjs) lease | #2702 | headless-runner singleton — *two* concerns in one file | **split → see Fork 1** |
| [`we:.claude/lane-ports.json`](.claude/lane-ports.json) | — | lane→dev-server-port map | **machine-local → stays** |

The **durable** side of the system — backlog items, `status`, `scope`, PRs, merges — is *not* in this list: it already has a single source of truth in git + GitHub, and a DB there would be a **parallel store** the "no parallel store" rule forbids ([`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates), clause 1–2). This decision is *only* about the transient operational sidecars above.

## The classification (converged, except the runner lease) — "durable store" is NOT lift-and-shift ALL of it

The flawed branch — the one this rules out — is **"move every operational sidecar into DO/D1."** It is broken for the machine-local artifacts: an advisory `.lock` that serializes writes to a local file is **subsumed, not migrated** once the file itself moves to a single-threaded DO; `we:.claude/lane-ports.json` maps ports on **this** machine; the learnings drop-box is per-session scratch consumed at close. So the target is a **per-artifact split by nature**, extending the *animating principle* of [`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates) (rule-105) — "state lives where its nature dictates" — to a **third home rule-105 never contemplated**: a shared durable store that is neither committed git nor a #2302-guarded card. (Cite the principle, not rule-105's two-home git-vs-sidecar taxonomy, as the settling authority — the taxonomy predates this third home.)

- **Shared-truth → migrates at product.** A session-free product with a live UI operator + a headless runner + the daemon all reading the same operational truth genuinely needs it cross-session: the cleared-for-build queue (#2613), the jury ledger (#2641 — already built as "single source of truth, never a parallel state store": a durable log + one shared fold [`we:scripts/lib/jury-ledger.mjs`](scripts/lib/jury-ledger.mjs) with **two** consumers, the conveyor tick *and* the plateau-app #2642 console), and infra-blocked recovery (#2659).
- **Machine-local → stays a local sidecar/lock forever.** The advisory locks, `we:.claude/lane-ports.json`, the learnings drop-box (#2614). Local by *nature*, not by interim convenience — they never migrate.

**Note the queue's nature is product-dependent, not fixed.** Rule-105 clause 1 names the conveyor queue as its *type-case of transient session scratch* — and it is, *today*, per-operator. This decision does not contradict that: the queue's nature is **per-operator today, shared-across-actors at the product**, so it is session-scratch now (sidecar, correct) and shared-truth later (DO, correct). Same artifact, different tier, no statute collision.

## Fork 1 — the runner lease (#2702): machine-local forever, or split off its arbitration half?

Fork-existence (genuine either/or): the runner lease is *two* concerns fused in one HOME-level lock — (i) a **machine-local process singleton** ("don't run two runners on my laptop") and (ii) **cross-actor single-writer arbitration** ("who may write the shared operational state"). A single machine-global HOME lock **physically cannot** arbitrate two *machines* — so if the session-free product runner ever runs multi-host, concern (ii) is unserved and two runners on two hosts can double-dispatch. The branches genuinely cannot coexist: either the lease stays one indivisible machine-local lock (and multi-host is unsafe), or it splits.

- **(a) Keep the runner lease fully machine-local forever.** Simplest; correct *as long as* the product runner is single-host. Breaks silently the moment a second host runs a runner — the machine-global lock can't see the other machine. *Rejected as the unconditional rule:* "forever" asserts single-host as a permanent invariant nothing guarantees.
- **(b) Split it: the process-singleton stays machine-local always; the arbitration half becomes a DO single-writer lease, conditional on runners going multi-host.** The local guard ("two runners on my laptop") never migrates — a DO can't tell if a process is alive on your machine. The *arbitration* ("who writes shared state") rides the shared-store migration **iff** the product runs runners on more than one host; single-host product keeps everything local. This is the DO sweet spot the store choice already names (single-writer lease / lane-arbitration).

**▸ Default: (b) split — local guard stays local; arbitration migrates to a DO lease, gated on multi-host runners.** It is the only branch that is correct in both futures; it costs nothing until multi-host actually arrives (the conditional edge, not a now-build). The migration item #2742 carries this split.

`Skeptic: SURVIVES` — the attack "machine-local forever is fine" is exactly what this fork refutes; the machine-global HOME lock cannot prevent cross-*machine* double-dispatch, a correctness gap, so the unconditional (a) is unsafe. `Screen: flagged(impl) → fixed` — a genuine correctness difference survives (not prioritization), so this is a real fork and is authored as one rather than folded into the converged classification.

## Accepted on merit (dissolved from a fork) — the shared store at product, on a tracked trigger

Not a ratifiable fork: both branches ("DB now" / "DB later") end at DO/D1 at the product, so merit is conceded and only ordering remains — it dissolves to accepted-on-merit + a trigger ([#2092](/backlog/2092-a-merit-conceded-not-yet-dissolves/)). Recorded here for your batch-confirm:

- **Accepted on merit:** the shared durable store IS built at the product, migrating the shared-truth subset. Warrant = the #2692 / #2701 precedent (*interim mechanics local, durable at product*), already ratified twice, plus the physical constraint above.
- **The now-cost that makes it a one-swap, not a rewrite:** keep every shared-truth sidecar behind a store module. This is *already the house style* — the queue reads/writes through [`we:scripts/conveyor/queue-store.mjs`](scripts/conveyor/queue-store.mjs) (pure-core `parseQueue`/`addToQueue` + a thin overridable fs shell), the jury ledger through the single fold [`we:scripts/lib/jury-ledger.mjs`](scripts/lib/jury-ledger.mjs) (`foldJuryLedger` is pure), infra-blocked through [`we:scripts/conveyor/infra-blocked.mjs`](scripts/conveyor/infra-blocked.mjs). A DO swap touches only the io-shell, never the pure core.
- **The tracked trigger (concrete, not open-ended):** the migration fires when **the first session-free product surface must read/write conveyor operational state with no main session present** — concretely, when [#2703](/backlog/2703-retire-the-main-session-serial-conveyor-loop-main-session-dr/) retires the main-session loop, or the #2642 juror console / #2527 build endpoint runs out-of-process from the operator's working tree, so a gitignored `we:.conveyor/` sidecar can no longer be co-read. Today the product reads operational state through an `/api/backlog/overlay`-style HTTP boundary co-located with the session and #2642 is still `open` — so the trigger has **not** fired yet; sidecars keep running. The tracked mechanism is **#2742** (`blockedBy: #2703`): it cannot start until the session-free runner exists, and when it does it stands up DO/D1 behind the store seam and migrates only the shared-truth subset. Nobody has to remember to look — the `blockedBy` edge is the tripwire.

## Store choice when the trigger fires (settled lean, low-contest)

No excluded branch — a direction, not a live fork; recorded so the migration build arrives with the substrate chosen.

**▸ Lean: Cloudflare Durable Objects + D1 over MongoDB.** DO gives the single-writer lease / lane-arbitration coordination (exactly Fork 1's arbitration half and the hard part of multi-actor state); D1 gives the queryable queue/history. The constellation is already Cloudflare-shaped, so this reuses the platform rather than adding a second data plane. `Skeptic: SURVIVES` — no correctness objection; reversible (one backing-store swap behind the seam). `Screen: clear` — a substrate choice the product boundary owns, not an impl detail on the standard side.

## Codification (at ratify, not now)

If ratified, this resolves by **citing the animating principle** of rule-105 (*state lives where its nature dictates*) — not its two-home git taxonomy — and recording a corollary: *operational state stays a session-local sidecar until a session-free/multi-actor product surface must read it cross-process, then migrates per-artifact by nature to a shared durable store (the third home); machine-local artifacts never migrate, and a bundled lock is split so only its cross-actor arbitration half moves.* This **extends** rule-105 to a third home, it does not compete with it (checked — rule-105 governs *sidecar vs committed git*; this adds *when* the product-tier migration happens, *which* artifacts it reaches, and that the queue's nature is tier-dependent). Statute overlap reconciled by citation; `codifiedIn` is set at the decision turn.

## What ratifying settles

- **Now:** the store-seam discipline (every shared-truth sidecar behind a store module) becomes green-lit interim policy — already conformant (queue-store, jury-ledger fold, infra-blocked helper).
- **Conditionally (on #2703 / the session-free product):** **#2742** is unblocked — stand up DO/D1, migrate the shared-truth subset, split the runner lease per Fork 1(b), classification already ruled, no re-litigation.
- **Permanently:** the per-artifact classification (machine-local never migrates; a bundled lock splits) is codifiable, so no future product pressure lifts a machine-local guard into a remote store.

Refs [#2527](/backlog/2527-plateau-loop-autonomous-ai-build-queue/) · [#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-an/) · [#2692](/backlog/2692-lever-c-concurrency-can-event-driven-land-be-sole-writer-saf/) · [#2701](/backlog/2701-conveyor-orchestration-boundary-how-much-is-pure-mechanics-v/) · [#2703](/backlog/2703-retire-the-main-session-serial-conveyor-loop-main-session-dr/) · [#2641](/backlog/2641-jury-ledger-surfaced-live-to-the-conveyor-as-the-single-sour/) · un-gate #2742 · [`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates).
