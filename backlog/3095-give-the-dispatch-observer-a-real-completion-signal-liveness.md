---
bornAs: x9ylkp7
kind: story
size: 3
parent: "3029"
status: resolved
blockedBy: ["3037"]
dateOpened: "2026-08-13"
dateResolved: "2026-08-16"
graduatedTo: none
scope:
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/wake.mjs
  - we:scripts/operations/__tests__/
  - we:scripts/conveyor/pr-watch.mjs
  - we:scripts/conveyor/lease-reaper.mjs
scopeRationale: "Changes the dispatch observer (we:scripts/operations/dispatch-lane-io.mjs's createDispatchObservers), its registration in the waker (we:scripts/operations/wake.mjs), and its tests (we:scripts/operations/__tests__/). Reads we:scripts/conveyor/pr-watch.mjs's classifyPr and we:scripts/conveyor/lease-reaper.mjs's laneRefItemNum as library functions rather than their CLI forms; lease-reaper is in scope because widening the lane-ref grammar (a lane/<bornAs>-* head ref) has to happen there rather than in a second copy of the matcher."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Give the dispatch observer a real completion signal — liveness is not an outcome

#3037's dispatch observer answers `running` or `unresolved` and never `succeeded`: `claude agents --json`
reports LIVENESS only — a session is listed or it is not — and `--all` showed no terminal record for a
completed background session (measured on 2.1.220). So a finished build is never resolved by the machine.
The real completion signal exists elsewhere: the agent's PR, which `we:scripts/conveyor/pr-watch.mjs` already
watches to a terminal state. Fold it in so a clean build resolves its own in-flight entry.

## Why this is not cosmetic

`unresolved` writes nothing, so a finished dispatch is re-reported on EVERY waker pass, and past
`STUCK_ESCALATION_HOURS` (6h) `we:scripts/operations/wake.mjs` exits non-zero on every pass until a person
closes the entry out. The first real dispatch therefore red-lights the waker permanently. That is survivable
only because nothing in production dispatches yet (#3096 is what changes that), which is why this should land
before, or with, that one.

## Already partly satisfied — verified against the live code, not assumed

The card's third acceptance bullet ("a CLI or documented one-liner exists for closing out an entry by hand")
is **done**: `we:scripts/operations/wake.mjs`'s `closeOutEntry` (`--resolve=<runId> --key=<effectKey>
--status=applied|failed`) shipped from PR #1211's review, and its own docblock names this card's `bornAs` hash
directly — *"its observer can never answer `succeeded` (claude agents reports liveness, not outcome —
#3095)... this is the deliberate, not the only, way [to remedy it]"*. So the manual close-out path is not
this item's job. **What remains is the automatic path** — the first two acceptance bullets, unchanged from the
original card.

## What it must not do

Do not weaken the `OBSERVATIONS` vocabulary in `we:scripts/operations/effect-observer.mjs` (currently
`['running', 'succeeded', 'unresolved']` — `succeeded` is already DECLARED, just never REACHED by the dispatch
observer). There is still no word for "failed" — two earlier vocabularies had one and each re-ran real work —
and an `unresolved` answer must keep writing nothing. A genuinely ambiguous outcome still asks a person; only a
provably clean one resolves.

**Do not resolve on a STALE PR.** Under item-num discovery, a merged `lane/<num>-*` from an EARLIER attempt at
the same item matches the new in-flight entry just as well as the current one — and re-dispatch of one item is a
designed path, not a hypothetical (`we:scripts/operations/effect-executor.mjs` mints a fresh handle per retry and
keeps `supersededHandles`; the aged-out hold in `we:scripts/operations/dispatch-lane.mjs#dispatchStillHolds` is
what lets a second attempt start at all). An unguarded match resolves a build that has barely begun as
`succeeded`/`applied` on the strength of its predecessor's PR — the exact conflation this card exists to close,
arriving through the back door. The match must be scoped to PRs that became terminal AFTER the entry's
`startedAt` (which every in-flight entry carries — `we:scripts/operations/effect-executor.mjs` stamps it), and
the ambiguous remainder answers `unresolved`. `we:scripts/conveyor/lease-reaper.mjs`'s own comment records the
same hazard from the other side (`open wins`, the #2267 data-loss case).

## The decided design

Extend `we:scripts/operations/dispatch-lane-io.mjs`'s `createDispatchObservers`: after (or instead of, per the
ordering question below) the `claude agents --json` liveness check, look up the entry's PR via
`we:scripts/conveyor/pr-watch.mjs`'s `classifyPr(pr)` (pure, already exported: takes a parsed `gh pr view`-shaped
object, returns `'merged'|'closed'|'parked'|'pending'`) — `'merged'` is the one classification this item resolves
to `succeeded`; `'closed'` and `'parked'` are ambiguous-for-this-purpose and must still answer `unresolved`
(closed-unmerged could be an abandoned build OR a manual close; parked is mid-review, not failed); `'pending'`
means keep waiting, same as today.

