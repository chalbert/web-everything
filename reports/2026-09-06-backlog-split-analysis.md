# Backlog split analysis — #3006, informed by the token-optimisation research

**Date:** 2026-09-06 · **Candidate:** #3006 *Move agent work onto the Claude Code CLI and optimise what it costs*
(kind `epic`, `size: 13`, `status: open`, no children — unsliced epic, candidate kind **b**).

**Revision 3** — rev 1 proposed six children (A–F). An elevated-care jury returned `changes` / `escalate`
with both mandatory lenses failing; all its findings verified, and rev 2 retracted A, C, D and E. An
adversarial **red team** then returned **BREAKS** on rev 2, and all of its findings verified too. Rev 3 keeps
the retractions, **re-sizes B from 3 to 1**, **retracts the "#2858 is stale" call as wrong**, and adds the
finding that outranks everything else here: **carving children without the same-edit guards would arm an
unattended auto-resolve of #3006.**

**The error class, now observed five times in this analysis.** Rev 1 cited producers without checking
consumers, four times. Rev 2 corrected those four — and then made the identical error a fifth time, on the one
slice it kept. See slice B below. The lesson is not "check harder"; it is that a claim of the form *"X is
computed and then discarded"* is not established until the **consumer** side is read.

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
| Slice E blocked by #2858 ("no card has ever carried a cost") | ~19 cards now carry `costUsd`, and #3383 carries a full split (`costTokens: "in:5840 cw:6690099 cr:1085684841 out:1965741"`) — so the *accrual data exists*. **But rev 2 concluded from that that #2858 is stale, and that was wrong** (see below). | **Slice E retracted — the data exists; #2858 stays open** |

### The finding that outranks the slicing

#3383's own cost line is the measurement #3006 proposes to build a harness for:

> `cw:6,690,099` cache-write · `cr:1,085,684,841` cache-read · `in:5,840` uncached

That is a **99.4% cache hit rate and ~162 reads per write**, already on the board. Read it honestly — it
aggregates 9 sessions of an *interactive* epic, so it measures ordinary Claude Code session caching, not the
juror spawn path #3006 cares about. But it establishes that the accrual plumbing works, that the split is
retained, and that the epic's "we have no current knowledge" premise is no longer true.

### Retraction: "#2858 is stale" was wrong

Rev 2 inferred from ~19 cards carrying `costUsd` that #2858's complaint had been fixed. The red team falsified
that by checking the **mechanism** rather than the artefact, and it verifies:

- [`we:scripts/guard-bash.mjs`](../scripts/guard-bash.mjs) line 127 — `BACKLOG_MUTATION` still lists `cost`
  among the denied verbs, and the primary-cwd denial is unconditional with no override.
- The cards that carry cost got it through the **lane → PR** path, not the close-from-primary route #2858
  describes. Different path, so they are not evidence that #2858's route works.

#2858's *evidence sentence* ("a grep returns zero matches") is stale. Its **gap is live**. The correct action is
to amend the evidence line, not to resolve the item. This report's rev 2 recommendation to flag it stale is
withdrawn.

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
| B | Reuse one session id across `--repeat`, and surface reads-per-write | `story` · 1 | `we:scripts/measure-judge-spawn.mjs` | — |
| F | Effort dial or model cascade — rule the cost-tiering fork | `decision` | — | — |

**B · Session-id reuse + reads-per-write in the summary** — `story · 1` (was 3), unowned, unblocked.

Rev 2 described this as "add a warm-prefix arm", which repeated rev 1's error a fifth time. The prefix is
**already** byte-identical: `MANDATE`, `INPUT` and `SHAPE` are module constants at
[`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs) lines 49–59, under the file's own
comment *"Held constant across both arms and across runs"*. `runOnce` already returns `usage: o.usage` (line 91),
and `--json` already emits `pairs` — so **the cache split is in the harness's output today**.

Falsifier, runnable now — [`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs) under
`--repeat=3 --json` already prints `pairs[].treatment.usage`.

The genuine residue is two things, hence `size: 1`:
- lines 157 and 160 mint a **fresh session id per iteration** (`deriveSessionId(\`measure-t-${i}-…\`)`), so
  successive iterations never present the same session and the warm-read case is never exercised;
- the human-readable summary (lines 170–199) derives no **reads-per-write** or hit rate, though the data is there.

Body must note that `we:backlog/3369-…` line 41 names this file as one of four call sites #3369 will rewrite —
so B lands first or rebases.

**F · The tiering fork** — `kind: decision`. Unaffected by any of the retractions. Two shape corrections from
the red team: `parent` is single-valued ([`we:scripts/check-standards-rules.mjs`](../scripts/check-standards-rules.mjs)
line 354), so the link to #3369 goes in the **body**, not a second parent; and the canonical wiring for a fork
that gates an epic is `epic.blockedBy → decision card`, not mere parenting. The adjacent ratified statute is
`#every-pr-gets-a-look-advisory-floor` in `we:docs/agent/platform-decisions.md`, which rules the
depth-not-coverage axis and is orthogonal — F is genuinely unruled. The research found that caches
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
| Cost + cache accrual (first-pass E) | — | **Data already delivered** via the lane→PR path. Do **not** close #2858 — see the retraction below. |
| Call-site sweep · converge-daemon identity · remaining procedural steps | (2)/(3) | Owned by **#3369**, **#2572**, and an un-done lane-leasing investigation respectively. |

---

