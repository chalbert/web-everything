---
kind: decision
status: resolved
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
dateResolved: "2026-06-30"
graduatedTo: 1996
codifiedIn: "docs/agent/platform-decisions.md#non-destructive-closeout-prflow"
preparedDate: "2026-06-30"
relatedItems: ["1933", "083"]
relatedReport: reports/2026-06-30-automated-writer-isolation.md
tags: [parallel-batch, isolation, closeout, dev-server, playwright, pr-flow]
---

# Where work happens: isolate automated writers in lanes + non-destructive closeout (escalation ladder toward observe-only main)

**Status — RESOLVED 2026-06-30. Rung 1 ratified (forced invariant); Rung 2 direction ratified (adopt
PR-flow / multi-session); Rung 3 folded into the Rung-2 mechanism decision, prepared as #1996.** How much of the constellation's work runs **isolated** (clone, own HEAD,
merge via `origin`) vs directly in the **shared primary checkout**, what an automated closeout may touch, and
what operating model the constellation's writers target. Grounded in a real incident, the resolved #1933 clone
model, and an SE-practice prior-art survey published as the
[`automated-writer-isolation-model`](/research/automated-writer-isolation-model/) topic (report via
`relatedReport`). The decision splits into **three archetypes** — they are not one ladder, and bundling them
would smuggle a scope question and an unbuilt harness past the incident that only proves Rung 1.

## The decision at a glance

| Element | Archetype | Call | Confidence |
|---|---|---|---|
| **Rung 1** — non-destructive, changeset-scoped closeout | forced invariant | **RATIFIED** — act only on your own manifest; never revert/delete a file you didn't write; never read `git status` as ownership | high |
| **Rung 2** — operating model for the constellation's writers | live operating-model fork | **RATIFIED — adopt PR-flow / multi-session** (direction); lane/\* push is the general transport (reliable via #1995); mechanism prepared as **#1996** | direction high / mechanism TBD |
| **Rung 3** — observe-only main for visual work | sub-question of Rung 2's mechanism | **folds into #1996**; carries the #1895 Playwright acceptance test | med-high |

## Grounding digest

The incident (`batch-2026-06-29e`): a `/workflow` closeout ran in the **shared** primary checkout, diffed the
**dirty working tree** to infer "its own residue", mis-read a concurrent `/prepare` session's in-progress #1983
files as residue, and `git checkout`/`rm`'d them — no permanent loss only by luck
(`we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md`). **The manifest already existed:**
the orchestrator records per-item `changedFiles` in its ledger (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:276,750`)
and its central reconcile steps are **read-only** (a `multiLaneFiles` detector + `merge-base --is-ancestor`, no
`checkout`/`rm`). So the destructive act was a **main-agent prose closeout** reading `git status` *despite a
correct ledger in hand* — the bug is the **method** (dirty-tree-as-ownership), not a missing input. Settled
already and **not** re-opened: lane execution isolation is correct and stays (#1933); concurrent *commits* to
`main` are safe (append-only history); the hazard is **destructive working-tree ops** + **reading the dirty tree
as truth**; headless Playwright doesn't need the human's screen.

## Axis-framing

The cold item framed one fork — "an escalation ladder; which rung, in what order." The decision splits it into
**three archetypes**, each its own call:

- **Rung 1 — non-destructive, changeset-scoped closeout** is a **forced invariant** (the dirty-tree-ownership
  branch is *broken* — it destroyed real work). The one genuinely-new ratifiable call. **Ratified.**
- **Rung 2 — operating model for the constellation's writers** is a **live operating-model fork**: do the
  constellation's writers (agent *and* human sessions, not just `/workflow` batches) collaborate **through the
  remote** in a PR-flow (clone → push → gate → review → merge), or keep writing the **shared primary checkout**?
  The **direction is to adopt PR-flow**; the rollout mechanism is prepared as its own decision.
- **Rung 3 — observe-only main for visual work** is the **visual-verification sub-question of Rung 2's
  mechanism** — observe-only `main` is the end state of PR-flow — so it folds into that decision rather than
  standing alone.

Rung 1 is ratified on the incident's evidence. Rung 2's **direction** is ratified (adopt PR-flow); its
mechanism and Rung 3 are deferred to a dedicated prepared decision (#1996) — bundling them here would have
ratified an operating-model rollout and an unbuilt harness cold.

## Rung 1 — non-destructive, changeset-scoped closeout (forced invariant, ratified)

**Fork-existence:** case (a), a forced invariant — the excluded branch ("infer my residue from the dirty tree /
react destructively to ambient working-tree state") is **broken**: it `checkout`/`rm`'d a concurrent session's
live work. The rule: **any agent/closeout/integrator acts only on files in its own recorded manifest, and never
reverts/deletes a file it did not itself write; the dirty tree is never read as ownership truth.**

Why it is forced, not one option among many (the skeptic's classification attack, refuted):

- The two alternatives both **reduce to this invariant or require cooperation the incident proves absent.** A
  *session-scoped lock* is #083's path, and #083's own Fork 6 default is *keep parked — an advisory lock is just
  `flock`, "one bad actor breaks it"* (`we:backlog/083-agent-file-lock-coordination.md:155-167`); "don't
  destructively touch files you didn't write" is the **no-bad-actor-needed** form of the same guarantee. A
  *commit-before-closeout* discipline fails because the colliding writer was a **stranger** (a concurrent
  `/prepare`), and you cannot force a stranger to commit. So the only mechanism that survives without
  coordinating an uncontrollable third party is "act only on your own manifest."
- **The input already exists.** The ledger carries `changedFiles` per item
  (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:276,750`); the bug was *method*, not a
  missing manifest — which is exactly why the fix is a rule, not a feature.
