---
bornAs: xfmw9pt
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-08-30"
dateStarted: "2026-09-01"
dateResolved: "2026-09-01"
codifiedIn: "docs/agent/platform-decisions.md#operations-declared-once-callers-generated"
preparedDate: "2026-09-01"
ratifiedBy: "Nicolas Gilbert (operator)"
relatedReport: reports/2026-09-01-hosted-key-billed-operation-auth-metering.md
tags: [operations-engine, billing, metering, auth]
---

# The ratified hosted-key-billed delivery mode has no metering, billing, or auth design named anywhere

## Ruling (2026-09-01) — Fork 1 = (a), Fork 2 = (a), gate = NOT-YET

**RATIFIED by the operator (Nicolas Gilbert) on 2026-09-01, as presented.** Both fork defaults ratified as
prepared, and the validation gate's own NOT-YET verdict ratified alongside them:

- **Fork 1 = (a).** Thread `callerId` through the existing `driveRun`/`TELEMETRY_NUMBERS` judge-cost path;
  capture a dispatched agent's own reported cost at `resolveInFlight` (the only point it's known), not a new
  generic `applyPendingEffects` hook. Rejected (b): a per-operation opt-in `effect` step — repeats, for
  billing, the hand-authored-step shape clause 1 already forbids for routing.
- **Fork 2 = (a).** Bearer API key, checked ahead of the route table in `we:scripts/operations/http-adapter.mjs`'s
  `createNodeRequestListener`, resolved to a `callerId`; `resolveCaller` stays undefined by default so
  solo-local's implicit localhost trust is unchanged. Rejected (b): OAuth/JWT end-user identity — presupposes
  an identity provider and a login ceremony this caller shape (an account, not a person) doesn't have.
- **Attribution** composes from the two ratified defaults above (Fork 2 resolves the `callerId`, Fork 1 threads
  it onto the telemetry) — no separate fork, as prepared.
