---
bornAs: xxlgpf7
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-08-31"
dateResolved: "2026-09-01"
codifiedIn: "docs/agent/platform-decisions.md#operations-declared-once-callers-generated"
preparedDate: "2026-09-01"
relatedTo: ["3421", "3422", "3405", "3031", "3188", "3398"]
tags: [governance, conveyor, operations, design]
---

# Design an "operation manager": a real execution chokepoint every command routes through

## Ruling (2026-09-01) — both forks' recommended defaults accepted, as presented

**RATIFIED by the operator (Nicolas Gilbert) on 2026-09-01** — Fork 1 = **(a) the operation catalog stays
bounded to delivery-loop operations**, growing organically only through the already-ratified
missing-operation mechanism (#3405/#3421/#3422), and Fork 2 = **(b) a separate, purpose-built lightweight
call-visibility signal** (access-log-shaped: operation name, timestamp, caller kind, outcome) for every
operation call regardless of step kind, structurally distinct from the run-record store — both accepted as
presented, no alternative picked in either fork's place, no dissent raised. Both forks were already prepared
with a `Skeptic: SURVIVES`/`SURVIVES-WITH-AMENDMENT` verdict and a `Screen: clear` pass, so this ratification
is a straight acceptance of the prepared defaults, not a re-opening of either fork's reasoning.

- **Fork 1 = (a).** Rejected (b) — "every command in the repo, including one-off inspection/tooling commands,
  becomes a declaration candidate" — for the reason the prepared card gives: #3188's own session measurement
  found a long tail of raw `git`/`npm`/`vitest`/`sed`/`python3`/`curl` calls against a handful of real
  operations, and declaring all of it up front is exactly the speculative up-front design this card's own text
  already rejects for the catalog generally. The catalog keeps growing one real gap at a time, through the
  missing-operation halt-and-surface mechanism already ratified for the dispatched-agent population, not by
  enumeration.
- **Fork 2 = (b).** Rejected (a) — persisting a full run record for every `compute`-only call — on the
  schema-mismatch ground the prepared card gives as load-bearing (not merely the volume/"landfill" framing):
  the run-record store's `run+step` keying exists to model a *resumable* effect, and a `compute`-only call
  never suspends and has no step to key a resume off, so forcing it into that schema is a categorical mismatch
  independent of storage cost. A separate, cheap, prunable access-log-shaped signal — emitted for every call
  regardless of step kind — closes the real, measured gap (`gate-health`, `suggest-next`, `verify`,
  `pr-status` are all `compute`-only today and produce zero trace of being called) without touching the
  run-store's own no-landfill property.
- **The skeptic's debuggability amendment is carried forward, not dropped.** The lightweight signal's
  `outcome` field must carry a compact digest of the result, not bare success/failure — folded into the
  follow-on build item's own contract below, per #3427's own Done-when #2.

**Follow-on build scaffolded at ratification** (Fork 2 requires one; Fork 1 needs none — it is a scope ruling
on an already-shipped mechanism, not new work):

- [Build the lightweight call-visibility signal for every operation call](/backlog/xadrqhr-build-the-lightweight-call-visibility-signal-for-every-opera/)
  (parent: this item) — names the storage shape (a `we:scripts/operations/call-log.mjs` /
  `we:scripts/operations/call-log-store.mjs` pure-core/io-shell pair, mirroring
  `we:scripts/operations/run-record.mjs`/`we:scripts/operations/run-store.mjs`, writing to a new
  `we:.operations/calls/` sidecar structurally distinct from `we:.operations/runs/`), names both caller
  surfaces that must emit it (`we:scripts/operations/cli-adapter.mjs` and
  `we:scripts/operations/http-adapter.mjs`, including the HTTP adapter's currently-silent `compute`-only
  `runReadOnly` branch), specifies that `outcome` carries a compact digest rather than bare success/failure,
  and names — without foreclosing it — a per-declaration opt-in to full run-record persistence for specific
  high-value `compute` operations as a third option for that item to weigh.

Captures a 2026-08-31 operator discussion about a real execution chokepoint every command — not only
dispatched-agent commands — routes through. **Prepared 2026-09-01**: a prior-art survey (published as
`/research/operation-manager-chokepoint-scope-and-telemetry/`, session report `relatedReport` below) found
that most of what this discussion asked for is **already ratified or already reasoned in shipped code** —
epic #3029's operations engine, `#operations-declared-once-callers-generated` (#3031), the
dispatched-agent doctrine (#3405), and the missing-operation catalog-growth ruling (#3421/#3422) between them
already close three of the discussion's four framing bullets. What survives, after subtracting that ground,
are two narrow forks — both below — each with a recommended default and a `Skeptic:`/`Screen:` verdict.

## Already settled — cited, not re-decided

- **"Semantically-named operations, not raw commands" — ratified, shipped.**
  `we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated` (#3031, clause 1) already
  forbids a hand-written route/argv parser for anything that could be a declared operation. The mechanism is
  built: `we:scripts/operations/registry.mjs`'s `op(name, {...})` declares one input schema + ordered steps,
  and `we:scripts/operations/cli-adapter.mjs` / `we:scripts/operations/http-adapter.mjs` derive every caller
  from that one declaration — no caller ever sees how an operation executes underneath.
- **"Tiered by cost" — already the closed step-kind vocabulary, no new mechanism needed.** #3031 clause 2
  closes the engine's vocabulary at `compute | judge | confirm | effect` (`we:scripts/operations/engine.mjs`),
  and clause 4 names the two backend tiers (solo subscription-funded vs. hosted key-billed, one seam). Read
  against a real declaration's own route-table reasoning
  (`we:scripts/operations/http-adapter.mjs:16-24`), the operator's three discussed tiers map close to 1:1:
  free-and-inline → `compute` (pure fn, completes inside one `advance` sweep); CPU-scheduled → `judge`
  (suspends for a spawned model, its cost recorded on resume); mutating-and-runner-only → `effect` (executor-
  applied, keyed by run+step, idempotent replay). #3031's own text — *"an operation that appears to need a
  fifth kind is a signal to change the model, not to extend the vocabulary"* — argues directly against adding
  a parallel "cost tier" field: it would duplicate a vocabulary already closed for a stated reason.
- **"The catalog grows from real usage, not speculative up-front design" — ratified, with a build already
  underway.** `#dispatched-agent-never-runs-commands-directly` (#3405, ratified 2026-08-30) Fork 2(a) is
  exactly this mechanism for the dispatched-agent population: halt and surface a `missing-operation` finding
  rather than work around a gap. `#3422`'s ruling (resolved 2026-08-31, the *same session* this card's own
  text cites) generalizes it and `#3421` (open, scaffolded) builds the concrete classifier: a confidence
  assessment (security/data-leak/performance/blast-radius/correctness) that self-clears clean cases, batches
  flagged ones for a human, and force-escalates anything on a standing blacklist — all routed through the
  existing learnings-pool/`/harvest` pipeline, never a parallel one. Nothing in this bullet is left to design.

**Distinct from two adjacent, already-filed items — deliberately not re-decided here** (mirroring #3405's own
convention). **#3188** (open) asks whether an agent *session* should be restricted to declared-operations-only
— a prompt-injection blast-radius question for the interactive/session population, not the population this
card's chokepoint concerns. **#3398** (filed story) owns out-of-band alerting for the conveyor
supervisor/runner *process*'s liveness specifically — a narrower target than this card's per-operation-call
visibility question (Fork 2 below). Ratifying either of those is not this card's job.

## Fork 1 — the catalog's candidacy scope: "delivery-loop operations" (bounded, organic) or literally "every command" (unbounded)?

**Fork-existence justification:** a forced invariant — exactly one branch is buildable without enumerating
work nobody has asked for; the other is flawed on its own measurement.

- **(a) Bounded to delivery-loop operations**, growing organically only through the already-ratified
  missing-operation mechanism (#3405/#3421/#3422). The load-bearing evidence is `#3188`'s own session
  measurement (below), not a scope test read out of #3031's text — #3031's "a delivery-loop operation… is
  declared once" names the operations it declared as *illustrative examples* (review a PR, claim an item,
  dispatch a lane), not itself a candidacy-scope ruling, so it is cited here only as consistent context, not
  as the fork's authority. A raw inspection command (`git status`, `ls`, an ad hoc `grep`) is never a
  declaration candidate on its own — it becomes one only when a dispatched agent actually halts on it as a
  gap. **Bold default.**
- **(b) Unbounded — every command in the repo, including one-off inspection/tooling commands, becomes a
  declaration candidate.** *Rejected.* `#3188`'s own measurement (its Fork 1 discussion) is the concrete
  evidence against this: of one full live session's actions, six operations existed against a long tail of
  raw `git`/`npm`/`vitest`/`sed`/`python3`/`curl` calls plus direct repo-script invocations — "the distance
  between operations exist and operations are the only surface is very large, and any plan that ignores that
  will stall on its first uncovered task." Declaring every such one-off command up front is exactly the
  "speculative up-front design" this card's own text already rejects for the catalog generally; there is no
  reason the rejection stops at delivery-loop work and resumes for inspection commands.

**Known occurrence.** Kubernetes' API server is a single execution chokepoint every client (`kubectl`,
controllers, other services) must route through, yet its resource *catalog* is not enumerated up front —
built-ins ship with the server and the type catalog grows incrementally via Custom Resource Definitions as
real usage demands them. The "one chokepoint, organically-grown catalog" shape is a mainstream, load-bearing
pattern elsewhere, not a novel risk unique to this repo.

Skeptic: SURVIVES — attacked on "doesn't eventual bash-denial under #3188 force enumerating inspection
commands anyway, making 'organic growth' illusory," and separately on "isn't #3031's 'declared once' text the
real authority for this scope." Both fail to flip the default: #3188 Fork 2 is itself still open, and even if
it ratifies deny-by-default, the missing-operation halt-and-surface mechanism (already ratified for the
dispatched population by #3405) still drives growth one gap at a time, not by up-front enumeration; and #3031's
phrase is illustrative, not a scope test, so the citation above now leans on #3188's own measurement instead —
no amendment to the *default* needed. Screen: clear (fresh-context) — this is a real capability-boundary call visible to any caller of the
operations system, not an internal implementation detail; and under the free/instant-build test the objection
to (b) survives as tractability, not effort — an open-ended, constantly-regenerating space of one-off
commands is not enumerable at any amount of free labor, so this is not "more work right now" wearing a fork's
clothes.

## Fork 2 — telemetry for cheap/read-only calls: persist a full run record, or a separate lightweight signal?

**Fork-existence justification:** a forced invariant — one branch relitigates an already-reasoned design
choice with no new grounds; the other closes the real, measured gap without doing so.

- **(a) Persist a run record for every operation call, including `compute`-only ones.** *Rejected.*
  `we:scripts/operations/http-adapter.mjs`'s own header already reasons through and rejects exactly this,
  citing volume ("a record per page-load is landfill" — the run store is a session-local sidecar nothing
  prunes). That volume framing survives on its own, but the sharper, cost-independent reason is a **schema
  mismatch, not a scale one**: the run-record store's whole shape (`run+step` keying, idempotent replay) exists
  to model a *resumable* multi-step effect that can suspend and later be resumed from a different caller — a
  `compute`-only call never suspends and has no step to key a resume off, so forcing it into that schema is a
  categorical mismatch that would hold even at zero storage cost. Reopening it here would relitigate an
  already-reasoned choice with nothing new to justify the reversal.
- **(b) A separate, purpose-built lightweight call-visibility signal** (an access-log-shaped, cheap, prunable
  record — e.g. a rotated append-only line per call: operation name, timestamp, caller kind, outcome),
  structurally distinct from the run-record store, emitted for every operation call regardless of step kind.
  This closes the real, measured gap — at least four shipped operations (`gate-health`, `suggest-next`,
  `verify`, `pr-status`) are all-`compute` today and produce **zero** trace of being called, the exact blind spot #3398's alerting-gap
  motivation names — without touching the run-store's own "no landfill" property. **Bold default.**

**Known occurrence.** Standard web-server architecture keeps an ephemeral, cheap, rotated *access log* (every
request, minimal cost, prunable) structurally separate from the durable *application data store* (a database
row per meaningful transaction). (b) is that same split, applied here: a call-visibility signal is an
access-log concern, a persisted run record is an application-data concern, and (a) conflates the two.

Skeptic: SURVIVES-WITH-AMENDMENT — two attacks. (1) "Isn't this exactly what #3398 already covers, making this
bullet redundant" — refuted: #3398 targets the supervisor/runner *process*'s own liveness (is the daemon
itself alive) via crash-loop/idle detection on its own JSONL, a narrower and different signal than *which
operations were called, by what surface, how often* across the whole catalog; the amendment folded in is the
explicit non-overlap note in "Already settled" above. (2) "A name/timestamp/caller/outcome signal loses the
computed payload the moment it scrolls past — doesn't that cost real debuggability that (a) wouldn't lose" —
SURVIVES-WITH-AMENDMENT: this is a genuine, narrow cost (b) has and (a) doesn't, not large enough to flip the
default (the landfill argument holds for both adapters — `we:scripts/operations/cli-adapter.mjs`'s
compute-only path records nothing either, confirmed directly, so it isn't overstated) but real enough to fold
into the follow-on build item rather than silently drop: the lightweight signal's "outcome" field should carry
a compact digest of the result, not bare success/failure, and the build item should also name a third option
the (a)/(b) framing doesn't surface — a per-declaration opt-in to full run-record persistence for specific
high-value `compute` operations — rather than treating (a)/(b) as exhaustive. Both amendments are folded into
Done-when #2 below.
Screen: clear (fresh-context), with one authoring note folded in above — the fork asks which storage shape a
real, cross-boundary-observable property (call visibility) should take, not an implementation detail invisible
to a consumer. Under the free/instant-build test the schema-mismatch reason (just above) survives at zero
cost, where the volume/"landfill" framing alone would have dissolved into prioritization-in-disguise once cost
is stripped — the screen's flag was that the write-up leaned on the cost-flavored reason rather than the
schema-fit one; fixed by foregrounding the schema mismatch as the load-bearing argument (a) above, not by
changing the ruling.

## What this decision does NOT settle

The lightweight telemetry mechanism's exact wire shape (log format, rotation policy, where it's queried from)
is implementation, not this decision — Fork 2 rules on *whether a separate mechanism exists and stays
separate from the run store*, matching how #3405 left its own enforcement mechanism open ("a new
`we:scripts/guard-bash.mjs` rule … is the assumed default … but a `PreToolUse` hook or a harness-level
permission mode remain live alternatives"). Building it is normal backlog work once this ruling stands, not a
child scaffolded at prepare time.

## Done when

1. A ruling is recorded on Fork 1 and Fork 2 (ratify or override the bold defaults above).
2. If Fork 2 ratifies (b), a follow-on build item exists for the lightweight call-visibility signal (scoped to
   `we:scripts/operations/`), naming the storage shape, which caller surfaces (CLI, HTTP) must emit it, that
   the "outcome" field carries a compact digest of the result rather than bare success/failure (the skeptic's
   debuggability amendment), and considers a per-declaration opt-in to full run-record persistence for
   specific high-value `compute` operations as a named third option, not foreclosed by (a)/(b) alone.
3. This card `resolve`s once both forks are ruled — no further design survey is owed; the "already settled"
   section above is cited ground, not open work this card's resolution depends on.

**Session report**: `we:reports/2026-09-01-operation-manager-chokepoint-scope-and-telemetry.md`
**Research**: `/research/operation-manager-chokepoint-scope-and-telemetry/`