**The real open question this card did not name: how does the observer find the PR for an in-flight dispatch
entry?** Today's dispatch entries carry no PR reference at all (checked: no `pr`/`prNumber` field anywhere in
`we:scripts/operations/dispatch-lane-io.mjs` or `we:scripts/operations/dispatch-lane.mjs`) — a build in flight
has no PR yet at dispatch time; the dispatched agent opens one mid-build. Two candidate approaches, NOT ruled
here:

1. **Discover by ITEM NUMBER over the head refs at observe time — not by exact branch name.** An earlier cut of
   this card said the entry "already knows its lane's branch"; it does not, and a build that trusted that would
   have shipped a no-op. Re-checked against `main`: the dispatch effect payload
   (`we:scripts/operations/dispatch-lane.mjs`, the `DISPATCH_EFFECT` step) carries `num`, `lane`, `sessionSlug`,
   `itemSpecPath`, `scope`, `prompt`, `expectedWithinMinutes` — `lane` is the pool's lane NUMBER, and there is no
   branch anywhere on it. The head ref is minted later BY the dispatched agent: the brief tells it to run
   `pr-land --ref=lane/{{ITEM_NUM}}-<slug>` (`we:skills-src/conveyor/delivery-agent-brief.md`), and the `<slug>`
   is the agent's to invent at that moment. So the exact ref is unknowable at observe time and `gh pr list --head`
   (an exact head-branch filter) can only ever return empty.

   The repo already solved exactly this: `we:scripts/conveyor/lease-reaper.mjs` exports `laneRefItemNum`
   (`/^lane\/(\d+)[a-z]?-/i` over a head ref) and `prStatesFromList` — pure, unit-tested, no `gh` — and
   `we:scripts/lane-pool.mjs`'s reaper feeds them one bounded
   `gh pr list --state all --limit 400 --json number,state,mergedAt,headRefName`. Reuse that matcher rather than
   writing a third discovery path. Two details are load-bearing and both are why the earlier one-liner was
   wrong: **`--state all` is required** (bare `gh pr list` defaults to OPEN only, so `merged` — the single
   classification this item resolves on — would never appear), and the JSON must include `headRefName` (to match
   the item) alongside `state,mergedAt,labels` (what `classifyPr` reads). `prStatesFromList` itself is prior art,
   not a drop-in: it collapses to `open|merged|closed` and loses the `parked` distinction this card needs, so
   take `laneRefItemNum` and classify with `classifyPr`.

   No new write path, purely additive on the read side — matches the "no control-flow change beyond resolving
   cleanly" spirit the rest of this card holds to. Cost: one more bounded `gh` shell-out per observe PASS
   (memoized like the existing `claude agents` listing, not once per entry).
