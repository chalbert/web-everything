# Automated-writer isolation & non-destructive closeout — prep research for #1985

**Decision:** [#1985](../backlog/1985-where-work-happens-isolate-automated-writers-in-lanes-non-de.md) ·
extends [#1933](../backlog/1933-multi-clone-central-push-retry-parallel-batching-replace-gua.md) (clone model,
resolved) · relatedItems #083, #1933 · 2026-06-30 · research topic:
[`automated-writer-isolation-model`](../src/_data/researchTopics/automated-writer-isolation-model.json).

## Why this report exists

A real incident (`batch-2026-06-29e`): a `/workflow` closeout ran in the **shared primary checkout**, diffed the
**dirty working tree** to infer "its own residue", mis-read a concurrent `/prepare` session's in-progress #1983
files as residue, and `git checkout`/`rm`'d them — no permanent loss only by luck (`we:backlog/1985-…:17-35`;
`we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md`). The item asks how much of the
constellation's work must run **isolated** and what the automated closeout may touch. Prep grounds the three
"rungs" against the real tree + SE practice and classifies each by archetype.

## In-repo grounding (verified)

- **#1933 clone model (built, proven):** each lane is its own clone with its own HEAD, pushes
  `git push origin HEAD:lane/<slug>-<n>`; a central integrator `git fetch origin "lane/*"` → merges each into
  `main` one-at-a-time with a full gate, rebase-and-retry (never force) — `we:backlog/1933-…:20,29,30`. Proven
  WE-only (batch-2026-06-29b, 5/6 resolved, 0 stranded) — `we:.claude/agent-memory/parallel-workflow-blocked-by-git-guard.md:42-57`.
  Lane refs can **fail to push and fall back to serial replay** — same note `:53-57` (proven, not yet reliable).
- **#1153 branch guard:** the global branch-guard hook denies `git switch`, `git worktree add`, and
  `git checkout -b/-B` in the shared checkout (which forced clones over worktrees) — `we:backlog/1153-…:18,71-83`.
  Push to `main` is **now allowed**; broad-stage (`git add -A`) **still denied**
  (`we:.claude/agent-memory/never-push-guard-removed.md:10-26`).
- **Ownership rules:** claim ignores git state — ownership is `status: active`, never the tree (rule 105,
  `we:.claude/agent-memory/105-feedback_claim_ignores_git_state.md:10-14`); closeout never infers ownership from
  the dirty tree, "Durable until the #1985 rung-1 fix lands — and the principle holds after"
  (`we:.claude/agent-memory/closeout-never-infers-ownership-from-dirty-tree.md:23`).
- **#083 file-lock coordination (ratified):** the repo's coordination is **item-level advisory claiming +
  status-flag claims**; fork 6 ratified that the 2025-26 multi-agent consensus routes **around** file locks via
  worktrees/clones + status claims — `we:backlog/083-agent-file-lock-coordination.md:155-167,265-295`.
