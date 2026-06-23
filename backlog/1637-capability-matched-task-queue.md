---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1635", "166", "564"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, ownership, task-queue, ai-generated, validation, decision]
---

# Capability-matched task queue

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the idea earns a roadmap slot, not which of two designs wins.** The idea: open work is routed into each person's queue by **ownership + expertise + their current context** — not a flat backlog people self-assign from, and not a round-robin. It extends [#1635](/backlog/1635-ownership-aware-routing-in-context/) ownership routing from single-item hand-off into a standing, prioritised work feed: "the best-matched person, given what they own, what they're good at, and what they're already looking at."

**Recommended verdict: not-yet — accept the candidate as real, gate the build hard.** **Confidence: Medium.** The capability-match delta is genuine, but this sits two layers up the substrate (it needs #1635's owner resolution *and* an expertise/context model) and risks over-building ahead of demand — gate it on #1635 shipping plus proven routing value.

## What you're deciding

Does Web Everything commit to a **capability-matched task queue**, and on what trigger? Concretely it would route open work by three signals:

- **Ownership** — who owns the semantic node the work touches (resolved via [#1635](/backlog/1635-ownership-aware-routing-in-context/)).
- **Expertise / capability** — modeled skill or role from the persona roster, so the queue can prefer the *best-matched* owner among several.
- **Current context** — what the person is already working in, so related work clusters instead of fragmenting their attention.

…surfaced as a per-person queue in the dev browser, not a shared board people pull from.

## Why this isn't a classic fork (and is still a decision)

No contested either/or — no rival design where one branch is flawed (the *fork-existence* test). It's a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop — still a `decision` card per the user directive, resolving to a **go / no / not-yet verdict**. The genuine tension is the **trigger and over-build risk**: a full match-engine is a lot of machinery to stand up before the simpler #1635 routing has even proven its worth.

## Context & prior art delta

The category is saturated — the delta is *semantic capability+context match vs assignment plumbing*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Jira / Linear assignment** | A queue of work assigned to people | Assignment is **manual or rule-by-field** (component field, label); no model of who's *best-matched* by capability + current context |
| **GitHub Projects boards** | Columns of work, optionally auto-added | Status/board automation; no skill or context matching, no semantic-ownership key |
| **Round-robin / load-balancer bots** (e.g. review-assignment bots) | Auto-distributes work to a pool | Balances by *fairness/count*, deliberately ignoring fit; the opposite of capability-matching |
| **PagerDuty escalation** | Routes to an on-call person by schedule | Schedule-keyed, not capability-or-context-keyed; infra-incident-shaped, not dev-task-shaped |

The moat (per #142): a WE app knows **who owns each semantic piece and (via the persona model) what they're capable of**, so the queue matches on *meaning* — capability against the actual nodes the work touches — which assignment tools can't, because their "match" is a field value or a round-robin counter.

## Dependencies & lineage

- **Extends [#1635](/backlog/1635-ownership-aware-routing-in-context/)** (ownership-aware routing) — that card resolves the owner of a node; this card turns single hand-offs into a standing, prioritised, capability-ranked queue. #1635 is the prerequisite layer.
- **Needs an expertise/context model.** Beyond ownership, the match needs modeled capability — sourced from the persona roster ([#166](/backlog/166-governance-persona-roster-charter-schema/)) / personas-first-class ([#564](/backlog/564-personas-as-a-first-class-agile-concept/)) — plus a notion of "current context." Both existing is the trigger.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** Real and on-moat, but it's the most-derived feature in the ownership thread — gate it hard so it doesn't get built ahead of the simpler routing it stands on.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** [#1635](/backlog/1635-ownership-aware-routing-in-context/) has shipped and routing is in real use, **AND (2)** the persona model carries capability/expertise (not just ownership), **AND (3)** a real workload shows owner-only routing under-serving (e.g. several valid owners, no way to pick the best-matched). All three, because the cost of the match-engine only pays off past simple routing.
- **Skeptic:** "Linear/Jira already auto-assign and Projects auto-route — a queue is solved." *Refuted on the delta, not on novelty:* their "match" is a field rule or round-robin, which by design ignores *fit*; WE matches on semantic capability against the actual owned nodes — a thing they can't do without the self-describing ownership+persona model. The residual the skeptic is right about is **over-build risk** — this is the deepest feature in the thread — hence not-yet with a hard three-part gate, not go.

*If you'd rather decide go now or no (drop it), say so — the verdict is the thing on the table.*