2. **The PR number is written back onto the run store's effect entry** once a PR exists. The weak form is the
   delivery-agent brief doing it (`we:skills-src/conveyor/delivery-agent-brief.md`): that adds a write-back
   responsibility to prose an LLM must obey, and a brief that stops short of opening a PR (exactly the failure
   mode `we:backlog/3105-the-gate-outruns-the-agent-foreground-window-so-an-agent-can.md`, the gate-timeout card,
   documents happening) leaves the field never written — silently falling back to today's `unresolved`, which is
   at least fail-safe, but harder to distinguish from "hasn't opened a PR yet." **The strong form, which the
   earlier cut of this card did not consider, is `we:scripts/pr-land.mjs` writing it** — it is a deterministic
   script that already parses the item num out of its own `--ref` (`^lane\/(x[a-z0-9]{5,7}|\d+)`) and already
   knows the PR number it just opened, so no model compliance is involved. That form costs a new persisted field
   on the run store plus a new coupling from `pr-land` to the operations store (which today it knows nothing
   about), and it widens this card's `scope:`. It is a genuine option, not a straw man — do not reject the fork
   on the brief-compliance argument alone.

**Recommend (1)**, now that its mechanism is stated correctly — it needs no change to the dispatch/brief/pr-land
write path, keeps this item's "no control-flow change" boundary honest, reuses a matcher that is already pure
and tested, and degrades safely (an empty listing is indistinguishable from "no PR yet," which is correct). The
honest cost of (1) versus the strong form of (2) is the stale-PR ambiguity below: num-matching cannot tell THIS
dispatch's PR from a previous attempt's, and a stored PR number could. This needs a ruling before the build
starts, not a silent pick — name it explicitly in the PR that builds this.

### RULED (2026-08-14, before any code was written): **approach 1 — item-id lookup over the head refs**

The build took the recommendation, and the reasons are the card's own: it needs no change to the
dispatch/brief/`pr-land` write path, so this item's "no control-flow change" boundary stays honest; it reuses
`we:scripts/conveyor/lease-reaper.mjs`'s `laneRefItemNum`, which is already pure and unit-tested, so the reaper
and the observer cannot come to disagree about which ref belongs to which item; and it degrades safely, because
an empty listing is indistinguishable from "no PR yet", which is exactly the right reading.

Approach 2 was weighed on its STRONG form (`we:scripts/pr-land.mjs` writing the PR number back), not the brief
form — the brief-compliance argument alone would have been an argument against the wrong version. It was
declined on COST and SIZE rather than on merit: it adds a persisted field to the run store, a new coupling from
`pr-land` to the operations store it knows nothing about today, and a migration question for entries written
before it. The card's own Delivery shape says that is not a 3 and needs re-sizing first.

**What choosing (1) costs, stated rather than buried:** id-matching cannot tell THIS dispatch's PR from a
previous attempt's, and a stored PR number could. The stale guard closes the case the card names (a predecessor
merged BEFORE `startedAt` resolves nothing, and a missing/unparseable `startedAt` fails closed the same way).
The residual it does NOT close: a predecessor's PR that merges AFTER a retry started falls inside the window
and would resolve that retry. Only approach 2 can tell those apart. Both the code and its tests say so.

The grammar widening the build needed (task 4) went where the card said: `laneRefItemNum` now accepts
`pr-land`'s own `^lane\/(x[a-z0-9]{5,7}|\d+)[a-z]?-`, so a `bornAs`-hash item's PR is no longer read as
belonging to no item. The reaper's behaviour is unchanged and that is asserted, not assumed — `prStatesFromList`
mints hash keys, but `itemNumFromSession` can only ever produce digits, so no hash key is reachable on the reap
path and none collides with an existing one.

## Interfaces and protocol

```js
// we:scripts/conveyor/pr-watch.mjs — already exported, read-only import, no change needed
export function classifyPr(pr) // -> 'pending' | 'merged' | 'closed' | 'parked'
```

```js
// we:scripts/conveyor/lease-reaper.mjs — already exported, pure, unit-tested; the item-num matcher
export function laneRefItemNum(headRef) // 'lane/3095-foo' -> '3095'; anything else -> null
```

