# Prior-art survey — checking real merged-PR history before dispatching a backlog item (#3457)

Session: `prepare-decision-3457` (2026-09-02). Prepares decision `#3457` (born as `xzkqdnz`) for ratification.

## The question

`#3457` asks two forks: (1) WHERE in the dispatch path should a "is this item already done"
cross-check against real `gh pr` history run, and (2) how does that check stay cheap and
non-blocking (never a per-tick, per-item, unconditional `gh pr list` call). Neither fork is
greenfield UI/protocol design — both are an internal-automation reliability question: how does a
scheduler avoid re-doing work whose completion its own bookkeeping failed to record? That question
has decades of prior art in infrastructure automation, so the survey below draws from three
well-established systems rather than the browser-standard corpus `we:design-first.md` step 1
usually points at.

## Finding 1 — the two dispatch paths do NOT converge on one file today (corrected after a skeptic pass)

An earlier draft of this survey claimed the manual `we:scripts/operations/dispatch-lane.mjs
--num=<N>` CLI call and the automatic per-tick sweep were "two callers of the same spawn
convention," based on this prepare session's own append-system-prompt boilerplate naming
`we:scripts/operations/dispatch-lane.mjs` as its starter. A skeptic sub-agent, prompted only to refute, re-traced the
actual automatic-sweep spawn instructions and refuted that claim:

- `we:skills-src/conveyor/SKILL.md` §3 (spawnBuilds) and §3b/§3e (spawnPrepareScope/
  spawnPrepareDecision) both instruct the live conveyor session to **"Spawn it as one background
  `Agent`"** directly — filling a brief template and calling the harness Agent tool itself. Neither
  step mentions `we:scripts/operations/dispatch-lane.mjs`.
- `we:skills-src/conveyor/SKILL.md` line 77's own inline comment names the gap: routing the
  spawnBuilds/spawnPrepareScope halves through the declared operation "is its own item" —
  `we:backlog/3096-*.md`. Read directly: `status: open`, `blockedBy: ["3353"]`; `#3353` is also
  `status: open`. `gh pr list --search "3096"`/`"3353"` (2026-09-02) show PRs that prepared, split,
  and hardened pieces of both cards, but none that actually rewires `we:skills-src/conveyor/SKILL.md`'s dispatch bridge to
  call the operation.
- `we:docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation` (ratified
  2026-08-26) states the TARGET architecture — "the conveyor's headless dispatch starts agents by
  CALLING the declared `dispatch-lane` operation" — but is explicit that the routing for some
  dispatch kinds is still tracked as open work on `#3096`. The statute is the destination, not (yet)
  the current code.

**Corrected conclusion: today, `we:scripts/operations/dispatch-lane.mjs`'s guard (option (c) in the
card) is the ONLY check point on the manual path, and `we:scripts/readiness/dispatch-plan.mjs`'s
enrichment (option (b)) is the ONLY check point upstream of the automatic sweep's direct spawn.**
Neither substitutes for the other while the two paths remain architecturally separate. This is a
support-both requirement, not a "mandatory floor plus optional efficiency layer" as the refuted
draft had it, and not a three-way pick either. Once `#3096` lands, a single guard at (c) would cover
both paths and (b) could be retired — a decision left to `#3096`'s own follow-on, not this card.

## Finding 2 — Kubernetes controllers ground the general "check immediately before acting" shape

Kubernetes controllers are watch/event-driven at the trigger layer but **level-triggered** at the
reconciliation layer: instead of trusting that a specific event was seen and handled, `Reconcile()`
re-reads live observed state and re-derives what to do *every time it runs*, including on a
periodic full resync independent of any event stream. The documented reason is resilience to missed
events, partial failures, and external changes — "if you miss an event, the next reconciliation
catches it anyway" (see sources). This supports the general two-tier cadence Fork 2 recommends
(an immediate check at the point of actuation, plus a periodic backstop) — though in this card's
current architecture, the two tiers also happen to gate two different code paths rather than being
purely a cost/latency trade on one path (see Finding 1).

## Finding 3 — Terraform's refresh-before-apply is the same cadence shape for a different domain

Every `terraform plan`/`terraform apply` runs an implicit in-memory refresh of real
infrastructure state first, specifically so the diff and the eventual apply are computed against
ground truth rather than the last-recorded state file — "all plan and apply commands run refresh
first, prior to any other work." An explicit, cheaper `-refresh-only` mode exists for drift
*detection* without full replanning cost. Directly supports keeping the one-time gate at (c)
authoritative and immediate, with the periodic (b) as a cheaper, earlier-warning layer.

## Finding 4 — CI-run dedup tooling puts its authoritative check inside the job, not only at trigger time

`skip-duplicate-actions` (a widely used GitHub Action for exactly this problem — avoiding a
workflow re-running work a prior run already completed) runs as a step *inside* the triggered job,
walking commit history with a backtracking search for a prior successful run over the same content,
rather than relying solely on trigger-time filtering. Same "the authoritative check runs at the
point of actual work" shape as Finding 2/3, applied to exactly the kind of query `#3457` proposes (a
bounded git/PR-history search run once, right before doing possibly-redundant work).

## What this changes in the card

Finding 1 is a real correction, not a nuance: it flips Ruling 1 from "(c) is the forced floor, (a)/
(b) are optional" to "(b) and (c) are both currently required, covering two independent dispatch
paths." Findings 2-4 remain valid supporting precedent for Fork 2's cadence recommendation
(one-time at (c), age-gated at (b)), and for treating a future consolidation (post-`#3096`) as the
same two-tier shape those systems already converge on.

## Sources

- [Level Triggering and Reconciliation in Kubernetes](https://medium.com/hackernoon/level-triggering-and-reconciliation-in-kubernetes-1f17fe30333d)
- [What is a Controller · The Kubebuilder Book](https://book-v1.book.kubebuilder.io/basics/what_is_a_controller.html)
- [10 Things You Should Know Before Writing a Kubernetes Controller](https://medium.com/@gallettilance/10-things-you-should-know-before-writing-a-kubernetes-controller-83de8f86d659)
- [Use refresh-only mode to sync Terraform state | HashiCorp Developer](https://developer.hashicorp.com/terraform/tutorials/state/refresh)
- [Manage resource drift | Terraform | HashiCorp Developer](https://developer.hashicorp.com/terraform/tutorials/state/resource-drift)
- [skip-duplicate-actions (GitHub)](https://github.com/fkirc/skip-duplicate-actions)
