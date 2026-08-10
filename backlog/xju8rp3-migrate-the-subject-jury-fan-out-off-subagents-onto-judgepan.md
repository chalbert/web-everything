---
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-10"
relatedTo: ["3050", "3028", "2658", "3029"]
scope:
  - "we:skills-src/jury/subject-jury.workflow.js"
  - "we:skills-src/jury/"
scopeRationale: "The migration re-expresses the harness's fan-out and will add at least one sibling shim next to it in skills-src/jury/; the exact new filename is a shape decision this item makes, so the directory prefix is the honest predicted touch-set. No sibling item writes there."
tags: [plateau-loop, delivery, operations, jury, judge, panel, migration]
---

# Migrate the subject-jury fan-out off subagents onto judgePanel

The jury spawns its jurors through the Workflow runtime's `agent()` primitive, and a subagent inherits its
parent's `CLAUDE_CODE_SESSION_ID` — so by this repo's own independence test the panel is one actor wearing N
hats. Re-express the fan-out on `judgePanel` without regressing the roster, the care→rigor dial, or the
reduction.

## This is a migration, not a new build — and that is the point

Everything here already works. `/jury` runs today, end to end, on three subjects. This item does not add a
capability; it re-expresses an operation that is live on machinery that was built last night and has **no
production callers at all** ([#3056](/backlog/3056-the-judge-spawn-argv-guard-is-a-one-token-denylist-a-flag-sh/)
records that for `judgeSpawn`; `judgePanel` inherits it). That is a different and riskier shape than building
fresh: the failure mode is not "the new thing doesn't work", it is "the new thing works and the old behaviour
quietly changed underneath it".

It is also **the engine's first real absorption test**. #3028 and
[#3050](/backlog/3050-judge-panel-fan-judgespawn-out-to-n-distinct-jurors-awaited-/) were built with their
consumer imagined. This is the first time a shipped, exercised operation is asked to move onto them, so it is
the first honest read on whether the primitives fit a real caller or only a specified one.

## Why the current fan-out is the defect

[we:skills-src/jury/subject-jury.workflow.js](../skills-src/jury/subject-jury.workflow.js) (#2658, resolved
2026-07-25) fans out one juror per rostered seat inside `panelReview`, through the Workflow runtime's injected
`agent()` primitive — one `agent(jurorPrompt(…), { label: 'juror:…' })` call per seat, nested in
`parallel()` over lens groups.

**A subagent inherits its parent's `CLAUDE_CODE_SESSION_ID`.** That is recorded in the header of
[we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs) — the module whose `ACTOR_ENV`
constant *is* `CLAUDE_CODE_SESSION_ID`, i.e. the identity this repo keys reviewer independence on. It was
measured on 2026-08-08 in #3006 (open epic — parent `01f39b97…`, child `f4386de9…`) and re-measured on
2026-08-09 in #3048 (open decision — a subagent reported its parent's id byte-for-byte).

So by the repo's own test, today's jury is **one actor wearing N hats**. The harness works hard to make the
seats *behave* independently — `jurorPrompt` tells juror `i` of `n` not to try to agree with the others, and
the reduction is diversity-selection rather than a vote — but that is prose the model is asked to honour, not
a property it can be held to.

`judgePanel` makes it structural instead. Every seat gets its own `--session-id`, derived from the run id plus
the seat id, and [we:scripts/lib/judge-panel.mjs#panelSeats](../scripts/lib/judge-panel.mjs) refuses to seat a
panel whose derived ids are not pairwise distinct — before anything spawns.

**Read the limit honestly, per #2895 (resolved).** A distinct session id is not an *unforgeable* actor signal.
What it removes is the failure a subagent juror has by construction and cannot argue its way out of.

## The obstacle a straight swap hits

There is no one-line substitution here, and the item should not be scoped as if there were.

The harness body is a **Workflow sandbox, not a Node module** — its own header states the consequences: no
`import`, no `child_process`, no filesystem, no `Date.now()`. Everything that shells a command happens *inside*
an `agent(prompt, { schema })` call. `judgePanel` is an ordinary Node function. **The body therefore cannot
call it.** The two shims the harness already uses
([we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) and
[we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs)) are reached exactly this way.

Two routes, and this item picks one rather than carving a fork (an implementation shape, not a design fork):

- **Recommended — a panel shim, shelled once.** Add a sibling CLI next to
  [we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) that takes the materialized
  roster plus the round's subject snapshot, calls `judgePanel`, and returns the per-juror results as structured
  data. The harness replaces its `parallel(… agent(…) …)` nest with **one** `agent()` call that shells it. The
  launching agent is still a subagent — but the **jurors are not**: they are headless `claude -p` children that
  mint their own session ids regardless of who started them, which is the property being bought. This keeps the
  harness shape, the ledger events and the reduce path untouched.
- **Deferred — move the jury off the harness onto the operations engine.** #3032 (resolved 2026-08-09 →
  [we:scripts/operations/](../scripts/operations/)) and #3035 (resolved) make that possible, and #3029 names
  the jury as the next operation after `review-pr`. That is a larger re-homing with its own review; doing it
  *and* the fan-out swap in one change would make the equivalence check below unreadable. Do the mechanism
  first, on the harness that exists.

## What must NOT regress — the reduction stays where it is

The migration swaps **the fan-out mechanism only**. Everything below lives in
[we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs) and is **out of scope**:

- the roster — `resolveAdapterRoster` + [we:scripts/lib/jury-core.mjs#materializeRoster](../scripts/lib/jury-core.mjs)
  (seat ids are already `lens#slot`, the **same** string `panelSeats` mints, so the seats line up with a
  `roster-picked` ledger event without a translation table);
- the care→rigor dial — [we:scripts/lib/jury-core.mjs#panelRigorForCareLevel](../scripts/lib/jury-core.mjs)
  (`rounds` / `lenses` / `jurorsPerLens`, including the two-seats-on-one-lens case at care `high`);
- the diversity-selection reduction,
  [we:scripts/lib/jury-core.mjs#derivePanelVerdict](../scripts/lib/jury-core.mjs) and
  [we:scripts/lib/jury-core.mjs#buildPanelFindings](../scripts/lib/jury-core.mjs).

#3050 was explicit that **adding a second reducer is the defect the `AGGREGATION` constant exists to
prevent**. That constraint binds this item too: the shim returns jurors' answers and nothing else, and the
verdict continues to come back through the reduce path in
[we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs). If this migration ends up deriving a verdict
anywhere new, it has failed regardless of what the tests say.

The #2707 red-team stage, the #2685 editor round loop and the in-memory #2654 ledger events are likewise
untouched — the seat ids the ledger records are unchanged, which is what makes that true rather than hoped.

## Acceptance

The acceptance that matters is **equivalence on a real subject**, not fixture parity.

- [ ] **Same subject, same outcome, verified against a real run.** Run one subject through the harness before
      and after at the same `careLevel`, and record: the **same roster** (identical seat ids in identical
      order), the **same seat count**, and an **equivalent verdict**. "Equivalent" is the panel verdict and the
      per-lens verdicts matching; the *findings* are model output and will differ in wording — say so in the
      run record rather than pretending to byte-equality. This must be an actual billed run, not a stubbed one.
- [ ] **The seats are pairwise-distinct actors** — a test asserting the session ids the migrated harness put in
      its children's argv are pairwise distinct, over a roster of N ≥ 3 including two seats on one lens. This
      is the one property the old harness **cannot** have, so it is the one the migration exists to buy, and it
      must fail if the fan-out ever regresses to `agent()`.
- [ ] **A failed seat is still a reported seat.** `judgePanel` returns `{ ok: false, error }` rather than
      throwing; the harness's existing rule — a mandatory lens whose whole jury failed degrades to
      `needs-human`, never a silent accept — must hold on the new path and be tested there.
- [ ] **No second reducer.** The diff adds no verdict derivation outside
      [we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs).
- [ ] The aggregate ceiling is passed, not defaulted — `judgePanel` requires `maxTotalBudgetUsd`, `depth` and
      `maxDepth`, and all three fail closed when unknown.

## The honest cost

**A panel bills N metered calls.** Today's subagent fan-out bills against the parent session; N headless
`claude -p` children are N separate metered invocations. That is a real, new, per-run cost line and it should
not be buried.

What makes it governable is that `judgePanel` **requires** `maxTotalBudgetUsd` and checks the roster's declared
budgets against it *before the first spawn*, so a panel that cannot afford its roster bills nothing at all
rather than half a roster. Its limit is equally honest: that is admission control over declared ceilings, not a
live meter — what stops a running juror is its own `--max-budget-usd`.

**#2948 (open epic — cheap review) is orthogonal, not a substitute.** It cuts **how many seats a change
earns**; this cuts nothing and only decides **how the earned seats are spawned**. They compose: fewer seats
times a metered seat is a smaller bill than more seats times a metered seat. Neither one waits on the other.

## Blockers, stated honestly

**Nothing blocks this.** #3050 landed on 2026-08-10 (PR #1143, merge
`0722238c375844a363ea7c611eb82b381a64998b`), #3028 landed 2026-08-09 (PR #1131), and
[we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs) is already pure. #3032 and #3035 are resolved but
are *not* prerequisites — the recommended route deliberately does not touch
[we:scripts/operations/](../scripts/operations/).

Two open items are **adjacent and non-blocking**, worth reading before starting:

- #3056 (open decision) — the argv denylist is a one-token list, so a flag-shaped option *value* reaches argv.
  This migration adds a caller to that surface; it must not widen it (every value it forwards is already a
  `judgeSpawn` argv input), and it does not wait on the ruling.
- [#xo0qe85](/backlog/xo0qe85-the-juror-session-id-seed-is-a-space-join-so-it-is-ambiguous/)
  — the session-id seed is a space join and is not injective across runs. Within one panel the distinctness
  guarantee is intact, so this migration is safe to do first; the two are independent.

## Filed because someone went looking

#3050's "Not in scope" says retiring the subagent fan-out is *"a separate change with its own review; naming
the gap is not fixing it"* — and **no card was ever filed for it**. A grep of all 3029 items in `we:backlog/`
before filing this one found nothing that owned the migration: #3029 anticipates it in prose but has no slice
for it, and every other item that names
[we:skills-src/jury/subject-jury.workflow.js](../skills-src/jury/subject-jury.workflow.js) touches it for
something else (fence hardening, the red-team stage, finding-field parity, the launchability gate). See
[we:docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md) → "Closing out" for the general rule
this instance motivated.
