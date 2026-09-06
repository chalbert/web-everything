# Backlog split analysis — #3006, informed by the token-optimisation research

**Date:** 2026-09-06 · **Candidate:** #3006 *Move agent work onto the Claude Code CLI and optimise what it costs*
(kind `epic`, `size: 13`, `status: open`, no children — unsliced epic, candidate kind **b**).

**Revision 2** — the first pass proposed six children (A–F). An elevated-care jury returned `changes` /
`escalate` with `root-cause` and `completeness` (both mandatory) failing, and its findings were falsifiable
claims about the tree. **All of them verified.** Three of the six proposed slices are retracted below with the
evidence that killed them. The verdict of this revision is that **#3006 should not be sliced yet** — it should
first be reconciled against work that has already landed.

---

## What the first pass got wrong, and why

The first pass made the same error four times: **it cited a producer without checking the consumer, and named
files without checking reachability or ownership.** Recorded here rather than quietly fixed, because the error
class is more useful than the corrections.

| First-pass claim | Verified reality | Verdict |
|---|---|---|
| `loadedContextTokens` at [`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) line 696 "computes the cache split and throws it away" | It is a **pure derived helper** — it consumes nothing. The raw `usage` object travels alongside it: [`we:scripts/lib/judge-panel.mjs`](../scripts/lib/judge-panel.mjs) line 456 passes `usage: r.usage`, and [`we:scripts/operations/run-record.mjs`](../scripts/operations/run-record.mjs) line 146 copies `usage` one level deep with its numeric entries. `cache_read_input_tokens` and `cache_creation_input_tokens` **already reach the run record.** | **Slice A retracted — no-op** |
| [`we:scripts/operator/dispatch.mjs`](../scripts/operator/dispatch.mjs) line 401 is "the un-optimised twin" carrying "every fix and review agent in the operator loop" | It has **zero production importers**. The only reference to it anywhere outside this report is inside #3383's own card body. It is unwired, and **#3383 (`status: active`, `dateStarted: 2026-08-31`, 9 sessions, $658.92) explicitly names its `runAgent`/`buildReviewPrompt` as the surface it is replacing.** | **Slice C retracted — unwired, and owned by active work** |
| Slice D (fingerprint short-circuit) scoped to `we:scripts/operator/dispatch.mjs` | The real review-dispatch surface is [`we:scripts/operations/review-dispatch.mjs`](../scripts/operations/review-dispatch.mjs), wired into `we:scripts/operations/completion-cli.mjs` and the `we:scripts/conveyor/reconcile-*.mjs` pass. D as scoped would install a skip that can never fire. | **Slice D re-scoped and deferred** |
| Slice E blocked by #2858 ("no card has ever carried a cost") | **#2858 is stale — 12 cards now carry `costUsd`.** #3383 carries a full split: `costTokens: "in:5840 cw:6690099 cr:1085684841 out:1965741"`. | **Slice E retracted — largely already delivered** |

### The finding that outranks the slicing

#3383's own cost line is the measurement #3006 proposes to build a harness for:

> `cw:6,690,099` cache-write · `cr:1,085,684,841` cache-read · `in:5,840` uncached

That is a **99.4% cache hit rate and ~162 reads per write**, already on the board. Read it honestly — it
aggregates 9 sessions of an *interactive* epic, so it measures ordinary Claude Code session caching, not the
juror spawn path #3006 cares about. But it establishes that the accrual plumbing works, that the split is
retained, and that the epic's "we have no current knowledge" premise is no longer true.

Two of the epic's other premises were already falsified in the first pass and survive review:
[`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs) (#3028) is the re-runnable
conditions-stamped harness slice 1 asks for, and `buildJudgeArgv` at
[`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) line 502 already implements slice 2's frozen
prefix, stdin input, per-lens model and per-lens effort — for jurors. Both #2844 and #2701 have also resolved
since the body was written.

---

## Could split — two children, not six

| # | Slice | kind · size | Predicted `scope:` | blockedBy |
|---|---|---|---|---|
| B | Warm-prefix reuse arm for the spawn harness | `story` · 3 | `we:scripts/measure-judge-spawn.mjs` | — |
| F | Effort dial or model cascade — rule the cost-tiering fork | `decision` | — | — |

**B · Warm-prefix reuse arm** — `story · 3`, now **unblocked** (its dependency on the retracted A is gone, since
`usage` already carries the split). [`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs)
already runs `--repeat` pairs with a fresh session per arm — deliberately, so nothing resumes. Add an arm that
holds the prefix byte-identical across iterations and reports **reads per write** and cache hit rate under the
same conditions block. This is the one piece of #3006 that is genuinely unbuilt, correctly scoped, and owned by
nobody else. It answers the epic's Q2 as re-framed by the research: prefix *count* is not the constraint
(minimum cacheable prefixes are 512–4,096 tokens, so specialised prefixes each clear the bar) — **reads-per-write
within the TTL** is.

**F · The tiering fork** — `kind: decision`. Unaffected by any of the retractions. The research found that caches
are model-scoped, so a two-model cascade forfeits cross-model reuse — a cost absent from nearly every published
cascade evaluation — while Anthropic's measured alternative (low effort, re-run failures) held quality at half
the cost inside one model. **#3369** motivates itself partly on "every task pays for the same tier of model
regardless of how hard it actually is". That is a real fork spanning two open items, and rubric (1) says carve
it rather than leave it buried in #3369's body.

---

## Could not split — five rows

| Row | Rubric condition failed | Unblocking action |
|---|---|---|
| Expose the cache split (first-pass A) | — | **Not work.** Already preserved end-to-end. No item. |
| Operator dispatch argv contract (first-pass C) | (3) — names an unwired file | **Owned by #3383** (active). If the argv contract matters, it is a requirement *on* #3383, not a slice of #3006. Raise it there. |
| Skip re-review on unchanged fingerprint (first-pass D) | (3) — real surface not investigated | Re-scope to `we:scripts/operations/review-dispatch.mjs` + the `we:scripts/conveyor/reconcile-*.mjs` pass, **after** an ownership check against #2979 and the active conveyor epics. The underlying waste is real and worth fixing; the scope is not yet earned. |
| Cost + cache accrual (first-pass E) | — | **Largely delivered.** 12 cards carry cost; #3383 carries the full split. Close #2858 as stale rather than build on it. |
| Call-site sweep · converge-daemon identity · remaining procedural steps | (2)/(3) | Owned by **#3369**, **#2572**, and an un-done lane-leasing investigation respectively. |

---

## Recommendation — reconcile before slicing

An epic that yields **one build story and one decision card** after investigation is not an epic that wants
slicing. It is an epic that has been overtaken. Three of its six proposed slices are already built (#3028, the
`buildJudgeArgv` contract, cost accrual), one is owned by active work (#3383), and both forcing functions it
cites (#2844, #2701) have resolved.

The recommended order is therefore:

1. **Carve F now** — the decision fork is real, spans #3006 and #3369, and blocks nothing else.
2. **Carve B now** — small, correctly scoped, unowned, and it answers the epic's own central question.
3. **Run `/consolidate` over #3006, #3369 and #3383** before carving anything else. The call-site abstraction,
   the dispatch replacement and the cost-tiering question are currently spread across three epics with
   overlapping file claims, and #3006's body no longer describes the tree.
4. **Rewrite #3006's body** to what remains, or resolve it in favour of #3383 plus the two carved children.
   Its "one measurement we have (2026-08-08)" section should be superseded by #3383's accrued cost line.

Net flow on approval: **+2** (one story, one decision card), #3006 stays an epic, nothing resolved, nothing
deleted — and a `/consolidate` pass queued behind it.

## Open questions registered back to the board

1. **#2858 is stale** — its premise ("no card has ever carried a cost") is falsified by 12 cards carrying
   `costUsd`. Needs re-verification and probably resolution.
2. **The #3006 / #3369 / #3383 ownership overlap** — a `/consolidate` question, not a split.
3. **The tiering fork** — carved as slice **F**.
