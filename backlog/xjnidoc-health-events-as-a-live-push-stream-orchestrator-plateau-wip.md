---
kind: story
size: 8
status: open
scope: ["we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-smells-notify-list.mjs", "we:scripts/conveyor/pr-events-worker/core.mjs", "we:scripts/conveyor/pr-events-worker/worker.mjs", "we:scripts/conveyor/pr-events-worker/wrangler.toml", "we:scripts/lib/pr-events.mjs", "we:scripts/lib/health-events.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Health events as a live push stream (orchestrator, Plateau /wip, phone)

The orchestrator learns of health episodes only by polling the HEALTH section or being told (the 2026-09-26/27 review outage, lane resets, both surfaced late this way). Publish each notify-list episode open/close from we:scripts/conveyor/health-watch.mjs's tick as a new authenticated 'health' stream on the existing we:scripts/conveyor/pr-events-worker/ Cloudflare Worker (Durable Object), with a WebSocket subscribe endpoint the orchestrator can Monitor (ws source) for a live wake instead of a 30-min-rearmed log tail. Full design covers Plateau /wip's live panel and phone push; MVP cuts to open/close only, on the existing notify-list surface.

Not MCP: MCP is request/response (the orchestrator would have to ask), never a server-initiated push into a
running session. Only a live transport — the WebSocket stream this card adds — can wake a session the moment
an episode opens, which is the operator's actual ask ("could the health daemon notify you straight away").

## Design

**Today.** `we:scripts/conveyor/health-watch.mjs`'s tick (resident via `we:skills-src/conveyor/daemon-manifest.mjs`,
every 5 min) runs `stepEpisodes` (`we:scripts/conveyor/health-watch-core.mjs:338`), which folds probe readings
into episode transitions (`opened` / `flapping` / `closed` / `silence-expired` / `reminder`) and hands them to
`planActions` (`:444`). In `shadow` mode (today's global mode) every `notify` plan entry is suppressed UNLESS
the smell's `id` is in `we:scripts/conveyor/health-smells-notify-list.mjs`'s `NOTIFY_EVEN_IN_SHADOW` Set (13
smells, per the 2026-09-27 operator decision recorded in that file). The one thing that actually happens for an
unsuppressed entry is `we:scripts/conveyor/health-watch.mjs`'s "THE MINIMAL NOTIFY PATH" (`:646-667`): a
best-effort macOS desktop notification via `notifyDesktopChecked`. Nothing is pushed anywhere else — the
orchestrator finds out only by reading the HEALTH section (`healthSectionLines`) on its own poll cadence, or via
the interim Monitor tailing `~/workspace/wev-health-watch/.conveyor/health-watch.log` for `"opened …"` lines,
re-armed every 30 minutes (today's stopgap, kept running until this card's MVP replaces it).

**The stream.** `we:scripts/conveyor/pr-events-worker/` already runs exactly the primitive this needs, for a
different producer: a single-writer, SQLite-backed Durable Object (`PrEventLog`,
`we:scripts/conveyor/pr-events-worker/worker.mjs`) behind a pure core
(`we:scripts/conveyor/pr-events-worker/core.mjs#createEventLog`) that assigns a strictly-increasing `seq`,
supports cursor-based replay (`GET /events?cursor=N`, `reset`/`gap`/`more` semantics
`we:scripts/conveyor/pr-events-worker/core.mjs:10-18`), and is bearer-authed with a token separate from its
ingest secret (`PR_EVENTS_READ_TOKEN` vs. `GITHUB_WEBHOOK_SECRET`). Health events reuse this exact primitive as
a **second, independent log inside the same Durable Object** — never the same table/cursor space as PR events,
so a health-stream bug can never corrupt or stall PR-event delivery and vice versa:
- `PrEventLog` (`we:scripts/conveyor/pr-events-worker/worker.mjs`) constructs a second
  `createEventLog(sqlStorage(...))` over its own SQLite table (`health_events`, its own `head`/`lastEventAt`
  meta keys) alongside the existing `events` table — one DO instance, two independent logs, matching the file's
  own "ONE instance… single-threaded writer" rationale (no new DO, no new single-writer story to design).
- **Publish** — `POST /health/publish`, bearer-authed with a new `HEALTH_EVENTS_WRITE_TOKEN` binding (NOT the
  GitHub HMAC scheme `we:scripts/conveyor/pr-events-worker/core.mjs#verifySignature` uses — the publisher is
  our own tick, not GitHub, so a plain bearer token is the right shape, mirrors the read side's own bearer
  auth). Body: `{smell, subject, severity, transition, firstSeenAt, summary, recommendation, link}` — `link` is
  the existing per-episode report path `episodes/<id>.md` that `renderEpisodeReport` already writes
  (`we:scripts/conveyor/health-watch.mjs:682`), not a new artifact. Every event is run through the SAME
  `scrubText`/`scrubDeep` (`we:scripts/conveyor/health-watch-core.mjs` imports, already applied to the on-disk
  episode JSON at `we:scripts/conveyor/health-watch.mjs:683`) before it leaves the process — no secrets in
  events is enforced by reusing the existing scrub, not a new filter to keep in sync.
- **Read (polling fallback + bootstrap)** — `GET /health/events?cursor=N`, bearer-authed with a new
  `HEALTH_EVENTS_READ_TOKEN` binding, identical cursor contract to the existing `/events` route (reuses
  `createEventLog#read` verbatim against the second log).
- **Subscribe (the live push)** — `GET /health/ws?cursor=N&token=...` upgrades to a WebSocket using the
  Durable Object's hibernatable WebSocket API (`ctx.acceptWebSocket`); on connect it first replays every event
  since `cursor` (same semantics as the read route — `reset`/`gap` apply identically), then pushes each new
  append as one text frame (`JSON.stringify(record)`) as it lands. Auth is a query-string token, not a header,
  because the harness's own WebSocket client (`Monitor`'s `ws` source) opens a bare URL with no custom-header
  support — the token must be embeddable in the URL itself, same reason a signed/short-lived query token is
  the standard pattern for browser `EventSource`/`WebSocket` auth generally. Backpressure: no new algorithm —
  a socket that falls behind or drops is simply closed (Cloudflare bounds the outbound message queue per
  socket); the client's only recovery path is reconnect-with-cursor, identical in shape to the existing
  poll-and-resume contract `we:scripts/lib/pr-events.mjs` already documents ("WAKE-ONLY… the tick still
  re-derives everything") — a missed push is never silent data loss, only a delayed one, because the next
  reconnect (or the orchestrator's own periodic HEALTH-section poll, unchanged) replays it.

**Subscribers (full design, all three from the operator's ask).**
1. **Orchestrator session** — `Monitor({ws: {url: '.../health/ws?cursor=<last>&token=...'}, description: 'health episodes'})`.
   Each text frame is one episode transition; the orchestrator re-arms on socket close (Monitor's own 30-min
   cap) with the cursor it last saw, so re-arming never re-delivers or loses an episode — replacing today's
   log-tail Monitor with a typed, replay-safe feed instead of a noise-filtered grep over a local log file that
   only this one Mac can see.
2. **Plateau `/wip`** — a live health panel (relates to `xfodvzc`, the daemons-panel card the operator named)
   subscribing the same `/health/ws` endpoint from the browser with its own per-page `WebSocket`, rendering
   open episodes with severity/recommendation/link. Needs its own read token scoped to Plateau (never the
   orchestrator's), and a browser-side reconnect-with-cursor loop (the same contract, a different client).
3. **Phone push** — an optional high-severity-only relay: a tiny subscriber process (could be the health-watch
   tick itself, post-publish, or a standalone always-on subscriber) that watches the same stream for
   `severity: 'high'` events and forwards to a push service (APNs/web-push/whatever the operator's phone setup
   already uses — out of scope to pick here). This is a CONSUMER of the stream, not a stream design decision;
   it needs no Worker changes at all, only a client and a push-provider integration.

**Per-subscriber tokens (full design).** The MVP ships one shared `HEALTH_EVENTS_READ_TOKEN` (matching the
existing PR-events precedent: one token per stream, not per reader). Real per-subscriber tokens — so a leaked
Plateau-page token can be rotated without breaking the orchestrator's Monitor — are a natural follow-up once a
second subscriber (Plateau) actually exists to justify the extra `wrangler secret` bindings and revocation
story; minting one shared token twice, for one subscriber, would be premature.

## MVP cut

**Must:**
- The second Durable Object log (`health_events` table, its own head/cursor meta) inside the existing
  `PrEventLog` — `we:scripts/conveyor/pr-events-worker/worker.mjs`.
- `POST /health/publish` and `GET /health/events?cursor=N` in `we:scripts/conveyor/pr-events-worker/core.mjs`,
  both reusing `createEventLog` verbatim against the new log — no new cursor logic, only new routing.
- `GET /health/ws` — the WebSocket subscribe endpoint (replay-from-cursor then live push), the ONE genuinely
  new mechanism this card adds (nothing in `we:scripts/conveyor/pr-events-worker/core.mjs` speaks WebSocket
  today).
- `HEALTH_EVENTS_WRITE_TOKEN` / `HEALTH_EVENTS_READ_TOKEN` bindings in
  `we:scripts/conveyor/pr-events-worker/wrangler.toml` (set via `wrangler secret put`, never in code).
- Publish wiring in `we:scripts/conveyor/health-watch.mjs`'s existing notify path (`:646-667`): for every
  unsuppressed `notify` plan entry whose transition is `opened` or `closed` (the two transitions the operator's
  own MVP text names), POST the scrubbed episode record to `/health/publish`, best-effort — a publish failure
  must never fail the tick, same discipline `notifyDesktopChecked` already follows one line above it.
- A new client helper, `we:scripts/lib/health-events.mjs`, mirroring `we:scripts/lib/pr-events.mjs`'s
  config-resolution pattern (flag/URL/token from env, `WE_HEALTH_EVENTS_*`) so the orchestrator's Monitor call
  and any future Node subscriber build the same authenticated URL one way, not hand-assembled per call site.
- Unit tests: the two new `we:scripts/conveyor/pr-events-worker/core.mjs` routes and the WS upgrade/replay
  logic (`we:scripts/conveyor/pr-events-worker/__tests__/`), and
  `we:scripts/lib/health-events.mjs`'s config resolution (mirrors `we:scripts/lib/pr-events.mjs`'s own existing
  test shape).

**Could (real, already designed above, not built now):**
- `flapping` / `silence-expired` / `reminder` transitions on the stream (Must ships `opened`/`closed` only, per
  the operator's own explicit MVP cut) — same publish path, just more transition types allow-listed once the
  two-transition MVP is proven live.
- The Plateau `/wip` live health panel (subscriber 2) — a Plateau-side UI build, a separate repo's work.
- Phone push (subscriber 3) — needs a push-provider decision the operator hasn't made yet.
- Per-subscriber read tokens (rotation without cross-subscriber breakage) — deferred until a second real
  subscriber exists.
- Retiring the interim `~/workspace/wev-health-watch/.conveyor/health-watch.log`-tailing Monitor — safe to
  retire once the orchestrator has run on the new `/health/ws` feed for a while; kept running in parallel
  through the MVP so nothing regresses if the new path has a gap.

**Size.** MVP is a new Worker route class (WS) + one new log + one tick-side publish call + one client
module + tests — real net-new surface, not a small tweak, hence this card's own `size: 8` (not a smaller
story): under the ~1.5× MVP budget (12) with room for the plan-review rounds this rule allows before a split
would be owed.

## Interfaces

- `we:scripts/conveyor/pr-events-worker/worker.mjs` — `PrEventLog` gains `this.healthLog` (a second
  `createEventLog` instance) and a hibernatable WebSocket handler (`webSocketMessage`/`webSocketClose` per
  Cloudflare's DO WebSocket API) that pushes on `healthLog.append`.
- `we:scripts/conveyor/pr-events-worker/core.mjs#handleRequest` — three new routes (`/health/publish`,
  `/health/events`, `/health/ws`), each guarded by its own token binding, fail-closed exactly like the existing
  routes (`503` on a missing binding, never "accept unauthenticated").
- `we:scripts/conveyor/health-watch.mjs` — the notify loop (`:656-667`) gains a sibling effect: publish, not
  only desktop-notify, per unsuppressed `opened`/`closed` transition; failure is caught and reported the same
  way `notifyDesktopChecked`'s own failure already is, never thrown.
- `we:scripts/lib/health-events.mjs` (new) — `resolveHealthEventsConfig(env)`, `publishHealthEvent(record, cfg)`,
  and a `subscribeUrl(cursor, cfg)` helper the orchestrator's Monitor call builds its `ws.url` from — mirrors
  `we:scripts/lib/pr-events.mjs`'s exported shape (`resolvePrEventsConfig`, `pollEvents`) without copying its
  PR-specific fields.

## Tasks

1. Add the second `health_events` log to `we:scripts/conveyor/pr-events-worker/worker.mjs#PrEventLog` (Must).
2. Add `/health/publish` + `/health/events` to `we:scripts/conveyor/pr-events-worker/core.mjs`, reusing
   `createEventLog` (Must).
3. Add `/health/ws` — replay-from-cursor then live push over the DO's hibernatable WebSocket API (Must).
4. Add `HEALTH_EVENTS_WRITE_TOKEN`/`HEALTH_EVENTS_READ_TOKEN` bindings to
   `we:scripts/conveyor/pr-events-worker/wrangler.toml` (Must).
5. Wire the publish call into `we:scripts/conveyor/health-watch.mjs`'s existing notify loop for
   `opened`/`closed` only (Must).
6. Author `we:scripts/lib/health-events.mjs` (Must).
7. Unit tests for 1–3 and 6 (Must).
8. Allow-list `flapping`/`silence-expired`/`reminder` on the stream (Could).
9. Plateau `/wip` panel + phone push (Could, separate follow-up cards once filed).

## Delivery shape

One PR. The Must items (Worker routes + tick publish wiring + client helper + tests) are one coherent slice —
none of them is independently shippable (a publish call with no route to hit, or a route nothing publishes to,
each prove nothing on their own) — so they land together; the Could items are explicitly deferred, not split
into a parallel PR in the same lane.

## Done when

1. **Must — Executable.** `npx vitest run we:scripts/conveyor/pr-events-worker/__tests__` passes with the new
   `/health/publish`, `/health/events` and `/health/ws` coverage, and
   `npx vitest run we:scripts/lib/__tests__/health-events.test.mjs` passes; a live `wrangler dev` probe
   (`curl -XPOST .../health/publish` then a `Monitor` `ws` connect to `.../health/ws`) shows the posted event
   arriving as a pushed frame, not only in a unit fixture.
2. **Must.** `we:scripts/conveyor/health-watch.mjs`'s tick publishes every unsuppressed `opened`/`closed`
   transition for a `NOTIFY_EVEN_IN_SHADOW` smell to the new stream, best-effort, never failing the tick on a
   publish error (proven with a fixture that makes the publish call fail and asserts the tick still completes).
3. **Could.** `flapping`/`silence-expired`/`reminder` transitions also publish; Plateau `/wip` panel; phone
   push; per-subscriber tokens; retirement of the interim log-tailing Monitor.
