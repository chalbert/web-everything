# Backlog split analysis — #3006, informed by the token-optimisation research

**Date:** 2026-09-06 · **Candidate:** #3006 *Move agent work onto the Claude Code CLI and optimise what it costs*
(kind `epic`, `size: 13`, `status: open`, no children — unsliced epic, candidate kind **b**).

This run pairs the standard investigation pass with a wide token-optimisation research sweep completed the same
session (six parallel streams; published as the *Token Leverage Ladder* brief). The research changes the slicing
materially, because **three of the epic's six proposed slices are wrong about the current tree.**

---

## What the investigation found that the epic's body does not know

The body was written 2026-08-08. Four of its load-bearing premises are now stale.

| The body says | The tree says | Consequence |
|---|---|---|
| Slice 1 must build "a re-runnable measurement harness" | [`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs) already is one (#3028) — two-arm, conditions-stamped, reads the CLI's own `usage` block | Slice 1 shrinks from *build a harness* to *add one arm* |
| Slice 2 must build "the review invocation wrapper: frozen prefix, diff on stdin, model by care level" | [`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) `buildJudgeArgv` (line 502) already does all four for **jurors**: stable mandate via `--append-system-prompt`, judged input on **stdin**, per-lens `model` + `effort`, deterministic `--session-id` | Slice 2 is not "build it" but "bring the *other* call site onto it" |
| #2844 is "coming, not yet in force"; its PR #1100 is open | **#2844 is `resolved`** | The forcing function has already fired — this is now overdue work, not anticipatory work |
| Slice 5 is gated on the mechanics-vs-judgment boundary | **#2701 is `resolved`** | Slice 5's fork is decided; one concrete piece of it is now carvable |

Two further findings from the tree, both of which become slices:

