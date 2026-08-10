---
bornAs: xju8rp3
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-10"
dateStarted: "2026-08-10"
dateResolved: "2026-08-10"
graduatedTo: skills-src/jury/panel-fanout.mjs
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

**The constraint was re-verified before the route was taken, not assumed from this card.** `node --check` still
rejects the harness (its top-level `return` is what makes it a body rather than a module), so there is no import
edge to add and no version of this that calls `judgePanel` directly. A test now pins both halves of that — the
body has no top-level `import` and does end in a top-level `return` — so the reason the shim exists stays
checkable rather than becoming folklore.

Two routes, and this item picks one rather than carving a fork (an implementation shape, not a design fork):

- **TAKEN — a panel shim, shelled once.** Add a sibling CLI next to
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

- [x] **Same subject, same outcome, verified against a real run.** Run one subject through the harness before
      and after at the same `careLevel`, and record: the **same roster** (identical seat ids in identical
      order), the **same seat count**, and an **equivalent verdict**. This must be an actual billed run, not a
      stubbed one. **Done — see "The equivalence run, as measured" below, including the way this bullet's own
      definition of "equivalent" turned out to be the wrong test.**
- [x] **The seats are pairwise-distinct actors** — pinned on the `--session-id` tokens that reached each child's
      argv over a 5-seat roster with **two seats on one lens**, in
      [we:skills-src/jury/tests/panel-fanout.test.mjs](../skills-src/jury/__tests__/panel-fanout.test.mjs), and
      confirmed live (4/4 distinct, each echoed back by the CLI). The regression guard is in the same file: it
      reads the harness body as text and fails if a per-seat `agent(jurorPrompt(…))` fan-out or a `parallel()`
      call ever comes back.
- [x] **A failed seat is still a reported seat.** Tested on the new path both ways — one seat failing while its
      siblings still spawn and report, and a whole lens's jury failing (the shape the harness's
      mandatory-lens → `needs-human` degrade keys on). The harness now walks the ROSTER and looks each seat up
      by id, so a seat the relay silently dropped degrades exactly like a seat that crashed.
- [x] **No second reducer.** The diff touches only [we:skills-src/jury/](../skills-src/jury/);
      [we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs),
      [we:scripts/review-core-cli.mjs](../scripts/review-core-cli.mjs),
      [we:scripts/lib/judge-panel.mjs](../scripts/lib/judge-panel.mjs) and
      [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) are byte-unchanged. Pinned by a test that
      greps the shim's code for every reducer name and asserts its ONLY jury-core import is `IMPACT_LEVELS`.
- [x] The aggregate ceiling is passed, not defaulted — the shim makes `--depth`, `--max-depth` and
      `--max-total-budget-usd` **required flags** (usage error, nothing spawned), and the harness passes all
      three from named constants. Each refusal is asserted with a spawn counter, so "refused" and "refused
      before it cost anything" are separate claims.

## The equivalence run, as measured (2026-08-10)

**Subject:** a 10-line added-file diff with one off-by-one (`if (i === attempts) throw e` inside a
`i < attempts` loop, so an exhausted retry silently returns `undefined`). `pr-diff`, care `low` — the smallest
non-empty roster the dial produces: **4 seats, 1 juror per lens, 1 round**.

**Roster and seat count: identical, and identical for free.**
[we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) is unchanged, so both legs seated
`correctness#1, security#1, simplicity#1, standards-conformance#1` in that order. This half of the bar costs
nothing to prove and was never at risk.

**Both legs found the same defect, at the same impact.** All eight jurors (4 subagents before, 4 headless
children after) reported one finding: the same off-by-one, `impactIfUnfixed: broken`, `introduced: true`,
`worseThanBase: true`, `preventionCaptured: false`. Wording differs, as this card predicted.

**The panel verdicts did NOT match, and the reason is worth more than the match would have been.**

| | before (4 subagents) | after (4 headless jurors) |
|---|---|---|
| panel verdict | `changes` | `prevention-outstanding` (twice, two samples) |
| outcome | `escalate` | `escalate` |
| the one divergent field | `correctness#1` answered `parallelizable: false` | every seat answered `parallelizable: true` |

Flip that **one boolean on one seat** and the migrated path reduces to `changes` with a byte-identical per-lens
map. Same reducer, same inputs, same output — the mechanism is equivalent and the divergence is one juror's
judgement call on a genuinely debatable question. A second live sample of the migrated path reproduced
`parallelizable: true` on all four seats, so the outlier is the *old* leg's single subagent, not a shift the new
mechanism introduced.

**So this card's own definition of "equivalent" was wrong, and is corrected here.** It said the findings are
model output and will differ, but the panel verdict must match — and those two clauses contradict each other.
`parallelizable` *is* model output, and `deriveFindingDisposition` keys the verdict on it. A verdict-equality
test over one sample of a 4-seat panel is therefore a test of model variance, not of the fan-out. The test that
actually discriminates is the one run above: **same roster, same seat count, same defect at the same impact, and
identical reduction under identical inputs.**

**What the run caught that no fixture would have.** The first live panel came back with findings carrying
*exactly* the keys the shim's `--json-schema` declared and not one more — every seat dropped
`introduced` / `worseThanBase` / `parallelizable`, even though the adapter mandate demands all three and
`additionalProperties: true` permitted them. `--json-schema` is a FORCED TOOL CALL (#3028), so on this path the
declared shape beats the prose; the pre-migration subagents supplied the triple because free-form JSON has no
competing shape. It failed *closed* (an unanswered finding stays blocking), so no verdict was ever at risk — but
without it the migrated jury could never route anything to a carve-out, i.e. it was strictly stricter than the
jury it replaced. The three booleans are now declared in the shape, and a test pins that they are. **This is
#2942's failure mode with the volume turned up, and it is exactly what the "actual billed run" clause was
for.**

**The bill.** Three live panels at 4 headless `haiku`/low jurors each: **$0.108771 + $0.102118 + $0.109653 =
$0.320542**, 36–39 s wall per panel. Per-panel that is **~$0.10 for a 4-seat care-`low` panel on a 10-line
subject** — the number to extrapolate from, remembering that a care-`high` panel is 8 seats × 3 rounds and that
the harness's own dial is `sonnet`/`medium`, not `haiku`/`low`. The "before" leg billed 4 subagents (~21k tokens
each) against the parent session, which is precisely the cost line that used to be invisible.

**The independence claim, re-measured rather than cited.** All four "before" jurors reported
`CLAUDE_CODE_SESSION_ID = 01f39b97-274a-4078-8eeb-e7f8d6008673` — byte-identical to the launching session. One
actor wearing four hats, exactly as #3006 and #3048 recorded. All four "after" jurors reported four distinct ids,
each equal to the one `panelSeats` derived for its seat and none equal to the parent's.

## Found while building this — a live truncation in the sibling shim

[we:skills-src/jury/resolve-roster.mjs](../skills-src/jury/resolve-roster.mjs) ended with
`process.stdout.write(bigJson); process.exit(0)`. `process.exit` tears the process down at once and a pipe write
is asynchronous past the pipe buffer, so the two together truncate: read back through `execFileSync`, its ~20 KB
care-`low` roster returned **8144 bytes of unparseable JSON**. The harness's resolve agent shells that shim on
every jury run, so this was live on the shipped path, not hypothetical. Fixed in both shims (`process.exitCode` +
return) with a regression test that reads a real roster back through a real pipe. The new shim would have
inherited the bug — it was copied from the old one.

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
- [#3058](/backlog/3058-the-juror-session-id-seed-is-a-space-join-so-it-is-ambiguous/)
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
