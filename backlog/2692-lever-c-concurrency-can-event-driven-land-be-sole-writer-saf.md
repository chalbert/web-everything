---
bornAs: xwysuk4
kind: decision
parent: "2612"
status: open
dateOpened: "2026-07-26"
tags: []
---

# Lever C concurrency: can event-driven land be sole-writer-safe, and is it worth it?

Should Lever C (event-driven land, #2683) be built — and if so, how is it made **sole-writer-safe**? A five-round
design-jury convergence loop on the conveyor latency design (`we:reports/2026-07-26-conveyor-per-item-latency.md`)
converged Levers A/B/E/D but **escalated C at the round cap**: C drew a *new* concurrency finding every round.
Its difficulty is real — *event-driven landing against a sole-writer daemon* is a distributed-systems problem, not
a prose fold. This decision captures the escalation packet so a human rules it rather than the loop churning.
Its only benefit — removing the ≤60 s poll-gap — is itself gated on Lever 0 (#2680) showing the serial land binds,
so "defer or drop C" is a live option.

## The escalation packet (what 5 rounds surfaced)

C fires the fast-drain the instant a PR reaches last-precondition (CI-green **and** non-author sign-off) instead of
waiting for the ≤60 s daemon sweep. Making that safe against the sole-writer invariant needs, unresolved:

- **Fencing, not a bare TTL.** C runs under the daemon's lease with the numbering mutex widened to the whole
  read-gate→merge→push section. That section needs a bounded timeout so a hung merge can't wedge the queue — but a
  plain lease-TTL cannot distinguish *crashed* (safe to steal) from *slow-but-alive* (unsafe): a timed-out-but-live
  holder's late push races the next writer → the exact concurrent-write the mutex exists to prevent. Requires a
  **fencing token / monotonic lease generation / compare-and-swap-on-push** so a superseded holder's write is
  rejected.
- **Authorization by identity, not presence.** `--under-lease` must be a genuinely delegatable token, and a C
  invocation must be *authenticated as entitled* to borrow the daemon's main-write authority — else any process
  that can emit the trigger event is a confused-deputy landing under the daemon's identity. The server-side re-gate
  must re-derive signer ≠ author by **identity**, not just sign-off *presence*.
- **Non-repudiable audit.** C's lands run under the daemon's lease; attribution must distinguish C from the daemon,
  not fold both into one identity.
- **Crash-window idempotency.** Per-PR idempotency must key on a post-push observable (PR merged / SHA on `main`),
  not holder-written bookkeeping, or a crash between push and completion leaves a re-land window.

## Forks (to prepare / rule)

- **Fork 1 — build C at all?** Default **defer**: gate on Lever 0 (#2680) *first* proving land-serialization
  binds; if it doesn't, C is a latency-only lever not worth its concurrency cost — drop it (A alone removes the
  extra land; the 60 s sweep may suffice).
- **Fork 2 — if built, the safety model:** fencing-token/CAS-on-push vs an alternative that avoids a second writer
  entirely (e.g. C only *nudges* the daemon to sweep-now rather than performing the land itself — the daemon stays
  the literal sole writer, C just wakes it). The nudge option may dissolve most of the packet.

## Lineage

Escalation from the design-jury convergence loop (5 rounds, `we:reports/2026-07-26-conveyor-per-item-latency.md`
§5). Slice #2683 is the build; this decision gates whether/how it proceeds. Program #2606 / conveyor epic #2612.
The loop's own mechanization is #xvwmwkx.
