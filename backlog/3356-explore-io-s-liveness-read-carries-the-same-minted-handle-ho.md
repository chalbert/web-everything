---
bornAs: xwb8luf
kind: story
size: 2
parent: "3029"
status: open
relatedTo: ["3096", "3095", "3331", "3150"]
scope: ["we:scripts/operations/explore-io.mjs", "we:scripts/operations/__tests__/explore.test.mjs"]
scopeRationale: "File-level. One branch is added to the liveness axis of `createExploreObservers` in we:scripts/operations/explore-io.mjs, and the tests that redden for it land in the existing observer describe block of we:scripts/operations/__tests__/explore.test.mjs (there is no we:scripts/operations/__tests__/explore-io.test.mjs — the io shell is tested from we:scripts/operations/__tests__/explore.test.mjs). Nothing in we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/dispatch-lane.mjs or we:scripts/operations/wake.mjs is touched: those three sites belong to the sibling card and this one deliberately lands AFTER them so it copies their shape rather than guessing a second one."
dateOpened: "2026-08-26"
tags: [plateau-loop, delivery, operations, explore]
---

# explore-io's liveness read carries the same minted-handle hole as the two dispatch === handle sites

`we:scripts/operations/explore-io.mjs:822` asks whether a panelist is alive by comparing a handle the sink
**minted** against `claude agents --json`, guarded only by `!Array.isArray`. A listing that parses but yields
no usable id therefore reads as *the panelist is gone*. The dispatch observer's version of that mistake parks
the entry and writes nothing. This one has a third answer the dispatch observer does not have: with a
half-written report on disk it returns `resolved`, the run advances, and the synthesis reads a truncated
report as if the panelist had died.

## The compare, and where the handle comes from

The liveness axis of `createExploreObservers` reads:

```js
// we:scripts/operations/explore-io.mjs:817-822
if (listed === undefined) listed = listAgents();
const sessions = listed;
if (!Array.isArray(sessions)) {
  throw new TypeError('explore-io: `claude agents --json` did not return an array');
}
if (sessions.some((s) => s && String(s.sessionId) === handle)) return { status: 'running', result: null };
```

`handle` is `String(ctx?.handle ?? entry?.handle ?? '')` (**we:scripts/operations/explore-io.mjs:795**), and the entry's handle is
the id the sink chose: `const sessionId = String(mintSessionId())` at **we:scripts/operations/explore-io.mjs:342**, returned as
`inFlight({ handle: sessionId, … })` at **we:scripts/operations/explore-io.mjs:380**. Its own `@file` header names the contract at
**we:scripts/operations/explore-io.mjs:12-14** — *"the panelist spawn is `claude --bg --session-id <uuid>`, the SAME minted-handle
contract `dispatch-lane`'s sink established (#3037) — the id is chosen before the agent exists"* — and
**we:scripts/operations/explore-io.mjs:172-175** repeats it for the observer: *"The sink knows the id because it minted it; the
observer knows it because it is the entry's `handle`."*

That is the same contract `createDispatchSinks`'s docblock states at
**we:scripts/operations/dispatch-lane-io.mjs:582-587** — *"THE HANDLE IS MINTED, NOT DISCOVERED, and that is the load-bearing
detail"* — over the mint at **we:scripts/operations/dispatch-lane-io.mjs:631**. Both docblocks are describing the sink they sit on,
and in both files the mint is what makes the id trustworthy. Neither says anything about what to do when the
listing cannot be matched, and that is the gap.

## Identical to two of the three sites #3353 covers — and NOT to the third

`grep -rn "=== handle" scripts/ --include=*.mjs` returns exactly three lines in the repo at `7584ecc1`:

| site | line | what precedes it | what a non-empty-but-unmatchable listing does |
| --- | --- | --- | --- |
| `createDispatchObservers` | `we:scripts/operations/dispatch-lane-io.mjs:811` (`.find`) | `!Array.isArray` throw, **808-810** | grace check **816-819**, then `unresolved` **820-825** — writes nothing |
| `assertHandleNotLive` | `we:scripts/operations/wake.mjs:340` (`.some`) | `!Array.isArray` throw, **334-339** | returns, so `--resolve` closes out a possibly-live agent |
| **this card** | **`we:scripts/operations/explore-io.mjs:822`** (`.some`) | `!Array.isArray` throw, **819-821** | grace check **825-828**, then **`resolved` 835-842** *or* `unresolved` **843-849** |

