# PR-flow rollout mechanism — prep research for #1996

**Decision:** [#1996](../backlog/1996-pr-flow-rollout-mechanism-how-multi-session-writers-clone-ru.md) ·
implements [#1985](../backlog/1985-where-work-happens-isolate-automated-writers-in-lanes-non-de.md) Rung 2
(adopt PR-flow) · builds on [#1933](../backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md)
(clone model, resolved) + #1995 (reliable lane push) · 2026-06-30 · research topic:
[`pr-flow-rollout-mechanism`](../src/_data/researchTopics/pr-flow-rollout-mechanism.json) (extends
[`automated-writer-isolation-model`](../src/_data/researchTopics/automated-writer-isolation-model.json)).

## Why this report exists

#1985 ratified the *direction* (PR-flow / multi-session) but deferred the *mechanism* to a dedicated prepared
decision so a rollout wasn't ratified cold. This is that prep. The ratification intent is strict: **the last
decision** — every sub-fork must reach a concrete, buildable default with no further decisions spawned.

## In-repo grounding (verified)

- **The clone/lane/push machinery is already built and proven (#1933, resolved).** All four slices shipped:
  guard carve-out (#1934), persistent `--reference`-shared lane pool under `~/workspace/.lanes/<repo>/`
  (`we:scripts/lane-pool.mjs`, #1940), orchestrator lane-dispatch + `lane/*` push + central
  fetch/merge/rebase-retry/cleanup (#1942), cross-repo coupled-clone dispatch with impl-first/WE-last
  integration (#1943). #1995 wrapped the lane push in a bounded jittered retry, so the transport is reliable.
  **So per-lane provisioning is not a latent decision — it is built.** The residual gaps are engineering bugs
  (unscoped impl gate; a red merge left on `main` instead of rolled back —
  `we:.claude/agent-memory/workflow-crossrepo-lanes-falsedrop.md:25-35`), not ratifiable calls.
- **What is *not* built: per-clone dev servers.** The lanes only clone → gate (`check:standards`) → push; none
  boots a dev server. The dev surface is hardcoded in three coupled places — WE vite `:3000`
  (`we:vite.config.mts:113`), the 11ty proxy targets all hardcoded to `http://localhost:8080`
  (`we:vite.config.mts:119-153`, a hand-maintained allowlist per #210), and 11ty `--port=8080` in
  `we:package.json` `"dev"`.
- **Key finding — FUI is not a port problem.** FUI resolves by a **relative** filesystem path-alias to
  `../frontierui` (`we:vite.config.mts:15,206`), so a coupled WE+FUI **sibling clone** (already how #1943
  provisions cross-repo lanes) wires FUI for free. **The entire unsolved coupling reduces to one pair of ports
  (vite + 11ty) and one hardcoded cross-reference (the proxy target).** That is the whole of "the hard
  mechanism" the cold item flagged as the known risk.
- **Branch / push posture:** #1153 guard denies branch-create/switch/worktree-add in the shared checkout
  (forces clones over worktrees); the never-push default was removed 2026-06-29 (direct `git push origin main`
  allowed); broad-stage `git add -A` still denied. Rules 104/105 stand.

## Prior art (dev-infra survey)

- **Vite** — the idiomatic shape reads `server.port` and `proxy.target` from env (`loadEnv(mode, cwd, '')` or
  `process.env`), with `strictPort:true` (fail loud on collision, never silently increment) and
  `changeOrigin:true` (rewrite the upstream `Host`). Only the proxy `target` needs parameterizing; the upstream
  port stays internal behind the proxy. Sources: vite.dev/config/server-options, vite.dev/config.
- **Deterministic offset vs dynamic scan** — index/offset gives stable, addressable URLs with no registry;
  free-port scan (`get-port`/`portfinder`) is more collision-robust but needs a registry/lockfile and loses
  run-to-run addressability. Sources: npm `portfinder`, dev.to dynamic-port-handling.
- **Monorepo / worktree convention** — a hash-or-index → **reserved port-block** per worktree, injected via a
  generated `.env.local`, with a **linear probe** on collision. Superset uses per-workspace `*_PORT_BASE`
  blocks; `portree` (github.com/fairy-pitta/portree) hashes `branch:service` → a stable port with linear
  probing. The linear-probe folds the scan's robustness into the deterministic scheme.
- **Docker-compose lesson** — isolating names (`COMPOSE_PROJECT_NAME`) does **not** isolate host ports; drive
  host ports from a generated per-instance env, by script not by memory. Source: d4b.dev parallel-agents.

## Synthesis — the prepared forks

| Element | Archetype | Default |
|---|---|---|
| Fork 1 — clone scope | merit fork | **isolate-by-default for automation**; `main` convergence-only for agents, **human keeps direct-`main`** |
| Fork 2 — per-lane port assignment | code-shape fork | pure deterministic offset + `strictPort` (no probe); **per-repo bands — WE `3000`/`8080`, plateau `4000`, FUI `6000`** (5000/7000 macOS-reserved) |
| Fork 3 — landing gate | merit fork | **fully automatic auto-merge on gate-green — no manual merge/review**; render gap closed by automation (mechanism = Fork 5), not a human |
| Fork 4 — branch-protection shape | merit fork | **asymmetric — `main` writable by the human, observe-only for AI/agents**; convention now, bot-principal rule later |
| Fork 5 — how visual changes land safely (no-human gate) | merit fork | **render-check in the gate — visual harness is a v1 deliverable** (visual lanes auto-merge only when a headless #1895 render check passes); fallback (b) = agents off visual, human owns visual surfaces |

*(Forks 1–4 decided in review with the operator on 2026-06-30; defaults above reflect those calls.)*

Three consequences are **support-both**, not forks: per-clone dev server/HMR, the proxy-target env
parameterization, and FUI sibling-clone wiring — each falls out of Forks 1+2 with no coherent excluded branch.

## Skeptic pass (run in prep, pass-4)

A refute-only sub-agent attacked every default across four axes (classification · merit · statute-overlap ·
citation-scope). Outcomes folded into the item's per-fork `Skeptic:` lines:

- **Fork 1 — REFUTED-AND-FLIPPED (in review).** The skeptic showed "trivia is safe" rested on append-only
  history (false for overlapping edits) and the file-overlap line is inoperable for an ad-hoc stranger; the
  operator then flipped it to **isolate-by-default for automation** (agents clone; `main` convergence-only for
  agents), with the **human keeping direct-`main`** as the single trusted writer.
- **Fork 2 — SURVIVES-WITH-AMENDMENT, then ratified.** First draft's "linear-probe fallback" *was* dynamic
  discovery and dissolved the (a)/(b) fork; removed the probe → pure deterministic + `strictPort`. Operator
  ratified and added **per-repo thousands-bands** (FUI → `6000s` since `5000`/`7000` are macOS-reserved —
  verified taken on this host; FUI's current `3001`/`3002`/`8082` overlap WE's band and relocate as part of the
  build).
- **Fork 3 — REFUTED, then RE-FLIPPED (in review).** The skeptic's first flip held visual lanes behind a HUMAN
  gate for visual lanes; the operator rejected any manual step ("no manual merge or test"), so it re-flipped to
  **fully automatic auto-merge** with the render gap closed by automation — the *mechanism* split out to Fork 5,
  no human in the loop.
- **Fork 4 — SURVIVES-WITH-AMENDMENT.** Operator sharpened "writable main" to **asymmetric — human-writable,
  AI-observe-only** (agents PR-flow only), strictly safer than symmetric-writable; no statute collision.
- **Fork 5 (was Gate 5) — RECLASSIFIED in review.** The validation-gate framing ("build the harness, when?")
  was wrong: with Fork 3 taking no human gate, "how does a visual change land safely" is a forced design fork —
  **(a) render-check in the gate (harness is v1)** vs **(b) agents off visual / human owns visual surfaces**,
  with the do-nothing branch (auto-land unverified) broken. Recommended default (a) — the consistent completion
  of fully-automatic; operator's call between (a) and (b) pending.