## The hazard that governs execution — an unattended auto-resolve

**Carving children without same-edit guards would arm a silent close of #3006.** Verified:

- [`we:scripts/backlog/epic-resolve.mjs`](../scripts/backlog/epic-resolve.mjs) lines 65–77,
  `planEpicResolveOnLand`: once `openChildrenCount === 0`, with no `blockedBy` and no `childlessReason`, it
  returns **`{ action: 'resolve' }`** and splices `status: resolved`.
- It is **wired, not latent**. [`we:scripts/backlog.mjs`](../scripts/backlog.mjs) line 39 imports it and exposes
  it as `resolve-parent <childRef>` (line 1176, "the drain-side ON-LAND epic-resolve pass"), and
  [`we:scripts/conveyor/pr-watch.mjs`](../scripts/conveyor/pr-watch.mjs) lines 27 and 302–304 run it on the
  existing `--release-session` wire. *No human sees it.*

So the moment B and F both land, #3006 would auto-resolve — silently swallowing every deferred row: the
re-scoped D, the call-site sweep, the converge-daemon identity, the lane-leasing steps. Rev 2 asserted "nothing
resolved"; the machinery disagreed.

**The guard, which must be in the same edit as the `size` drop, not a follow-up:** set `blockedBy: ["<F>"]` **and**
`childlessReason: blocked` on #3006. `hasBlockedBy` is tested *before* `childlessReason` (line 73), so the
on-land pass returns `escalate`. Precedented by #1755 and #1522. Do **not** use `childlessReason: undecided` —
`we:scripts/check-standards.mjs` lines 1031–1032 error on it.

Dropping `size: 13` is separately **mandatory**, not optional: `we:scripts/lib/workflow-invariants.cjs`
lines 43–57 error for any `kind: epic` carrying a numeric `size` with ≥1 child — and F alone trips it. Report the
resulting **−13 burndown point delta** (`we:src/_data/backlog.js` lines 712 and 809) rather than letting the
total move silently. Epic `size` has no other consumer.

## Execution — blocked in this checkout, ready to run from a lane

**This cannot be executed here, and that is a guard doing its job, not a choice.**
`we:scripts/guard-bash.mjs` is wired as a `PreToolUse` hook (`we:.claude/settings.json` line 71) and denies
`scaffold`/`retype` and `backlog/*.md` writes from a primary checkout. Confirmed empirically: a probe scaffold
returned `"stopped": "effect-halted"`, `"applied": []`, with nothing on disk and a clean tree. the workspace lane root
does not exist, so no lane is available to this session.

Run from a lane clone, **in this order** — the digest refresh comes *before* the children attach, per
`we:docs/agent/backlog-workflow.md` line 970 and the split skill's step 1, so children never hang under a body
that still calls #2844 pending:

1. **Edit `we:backlog/3006-*.md` in one commit** — drop `size: 13`; add `childlessReason: blocked`; refresh the
   digest to umbrella framing; correct the paragraphs asserting #2844 is "coming, not yet in force" and PR #1100
   open (#2844 resolved 2026-08-08, #2701 resolved 2026-07-27); supersede the 2026-08-08 measurement with
   #3383's accrued cost line.
2. **Scaffold F** (below), then add `blockedBy: ["<F-hash>"]` to #3006.
3. **Scaffold B** (below).
4. **Gate:** `npm run check:standards` green; backlog count +2.
5. **Follow up** with `/consolidate` over #3006 / #3369 / #3383.

The two scaffold calls, single-quoted per the quoting rule (drop the `we:` locus prefix when actually running):

```sh
node we:scripts/operations/run.mjs scaffold --kind=decision --parent=3006 \
  --title='Effort dial or model cascade: rule how agent work economizes' \
  --digest='Caches are model-scoped, so a two-model cascade forfeits cross-model reuse — a cost missing from published cascade evaluations. Rule whether agent work economizes by effort tier inside one model or by routing across models. Shared with #3369.' --json

node we:scripts/operations/run.mjs scaffold --kind=story --size=1 --parent=3006 \
  --scope=we:scripts/measure-judge-spawn.mjs \
  --title='Reuse one session id across --repeat iterations and report reads-per-write' \
  --digest='The harness already holds the prefix byte-identical and already emits the cache split under --json; what is missing is that each iteration mints a fresh session id, so the warm-read case is never exercised, and the summary derives no reads-per-write.' --json
```

Net flow: **+2** (one `story·1`, one `decision`), #3006 stays an epic, parked behind F, nothing resolved.

## Recommendation

An epic that yields **one size-1 story and one decision card** after three passes has been overtaken, not
sliced. Three of its six proposed slices are already built (#3028, the `buildJudgeArgv` contract, cost accrual),
one is owned by active #3383, and both forcing functions it cites have resolved. Carve F and B to capture what
is real, park #3006 behind F, and let `/consolidate` decide whether #3006 survives at all or is resolved in
favour of #3383 plus its two children.

## Open questions registered back to the board

1. **#2858's evidence line needs amending, not resolving** — the "zero matches" grep is stale; the
   close-from-primary gap it names is still live (`we:scripts/guard-bash.mjs` line 127).
2. **The #3006 / #3369 / #3383 ownership overlap** — a `/consolidate` question, not a split.
3. **The tiering fork** — carved as slice **F**.
4. **F's premises are unverified in-repo** — the caching claims behind it come from external research published
   this session, not from a `/research/` topic. Publish one, or mark F's premises unverified before it is ratified.
