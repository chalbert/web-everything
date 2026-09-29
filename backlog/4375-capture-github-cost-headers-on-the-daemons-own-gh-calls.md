---
bornAs: x7nlnnx
kind: story
size: 5
tier: pinned
status: active
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-29"
tags: []
---

# Capture GitHub cost headers on the daemons' own gh calls

we:scripts/lib/gh-spend.mjs's header capture (#4309) only wired GH_DEBUG parsing into we:scripts/lib/gh-throttle.mjs's runGhCliPassthrough — the shim path agent sessions use. runGhSync, the execFileSync path we:scripts/conveyor/fix-procedure.mjs calls directly and we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs drives indirectly, still uses execFileSync, which drops stderr on any SUCCESSFUL call, so no rl reaches calls.jsonl for a daemon's non-failing calls. Today's report shows why this matters: 1790 daemon invocations/24h, 0 real HTTP responses, all UNKNOWN points; top callers we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs (1324), unknown (199), we:skills-src/conveyor/review-daemon.mjs (109), we:scripts/conveyor/fix-procedure.mjs (82), we:scripts/pr-land.mjs (68). The GraphQL budget ran out again ~5:20-6:23 PM ET today with the real spender invisible.

## Evidence (today's spend report)

- Command: `we:scripts/lib/gh-spend.mjs report` (run from a control-plane checkout tracking this repo's daemons).
- Last 24h: 1790 invocations, 0 real HTTP responses captured, every point total `UNKNOWN` (not `estimated` —
  no header observation exists for these lines at all, per #4309's own honest-`unknown` state).
- Top callers by count: we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs (1324, mostly indirect —
  it drives the fix procedures that call gh), `unknown` (199, uncaptured caller), we:skills-src/conveyor/review-daemon.mjs
  (109), we:scripts/conveyor/fix-procedure.mjs (82, direct `runGhSync` caller), we:scripts/pr-land.mjs (68).
- The shared GraphQL budget ran out again ~5:20–6:23 PM ET today — the same shape #4309 investigated
  (2026-09-27 22:15–22:20Z), and the real spender is still invisible because the exhausted calls are on this
  path.

## Why `runGhSync` is blind today

`we:scripts/lib/gh-throttle.mjs` has two entry points. #4309 wired real header capture into `runGhCliPassthrough`
only — the shim path an agent session's bare `gh` takes — using `spawnSync` specifically because
`execFileSync` **discards a successful call's stderr** (Node's documented behavior). `runGhSync` — the
daemon-side import path — still calls `execFileSync` directly. Its existing `throttle.calibrateHeaders` opt-in
only reads `GH_DEBUG` headers off a **failure's** stderr (for backoff calibration, `calibratedBackoffMs`), so
even with it on, a daemon's overwhelmingly common *successful* call never has its headers captured at all — the
majority-success traffic driving these 1790/24h calls is structurally invisible to `we:scripts/lib/gh-spend.mjs`'s
rollup, independent of how busy the daemons get. #4309 named this exact gap in its own Follow-ups ("Exact cost
capture for daemon calls (a `spawnSync` exec for `runGhSync`), only if the learned estimates prove too coarse")
— today's report is the proof: the estimate fallback isn't just coarse, it never engages at all outside a
rate-limited failure.

## Full design (complete picture)

- Give `runGhSync`'s real exec path the same `spawnSync` + `stripGhDebug` capture `runGhCliPassthrough` already
  has — always on for cost accounting (not the existing per-call `calibrateHeaders` opt-in, which stays for its
  own narrower backoff purpose), gated by the same `WE_GH_THROTTLE_COST_HEADERS` kill switch #4309 shipped (no
  new env var).
- Reuse `stripGhDebug` / `parseGhDebugResponseHeaders` exactly as `runGhCliPassthrough` uses them — no new
  parser, no new stderr shape.
- Log the same `id`/`inv`/`rl` fields on every `runGhSync` call line, in the exact shape
  we:scripts/lib/gh-spend.mjs's rollup already parses, so the rollup module itself needs zero changes.
- Later (not this card): move the shim's own direct unthrottled fallback (we:scripts/lib/gh-app-shim.mjs's
  bypass path) onto capture too — #4309 already named this population as invisible today; per-daemon GitHub
  identities (blocked on the open credential decision, #4309's own follow-up); moving the heaviest GraphQL ops
  to REST using this card's own real spend data (#4309's other named follow-up, blocked by this one now that
  it has real numbers to act on).

## MVP cut (this card's scope — Musts only)

1. **Must** — `runGhSync`'s real exec (`spawnSync`, mirroring `runGhCliPassthrough`) captures `GH_DEBUG=api`
   headers on EVERY call, success or failure, stripped via the existing `stripGhDebug`, gated by
   `WE_GH_THROTTLE_COST_HEADERS` (no new flag).
2. **Must** — every `runGhSync` call line carries `id`/`inv`/`rl` in the shape
   we:scripts/lib/gh-spend.mjs's rollup already reads, so `report` ranks real point spend for the named callers
   with zero rollup changes.
