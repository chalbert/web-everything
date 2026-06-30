---
kind: decision
status: open
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedItems: ["1933", "083"]
relatedReport: reports/2026-06-30-automated-writer-isolation.md
tags: [parallel-batch, isolation, closeout, dev-server, playwright, pr-flow]
---

# Where work happens: isolate automated writers in lanes + non-destructive closeout (escalation ladder toward observe-only main)

**Prepared, ready to ratify.** How much of the constellation's work must run **isolated** (clone, own HEAD,
merge via `origin`) vs directly in the **shared primary checkout**, and what the automated closeout may touch.
Grounded in a real incident, the resolved #1933 clone model, and an SE-practice prior-art survey published as the
[`automated-writer-isolation-model`](/research/automated-writer-isolation-model/) topic (report via
`relatedReport`). **The prep skeptic materially reshaped the cold scaffold:** the three "rungs" are *three
different archetypes*, and only one is a ratifiable new call — bundling them would smuggle a scope-reopen past the
incident's evidence.

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

The cold item framed one fork — "an escalation ladder; which rung, in what order." The standing test splits it
into **three archetypes**, and that split is the decision:

- **Rung 1 — non-destructive, changeset-scoped closeout** is a **forced invariant** (the dirty-tree-ownership
  branch is *broken* — it destroyed real work). This is the one genuinely-new ratifiable call.
- **Rung 2 — lane-isolate *all* automated writers** is **not a live fork** — it is **settled by #1933's scope
  decision** (`we:backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md:22-24`: *serial
  `/batch` on disjoint items is the day-to-day model; full isolation is the true-parallel path for when scale
  justifies it, **not** a prerequisite for normal batching*). Once Rung 1 holds, Rung 2 addresses **no residual
  incident harm**, so reopening that scope here would be a config-knob preference, not a merit call.
- **Rung 3 — observe-only main for visual work** is a **validation-gate** (a go/no-go on a candidate harness),
  verdict **not-yet**.

**Split the ratification:** ratify Rung 1 on its evidence; do **not** bundle Rung 2/3 — ratifying the ladder as
one unit smuggles a scope-reopen (Rung 2) and an unbuilt harness (Rung 3) past the incident that only proves
Rung 1.

## Recommended path at a glance

| Element | Archetype | Recommended call | Confidence |
|---|---|---|---|
| **Rung 1** — non-destructive, changeset-scoped closeout | **forced invariant** | **ratify** — act only on your own manifest; never revert/delete a file you didn't write; never read `git status` as ownership | high |
| **Rung 2** — lane-isolate all automated writers | settled by #1933 (non-fork) | **don't** — serial `/batch` + central steps keep writing the shared checkout, made safe by Rung 1; the proto-PR seam is a roadmap note under #1933 | high |
| **Rung 3** — observe-only main for visual work | **validation-gate** | **not-yet** — gated on a *falsifiable* per-lane multi-origin Playwright acceptance test (below) | med-high |

## Rung 1 — non-destructive, changeset-scoped closeout (forced invariant, ratify)

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

