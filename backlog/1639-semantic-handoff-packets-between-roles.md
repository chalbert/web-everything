---
kind: decision
parent: "142"
status: open
priority: low
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1631", "1635", "1638"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, handoff, packet, collaboration, ai-generated, validation, decision]
---

# Semantic handoff packets between roles

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the idea earns a roadmap slot, not which of two designs wins.** The idea: a designer→dev, dev→reviewer, or any role→role hand-off travels as a **packet carrying full semantic context** — the relevant declared state, rules, intents, ownership, and discussion — not a screenshot, a spec doc, or a Loom. The recipient opens the packet and lands in the exact semantic context, with everything they need to act already attached.

This card **generalizes [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/)**: the shareable repro bundle is the *debugging-specialized* packet type. This is the general envelope — repro is one packet kind, a design hand-off is another, a review request is another — all the same "semantic context, addressed to a role" shape.

**Recommended verdict: not-yet — accept the candidate as real, gate the build on a concrete trigger.** **Confidence: Medium.** The generalization is clean and the prior-art delta holds, but the general packet shouldn't be designed before its first concrete instance (#1631) proves the shape, and it rides the same capture substrate.

## What you're deciding

Does Web Everything commit to a **general semantic handoff packet** between roles, and on what trigger? Concretely the packet bundles, addressed to a recipient role/person:

- **Declared state + action trace** — the introspectable snapshot and how it was reached (the #1631 mechanism).
- **Declared rules & intents** — what's in force at the captured moment, so the recipient sees the constraints.
- **Ownership** — who owns each piece ([#1635](/backlog/1635-ownership-aware-routing-in-context/)), so the packet self-routes to / from the right roles.
- **Discussion** — any in-context threads on the bundled nodes ([#1638](/backlog/1638-in-context-annotation-and-discussion-threads-on-semantic-nod/)).
- **Packet type** — debugging (= #1631 repro), design-handoff, review-request, … one envelope, several typed payloads.

## Why this isn't a classic fork (and is still a decision)

No contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It's a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop — still a `decision` card per the user directive, resolving to a **go / no / not-yet verdict**. The genuine tension is **abstraction timing**: generalizing before the concrete #1631 packet exists risks designing the envelope without a real payload.

## Context & prior art delta

The hand-off category is mature — the delta is *semantic state+rules+owner packet vs recording/spec*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Zeplin / Figma Dev Mode handoff** | Designer→dev hand-off with specs/assets | Static **design specs** (measurements, tokens, exports); no live declared state, rules, or ownership; one direction only |
| **Loom** | A narrated walkthrough sent to a teammate | A **video recording** — zero machine-actionable context; recipient rebuilds the state by hand |
| **Jam.dev** | A bug link with logs + repro steps | A **debugging** packet only (and heuristic, not declared) — not a general role→role envelope; no design/review packet types, no semantic state/rules/owner |
| **PR description / issue templates** | A structured hand-off of a change/task | Free-text/text-form; no attached live semantic context, no replay-into-context, no ownership routing |

The moat (per #142): a WE app is **self-describing and ownership-aware**, so a hand-off carries *meaning addressed to a role* — semantic, portable, verifiable, self-routing — across debugging, design, and review alike. Incumbents each cover one direction with a recording or a spec; none can emit a typed semantic packet, because none have the declared model.

## Dependencies & lineage

- **Generalizes [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/).** The shareable repro bundle is the debugging-specialized packet type; this is the general envelope of which #1631 is the first instance. Decide #1631's shape (its state+trace+rules+owner bundle) *before* abstracting the envelope, so the generalization is grounded in a real payload.
- **Rides the same capture substrate.** Like #1631, it needs the #142 trace/replay capture artifact to bundle state+trace; that capture existing is a shared prerequisite — build capture once.
- **Composes [#1635](/backlog/1635-ownership-aware-routing-in-context/)** (owner of each bundled node → self-routing) and **[#1638](/backlog/1638-in-context-annotation-and-discussion-threads-on-semantic-nod/)** (threads on bundled nodes travel as discussion).
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The generalization is real and on-moat, so don't drop it — but don't open a build yet: design the general envelope only after the concrete #1631 packet has proven the shape, and it shares #1631's capture-substrate dependency.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/) (the debugging packet) has shipped and validated the bundle shape, **AND (2)** a real exercise-app run surfaces a *second* hand-off type (design or review) that wants the same envelope — i.e. the generalization is pulled by a second concrete instance, not pushed speculatively.
- **Skeptic:** "Figma Dev Mode + Loom + Jam already cover designer→dev and bug hand-offs — this is reinventing them." *Refuted on the delta, not on novelty:* each incumbent is one direction carrying a *recording or a spec*; none carries declared state + rules + ownership as a *typed, self-routing* packet across all three role transitions, because none has the self-describing model. The residual the skeptic is right about is **premature abstraction** — hence not-yet, gated on #1631 proving the shape first, not go.

*If you'd rather decide go now or no (drop it), say so — the verdict is the thing on the table.*
