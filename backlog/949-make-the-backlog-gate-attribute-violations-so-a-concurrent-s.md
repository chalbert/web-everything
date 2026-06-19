---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: 952
codifiedIn: "one-off"
preparedDate: "2026-06-18"
relatedReport: "reports/2026-06-18-gate-violation-attribution.md"
tags: [backlog, gate, concurrency, batch, tooling, decision]
---

# Make the backlog gate attribute violations so a concurrent session's active item can't red another session

The whole-repo gate runs over the shared working tree, so another session's mid-build `active` item trips it as **your** red; decide how to attribute violations to their owning work so only **your** set blocks you.

## Grounding digest

Concurrent agent sessions share **one filesystem and one git working tree** (solo-dev, single-checkout — no per-session worktree). Each claims its own items and commits per-finished-item, often straight to `main`, so at any instant the tree holds `HEAD` (clean) **+ the union of every live session's uncommitted edits**. Two gates run over that tree:

- **`check:standards` — whole-repo, file-keyed (the hard target).** Exits `1` on *any* error ([we:scripts/check-standards.mjs:930](../scripts/check-standards.mjs#L930)); each finding is `{ message, descriptor? }` ([:46-49](../scripts/check-standards.mjs#L46-L49)) and the descriptor carries only a file path (`location: { path }`, [:903](../scripts/check-standards.mjs#L903)) — **never a backlog id or session**. So session B's in-flight file (an untracked `#664`-style wiki-link, an unregistered report) reds session A. This is the gate the red-stop rule's worked examples actually hit.
- **`check:health` — backlog-DAG, already item-keyed (the easy half).** Findings already carry the owning id (`flags = { G1..G6, D1..D3 }`, each entry `{ id: item.id, … }`, [we:audit-backlog-health.mjs:278](../scripts/audit-backlog-health.mjs#L278)), and it already shells to git ([execFileSync :52](../scripts/audit-backlog-health.mjs#L52)/[:225](../scripts/audit-backlog-health.mjs#L225)). It even already does an **INFO-vs-FAIL partition on one rule** — G1 demotes resolved-both-ends edges to non-blocking `INFO` ([:394](../scripts/audit-backlog-health.mjs#L394)). So a scope here is trivial: filter by your claimed ids.

Today the triage is **manual** (memory `gate-red-stop-scoped-to-own-work`): grep the errors + `git status`, and if the red implicates only another session's files, step over it. #949 makes that **deterministic in the gate**.

**No file→item map exists.** Frontmatter tracks `graduatedTo`/`blockedBy`/`relatedProject` but no `touches`/`files` ([we:scripts/backlog/frontmatter.mjs:128](../scripts/backlog/frontmatter.mjs#L128)). The only per-session state is the #083 reservation registry — soft *item-number* holds keyed by `session`, TTL-pruned ([we:reservations.json](../.claude/skills/batch-backlog-items/reservations.json), written by `reserve --session=<slug>` [we:backlog.mjs:122](../scripts/backlog.mjs#L122)); `claim` records status but **not** an owning session ([we:backlog.mjs:87](../scripts/backlog.mjs#L87)). Statuses are a closed set ([we:check-standards-rules.mjs:20](../scripts/check-standards-rules.mjs#L20)); `active` already means "mid-build, transient inconsistency expected".

## The axis — and why off-the-shelf "changed files" doesn't drop in

Three decoupled questions: **(1)** solve this *in* the gate or *around* it (isolation)? **(2)** if in-gate, what signal tells the gate which findings are *mine*? **(3)** what does the gate then do with that — change the exit, or just annotate?

The prior-art survey (full report in `relatedReport`) is rich — Nx `affected` (changed files vs a base ref → affected subset), reviewdog `-filter-mode` (`file`-mode = whole file for any changed file), Android Lint / betterer baselines (fail only on *new*), lint-staged (staged paths only), CODEOWNERS (declared path→owner). **The load-bearing mismatch:** every one assumes a *single actor against a clean base ref*, so `git diff` vs `HEAD` *is* "my change." Our reality is **N actors sharing one dirty tree with no per-actor branch**, where `git diff` vs `HEAD` is the *union* of everyone's edits — exactly the over-attribution we're undoing. Recovering "mine" needs extra per-session state the single-actor tools never carry — **or** the structural move of isolating each session into its own worktree (the option the item's "make the gate attribute" framing didn't name; the survey surfaced it).

Classification: all of this is **repo-internal devtools / workflow tooling**, not a WE standard (`impl-is-not-a-standard`, `minimize-lock-in` — no protocol minted). A correctness gate's safe default is **strict** (fail-on-any); the scoping relaxation is an **opt-in per-run flag** (a dimension, never baked) so CI / close-out keep catching everything.

## Recommended path at a glance

| Fork | Question | Recommended default | Confidence |
|---|---|---|---|
| 1 | Strategy — solve in-gate or around it? | **A — in-gate attribution** (preserve shared-tree workflow) | ~80% |
| 2 | Attribution signal — how does the gate know which findings are mine? | **A — per-session git baseline snapshot at `claim`** (derived, not declared) | ~75% |
| 3 | Gate behavior — what does it do with attribution? | **A — `--scope` filter mode; default no-flag run unchanged** | ~85% |

## Fork 1 — strategy: in-gate attribution vs worktree isolation

*Fork-existence:* a genuine either/or — both are coherent end-states that solve the same problem two incompatible ways; you build one. The excluded branch under the default is **isolation**, ruled out as the heavier structural change for a single-tree, running-dev-server, commit-to-`main` reality (not *broken* — escalation-worthy if A proves too leaky).

- **A (recommended, ~80%) — attribute in-gate.** Teach the gate to partition findings by owning work (the item's literal ask). Preserves the established **shared single working tree + the running HMR dev server in that tree + per-item commit-to-`main`** workflow (memories `dont-kill-dev-server`, `commit-to-default-branch-ok`, `claim-ignores-git-state`); adds scoping logic only. Reuses the existing G1 INFO-vs-FAIL partition mechanism ([we:audit-backlog-health.mjs:394](../scripts/audit-backlog-health.mjs#L394)).
- **B — worktree-per-session isolation.** Each concurrent session runs in its own git worktree (the `Agent` tool already supports `isolation: worktree`); the gate stays whole-repo-strict but only sees that session's changes — **no gate changes at all, standard tooling Just Works.** Cleaner in principle, but: HMR/dev-server live in the *main* tree only, shared `backlog/*.md` just moves the conflict to merge time, and per-item commit-to-`main` needs a merge-back step. Heavier workflow change → the escalation, not the default.

> ⚠️ **Avoid:** scoping by committed state only (`git stash` then check). That also blinds the gate to *your own* uncommitted work — defeating the point of running it mid-batch.

## Fork 2 — attribution signal (live only if Fork 1 = A)

*Fork-existence:* a real either/or — these are mutually-exclusive *primary* sources of truth for "which files are mine"; one backs the gate, the others can't simultaneously be authoritative. The excluded branch under the default is the **declared manifest**, ruled out as *drift-prone* (declared ≠ actual edits — against the standing derive-from-state bias), not merely less convenient.

For `check:standards` (file-keyed) the gate needs a **file→ownership** signal; for `check:health` (item-keyed) "mine" is just your claimed ids, so this fork is really about the file gate.

- **A (recommended, ~75%) — per-session git baseline snapshot at `claim`.** `claim` records `git status --porcelain` (the set already dirty = everyone else's in-flight + pre-existing) into per-session state alongside the #083 registry. "Mine" = files dirty *now* but not in that baseline. **Derived from the actual edits, no frontmatter to drift**; fails *safe* — a concurrent session newly-dirtying a file inside my window leaks into "mine" (an over-cautious stop, never a foreign red mistaken for clean). Mirrors Nx `affected` / reviewdog `file`-mode with the base ref replaced by a per-session snapshot. Same write also stamps the **owning session/ids** on `claim` (mirroring `reserve --session`, [we:backlog.mjs:122](../scripts/backlog.mjs#L122)), which gives `check:health` its item-id scope for free — superseding the lighter "pass `--mine=NNN` on the CLI" idea, since we're writing claim-time state anyway.
- **B — declared per-item file manifest** (`touches:`/`owns:` frontmatter, CODEOWNERS-style). Explicit, human-legible, survives across sessions — but **declared, not derived**: a new file you forgot to list still reds you, a stale entry mis-attributes. Runs against the repo's derive-ownership-from-state bias. *Excluded branch.*
- **C — session file-claim registry.** Extend `we:reservations.json` (already session-keyed, TTL-pruned) to record each edited file via a `PostToolUse` hook on Edit/Write. Most precise (no snapshot-diff race), but adds hook infrastructure + an orphan-claim cleanup concern on a dead session (the TTL prune mitigates). The **precision upgrade if A's in-window leak proves to bite** — kept as a follow-up, not the default.

## Fork 3 — gate behavior: what it does with attribution

*Fork-existence:* a real either/or on the exit contract — "still fail on everything" and "fail only on mine" cannot both be the behavior; you pick one. The excluded branch under the default is **annotate-only**, ruled out as *not meeting the requirement* (you still go red), and the **ratchet** as *solving a different problem* (temporal, not by-owner).

- **A (recommended, ~85%) — `--scope`/`--mine` filter mode.** A flag partitions findings; exit `1` only if a *my-scope* error exists, external errors printed as non-failing notes (generalising the G1 INFO partition onto an ownership axis). **The default no-flag run stays whole-repo-strict** — CI / close-out unchanged. The literal #949 ask; changes the gate's *attribution*, not its *strictness* (your own work stays fully gated).
- **B — baseline ratchet** (Android-lint / betterer shape). Accept current reds as a baseline, fail only on new. **Wrong axis:** separates old-vs-new in *time, globally*, not mine-vs-theirs by *owner* — a concurrent session's brand-new red is "new" and still reds you. Plus the baseline file is shared mutable state across sessions (write races). *Excluded branch.*
- **C — annotate-only.** Tag each finding with its owner but leave the exit code alone. Strictly weaker than A — you still go red, so "only your set blocks you" is unmet. *Excluded branch.*

## Supported by default (not forks)

- **Both gates get scoped, but `check:standards` is the hard target.** `check:health` reuses Fork 3's scope mode keyed directly on item-id (findings already carry `id`) — no file map needed. Which to *build first* is **prioritization, not a fork** (`fork-is-not-a-prioritization-tool`): `check:standards` is where the cross-session reds actually land (the #664 worked examples), so it leads.
- **Scope granularity is the session's whole claimed set**, which the claim-time baseline (Fork 2-A) yields naturally — not per single item.

## RATIFIED ruling — 2026-06-18

All three prep defaults ratified. Builds → **#952** (`check:standards` `--scope` mode + claim-time baseline, the lead build) and **#953** (Fork 2-C session file-claim registry, deferred precision upgrade, blockedBy #952).

- **Fork 1 → A — in-gate attribution. (~85%, up from prep's 80%.)** The decisive point prep undersold: the real concurrent actors are **top-level Claude Code sessions**, not `Agent`-tool subagents, so the worktree-isolation primitive the survey leaned on (`isolation: worktree`) doesn't apply to the actual concurrency model. B would force each chat into its own worktree with a per-worktree dev server + manual merge-back to `main`, breaking the verify-against-live-:8080 loop (`webeverything-dev-ports`, `dont-kill-dev-server`). B's isolation mechanism is a mismatch for the actor model, not merely heavier. Escape hatch if A proves too leaky: isolation (a workflow rewrite, not a flag).
- **Fork 2 → A — claim-time git baseline snapshot + owning-session stamp. (~75%.)** Derived-not-declared, no frontmatter drift, reuses the registry write. **Sharpened residual (beyond prep's fail-safe leak):** the dangerous direction is **fail-*unsafe*** — a file already dirty at my claim (so in my "theirs" baseline) that **I then also edit** gets mis-attributed as foreign and stepped over (building on a real red I think is someone else's). Bounded, not open: it requires both sessions editing the *same* file, and for `backlog/*.md`/reports — the files that actually trip `check:standards` — claim-ownership gives one active owner per item, so the overlap is mostly shared data JSONs (which rarely trip rules). Fork 2-C (**#953**) is the precision fix if it bites.
- **Fork 3 → A — `--scope` filter mode, default run unchanged. (~90%.)** Default no-flag run stays whole-repo-strict (CI/close-out catch everything); scoping is an explicit per-run opt-in — the correct posture for a correctness gate. Ratchet solves a temporal problem, annotate-only doesn't meet the requirement.
- **Supported (not forks):** `check:health` reuses Fork 3's scope mode keyed on claimed item-id (findings already carry `id`); `check:standards` scoping is built first (where cross-session reds land). Granularity = the session's whole claimed set.

Reversible per `ratified-decisions-are-reversible-stay-agile` — reopen→re-run the gate, record lineage; if A's attribution proves too leaky escalate to Fork 1-B (isolation).
