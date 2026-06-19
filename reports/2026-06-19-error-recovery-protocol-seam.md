# Error-recovery protocol seam — what the contract carries vs. what handlers own

**Date:** 2026-06-19 · **Backlog:** [#1032](/backlog/1032-design-the-protocol-level-error-recovery-seam-for-webreliabi/) (decision, parent epic [#1019](/backlog/1019-webreliability-implementation-recovery-handler-registry/)) · **Project:** webreliability · **Research topic:** [Error Recovery & Retry Patterns](/research/error-recovery-patterns/) (extended)

## Why this report

#1019's registry trio (#1051 contract / #1052 runtime / #1053 demo) builds the **delegation seam** — `CustomRecoveryHandler.tryRecover(error, context) → RecoveryResult | null`, the first-that-accepts registry, null-means-decline. That seam is designed (it is on the webreliability project page today) and ratified ground.

What #1019 explicitly held back as a *true GAP* (no design, no impl) is the **recovery semantics**: how failures are **classified**, **retried/backed-off**, **surfaced**, and **composed across registered handlers**. The card #1032 decides one thing: **how thick is the Error Recovery contract** — which of those four concerns are normalized *at the @webeverything contract* (so every consumer/UX and every handler agree on one vocabulary) vs. left *private to each handler* (maximum flexibility, no premature vocabulary). Placement (contract → WE, runtime → FUI) is the standing constellation rule and is not in question.

## The existing survey was too shallow for this question

The published [Error Recovery & Retry Patterns](/research/error-recovery-patterns/) topic surveyed **single-handler JS data-fetching libraries** — TanStack Query, axios-retry, urql `retryExchange`, SWR, Apollo `RetryLink` — and correctly grounded the *registry-layer* decisions (null-means-decline from `retryCondition`/`retryIf`; registry-not-chain; HTTP-specific backoff stays in handlers; 1-based attempt). But it never surveyed the two things #1032 actually turns on:

1. **multi-handler composition** — how do circuit-breaker + retry + offline-queue *cooperate* on one operation? The JS libs each ship a single retry mechanism; they don't answer this.
2. **recovery-state surfacing** — how does a library expose "retrying vs. paused/queued vs. circuit-open" to the UI as a vocabulary distinct from the data status?

The canonical prior art for both lives outside the JS data-fetching world. This report adds it.

## New prior art — resilience composition

| Library | Composition model | What it tells us |
|---|---|---|
| **Polly `PolicyWrap`** (.NET) | Combines policies (Retry, CircuitBreaker, Timeout, Fallback, Bulkhead) into one executable, **innermost→outermost, left-to-right, in an author-chosen order**. | Composition is an **explicit, ordered wrap** — never implicit. And **the order is a real decision:** Polly's own guidance is `CircuitBreaker`-wraps-`Retry` for short/no delays (don't let 3 close-spaced tries trip the breaker) but `WaitAndRetry`-wraps-`CircuitBreaker` for long delays (the circuit state can change during the wait). |
| **resilience4j** (Java) | Higher-order **decorators** (`CircuitBreaker`, `Retry`, `RateLimiter`, `Bulkhead`) stacked over a functional interface; you stack more than one, order explicit. | Same shape: cooperation = the author **explicitly stacks** decorators. No framework auto-orchestrates resilience concerns. |

**Implication for Fork 3 (composition).** The two most authoritative resilience libraries in existence both make multi-concern cooperation an **explicit, author-ordered composition** — and both treat the *order itself* as a load-bearing decision the author must make per operation. Neither bakes a fixed orchestration into the substrate. That is strong evidence for WE's analogue: cooperation is a **composite handler** the app authors (a handler that holds and orders sub-handlers), not a protocol-level chain/escalation model. A baked protocol order would have to pick breaker-wraps-retry *or* retry-wraps-breaker — and Polly proves both are correct in different timing regimes, so baking either is wrong.

## New prior art — recovery-state surfacing

| Source | Surfacing model | What it tells us |
|---|---|---|
| **TanStack Query** | Splits **`status`** (`pending`/`error`/`success` — the *data*) from **`fetchStatus`** (`fetching`/`paused`/`idle` — the *recovery/network phase*), plus a derived `isPaused`. | The library industry already separates "what is the data" from "what is recovery doing right now." A query offline-and-waiting is `success`+`paused`, not a new error state. This is exactly the recovery-phase vocabulary #1032's "surfaced" gap needs — and it is **normalized at the library**, not left to each call site. |
| **Circuit-breaker canon** | Three states **CLOSED → OPEN → HALF-OPEN(probing)**. | "Circuit open" is a *recovery phase*, not a terminal failure — the operation isn't being attempted right now but may recover on the next probe. The UX must distinguish it from `failed`. Confirms a phase enum richer than the page's current `recovering`/`fallback`/`failed`. |

**Implication for Fork 2 (surfacing).** A normalized recovery-**phase** discriminator on the in-flight `recovering` state — `retrying` (attempt pending, possibly after `delay`) · `queued` (handler owns deferred replay) · `awaiting-manual` (user-triggered retry offered) · `circuit-open` (probing-gated) — lets the Reliability + Loader Intent UX reason generically without coupling to which handler ran. TanStack's `status`/`fetchStatus` split is the precedent for keeping this *separate* from the data/loader status.

## Implication for Fork 1 (classification)

The existing survey already settled the mechanism: *raw* error→cause classification (HTTP status codes, `Retry-After`, DB error shapes) is operation-type-specific and stays inside handlers. What it left open (its own open question — "should `RecoveryContext` carry the operation's category?") is whether the contract carries a **normalized disposition the UX reads**. The disposition is the *output* of classification, not the logic: `transient` (worth recovering) · `terminal` (give up) · `deferred` (queued for later). This is the adapter-as-normalization-hub pattern — normalize the cross-handler output the UX consumes, keep the per-operation classification logic private. It also lines up 1:1 with the existing Reliability Intent `tolerance` dimension (`forgivable`/`degraded`/`terminal`).

## What stays a forced invariant (not a fork)

- **Backoff/retry math stays in handlers; the contract carries only the resolved opaque `delay` (ms).** The original survey is unambiguous (backoff is operation-specific; jitter is opt-in best-practice for distributed HTTP, overkill for local compute). "Protocol owns backoff math" is the *excluded* branch — it would prescribe a strategy that doesn't fit every operation type, for no interop gain. `RecoveryResult.delay` already carries the output.
- **Composite-over-orchestration is consistent with the ratified registry-not-chain decision.** The Polly/resilience4j evidence reinforces, not reopens, that ruling.

## Recommended contract shape (the spine)

The contract normalizes the **cross-handler outputs every consumer/UX needs** and nothing else:
- **carries** (net-new): a normalized failure **disposition** (`transient`/`terminal`/`deferred`) handlers map raw errors into; a recovery-**phase** discriminator on the in-flight state (`retrying`/`queued`/`awaiting-manual`/`circuit-open`) — both read by the Reliability + Loader Intent UX.
- **already carries:** the delegation seam, `RecoveryOutcome`, opaque `RecoveryResult.delay`, `AbortSignal`, 1-based `attempt`.
- **does NOT carry:** backoff math, raw classification logic, multi-handler orchestration — all handler-owned; cooperation is an author-composed composite handler.

Net: the contract gets *two small normalized output vocabularies* added, stays single-dispatch, and pushes every *mechanism* to handlers.
