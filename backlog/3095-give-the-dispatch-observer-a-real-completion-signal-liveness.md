---
bornAs: x9ylkp7
kind: story
size: 3
parent: "3029"
status: open
blockedBy: ["3037"]
dateOpened: "2026-08-13"
scope:
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/wake.mjs
  - we:scripts/conveyor/pr-watch.mjs
scopeRationale: "Changes the dispatch observer (we:scripts/operations/dispatch-lane-io.mjs's createDispatchObservers), its registration in the waker (we:scripts/operations/wake.mjs), and reads we:scripts/conveyor/pr-watch.mjs's classifyPr as a library function rather than its CLI form."
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
#x9ylkp7)... this is the deliberate, not the only, way [to remedy it]"*. So the manual close-out path is not
this item's job. **What remains is the automatic path** — the first two acceptance bullets, unchanged from the
original card.

## What it must not do

Do not weaken the `OBSERVATIONS` vocabulary in `we:scripts/operations/effect-observer.mjs` (currently
`['running', 'succeeded', 'unresolved']` — `succeeded` is already DECLARED, just never REACHED by the dispatch
observer). There is still no word for "failed" — two earlier vocabularies had one and each re-ran real work —
and an `unresolved` answer must keep writing nothing. A genuinely ambiguous outcome still asks a person; only a
provably clean one resolves.

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

1. **Discover by branch name at observe time.** The dispatch entry already knows its lane's branch (needed to
   spawn the agent in the first place). At each observe pass, `gh pr list --head=<branch> --json state,mergedAt,labels`
   for that branch; empty result → no PR yet, stays `'pending'`-equivalent (same as today's `unresolved`).
   No new write path, purely additive on the read side — matches the "no control-flow change beyond resolving
   cleanly" spirit the rest of this card holds to. Cost: one more `gh` shell-out per observe pass per in-flight
   entry, alongside the existing `claude agents` one.
2. **The dispatched agent's brief writes the PR number back** once it opens one, via a new field on the run
   store's effect entry. No extra `gh` call at observe time, but adds a write-back responsibility to the
   delivery-agent brief (`we:skills-src/conveyor/delivery-agent-brief.md`) that does not exist today, and a
   brief that stops short of opening a PR (exactly the failure mode `we:backlog/3105-the-gate-outruns-the-agent-foreground-window-so-an-agent-can.md`
   , the gate-timeout card, documents happening) leaves the field never written — silently falling back to
   today's `unresolved`, which is at least fail-safe, but harder to distinguish from "hasn't opened a PR yet."

**Recommend (1)** — it needs no change to the dispatch/brief write path, which keeps this item's stated
"no control-flow change" boundary honest, and it degrades safely (a `gh pr list` returning empty is
indistinguishable from "no PR yet," which is correct). This needs a ruling before the build starts, not a
silent pick — name it explicitly in the PR that builds this.

## Interfaces and protocol

```js
// we:scripts/conveyor/pr-watch.mjs — already exported, read-only import, no change needed
export function classifyPr(pr) // -> 'pending' | 'merged' | 'closed' | 'parked'
```

```js
// we:scripts/operations/dispatch-lane-io.mjs — createDispatchObservers, extended
// New helper, shape TBD by whoever builds it against approach (1) above:
async function resolveViaPr({ branch, listPrsForBranch = defaultListPrsForBranch }) {
  const prs = await listPrsForBranch(branch); // gh pr list --head=<branch> --json state,mergedAt,labels
  if (!prs.length) return 'pending';
  return classifyPr(prs[0]);
}
// In the observer's decision: classification === 'merged' -> 'succeeded'; 'pending' -> fall through to the
// existing liveness-based 'running'/'unresolved' logic unchanged; 'closed'/'parked' -> 'unresolved' (ambiguous).
```

`OBSERVATIONS` (`we:scripts/operations/effect-observer.mjs:68`) and `TERMINAL_STATUS`
(`we:scripts/operations/effect-observer.mjs:74`, `{ succeeded: 'applied' }`) need no changes — the vocabulary
already has the word this item needs to finally reach.

## Tasks

1. Rule the PR-discovery fork above (recommend approach 1) before writing code.
2. Add an injectable `listPrsForBranch` (mirroring the existing injectable `listAgents` pattern already used
   for the liveness check, per `we:scripts/operations/wake.mjs`'s `closeOutEntry`) so the observer stays
   testable with no real `gh` call.
3. Wire the PR-classification check into `createDispatchObservers`, before or alongside the liveness check —
   decide ordering: a merged PR with a still-listed live agent (the agent exited slowly after its PR merged)
   should resolve `succeeded` regardless of liveness, so the PR check should likely run FIRST, not as a
   fallback after liveness says "not running."
4. Test each classification maps to the right observation, including the two ambiguous ones (`closed`,
   `parked`) staying `unresolved`, and the no-PR-yet case behaving exactly as today.
5. Confirm the waker's `STUCK_ESCALATION_HOURS` clock and the corpus of existing dispatch tests are unaffected
   for entries that never reach a PR at all (the dominant case until #3096 lands real dispatch).

## Done when

- [ ] A dispatched entry whose PR merged resolves to `succeeded`/`applied` without a person, verified with an
      injected PR-classification fixture (no real `gh pr list` call in tests).
- [ ] The waker stops re-reporting a resolved entry on the next pass.
- [ ] An entry whose PR is `closed` (abandoned) or `parked` (mid-review) still answers `unresolved`, still
      writes nothing — the ambiguous cases are not silently resolved.
- [ ] The PR-discovery fork (branch-lookup vs. write-back) is ruled, and the ruling is recorded on this card
      before the code lands, not implied by the diff.
- [ ] `closeOutEntry` (already shipped) is unchanged by this item — the manual path and the new automatic path
      coexist without one needing the other.

## Delivery shape

Lands in one piece behind `main` — one new read (PR classification), gated to fire only when today's liveness
read is not itself dispositive. No schema migration on the run store (no new persisted field, under the
recommended approach). No slicing needed at size 3.

## Watch for

- Don't let `succeeded` become reachable for anything short of `classifyPr`'s `'merged'` — a `closed` PR is NOT
  a success, even though it is terminal, and conflating "terminal" with "succeeded" is exactly the shape of bug
  this card exists to close.
- If approach 2 (write-back) is chosen instead of the recommended approach 1, its silent-fallback risk (a brief
  that never opens a PR) needs its own explicit watch-for in the build, tied to the gate-timeout card's evidence.
