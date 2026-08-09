---
bornAs: xu5gfu4
kind: decision
status: resolved
scaffoldedBy: "operation-engine"
dateScaffolded: "2026-08-08"
dateOpened: "2026-08-08"
dateResolved: "2026-08-08"
preparedDate: "2026-08-08"
relatedReport: reports/2026-08-08-operation-engine-one-declaration-every-caller.md
codifiedIn: "docs/agent/platform-decisions.md#operations-declared-once-callers-generated"
tags: [plateau-loop, delivery, operations, architecture, decision]
---

# Delivery operations are declared once; every caller is a generated adapter

**Ratified 2026-08-08 (operator, in session).** A delivery-loop operation — review a PR, claim an item, ratify a
decision, dispatch a lane — is **declared once** as input + typed steps + guards, and the CLI, HTTP and tool
callers are **generated from that declaration** rather than hand-wired per surface. Steps come from a closed
vocabulary of four kinds. This **applies** [`#deterministic-core-thin-judgment`](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
(#2607) to a new seam and competes with nothing.

Recorded for the trace, not for re-argument: no branch was excluded on merit that is still live, so this is a
ruling with a written warrant rather than an open fork. Preparation reopens it only if it turns up something
genuinely new, and that goes back on the table on its own merits.

## What was ruled

1. **One declaration per operation.** Input schema, ordered steps, and guards live in one place. The adapters —
   command-line for the agent, HTTP for the console, typed-tool for agents that prefer schemas — plus the input
   validation and the tests are **derived**, never hand-kept per caller.
2. **Four step kinds, closed.** `compute` (pure + declared reads), `judge` (needs a model, needs no tools),
   `confirm` (needs a person; the run suspends and is resumable from any surface), `effect` (declares what should
   happen; the executor applies it, keyed by run + step, so replay is safe). If an operation appears to need a
   fifth kind, the model is wrong — that is a signal to change the model, not to extend the vocabulary.
3. **Judge is split by tools, not by surface.** A step that needs a model but no working tree runs as one turn
   with no tools granted, identically wherever it was started. A step that needs a working tree is an agent
   session, unchanged from [`#agent-runner-cli-backend`](../docs/agent/platform-decisions.md#agent-runner-cli-backend)
   (#2444). **The in-session reviewer is retired** — it inherits the host session's instructions, memory and
   working directory, so the same operation behaves differently depending on who started it.
4. **Tier one is subscription-funded; nothing is metered.** The solo tier spawns the command-line backend on the
   operator's own machine. The hosted tier, later, is billed per token behind the same seam. These are two
   permanent products sold to different people, not one migrating into the other.

## Why not the alternative — agents calling HTTP services

The excluded branch is inverting the dependency: agent → HTTP → logic, with the dev server as the shared
implementation. Rejected on merit:

- **Lane clones break it.** Edit work runs in N lane clones, each its own checkout on its own port. An
  HTTP-first agent must answer "which server acts on which clone" on every call; a script just runs where it is.
- **It contradicts the session-free direction.** #2701 rules the per-lane driver is a headless runner with no
  model and no session, and #2703 retires the main-session loop. Requiring a live server on that path adds a hard
  dependency and a new outage mode to the code that is supposed to become *more* autonomous.
- **It would overturn a statute**, not extend one — #2607 clause 3 already names the script as the shared source
  and the UI as a shell over it.

## What ratifying settles

- **Now:** new delivery-loop operations are authored as declarations; a hand-written route or argv parser for an
  operation that could be declared is a defect, not a style choice.
- **Structurally:** the human stop stops being prose a model must remember (`we:skills-src/review/SKILL.md`'s
  *"This is a stop point"*) and becomes a suspend the engine performs. Effect replay subsumes the documented
  *"a non-zero exit means re-run the same command"* and the #2964 write-ordering rule.
- **Unchanged:** pure invariants stay in `we:scripts/lib/` where no shell can route around them; reads stay the
  truth and events stay a wake signal.

## Build

Epic [#3029] carries it, under program [#2606](/backlog/2606-delivery-throughput-latency-program/). Conversion
runs smallest-and-strangest first so the four-kind vocabulary is falsified early if it is wrong; the one genuine
unknown — an effect that *starts* a long-running agent rather than completing — is gated behind a two-point spike.

## Lineage

Session 2026-08-08 with Nicolas; full record in the [backing report](../reports/2026-08-08-operation-engine-one-declaration-every-caller.md).
Applies #2607; composes with #2444, [#2626](/backlog/2626-operational-state-store-session-local-sidecars-now-a-shared-/)
(the run record is a local sidecar behind a store module until the product trigger fires),
[#2701](/backlog/2701-conveyor-orchestration-boundary-how-much-is-pure-mechanics-v/) and
[#2703](/backlog/2703-retire-the-main-session-serial-conveyor-loop-main-session-dr/).