- **The cache split is computed and then thrown away.** [`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) line 696
  sums `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` into a single "loaded context"
  number. Every input the epic's central question needs — *reads per write* — passes through that line and is
  discarded. This is the smallest, highest-leverage change on the board.
- **The operator dispatch spawn is the un-optimised twin of the juror spawn.**
  [`we:scripts/operator/dispatch.mjs`](../scripts/operator/dispatch.mjs) line 401 spawns
  `claude -p --permission-mode bypassPermissions <prompt>` with the **whole variable prompt as a positional
  argv**, no `--model`, no `--effort`, no `--session-id`, and the full tool set. Every fix and review agent in
  the operator loop takes this path. Against `buildJudgeArgv` it is a byte-unstable prefix by construction.

### What the research contributes

The research answers four of the epic's five stated open questions outright, and **reframes the fifth**:

- *Q2, one prefix or several* — the epic frames this as the open question. Minimum cacheable prefixes are only
  512–4,096 tokens, so several specialised prefixes each clear the bar comfortably; prefix **count** is not the
  constraint. The real constraint is **reads-per-write within the TTL** — a prefix used twice an hour on a
  5-minute TTL never reads warm. That is a different measurement than the one the epic proposes, and it is what
  slice B below actually measures.
- *Q5, can a cheap model pre-filter for an expensive one* — the research argues **against** the cascade:
  caches are model-scoped, so a two-model cascade forfeits cache reuse across its models, a cost absent from
  nearly every published cascade evaluation. Anthropic's measured alternative (low effort, re-run failures)
  held quality at half the cost inside one model, and therefore one cache namespace. **This contradicts the
  framing of #3369** (*Decouple agent dispatch — multi-provider abstraction*), which motivates itself partly on
  "every task pays for the same tier of model regardless of how hard it actually is". That is a genuine fork
  between two open items, so per the rubric it is carved as its own `kind: decision` card, not buried.

---

## Could split — #3006 → six children

| # | Slice | kind · size | Predicted `scope:` | blockedBy |
|---|---|---|---|---|
| A | Expose the cache split instead of collapsing it | `task` · 2 | `we:scripts/lib/judge-spawn.mjs` | — |
| B | Warm-prefix reuse arm for the spawn harness | `story` · 3 | `we:scripts/measure-judge-spawn.mjs` | A |
| C | Bring the operator dispatch spawn onto the judge-spawn argv contract | `story` · 5 | `we:scripts/operator/dispatch.mjs` | — |
| D | Skip a re-review when the reviewed-diff fingerprint is unchanged | `story` · 3 | `we:scripts/operator/dispatch.mjs`, `we:scripts/lib/review-escalation.mjs` | C |
| E | Accrue per-invocation cost and cache split onto the lane record | `story` · 3 | `we:scripts/lib/judge-spawn.mjs`, `we:scripts/backlog.mjs` | A, #2858 |
| F | Effort dial or model cascade — rule the cost-tiering fork | `decision` | — | — |

**The DAG.** `A → B`, `A → E`, `#2858 → E`, `C → D`; `A`, `C` and `F` have no prerequisites.
Three independent entry points satisfies rubric (4) comfortably, and every slice ships valid alone.

### Why each slice is what it is

**A · Expose the cache split** — `task · 2`. [`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs)
line 696 returns one summed number; return the three components alongside it and leave the existing sum in place
for its current callers. Pure, unit-testable, touches one file. It is the prerequisite for any cache measurement
at all, which is why it leads the DAG despite being the smallest item on it.

**B · Warm-prefix reuse arm** — `story · 3`, blockedBy A. [`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs)
already runs `--repeat` pairs with a fresh session per arm. Add an arm that holds the prefix byte-identical
across iterations and reports **reads per write** and cache hit rate, stamped with the same conditions block.
This is the arm that answers Q2 as re-framed above. Deliberately scoped to the harness file only, so it does not
serialize against A.

**C · Dispatch onto the argv contract** — `story · 5`. Bring
[`we:scripts/operator/dispatch.mjs`](../scripts/operator/dispatch.mjs) line 401 onto the same shape
`buildJudgeArgv` already proves: stable instruction via `--append-system-prompt`, variable prompt on **stdin**
rather than positional argv, explicit `--model`/`--effort`, deterministic `--session-id`. The `--bare` trap is
already documented in the judge-spawn header (it never reads OAuth, so it needs `ANTHROPIC_API_KEY`) — that
answers the epic's open worry about `--bare` without needing a measurement. Sized 5 because the spawn is
detached with a lease and a claim file, so the change is not a one-liner.

**D · Fingerprint short-circuit** — `story · 3`, blockedBy C (shares `we:scripts/operator/dispatch.mjs`). The machinery exists:
`parseReviewedDiff` / `acceptanceCoversHead` in
[`we:scripts/lib/review-escalation.mjs`](../scripts/lib/review-escalation.mjs), consumed by
[`we:scripts/merge-ai-prs.mjs`](../scripts/merge-ai-prs.mjs) at line 4001. The gap is that it gates the *merge*,
not the *review dispatch* — which is exactly the epic's observed failure ("several PRs fully re-reviewed after a
push touching only a backlog card"). The cheapest review is the one not run; this is plausibly the largest single
saving in the epic and it is not a token optimisation at all.

**E · Cost and cache accrual** — `story · 3`, blockedBy A and **#2858**. #2858 records that no card has ever
carried a cost since the lane-only guard landed, so accrual is genuinely blocked upstream. With A landed, what
gets accrued is the honest three-way split rather than a single opaque number.

**F · The tiering fork** — `kind: decision`. Rubric (1) forbids splitting a decision away into build slices, and
this fork spans two items (#3006 and #3369). Carve it, point both at it, and de-bury it from #3369's body.

---

## Could not split — three rows deferred with their unblocking action

| Row from the epic body | Rubric condition failed | Unblocking action |
|---|---|---|
| "The call-site sweep and migration order" | (2) — no clean seam **here**; the scope is already owned by **#3369** (`epic`, open, *Decouple agent dispatch — multi-provider abstraction*), which names the same four literal `claude` call sites | Not a slice of #3006 — a **consolidation** question. Run `/consolidate` over #3006 and #3369 and let one own the call-site abstraction; slicing it here would double-book the files. |
| "The converge daemon's own identity" | (3) — the surface is not settled; it couples to **#2572** (`epic`, open, *Wire the scheduled converge-and-label runner*) | Slice it under **#2572**, where the daemon's lifecycle already lives. Its dependency on #3006 is one-way and does not justify a child here. |
| "Procedural steps that should leave the model entirely" (lane acquire/refresh/release, sequencing concurrent reviews, computing the net diff once) | (3) — still epic-sized and unshaped; only one concrete piece (the fingerprint short-circuit) is `file:line`-grounded, and it is carved as **D** | **Now unblocked by #2701 resolving** — the mechanics-vs-judgment boundary is decided, so this is no longer fork-gated. Re-run `/slice` on the remainder once someone does a work-investigation pass over `we:scripts/operator/` lane leasing. |

---

## Mechanical notes for execution

- #3006 is candidate kind **b** (already an epic) — **no `story → epic` conversion**, but it carries a residual
  `size: 13` which must be dropped before it gains sized children, or `check:standards` errors on a sized epic
  double-counting. Its digest also needs refreshing to umbrella framing and to stop asserting that #2844 is
  pending.
- Slices C and D deliberately share `we:scripts/operator/dispatch.mjs` and are chained rather than parallel;
  the dispatcher would otherwise hold the loser as `overlaps lane-N`.
- Net flow on approval: **+6** (5 build slices + 1 decision card), #3006 stays an epic, nothing resolved,
  nothing deleted.

## Open questions registered back to the board

1. **The #3006 / #3369 call-site ownership overlap** — filed as the consolidation row above; needs a
   `/consolidate` pass, not a split.
2. **The tiering fork** — filed as slice **F**, a `kind: decision` card.
