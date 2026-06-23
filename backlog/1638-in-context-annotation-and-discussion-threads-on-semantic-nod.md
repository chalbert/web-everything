---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1635", "1639"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, annotation, collaboration, ai-generated, validation, decision]
---

# In-context annotation and discussion threads on semantic nodes

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the idea earns a roadmap slot, not which of two designs wins.** The idea: you comment on a **semantic node** — a component, a piece of declared state, a rule, an intent — and the thread persists *to the model*, not to a pixel coordinate or a document anchor. Reopen the app tomorrow, after a redesign, on a different viewport, and the thread is still attached to the same meaning. It's "Figma comments, but anchored to the running app's semantics."

**Recommended verdict: not-yet — accept the candidate as real, gate the build on a concrete trigger.** **Confidence: Medium.** The semantic-anchor delta is clean and durable, but it needs a stable node-identity scheme to anchor to and a place to persist threads, and demand ahead of the introspection substrate is unproven.

## What you're deciding

Does Web Everything commit to **in-context discussion threads on semantic nodes**, and on what trigger? Concretely:

- **Anchor to a semantic node, not a pixel** — a thread attaches to a stable identity of the component / state / rule / intent (from the self-describing model), so it survives layout changes, re-renders, and viewport differences that break coordinate-anchored comments.
- **Persist to the model** — threads live with the app's semantic graph (local-first), so they're portable and reviewable alongside ownership and rules, not in a separate SaaS coordinate space.
- **Routes via ownership** — a thread on a node can notify its owner ([#1635](/backlog/1635-ownership-aware-routing-in-context/)).

## Why this isn't a classic fork (and is still a decision)

No contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It's a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop — still a `decision` card per the user directive, resolving to a **go / no / not-yet verdict**. The genuine tension is the **trigger**: stable per-node identity (so a thread re-anchors correctly) has to exist before this is buildable.

## Context & prior art delta

The category is well-served — the delta is *semantic-node anchor vs pixel/coordinate or document anchor*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Figma comments** | Pin a discussion onto a design surface | Anchored to **x/y coordinates on a frame**; the pin drifts or orphans when the design changes — no semantic identity |
| **Vercel / Netlify preview comments** | Comment directly on a deployed preview | Anchored to a DOM element / coordinate on a specific deploy; doesn't survive a re-render or a redesign, no rule/state/intent anchor |
| **Google Docs / Notion comments** | Threaded discussion anchored to content | Anchored to a **text range / block** in a document; no notion of a running app's component, state, or declared rule |
| **GitHub PR review comments** | Threaded discussion on a change | Anchored to a **diff line** in source; tied to the change, not to the live semantic node it produces |

The moat (per #142): a WE app is **self-describing**, so a thread anchors to the *meaning* of a node — and stays attached across redesigns and viewports — which none of the incumbents can do, because they anchor to pixels, DOM coordinates, document ranges, or diff lines.

## Dependencies & lineage

- **Needs stable per-node identity.** A thread is only durable if the node it's pinned to has a stable identity in the self-describing model; that identity scheme (the same one the rest of #142 relies on) is the prerequisite and the natural trigger.
- **Routes via [#1635](/backlog/1635-ownership-aware-routing-in-context/)** (ownership-aware routing) — a thread on a node can notify/route to that node's owner.
- **Feeds [#1639](/backlog/1639-semantic-handoff-packets-between-roles/)** (semantic handoff packets) — threads on the nodes in a handoff travel with the packet as discussion context.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule (threads persist locally / to the model, no per-call backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** Real and on-moat (the durable-anchor delta is the whole point), so don't drop it — but don't open a build yet: it needs the stable node-identity scheme to anchor to, and demand ahead of the introspection substrate is unproven.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the self-describing model exposes a stable per-node identity threads can pin to, **AND (2)** a real multi-role exercise-app run produces feedback that a pixel/coordinate tool would have orphaned across a redesign (evidence the semantic anchor earns its keep).
- **Skeptic:** "Figma + Vercel preview comments already let you comment on the running thing — solved." *Refuted on the delta, not on novelty:* both anchor to **coordinates/DOM on one snapshot**, so the comment orphans the moment the layout or render changes; WE anchors to the semantic node's identity, so it persists across redesigns and viewports — a thing they structurally can't do without the declared model. The residual the skeptic is right about is **timing/identity readiness** — hence not-yet, not go.

*If you'd rather decide go now or no (drop it), say so — the verdict is the thing on the table.*