- **Prior art:** Terraform treats state as *"a snapshot after the last apply, not a live representation"* and
  `plan→apply` enacts only the recorded diff — the canonical "operate on your recorded changeset, never infer
  from ambient live state."

**Codified (2026-06-30):** the invariant is ratified into the durable memory rule
`we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md` (marked ratified by this item) and
is already practised by the scoped close-out gate in `we:docs/agent/backlog-workflow.md` (*Closing out a
completed item* / pre-flight (b)).

`Skeptic: SURVIVES — the prep skeptic tried to demote it to "one option in a design space" (lock / commit-first);
both alternatives reduce to this invariant or need cooperation the incident proves absent, so it is genuinely
forced. Bonus the attack surfaced and was folded in: the manifest already existed in the ledger
(`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:276,750`) and the orchestrator's central
steps are read-only — so the destructive act was a main-agent prose closeout off `git status` despite a correct
ledger, proving the bug is the method.`

## Rung 2 — operating model for the constellation's writers (live fork; direction: adopt PR-flow)

**The fork.** Do the constellation's writers — agent *and* human sessions, not just `/workflow` parallel
batches — collaborate **through the remote** in a PR-flow (each works in its own clone/ref → push → gate →
review → merge), or keep writing the **shared primary checkout**? This is an **operating-model** call, distinct
from Rung 1: Rung 1 makes the *shared-checkout* model safe; Rung 2 chooses what model the constellation targets
as it grows to multiple concurrent sessions.

**Direction: adopt PR-flow / multi-session.** The goal is multiple concurrent sessions collaborating via the
remote rather than sharing one dirty working tree. The **lane/\* push-ref transport already implements this for
`/workflow`** and is the general primitive — now made reliable by #1995's bounded push retry. The institutional
form is off-the-shelf (trunk-based dev + branch protection, F4/F8–F10); the WE-specific build is the
multi-origin dev-server harness (below / Rung 3).

**Why this is a real fork now, not "settled by #1933."** The incident alone does **not** justify it — with Rung
1 in force the incident's harm is gone, so closeout-safety is no carrier for an operating-model change. What
makes it live is the **stated target operating model**: #1933's *solo-dev, serial-batch-is-day-to-day* scope
(`we:backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md:22-24`) was premised on a solo
developer, and "support multiple concurrent sessions working together" is exactly the premise that reopens it —
deliberately, on new evidence (the direction), not retroactively on the incident.

**The DX cost is the price of the model, not a veto.** The prior worry — cloning strands work from the single
watched dev server (HMR rooted at the primary checkout) — was a **solo-dev artifact**: in a multi-session model
each session runs its own dev server in its own clone. Real cost (a port per clone, per-clone vite proxy
allowlist), but it is the cost of the chosen model rather than a reason to refuse it.

**Mechanism → prepare as its own decision (not ratified here).** The *direction* is the call on this item; the
*rollout* has genuine sub-forks owed research + a bold default before any ruling:

- **Clone scope (the main hinge):** does *every* session work in a clone, or only sessions doing substantive
  multi-item work, with trivial interactive edits still allowed direct-to-`main`?
- **Per-clone dev server / HMR** for interactive + visual work (own port per clone; vite proxy allowlist per
  clone).
- **Landing gate:** auto-merge on gate-green vs a human review gate (and what "review" means for an all-agent
  push).
- **Branch-protection shape:** observe-only `main` (GitHub "require PR" / GitLab "Allowed to push: No one",
  F8/F10) and how it composes with the #1153 branch guard and the removed never-push default.
- **Visual verification:** Rung 3's acceptance test (below).