3. **Must** — every existing `runGhSync` caller's byte-for-byte stdout/stderr/exit-code contract is unchanged
   (existing we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs assertions still pass) — cost visibility
   must never change what a caller observes.
4. **Not MVP, not blocking** — the shim's unthrottled-fallback capture, per-daemon identities, and the
   REST-migration follow-up are real, but each is its own card; nothing here waits on them.

**Review gate:** blocks only on a Must above being unmet, or genuine harm (a daemon call behaving differently,
hanging, or losing output because of the exec swap) — never on a Full-design item being deferred.

## Risks

- **Hot-path perf.** `runGhSync` runs far more often (1790/24h and climbing) than the passthrough it mirrors,
  inside the existing concurrency-slot + retry-ladder gate — verify no meaningful latency regression under
  that cap before shipping on, not just under an isolated benchmark.
- **stdin.** Some `runGhSync` callers pass request bodies; the passthrough's own stdio handling
  (`stdio[0]: 'inherit'` only on the first attempt, per its own doc comment) must be matched or the swap
  reintroduces the piped-stdin-on-retry limitation `runGhCliPassthrough` already documents.
- **Blast radius.** Every daemon on this host takes this path — same reasoning #4309 gave for its own
  passthrough change: the kill switch is the rollback, not a code revert.

## Scope and consumers

Direct edits: we:scripts/lib/gh-throttle.mjs (`runGhSync`'s capture wiring). Consumers needing no change:
we:scripts/lib/gh-spend.mjs (same log shape), we:scripts/conveyor/health-smells/gh-graphql-budget.mjs (already
prefers attributed points when `rl` is present). Named top callers, for context only (not edited by this
card): we:scripts/conveyor/fix-procedure.mjs, we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs,
we:skills-src/conveyor/review-daemon.mjs, we:scripts/pr-land.mjs.

## Progress

- [x] **Must 1** — `runGhSync`'s real exec is now `spawnWithGhDebugCapture` + `settleLikeExecFileSync`
  (we:scripts/lib/gh-throttle.mjs): `spawnSync` with `GH_DEBUG=api`, trace stripped via the existing
  `stripGhDebug`, on every call, success or failure; gated by `WE_GH_THROTTLE_COST_HEADERS` (no new flag).
  Skipped (the pre-#4375 `execFileSync` path, byte-unchanged) for an injected `throttle.exec`, a caller-set
  `GH_DEBUG`, and a caller whose stderr is not piped (`'inherit'`/`'ignore'`/fd — the trace would reach the
  terminal before it could be stripped). `calibrateHeaders` callers are captured but not stripped (their
  trace-in-stderr opt-in contract is unchanged); backoff headers now come from the pre-strip trace, and rate-limit
  classification runs on the stripped text (a response body mentioning a rate limit never retries).
- [x] **Must 2** — `runGhSync` call lines carry `rl` next to `id`/`inv`; the rollup is unchanged (only its
  header comment was corrected). A nested shim → passthrough call sees the parent's `GH_DEBUG`, relays the trace
  unstripped, and logs `outer: <inv>`; the outer `runGhSync` line holds the `rl` and the rollup joins the pair
  as one invocation.
- [x] **Must 3** — `settleLikeExecFileSync` mirrors Node 22's own `execFileSync` source (stderr relayed to this
  process when no `stdio` is set; `Command failed: …` message; result fields assigned onto the thrown error);
  stdout's own `maxBuffer` is re-applied as `ENOBUFS` after the widened trace headroom. `input`/`stdio[0]` are
  passed through on every attempt exactly as `execFileSync` did, so the stdin behavior is unchanged.
- [x] Tests: we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs (8 new cases, real subprocess fake-gh
  replaying the golden traces, side by side with raw `execFileSync`: success buffer/utf8, failure error shape,
  no-stdio stderr relay, stdin, stripped classification + Retry-After backoff, the three no-capture cases,
  calibrateHeaders, ENOBUFS); we:scripts/lib/__tests__/gh-spend.test.mjs (runGhSync lines → rollup attributes
  the daemon caller's real delta). 7 of the 8 new fidelity cases fail with the capture disabled.
- [x] Perf: the spawn is the same `spawnSync` `execFileSync` already used; the added cost is `stripGhDebug`
  (~20µs for a single-request trace, ~60µs for a paginated one) — negligible next to a `gh` round trip.
- [ ] Observable check (we:scripts/lib/gh-spend.mjs `report --hours=24` one hour after deploy) — post-land.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs
   we:scripts/lib/__tests__/gh-spend.test.mjs` fails on `main` today (new capture-on-success cases) and passes
   after this lands; `npm run check:standards` passes.
2. **Observable** — `we:scripts/lib/gh-spend.mjs report --hours=24` shows real (not `UNKNOWN`) attributed or
   estimated points and request counts for we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs,
   we:scripts/conveyor/fix-procedure.mjs, we:skills-src/conveyor/review-daemon.mjs, and we:scripts/pr-land.mjs,
   one hour after deploy.
