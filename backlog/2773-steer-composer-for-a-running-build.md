---
bornAs: xgkz08u
kind: story
size: 3
parent: "2551"
status: open
scope: ["plateau:src/backlog-view/", "plateau:vite.config.mts"]
dateOpened: "2026-07-28"
tags: []
---

# Steer composer for a running build

Give the operator a UI to send guidance to a running agent, delivered at the next turn boundary and never dropped. The runner's steer() verb already exists (plateau:src/build-runner/runner.ts); the work is a steer-composer surface under plateau:src/backlog-view/ (sibling to queue-view) and a new POST /api/backlog/build/steer route on the backlog-api plugin (beside the existing /build/stop). Serves G1: steer at the point of work.

## Design

**Every piece but the two this item adds already exists — copy `stop`, do not invent a new path.**

**Server.** `runner.steer(text: string): boolean` (plateau:src/build-runner/runner.ts) writes
`{"type":"user","message":{"role":"user","content":text}}` to the live child's open stdin and returns `false`
when there is no live child. Boundary delivery and never-dropped are already its contract (Fork 1(a)) — this
item does not re-litigate them. The new route is the twin of the `POST /api/backlog/build/stop` branch inside
the `if (isBuild)` block of `backlogApi()` in plateau:vite.config.mts, and must copy its three guards verbatim:

1. the `application/json` content-type check (the same CSRF guard writes use) → `415` otherwise;
2. `buildRuns.active()` → `409 { error: 'no build in flight' }` when absent;
3. no cost/spend gate of any kind (`stop` says so explicitly; steering is likewise the operator's own action).

Two things `stop` does not need and `steer` does: a **body schema** (`{ text: string }`, non-empty, with a
length cap — the payload is fed straight into a model turn), and mapping `runner.steer()`'s `false` return to a
`409`, never a `200`. A steer reported as delivered but silently dropped is the one failure this item exists to
prevent, so the boolean must not be discarded.

**Client.** The sibling to copy is `mountQueuePanel` in plateau:src/backlog-view/queue-view.ts — specifically
`onBuildStop`, which is the whole pattern in a dozen lines: guard on `activeBuild`, POST with the JSON
content-type, surface a rejection via `setBuildNote`, and let the existing poll (not the handler) settle state.
Note `decorateBuildNow()` is the function that stamps the Stop kill-switch onto the building row and is re-run
on every state change — the steer affordance belongs there too, beside `data-build-stop`, under the same
`isAdmin` surface gate (`opts.isAdmin === true`) — but be accurate about what that gate is: it is a **client
render-gate only**. `isAdminUser()` in plateau:src/backlog-view/backlog-view.ts says so in its own comment
("the dev-server mock-auth model has no server session to enforce against"), and `backlogApi()` in
plateau:vite.config.mts guards `/build` and `/build/stop` with content-type, WIP=1 and active-run checks and
**no admin check at all**. Steering inherits that same pre-existing gap. Do not write "the server re-checks"
into the code comments; if a server-side check is wanted, that is its own item.

**Naming caution:** plateau:src/backlog-view/composer.ts already exists and is the **new-work** composer (#2587,
a lane-board panel that files a backlog item). It is a *different* thing. Do not extend it, and do not name the
new module `composer`-anything without a qualifier — pick e.g. a `steer-composer` module and keep it a pure
HTML-string builder like its neighbours (plateau:src/backlog-view/composer.ts and plateau:src/backlog-view/cross-lane-spans.ts both are), with the submit
wiring living in the mounting module.

## Done when

- **Tier 1** — a test under plateau:src/backlog-view/ (run with `npm test` from the plateau-app checkout)
  drives the steer submit against a stubbed `fetch` and asserts a `POST` to `/api/backlog/build/steer` with the
  `application/json` content-type and the typed text in the body — the same stubbing shape
  plateau:src/backlog-view/queue-view.test.ts already uses to prove the `/build/stop` POST.
- **Tier 1** — a test pins the never-dropped contract: when the endpoint answers `409` (no live child —
  `runner.steer()` returned `false`), the surface reports the steer as **rejected**, and the operator's text is
  not cleared from the composer. A steer that reads as sent but was dropped must fail this test.
- **Tier 2** — the route enforces the same two guards `/build/stop` does: a non-JSON content-type returns
  `415`, and no active run returns `409`. Both are readable in one place, the `if (isBuild)` block of
  `backlogApi()` in plateau:vite.config.mts.
- **Tier 1** — the body schema is enforced, not merely designed: a test asserts the route rejects an empty /
  whitespace-only `text` and a payload over the length cap, with a distinct status from the `415`/`409` guards.
  Without this bullet the schema check can ship unimplemented or silently regress — and its payload is fed
  straight into a model turn.
- **Tier 2** — the runner is untouched: `git diff` over plateau:src/build-runner/runner.ts is empty. `steer()`
  is consumed as-is; this item adds a transport and a surface, not a new delivery mechanism.
- **Tier 3** — the new surface is a separate module from the new-work composer. Read
  plateau:src/backlog-view/composer.ts: it still files backlog items only, with no steer path spliced into it.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: check by mutation or reversion ahead of the build) — The card asserts steering sits 'under the same isAdmin surface gate (opts.isAdmin === true; the server re-checks, the client gate is cosmetic)' — but plateau:src/backlog-view/backlog-view.ts's isAdminUser() says the opposite in its own comment: 'This is a client render-gate only (the dev-server mock-auth model has no server session to enforce against)'. Grepping plateau:vite.config.mts confirms no admin/auth check exists anywhere in backlogApi() — /build and /build/stop are guarded only by content-type, WIP=1, and active-run checks. The card's own claim doesn't hold against the live repo; it should say the isAdmin gate is client-only (matching stop/build today), not that the server re-checks it. [Repo prefixes in this bullet corrected from `we:` to `plateau:` by the driver — the files are in plateau-app.]
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Grepped both ES imports (api/backlog/build, runner.steer) and subprocess/hook callers repo-wide: the only real consumers of the /build family and the steer verb are plateau:src/backlog-view/queue-view.ts (client) and plateau:vite.config.mts (server); plateau:src/build-runner/build-action.ts's hit is a doc-comment only. This matches the card's declared scope exactly — no missed caller.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Server route and client fetch call are built in the same item (not two teams working blind), and the card's Tier-1 'Done when' bullet requires a round-trip test — POST asserted against a stubbed fetch for content-type + body — mirroring the existing /build/stop stub pattern in plateau:src/backlog-view/queue-view.test.ts, so the seam is checked before merge rather than assumed.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The Design section mandates a body schema (non-empty text + a length cap, 'fed straight into a model turn') as one of the two things steer needs beyond stop, but none of the four 'Done when' tiers require a test that this validation actually rejects an empty or oversized payload — only the 415 (content-type) and 409 (no active run) guards are pinned as Tier 2. As written, the schema check could ship unimplemented or later regress with nothing to redden against it.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Tier-1's 'never-dropped' test explicitly requires the surface to report a 409 (runner.steer() returned false) as rejected AND leave the operator's text uncleared — directly targeting the 'reads as sent but was dropped' silent-failure mode the taxonomy warns about, backed by a concrete, nameable acceptance test rather than a prose promise.

