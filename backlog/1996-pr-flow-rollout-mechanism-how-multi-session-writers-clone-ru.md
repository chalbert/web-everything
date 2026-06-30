---
kind: decision
status: preparing
blockedBy: ["1933"]
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
tags: []
---

# PR-flow rollout mechanism: how multi-session writers clone, run, gate, and land

Rung 2 of #1985 ratified the **direction** — the constellation's writers (agent *and* human sessions, not just
`/workflow` batches) collaborate **through the remote** in a PR-flow (clone → push → gate → review → merge),
with the `lane/*` push-ref transport (reliable via #1995) as the general primitive. This decision prepares the
**rollout mechanism**, whose sub-forks each need research + a bold default before any ratification turn. Needs
`/prepare`.

**Ratification intent (definition of ready):** this is meant to be the **last decision** — ratifying it must
**unblock the build with no further decisions spawned**. So `/prepare` must drive **every** sub-fork below to a
concrete, buildable default (not "research, then decide later"); if a sub-fork can't be closed without a
downstream call, that call must be **pulled into this item** and resolved here, or this item isn't ready. The
known risk is sub-fork (2): per-lane port coordination is gated on #1933's cross-repo lane provisioning —
prep must confirm that provisioning is **plain engineering** (just the false-drop fix, no latent fork) and, if
it hides a decision, absorb it here. Same test for the landing gate (4): pick a default (e.g. auto-merge on
gate-green), don't leave it open.

## Sub-forks to prepare

1. **Clone scope (the hinge).** Does *every* session work in a clone, or only sessions doing substantive
   multi-item work, with trivial interactive edits still allowed direct-to-`main`?
2. **Per-lane port coordination across the constellation (the hard mechanism — currently unspecified).**
   "WE+FUI origins up and wired per lane" (the folded #1985 Rung 3 requirement) is *not* a one-`--port` problem,
   because the constellation's ports are **hardcoded in three coupled places** a naïve clone breaks
   (`we:vite.config.mts:113-157`): WE vite is `:3000` and its **proxy allowlist targets are all hardcoded to
   `localhost:8080`** (11ty); **FUI is resolved by filesystem path-alias to the sibling `../frontierui` tree**,
   not a separate origin, so per-lane isolation means cloning the **constellation as a sibling set** (WE clone
   *and* its FUI clone); and the vite proxy is a **hand-maintained allowlist** (#210), not something that
   templates itself. So the mechanism must, **per lane**: allocate a coordinated **triple** — WE vite port,
   11ty port, FUI sibling/origin — then **rewrite** the proxy targets and any cross-origin FUI import base to
   the lane's ports, then bring the pair up. **Gated on #1933's cross-repo lane provisioning** being solid (it
   has had false-drops — `we:.claude/agent-memory/workflow-crossrepo-lanes-falsedrop.md`). The bold default to
   research: a per-lane port-allocation + config-templating scheme (generate the lane's `vite.config`
   proxy/aliases from the allocated triple) rather than hand-wiring.
3. **Per-clone dev server / HMR** for interactive work — once (2)'s ports are allocated, each cloning session
   runs its own WE+11ty(+FUI) dev server on its triple; HMR roots at that clone.
4. **Landing gate** — auto-merge on gate-green vs a human review gate, and what "review" means for an all-agent
   push.
5. **Branch-protection shape** — observe-only `main` (GitHub require-PR / GitLab no-direct-push, F8/F10) and how
   it composes with the #1153 branch guard + the removed never-push default.
6. **Visual verification (the folded #1985 Rung 3 acceptance test).** Un-gate trigger: a lane boots WE+FUI
   cross-origin (via (2)'s port coordination) and a **headless Playwright run reproduces the #1895
   transparent-`.fui-card` regression AND its fix**, both from the CLI with no human screen. The multi-origin
   harness files under #1933 / the explorer-judge epics (#1167/#1552). Catches the gross-regression class only;
   the human eye still wins on design-quality nuance.