- **Rung-3 blocker (#210 / #1895 / #1982):** the vite proxy is a hard-coded allowlist a new route 404s against
  until hand-added (`we:backlog/210-…:11-23`); `.fui-card` lands **cross-origin only where the FUI registration
  ESM loads**, not on `/backlog/` (`we:backlog/1895-…:18-31`, `:66-70`), and #1895 is `blockedBy: 1982`
  (`we:backlog/1895-…:8`). So per-lane visual rendering needs **WE + FUI origins up and wired per lane** — "the
  constellation, not one `--port`" (`we:backlog/1985-…:66-74`).
- **No PR-flow / observe-only-main item exists** — the concept lives only inside #1985 (`:53-64`); the
  `we:docs/agent/platform-decisions.md:898-901` "observe-only" hits are unrelated (web-standard posture).

## Prior-art survey (SE practice — full findings in the research topic)

- **F1/F2** — git worktrees share the object store/refs/config (only HEAD/index are per-worktree) and refuse to
  check out a ref already checked out elsewhere; a full clone avoids both — git-scm.com/docs/git-worktree.
- **F3/F7** — worktrees give *code* isolation, **not runtime** isolation (shared object store / DB daemon can
  still corrupt) — *blog-level, practice signal*. Why rung 3 needs full clones+ports, not just a branch.
- **F4/F5** — trunk-based development = short-lived single-owner branches converging to main via a review+CI
  gate (trunkbaseddevelopment.com, atlassian.com). The faithful map for `lane/*` as **proto-PR units**.
- **F6** — 2024-26 AI-agent norm: each agent gets its own working dir+index (own branch/path) to avoid
  file-level collisions — *blog-level*. The design space #1985 sits in.
- **F8/F9/F10** — GitHub branch protection / rulesets ("require PR + status checks", "restrict who can push")
  and GitLab "Allowed to push: No one" **are** the institutional "observe-only main" — docs.github.com,
  docs.gitlab.com.
- **F11/F12** — Terraform state is "a snapshot after the last apply, **not** a live representation"; plan→apply
  enacts exactly the recorded diff, idempotently — developer.hashicorp.com. The canonical "act on your recorded
  changeset, never read ambient live state as truth" — **exactly rung 1**.

## What this means for the decision (per archetype)

- **Rung 1 — non-destructive, changeset-scoped closeout = a forced invariant.** The excluded branch
  (infer-ownership-from-dirty-tree) is *broken* — it destroyed real work, and the memory rule already encodes
  the principle as durable. Terraform's plan→apply (F11/F12) is the industry-standard shape. Ratify.
- **Rung 2 — lane-isolate all automated writers = a merit fork.** Backed by trunk-based dev (F4/F5) + the
  off-the-shelf branch-protection gate (F8-F10) you'd wire onto `lane/*` rather than invent. The honest
  counter-weight the skeptic must test: once Rung 1 makes closeout non-destructive, the *destructive* harm is
  gone — what's left is the cross-session *read* hazard + the proto-PR seam's forward value, against clone
  latency + the proven lane-ref→serial-fallback.
- **Rung 3 — observe-only main = a validation-gate, not-yet.** Feasible institutionally (F8/F10) but genuinely
  gated on the per-lane **multi-origin** harness (F1/F3/F7 — worktrees don't give runtime isolation; the
  #210/#1895 cross-origin FUI wiring is the real cost). Concrete trigger, not a #1620 soft-park.

## Skeptic pass (folded into the item — one default flipped, one trigger sharpened)

The prep skeptic materially reshaped the item:

- **Rung 1: SURVIVES** (forced invariant). It tried to demote it to "one option in a design space" (a lock /
  commit-first); both alternatives reduce to this invariant or need cooperation the incident proves absent. Bonus
  the attack surfaced: the manifest already existed in the ledger
  (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:276,750`) and the central reconcile steps
  are read-only — so the bug is the *method*, not a missing input.
- **Rung 2: REFUTED** the cold "default adopt next" → reclassified as **settled by #1933** (a non-fork), default
  "don't generalize." Rung 1 leaves no residual incident harm (a config-knob, not a merit fork); generalizing
  reopens #1933's ratified solo-dev scope (`we:backlog/1933-…:22-24`) without new evidence; it carries a proven
  lane-push-flakiness tax + a DX strand from the watched dev server. The proto-PR seam survives only as a roadmap
  note under #1933.
- **Rung 3: SURVIVES-WITH-AMENDMENT** (validation-gate, not-yet). The "build the harness" trigger hid unbounded
  scope, so it is sharpened to a *falsifiable* acceptance test (reproduce the #1895 cross-origin
  `.fui-card` regression headlessly from the CLI).
- **Cross-cutting:** the item bundled a proven-needed invariant (Rung 1) with a scope-reopen (Rung 2); ratify
  Rung 1 alone — don't let the ladder smuggle Rung 2/3 past the incident's evidence.
