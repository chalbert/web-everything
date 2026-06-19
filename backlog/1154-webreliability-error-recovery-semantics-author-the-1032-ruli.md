---
type: issue
workItem: story
size: 3
parent: "1019"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:reliability/contract.ts"
tags: []
---

# webreliability error-recovery semantics — author the #1032 ruling into the contract + protocol

Author the ratified error-recovery semantics layer (decision #1032) into the WE contract. Add to we:reliability/contract.ts + the error-recovery protocol entry (we:src/_data/protocols.json): (1) the normalized failure-disposition enum `transient`/`terminal`/`deferred`, and (2) a recovery-phase discriminator as an open meta-schema (core `retrying`/`queued`/`awaiting-manual`; `circuit-open` + future `rate-limited` as registered extensions, NOT core). Then update we:src/_includes/project-webreliability.njk — reconcile the 'Error classification' row (now a normalized disposition output), resolve its open question #3 (recovery-phase surfacing), and document the composite-handler rule (single-dispatch preserved; cooperation = author-ordered composite, not protocol orchestration). Invariants unchanged: backoff math stays in handlers (opaque `delay` only); runtime handlers are FUI (#1052).

## Worked target (illustrative — author the real contract from these; shapes extend the existing seam at [we:src/_includes/project-webreliability.njk:207-235](../src/_includes/project-webreliability.njk#L207))

### 1 · Failure disposition (Fork 1) — a normalized output on `RecoveryResult`

```typescript
/** Recoverability of the failure — the UX-facing projection of classification.
 *  ORTHOGONAL to the Reliability Intent `tolerance` axis (which is user-impact
 *  severity: forgivable/degraded/terminal). The UX reads both together. */
type FailureDisposition = 'transient' | 'terminal' | 'deferred';
//   transient → worth recovering   terminal → give up   deferred → queued for later

interface RecoveryResult {
    outcome: RecoveryOutcome;          // existing — what the consumer applies
    disposition: FailureDisposition;   // NEW — what kind of failure it was
    delay?: number;
    signal?: AbortSignal;
}
```

A handler maps the *raw* error into a disposition; the raw classification logic
(HTTP status, `Retry-After`, DB error shapes) stays private:

```typescript
class HttpRetryHandler extends CustomRecoveryHandler {
    async tryRecover(error: Error, ctx: RecoveryContext): Promise<RecoveryResult | null> {
        const status = (error as HttpError).status;
        if (status === 503 || status === 429)   // private classification…
            return { outcome: 'retry', disposition: 'transient', delay: this.backoff(ctx.attempt) };
        if (status >= 400 && status < 500)
            return { outcome: 'abort', disposition: 'terminal' };
        return null;  // decline — next handler tries
    }
}
```

### 2 · Recovery-phase discriminator (Fork 2) — open meta-schema, core + extensions

```typescript
/** Phase of an IN-FLIGHT recovery (the `recovering` observable state), kept
 *  SEPARATE from data/loader status (the TanStack status vs fetchStatus split). */
type RecoveryPhaseCore = 'retrying' | 'queued' | 'awaiting-manual';

/** Open meta-schema: registered values widen the union without a contract break.
 *  `circuit-open` ships as the first registered EXTENSION, not a core member,
 *  because the protocol bundles no circuit-breaker handler. */
type RecoveryPhase = RecoveryPhaseCore | (string & {});   // extensible
registerRecoveryPhase('circuit-open');                    // FUI circuit-breaker handler registers it
// later, if it proves constant: registerRecoveryPhase('rate-limited');
```

Consumer (Reliability + Loader Intent UX) binds to the phase without knowing which handler ran:

```typescript
element.addEventListener('recoverystatechange', (e) => {
    if (e.state === 'recovering' && e.phase === 'awaiting-manual') showRetryButton();
});
```

### 3 · Composition (Fork 3) — author-ordered composite handler that *nests*

Single-dispatch is preserved; the registry still picks the first handler that accepts.
Multi-concern cooperation is a composite handler the author *wraps in the order they need*
(the `PolicyWrap` analogue — and the order is load-bearing, so the author owns it):

```typescript
// breaker-wraps-retry: the breaker counts the whole retried attempt as ONE call
// (correct for short delays). For long delays the author wraps the other way.
const handler = new CircuitBreakerHandler(
    new RetryHandler(new HttpRetryHandler()),   // retry executes INSIDE the breaker's call
);
registry.register(handler);
```

An optional `'continue'` outcome is **not** authored now (#1032 Fork 3): it expresses only flat
fallthrough (try A, then B), never this nesting — so it cannot represent the load-bearing Polly
regime, which the composite handles. It is **not rejected**, though — it's a *deferred, app-opt-in*
capability for the *different* need of flat escalation, to add (additively, backward-compatibly)
only when a real app demonstrates it. Do **not** add it in this build.

### Page reconciliation checklist (we:src/_includes/project-webreliability.njk)
- Flip the **'Error classification'** row ([njk:52](../src/_includes/project-webreliability.njk#L52)) from `✅ handler` to "normalized disposition output (contract) + raw classification (handler)".
- Resolve **open question #3** ([njk:283](../src/_includes/project-webreliability.njk#L283)) with the recovery-phase discriminator above.
- Add the composite-handler composition note next to the registry-not-chain line ([njk:239](../src/_includes/project-webreliability.njk#L239)).

## Progress (resolved 2026-06-19)

Authored the #1032 ruling into the contract + page:
- **we:reliability/contract.ts** — added `FailureDisposition` (`transient`/`terminal`/`deferred`, Fork 1), `RecoveryPhaseCore` + open-meta-schema `RecoveryPhase` (`RecoveryPhaseCore | (string & {})`, Fork 2, `circuit-open`/`rate-limited` documented as registered extensions not core), and extended `RecoveryResult` with optional `disposition?` + `phase?`. Module-header now encodes all three forks (incl. Fork 3: author-ordered composite handler, no `'continue'`) replacing the "held behind #1032" note. Orthogonality of disposition vs Intent `tolerance` spelled out.
- **we:src/_data/protocols/error-recovery.json** — summary now states the normalized semantics (the protocols registry is split per-entry since #1145/#1146; edited this entry's own file only).
- **we:src/_includes/project-webreliability.njk** — flipped the Error-classification row to "normalized output (contract) + raw classification (handler)"; added `FailureDisposition`/`RecoveryPhase` to the Interface block + Exports table; added the composite-handler/`PolicyWrap` composition note (Fork 3); refined the `recovering` observable-state row with the `phase` discriminator; resolved open-question #3 inline (recovery-phase surfacing).

Invariants preserved: backoff math stays in handlers (opaque `delay`); runtime handlers are FUI. Whole-repo gate green.