`Skeptic: the incident-driven case for generalizing is correctly refuted (Rung 1 removes the harm) — so this
fork stands or falls on the operating-model goal alone, and only the DIRECTION is ratified here; the mechanism
is deferred to a prepared decision precisely so a rollout isn't ratified cold.`

## Rung 3 — observe-only main for visual work (folds into Rung 2's mechanism)

Observe-only `main` is the **end state of PR-flow** (nothing pushes to `main` directly; everything lands via
gate→review→merge), so it is the **visual-verification sub-question of Rung 2's mechanism**, not a standalone
call. It carries forward into that decision intact:

- **What it needs.** Observe-only main is feasible *institutionally* off-the-shelf (F8/F10), but genuine per-lane
  **visual** rendering needs full clones with their own ports — worktrees give code isolation, **not runtime**
  isolation (F1/F3/F7) — and the visual class hinges on **cross-origin** behaviour (`.fui-card` lands only where
  the FUI registration ESM loads, `we:backlog/1895-the-fui-card-class-cross-origin-styling-on-non-fui-routes.md:18-31`;
  the vite proxy is a hand-maintained allowlist, `we:backlog/210-catalog-authoring-vite-proxy-allowlist.md:11-23`).
  Per-lane bring-up is "the constellation, not one `--port`" — WE + FUI origins up and wired per lane.
- **Acceptance test (the un-gate trigger).** A falsifiable test, not "the harness is built": *a lane boots WE +
  FUI cross-origin and a headless Playwright run reproduces the #1895 transparent-`.fui-card` regression **and**
  its fixed pass, both from the CLI with no human screen.* This ties go/no-go to the exact gross-regression class
  it exists to catch and forecloses a half-built single-origin harness being declared "done."
- **Scope.** The multi-origin dev-server harness is the WE-specific build (file under #1933 / the explorer-judge
  epics #1167/#1552). The human eye still wins on design-quality nuance; this reliably catches only the
  **gross-regression** class (a surface going transparent/unstyled is screenshot-obvious).

## Open mechanism options (carried to the Rung-2 mechanism decision)

These were *rejected under the prior solo-dev framing*; adopting PR-flow turns them into live options for the
mechanism decision rather than settled rejections.

- **Do human sessions clone too?** Previously rejected as a DX tax (cloning strands interactive/visual work from
  the single watched dev server). Under PR-flow this is exactly the **clone-scope hinge**: each cloning session
  runs its own dev server, so the question is *which* sessions clone (all vs substantive-work-only), not whether
  the DX tax is acceptable in the abstract.
- **Branch-based isolation (feature branch in the live checkout)** — the normal PR-shop shape, preserves HMR, but
  the #1153 branch guard denies branch creation in the shared checkout (forced clones over worktrees). A live
  option only if the mechanism decision revisits that guard; otherwise the clone + per-clone-port path stands.

## Statute-overlap (reconciled here)

- **#1933 scope decision** (`we:backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md:22-24`)
  — Rung 2 **deliberately reopens** it: #1933's solo-dev premise is superseded by the multi-session PR-flow
  direction. Rung 1 is the genuinely-new part #1933 didn't cover (closeout safety).
- **Rule 105 — claim ignores git state** (`we:.claude/agent-memory/105-feedback_claim_ignores_git_state.md`) —
  *composes* with Rung 1: the dirty tree is the normal baseline (an argument *for* tolerating shared-checkout
  writes under a non-destructive closeout, against evicting them).
- **#083 file-lock coordination** (`we:backlog/083-agent-file-lock-coordination.md:155-167`) — Rung 1 is the
  no-bad-actor-needed form of #083's parked advisory lock; composes (status-claim + non-destructive discipline,
  not a hard lock).
- **#1153 branch guard / never-push-removed** — a sub-fork of Rung 2's mechanism: the PR-flow rollout must
  reconcile branch-protection with the #1153 branch guard, and confirm shared-checkout commits to `main` are now
  allowed (the never-push default was removed 2026-06-29).

## Relationships

- **Extends** #1933 (clone model) — Rung 1 adds closeout safety #1933 didn't cover; Rung 2 reopens #1933's
  solo-dev scope toward PR-flow; the Rung-2 mechanism (incl. Rung 3's harness) files under #1933.
- **Spawns:** a `type:decision` to **prepare** the PR-flow rollout mechanism (clone scope, per-clone dev
  server/HMR, landing gate, branch protection, visual-verification harness) — scaffolded on ratification, this
  item `graduatedTo` it.
- **#1995** — bounded retry on transient lane-push ref-lock contention; makes the lane/\* push transport
  reliable enough to be the general PR-flow primitive.
- Motivating incident recorded in `we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md`
  and the new `we:reports/2026-06-30-automated-writer-isolation.md`.
