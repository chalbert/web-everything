---
kind: story
status: resolved
size: 2
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
blockedBy: ["252"]
tags: [backlog, tooling, ai, cli, resilience]
---

# Retry/backoff for the readiness proposer's model provider — don't drop a draft on a transient 429/529

The #252 model proposer calls the Messages API with a single `fetch` and **no retry**: a transient
`429 rate_limit` or `529 overloaded` throws, which the orchestrator records as an `error` give-up for
that item. For a one-shot dry-run that's tolerable, but across a backlog-wide sweep (80+ thin items)
a brief rate-limit window silently drops a chunk of the proposals to "provider error".

This is a small resilience follow-up, quarantined the same way #252 is — it touches only the model
provider at the CLI boundary in [we:scripts/propose-readiness.mjs](scripts/propose-readiness.mjs), never
the pure engine and never the #250 deterministic core.

## Build

- Wrap the model provider's `fetch` in bounded exponential backoff on `429` / `5xx` (honor the
  `retry-after` header when present), with a small max-attempts cap.
- Keep the give-up path for terminal errors (`400`/`401`/`403`) — those are not retryable and should
  still surface as an `error` result, not a silent skip.
- Consider adopting the official Anthropic SDK (which retries `429`/`5xx` with backoff out of the box)
  instead of hand-rolling — weigh the added dependency against the POC's current zero-dep `fetch`.

## Acceptance criteria

- A simulated `429` is retried (not immediately recorded as a give-up); a terminal `400` is not.
- The sweep no longer drops items to `error` on a transient rate-limit window.
- The pure engine (`we:scripts/readiness/proposer.mjs`) is unchanged — resilience lives at the CLI seam.

## Resolution (2026-06-10)

Extracted the BYO-key model provider out of the side-effectful CLI entry into a testable unit
`we:scripts/readiness/model-proposer.mjs`, and wrapped its Messages-API `fetch` in `fetchWithRetry` —
bounded exponential backoff on `429`/`529`/`5xx` and network throws, honoring `Retry-After`, capped at
a small `maxAttempts`. Terminal `400`/`401`/`403` are **not** retried (fail-fast give-up preserved).
The pure engine (`we:proposer.mjs`) and the #250 deterministic core are untouched. Zero-dep stance kept
(hand-rolled ~20-line backoff rather than adding the Anthropic SDK for one call). Covered by
`we:scripts/readiness/__tests__/model-proposer.test.mjs` (13 tests: 429/529 retried, 400/401/403 not,
cap, network-throw, `Retry-After`, and the integration that a 429 yields a draft not a give-up). Tests
+ `check:standards` green.
