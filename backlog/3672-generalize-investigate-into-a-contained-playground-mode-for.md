---
bornAs: x7p1mw7
kind: decision
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-14"
relatedTo: ["3621"]
tags: [dispatch, sandbox, containment, investigate, plateau-ui]
---

# Generalize `investigate` into a contained "playground" mode for open-ended AI experiments

Open-ended investigative/experimental AI work has a different risk shape than item-tied delivery work (build/fix/ci-heal), but today both are dispatched the same way — the investigative case has no default containment and falls back to ad hoc host-permission approval mid-run. Idea: evolve the existing `investigate` launchKind (we:scripts/operations/dispatch-lane-io.mjs) into a "playground" mode that (a) is not tied to a specific backlog item, (b) defaults to its own throwaway sandbox/container automatically instead of per-run host-permission prompts, and (c) is eventually exposed as a real feature in the Plateau product UI, not only usable from inside a Claude Code session.

## Motivating incident (2026-09-14)

An investigation agent working [#3621](/backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl/)'s container-isolation research needed to test whether a process could escape an Apple container and write to the real host filesystem — a legitimate, deliberate security test (host-escape testing inherently needs host access to prove it). That test correctly required real host-filesystem write permission prompts mid-investigation. But it surfaced a broader gap: nothing about the dispatch machinery distinguishes "open-ended investigation/experiment" from "item-tied delivery" by default risk posture, so the investigative case falls back to ad hoc, per-run host-permission approval rather than defaulting to safe containment.

## The idea, concretely

`investigate` is already one of the real `launchKind` values in `we:scripts/operations/dispatch-lane-io.mjs`, alongside `build`/`prepare`/`prepare-decision`/`fix`/`ci-heal`. Rather than invent a parallel system, evolve `investigate` into (or add beside it) a "playground" launch mode that:

1. Is **not tied to a specific backlog item** — a first-class way to run open-ended AI experiments that aren't scoped to delivering or researching one card.
2. **Defaults to its own throwaway sandbox/container automatically** — no ad hoc host-permission approval loop mid-run; the containment is the default, not an escape hatch requested case by case.
3. Is **eventually exposed as a real feature in Plateau's own product UI** — not only reachable from inside a Claude Code session.

## Why this needs a real `/prepare` pass, not a snap decision

This is filed to record the idea precisely, not to decide anything — **no preparedDate is set**. A real prepare pass with forks is needed before any ruling, at minimum on:

- **How much to build now vs. defer** — whether this is buildable incrementally against today's `investigate` kind, or genuinely waits on more of the containment substrate (see [#3621](/backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl/), the precedent for containerized execution).
- **What "safe by default" containment should look like** — the isolation mechanism, its bypass/escape properties, and how it composes with the existing lane-clone model.
- **Whether/how Plateau UI exposure should be scoped** — a v1 that stays Claude-Code-only vs. what a product-surfaced version would need (auth, quotas, UX for a throwaway sandbox).

Parent context: epic [#3383](/backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive/).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
