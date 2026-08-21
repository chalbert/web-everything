---
bornAs: xjf40jo
kind: story
size: 8
priority: low
parent: "2531"
status: open
scope: ["plateau:src/backlog-view/", "we:scripts/lib/build-queue.mjs", "we:scripts/backlog.mjs", "plateau:src/build-runner/"]
dateOpened: "2026-07-28"
tags: []
---

# Build-control: multi-user approval, roles and circuit-breakers

Generalize the single-operator buildQueued clear (plateau:src/backlog-view/write-action.ts build-queue add/remove + we:scripts/lib/build-queue.mjs nextToBuild gate) into a permissioned multi-user build gate: owner/admin/member roles, an approval step, and delegation. Extends the single kill-switch (runner stop) into global + per-tenant kill-switches, rate/quota limits and runaway auto-pause (quota-stall). Roles and approval are greenfield; independent of cost-metering.

## Design

**What exists today, verified in this repo (the WE half).** The single-operator gate is two pure pieces plus a
lane-gated CLI:

- [we:scripts/lib/build-queue.mjs](scripts/lib/build-queue.mjs) — `isBuildQueued(item)` (`item.buildQueued ===
  true`), `isReady(item, byId)` (open, not `won't`-tiered, every `blockedBy` resolved — fails CLOSED on an
  unknown blocker), `orderQueueDetailed` / `orderQueue`, and `nextToBuild(items, config, now)` which is
  literally *"order the ready set, keep only `buildQueued`, take the head"*. That last filter **is** the
  clearance gate this item generalizes.
