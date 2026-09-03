---
bornAs: xsldreq
kind: task
parent: "3383"
status: active
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
tags: []
relatedTo: ["3332"]
scope:
  - we:scripts/conveyor/reconcile-pass.mjs
  - we:scripts/conveyor/reconcile-core.mjs
  - we:scripts/conveyor/tick-core.mjs
  - we:scripts/conveyor/__tests__/reconcile-core.test.mjs
  - we:scripts/conveyor/__tests__/tick-core.test.mjs
  - we:skills-src/conveyor/runner.mjs
  - we:skills-src/conveyor/__tests__/runner.test.mjs
---

# Wire reconcile-pass's kind:'fix' dispatch into the runner's mechanical passes

Found live 2026-09-01 during #3383's own runner-tick-loop live-fire test. `we:scripts/conveyor/reconcile-pass.mjs`
already plans a `kind: 'fix'` entry for a `review:changes`-bounced PR with nothing live working it (confirmed:
it correctly planned one for a real bounced PR, `#1764`, during tonight's run). But
`we:skills-src/conveyor/runner.mjs`'s `kind === 'review'`-only mechanical-pass wiring — a 2026-09-01 addition,
mid-`#3383`'s own live-fire test, pushed ONLY to `origin/lane/mechanical-dispatcher` and NOT YET on `main`
(**correction, 2026-09-02, a `PR #1764` review finding: the prior text here mis-cited this as "landed via `PR
#1758`'s sibling work" and did not say it was branch-only — verified false against `main`'s actual
`we:skills-src/conveyor/runner.mjs`, which today has zero mention of `reconcile-pass` or a `kind === 'review'`
filter at all**) — only consumes `plan.dispatch` entries where `kind === 'review'`; a `kind: 'fix'` entry is
silently dropped, never dispatched anywhere, on that branch. Separately, tick-core's own older
`planFixSpawns`/`spawnFixes` mechanism (driven from `state.prs`) also never fired for the same bounced PR
across 5+ real ticks tonight, so neither path actually gets a fix agent onto a bounced PR opened outside the
runner's own build dispatch. Net effect: "the review step is fully mechanized" (claimed in this epic's own
2026-08-31 session update, itself describing branch state) is true only for the FIRST review, and only once the
branch this all lives on graduates to `main` — a `review:changes` verdict currently has no automatic path back
to a fix anywhere, which undercuts this epic's own "Done when" #1 (a full fix → review → land cycle with zero
interactive turns).

### Second correction (2026-09-02) — the prior self-correction above checked `main` only; the bug is real and confirmed on the branch this code actually lives on

The correction dated 2026-09-02 just above says the "landed via PR #1758" citation was "verified false against
`main`'s actual `we:skills-src/conveyor/runner.mjs`, which today has zero mention of `reconcile-pass` or a
`kind === 'review'` filter at all." That is true as far as it goes, but it checked the wrong ref for what this
card is actually about: none of this code — `we:scripts/conveyor/reconcile-pass.mjs`,
`we:scripts/conveyor/reconcile-core.mjs`, or `we:skills-src/conveyor/runner.mjs`'s `kind === 'review'` filter —
has ever been claimed to be on `main`. It is branch-only, unlanded via epic `#3383` (see that epic's own "How to
build it" section: build and iterate on `origin/lane/mechanical-dispatcher`, graduate to `main` only once
stable). Checking `main` for it and finding nothing proves nothing about whether the bug this card describes is
real; it only confirms the code hasn't graduated yet.

Checked against the actual ref this card is scoped to: `origin/lane/mechanical-dispatcher` at
`we:skills-src/conveyor/runner.mjs:288` reads
`const reviewsOwed = (Array.isArray(plan.dispatch) ? plan.dispatch : []).filter((d) => d && d.kind === 'review');`
— exactly the bug as originally described. There is no corresponding filter or fallthrough for
`d.kind === 'fix'` anywhere in that pass; a `kind:'fix'` entry `we:scripts/conveyor/reconcile-pass.mjs`/
`we:scripts/conveyor/reconcile-core.mjs` plans for a bounced `review:changes` PR with nothing live working it is
silently dropped, never dispatched. The bug is real and live on the branch. The 2026-09-02 correction's
underlying instinct (double-check a claim rather than propagate it) was right; its scope was wrong — it needed
to check the branch this card names, not `main`.

**The right fix is not a simple filter-widening patch, though.** `we:scripts/operations/dispatch-lane.mjs`'s
`fillBrief` fills exactly five tokens — `ITEM_NUM`, `ITEM_SPEC_PATH`, `LANE`, `SESSION_SLUG`, `SCOPE`
(`we:scripts/operations/dispatch-lane.mjs:515-521`). The two fix-agent briefs
(`we:skills-src/conveyor/fix-agent-brief.md` / `we:skills-src/conveyor/fix-agent-ci-brief.md`) need `LANE_REF`
and `PR_NUM` — neither is in that fill set — plus `REASON` for the CI-heal brief. An unfilled token is reported,
never fatal (`we:scripts/operations/dispatch-lane.mjs:535-536`), so simply routing `kind:'fix'` plan entries
through the existing build-dispatch call would silently hand a fix agent a brief with a literal `{{PR_NUM}}` in
it, not a working dispatch.

