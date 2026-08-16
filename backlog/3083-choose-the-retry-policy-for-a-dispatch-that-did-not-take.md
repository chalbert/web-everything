---
bornAs: xlt67co
kind: decision
size: 1
parent: "3029"
status: open
dateOpened: "2026-08-12"
preparedDate: "2026-08-16"
tags: [plateau-loop, operations, engine, dispatch, retry]
scope:
  - we:scripts/operations/effect-executor.mjs
---

# Choose the retry policy for a dispatch that did not take

> **RULED 2026-08-13 (operator, in session). The mechanism is settled; the NUMBERS are deliberately not.**
>
> **Declared per EFFECT** — beside `idempotent`, which is the same shape for the same reason: only the effect
> knows whether it is a cheap comment or a forty-minute build. Scoping it to "operations that spend on AI"
> was considered and rejected as the wrong axis: spend and retry are different questions, and every effect is
> retryable.
>
> **Enforced in the EXECUTOR**, the one chokepoint every caller passes through. Enforcing in the waker would
> bound today's timer and leave the next automatic caller unbounded — and "the next caller must remember" is
> the class of rule this repo keeps proving does not hold.
>
> **Default: the machine does not retry; a person still may.** An effect that declares nothing is retried by
> people exactly as before, and not by the timer. Unlimited automatic retry IS the defect — measured at
> eleven dispatches over ten ticks at exit 0. A first draft defaulted to "unlimited, blast radius zero"; that
> was risk-management dressed as a recommendation, and merit says the timer needs permission.
>
> **Exhaustion returns a DISPOSITION, not a boolean.** Initially `retry` and `ask-human`. The set is closed
> and versioned, and may grow — a blocker identified, needs splitting — but **an outcome earns its place only
> when it changes what happens next**, either machine-actioned or actionable by a person reading it.
> Otherwise it is a label on a shrug, which is exactly how the waker's `unresolved` cost three rounds. An
> unknown member read from an older record routes to a human; never ignored, never crashed.
>
> **Only `retry` is automatic.** Everything else goes to a person. That is what stops the set becoming a way
> for the machine to keep deciding things about itself.
>
> **The numbers stay unset**, and now for a measured reason rather than caution: #3090 found that the
> sample-size estimator answers `1` above a 97% base rate, so the tool meant to say "we have enough" cannot
> yet. The collector (#3091) is accumulating; the floor needs deriving from a fixed estimator.
>
> **Follow-up, not part of this:** on exhaustion, ask a juror to diagnose rather than only reporting. Better
> suited to a judge than the convergence question refused in #3079 — it runs ONCE and reads an ERROR, not the
> work's own plausible output. Two constraints: it may grant ONE bounded extension, never repeatedly, and any
> failure or unrecognised answer routes to the human. It may RECOMMEND a different approach in prose; it may
> not apply one, because applying one is the converge loop with write access and its own review.

The executor's `failed` means *"the sink threw `notApplied` — I am CERTAIN nothing landed"*, and its
pre-flight lets such an entry straight back through to the sink. That is correct and always has been, because
until now the only thing that re-entered `applyPendingEffects` after a failure was **a person re-running the
command**. Retry was bounded by someone deciding to retry.

The waker (#3084) breaks that. It re-enters on a timer, so `failed` becomes an unbounded automatic retry
with no cap and no backoff. PR #1186's round-3 reviewer measured it on a persistently broken dispatch — bad
credentials, exhausted quota, a missing binary:

```
after park: dispatches = 1
tick 1 → 2 · tick 2 → 3 · tick 3 → 4 · … · tick 10 → 11
exit code 0 every tick, operator line byte-identical every tick
```

The waker now refuses to write anything for a dispatch that did not take, precisely because there is no
policy to appeal to. That is the safe answer and it is not the right one forever: work that genuinely did not
start SHOULD be retried, and today a person has to notice and do it by hand.

## What has to be decided

- **How many times, and how far apart.** A fixed cap, exponential backoff, or a deadline.
- **Where the count lives.** The run record is the obvious home, but it is transient session-local state and
  a retry budget arguably outlives it.
- **Who owns it.** The executor (so every caller inherits it), the waker (so only automatic retry is
  bounded and a human re-run stays unbounded), or the declaration (so an operation states its own tolerance).

The third is the most interesting and the least obvious: a `gh` comment and a CI build want very different
answers, and the declaration is the only place that knows which one it is.

**Status of the three bullets above, after the 2026-08-13 ruling.** *Who owns it* and the shape of the
answer are **settled** by the blockquote at the top of this item (declared per effect, enforced in the
executor, disposition not a boolean) — that is a live human ruling already made in-session, restated below
for the record, not re-opened here. *How many times, how far apart* is **not decidable yet** — see the
validation gate below. *Where the count lives* is the one bullet the ruling does not address, and is a
genuine open fork — see Fork 1.

## Why this is a decision and not a task

The three homes differ in what they couple, not in effort — the same shape as [#3070]. Putting it in the
executor changes behaviour for every existing caller including the human one; putting it in the waker leaves
two different retry semantics in the system; putting it in the declaration means every operation now has to
have an opinion. That trade is a ruling.

## Watch for

- Whatever is chosen must not make a HUMAN re-run refuse. The operator hitting `--resume` after fixing the
  credentials is the recovery path, and a budget that has been exhausted by the timer must not block it.

## 2026-08-13 — the reader that would have supplied the numbers is coming back here

PR #1195 collected retry observations so this card's numbers could be measured rather than guessed. Its
fifth review recommended **splitting it**, and that was accepted:

- **The collector lands** — the `attemptedBy` threading and per-population counts in
  `we:scripts/operations/effect-executor.mjs`. Unrecoverable: an attempt not recorded when it happens is
  gone for good.
- **The reader (`we:scripts/operations/retry-health.mjs`) is re-filed against this card.** It is a pure
  function with no production caller, not currently runnable, and it exists only to answer *this* decision.

**Why it comes back rather than being finished there.** Every blocking finding from round 2 onward lived in
the reader, and all four were one class — a statistic or statement about one population applied to another
population's decision. The last one: an all-`unknown` corpus renders byte-identical to an empty one (1,000
settled entries and 5,000 real attempts printing "0 attempt observation(s)"), and the refusal explains it
with "Human retries do not answer this" — a claim about the human population in a case containing zero
human retries.

**What must be settled before the reader is written again.** This is a modelling question, not an
implementation one, and iterating on the implementation is what failed — the same conclusion [#3071]
reached:

- Name the population each threshold guards. `MIN_OBSERVATIONS` and `MIN_SUCCESSES` currently guard a
  denominator built from two populations at once.
- Decide what an all-`unknown` corpus is allowed to conclude. It is not "no data", and it is not the human
  answer either; rendering it as the former is what made the defect invisible.

**Newly unblocked:** [#3090] fixed `requiredNPerGroup`, which used to answer `1` above a 97% base rate —
exactly the range retry success rates sit in. `MIN_SUCCESSES = 20` can now be *derived* rather than chosen:
±5 points on a 95% coverage fraction wants roughly 153 observations, not 20. The estimator is ready before
the reader that needs it.

> **Correction (prep pass, 2026-08-16): the "~153 observations" figure above is withdrawn by [#3090] itself
> and must not be reused.** #3090's round-3 note states it plainly: *"the advice this card previously gave —
> pinning a 95% coverage fraction to ±5% needs about 153 observations — is withdrawn twice over: that number
> no longer exists (the boundary refuses it), and it was the wrong formula anyway. `MIN_SUCCESSES` is a
> one-sample precision question; `requiredNPerGroup` answers a two-arm power question. Deriving one from the
> other was a category error."* `requiredNPerGroup` sizes a **two-arm comparison** (control vs. treatment);
> `MIN_SUCCESSES`/`MIN_OBSERVATIONS` need a **one-sample precision** estimator instead — a different formula
> that does not exist in the tree yet. See the validation gate below.

## Fork 1 — where does the retry counter (and any future cap) live

*Fork exists because:* the count already lives somewhere real — `we:scripts/operations/effect-executor.mjs`
stamps `attempts` / `autoAttempts` / `humanAttempts` / `unknownAttempts` on the run record's effect entry on
every attempt (lines 324-334), landed by [#3091] as instrumentation with "nothing reads these to decide
anything." Ratifying `#3083`'s mechanism turns that instrumentation into policy: something has to compare
`autoAttempts` against a cap before letting the executor retry automatically. Two genuinely different places
can hold the number the cap is compared against, and they answer this item's own hedge — "the run record is
the obvious home, but it is transient session-local state and a retry budget arguably outlives it" — in
opposite ways. They cannot both be the source of truth the executor reads at the enforcement instant.

- **(a) The run record's existing per-entry counters — DEFAULT.** No new storage: the cap check reads
  `autoAttempts` off the same entry `we:scripts/operations/effect-executor.mjs` already writes it to, at the
  same enforcement chokepoint the 2026-08-13 ruling names. `createEffectExecutor` and `applyPendingEffects`
  (`we:scripts/operations/effect-executor.mjs` lines 219 and 467) take exactly **one** injected `store` handle
  today — the run store — so a cap check here is a same-store read, not a new dependency.
- **(b) A durable store keyed independent of run identity** (e.g. effect type + target), so a retry budget
  survives a *fresh* run being started for the same target rather than a `--resume` of the suspended one.
  **Rejected as this decision's default.** `we:scripts/operations/run.mjs` does mint a brand-new run id
  (`newRunId`) on any invocation that omits `--resume=<run-id>` (lines 25 and 153), so a second run CAN start
  for a target that already has one suspended — but that path is a *human or CI* invoking
  `we:scripts/operations/run.mjs` directly, never the waker (see the default's merit argument below). It also
  does not fit today's architecture without a larger change first: the executor would need a *second*
  injected store, which `applyPendingEffects`'s signature does not carry.

**Default: (a) the run record's existing counters — on MERIT, not only cost.** The automatic waker
(`we:scripts/operations/wake.mjs`) is the only caller `attemptedBy: 'auto'` reaches, and `wakePass` /
`wakeRun` only ever call `store.read`/`store.write` on run ids `store.list()` already returns —
**the waker never mints a run id; `newRunId` is reachable only from `we:scripts/operations/run.mjs`'s manual
`startRun` path.** So the population the automatic cap exists to bound (the timer re-entering the SAME
suspended work, which is the measured eleven-dispatches-over-ten-ticks failure this item opens with) is
*structurally* run-scoped already: there is no automatic path that could split one target's auto-retries
across two run records. A fresh run for the same target is only reachable through a human or CI re-invoking
`we:scripts/operations/run.mjs` without `--resume` — and the 2026-08-13 ruling already puts that class of
action outside the automatic cap's remit entirely ("Only `retry` is automatic... a person still may
[retry]"). So (b)'s guarantee (a budget that survives a fresh run) protects against a manual action the
mechanism ruling has already decided not to bound, which is a real merit reason to prefer (a), not just a
cost saving. (b) would additionally cost a second store dependency the executor does not have today. On
placement: the run record also sits on **clause 1** of
[#state-lives-where-its-nature-dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
("transient intent → session-local sidecar") — supporting context for keeping per-attempt bookkeeping there,
though that clause's own worked examples (a conveyor queue, lane ports) are operator-issued signals rather
than machine-generated attempt counts, so it is cited as *consistent with*, not as the sole authority for,
this default; the structural argument above carries the weight.

```js
// we:scripts/operations/effect-executor.mjs — Fork 1(a): the cap check reads the SAME entry the attempt
// counters already live on, at the same point `attempted` is computed today (lines 313-334).
const cap = live.retry?.maxAutoAttempts;                 // declared per effect, per the 2026-08-13 ruling
if (by === 'auto' && cap != null && (Number(live.autoAttempts) || 0) >= cap) {
  current = withEntry(current, live.key, {
    status: 'exhausted',                                  // or whatever EFFECT_STATUSES gains for this
    disposition: live.retry?.onExhaustion ?? 'ask-human',  // the closed, versioned set the ruling names
  });
  store.write(current);
  return { run: current, applied, skipped, inFlight: inFlightKeys, halted: current.effects.find((x) => x.key === live.key), error: null };
}

// Fork 1(b), for contrast — REJECTED: needs a SECOND store the executor is not given today.
// const budgetKey = `${live.type}:${live.payload?.targetId ?? live.key}`;
// const spent = await budgetStore.read(budgetKey);   // `budgetStore` does not exist as a dependency
// if (spent.autoAttempts >= cap) { /* … */ }
```

Skeptic: SURVIVES-WITH-AMENDMENT. A throwaway skeptic sub-agent attacked (a) on classification, merit,
statute-overlap and citation-scope. Classification: no dissolution — this is WE's own internal
state-placement call, not caller-facing config, and "support both" fails because (b) needs a second injected
store `applyPendingEffects` does not have, so running both isn't free. Merit — the double-run bypass is more
reachable than the first draft claimed: `we:scripts/operations/dispatch-lane-io.mjs`'s
`inFlightDispatchesFor` guard is scoped to `status !== 'in-flight'` only, and
`we:scripts/operations/dispatch-lane.mjs` states outright that once its own bookkeeping is absent, the only
protection against a double-dispatch is "durable state (a leased lane, a claimed item)" — i.e. whether an
exhausted item stays claimed, which this item does not verify either way. **Folded in above:** the default
now leads with why that gap does not actually threaten the *automatic* cap's correctness — the waker never
mints a run id, so the population the cap governs cannot split across two runs; the reachable double-run
path is a human/CI action the ruling already treats as unbounded manual retry. Statute-overlap: a second
anchor (`#operations-declared-once-callers-generated`) independently frames the run record as a session-local
sidecar, reinforcing rather than contradicting (a). Citation-scope: clause 1's own worked examples are
operator-issued ephemeral signals, not machine-generated attempt bookkeeping meant to bound cumulative
risk — the scope reach is looser than first claimed, so the citation is now stated as supporting context, not
sole authority (folded in above). Net: default unchanged, argued on the actual structural fact rather than on
absence of a measured incident.
Screen: flagged(prio) → fixed. A fresh-context screen found the first draft's rationale leaned on "(b) costs
more to build" and "the risk is unmeasured," which reads as prioritization in a merit fork's clothing — it
never argued (a) was semantically *better*, only cheaper and not yet needed. Fixed by rewriting the default
above around the structural fact that the automatic cap's own population (waker-driven re-entry) cannot
reach the scenario (b) guards against, which is a merit distinction that survives the "both free forever"
test: (b) would still be solving a problem the ruling puts outside the automatic mechanism's scope, not one
this fork's cost estimate manufactured. Re-screened after the rewrite: clear.

## Validation gate — the numeric budget (`maxAutoAttempts`, backoff) is blocked, not a fork

**Digest + verdict: not-yet.** No cap, backoff, or deadline number is proposed here, and none should be
ratified yet. The blockquote at the top of this item already says so ("The numbers stay unset, and now for a
measured reason rather than caution"); this gate exists to state the concrete un-block condition rather than
leave it as a standing caveat.

**Prior-art delta since this item last touched the numbers.** [#3090] fixed `requiredNPerGroup`'s clamp
defect but, per its own round-3 correction, also **withdrew** the one number this item had been leaning on —
the "~153 observations" figure was the wrong formula (a two-arm power question standing in for a one-sample
precision one) and no longer exists even in that wrong form. [#3091] landed *only* the collector — the six
fields on the run record's effect entries — and explicitly **re-filed the reader**
(`we:scripts/operations/retry-health.mjs`, the module that would compute
`MIN_OBSERVATIONS`/`MIN_SUCCESSES` from the corpus) against this item; that module was deleted in PR #1195's
split and does not exist in the tree today. So between this item's last edit and now, the corpus-collection
half shipped and the one number it had cited was retracted — net progress, but net *fewer* usable numbers
than before.

**Why this is not a fork.** A fork needs two named, currently-defensible branches (e.g., "cap = 3" vs.
"cap = 8") for a human to weigh. There are no such branches: every concrete number available today is either
withdrawn (`~153`, above) or a bare guess with no corpus behind it — `.operations/` is gitignored and
per-machine (per #3091's own "Watch for"), and `dispatch-lane` (#3037) is named in
`we:scripts/operations/effect-executor.mjs`'s own comment as "the first" thing that actually dispatches, so
the automatic-population corpus is only beginning to accumulate. Picking a number now would repeat the exact
mistake the blockquote already named and rejected — "a first draft defaulted to unlimited, blast radius
zero; that was risk-management dressed as a recommendation." This is a readiness question (do we have
grounds to pick), not a merit trade between named alternatives, so it takes the validation-gate shape rather
than a `## Fork N`.

**Related precedent, weighed and not applied.** `we:scripts/conveyor/tick-core.mjs` already ships
`DEFAULT_FIX_RETRY_CAP = 3` and `DEFAULT_CI_HEAL_RETRY_CAP = 3` — a per-PR bounded-automatic-attempts-then-
escalate-to-`/review` cap, structurally the same shape this item needs, with no corpus or estimator behind
either constant (SKILL §3c / §3c-ci). This is real prior art for "3 is a workable convention," and a human
ratifying this item may reasonably choose to adopt it as an interim `maxAutoAttempts` rather than wait. It is
recorded here, not adopted, for two reasons this prep pass is not positioned to override: the 2026-08-13
blockquote is an **already-made, dated, reasoned human ruling** that this item's numbers stay unset
specifically to avoid picking a plausible-looking constant without grounding — adopting `tick-core`'s number
now would be prep re-deciding a question a human already decided in-session, which is exactly what prep must
not do. It is also not a clean transfer on the merits: `tick-core`'s population is PR auto-fix/CI-heal
bounces (cost = wasted agent turns, escalation = a review), where this item's population is credential/quota/
binary dispatch failures (cost = a stalled build, escalation = an operator fixing infra) — a different
failure class the operator's own measured case (eleven dispatches over ten ticks at exit 0, a *permanently*
broken cause) argues would not have been caught by *any* small fixed cap without also fixing the underlying
outage, which a data-derived floor is meant to distinguish from genuinely flaky failures. **For ratification:**
adopting 3 as an interim, revisited once the trigger below clears, is a legitimate override a human may make;
this item's own analysis does not recommend it.

**Concrete un-gate trigger.** Both of the following, not either alone:
1. A reader function exists, written against a **one-sample precision** estimator (not `requiredNPerGroup`,
   per the correction above), that computes `MIN_OBSERVATIONS`/`MIN_SUCCESSES` **per population** —
   `autoAttempts` outcomes separately from `humanAttempts` — from the run-record corpus at
   `we:.operations/runs/`, per the invariant `attempts === autoAttempts + humanAttempts + unknownAttempts`
   already pinned by a test in `we:scripts/operations/effect-executor.mjs`.
2. The automatic population specifically (not the pooled total, and not the human population — see the
   `attemptedBy` split's whole rationale at `we:scripts/operations/effect-executor.mjs` lines 299-312) has
   accumulated at least as many observations as that reader's own derived floor requires. No number is
   stated here because deriving it without the reader is the mistake this gate exists to block.

Skeptic: SURVIVES-WITH-AMENDMENT. A throwaway skeptic sub-agent found a real, concrete interim number this
codebase already ships for a structurally similar pattern (`we:scripts/conveyor/tick-core.mjs`'s
`DEFAULT_FIX_RETRY_CAP` / `DEFAULT_CI_HEAL_RETRY_CAP = 3`, ungrounded in any corpus) and argued the "no
defensible number exists" claim was too strong. **Folded in above** as "Related precedent, weighed and not
applied," rather than adopted: the precedent shows a number is *sayable*, not that *this* item should say it —
that call belongs to the human ratifying this item, who already made one dated, reasoned ruling on this exact
question (numbers stay unset) that this prep pass is not positioned to reverse. The skeptic's other attempt —
re-routing to `STUCK_ESCALATION_HOURS = 6` from `we:scripts/operations/wake.mjs` as a retry deadline — does
not transfer: that constant is explicitly a **reporting** bound ("never a retry bound: nothing is
re-dispatched at any age" — `we:scripts/operations/wake.mjs` lines 207-212), a different question answered
for a different reason. Verdict stands not-yet, with the precedent now on record for whoever ratifies.
Screen: clear. A fresh-context screen confirmed this concerns pure internal readiness tooling (the run-record
corpus and an estimator) with no standard/consumer-facing surface, and is not a disguised fork — there are no
two defensible branches to weigh, only a readiness question with a concrete, checkable trigger.

## Preview — the fork

| Fork | Question | Default | Main alternative (excluded) |
|---|---|---|---|
| 1 | Where does the retry counter/budget live | **the run record's existing per-entry counters** | an independent store keyed off run identity (guards a manual-retry path the ruling already leaves unbounded; needs a second executor store dependency) |

Settled (not forks, ruled 2026-08-13 in the blockquote above): declared per effect, enforced in the executor;
default is no automatic retry unless an effect opts in; exhaustion returns a disposition from a closed,
versioned set (initially `retry` / `ask-human`), never a boolean; only `retry` is automatic. Blocked (not a
fork): the numeric budget — see the validation gate above.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (system/engine machinery — the effect executor is the one chokepoint every dispatch
caller passes through). This jury binds against the item's predicted scope and is re-checked against the
real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

### Close-out — the predicted touch-set for the buildable child

Ratifying Fork 1(a) plus the settled 2026-08-13 mechanism (numbers deferred until the validation gate above
clears) carves a buildable child scoped to: `we:scripts/operations/effect-executor.mjs` (the cap check +
`exhausted`/disposition write, beside the existing `attempted` block), `we:scripts/operations/engine.mjs`
(declaring `retry` alongside `idempotent` / `dispatch` at the same normalization site, lines 220 and 225),
and `we:scripts/operations/run-record.mjs` (the disposition vocabulary, if it needs a new field rather than
reusing `error`). The numeric fields (`maxAutoAttempts`, backoff) stay unset in that child's declaration
schema until the validation gate clears — the mechanism can ship and be exercised with `retry: undefined`
(today's behavior, unchanged) before any effect actually opts in with real numbers.