Against `createDispatchObservers` the match is exact, not approximate: same predicate shape
(`sessions.some/find((s) => s && String(s.sessionId) === handle)`), same array-only guard immediately before
it, same `LISTING_GRACE_MS` fallback immediately after it, same minted handle read off `ctx`/`entry`, and the
same missing branch — *the listing was read, it held things, none of them was a matchable id*.

**`stampLiveness` is the one that is only similar.** It does not compare with `===` at all: it builds
`new Set(sessions.map((s) => String(s?.sessionId ?? '')).filter(Boolean))` at
**we:scripts/operations/dispatch-lane-io.mjs:340** and tests membership at **342**. The wrong *assumption* is shared; the
expression is not. A builder who copies a fix written for `stampLiveness`'s Set into line 822 is porting the
wrong shape — copy the `createDispatchObservers` fix.

## Where the consequence differs, and why that changes the fix

`we:backlog/3353-*.md` calls this site's cost *"closes out an investigation rather than starting a second
agent in an occupied lane."* True, and it is worth being more exact, because the tail here has three exits,
not two:

- **A half-written report exists → `resolved`, and the run ADVANCES.** Lines **835-842** return
  `status: 'resolved'` with `endedCleanly: false` and a `TRUNCATED` error string. That path is deliberate for
  a genuinely dead panelist — the comment at **830-834** explains why `unresolved` would park a whole
  committee behind one dead seat — but it is reached by an unreadable listing too, and then the synthesis
  consumes a partial report from a panelist that is still writing. Nothing parks and nobody is asked.
- **No report at all → `unresolved`** (lines **843-849**), which is where a person gets involved. Only this
  exit matches the dispatch observer's.

So the fix cannot simply be "return the observer error instead of falling through": on the report-present
path, falling through today produces `resolved`, and `resolved` is a write, not a park. The new branch has to
sit **before** the report tail at line 830, not merely before line 843.

There is also a smaller, adjacent difference worth knowing before touching this file: explore-io does not
share the dispatch grace constant. `LISTING_GRACE_MS` here is a local literal, `2 * 60 * 1000` at
**we:scripts/operations/explore-io.mjs:128**, while the dispatch side derives it from `DISPATCH_LISTING_GRACE_MINUTES = 2`
(**we:scripts/operations/dispatch-lane.mjs:131** → **we:scripts/operations/dispatch-lane-io.mjs:115**). The two numbers agree today by coincidence. That
is not this card's job to fix and it is named only so nobody assumes editing the dispatch constant moves this
one.

## The file already knows the principle it does not apply here

Axis 1 of this same observer has the rule written on it. **we:scripts/operations/explore-io.mjs:799-800**, sitting on the
`try`/`catch` around the report read: *"A read that FAILS is not a verdict: an unreadable scratch root
degrades this axis to off and falls through to liveness, rather than closing out an investigation on a
filesystem hiccup."* Axis 2 is the one with nowhere to fall through to, and it is the axis that has no such
guard.

## Verified — the three failing behaviours, run against `7584ecc1`

A throwaway script imported `createExploreObservers` and drove `INVESTIGATE_EFFECT` with the same fixtures
`we:scripts/operations/__tests__/explore.test.mjs:508-520` uses (`handle: 'sess-1'`, `startedAt` one hour
before `now`, so the grace window at line 826 is closed):

```
A (non-empty, unmatchable, partial report) -> resolved | session sess-1 is gone and p1's report does not end…
B (non-empty, unmatchable, no report)      -> unresolved
C (listing echoes id in other case)        -> unresolved
```

- **A** — `listAgents: () => [{ pid: 4242 }, { sessionId: '' }]` plus a half-written report. The listing was
  read and could not be matched, and the answer is a `resolved` write with a truncated report.
- **B** — the same listing with no report. `unresolved`, i.e. "the session is gone", asserted from a read that
  said nothing.
- **C** — `listAgents: () => [{ sessionId: 'SESS-1' }]`, the id echoed back in another case. The exact compare
  misses and the panelist reads as gone. This is hardening 3 of `#3353` reaching the same line.

## Ordering: this lands AFTER #3353, but is not a `blockedBy` edge yet