```js
// we:scripts/operations/dispatch-lane-io.mjs — createDispatchObservers, extended
// New helper, shape TBD by whoever builds it against approach (1) above. NOTE the listing is per PASS and
// memoized exactly like the existing `listAgents` one — not one shell-out per in-flight entry.
async function resolveViaPr({ num, startedAt, listPrs = defaultListPrs }) {
  // gh pr list --state all --limit <n> --json number,state,mergedAt,labels,headRefName
  // `--state all` is REQUIRED: the default is open-only, which hides every merged PR.
  const prs = (await listPrs()).filter((p) => laneRefItemNum(p.headRefName) === String(num));
  if (!prs.length) return 'pending';                       // no PR yet — same as today
  const mine = prs.filter((p) => !p.mergedAt || Date.parse(p.mergedAt) >= Date.parse(startedAt));
  if (!mine.length) return 'stale';                        // a PREVIOUS attempt's PR only — NOT this build's
  return classifyPr(mine[0]);
}
// In the observer's decision: classification === 'merged' -> 'succeeded'; 'pending' -> fall through to the
// existing liveness-based 'running'/'unresolved' logic unchanged; 'closed'/'parked'/'stale' -> 'unresolved'
// (ambiguous). `'stale'` is a local verdict of this helper, NOT a new word in `OBSERVATIONS`.
```

`OBSERVATIONS` (`we:scripts/operations/effect-observer.mjs:68`) and `TERMINAL_STATUS`
(`we:scripts/operations/effect-observer.mjs:74`, `{ succeeded: 'applied' }`) need no changes — the vocabulary
already has the word this item needs to finally reach.

## Tasks

