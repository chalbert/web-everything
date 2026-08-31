---
bornAs: xdpzhqc
kind: story
size: 3
status: open
dateOpened: "2026-08-31"
costTokens: "in:1564 cw:2713920 cr:430189527 out:476649"
costUsd: 254.16
costSessions: 1
tags: []
---

# verify-lane default gate: bound check:standards to a caller-set CPU-core cap and parallelize its per-file checks

check:standards runs its ~50 checks single-threaded (measured 52.7s user CPU on this repo, user approx real meaning CPU-bound not IO-bound). The operation manager needs it to respect an externally-set core budget when several lanes verify concurrently, and to use whatever cores it is given efficiently, since verify-lane runs this on every lane land. Add a sized worker pool so the per-file per-check work fans out across N workers, N read from a flag or env var the operation manager sets, defaulting to current single-threaded behavior when unset.

## Done when

1. **Executable** (mechanics-qualified, #3264 — this item's whole claim is concurrency behavior, which a
   decision-only stub can't observe) — a test drives the real worker pool with an injected cap
   (e.g. `WE_CHECK_STANDARDS_MAX_WORKERS=2` or `--max-workers=2`) against a real multi-file fixture tree and
   asserts the number of concurrently-live workers never exceeds the cap — actual `worker_threads`/child
   processes, not a stubbed scheduler.
2. **Executable** — `node we:scripts/check-standards.mjs --max-workers=1` produces the same findings (same
   count, same descriptors) as today's unflagged single-threaded run on this repo's current corpus — the
   parallel and serial code paths must agree on results, not just on speed.
3. **Observable** — with no flag/env set, behavior is unchanged from before this item: the default stays
   single-threaded, and the existing `check:standards` CI job needs no changes to keep passing.