`#3353` is not on `main` — it exists only on the unmerged branch `origin/lane/split-3096`. Putting it in
`blockedBy` today would trip `we:scripts/check-standards.mjs:814` (*"blockedBy … does not resolve to an
existing item"*) and add an error to a currently-clean gate. **Add `blockedBy: ["3353"]` — or its landed
number — once that card is on `main`.** The ordering is real and is `#3353`'s own instruction: *"File it as
its own card once hardening 2's shape is settled, so it copies a landed pattern instead of a second guess."*

## Not in scope

- **The three dispatch sites** — `we:scripts/operations/dispatch-lane-io.mjs:340/342` and `:811`, `we:scripts/operations/wake.mjs:340`. Those are
  `#3353`, and its `Done when` counts the repo-wide `=== handle` sites down to **1** on the expectation
  that this line is still standing when it lands. Touching them here would break that count.
- **Giving explore-io its own named grace constant, or sharing the dispatch one.** Named above; a different
  change with a different argument.
- **Hardening 4 (`lastSeenLiveAt`) and hardening 5 (a separate guard grace).** Both are about
  `dispatchStillHolds` in `we:scripts/operations/dispatch-lane.mjs`. `explore` has no equivalent guard — its
  liveness read feeds an observer only — so neither has a target here.

## Acceptance

A `claude agents --json` listing that parses as a non-empty array but yields no matchable session id is read
as *unreadable* by the `explore` observer, not as *the panelist is gone*: it returns neither `resolved` nor
`unresolved`, and in particular never emits a `TRUNCATED` report result on the strength of an unreadable
listing. The comparison is whitespace- and case-tolerant on both sides, matching whatever `#3353` landed
for the dispatch sites. Both are covered by tests that redden when the branch is reverted.

## Done when

Every count and every run below was taken in a lane clone at `origin/main` `7584ecc1` on 2026-08-26 and
**fails today** — each one was checked, and none of them is a criterion that already passes.

1. **Executable — a non-empty listing that yields no matchable id stops producing a `resolved` TRUNCATED
   report.** Driving `createExploreObservers`' `INVESTIGATE_EFFECT` with
   `listAgents: () => [{ pid: 4242 }, { sessionId: '' }]`, `readReport: () => '# p1\n\nI got two paragraphs in'`,
   an entry `handle` of `'sess-1'` and a `startedAt` an hour before `now` — the fixtures at
   `we:scripts/operations/__tests__/explore.test.mjs:508-520`, which put the grace window at line 826 already
   closed — returns today:

   ```
   A (non-empty, unmatchable, partial report) -> resolved
      error: "session sess-1 is gone and p1's report does not end with the completion marker…"
   ```

   It must return neither `resolved` nor `unresolved`. A test asserting that lands in the
   *"the observer — the report axis first, liveness second"* describe block at
   `we:scripts/operations/__tests__/explore.test.mjs:507`, and it reddens when the new branch is reverted.

2. **Executable — the same listing with NO report stops asserting the session is gone.** Same fixtures,
   `readReport: () => null`, returns today:

   ```
   B (non-empty, unmatchable, no report) -> unresolved
      error: "session sess-1 is no longer listed by `claude agents`…"
   ```

   That sentence is a claim the read did not support. It must stop being made, with its own test.

3. **Executable — a listing that echoes the id in another case no longer reads as gone.** Same fixtures with
   `listAgents: () => [{ sessionId: 'SESS-1' }]` and no report returns today:

   ```
   C (listing echoes id in other case) -> unresolved
   ```

   It must return `running`, normalized on both sides the way `#3353` normalized
   `we:scripts/operations/dispatch-lane-io.mjs:811`. Covered by its own test in the same block.

4. **Executable — the new exit sits ABOVE the report tail, not merely above the `unresolved` return.** The
   span from the handle compare to the `if (body)` block holds exactly one exit today, the grace-window
   `return` at line 827:

   ```
   $ awk 'NR>=822 && NR<=835' scripts/operations/explore-io.mjs | grep -cE '^\s*(return|throw)'
   1
   ```

   Must rise to **2**. The count is deliberately mechanism-neutral — whether `#3353` settles on a throw
   (as its hardening 2 proposes for `createDispatchObservers`) or on an early `running` return, either lands
   in this span. Placed below line 835 instead, the fix would still emit a truncated report on an unreadable
   listing, which is the failure this card exists for. A whole-file `grep -c unreadable` would NOT do here: it
   already returns **2** against an unrelated `scaffold` error string at line 477 and the axis-1 comment at
   line 799, so it would pass without any work.

**Gate, not a criterion:** `npm run check:standards` must show no new errors and no new warnings against the
baseline measured at build time. Do not hard-code a number — it was **0 errors / 1438 warnings** at
`7584ecc1` on 2026-08-26, measured twice, and it moves most days. Note this differs from `#3353`'s recorded
baseline of 1 error: that error was the stranded-hash card `backlog/3350-*.md`, JIT-numbered to `#3350` in
commit `fad31663`, so it is no longer stranded. Run the gate **twice** and compare — the loader is
non-deterministic in the presence of any malformed card.