**Corrections applied by this review:**

- The card's claim that the isAdmin surface gate is server-rechecked is false: plateau:src/backlog-view/backlog-view.ts's isAdminUser() comment and plateau:vite.config.mts's backlogApi() both confirm the /build and /build/stop routes carry no server-side admin check today — the gate is client-only, and the new steer route will inherit that same (pre-existing, not newly introduced) gap if it copies stop verbatim.

The design is well-grounded — it correctly cites and re-verifies runner.steer(), the /build/stop guard order, and the onBuildStop pattern in plateau:src/backlog-view/queue-view.ts — but it misstates the live security model (no server ever re-checks isAdmin) and leaves its own mandated body-schema validation without a required acceptance test.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** Both open findings accepted and applied. (1) **premise**: verified —
`isAdminUser()` in plateau:src/backlog-view/backlog-view.ts is documented as a client render-gate with no
server session behind it, and `backlogApi()` in plateau:vite.config.mts carries no admin check on `/build` or
`/build/stop`. The Design now says so and explicitly forbids writing "the server re-checks" into the new code.
(2) **decorative-guard**: a tier-1 bullet now requires a test that the body schema actually rejects an
empty/oversized payload, which no criterion covered before. The reviewer's own citations used `we:` prefixes
for plateau-app files; those were corrected to `plateau:`.