This ratifies the durable principle the memory rule already encodes
(`we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md:23` — *"durable until the #1985
rung-1 fix lands — and the principle holds after"*) and is the **codification target** of this decision.

`Skeptic: SURVIVES — the prep skeptic tried to demote it to "one option in a design space" (lock / commit-first);
both alternatives reduce to this invariant or need cooperation the incident proves absent, so it is genuinely
forced. Bonus the attack surfaced and was folded in: the manifest already existed in the ledger
(`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:276,750`) and the orchestrator's central
steps are read-only — so the destructive act was a main-agent prose closeout off `git status` despite a correct
ledger, proving the bug is the method.`

## Rung 2 — lane-isolate all automated writers (settled by #1933 — not a live fork)

**Classification: not a ratifiable fork here.** The cold scaffold proposed "generalize the #1933 clone model to
*every* automated writer (serial `/batch`, the orchestrator's central steps), default **adopt next**." The prep
skeptic **refuted** that default, on four grounds — folded here so the decision turn doesn't re-litigate:

1. **No residual harm to fix.** With Rung 1 in force, the incident's harm (destructive ops + dirty-read) is gone
   — and the item itself concedes concurrent commits to `main` are safe. The only thing left, a cross-session
   *read* hazard, is **exactly what Rung 1's "never read `git status` as ownership" already bans.** There is no
   third harm requiring serial `/batch` to run in a clone — the tell of a config-knob, not a merit fork
   (`we:.claude/agent-memory/fork-vs-config-classification-gate.md` — *two "branches" that are two values of one
   dial*).
2. **It reopens a ratified scope without new evidence.** #1933's *Scope decision (solo dev)*
   (`we:backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md:22-24`) already ruled serial
   `/batch` on disjoint items the day-to-day model and full isolation the *true-parallel* path "**not** a
   prerequisite for normal batching." The incident is about *closeout safety*, not serial-batch contention — so
   it is not the evidence that would justify revisiting that call.
3. **Proven cost, real DX harm.** Lane-ref push is a known-flaky tax — in the first green run **2 of 6 lanes
   failed to push and fell back to serial replay** (`we:.claude/agent-memory/parallel-workflow-blocked-by-git-guard.md:53-57`)
   — and Rung 2 would impose it on every serial batch that today commits to `main` cleanly, while **stranding
   automated work away from the single watched dev server** (HMR rooted at the primary checkout — the item's own
   argument against cloning humans, which applies hardest to serial `/batch`).
4. **Citation-scope.** The incident proves Rung 1 and nothing about serial batch (uninvolved) or the central
   steps (read-only, fine).

**Call: don't generalize.** Serial `/batch` and the orchestrator's central steps keep writing the shared
checkout, made safe by Rung 1. The one survivor is the **proto-PR-seam idea** (`lane/*` refs → branch→gate→
review→merge), which is real forward value (trunk-based dev + off-the-shelf branch protection, F4/F8-F10) — but
it belongs as a **roadmap note under #1933, gated on a future PR-flow decision that does not yet exist**, never a
Rung-2 "default adopt" bundled into this ratification.

`Skeptic: REFUTED the cold "default adopt next" → reclassified as settled-by-#1933 (non-fork), default "don't".
Grounds: Rung 1 leaves no residual incident harm (config-knob, not merit fork); reopens #1933's ratified
solo-dev scope (`we:backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md:22-24`) without
new evidence; proven lane-push-flakiness tax + DX strand from the watched server. Proto-PR seam survives only as
a separate roadmap note under #1933.`

## Rung 3 — observe-only main for visual work (validation-gate, not-yet)

**Why this isn't a classic fork, and is still a decision:** a one-sided go/no-go on a candidate mechanism (the
per-lane multi-origin dev server + headless before/after Playwright gate), no rival branch to weigh.

- **Verdict: not-yet (med-high).** Observe-only main is feasible *institutionally* — GitHub "require PR" / GitLab
  "Allowed to push: No one" *are* observe-only main (F8/F10) — but genuine per-lane **visual** rendering needs
  full clones with their own ports, because worktrees give code isolation, **not runtime** isolation (F1/F3/F7),
  and the visual class hinges on **cross-origin** behaviour (`.fui-card` lands only where the FUI registration
  ESM loads, `we:backlog/1895-the-fui-card-class-cross-origin-styling-on-non-fui-routes.md:18-31`; the vite proxy
  is a hand-maintained allowlist, `we:backlog/210-catalog-authoring-vite-proxy-allowlist.md:11-23`). Per-lane
  bring-up is "the constellation, not one `--port`" — WE + FUI origins up and wired per lane.
- **Un-gate trigger (sharpened from the cold "the harness is built" — the skeptic's amendment):** a
  **falsifiable acceptance test** — *a lane boots WE + FUI cross-origin and a headless Playwright run reproduces
  the #1895 transparent-`.fui-card` regression **and** its fixed pass, both from the CLI with no human screen.*
  This ties un-gating to the exact gross-regression class Rung 3 exists to catch and forecloses a half-built
  single-origin harness being declared "done."
- **Prior-art delta:** the institutional form exists off-the-shelf (F8-F10); the **multi-origin dev-server
  harness** is the WE-specific build, file it under #1933 / the explorer-judge epics (#1167/#1552). The human's
  eye still wins on design-quality nuance; Rung 3 reliably catches only the **gross-regression** class (a surface
  going transparent/unstyled is screenshot-obvious).

`Skeptic: SURVIVES-WITH-AMENDMENT — correct archetype (a real validation-gate, not a #1620 soft-park: it names a
concrete mechanism + dependency). The merit hit that landed: "build the harness" hid unbounded scope ("the
constellation, not one --port"), so the trigger is sharpened to the falsifiable #1895-reproduction acceptance
test above. Verdict NOT-YET held.`

## Considered and rejected (recorded)

- **Observe-only main for *humans too*, via clones** — strands interactive/visual work away from the watched dev
  server (HMR rooted at the primary checkout); steep DX tax, and the static gate can't certify visual
  correctness anyway. Rung 3's per-lane Playwright harness is the non-DX-breaking way to get the same guarantee
  for *automation*; humans keep the live checkout.
- **Branch-based isolation (feature branch in the live checkout)** — the normal PR-shop shape, would preserve
  HMR — but the #1153 branch guard denies branch creation in the shared checkout (forced clones over worktrees),
  so it isn't available without revisiting the guard; the clone + per-lane-port path (Rung 3) reaches the same
  end without touching it.

## Statute-overlap (reconciled here)

- **#1933 scope decision** (`we:backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md:22-24`)
  — Rung 2 would *reopen* it; this prep **defers to it** (don't generalize) rather than collide. Rung 1 is the
  genuinely-new part #1933 didn't cover (closeout safety).
- **Rule 105 — claim ignores git state** (`we:.claude/agent-memory/105-feedback_claim_ignores_git_state.md`) —
  *composes* with Rung 1: the dirty tree is the normal baseline (an argument *for* tolerating shared-checkout
  writes under a non-destructive closeout, against evicting them).
- **#083 file-lock coordination** (`we:backlog/083-agent-file-lock-coordination.md:155-167`) — Rung 1 is the
  no-bad-actor-needed form of #083's parked advisory lock; composes (status-claim + non-destructive discipline,
  not a hard lock).
- **#1153 branch guard / never-push-removed** — bound Rung 3's mechanism (clones over worktrees) and confirm
  shared-checkout commits to `main` are now allowed (so Rung 2's clone-isolation buys less than it did).

## Relationships

- **Extends** #1933 (clone model) — Rung 1 adds closeout safety #1933 didn't cover; Rung 2 defers to #1933's
  scope; Rung 3's harness files under #1933.
- **Roadmap note (Rung 2 survivor):** the proto-PR seam (`lane/*` → review→merge) → a future PR-flow decision
  (none exists yet), filed under #1933.
- Motivating incident recorded in `we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md`
  and the new `we:reports/2026-06-30-automated-writer-isolation.md`.