- **Validation gate: NOT-YET, ratified as the standing verdict.** Ratifying the gate means the fork *shapes*
  above are settled precedent — a future implementer doesn't re-litigate them cold when the trigger fires — it
  is **not** a license to build any of it now. Un-gate on either named trigger (either is sufficient, and they
  are not equally merit-grounded): (1) the operational-state store goes shared per
  [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/)/[#2742](/backlog/2742-un-gate-stand-up-the-shared-durable-operational-state-store-/)'s
  own already-ratified trigger (#2742's live remaining blocker is [#2642](/backlog/2642-juror-management-page-review-and-manage-jurors-from-the-cons/),
  still `open`) — the budget-independent blocker, since no engineering effort makes caller auth testable
  against a store structurally unreachable by a second actor; or (2) a real second off-machine caller of
  `we:scripts/operations/http-adapter.mjs` materializes (a market-timing trigger, named honestly as weaker
  than trigger 1, not smuggled in as equally load-bearing). Absent either, hold — no build/task item is
  scaffolded off this ratification.

**On Fork 1(a)-1 (threading `callerId` onto the already-shipped judge-cost telemetry) — left for gate-time,
not scaffolded as its own item.** The prepared card itself notes this half "has no dependency on a second
caller or a shared store... nothing here prevents authoring it whenever convenient," and that stands
un-amended by ratification. Weighed anyway against filing it as a narrow follow-on now, and declined: with
solo-local's implicit single session as the only real caller today, a threaded `callerId` would carry one
constant value with nothing yet on the other end to attribute it against — it only becomes a load-bearing
field once Fork 2's auth actually produces distinct caller identities. A standalone card for a few-line
plumbing change with no live consumer is the same premature-build motion the gate exists to hold off elsewhere
in this decision, even though this one slice is technically unblocked. Recorded here as a one-line
implementation note for whoever builds Fork 1 + Fork 2 together once a trigger fires, rather than as separate
tracked work.

Codified as an extension to
[`#operations-declared-once-callers-generated`](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
clause 4 (the two-tier seam clause this decision gives its hosted-tier shape to).

we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated clause 4 (ratified, #3031) names two permanent delivery modes: solo-local (subscription-funded) and hosted-key-billed. The solo mode is built; the hosted mode has zero design past its name — no card describes key-to-spend attribution, metering, or how `we:scripts/operations/http-adapter.mjs` (no auth/token concept today) would authenticate a caller once it isn't localhost-only. The backlog's only billing cards (#2531, #2779, #2780, #554) are scoped to plateau-app's own paid page-building product — a different consumer, not this operation engine.

Distinct from #3049: that decision gates *selling* the conveyor externally ("NOT-YET", pending a real customer ask) and explicitly holds that clause 4's two modes are "narrower... nothing... proposes selling the hosted tier to a third party." This item is about the mode existing at all for WE's own use — a ratified target, not a speculative sale — so it is not blocked on #3049's trigger.

## Done when

1. Capture, not build: name what "key-billed" actually requires — attribution (whose key, which run), metering (what unit, read from where), and an auth story for we:scripts/operations/http-adapter.mjs once a caller isn't implicitly trusted localhost. No implementation is required to close this card; a decision record with named forks (or a stated "not yet, here's the trigger" per the #3049 shape) is sufficient.
2. Checked against #2626/#2742 (the operational-state-store decision) so this card doesn't re-litigate the settled local-lock-vs-DO split — it should cite that decision, not duplicate it.

## Prepared 2026-09-01 — what's ruled below

Was capture-only; prep (this pass) does what #1 above asks. Prior-art survey published as
[`/research/hosted-key-billed-operation-auth-metering/`](/research/hosted-key-billed-operation-auth-metering/)
(report: `we:reports/2026-09-01-hosted-key-billed-operation-auth-metering.md`). Three of the four named
concerns (attribution / metering / auth) resolve to **two forks**, prepared to Definition of Ready below —
`preparedDate` marks that the research + authoring is done, **not** that this card is ratified.

## Standing test — is each concern a fork, support-both, or a validation gate?

Run per concern, in order (*backlog-workflow.md → Standing test*):

- **Metering** (what unit, read from where) — a **forced invariant** (outcome (a)): exactly one branch is
  correct and the alternative is flawed, not merely less convenient. See Fork 1.
- **Auth** (how a caller authenticates once it isn't implicit-trust localhost) — a **genuine choice**
  (outcome (b)): two coherent branches exist, but for this caller shape one is excluded. See Fork 2.
- **Attribution** (whose key, which run) — **dissolves, not a fork.** Once Fork 1's metering event carries a
  `callerId` and Fork 2's auth default resolves that `callerId` from the key, "whose key, which run" is
  answered by composing the two defaults — there is no third, independent design choice left to make. Recorded
  as a corollary below Fork 2, not authored as its own `## Fork N` (a `## Fork 3` here would be the #1892
  "config dimension in disguise" miss run backwards — inventing a fork for a question two other forks already
  settle).
- **When to build any of it** — neither a fork nor support-both: "build now" and "stay unbuilt" are not two
  coherent, simultaneously-supportable end states for the *same* code, and there is no forced invariant either
  (nothing breaks by staying unbuilt today). This is the **third archetype** — a one-sided go/no/not-yet call
  on a candidate — so it takes the **validation-gate shape**, not a `## Fork N`. See *Validation gate* below.

## Fork 1 — does per-run dollar metering land at the choke point every judge step already shares, or does dispatch need its own hook?

**Correction from the skeptic pass, folded in before stamping:** the first-drafted version of this fork
claimed metering was wholly greenfield and proposed a new generic wrapper around `applyPendingEffects`. That
premise does not survive a check against the tree — real, per-run dollar metering **already exists**, is
already engine-level, and is already caller-agnostic: `TELEMETRY_NUMBERS = ['costUsd', 'durationMs', 'wallMs',
'numTurns', 'loadedContextTokens']` at
[`we:scripts/operations/run-record.mjs:109`](/scripts/operations/run-record.mjs#L109), populated from every
juror spawn's own `total_cost_usd` in
[`we:scripts/lib/judge-spawn.mjs:642,676`](/scripts/lib/judge-spawn.mjs#L642), and stamped onto the run record
packaged by `createDefaultJudge`'s judge wrapper
([`we:scripts/operations/cli-adapter.mjs:488`](/scripts/operations/cli-adapter.mjs#L488)) and threaded onto
the run by `driveRun` ([`we:scripts/operations/cli-adapter.mjs:571`](/scripts/operations/cli-adapter.mjs#L571)) —
already the shared path "all three real entry points... call... directly" (this item's own PR
#1195-round-6 citation), and already printed as `judge spend: $X.XXXX over N juror(s)`
([`we:scripts/operations/cli-adapter.mjs:792`](/scripts/operations/cli-adapter.mjs#L792)). Metering-by-dollars
for `judge` steps is not an open design question; it shipped. The genuinely open question is narrower: (i) how
a `callerId` gets composed onto telemetry that already exists, and (ii) whether the one effect kind with
**zero** cost capture today — `dispatch: true` (an agent spawn, per
[`we:scripts/operations/effect-executor.mjs:87`](/scripts/operations/effect-executor.mjs#L87)) — needs a
different hook, because a dispatched agent's cost is not known at the moment the effect is applied (grepping
`costUsd` across `we:scripts/operations/dispatch-lane*.mjs` returns nothing).

**Fork-existence justification (forced invariant, narrower than first drafted):** a `dispatch: true` sink
returns an `inFlight` marker
([`we:scripts/operations/effect-executor.mjs:114`](/scripts/operations/effect-executor.mjs#L114)) and returns
immediately — the spawned work, and its cost, does not exist yet at that point in the control flow. Hooking
the synchronous apply path (as the first draft proposed) is therefore flawed for this one effect kind, not
merely a stylistic alternative: the value being captured has not been produced yet.

- **(a) `callerId` onto the existing judge-cost telemetry; dispatch cost captured where it resolves — DEFAULT.**
  Two small, targeted additions to two already-engine-level points, not one new generic hook:
  1. Thread `callerId` through the same `driveRun` / `TELEMETRY_NUMBERS` path every `judge` step already
     populates — a field addition to data already computed and stored per run, not new machinery.
  2. Capture a spawned agent's own reported cost (the same `total_cost_usd` shape `we:scripts/lib/judge-spawn.mjs`
     already reads) at the **only supported way an in-flight dispatch closes out** —
     `resolveInFlight` ([`we:scripts/operations/effect-executor.mjs:411`](/scripts/operations/effect-executor.mjs#L411),
     the waker's `--resolve` surface, `we:scripts/operations/wake.mjs`) — through its existing `result`
     parameter, not a field bolted onto `applyPendingEffects`.
  ```js
  // we:scripts/operations/effect-executor.mjs — illustrative, not built
  export function resolveInFlight(run, key, { status, result = null, error = null, costUsd = null } = {}) {
    // ...existing terminal-status validation, unchanged...
    return withEntry(run, key, { status, result, error: error == null ? null : String(error), costUsd });
  }
  ```
  Both additions stay engine-level and automatic — no operation author opts in — they simply land at two
  different points in the run lifecycle, because a dispatch's cost genuinely is not known at the same moment a
  judge step's is.
- **(b) Per-operation opt-in `effect` step.** *Rejected*, same reasoning as the first draft, now correctly
  scoped to only the dispatch gap (the judge-step half is not a "build or not" question — it exists): repeats,
  for billing, the exact shape clause 1 already forbids for routing — a hand-authored metering step an author
  could forget — for a number the engine can capture once, generically, at resolution.

**Skeptic:** REFUTED (first draft) → corrected above, per a real skeptic sub-agent pass (not the author's own
attack). The claim that metering was wholly greenfield, and the proposed generic `applyPendingEffects`
wrapper, do not survive: real, already-engine-level judge-cost telemetry exists
(`we:scripts/operations/run-record.mjs:109`, `we:scripts/lib/judge-spawn.mjs:642,676`,
`we:scripts/operations/cli-adapter.mjs:488,792`), and the one real gap (dispatch-effect cost) needs a
different hook (`resolveInFlight`, not `applyPendingEffects`) because the value isn't known until async
resolution. The corrected default (a) above was then re-attacked and SURVIVES: it composes with what already
ships rather than duplicating it, and places the new capture at the one point the value actually exists.
(Re-attacked further on citation-scope: clause 2 — cited for the `effect` replay-safety guarantee — also
names `judge` as the model/cost-bearing sibling kind in the same clause; the corrected default now cites
both, closing the selective-citation gap the skeptic found in the first draft.)
**Screen:** clear (re-checked against the corrected default). (1) Not a WE↔FUI boundary question — entirely
inside the operation engine's own run-record and effect-executor modules. (2) With unlimited budget, a real
merit gap survives: composing onto the existing telemetry avoids two dollar-tracking mechanisms drifting
apart, and dispatch cost capture must sit at resolution regardless of budget, because the number does not
exist any earlier — not a "which is cheaper to build" question.

## Fork 2 — how does a caller authenticate once it isn't the operator's own co-located session?

**Fork-existence justification (genuine choice):** two coherent, mutually-exclusive authentication shapes
exist in the wild for an HTTP API — API-key bearer auth and OAuth/JWT end-user identity — and a single engine
cannot be both at once for the same route table without two parallel auth stacks. The composability probe
fails to dissolve this to support-both: an OAuth flow presupposes an identity provider, a login redirect, and
a *user* on the other end, delegating one person's access to a third party — nothing here has that shape.
There is no shared kernel the two branches can both be a facade over; they answer different questions (which
is the excluded branch, named below).

**Correction from the skeptic pass, folded in before stamping:** the first draft cited clause 1's caller list
— "the command-line caller (agents, any clone, no server), the HTTP caller (the console), the typed-tool
caller" — as if it already said these are "machine and account callers, not an end-user browser session."
Checked against the actual clause 1 text
([`we:docs/agent/platform-decisions.md:3082`](/docs/agent/platform-decisions.md#L3082)), it says no such
thing — it names three surface *shapes*, not a human/machine split, and "the HTTP caller (the console)" names
`plateau:tools/dev-panel/vite-plugin.ts` (per clause 1's own text, cited above), a browser UI a person
operates. Citing clause 1
as settling "never an end-user" was citation-scope overreach — the claim was the item's own gloss, not
something the clause licenses. Corrected: the account-vs-person distinction below is argued directly from the
caller population `key-billed` actually bills (clause 4: an account, paying per key — not a person, per
login), not from clause 1.

- **(a) Bearer API key, checked by the transport adapter — DEFAULT.** A caller sends the key in an
  `Authorization` header; a check ahead of the derived route table in
  [`we:scripts/operations/http-adapter.mjs:593`](/scripts/operations/http-adapter.mjs#L593)
  (`createNodeRequestListener`) resolves it to a `callerId` and passes that down to
  `handleOperationRequest` (`we:scripts/operations/http-adapter.mjs:385`) alongside the existing
  `{ resolve, names, store, judge, newRunId }` deps — never as a per-operation declaration field, for the
  same "declared once" reason Fork 1(b) is rejected. Grounded in Finding 2 of the research topic: AWS API
  Gateway (key *is* the tenant id), Cloudflare Workers for Platforms (the constellation's own substrate per
  [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/)'s DO/D1 lean — "meter
  every request for billing" via a scoped API token), and Anthropic's/OpenAI's own consumer APIs all
  authenticate exactly this caller shape with a bearer key, never OAuth. Finding 3 names the concrete key
  shape when this is eventually built: high-entropy (≥256-bit) tokens, stored hashed (never plaintext), looked
  up to the tenant/account they were issued for.
  ```js
  // we:scripts/operations/http-adapter.mjs — illustrative, not built
  export function createNodeRequestListener(deps, { maxBodyBytes = 1_000_000, resolveCaller } = {}) {
    return async function operationsRequestListener(req, res) {
      let response;
      try {
        const callerId = resolveCaller ? await resolveCaller(req.headers.authorization) : undefined;
        if (resolveCaller && !callerId) { response = fail(401, 'missing or unknown API key'); }
        else {
          const body = await readJsonBody(req, maxBodyBytes);
          response = await handleOperationRequest({ method: req.method, url: req.url, body }, { ...deps, callerId });
        }
      } catch (e) { response = fail(e?.httpStatus ?? 500, String(e?.message ?? e)); }
      // ...unchanged response write...
    };
  }
  ```
  `resolveCaller` is undefined by default — solo-local's own dev-panel mount keeps today's implicit
  localhost trust unchanged; only a hosted deployment supplies it. Same adapter code, both tiers — exactly
  clause 4's "two permanent products… not a migration," implemented as one function taking an optional
  dependency, not a fork in the code itself.

  **The console caller is a human-operated browser UI, and the default still covers it — named explicitly so
  the item doesn't quietly skip it.** `key-billed` (clause 4) bills a key, i.e. an *account*, not a person
  logging in; the console in hosted mode is still bearer-key, paste-once (stored client-side, e.g.
  `localStorage`, sent as the same `Authorization` header every other caller sends) — one identity per
  account, not one identity per human. This is a deliberate narrower claim than "every comparable system uses
  bearer keys everywhere": AWS, Stripe, and Cloudflare (Finding 2) *do* run a second, session/login-based
  stack for their own multi-tenant dashboards, because those dashboards serve many distinct *people* per
  account with different permissions. This engine's console has no such requirement stated anywhere in clause
  4 or elsewhere — if one is ever wanted (per-person roles inside one billed account), that is new,
  additional scope this decision does not authorize by default, not something the bearer-key branch already
  silently provides.
- **(b) OAuth / JWT end-user identity flow.** *Rejected*: presupposes an identity provider and a login
  ceremony this caller shape does not have and does not need — a machine/account credential is being
  authenticated, not a person. Adopting it would be the exact wrong-shaped stretch the research topic's
  Finding 2 quotes directly: "the mistake to avoid is defaulting to whichever one was easiest… and then
  stretching it to cover use cases it was never designed for."

**Skeptic:** SURVIVES-WITH-AMENDMENT, per a real skeptic sub-agent pass (not the author's own attack). Two
attacks: (1) "OAuth is the industry-standard, more secure choice — rejecting it on caller *shape* alone looks
like picking the cheaper option and rationalizing it." Answer: security is not branch-dependent here — a
high-entropy, hashed, revocable API key is the standard credential for this exact caller population
industry-wide (every surveyed comparable uses it, including the constellation's own Cloudflare substrate), not
a shortcut *around* OAuth's security properties; OAuth adds a delegation/consent model this engine has no use
for (there is no third-party app requesting access to a user's data on their behalf — the caller *is* the
account). This half SURVIVES unchanged. (2) Citation-scope, REFUTED and amended above: the first draft cited
clause 1 as if it already distinguished machine callers from end-users, and it doesn't — corrected to argue
the account-vs-person distinction from clause 4's own billing unit (the key/account) instead, and the console
caller (a real human-operated browser UI) is now named explicitly rather than folded silently into "machine
caller." Classification axis: not a config dimension (a caller cannot legitimately pick either transport
per-call; the engine picks one auth transport for its whole hosted surface), not support-both (running two
parallel auth stacks for one route table is real, ongoing cost with no consumer asking for the second — and,
per the amendment above, this engine's console has no stated per-person-inside-one-account requirement the
way AWS/Stripe/Cloudflare's own dashboards do, so their second stack is not evidence this engine needs one),
not settled by precedent within this repo (no existing WE auth pattern to defer to — this is genuinely
greenfield for the operation engine). Statute-overlap: none — clause 4 names the tier
architecture, not its auth mechanism; no other anchor in `we:docs/agent/platform-decisions.md` governs HTTP auth. Citation
scope: clause 1 ("declared once, callers generated") is cited only for *where* the check lives (transport
adapter, not a declaration field), not as authority for *which* auth scheme — that authority is the prior-art
survey.
**Screen:** clear. (1) Not an impl detail hidden behind the WE↔FUI boundary — this is the operation engine's
own external-facing transport surface, the correct side for this call. (2) With unlimited budget for both
branches, a real merit gap survives: OAuth would still require standing up an identity provider and consent
flow for a caller population that is never an end user — the branch difference is about *what the caller is*,
not about how fast either could be built. Merit, not prioritization.

## Attribution — a corollary, not a third fork

"Whose key, which run" is answered by composing Fork 1's default and Fork 2's default, not by a separate
design act: Fork 2's `resolveCaller` resolves a `callerId` from the bearer key; Fork 1's default threads that
`callerId` onto the run's existing judge-cost telemetry (`driveRun`/`TELEMETRY_NUMBERS`) and onto a dispatch
effect's cost at `resolveInFlight`. The resulting attribution — `callerId` alongside a run's `costUsd` (and,
for a dispatch effect, its resolved cost) — falls out of composing the two defaults; no further *authentication-or-metering-mechanism*
fork exists to author. Where that data physically lives is **not re-litigated here**: it is a shared-truth
artifact by the same nature test [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/)
already ran (any hosted, multi-caller deployment needs it cross-session), so it inherits that decision's ruling
outright — a store-seam module (mirroring `we:scripts/conveyor/queue-store.mjs` / `we:scripts/lib/jury-ledger.mjs`)
now, migrating to DO/D1 on #2626's own already-ratified trigger, never a fresh local-lock-vs-DO weighing.

**What "no further fork" does NOT cover — named explicitly, per the skeptic pass, so the item's own title
("no metering, billing, **or auth** design named anywhere") isn't quietly overclaimed as fully closed.** Two
concerns the title itself flags are real, separate design surfaces this pass does not fork or gate, because
each is downstream of a trigger that hasn't fired and would be designed cold today: (1) **key
provisioning/revocation** — how a caller gets a key in the first place, rotates one, or has one revoked (a
compromised key, a canceled account) is not settled by Fork 1 + Fork 2, which only cover the *shape* of an
already-issued key's use; (2) **metering → an actual bill** — the attribution data above is a usage record,
not a charge; turning it into an invoice (a Stripe integration or equivalent, dunning, plan tiers) is a
distinct system the item's own title names but never forks. Both are recorded here as **explicitly deferred**
under the same *Validation gate* below, not silently subsumed by "no further fork exists."

## Validation gate — build the hosted-mode auth + metering now, or not-yet?

**Why this is a validation gate, not a `## Fork N`:** "build now" and "stay unbuilt" are not two coherent,
simultaneously-supportable end states for the same code (support-both fails), and nothing is *broken* by
staying unbuilt today (forced-invariant fails too) — solo-local, the only mode with a real caller today, needs
none of this. This is a one-sided go/no/not-yet call on a candidate.

**Digest + verdict: NOT-YET**, gated on a named, falsifiable trigger.

**Prior-art delta.** Every surveyed system (AWS API Gateway, Stripe Meters, Cloudflare Workers for Platforms,
Anthropic/OpenAI) builds auth + metering only once a real second caller needs isolating from the first — none
of them ship a multi-tenant auth layer speculatively, ahead of a second tenant existing. WE's own precedent
agrees: [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/) dissolved an
almost-identical "build the shared store now or later" question to accepted-on-merit + a concrete trigger
rather than building ahead of the need, and [#3049](/backlog/3049-the-conveyor-as-a-shippable-product-not-machinery-and-what-t/)
did the same for productizing the conveyor itself.

**What's true today, checked against the WE tree** (`plateau-app` is a sibling repo, not present in this
checkout, so the following is checked as far as WE's own tree can confirm, not asserted as a cross-repo fact):
`we:scripts/operations/http-adapter.mjs` is mounted, per its own doc comment and WE-side references, only into
`plateau:tools/dev-panel/vite-plugin.ts` — the operator's own local dev panel; nothing in WE's tree names a
second mount. The run-store it reads/writes (`we:scripts/operations/run-store.mjs`) is a gitignored,
session-local sidecar per [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/)
— not yet a store a second, off-machine caller could even reach. **This is the real, budget-independent
blocker** (per the two-confusion screen pass): no amount of engineering effort makes caller auth *testable*
against a store that structurally cannot yet serve a second actor — that gap survives free, perfect
engineering. Building it now would mean building against a store nothing else can reach.

Separately, **Fork 1's corrected scope narrows what "not-yet" actually withholds:** threading `callerId` onto
the already-shipped judge-cost telemetry (Fork 1(a)-1) has no dependency on a second caller or a shared store
— it is a small, low-risk field addition to code every caller already exercises today, and nothing here
prevents authoring it whenever convenient. What is genuinely gated by this validation gate is auth (Fork 2)
and dispatch-effect cost capture (Fork 1(a)-2, new territory) — not "metering" as a whole, which the first
draft implied more broadly than the corrected Fork 1 actually requires.

**Concrete un-gate trigger — the actual go/not-yet signal (either fires it, and the two are not equally
merit-grounded — named honestly rather than treated as interchangeable):**
1. **The real, budget-independent blocker.** The operational-state store goes shared/cross-actor —
   [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/)'s own already-ratified
   trigger fires (its migration item [#2742](/backlog/2742-un-gate-stand-up-the-shared-durable-operational-state-store-/),
   whose own `blockedBy: ["2703", "2626", "2642"]` — #2703 and #2626 are already resolved; the live
   remaining blocker is [#2642](/backlog/2642-juror-management-page-review-and-manage-jurors-from-the-cons/),
   still `open`) — because only then does the run store this decision's ledger rides on become reachable by
   more than one machine at all. This survives the infinite-budget test: free, perfect engineering still
   cannot make caller auth testable against a store structurally unreachable by a second actor.
2. **Or**, independent of #2626/#2742: a real second caller of `we:scripts/operations/http-adapter.mjs`
   needs to reach it from off the operator's own machine — a concrete request, not a hypothetical one, the
   same "not a hypothetical enterprise buyer" bar #3049's own gate holds itself to. **Named honestly, per the
   two-confusion screen pass: this trigger is business/market-timing, not a merit-based blocker** —
   correctness is testable via a mocked caller/harness without a real second tenant, so trigger 2 would not
   by itself survive the infinite-budget test the way trigger 1 does. It is included anyway as a legitimate,
   independent way to un-gate (either trigger is sufficient; trigger 1 alone already carries the "why not
   now" argument), not smuggled in as if it carried the same budget-independent weight as trigger 1.

Absent either, do not build toward this. Trigger 1 alone is sufficient reason to hold: no engineering budget
manufactures a reachable shared store.

**Skeptic:** SURVIVES, per a real skeptic sub-agent pass. Attack: "isn't this circular — Forks 1 and 2 are
prepared as if settled, but the gate says don't build them; what did prep actually accomplish?" Answer: no
circularity — prep's job is exactly to have the *design* ready so that when the trigger fires, the decision
turn is fast ratification of an
already-attacked default, not cold research done under time pressure at the moment a real caller shows up
(the whole point of `/prepare`, per the skill's own framing). The gate governs *build timing*; Forks 1–2
govern *shape*, and shape can be — and, per the skill's close-out gate, must be — fully designed ahead of the
trigger.
**Screen:** clear, per a real fresh-context two-confusion-screen pass, with the caveat that pass raised
already folded into the trigger list above. (1) This is squarely a build-sequencing/go-to-market-timing
question, not an implementation detail hidden behind the WE↔FUI boundary — correctly kept as a
business/architecture-timing call on this item. (2) Imagining unlimited engineering capacity: the auth +
metering code would exist "for free," but that does not manufacture a reachable shared store to validate it
against — trigger 1 alone survives the infinite-budget test and is sufficient to carry the gate on its own.
The screen agent's own finding, independently reached: trigger 2 does *not* survive that same test in
isolation (correctness is testable via a mocked caller without a real second tenant) — it is prioritization,
not merit, and the gate now says so explicitly rather than leaning on "no way to validate" evenly across both
triggers, which was the item's original overclaim.

### Review jury (provisional — pre-registered #2638)

Care band: **elevated** (system-machinery inside a statute-governed engine; cross-repo consideration —
plateau-app's dev-panel is the sole current mount point and a future hosted deployment would be a second
cross-repo consumer; not `high` — nothing here touches gate-self). Predicted touch-set of the work this
decision authorizes, if the gate's trigger later fires: `we:scripts/operations/http-adapter.mjs`,
`we:scripts/operations/effect-executor.mjs`, `we:scripts/operations/run-record.mjs`,
`we:scripts/operations/run-store.mjs`, `we:docs/agent/platform-decisions.md`.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

Refs #3031 · [`#operations-declared-once-callers-generated`](/docs/agent/platform-decisions.md#operations-declared-once-callers-generated) ·
[#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/) ·
[#2742](/backlog/2742-un-gate-stand-up-the-shared-durable-operational-state-store-/) ·
[#3049](/backlog/3049-the-conveyor-as-a-shippable-product-not-machinery-and-what-t/) ·
[#2779](/backlog/2779-reliable-per-build-cost-metering-attribution-model-tier-poli/) ·
research: [`/research/hosted-key-billed-operation-auth-metering/`](/research/hosted-key-billed-operation-auth-metering/).