That exact gap — the missing `PR_NUM`/`LANE_REF`/`REASON` tokens, the PR-keyed session-slug collision, the
scope-refusal question for a PR that never got a fresh `scope:` of its own — is already scoped correctly by
`#3332`, whose own blocker (`#3165`) is now `resolved`, so `#3332` is ready to build and already queued.
**`#3332` is for a DIFFERENT mechanism than this card's**, though: it fixes tick-core's own native
`planFixSpawns`/`spawnFixes` path (driven from `state.prs`, dispatched via
`we:scripts/operations/dispatch-lane.mjs`'s `--num` launch kinds), not
`we:scripts/conveyor/reconcile-pass.mjs`'s separate, liveness-based `kind:'fix'` planning that this card is
actually about. See the narrowed scope directly below for what that means for this card once `#3332` lands.

## Scope, narrowed in light of `#3332` (2026-09-02)

`#3332` is not this card's job and is explicitly out of scope here — do not build it from this card. Once it
lands (giving tick-core's own `planFixSpawns`/`spawnFixes` path working `PR_NUM`/`LANE_REF`/`REASON` fill and a
real dispatch route), this card's own remaining job narrows to two steps, in order:

(a) Decide whether `we:scripts/conveyor/reconcile-pass.mjs`'s separate `kind:'fix'` planning is now redundant
    with tick-core's (post-`#3332`) working `planFixSpawns` path, or whether it covers a genuinely different
    case — Done-when #2 below already asks exactly this question; it does not need to be rewritten, just
    answered with `#3332`'s landed behavior as the actual baseline to compare against, not the currently-inert
    `planFixSpawns` this card's own digest found never firing.

(b) **Only if (a) finds they are genuinely different** — wire `we:skills-src/conveyor/runner.mjs`'s mechanical
    pass to also consume `kind:'fix'` entries using whatever fill/dispatch mechanism `#3332` ends up building
    (the corrected `fillBrief` token set, the PR-keyed session-slug scheme, however it resolves the
    scope-refusal question) — not a bespoke fill/dispatch path invented just for
    `we:scripts/conveyor/reconcile-pass.mjs`'s entries. If (a) finds them redundant, the resolution is to
    mark/remove `we:scripts/conveyor/reconcile-pass.mjs`'s `kind:'fix'` planning as dead, not to wire it up at
    all.

## Done when

1. **Executable** — a live (or faithfully reproduced) `review:changes` PR with no live session working it,
   fed through one `we:skills-src/conveyor/runner.mjs` tick, results in an actual `dispatch-lane` fix spawn
   (or the reconcile-pass `kind:'fix'` entry is otherwise proven to reach a real dispatch) — not just a
   silently-dropped plan entry. A regression test pinning this (mirroring the `kind === 'review'` wiring's own
   test coverage) is the executable proof. Per the narrowed scope above: if this item's dispatch route is
   actually needed (step (b)), it reuses `#3332`'s landed fill/dispatch mechanism rather than a new one.
2. Investigate and resolve whether tick-core's own `planFixSpawns` is meant to be the ONE mechanism for this
   (in which case reconcile-pass's `kind:'fix'` planning is redundant/dead and should say so, or be removed)
   or whether both are meant to cover different cases (in which case both need to actually fire) — don't leave
   two parallel, both-silently-inert mechanisms in place. Answer this against `#3332`'s landed behavior, not
   the pre-`#3332` state where `planFixSpawns` never fired at all.

## Progress

- 2026-09-03: **Answered #2 — genuinely different, not redundant.**
  `we:scripts/conveyor/tick-core.mjs`'s `planFixSpawns` only ever considers a PR in `state.prs` whose `num` is
  in `launchedNums` — i.e. one THIS conveyor process's own (session-ephemeral, STDIN-piped) bookkeeping
  remembers launching. `we:scripts/conveyor/reconcile-pass.mjs` is keyed by PR number alone and reads live
  `gh pr list` / `claude agents --json` fresh every pass, so it ALSO covers a bounced PR the current conveyor
  process never launched (a restart lost the memory of, a sibling process launched, one opened by hand) — a
  real, distinct population, not a duplicate. (b) applies.
- 2026-09-03: **Wired (b).** New `we:scripts/conveyor/reconcile-fix-dispatch.mjs` — a one-shot pass mirroring
  `we:scripts/operations/review-dispatch.mjs`'s own `dispatchReview` "plan → fill → mint → spawn" composition,
  reusing `we:scripts/operations/dispatch-lane.mjs`'s real `fillBrief`/`BRIEF_REQUIRED_BY_KIND.fix`/
  `sessionSlugFor` and `we:scripts/operations/dispatch-lane-io.mjs`'s
  `buildAgentArgv`/`defaultSpawnAgent`/`findItem`/`defaultLoadItems` (the last two newly exported for this)
  rather than a bespoke fill/dispatch path. Wired into `we:skills-src/conveyor/runner.mjs`'s mechanical passes
  alongside infra-blocked/lease-reaper/session-reaper/hiccup-sink. Also closed a latent #3437-shaped
  double-dispatch gap for fix agents specifically: `we:scripts/conveyor/reconcile-core.mjs`'s `bindAgents` now
  matches a live `fix-<pr>`-named session by name (mirroring the existing `review-<pr>` name-bind), since a fix
  agent's lane HEAD diverges from the PR's still-unpushed head sha the moment it makes its first commit — the
  same blind spot #3437 fixed for review sessions, recurring here. Regression coverage:
  `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` (case 5c, the name-bind + the
  double-dispatch-across-two-ticks proof) and a new `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`
  (planning refusals, the free-lane read, the dispatch composition, and the whole pass).
