---
kind: decision
status: resolved
blockedBy: []
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#pr-flow-rollout-mechanism"
preparedDate: "2026-06-30"
relatedItems: ["1985", "1933", "1995", "1153", "1895", "210"]
relatedReport: reports/2026-06-30-pr-flow-rollout-mechanism.md
tags: [pr-flow, parallel-batch, isolation, dev-server, ports, branch-protection]
---

# PR-flow rollout mechanism: how multi-session writers clone, run, gate, and land

Rung 2 of #1985 ratified the **direction** — the constellation's writers (agent *and* human sessions, not just
`/workflow` batches) collaborate **through the remote** in a PR-flow (clone → push → gate → review → merge),
with the `lane/*` push-ref transport (reliable via #1995) as the general primitive. This decision prepares the
**rollout mechanism**. Grounded in the resolved #1933 clone model + the multi-origin dev-server reality of
`we:vite.config.mts`, and an SE-practice / dev-infra prior-art survey published as the
[`pr-flow-rollout-mechanism`](/research/pr-flow-rollout-mechanism/) topic (report via `relatedReport`, extending
the [`automated-writer-isolation-model`](/research/automated-writer-isolation-model/) theme).

**Ratification intent (definition of ready):** this is meant to be the **last decision** — ratifying it must
**unblock the build with no further decisions spawned**. Every sub-fork below carries a concrete, buildable
default resolved here in prep, not pushed downstream. The two flagged risks are discharged in the
grounding digest: (a) #1933's cross-repo lane provisioning is **plain engineering, no latent fork** (shipped;
the residual integrator gaps are tracked bugs, not decisions); (b) the landing gate (Fork 3) picks a concrete
default (auto-merge on gate-green), it is not left open.

## Grounding digest

