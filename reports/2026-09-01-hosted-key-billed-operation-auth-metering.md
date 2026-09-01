# Hosted key-billed delivery mode: caller auth, attribution, and metering

**Date**: 2026-09-01
**Point**: Grounds backlog #3400's prep — per-run dollar metering already exists (a skeptic sub-agent pass corrected the first-drafted "greenfield" framing) and just needs `callerId` attribution plus a new cost-capture hook for the one effect kind with none (`dispatch`); auth is a bearer API key checked at the HTTP transport layer (genuine choice, OAuth excluded, with the console caller named explicitly); attribution is a corollary of the two; key provisioning/revocation and metering-to-invoice billing are named but explicitly deferred, not silently subsumed; and building the gap that remains is NOT-YET, primarily gated on the run-store going shared/cross-actor (#2626/#2742) with a second, business-timing trigger named honestly as such.
**Plan file**: none — item originated as a backlog decision (`kind: decision`, #3400), not a `plans/` inbox drop.
**Research page**: `/research/hosted-key-billed-operation-auth-metering/`

---

## Question

Backlog #3400: clause 4 of the ratified operation-engine statute
(`we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated`) names two permanent
delivery modes — solo-local and hosted-key-billed — but the hosted mode has no design for attribution,
metering, or auth, and `we:scripts/operations/http-adapter.mjs` has no auth/token concept today. What does
"key-billed" actually require, and is now the time to build it?

## Recommendation

1. **Metering — `callerId` onto the existing judge-cost telemetry; a new hook only for dispatch effects.**
   Corrected in-session by a skeptic sub-agent pass: per-run dollar metering already ships
   (`we:scripts/operations/run-record.mjs:109`'s `TELEMETRY_NUMBERS`, populated by
   `we:scripts/lib/judge-spawn.mjs`, packaged by `createDefaultJudge` at
   `we:scripts/operations/cli-adapter.mjs:488` and threaded onto the run by `driveRun` at
   `we:scripts/operations/cli-adapter.mjs:571`).
   The real gap is (i) threading `callerId` onto that existing telemetry and (ii) cost capture for the one
   effect kind with none today — `dispatch: true` (an agent spawn) — hooked at `resolveInFlight`
   (`we:scripts/operations/effect-executor.mjs:411`), because a dispatch's cost isn't known until it resolves
   asynchronously, not at the synchronous apply moment a first draft assumed. Both stay engine-level and
   automatic, never a per-operation opt-in `effect` step, for the same reason the sibling plateau-app card
   #2779's "reliable" framing warns against: an opt-in scheme risks silent revenue leakage.
2. **Auth — a bearer API key**, checked by the HTTP transport adapter ahead of the derived route table, never
   OAuth. Every surveyed comparable (AWS API Gateway usage plans, Cloudflare Workers for Platforms — the
   constellation's own substrate per #2626's DO/D1 lean, Anthropic's and OpenAI's own consumer APIs)
   authenticates this exact caller shape with an API key, never an identity-provider login flow — including
   the console caller (a real human-operated browser UI), which is bearer-key too: `key-billed` bills an
   account/key, not a per-person login.
3. **Attribution — a corollary**, not a third fork: composing the two defaults above answers "whose key,
   which run." Two concerns the item's own title names — key provisioning/revocation, and turning a metering
   ledger into an actual invoice — are real, separate design surfaces this pass does not fork; recorded as
   explicitly deferred rather than silently subsumed.
4. **Build timing — NOT-YET**, mirroring how #2626 and #3049 both dissolve a "build now vs later" question to
   accepted-on-merit + a named trigger. Two triggers, named honestly as unequal: the run-store going
   shared/cross-actor (#2626 → #2742, `blockedBy: #2703`) is the real, budget-independent blocker (a
   two-confusion screen pass confirmed this survives an infinite-engineering-budget test); a real second
   caller of the HTTP adapter is a legitimate independent trigger but is business/market-timing, not merit —
   the same screen pass found it would not survive that test alone.

## Key Findings

- `we:scripts/operations/http-adapter.mjs` has zero auth/token vocabulary today (grep for
  `localhost|auth|token|apiKey|bearer` returns only unrelated doc prose) and is mounted only into
  `plateau:tools/dev-panel/vite-plugin.ts`, an implicitly-trusted localhost dev panel — checked as far as
  WE's own tree can confirm; `plateau-app` is a sibling repo not present in this checkout.
- **A skeptic sub-agent pass found the first-drafted metering fork's premise false**: per-run dollar metering
  (`costUsd`) already ships, engine-level, caller-agnostic, for every `judge` step
  (`we:scripts/operations/run-record.mjs:109`, `we:scripts/lib/judge-spawn.mjs:642,676`,
  `we:scripts/operations/cli-adapter.mjs:488,792`). The one real gap is `dispatch`-effect cost capture, which
  needs a different hook (`resolveInFlight`, not the generic effect-apply path) because the value isn't known
  until async resolution.
- Stripe retired the legacy usage-records API as of `2025-03-31.basil`; every metered price now requires a
  backing Meter, reported via idempotent per-event calls — the event-at-usage-time shape maps directly onto
  the operation engine's existing `effect` step kind (clause 2: "the executor applies it keyed by run + step,
  so replay is safe").
- AWS API Gateway keys a usage plan directly off the API key (the key *is* the tenant id); Cloudflare Workers
  for Platforms states the identical pattern as "meter every request for billing" with a scoped API token;
  Anthropic/OpenAI bill per bearer API key, never OAuth, for programmatic callers.
- **A skeptic sub-agent pass also found a citation-scope overreach in the first-drafted auth fork**: it cited
  clause 1's caller list as if it already distinguished machine callers from end-users; clause 1
  (`we:docs/agent/platform-decisions.md:3082`) says no such thing, and "the HTTP caller (the console)" is a
  real human-operated browser UI. Corrected to argue the account-vs-person distinction from clause 4's own
  billing unit (the key/account) instead, with the console caller named explicitly.
- #2779/#2780 (plateau-app-scoped) are a different consumer (the AI page-building product) but the same
  design lesson: "reliable" cost metering means the system cannot rely on every call site remembering to
  report.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:src/_data/researchTopics/hosted-key-billed-operation-auth-metering.json` | created |
| `we:src/_includes/research-descriptions/hosted-key-billed-operation-auth-metering.njk` | created |
| `we:backlog/3400-the-ratified-hosted-key-billed-delivery-mode-has-no-metering.md` | prepared — forks authored, `preparedDate` stamped |
