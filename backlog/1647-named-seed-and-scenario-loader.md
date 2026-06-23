---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1646", "1643"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, seed-loader, scenarios, ai-generated, validation, decision]
---

# Named seed and scenario loader

## Digest

This validates an AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/): a dev-browser control that loads named app states with one click — "logged-in admin with 3 orders", "empty cart", "expired trial" — into the *running* app, for dev, demo and test. The difference from seed scripts and fixtures: the loader writes into the app's **declared introspectable state** (the webstates model) live in the browser, not via an offline DB seed or a per-test fixture. The decision is a one-sided go / no / not-yet validation gate, not a merit fork.

**Recommended verdict: not-yet — accept the candidate, gate on the scenario-capture substrate. Confidence: Medium.** The one-click-live-state delta is real and on-moat, but it depends on the declared state model and the scenario-capture artifact (#1646) to author/serialize a named state against; until then there's nothing to load.

## What you're deciding

Whether Web Everything commits to a **named seed / scenario loader** as a dev-browser feature, and on what trigger. Concretely it would:

- **Hold a library of named states** — each a serialized snapshot of the app's declared state (providers/contexts/store values), keyed by a human name.
- **Load any named state into the running app with one click** — write the snapshot back into the live declared state so the app re-renders in that exact scenario, no reload, no DB reset.
- **Author from the live app** — capture the current declared state as a new named scenario, so seeding is round-trippable rather than hand-written.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "build shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card resolving to a **go / no / not-yet verdict**. The genuine sub-question is the **trigger** (and the boundary with #1646), handled below.

## Context & prior-art delta

The category is mature; the delta is *one-click live state over the running app's declared model* vs. offline seeding:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **DB seed scripts (Rails seeds, Prisma seed, SQL fixtures)** | Populate known starting data | Offline, server-side, requires a reset/reload; not a live in-browser flip of the running app's declared state |
| **Storybook stories** | Named, selectable states of UI | Per-component, author-curated props in isolation; not the *whole running app's* declared state |
| **Mirage JS / MSW fixtures** | Predefined API responses for a scenario | Stubs the network layer, not the app's declared state; not one-click live, not capturable from the running app |
| **factory_bot / fishery / test factories** | Named, composable data builders | Build-time test data; no live in-app loader, no round-trip capture from the running app |

The moat (per #142): a WE app's state is **declared and introspectable** (webstates), so a named state is a portable snapshot written *back into the live app* and *captured from it* — incumbents seed an offline store or stub the network and then reload; none load a named state into the running app's declared model in one click.

## Dependencies & lineage

- **Rides the declared state model + capture artifact.** The snapshot it loads/captures is the webstates declared state ([#1089](/backlog/1089-webstates-completion-change-tracking-storage-protocols-recon/) and the webstates contract family), and the capture/serialize mechanism is the #142 trace/replay artifact. It can't load a named state before there's a declared state to (de)serialize — the natural trigger.
- **Boundary with [#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/)** (scenario/fixture library that doubles as E2E fixtures): #1646 is the *library + fixture-export* side; this is the *one-click live loader* side. They share the captured-scenario format — decide #1646's shape so this loads its scenarios rather than inventing a parallel format. Possible they merge.
- **Pairs with [#1643](/backlog/1643-variant-simulator-for-locale-flag-role-viewport-motion/)** — a saved variant combination is a degenerate named scenario; share the persistence shape.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The candidate is real and on-moat (clean delta vs. offline seeding), so don't drop it — but it depends on the declared state model + capture artifact, and its boundary with #1646 should be settled so it doesn't fork the scenario format.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the webstates declared-state model is introspectable/serializable in the dev browser, AND **(2)** #1646's captured-scenario format is decided (so this loads that format) OR #1646 is folded into this. Then the loader is a thin live-write over an existing snapshot.
- **Skeptic:** "Storybook + seed scripts already give named states — this is reinventing fixtures." *Refuted on the delta, not on novelty:* those produce *offline/isolated* states (a DB reset, a component story) and require a reload; this writes a named snapshot into the *running app's declared state* in one click and captures new ones from the live app — a round-trip impossible without the introspectable state model. The residual the skeptic is right about is the **#1646 overlap** — the fixture-library half genuinely overlaps — hence not-yet pending that boundary, not no.

*If you'd rather decide go now or no (drop the candidate), say so — the verdict is the thing on the table.*