1. Rule the PR-discovery fork above (recommend approach 1) before writing code.
2. Add an injectable `listPrs` (mirroring the existing injectable `listAgents` pattern already used for the
   liveness check, per `we:scripts/operations/wake.mjs`'s `closeOutEntry`) so the observer stays testable with
   no real `gh` call — memoized per pass, and bounded by a `timeout` exactly as `defaultListAgents` is, so a
   hung `gh` cannot stall every other parked run in the pass.
3. PIN THE QUERY, not just the classification. Assert the real `gh` argv the default reader builds — `--state all`
   present, `headRefName` in `--json` — the same way `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs`
   pins the `claude agents --json` argv. Without this the whole feature can be green on injected fixtures and
   return nothing in production, which is the defect PR #1211's review (F5/F6) already caught once in this file.
4. Reuse `we:scripts/conveyor/lease-reaper.mjs`'s `laneRefItemNum` for the head-ref → item-num match rather than
   re-deriving the ref grammar. If the grammar needs widening (a `lane/<bornAs>-*` ref, which
   `we:scripts/pr-land.mjs` accepts but `laneRefItemNum` does not match), widen it THERE, with its own test, so
   the reaper and the observer can never disagree about what ref belongs to what item.
5. Wire the PR-classification check into `createDispatchObservers`, before or alongside the liveness check —
   decide ordering: a merged PR with a still-listed live agent (the agent exited slowly after its PR merged)
   should resolve `succeeded` regardless of liveness, so the PR check should likely run FIRST, not as a
   fallback after liveness says "not running."
6. Test each classification maps to the right observation, including the two ambiguous ones (`closed`,
   `parked`) staying `unresolved`, the stale-predecessor case staying `unresolved`, and the no-PR-yet case
   behaving exactly as today.
7. Confirm the waker's `STUCK_ESCALATION_HOURS` clock and the corpus of existing dispatch tests are unaffected
   for entries that never reach a PR at all (the dominant case until #3096 lands real dispatch).

## Done when

- [ ] A dispatched entry whose PR merged resolves to `succeeded`/`applied` without a person, verified with an
      injected PR-classification fixture (no real `gh pr list` call in tests).
- [ ] The waker stops re-reporting a resolved entry on the next pass.
- [ ] An entry whose PR is `closed` (abandoned) or `parked` (mid-review) still answers `unresolved`, still
      writes nothing — the ambiguous cases are not silently resolved.
- [ ] A named test reddens when the discovery QUERY is mutated: drop `--state all` (or drop `headRefName` from
      `--json`) and a test must fail. Every other bullet here passes on injected fixtures, so this is the only
      one standing between "green suite" and "resolves nothing in production."
- [ ] An in-flight entry whose ONLY matching PR is a previous attempt's — merged BEFORE the entry's `startedAt` —
      answers `unresolved`, not `succeeded`.
- [ ] The PR-discovery fork (item-num lookup vs. write-back) is ruled, and the ruling is recorded on this card
      before the code lands, not implied by the diff.
- [ ] `closeOutEntry` (already shipped) is unchanged by this item — the manual path and the new automatic path
      coexist without one needing the other.

## Delivery shape

Lands in one piece behind `main` — one new read (PR classification), gated to fire only when today's liveness
read is not itself dispositive. No schema migration on the run store (no new persisted field, under the
recommended approach). No slicing needed at size 3; the basis is one new injectable reader plus one pure helper
in a file that already has the injection seam, no caller outside the two operations files, and no persisted
state — the test surface (classification table, stale-predecessor case, argv pin) is where most of the 3 sits.
Under approach 2's `pr-land` form this is NOT a 3: it adds a persisted field, a store coupling from
`we:scripts/pr-land.mjs`, and a migration question for entries written before it — re-size before building that.

## Watch for

- Don't let `succeeded` become reachable for anything short of `classifyPr`'s `'merged'` — a `closed` PR is NOT
  a success, even though it is terminal, and conflating "terminal" with "succeeded" is exactly the shape of bug
  this card exists to close.
- If approach 2 (write-back) is chosen instead of the recommended approach 1, its silent-fallback risk (a brief
  that never opens a PR) needs its own explicit watch-for in the build, tied to the gate-timeout card's evidence.
  That risk applies to the BRIEF form of (2); the `we:scripts/pr-land.mjs` form does not have it, and choosing
  against (2) on that argument alone would be choosing against the wrong version of it.
- The failure mode of a wrong discovery query is SILENCE, not an error: an empty listing is by design
  indistinguishable from "no PR yet," so a query that matches nothing looks exactly like a fleet with no PRs
  open. Nothing reddens, the waker keeps escalating at 6h, and the item reads as delivered. This is why the
  argv is pinned by a test and not merely exercised through a fixture.

## Verified & resolved 2026-08-16 — shipped via merged PR #1263, status was stale

Re-verified against the live tree before resolving (a queue-generation scan flagged this card's `status: open`
as lagging reality; checked independently rather than trusted):

- **PR [#1263](../../pull/1263)** ("WE #3095: give the dispatch observer a real completion signal — its PR",
  head `lane/build-3095`) is `state: MERGED`, merge commit `6c81e73f`, which is an ancestor of `origin/main`
  HEAD.
- [we:scripts/operations/dispatch-lane-io.mjs](../scripts/operations/dispatch-lane-io.mjs) imports
  `laneRefItemNum` (from `we:scripts/conveyor/lease-reaper.mjs`) and `classifyPr` (from
  `we:scripts/conveyor/pr-watch.mjs`), and wires the PR-classification / stale-predecessor logic this card
  specified (`:37-38`, `:670-843`).
- [we:scripts/conveyor/lease-reaper.mjs](../scripts/conveyor/lease-reaper.mjs)'s `laneRefItemNum` grammar was
  widened per Task 4 (`bornAs`-hash refs) — confirmed reachable and tested.
- The argv-pin test ("asks for `--state all`…") exists at
  [we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs](../scripts/operations/__tests__/dispatch-lane-defaults.test.mjs)`:132`,
  and the stale-predecessor case exists at
  [we:scripts/operations/__tests__/dispatch-lane.test.mjs](../scripts/operations/__tests__/dispatch-lane.test.mjs)`:885-994`.
- Full operations + lease-reaper suite — 630 tests across 18 files, all green (`npx vitest run`).
- `npm run check:standards` — 0 errors on the current tree.

All Done-when items are satisfied by code already on `main`; nothing further to build.