- [we:scripts/backlog.mjs](scripts/backlog.mjs) — the `build-queue add|remove <NNN>` verb that writes
  `buildQueued` into frontmatter, plus the read-only `build-queue [--json] [--next]` view. Config mutation is
  already refused outside a lane clone (#2302/#2339), which is the closest thing to an authority check the
  repo has today.
- [we:scripts/__tests__/build-queue.test.mjs](scripts/__tests__/build-queue.test.mjs) — the existing suite the
  new policy rides into.
- **[we:scripts/check-backlog-item.mjs](scripts/check-backlog-item.mjs) — the consumer that BLOCKS the obvious
  design.** It reads the raw `buildQueued:` frontmatter line with its own regex and **errors** on anything but
  the literal `true` / `false` (*"buildQueued \"<v>\" must be true or false"*). It is reachable as a
  subprocess (we:scripts/check-backlog-item.mjs, invoked with an item id) and the same rule runs inside
  `check:standards`, so
  the very first item written with a clearance RECORD would fail the gate.
- `we:scripts/readiness/dispatch-plan.mjs` reads `buildQueued` as a plain truthy field (its `selectClearedRows`
  tests pass `{ buildQueued: true|false }` objects), so it tolerates a record only if the record is truthy —
  check it, do not assume it.

**The seam: keep the decision pure and in we:scripts/lib/build-queue.mjs; keep identity/persistence in the product repo.**
Today `nextToBuild` answers "may this be built?" from ONE boolean. Generalize that boolean into a *clearance
record* and keep the predicate pure, injectable, and unit-testable — the same posture `isReady` already has:

**Because of that gate, the clearance record does NOT go in `buildQueued`.** Widening that field means
widening the frontmatter validator that exists specifically to keep it a boolean — a change to the gate, not
to the queue. Keep `buildQueued` a boolean meaning exactly what it means today ("a human cleared this"), and
put the richer clearance in a **separate, optional** field:

```js
// we:scripts/lib/build-queue.mjs
export const ROLES = Object.freeze(['owner', 'admin', 'member']);

// item.buildQueued  — UNCHANGED boolean; `true` still means "cleared", and an item with only this field is
//                     treated as an owner-cleared, unexpiring approval (full back-compat, gate untouched).
// item.buildClearance — NEW, optional: { by, role, at, approvals?: [{ by, role, at }], delegatedFrom? }
//                     When present it is authoritative; when absent the boolean stands alone.

/** May this item be pulled NOW? Pure — no clock, no fs, no identity lookup. */
export function clearanceState(item, policy) { /* → { cleared:boolean, reason, needed, have } */ }

/** The circuit breakers, as one pure predicate over counters the caller supplies. */
export function breakerState({ globalStop, tenantStop, builtInWindow, windowLimit, consecutiveFailures, failureLimit }, policy)
  /* → { open:boolean, reason:'global-stop'|'tenant-stop'|'rate'|'quota-stall'|null } */
```

`nextToBuild` then becomes: order the ready set → drop items whose `clearanceState` is not cleared → return
`null` outright when `breakerState().open` (a tripped breaker must yield **nothing**, never "the next item
anyway"). Fail CLOSED everywhere, matching `isReady`'s unknown-blocker rule: a missing role, an unparseable
clearance record, or an unknown breaker counter means NOT cleared.

**What is NOT decided here and must not be invented by the implementing lane:** where identities live, how a
tenant is identified, and how the approval UI is presented are product concerns owned by `plateau:` — this
item's WE half must take them as *injected data* (`policy`, `role`, counters), never look them up. That keeps
the WE side testable with plain objects and keeps the cross-repo couple thin.

**Sequencing:** the clearance record and its back-compat with the bare boolean land first (WE-only, no product
change); the breakers land second (also WE-only); the product surfaces consume both. Roles/approval/delegation
and kill-switches/rate-limits are **independent** halves — they share no data — so they can be two PRs.

**This card is a strong `/split` candidate** (`size: 8`, five distinct capabilities: roles, approval,
delegation, kill-switches, rate/quota + runaway auto-pause). The `## Done when` below deliberately covers only
what is provable **in this repo**; the product-repo half needs its own criteria written against
`plateau:` paths that cannot be verified from here.

## Done when

1. **Executable** — `npx vitest run build-queue` is green with cases pinning `clearanceState`: a bare
   `buildQueued: true` with no `buildClearance` still clears (back-compat, so no existing item regresses); a
   record missing the required approval count does not clear; a record whose approver `role` is not in `ROLES`
   does not clear; an unparseable record does not clear. Fails today — the export does not exist.
2. **Executable** — the frontmatter gate is not broken by the new field: we:scripts/check-backlog-item.mjs
   run on an item id reports `✓ clean` for an item carrying BOTH `buildQueued: true` and a `buildClearance` record, and
   still **errors** on a non-boolean `buildQueued` (the #2530 rule is preserved, not relaxed). Whatever shape
   `buildClearance` takes must be validated there too, or it is unvalidated frontmatter.
3. **Executable** — the same suite pins `breakerState` and its effect on `nextToBuild`: with a global stop,
   a tenant stop, an exceeded window rate, or a consecutive-failure count at the limit, `nextToBuild` returns
   `null` even when a fully-cleared, top-ranked item exists. The breaker must beat the queue, not be sorted
   behind it.
4. **Executable** — a delegation case: an approval recorded `by` a delegate resolves against the delegating
   role, and a delegation that is absent from the injected `policy` does NOT clear (fail closed).
5. **Observable** — the `build-queue --json` verb of we:scripts/backlog.mjs still emits the same row shape for items
   carrying the legacy boolean, so the read-only view and any consumer of it are untouched by the migration.
6. **Executable** — `npm run check:standards` reports 0 errors — run it, because the `buildQueued` rule
   above lives inside it and a widened field would fail there even if the unit suite is green.

> **Not covered by the criteria above, deliberately:** the `plateau:` product surfaces
> (`plateau:src/backlog-view/write-action.ts`, `plateau:src/build-runner/`) — the approval UI, the identity
> source, and the per-tenant kill-switch wiring. Those paths could not be verified from this checkout, so
> criteria for them must be authored in the product repo against its own `npm test` gate rather than guessed
> here. **The one thing that should NOT wait for that card is a shared contract fixture for the seam** — a
> committed JSON example of the `policy` / `role` / counters object the WE predicates consume, asserted by the
> WE suite here and by the product suite there, so the two halves cannot drift while the product half is
> unwritten. Write that fixture in this slice even though its second reader does not exist yet.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card's 'what exists today, verified in this repo' survey names only we:scripts/lib/build-queue.mjs and we:scripts/backlog.mjs as consumers of `buildQueued`, but we:scripts/check-backlog-item.mjs also reads the raw frontmatter `buildQueued:` line via its own regex (lines 135-141) and hard-rejects anything other than the literal strings 'true'/'false' — a subprocess-callable consumer (`npm run check:item -- <NNN>`) the card's search missed.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when items 1-3 require named executable vitest cases pinning clearanceState/breakerState/delegation fail-closed behavior against we:scripts/__tests__/build-queue.test.mjs, not just a description of intended behavior.
- **population** (addressed; strategy: name the population each threshold guards) — The card explicitly declines to invent breaker thresholds (windowLimit, failureLimit, quota-stall) itself, deferring them to caller-injected `policy` data rather than baking in an unjustified numeric guard in we:scripts/lib/build-queue.mjs.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Verified against the real corpus: exactly 8 backlog/*.md items carry `buildQueued: true` today and none use any other value, so the back-compat requirement (bare `true` still clears) is grounded in the actual population it must not regress.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — clearanceState/breakerState are designed to return a `reason` field so a non-clearance is inspectable at the pure-function layer in we:scripts/lib/build-queue.mjs; the card correctly declines to promise how that reason surfaces in the plateau UI since that view is unverifiable from this checkout.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — No round-trip/contract test at the WE↔plateau seam (the `policy`/`role`/counters shape passed into clearanceState/breakerState) is defined even conceptually here; the card defers it entirely to a future product-repo card without stubbing a shared contract test, though it does flag this gap explicitly rather than silently skip it.

**Corrections recommended:**

- none — the preparation held up as written.

A well-grounded, honestly-scoped WE-only design (all its citations of we:scripts/lib/build-queue.mjs and we:scripts/backlog.mjs verified accurate against the live repo) that nonetheless missed a real subprocess consumer of the exact frontmatter field it redefines.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** Both NOT-addressed findings are correct and are now fixed in the body.
(1) `consumer` — this is the more serious of the two and it invalidated the original design: we:scripts/check-backlog-item.mjs
reads the raw `buildQueued:` frontmatter line and ERRORS on anything but the literal `true`/`false`, and the
same rule runs inside `check:standards` — so widening `buildQueued` into a record would have failed the gate
on the first item written. The Design now keeps `buildQueued` an unchanged boolean and puts the clearance in a
separate optional `buildClearance` field, with a new `## Done when` item 2 pinning that the gate still passes
and the #2530 boolean rule is preserved rather than relaxed. we:scripts/readiness/dispatch-plan.mjs is also
now named as a truthy-reader to check. (2) `interface` — a shared contract fixture for the WE↔plateau seam is
now required in this slice rather than deferred to the unwritten product card. No finding was judged wrong.