- **#1933 is resolved — the clone/lane/push machinery already exists and is proven.** All four slices shipped:
  guard carve-out (#1934), persistent `--reference`-shared lane pool under `~/workspace/.lanes/<repo>/`
  (`we:scripts/lane-pool.mjs`, #1940), orchestrator lane-dispatch + `lane/*` push + central
  fetch/merge/rebase-retry/cleanup (#1942), and **cross-repo coupled-clone** dispatch with impl-first/WE-last
  integration (#1943) — `we:backlog/1933-…:Progress`. So **per-lane provisioning is not a latent decision** —
  it is built. Its residual gaps are *engineering bugs*, not forks: the integrator runs an **unscoped** impl
  gate (a pre-existing red in `plateau-app` red-blocks unrelated landings) and **left a red merge on main**
  instead of rolling back (`we:.claude/agent-memory/workflow-crossrepo-lanes-falsedrop.md:25-35`). Cross-repo
  also needs impl origins synced first (same memory `:10-23`). These are fixes, not ratifiable calls.
- **What is *not* built — and is what this decision actually sizes: per-clone DEV SERVERS.** The #1933 lanes
  only **clone → gate (`check:standards`) → push**; no lane ever boots a dev server. The constellation's dev
  surface is hardcoded in three coupled places: WE vite is `:3000` (`we:vite.config.mts:113`); the **11ty proxy
  targets are all hardcoded to `http://localhost:8080`** (`we:vite.config.mts:119-153`, a hand-maintained
  allowlist per #210); 11ty's own port is `--port=8080` in the `dev` script (`we:package.json` `"dev"`). **FUI
  is *not* a port problem** — it resolves by **relative** filesystem path-alias to `../frontierui`
  (`we:vite.config.mts:15,206`), so a coupled WE+FUI **sibling clone** (already how #1943 provisions cross-repo
  lanes) wires FUI **for free**: the alias is relative to the clone's own root. So the entire unsolved coupling
  reduces to **one pair of ports** (WE vite + 11ty) and **one hardcoded cross-reference** (the proxy target →
  the lane's 11ty port). That is the whole of "the hard mechanism."
- **#1995 made the `lane/*` push transport reliable** (bounded jittered retry on ref-lock contention), so the
  remote-convergence primitive PR-flow rides on is solid.
- **Branch / push posture today.** The #1153 branch guard denies `git switch` / `git checkout -b` / `git
  worktree add` in the shared checkout (forces clones over worktrees) — `we:backlog/1153-…`; the never-push
  default was **removed** 2026-06-29, so direct `git push origin main` is allowed
  (`we:.claude/agent-memory/never-push-guard-removed.md`); broad-stage `git add -A` stays denied. Rule 104:
  commit on the current branch; rule 105: claim ignores git state.
- **Visual class hinges on cross-origin.** `.fui-card` lands only where the FUI registration ESM loads, not on
  `/backlog/` (`we:backlog/1895-…:18-31`); the #1895 transparent-card regression is the canonical
  gross-regression a per-lane visual harness must catch.

## Axis-framing

The cold item framed six flat "sub-forks." The standing test sorts them into **five genuine forks** and **three
support-both** consequences — and that sort *is* most of the ruling. The forks: the **clone-scope hinge** (who
works isolated), the **port-assignment shape** (how a lane's ports are chosen — the only code-level call in "the
hard mechanism"), the **landing gate** (auto vs human), the **branch-protection posture** (who may write `main`),
and **how visual changes land safely** under a no-human gate (render-check-in-gate vs human-owns-visual —
originally mis-cast as a "build the harness, when?" validation-gate; with Fork 3 fully automatic it is a real
either/or). The support-both consequences — per-clone dev server/HMR, the proxy-target env-var parameterization,
FUI sibling-clone wiring — are not forks: no coherent excluded branch exists, they fall out of Forks 1+2.

## Recommended path at a glance

| Element | Archetype | Recommended default | Confidence |
|---|---|---|---|
| **Fork 1** — Clone scope (the hinge) | merit fork | **Isolate-by-default: every writing session works in a clone; `main` is convergence-only** (direct-to-`main` only with provably zero concurrent writers); DX cost paid down by Forks 2+3 | ✓ decided 2026-06-30 |
| **Fork 2** — Per-lane port assignment | code-shape fork | **Pure deterministic offset by lane index + `strictPort`; per-repo bands — WE `3000`/`8080`, plateau `4000`, FUI `6000` (5000/7000 are macOS-reserved); ports + proxy target env-driven via `.env.local`** | ✓ ratified 2026-06-30 |
| **Fork 3** — Landing gate | merit fork | **Fully automatic auto-merge on gate-green — no manual merge, no human review** (the automated gate is the only check); per-item human review stays opt-in, never required | ✓ ratified 2026-06-30 |
| **Fork 4** — Branch-protection shape | merit fork | **Asymmetric: `main` writable by the human, observe-only for AI/agents** (agents PR-flow only); convention now, bot-principal rule later; full observe-only stays a future flip | ✓ decided 2026-06-30 |
| **Fork 5** — How visual changes land safely (no-human gate) | merit fork | **Render-check in the gate — the per-lane visual harness is a v1 deliverable** (visual lanes auto-merge only when a headless #1895 render check passes); fallback (b) = agents don't auto-land visual, human owns visual surfaces | ✓ decided 2026-06-30 |
| *Per-clone dev server/HMR* | support-both | each clone runs `npm run dev` on its own pair; HMR roots at the clone | — |
| *Proxy-target env-var parameterization* | support-both | read the 11ty target from `WE_ELEVENTY_PORT` (default 8080), `changeOrigin:true` | — |
| *FUI sibling-clone wiring* | support-both | automatic via the relative `../frontierui` alias (coupled clone, #1943) | — |

## Fork 1 — Clone scope (the hinge)

**Fork-existence:** a real either/or on the *default posture by writer-kind* — an **automated** writing session
(agent / `/workflow`) either isolates in a clone and converges through `origin`, or writes the shared `main`
directly; one excludes the other as the default. Both are coherent shipped policies, so this is a genuine fork.

- **(a) Isolate-by-default for automated writers; the human keeps direct-to-`main`.** *(default — decided in
  review 2026-06-30)* Every agent / `/workflow` writing session works in a **clone** (branches are guard-blocked
  in the shared checkout per #1153, so isolation = a clone), gates itself, pushes a `lane/*` ref, and converges
  through the integrator's **auto-merge** (Fork 3). `main` is **convergence-only for automation** — no agent
  commits `main` directly. The **human** (the single trusted writer) retains direct commit/push to `main` and
  owns their own write timing. This is the writer-kind asymmetry Fork 4 encodes as branch posture.
- **(b) Tiered for automated writers — clone for substantive/parallel work; let "trivial" agent edits hit
  `main`.** The prior draft's default. **Rejected:** the dividing line is *inoperable under concurrency* — you
  can only prove file-disjointness for the items the orchestrator itself dispatches, never for an ad-hoc agent
  writing `main` as a *stranger* to that partition. Two automated writers to `main` (a direct agent + the
  integrator landing a lane) can collide on the same file, and rebase-retry protects only *lane* commits — the
  #1985 incident's own shape. "Trivial" is not a safety property.
- **(c) Every session isolates, including the human.** Maximal purity, but it strands the human's single
  watched dev server and forces a clone+push+merge for a one-line human edit with **zero** safety benefit (a
  lone trusted writer has no one to race) — friction the user explicitly declined ("writable for me, not for
  ai"). The human-direct path is the cheap escape (a) preserves.

**Default: (a) isolate-by-default for automation; human-direct.** Two reasons the "tiered" default failed and
one reason the human is exempt: (1) **parallel safety** — you cannot prove an ad-hoc agent `main` edit is
disjoint from a live lane, so isolation is the *only* race-free answer for automation once any other writer
exists; (2) **PR-readiness** — #1985 Rung 2 ratified *adopting* PR-flow, and a direct-to-`main` carve-out for
agents preserves the shared-checkout muscle instead of building the clone→push→gate→merge one; (3) the **human**
is a single trusted writer who owns their own timing, so forcing them to clone buys no safety and only friction.
The DX objection to isolating automation — cloning taxes small edits — is what **Fork 2** (cheap per-lane ports)
and **Fork 3** (auto-merge, no manual step) pay down. No code surface — pure policy — so no snippet.

`Skeptic: REFUTED-AND-FLIPPED (in review) — the prepared "tiered, line = may-touch-a-live-lane's-file" default
was shown inoperable: the file-overlap line is only computable for the orchestrator's own partition, never for
an ad-hoc agent writing main, so it cannot guarantee parallel safety; and it didn't practice the PR-flow #1985
ratified. Flipped to isolate-by-default FOR AUTOMATION (main convergence-only for agents), human keeps
direct-main as the trusted single writer (Fork 4 asymmetry); DX cost answered by Forks 2+3.`

## Fork 2 — Per-lane port assignment (the only code-level call in "the hard mechanism")

**Fork-existence:** a real either/or on the *assignment policy* — a lane's ports are chosen **either** by a
fixed function of its index **or** by a runtime free-port scan with a registry; one default excludes the other
(you can't both fix and dynamically-discover the same port). Both are coherent and shipped by real tools, so
this is a genuine code-shape fork. (The *parameterization* it rides on — env-driven ports + proxy target — is
support-both, below, not the fork.)

- **(a) Pure deterministic offset by lane index; primary reserves the canonical `3000`/`8080`;
  `strictPort:true`.** *(default)* The lane pool is already a **fixed, persistent, stably-indexed** set
  (`lane-0…lane-N` under `~/workspace/.lanes/<repo>/`, `we:scripts/lane-pool.mjs`). Derive each lane's pair
  arithmetically (`base = 3000 + 100 + index*10`) and let the **primary checkout keep `3000`/`8080`** (the
  human's running `npm start`). Prior art (Superset's per-workspace `*_PORT_BASE` blocks; `portree`'s
  per-worktree reserved blocks) is exactly this. The discriminant vs (b): the lane's URL is a **stable,
  predictable function of its index** — no registry, no run-to-run churn, the pool index *is* the allocator.
  The one weakness — a port the formula computes that some stray process already squats — surfaces as a
  **loud `strictPort` boot failure** (not a silent half-bind), which an operator clears by bumping the pool's
  base offset. *(Skeptic note: do **not** paper over that squat with a linear probe — a probe makes the chosen
  port a runtime free-scan, i.e. branch (b) wearing (a)'s clothes, and forfeits the stable-URL property that
  is (a)'s whole reason to exist. If squats ever become common, that is the signal to adopt (b) wholesale, not
  to smuggle dynamic discovery into (a).)*
- **(b) Dynamic free-port scan + a lane registry.** Each lane scans for two free ports at boot (e.g.
  `get-port`/`portfinder`) and records them in a registry the proxy reads. Robust against arbitrary collision;
  the cost is real machinery (a registry to write, read, garbage-collect) and **non-reproducibility** — a
  lane's URL changes run to run, losing the addressability the deterministic scheme keeps. The genuine excluded
  branch: it trades stable URLs for collision-robustness a fixed pool + reserved primary doesn't need.

**Default: (a) pure deterministic offset, `strictPort` to fail loud — with per-repo thousands-bands.** A fixed
pool with reserved primary ports has no collision surface that justifies a stateful scanner+registry, and
stable, scriptable lane URLs are worth more here than scan-robustness — so the fork resolves cleanly to (a). The
whole change is small because FUI is free (relative alias) and only the 11ty **proxy target** is a hardcoded
cross-reference — parameterize it by env (`strictPort:true` so a genuine collision fails loud rather than
silently half-binding; `changeOrigin:true` so the upstream `Host` is rewritten) and a lane just launches
`npm run dev` against a generated `.env.local`.

**Per-repo bands (decided in review 2026-06-30).** Each repo owns a **thousands-band** so the constellation's
dev servers — and multiple lanes of each — never collide; lane *N* offsets within its repo's band, the repo's
primary checkout reserves the band base:

| Repo | vite band | 11ty band | notes |
|---|---|---|---|
| WE | `3000+` | `8080+` | existing; primary reserves `3000`/`8080` |
| plateau-app | `4000+` | — | existing (`vite --port 4000`) |
| Frontier UI | `6000+` | `6080+` | **`5000`/`7000` are macOS-reserved** (AirPlay/ControlCenter squat them — verified taken on this host); `6000` verified free. FUI's *current* `3001`/`3002`/`8082` overlap WE's band — **relocate FUI to its `6000s` band** as part of the build (an FUI-repo edit, not this changeset) |

FUI needs its own band only when worked **as its own repo** with its own dev server; inside a WE+FUI **coupled
lane**, FUI is still relative-path-aliased into WE's vite (no separate port — the sibling-clone wiring below).

```ts
// we:vite.config.mts — ports + the ONE hardcoded proxy cross-reference, env-driven (support-both).
// Vite resolves config before .env* loads, so read process.env directly (or loadEnv(mode, cwd, '')).
const ELEVENTY = process.env.WE_ELEVENTY_PORT ?? '8080';   // primary keeps 8080; a lane sets its own
const VITE     = Number(process.env.WE_VITE_PORT ?? 3000); // primary keeps 3000
export default defineConfig({
  server: {
    port: VITE,
    strictPort: true,                                       // fail loud on collision, never silently +1
    proxy: {
      '^/\\.11ty/': { target: `http://localhost:${ELEVENTY}`, changeOrigin: true },
      // …every proxy entry's target becomes `http://localhost:${ELEVENTY}` (was the literal :8080)
    },
  },
});
```

```jsonc
// we:package.json — the dev script reads the 11ty port from the same env (default unchanged):
"dev:docs": "eleventy --serve --port=${WE_ELEVENTY_PORT:-8080} --quiet",
```

```sh
# Fork 2 (a) — lane-pool writes one .env.local per clone at setup (index N, base 3000+100, stride 10):
#   primary:  WE_VITE_PORT=3000  WE_ELEVENTY_PORT=8080   (reserved — the human's npm start)
#   lane 2:   WE_VITE_PORT=3120  WE_ELEVENTY_PORT=8200   (pure function of index; strictPort fails loud if squatted)
cd ~/workspace/.lanes/web-everything/lane-2          # FUI auto-wires: ../frontierui is a sibling clone
WE_VITE_PORT=3120 WE_ELEVENTY_PORT=8200 npm run dev   # vite serves :3120, proxies to :8200 (not :8080)
```

`Skeptic: SURVIVES-WITH-AMENDMENT (the fork was nearly refuted and rescued by sharpening, not flipping) —
(classification) my first draft put a "linear-probe fallback" inside option (a); the skeptic correctly showed
that probe IS dynamic discovery (env file = registry) and dissolved the (a)/(b) distinction into one mechanism.
Fix: the probe is removed — option (a) is now PURE deterministic offset with strictPort (a squat is a loud,
operator-fixable boot failure, not a silent re-scan), which restores the genuine either/or — stable predictable
URLs (a) vs collision-robust-but-unstable URLs + registry (b). (merit) strictPort-vs-probe tension resolved by
dropping the probe: strictPort is now unambiguously the collision behavior. The deterministic default holds for
a fixed pool + reserved primary.`

## Fork 3 — Landing gate

**Fork-existence:** a real either/or — `main` either accepts a green lane **automatically** or **waits for a
human** to approve; one default excludes the other. Both are coherent (CI auto-merge vs mandatory review),
genuine fork.

- **(a) Fully automatic auto-merge on gate-green — no manual merge, no human review.** *(default — decided in
  review 2026-06-30: "I don't want to have to manual merge or test anything")* The integrator **already** merges
  each `lane/*` into `main` one-at-a-time with a full gate per merge, rebase-and-retry on conflict
  (`we:backlog/1933-…:Architecture`). The **automated gate is the only check**; there is no human in the landing
  loop. Per-item human review stays available as an **opt-in tag** (the human *chooses* to eyeball a specific
  item) but is **never required** — the operator is never forced to merge or test by hand.
- **(b) Human-review gate before every merge.** A person approves *every* lane before it lands. **Rejected** —
  it is exactly the manual step the operator declined; it serializes an agent fleet behind one reviewer and
  throws away the proven auto-converging integrator.

**Default: (a) fully automatic auto-merge on gate-green.** No manual merge, no mandatory human review — the
automated gate (`check:standards` + build + tests) is the sole landing authority. Code surface is the existing
integrator (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` merge/gate step) as-is, plus
honoring an *optional* per-item review tag. **The render gap is closed by automation, not a human** — but *how*
is its own call: the gate doesn't render (the #1895 class — a CSS removal passed every gate and stripped ~14
templates), so visual safety is decided in **Fork 5**. Under Fork 5's recommended default, the headless render
check is **part of the gate from v1**, so a visual lane auto-merges only when it render-verifies — still no
human. (Fork 5's fallback (b) instead keeps agents off visual surfaces entirely; either way no manual gate is
imposed on agents.)

`Skeptic: REFUTED-AND-RE-FLIPPED (in review) — the skeptic's first flip coupled auto-merge to a HUMAN gate for
visual lanes. The operator rejected any manual step ("no manual merge or test"), so the coupling is resolved the
other way: auto-merge is fully automatic and the #1895 render hole is closed by automation — the *mechanism* for
that is split out to Fork 5 (render-check-in-gate vs human-owns-visual), not a human review step. Net: no manual
gate anywhere; the gate becomes complete by building automation (Fork 5(a)).`

## Fork 4 — Branch-protection shape

**Fork-existence:** a real either/or on **who** may write `main` directly. The posture is **either** symmetric
(all writers same rule — fully open *or* fully observe-only) **or** **asymmetric by writer-kind** (human writes
`main`; automation must PR-flow); one excludes the other. All are coherent shipped postures, genuine fork.

- **(a) Asymmetric — `main` writable by the human, observe-only for AI/agents.** *(default — decided in review
  2026-06-30: "writable for me, not for ai")* The **human** (the single trusted writer) commits/pushes `main`
  directly; **automated writers never do** — every agent / `/workflow` session works in a clone, pushes a
  `lane/*` ref, and lands via the integrator's auto-merge (Forks 1 + 3). This is the writer-kind asymmetry Fork
  1 already assumes. Enforcement is **convention now** (agents isolate-by-default; the closeout/commit guards +
  Rung 1 keep them off direct `main`), and becomes **server-side enforceable** later if agents push as a
  distinct GitHub principal (a bot identity) under a branch rule that exempts the human. The integrator's own
  merge-to-`main` is the human-trusted convergence path, so it is unaffected.
- **(b) Symmetric writable — anyone may write `main`.** The status quo. Excluded cost: it lets an agent commit
  `main` directly, which Fork 1 just ruled unsafe under concurrency — so it contradicts the isolate-by-default
  call.
- **(c) Symmetric observe-only — even the human PR-flows.** The clean multi-human PR-shop end state. Excluded
  cost *now*: it forecloses the human's direct-commit path and would refuse the integrator's merge-to-`main`
  before any second human exists to need it — friction the operator explicitly declined.

**Default: (a) asymmetric — human-writable, AI-observe-only.** It encodes exactly the operator's call, composes
with the existing statute (keeps the #1153 branch guard and the removed never-push default; the human's
direct-push stays authorized), and makes the eventual fully-observe-only flip (c) nearly free — by then agents
are *already* off direct `main`, so only the human's path would need to close, when a second human appears. The
near-term enforcement is convention + the commit/closeout guards; the server-side bot-principal rule is a
documented later tightening, not a new decision. No code surface beyond that future rule — no snippet.

`Skeptic: SURVIVES-WITH-AMENDMENT — the prepared default was symmetric "writable main, observe-only later," which
under-specified WHO writes. Operator sharpened it to asymmetric (human-writable, AI-observe-only), which is
strictly safer: it removes the agent-direct-to-main path Fork 1 ruled unsafe while keeping the human's trusted
path and the integrator's convergence. (statute) no collision — #1985's #non-destructive-closeout-prflow defers
branch-protection here; #1153 + never-push-removed untouched, and never-push-removed still authorizes the
human's push-to-main. (enforcement) convention-now / bot-principal-later is honest about what's enforceable
today vs a documented tightening.`

## Fork 5 — How visual changes land safely under no-human auto-merge

**Fork-existence:** a genuine either/or, *not* a "when do we build the harness" prioritization (the earlier
validation-gate framing was wrong). Fork 3 made `main`'s landing authority the **automated gate, with no human
in the loop**; but the gate **does not render**, and the visual class hinges on cross-origin (`.fui-card` lands
only where the FUI registration ESM loads, `we:backlog/1895-…:18-31`). So a real choice is forced: **what is
the mechanism by which an agent's visual change reaches `main` without a person checking it?** Two coherent
branches genuinely cannot both be the default; the do-nothing branch ("auto-land visual changes unverified") is
*broken* — it defeats the gate's purpose by auto-shipping the #1895 class.

- **(a) Render-verification is part of the landing gate — the per-lane visual harness is a v1 deliverable.**
  *(recommended default)* A visual-touching lane auto-merges **only when** a headless Playwright render check
  passes on its booted WE+FUI cross-origin pair (Fork 2 makes that pair cheap). No human, no unverified visual
  landing, **and** agents keep full autonomy over visual/CSS/template work. Cost: v1 scope includes building the
  cross-origin per-lane Playwright harness — real work, but the falsifiable #1895 test (below) bounds "done."
- **(b) Agents don't auto-land visual changes — visual surfaces are the human's lane.** Any touch of a visual
  surface (`*.njk`, `*.css`, template/component files) is **excluded from agent auto-merge**; those changes are
  the human's domain via the Fork-4 direct-`main` path (where the human's own eye is the check — not a *review
  gate* imposed on agents). No harness needed for v1. Cost: agents cannot autonomously ship visual work until
  (a) is eventually built — a real cap on agent scope, given how much of the WE docs surface is visual.

**Default: (a) render-check in the gate (harness is v1) — decided in review 2026-06-30.** It is the only branch
that delivers all three of the postures already chosen — **no human gate** (Fork 3), **no unverified visual
landing**, and **agent autonomy on visual work** — so it is the consistent completion of "fully automatic." (b)
is the smaller-v1 fallback if you'd rather ship the non-visual pipeline first and keep visual work human-only
for now; it trades agent scope for a cheaper v1. The broken branch (auto-land unverified) is excluded because it
makes the gate a no-op for exactly the regression class it exists to catch.

**Acceptance test for (a) (concrete + falsifiable).** A lane boots WE + FUI cross-origin (via Fork 2's ports)
and a **headless Playwright run reproduces the #1895 transparent-`.fui-card` regression AND its fixed pass**,
both from the CLI with no human screen. Files under #1933 / the explorer-judge epics (#1167/#1552). Catches the
gross-regression class (a surface going transparent/unstyled is screenshot-obvious); the human eye still wins on
design-quality nuance.

```js
// Fork 5 (a) — the render check joins the gate (integrator, before auto-merge of a visual-touching lane):
//   1. boot the lane's WE+FUI pair on its Fork-2 ports (cross-origin .fui-card loads)
//   2. playwright: assert the #1895 surface computes a non-transparent .fui-card frame
//   3. PASS → auto-merge;  FAIL → hold the lane, surface the screenshot diff (still no human *required* to merge)
```

`Skeptic: SURVIVES-AS-FORK (reclassified in review) — earlier framed as a validation-gate ("build it, when?").
That was wrong: with Fork 3 taking no human gate, "how does a visual change land safely" is a forced design
choice with two coherent branches (render-check-in-gate vs human-owns-visual) and one broken branch
(auto-land-unverified). Reclassified to a real Fork 5 with a bold default. The default (a) is the consistent
completion of fully-automatic; (b) is the explicit smaller-v1 fallback, not a deferral.`

## Supported by default (consequences of Forks 1+2, not forks)

- **Per-clone dev server / HMR.** Once Fork 2 allocates a lane's ports, the cloning session runs `npm run dev`
  in its clone on its own pair; vite + 11ty watch the clone's own files, so HMR roots at the clone with no
  extra mechanism. No excluded branch — it is what the ports are *for*.
- **Proxy-target env-var parameterization.** Reading the 11ty proxy target from `WE_ELEVENTY_PORT` (default
  `8080`, `changeOrigin:true`) is the single config edit that unblocks Fork 2; it changes nothing for the
  primary checkout (default preserved). Plain engineering, not a ratifiable call.
- **FUI sibling-clone wiring.** The `../frontierui` path-alias is **relative** to the clone root
  (`we:vite.config.mts:15,206`), so the coupled WE+FUI sibling clone #1943 already provisions wires FUI per
  lane automatically — no per-lane FUI origin or port to manage.

## Statute-overlap (checked in prep)

This decision will likely set `codifiedIn` into `we:docs/agent/platform-decisions.md`. The anchor must compose
with — not duplicate — #1985's `#non-destructive-closeout-prflow` (Rung 1 closeout invariant + PR-flow
direction). This item codifies the *mechanism* (isolate-by-default for automation + human-direct, pure-deterministic
per-lane ports with per-repo bands, fully-automatic auto-merge landing, asymmetric human-writable/AI-observe-only
`main`), citing #1985's anchor as the governing direction it implements. **Skeptic statute-overlap check (run in prep): no collision** — #1985's
anchor *explicitly delegates* this mechanism to #1996, so #1996 codifies under/beside it cleanly; #1153 + the
removed never-push default are left untouched. One caveat folded into Fork 1: the codified clone-scope rule
must **not** re-assert Rule 105 beyond its claim-eligibility turf (105 governs whether an item is *claimed*,
not write-posture) — Fork 1's rule text is written to file-overlap, not to a 105 warrant.

## Relationships

- **Implements** #1985 Rung 2 direction (adopt PR-flow) + folds in Rung 3 (the visual harness = Fork 5).
- **Builds on** #1933 (clone/lane/push machinery, resolved) and #1995 (reliable lane-push transport).
- **Composes with** #1153 branch guard + the removed never-push default (Fork 4) — no change to either.
- Visual harness files under #1933 / #1167 / #1552; the #1895 regression is its acceptance fixture.

## Resolution (2026-06-30)

**Ratified in review** — all five forks decided (Fork 1 isolate-by-default for automation + human-direct; Fork
2 pure deterministic ports + per-repo bands WE `3000`/`8080` · plateau `4000` · FUI `6000`; Fork 3 fully
automatic auto-merge, no manual merge/review; Fork 4 asymmetric `main` — human-writable, AI-observe-only; Fork
5 render-check in the gate, harness is v1). Codified as the `#pr-flow-rollout-mechanism` anchor in
`we:docs/agent/platform-decisions.md`, composing under #1985's `#non-destructive-closeout-prflow` direction.

**Spawned build slices:**
- **#1997** — env-drive per-lane dev-server ports (vite + 11ty) with `strictPort` + generated `.env.local` (Fork 2).
- **#1998** — isolate-by-default for automated writers + asymmetric `main` branch posture (Forks 1+4).
- **#1999** — relocate Frontier UI dev-server ports to the `6000s` band (Fork 2's per-repo bands).
- **#2000** — per-lane cross-origin visual render-check in the landing gate, #1895 acceptance (Fork 5; blocked-by #1997).
