# Gate-violation attribution — so a concurrent session's in-flight work can't red yours

> Prep research for decision **#949**. Grounds the fork over how the backlog gate
> (`check:standards`, secondarily `check:health`) should tell *your* violations apart from a
> concurrent session's, so that "gate red" only stops you when the breakage is yours.

## The problem, precisely

Two (or more) agent sessions share **one working tree** in this repo. Each claims its own backlog
items (`status: active`/`preparing`) and edits files; commits land per-finished-item, often straight to
`main` (solo-dev practice). So at any instant the working tree holds: committed history (`HEAD`, the
clean baseline) **+ the union of every live session's uncommitted edits**.

`check:standards` is a **whole-repo, read-only** scan that exits `1` on *any* error
([we:scripts/check-standards.mjs:930](../scripts/check-standards.mjs#L930)). It has no notion of *whose*
change a violation belongs to — each finding is `{ message, descriptor? }`
([:46-49](../scripts/check-standards.mjs#L46-L49)) and the descriptor carries only a file path
(`location: { path }`, [:903](../scripts/check-standards.mjs#L903)), never a backlog-item id or session.
So when session B is mid-build on its item and its in-flight file trips a rule, session A's gate run goes
red too — and the existing rule (memory `feedback_gate_red_stop_scoped_to_own_work`) says a red purely
from *another* session's files must be **stepped over, not stopped on**. Today that triage is **manual**:
"grep the error lines, `git status`, do any errors name a file in *this* session's changeset?" #949 asks
to make that attribution **deterministic** so only your set blocks you.

`check:health` ([we:scripts/audit-backlog-health.mjs](../scripts/audit-backlog-health.mjs)) is the inverse:
its findings are **already keyed by backlog-item id** (`flags = { G1..G6, D1..D3 }`, each entry
`{ id: item.id, … }`, [:278](../scripts/audit-backlog-health.mjs#L278), [:295](../scripts/audit-backlog-health.mjs#L295)),
and it already shells out to git for build-order history
([execFileSync :52](../scripts/audit-backlog-health.mjs#L52), [:225](../scripts/audit-backlog-health.mjs#L225),
[:232](../scripts/audit-backlog-health.mjs#L232)). So health-gate attribution is the *trivial* half
(filter by your claimed item ids); the hard half is `check:standards`, which is file-keyed.

There is **no file→item mapping** in the repo today. Frontmatter tracks
`graduatedTo`/`blockedBy`/`relatedProject`/`relatedReport` but no `touches`/`files`
([we:scripts/backlog/frontmatter.mjs:128](../scripts/backlog/frontmatter.mjs#L128)). The only per-session
state is `we:reservations.json` — soft *item-number* holds keyed by `session`, with a TTL so a crashed
session's holds expire ([we:.claude/skills/batch-backlog-items/reservations.json](../.claude/skills/batch-backlog-items/reservations.json),
[we:scripts/readiness/reservations.mjs](../scripts/readiness/reservations.mjs)) — advisory, never consulted
by either gate.

## Why the standard "changed-files" tooling doesn't drop in cleanly

The obvious move — "scope the gate to changed files" — is a solved problem in single-actor CI, and the
prior art is rich:

- **Nx `affected`** — git computes changed files vs a **base ref** (default `main`), the project graph
  expands them to affected projects, tasks run only on those. Base/head are explicit
  (`--base=main~1 --head=HEAD`); `--files` overrides when git isn't usable.
  ([nx.dev/docs/features/ci-features/affected](https://nx.dev/docs/features/ci-features/affected))
- **reviewdog `-filter-mode`** — `added` (default; only added/modified lines), `diff_context`,
  **`file`** (whole file for any changed file), `nofilter`. The linter still scans everything; findings
  are *filtered* to the diff before they fail/comment.
  ([github.com/reviewdog/reviewdog](https://github.com/reviewdog/reviewdog))
- **Android Lint baseline / betterer** — snapshot current violations into `lint-baseline.xml`; later
  runs report **only new** issues. A *temporal* ratchet over legacy debt.
  ([developer.android.com/studio/write/lint](https://developer.android.com/studio/write/lint),
  [Android baselines](https://googlesamples.github.io/android-custom-lint-rules/usage/baselines.md.html))
- **lint-staged** — run linters only over git-staged paths (the per-commit changed set).
- **CODEOWNERS** — a declared path→owner map (the "manifest" family).

The load-bearing mismatch: **every one of these assumes a single actor working against a clean base ref
(a PR branch, a feature branch).** `git diff vs HEAD` then *is* "my change." Our problem is the opposite:
**N actors sharing one dirty working tree with no per-actor branch.** `git diff vs HEAD` yields the
*union* of all sessions' edits, which is exactly the over-attribution we're trying to undo. So recovering
"mine specifically" needs *extra* per-session state that single-actor tooling never needs — **or** a
structural change that gives each session its own clean base.

That observation reshaped the fork: the survey surfaced a strategy the item's framing ("make the gate
attribute") didn't name — **isolate sessions into separate git worktrees** so naive whole-repo gating
*already* sees only that session's work. That becomes the top-level fork (attribute vs isolate); the
attribution mechanics become its sub-forks.

## Three families of mechanism (if we attribute in-gate)

1. **Working-tree diff vs a per-session baseline.** At `claim`, snapshot `git status --porcelain`
   (the set already dirty = everyone else's in-flight + pre-existing). "Mine" = files dirty *now* but not
   in that baseline. Derives ownership from the *actual edits*, no declared list to drift. Residual: a
   concurrent session that newly-dirties a file *inside my window* leaks into "mine" — but that fails
   **safe** (an over-cautious stop, never building on a foreign red mistaken for clean). Closest prior
   art: Nx `affected` / reviewdog `file`-mode, with the base ref replaced by a per-session snapshot.
2. **Declared per-item file manifest** (`touches:`/`owns:` frontmatter, CODEOWNERS-style). Explicit and
   human-legible, survives across sessions. But it is **declared, not derived** → it drifts: a new file
   you forgot to list still reds you; a stale entry mis-attributes. Runs against the repo's standing
   "derive batchability/ownership from state, never a hand-maintained tag" bias.
3. **Session file-claim registry** — extend `we:reservations.json` (already session-keyed, already
   TTL-pruned) to record each edited file against the session via a `PostToolUse` hook on Edit/Write.
   Most precise (no snapshot-diff race), but adds hook infrastructure and an orphan-claim cleanup concern
   when a session dies (mitigated by the existing TTL prune).

## What the gate then *does* with attribution

- **Scope-filter mode** (reviewdog `filter-mode` shape) — a `--scope`/`--mine` flag partitions findings;
  exit `1` only if a *my-scope* error exists, external errors printed as non-failing notes. The default
  no-flag run stays whole-repo-strict (CI / close-out unchanged). This is the literal #949 ask.
- **Baseline ratchet** (Android-lint shape) — accept current reds as a baseline, fail only on new. Wrong
  axis for *this* problem: it separates **old vs new in time, globally**, not **mine vs theirs by
  owner** — a concurrent session's brand-new red is "new" and still reds you. A coherent tool for legacy
  debt, not for concurrency attribution. Also: the baseline file is shared mutable state across sessions
  (write races).
- **Annotate-only** — tag each finding with its owner but leave the exit code alone. Strictly weaker than
  scope-filter: you still go red, so "only your set blocks you" is not met.

## Classification (per-fork pass)

- **Layer.** All of this is **repo-internal devtools / workflow tooling** (`scripts/*` + the
  `we:docs/agent/backlog-workflow.md` "stop rule") — *not* a Web Everything standard artifact. Per
  `impl-is-not-a-standard` and `minimize-lock-in` (devtools = zero lock-in), no protocol/intent is minted.
- **Default posture for a gate.** The most-permissive-default rule inverts for a *correctness gate*: the
  safe default is **strict** (fail on any), and the relaxation (scoping) is an explicit per-run **opt-in
  flag** — a dimension, never baked. CI and close-out must keep catching everything.
- **Derive-from-state bias.** Favours the git-snapshot signal (1) over the declared manifest (2): the
  same principle that says batchability/ownership must be read from real state, not a hand-kept tag.
- **Separation bias.** Keep the *signal* (how we know "mine") and the *behavior* (what the gate does with
  it) as two decoupled forks — burden of proof is on combining them.

## Synthesis handed to #949

- **Fork 1 (strategy): in-gate attribution vs worktree-per-session isolation.** Recommend **in-gate
  attribution** (~80%) — it's the item's ask and preserves the established shared-tree + running-dev-server
  + commit-to-`main` workflow; isolation is a heavier structural change (HMR/dev-server live in the main
  tree, merge-back overhead) kept as the escalation if attribution proves too leaky. Residual: isolation
  is genuinely cleaner *in principle* (standard tooling Just Works) and the `Agent` tool already supports
  `isolation: worktree`.
- **Fork 2 (signal): per-session git baseline vs declared manifest vs session file-registry.** Recommend
  the **per-session git baseline snapshot at `claim`** (~75%) — derived-not-declared, no new frontmatter,
  fails safe. Residual: the in-window leak; the registry (3) is the precision upgrade if that bites.
- **Fork 3 (behavior): scope-filter vs baseline-ratchet vs annotate-only.** Recommend the
  **scope-filter `--scope` mode**, default no-flag run unchanged (~85%) — the other two either solve a
  different problem (ratchet) or don't meet the requirement (annotate-only).
- **Supported by default (not forks):** `check:health` reuses Fork 3's scope mode keyed directly on
  item-id (its findings already carry `id`), so it needs no file mapping; scope granularity is the
  **session** (its whole claimed set), which the baseline snapshot yields naturally.
