---
bornAs: xgb0p8o
kind: decision
parent: "2508"
status: resolved
relatedReport: reports/2026-07-16-launch-control-semantics.md
dateOpened: "2026-07-15"
dateResolved: "2026-07-16"
graduatedTo: 2527
codifiedIn: one-off
preparedDate: "2026-07-16"
tags: [plateau-loop, console, backlog-ui, launch]
---

# Backlog-view Launch control — ship a claim+handoff wrapper, build headless, or park it

What should the console's **Launch** control (the [#2522](/backlog/2522-backlog-view-launch-work-on-an-item-from-the-ui/) slice) be? #2522's acceptance says it "starts work through the sanctioned lane / build entry point" and the row reflects "launching → in-flight" — but there is **no headless build entry point in the repo** (the lane scripts acquire lanes and land PRs; none *builds* an item). "Launch" implies work *starts*, yet the only proven browser-write path is a frontmatter splice. And crucially, the honest-now half of "launch" **already ships**: [#2520](/backlog/2520-backlog-view-claim-and-release-an-item-from-the-ui/) (resolved) put a **Claim** control on the same lane-gated write seam. So this is not a fresh "claim vs build vs enqueue" fork — it is a **sequencing/redundancy** call: given Claim already ships and the agent-runner (#2444) is deferred, is there anything honest *and* net-new for #2522 to ship now, or should it be parked alongside #2444? Prior-art grounding in `we:reports/2026-07-16-launch-control-semantics.md`.

## Grounding — the machinery this composes with

- **A Claim control already ships** ([#2520](/backlog/2520-backlog-view-claim-and-release-an-item-from-the-ui/), resolved): clicking Claim locks an open item (status open→active) via the lane-gated write path. So "Launch runs the claim verb" is **not net-new** — it is #2520. Any Launch value beyond #2520 lives entirely in what happens *after* the claim (provision a build lane, spawn a builder, or enqueue).
- **The lane-gated write seam is proven** ([#2514](/backlog/2514-backlog-view-write-seam-foundation-resolve-from-the-ui/)→[#2521](/backlog/2521-backlog-view-change-an-item-s-priority-from-the-ui/)): `POST /api/backlog/write {id, verb}` opens a lane clone, runs the in-lane `we:scripts/backlog.mjs <verb>`, gates it, pushes `lane/<num>-<verb>-ui`, opens a ready-to-merge PR, releases the lane. Its discipline is **acquire-and-release inside one job** — a Launch that *leaves a lane provisioned* for later pickup breaks that invariant.
- **A headless builder is downstream of a *deferred* (not impossible) decision.** Spawning a `claude` agent to build an item is exactly the agent-runner contract in [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/) (`spawn/steer/stop/resume`), researched at [/research/claude-cli-agent-runner-headless-contract/](/research/claude-cli-agent-runner-headless-contract/). #2444 is `priority: low`, **"pickable, out of auto-select"** — an *operator sequencing choice* ("no consumer yet … prepare once the daemon's evidence says the loop should grow"), **not an external law**. #2522-that-builds would itself *be* that consumer. So (b) below is a **chosen** deferral we can revisit by un-parking #2444 — not something we "cannot build."

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · What is #2522?** | **(d)** park #2522 alongside #2444 — Claim already ships; the honest "Launch" needs the builder | **(a)** a thin claim-only + surfaced-build-command affordance now (renamed away from "Launch") | **Med** — genuinely balanced; turns on whether a marginal convenience earns a console slice |

## Fork 1 — What should #2522 (Launch) be?

**Fork-existence:** real either/or on *sequencing* — exactly one disposition ships for #2522, and the branches genuinely cannot coexist: either #2522 **ships something now** (a thin wrapper) or it **parks** until the real builder exists. The excluded-now branches are concrete: (b) is downstream of the deferred #2444 (no runner contract today), and (c)'s resident builder loop does not exist (`lane-drain` only *lands* PRs). The live tension the original three-way "claim/build/enqueue" framing hid: because Claim already ships (#2520), (a)'s honest core is thin — so "ship the thin wrapper" vs "park it" is the actual decision.

- **(d — recommended) Park #2522 alongside #2444.** Claim already ships (#2520); the only honest reading of "Launch = work starts" needs a builder, which needs #2444. Rather than ship a mislabeled convenience now, defer #2522 until #2444 is picked up — at which point #2522 is #2444's concrete consumer and (b) becomes the real build. Cost: the operable-console epic ([#2508](/backlog/2508-backlog-view-operable-actions-claim-prioritize-launch-resolv/)) carries one deferred child; benefit: nothing dishonest or footgun-prone ships, and #2522's acceptance ("in-flight") is met for real when it lands.
- **(a) A thin claim-only + surfaced-build-command affordance, renamed.** Since Claim ships, the *only* honest net-new is: on click, run the existing claim, then **surface the exact `cd <lane> && /backlog <num>` command** (do **not** provision-and-dangle a lane — that breaks the seam's acquire-and-release invariant). Rename it away from "Launch" (e.g. "Claim & start" / "Take & build") — a control that spawns nothing must not read as "it's running." Buildable now, spawns nothing, clear of #2444. Weakness: it is a marginal convenience over #2520, and it forces #2522's acceptance to drop "in-flight."
- **(b) Headless build run — un-park #2444 first.** Launch spawns a supervised `claude -p` child that actually builds the item (modelled on `plateau:tools/explorer/cli.ts` + `POST /api/explorer/runs`), row shows a true **in-flight ⟳ → PR #NNN**. The only branch that literally satisfies #2522. Requires ratifying #2444 (its `spawn/steer/stop` contract) and accepting real autonomous per-click spend — "the most dangerous control in the console." A deliberate future slice, not a now option.
- **(c) Enqueue for a resident builder.** No such builder loop exists; needs new always-on infra, out of a console slice's scope.

**Default: (d) park it.** The skeptic pass (below) refuted the original "(a) claim+handoff is the confident default" framing: #2520 already ships Claim, so (a)'s net-new is a thin affordance whose one distinctive piece (provision-and-hand-off a lane) is the very lane-leak footgun to avoid. Honest options collapse to "ship a marginal, must-be-renamed convenience" vs "park until the real builder (b) exists." Parking is the cleaner default — it ships nothing dishonest, keeps #2444's deferral intact, and lets #2522 be the consumer that *justifies* un-parking #2444 when the time comes. Override to **(a)** if the decider judges the one-click "claim + build-command" convenience worth a slice now (renamed, claim-only). (b)/(c) are not now-options.

**Code shape (why (a) is thin and (b) needs #2444).** (a) adds no server verb the seam lacks — it reuses #2520's claim and returns a command string; (b) is a *new* endpoint that spawns a child process:

```js
// (a) — reuses #2520's shipped claim; the only net-new is returning a build command. Spawns nothing.
POST /api/backlog/write   { id: "2530-...", verb: "claim" }     // <- already exists (#2520)
//   client then shows:  "Claimed. Build it:  cd <lanePath> && claude '/backlog 2530'"   // static string

// (b) — a NEW endpoint that spawns a supervised claude child — needs #2444's runner contract.
POST /api/backlog/build   { id: "2530-..." }
//   server: eligibility -> lane-pool acquire -> spawn `claude -p "/backlog <num>"` (detached, supervised)
//           -> record run { id, itemId, pid, status:"running" }  -> 202 { runId }   // real autonomous spend
```

**Skeptic:** SURVIVES-WITH-AMENDMENT; the *original* three-way framing with "(a)" as the confident default was **REFUTED** and reworked. A fresh-context skeptic (four axes) landed three amendments, all folded in: (0) **classification** — #2520 already ships Claim, so the real call is sequencing/redundancy and the omitted option "**park #2522**" is live and now the default; (1) **merit** — "Launch" mislabels a spawn-nothing control and provisioning-then-dangling a lane breaks the seam's acquire-and-release invariant, so (a) is reduced to *claim-only + surfaced command, renamed*; (3) **citation-scope** — #2444's `priority: low` deferral was over-cited as "cannot build"; reworded as a *chosen* deferral #2522 could justify un-parking. (2) **statute-overlap**: none — this sets no `codifiedIn` (impl lives in plateau-app); a latent tension with "claim ignores git state" (ownership is `status:active`, not the working tree) is noted as a warning against ever *codifying* (a), not a present conflict.
**Screen:** clear (fresh-context two-confusion screen, #2091). Q1 — a legitimate product-behavior call a console user directly observes (row shows "claimed · lane ready" vs a true "in-flight → PR"), on the product side, not an impl detail across the WE↔product boundary. Q2 — a merit difference survives at zero cost: a spawn-nothing affordance vs an autonomous builder behave differently and a user cares which fires — not prioritization.

## Ruling (ratified 2026-07-16) — BUILD (override of the park default)

The human decider **greenlit the program** — overriding the prepared `(d) park` default. The reframe was honest that park-vs-build is a *priority* call, not merit; on merit the capability wanted (manage AI builds from the UI) is **(b) the real headless build**. The decider chose to build it now.

- **Ruling: (b) headless build**, as a program — not the thin (a) wrapper, not park. The priority call is made: build the autonomous builder.
- **Graduates to the [Plateau Loop — autonomous AI build queue](/backlog/2527-plateau-loop-autonomous-ai-build-queue/) program epic**, built on the ratified prioritization design (#2526). The "in-flight" acceptance is now real, delivered by that program's build endpoint.
- **Un-parks [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/)** — greenlighting the program supplies the consumer #2444's deferral was waiting for; #2444 is to be prepared + ratified as slice 3 of the program.
- #2522 becomes the program's build-now / add-to-queue control (re-parented under the program).

Codified `one-off` (a Plateau-coordinator sequencing decision, cite-able as #2525).

## Residual to fold into the build (not part of the ruling)

- **Eligibility.** "Refuse a blocked / claimed item with the reason" — the build uses the queue's hard **readiness gate** (#2526): only ready items are pullable. `blockedBy`-based ineligibility becomes the gate, not an ad-hoc check.
