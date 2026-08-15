---
kind: story
size: 5
parent: "1650"
status: open
locus: plateau-app
blockedBy: ["xzewkfa"]
scope:
  - plateau-app:tsconfig.json
  - plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts
  - plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts
dateOpened: "2026-08-15"
tags: [dev-browser, safe-edit, sandbox, epic-1650, autofix]
---

# Safe-edit sandbox: verify-gate wiring over declared rules

Slice 2 of 3 under epic [#1650](/backlog/1650-safe-edit-sandbox-emitting-a-pr/). Blocked on Slice 1 —
[#xzewkfa](/backlog/xzewkfa-safe-edit-sandbox-live-edit-propose-apply-revert-buffer/) — for the
`SafeEditBuffer` this wraps. Reuses `we:scripts/autofix/engine.mjs`'s pure, already-shipped
propose->apply->verify->accept/revert loop (backlog #095, resolved) **directly, by cross-repo import**,
against a live app instead of `check:standards`: a new `verify` callback runs the app's own
declared-rules registry (#1689) + the runtime `ConformanceVectorOracle` over the buffer's pending
content, so a proposed edit is gated by the app's own declared rules before Slice 3 can offer to emit it.

## Scope, including consumers

**Touches:**
- `plateau-app:tsconfig.json` — add one new `paths` alias, `@webeverything/autofix-engine`, pointing at
  `we:scripts/autofix/engine.mjs` (as a sibling-repo relative path), following the **already-established
  pattern** of every other `@webeverything/*` alias already in this file (e.g. line 80:
  `@webeverything/conformance-vectors/schema` pointing at `we:conformance-vectors/schema.ts` the same
  way) — read directly from `plateau-app:tsconfig.json` before writing this card, so this is not a new
  cross-repo mechanism, only a new entry in an existing table.
- `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` — the `verify`/`read`/`write` callback
  adapters + a thin `runVerifyGate()` wrapper around `autofix()`.
- `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts` — vitest coverage, including a
  fixture app registered in the declared-rules registry so the gate has something real to check against.

**Consumers:**
- Slice 3 — [#x00bvy0](/backlog/x00bvy0-safe-edit-sandbox-discard-or-emit-pr-orchestration/) calls
  `runVerifyGate()` and only offers "emit" once its result reports the edit `applied` (gate-passed), never
  on a `gaveUp`/`skipped` result.
- **No other consumer exists yet** — same reasoning as Slice 1: the directory is new, nothing shells it,
  and no other package imports `safe-edit/` today (confirmed by the grep already run in Slice 1's card).

**A genuinely open interface risk, de-risked here rather than left for the build** (per the
story-preparation-checklist item 8 — de-risk during prep, not during the build): does a **pure, `.mjs`,
no-fs, no-process, no-network** module actually resolve cleanly when imported from a Vite/vitest
TypeScript project via a sibling-repo path alias, the same way the existing `.ts` `@webeverything/*`
aliases do? `we:scripts/autofix/engine.mjs`'s own header states it is "PURE — no fs, no process, no
network" and its only imports are sibling files in the same directory, declared pure by the same header —
so there is no reason it *wouldn't* resolve the same way a `.ts` sibling-repo import does; the residual
risk is purely mechanical (Vite's default `server.fs.allow` root restriction, which the existing
`@webeverything/*` aliases already had to clear for this workspace to build at all — so it is already
cleared, not a fresh unknown). This is recorded as a **task**, not a design fork: confirm it with a
one-line smoke import before writing the real adapter, and if it fails, the fallback (documented, not
silently taken) is to vendor a copy of the two exported pure functions this slice actually calls
(`autofix` and its `VerifyState`/`AutofixOptions` shapes; `registerReferenceFixers` is NOT needed — no
reference fixers are registered here) rather than block the slice on a cross-repo build fix.

## Decided design

**Reuse the engine unmodified — write only a new `verify` callback (and `read`/`write` adapters over
Slice 1's buffer), never a second verify-gate implementation.** This is a deliberate reuse decision, not
a default: `we:scripts/autofix/engine.mjs`'s own design note states the loop is "pure — no fs, no
process, no network... takes injected `verify`/`read`/`write` callbacks, so the SAME loop runs against
the real suite... or against an in-memory fixture" — i.e. the engine was already built to be
injected-into for exactly this kind of second consumer, so building a parallel "live-edit autofix loop"
in plateau-app would duplicate a loop that already exists and is already tested (6 vitest cases at
`we:scripts/autofix/__tests__/engine.test.mjs`).

> **Review fix (2026-08-15, PR #1355):** the `read`/`write` bullet below originally set
> `read = SafeEditBuffer.get(key)?.after`. Traced against the real engine
> (`we:scripts/autofix/engine.mjs`, lines 326-330), the engine's own revert only ever restores
> `snapshot = read(patch.file)` — the value `read` returned **immediately before** the fixer's write. With
> `read` wired to `.after`, that snapshot is *also* `after` (the fixer's "fix" returns `after` verbatim, so
> nothing ever changes it) — so the "revert" was writing `after` back over `after`: a no-op that never
> reaches `edit.before`. That breaks this card's own Done-when bullet below. Fixed by decoupling `read`
> (now a fixed, immutable source for the engine's snapshot bookkeeping only) from what `verify` actually
> inspects (the buffer's real mutable content) — see the corrected bullets.

> **Review fix (2026-08-15, PR #1355, round 2):** the `runVerifyGate`'s `ok`/`findings` bullet below
> originally had `verify` overwrite a single mutable closure variable (`lastFindings`) on **every** call,
> then had `runVerifyGate` read it once at the end. Traced by hand against the real engine
> (`we:scripts/autofix/engine.mjs`, lines 291-365) on a **failing** edit, `verify()` is called **four**
> times per `runVerifyGate()` invocation, not once:
> 1. Line 293, round 1's `before = await verify()` — checks the buffer's real, untouched `edit.after` →
>    genuinely fails. This is the ONLY call whose content the engine has not yet touched.
> 2. Line 331, the same round's post-write `after = await verify()` — checks the buffer immediately after
>    the single hand-written fixer's write. That fixer only echoes `edit.after` back verbatim (this slice
>    registers no content-mutating fixer), so the buffer's content here is **bit-identical** to call 1's —
>    same failure, same result.
> 3. Line 293 again, the **next** round's `before = await verify()` — but the engine has, in between,
>    already taken its revert branch (line 353: `write(patch.file, snapshot)`, landing `edit.before` back
>    in the buffer) and recorded the give-up. This call checks the **reverted, now-passing** buffer — a
>    different, later, and by design misleading state for our purposes.
> 4. Line 363, the trailing `final = await verify()` — checks the same already-reverted buffer again.
>
> With `lastFindings` overwritten on every call, calls 3 and 4 clobber the real failing findings captured
> in calls 1–2 with `[]`, so `runVerifyGate` returned `{ ok: true, findings: [] }` for an edit that
> genuinely violated its gate — the reverse of this card's own Done-when bullet, and worse than round 1's
> no-op: round 1 shipped an inert no-op, this shipped a false pass a real edit could ride to a real file
> write (Slice 3's `emitEdit()` trusts this boolean alone).
>
> **Fixed by a settle-once latch, not a "last write wins" variable.** `verify`'s closure captures its
> report into a **frozen** `settledFindings` snapshot on its own **first call only** within a given
> `runVerifyGate()` invocation, then ignores every call after that for reporting purposes (the return
> value `{ ok, failures }` — what the *engine* uses to drive its own loop — is still computed fresh on
> every call; only the externally-reported snapshot is frozen). This is provably equivalent to freezing at
> "the call immediately before the revert decision" (call 2) for this design specifically, because calls 1
> and 2 are guaranteed bit-identical: the buffer is untouched before call 1, and the single fixer this
> slice registers never mutates content (it only echoes `edit.after`), so nothing changes between them.
> Freezing at call 1 is simpler than trying to detect "the call right before a revert" from inside a
> closure that has no visibility into the engine's own bookkeeping (`settledKeys`, `gaveUp`, round number)
> — it needs no call-counting or round-tracking, just "don't let anything overwrite the first answer." A
> `settled`-boolean-gated "latch on first non-empty call" was considered instead (freeze only once a
> failure is actually observed, keep tracking empty calls) — rejected as strictly more machinery for the
> same outcome here: since call 1 is always the untouched ground truth (nothing has run yet when it fires),
> there is never a correct reason for a later call to improve on it, whether call 1 was empty or not.
> **Scope boundary, stated not silently assumed:** this latch is sound *because* this slice registers only
> the one echo-fixer. If a later slice ever registers a real content-mutating fixer here (multiple rounds,
> genuine re-fix attempts), "freeze at call 1" would go stale — a future change must re-derive the latch
> point (e.g. freeze at the last call before `settledKeys` gains this edit's key) rather than reuse this
> reasoning unmodified.
>
> **Review fix (2026-08-15, PR #1355, round 3): the boundary above was prose-only — nothing enforced it.**
> Reviewed as "impact: degraded" — a future engineer editing
> `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` to add a second, content-mutating fixer
> would silently violate the settle-once latch's single-fixer precondition, with no test or assertion
> reddening to catch it; the file would keep compiling and passing every other test while quietly
> reintroducing round 2's false-pass bug class. Fixed two ways, both checkable now (this slice owns
> `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` and constructs the fixer registry itself
> — this is not a "some future slice, elsewhere" risk, it is this file's own registration path):
> 1. **Runtime assertion in `runVerifyGate()`, not deferred to a future implementation.** Before calling
>    `autofix()`, assert the fixer registry it is about to pass in resolves to exactly one fixer for the
>    synthetic `pending:${key}` failure kind — throw synchronously (a programming-error throw, per this
>    card's own "throws only on a programming error" contract below) if not. This makes "more than one
>    fixer registered" fail loudly the moment someone adds a second one, instead of silently drifting.
> 2. **A same-content assertion on the one fixer that IS registered.** The single-purpose fixer's `fix()`
>    asserts (dev-mode, throws on violation) that the patch it is about to return is bit-identical to what
>    it read — i.e. it actually is a no-op echo, not just documented as one. A future engineer who edits the
>    fixer body to actually transform content (rather than adding a second fixer) reddens this assertion
>    immediately rather than silently invalidating the "calls 1 and 2 are bit-identical" argument the latch
>    depends on.
>
> Both are captured as real Tasks/Done-when items below (see Task 5 and the corresponding Done-when
> bullet), not left as a comment a future implementer could silently ignore.
>
> **Review fix (2026-08-15, PR #1355, round 4).** Two findings, both in this callout:
> 1. **Stale cross-reference** — the line above pointed to "Task 6," but the two guards it describes (the
>    fixer-count throw and the bit-identical throw) are Task 5's content; Task 6 is only "run `npm test`
>    scoped to the new files." Fixed by correcting the pointer to Task 5 (above).
> 2. **Only one test scenario existed for two guards.** Task 5's one described test (register a SECOND,
>    content-mutating fixer, assert `runVerifyGate()` throws) can only ever exercise guard 1 (the
>    fixer-count check), because that check runs *before* `autofix()` is called, so the second fixer's own
>    `fix()` — and therefore guard 2, the bit-identical assertion inside the single fixer's `fix()` — is
>    never reached by that scenario. Guard 2 had no test of its own: if a future engineer implemented guard
>    1 correctly but never actually wrote guard 2's bit-identical assertion (or wrote it wrong), no test
>    would catch it, and round 2's false-pass bug class could reappear silently the day the fixer body is
>    edited in place instead of a second fixer being added. Fixed by adding a SECOND, distinct test
>    scenario to Task 5/Done-when — see below — that keeps the fixer count at exactly one (so guard 1
>    does not short-circuit) but makes that one fixer return content that differs from what it read (a
>    stand-in for "someone edited the fixer body to actually transform content"), isolating guard 2.

> **Review fix (2026-08-15, PR #1355, round 7) — DEGRADED finding, closed with a stated invariant plus a
> test that would catch its violation, not just prose.** The round-6 review traced
> `ConformanceVectorOracle.run()` (`we:packages/core/src/conformance-engine/conformanceVectors.ts:297-301`,
> in the `plateau-app` repo) and found it contains genuine internal `await`s (`await
> this.#bindings.create(vector)`, `await runConformanceVector(...)`). The round-2/round-4 safety arguments
> above are true **only** because `verify`'s closure reads the buffer synchronously, as its first
> statement, before ever calling into that async oracle — an ordering nothing above actually asserts or
> tests. A future engineer who reorders `verify` (e.g. to look up `linkage()` from a registry that grows an
> `await` of its own, ahead of the buffer read) would silently reopen the exact TOCTOU class rounds 1–4
> already spent effort closing, with every existing test still green, because none of them can distinguish
> "read before the await" from "read after it" — they only ever exercise the single-threaded, no-real-race
> case.
>
> **The invariant, stated as a testable precondition, not left implicit:** *no `await` may occur between
> `verify()` being invoked and its first, synchronous read of `buffer.get(key)?.after` into a local.*
> Everything downstream of that point — including the call into `ConformanceVectorOracle` — must operate on
> that local, never on a fresh buffer read.
>
> **Enforced two ways:**
> 1. **Structurally, by construction:** `verify`'s implementation is written as `const content =
>    buffer.get(key)?.after; /* ... then, and only then ... */ const findings = await
>    checkContentAgainstVectors({ ruleKind, appId, content, registry, index });` — i.e. the buffer read is
>    textually the callback's first statement and nothing before it can await, because nothing precedes it.
>    (`checkContentAgainstVectors` is a new exported helper — see the Interfaces block below — factoring the
>    oracle call out of the closure so `x00bvy0` can reuse the same check for its `before.passed` field
>    without going through the whole `autofix()` loop; see that card's round-7 fix.)
> 2. **With a regression test that fails if a future implementation violates the invariant, not just one
>    that happens to pass under the current single-threaded implementation.** The test fakes
>    `checkContentAgainstVectors` (or the oracle it wraps) so that, as a side effect *inside* the fake, on
>    its first invocation it mutates the buffer for the same key (`buffer.write(key, 'mutated-during-oracle-await')`)
>    before resolving — simulating exactly the race finding 2 describes: the buffer changing while the
>    oracle's own `await` is outstanding. The test then asserts `runVerifyGate()`'s reported result reflects
>    the PRE-mutation content's pass/fail outcome, not the post-mutation one. This test is meaningless (and
>    passes vacuously) against an implementation that reads the buffer only ONCE before the fake's mutation
>    can land — which is exactly the point: it can only stay green if the buffer read genuinely precedes the
>    async call, so a future reorder that moved the read after an `await` would make this test fail loudly,
>    where every prior test stays green. See Task 4a and its Done-when bullet.
> - **Gap in the above, found in round 8 review:** the fault-injection point (inside the fake
>   `checkContentAgainstVectors`) only fires *after* `content` has already been captured in **every**
>   ordering, including the buggy one this callout's own motivating example names — `await
>   registry.linkage(appId, index)` inserted **before** the `content` capture, not just between the capture
>   and the oracle call. Because the fake only mutates as a side effect of `checkContentAgainstVectors`
>   itself running, a reorder that moves the buffer read to *after* an earlier, independent `await` (the
>   named `linkage()` example) still has `content` captured immediately before `checkContentAgainstVectors`
>   is called in the reordered version too — so the injected mutation is still strictly post-capture, and
>   Task 4a's test stays green despite the invariant being violated one line earlier than where it's
>   checking. See Task 4b (new, round 9), which retargets the injection to the earlier site the example
>   itself names, closing this gap without weakening Task 4a (which still catches the later-reorder case Task
>   4b does not).

> **Review fix (2026-08-15, PR #1355, round 9) — the authoritative statement of what the real engine does on
> a pass, reconciling this card's `write` bullet below with `x00bvy0`'s round-4 safety argument.** Round 8
> found the two cards making what read as directly opposed claims about `we:scripts/autofix/engine.mjs`'s
> pass-path behavior: this card's `write` bullet below says "on the pass path this writes `edit.after` back
> over itself"; `x00bvy0`'s round-4 paragraph says the engine's loop "exits at its very first `verify()` call
> with no fixer ever invoked" on a pass. **Both were independently-restated claims about the same external
> symbol — this section is now the single authoritative statement; `x00bvy0`'s round-4 paragraph has been
> edited to cite it rather than restate it (see that card).**
>
> Traced directly against the real, in-repo `we:scripts/autofix/engine.mjs` (lines 291–298 of `autofix()`):
> every round starts with `const before = await verify();` immediately followed by `if (before.ok) break;`
> — this check runs **before** the loop resolves a target, resolves a fixer, or calls `write()` at all. So
> **the two claims describe two different, non-overlapping cases, not a contradiction**:
> 1. **`x00bvy0` describes the case where `verify()`'s very first call, within a given `runVerifyGate()`
>    invocation, already reports `{ ok: true }`** — i.e. the live buffer content already satisfies its
>    linked vectors the moment the gate is asked to check it. In this case the loop breaks at line 294
>    immediately: no target is picked, `registry.resolve()` is never called, the single-purpose fixer's
>    `fix()` is never invoked, and `write()` is never called. `x00bvy0`'s claim is correct, exactly as
>    stated, for this case.
> 2. **This card's `write` bullet describes the case where `verify()`'s first call reports `{ ok: false }`**
>    (the synthetic `pending:${key}` `Failure` fires because the live content currently violates a linked
>    vector) — only then does the loop resolve the single-purpose fixer, call `write(patch.file,
>    patch.newContent)` (line 330) with the fixer's returned content, and re-verify. "On the pass path" in
>    that bullet means the **round's own accept branch** (`targetCleared && newFailures.length === 0` at line
>    337) — reachable only after an initial fail, never on a `runVerifyGate()` invocation that passed from
>    its very first check. Both claims are true; they are about different points in the loop.
>
> **The real hazard round 8 raised survives this reconciliation and is fixed here, at the source, rather
> than argued away.** The single-purpose fixer's `fix()` was previously specified only as "return the
> buffer's already-known `after` content verbatim," ambiguous about *when* that content is read — round 8
> correctly read this as a value captured once, earlier (e.g. at `emitEdit()`'s snapshot), not a fresh read.
> If so: in case 2 above, `write()` lands whatever the fixer returns, and if that's a **stale**, earlier-
> captured value rather than the buffer's *current* live content, it can silently overwrite a fresher write
> that landed on the same key between the fixer's capture and this `write()` call — `isCurrent()` at
> checkpoint A (in `x00bvy0`) only aborts `emitEdit()` itself; it does nothing to protect this internal
> engine-driven write from using stale data. **Fixed by making the single-purpose fixer's `fix()` read the
> buffer's CURRENT, live content fresh — synchronously, at `fix()`-call time — never a value captured
> earlier.** See the corrected fixer bullet below. With that fix, whatever `write()` echoes back is always
> whatever is genuinely live in the buffer at that instant, so the echo-write can never regress a fresher
> value to a staler one — it is a true no-op on the buffer's actual state, not merely a no-op relative to a
> snapshot that may already be wrong.

- **No `Fixer`/`fixerRegistry` is registered.** This slice never *proposes* a patch — Slice 1's buffer
  already holds the human/AI-proposed `after` content. `autofix()`'s `verify -> apply -> accept/revert`
  loop still runs, but with the fixer registry populated by exactly **one hand-written, single-purpose
  fixer registered just for this call**, whose job is to return the buffer's already-known `after`
  content verbatim for a **single synthetic `Failure`** meaning "there is a pending edit for this
  target" — the "fix" is a no-op lookup, not generation, so the loop's own verify/accept/revert machinery
  does all the real work unmodified. **(PR #1355 round 9)** The fixer's `fix()` reads that content
  **fresh from the live buffer, synchronously, at `fix()`-call time** (`buffer.get(key)?.after`) — never a
  value captured earlier (e.g. at gate-invocation start) — so the `write()` it triggers (see the read/write
  bullet below, and the round-9 callout above) can only ever echo back whatever is genuinely live at that
  instant, never a stale snapshot that could silently overwrite a fresher concurrent write on the same key.
- **`verify` callback:** its FIRST statement, synchronously and before anything else runs, is `const
  content = buffer.get(key)?.after;` (PR #1355 round 7 — see that round's callout above for why this
  ordering is the whole safety argument and how it is enforced, not just stated). Only after that local is
  captured does `verify` do any of its real work, all of it operating on `content`, never on a fresh buffer
  read: given the target's `ruleKind` and the app id, call
  `plateau-app:packages/dev-browser/src/declared-rules/registry.ts`'s `linkage(appId, index)` to find the
  vector ids gating this rule, then `await checkContentAgainstVectors({ ruleKind, appId, content, registry,
  index })` — a new exported helper (see Interfaces below) that runs `ConformanceVectorOracle`
  (`plateau-app:packages/core/src/conformance-engine/conformanceVectors.ts`) scoped to those vector ids
  against `content` and returns its `Finding[]`. `verify` maps that result to a **single synthetic
  `Failure`** (`{ id: `pending:${key}`, findings }`) when non-empty, or `{ ok: true, failures: [] }` when
  empty. The `{ ok, failures }` returned from *every* call is computed fresh from that call's own `content`
  capture — the engine needs the true current state each time to drive its own loop correctly (round-break,
  target-cleared, revert), and because `content` is re-captured (synchronously, first) on every call to
  `verify`, later calls DO see the buffer's true live state (e.g. post-revert) even though each individual
  call's own oracle check operates on a value nothing can change out from under it once captured. Separately,
  `verify` also snapshots its `Finding[]` into a closure variable
  (`settledFindings`) — but **only on its own first call** within this `runVerifyGate()` invocation; every
  call after the first computes and returns its own fresh `{ ok, failures }` for the engine as normal, but
  leaves `settledFindings` untouched. `runVerifyGate`'s return value reads from `settledFindings`, not from
  `autofix()`'s own `.ok`/`.applied`/`.gaveUp` (see the `runVerifyGate` bullet below for why the latch is
  first-call-only rather than "whatever ran last" — round 2 of PR #1355 found the naive "last write wins"
  version reports a false pass). If linkage yields zero vectors
  (an uncovered rule, #1641's own coverage-gap concept), `verify` degrades to `{ ok: true, failures: [] }`
  unconditionally — an edit to an undeclared/uncovered rule cannot be gated by a vector that doesn't exist,
  so it passes vacuously (surfaced to the human via the coverage badge already shipped by #1641's registry,
  not re-invented here).
- **`read`/`write` callbacks — corrected wiring:** these two calls serve **different** purposes inside
  `autofix()` and must not both point at the buffer's live, mutable content:
  - `read` returns the **fixed, immutable pre-edit baseline** — `edit.before`, captured once from
    `buffer.get(key)?.before` before the call, and returned as-is on every call regardless of the buffer's
    live state. The engine uses `read` for exactly one thing that matters here: the pre-write `snapshot`
    it captures right before writing the fixer's patch (`we:scripts/autofix/engine.mjs`, line 329), which
    is exactly what a **revert** restores (same file, lines 347/353). Wiring `read` to the fixed `before`
    means a revert correctly restores `before` — not whatever the buffer most recently held.
  - `write` = `SafeEditBuffer.write(key, content)` — the real, mutable side effect, unchanged from the
    original design. **(See the round-9 callout above for the authoritative statement of when this fires at
    all.)** On a round whose first `verify()` call already reports `{ ok: true }`, `write()` is never called
    — nothing writes anything (this is `x00bvy0`'s round-4 case). On a round whose first `verify()` call
    reports `{ ok: false }`, the engine calls the fixer and `write()`s its (now always freshly-read, per the
    fixer bullet above) content back — a no-op in content terms since the fixer just re-read what's already
    there — and if that round's re-verify then reports clean, the accept branch keeps it (`write` "on the
    pass path" in the sense of that round's own accept/revert branch, not the whole gate call); on the fail
    path the engine's own revert calls `write(file, snapshot)`, i.e. `SafeEditBuffer.write(key, edit.before)`
    — **this is the actual revert**, landing `before` in the real buffer.
  - `exists`/`remove` are left at the engine's defaults — `exists` just needs `read` to not throw (it
    never does, `edit.before` is always a real string for an existing pending edit), and `remove` (the
    file-didn't-exist path) is never reached since `existedBefore` is always `true` here.
- **`runVerifyGate`'s `ok`/`findings` come from `verify`'s own `settledFindings` latch, not from
  `AutofixResult`, and not from "whichever `verify()` call happened to run last."** Because the proposed
  edit may already pass on `autofix()`'s very first internal `verify()` call (before any target/fixer is
  ever touched), the loop can exit at `we:scripts/autofix/engine.mjs`, line 294 with `applied: []` and
  `gaveUp: []` — both empty on a **pass**, which makes `AutofixResult.applied.length > 0` / `.ok` unusable
  as the single-edit pass/fail signal (`.ok` reflects "is the whole run green," a different, run-level
  concept from "did this one edit's content just get reverted").
  - **Why not a plain "overwrite every call" variable:** `autofix()` calls `verify()` **more than once**
    per run even on a single failing edit — line 293 (round 1, pre-write), line 331 (round 1, post-write),
    line 293 again (round 2's pre-write check, which now runs **after** the engine's own revert already
    landed `edit.before` back in the buffer), and line 363 (the trailing `final = await verify()`, also
    post-revert). A variable that takes "whatever `verify` returned most recently" is overwritten by those
    last two, **post-revert** calls — which correctly see a passing buffer (that's the revert doing its
    job) but are the wrong thing to report externally, since they describe the *reverted* state, not the
    *proposed edit* that was actually being gated. Round 2 of PR #1355 traced this exact sequence by hand
    against the real engine and found it reports `{ ok: true, findings: [] }` for an edit that genuinely
    failed — see the round-2 review-fix callout above for the full call-by-call trace.
  - **The fix:** `verify`'s closure snapshots `settledFindings` on its **first call only** (see the `verify`
    callback bullet above) and freezes it there for the rest of the `runVerifyGate()` invocation.
    `runVerifyGate` returns `{ ok: settledFindings.length === 0, findings: settledFindings }`. `autofix()`
    is still called for what it's for — driving the buffer to the correct settled end-state (`after` kept
    on pass, `before` restored on fail) via its existing keep/revert bookkeeping — the reporting (frozen at
    call 1) and the buffer side-effect (evolves across all calls) are deliberately decoupled, the same way
    round 1's fix decoupled `read` (frozen) from what `verify` inspects (live).

## Interfaces and protocol

```ts
// plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts
// autofix() imported via the new tsconfig alias @webeverything/autofix-engine (see Scope above)
import { autofix } from '@webeverything/autofix-engine';
import type { SafeEditBuffer, DeclaredEdit } from './buffer';
import { DeclaredRuleRegistry, type VectorIndex } from '../declared-rules';
import type { DeclaredRuleKind } from '../declared-rules/types';
import { ConformanceVectorOracle } from '@plateau/core/conformance-engine'; // existing in-repo import, unchanged

export interface VerifyGateResult {
  /** Gate passed and the edit is kept in the buffer, unchanged from its proposed `after`. */
  readonly ok: boolean;
  /** Findings from the failing run, when `ok` is false — surfaced to the human, never silently dropped. */
  readonly findings: readonly { readonly detail: string }[];
}

/**
 * Run the app's declared-rules linkage + `ConformanceVectorOracle` check against one piece of already-
 * captured content — factored out of `verify`'s closure (PR #1355 round 7) so it (a) is the one place the
 * synchronous-read-then-async-check ordering has to be gotten right, and (b) is reusable by `x00bvy0`'s
 * `emitEdit()` to compute its `ConformanceEvidenceManifest.before.passed` field against `edit.before`
 * without engaging the whole `autofix()` loop for a value the loop itself never touches. Pure with respect
 * to the buffer — it takes `content` as a plain string, never reads the buffer itself, so it carries no
 * ordering risk of its own; the caller (`verify`, or `emitEdit()`) is the one responsible for capturing
 * `content` synchronously before calling this.
 */
export async function checkContentAgainstVectors(opts: {
  ruleKind: DeclaredRuleKind;
  appId: string;
  content: string;
  registry: DeclaredRuleRegistry;
  index: VectorIndex;
}): Promise<readonly { readonly detail: string }[]>;

/**
 * Run the verify-gate over one pending edit. Assembles the `verify`/`read`/`write` callbacks — `read`
 * fixed to `edit.before` (the engine's revert-snapshot source), `write` delegating to the buffer, `verify`
 * checking the buffer's live content on every call (so the engine's own loop always sees the true current
 * state) while latching its externally-reported `Finding[]` snapshot on its OWN FIRST call only, immune to
 * the engine's later post-revert re-checks — then delegates the propose/apply/accept/revert mechanics to
 * the shared autofix engine's `autofix()`, which drives the buffer to the correct end-state (`after` kept
 * on pass, `before` restored on fail). The returned `ok`/`findings` come from that frozen first-call
 * snapshot, not from `autofix()`'s run-level `AutofixResult` and not from whichever `verify()` call the
 * engine happened to make last.
 */
export async function runVerifyGate(opts: {
  buffer: SafeEditBuffer;
  edit: DeclaredEdit;
  appId: string;
  registry: DeclaredRuleRegistry;
  index: VectorIndex;
}): Promise<VerifyGateResult>;
```

`runVerifyGate` never throws on a failing gate — a failing verify is the **expected, common outcome**
(the whole point of the gate), reported via `VerifyGateResult.ok === false` with `findings` populated. It
throws only on a programming error (e.g. `edit.target.key` has no entry in `buffer` — mirrors Slice 1's
own `write`-on-absent-key throw contract).

## Tasks

1. Add the `@webeverything/autofix-engine` path alias to `plateau-app:tsconfig.json`, next to the
   existing `@webeverything/conformance-vectors/*` block.
2. Smoke-test the import in isolation (a throwaway `vite-node` one-liner is enough — not committed) to
   confirm the cross-repo `.mjs` import resolves before writing the real adapter; record the outcome in
   the PR description either way.
3. Write `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` — `checkContentAgainstVectors()`
   (the extracted, buffer-free linkage + oracle check, PR #1355 round 7), and the `verify`/`read`/`write`
   callback adapters (per the corrected wiring above: `verify` captures `content` synchronously as its
   first statement, then `await`s `checkContentAgainstVectors(content)`, computing a fresh `{ ok, failures
   }` from that call's own capture on *every* call, but latching its externally reported `Finding[]` into
   `settledFindings` on its own first call only; `read` fixed to `edit.before`), the single
   synthetic-`Failure` + single-purpose fixer, and `runVerifyGate()` (reading `{ ok, findings }` from
   `settledFindings`, never from `AutofixResult` and never from "whatever `verify()` ran last").
4. Write `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts` — a green-path case (edit
   passes, `ok: true`, and `buffer.get(key)?.after` still reads the proposed content — unchanged), a
   red-path case (edit fails a fixture vector, `ok: false` with findings, **and** `buffer.get(key)?.after`
   reads back as `edit.before`, confirmed by re-reading the buffer after the call — proves the engine's own
   revert path fired, not a no-op), and the zero-linkage-degrades-to-pass case. **The red-path case is the
   regression test for PR #1355 round 2** and must specifically assert the reported result stays `{ ok:
   false, findings: [...] }` even though `verify` is invoked multiple times by `autofix()` including calls
   made *after* the buffer has already been reverted to `before` (spy/count the `verify` mock's call
   arguments or instrument it to assert at least one post-revert call happened during the run, so the test
   can't silently pass by coincidence of only ever calling `verify` once).
4a. **Write the synchronous-first-read regression test (PR #1355 round 7, finding 2).** Fake
   `checkContentAgainstVectors` so that, on its first invocation only, as a side effect before it resolves,
   it calls `buffer.write(key, 'mutated-during-oracle-await')` on the same key `verify` is checking —
   simulating the buffer changing while `ConformanceVectorOracle`'s real internal `await`s are outstanding.
   Assert `runVerifyGate()`'s result matches the PRE-mutation content's expected pass/fail outcome, not the
   post-mutation one. This test can only pass against an implementation that captured `content` before
   calling the (now-mutating) fake — i.e. it fails loudly if a future refactor moves the buffer read after
   an `await`, where every other test in this file stays green regardless of that ordering. **This test's
   fault-injection point is inside `checkContentAgainstVectors`'s own fake, so it only catches a reorder that
   moves the buffer read to *after* that specific call — see Task 4b for the earlier-await case this one
   cannot catch (PR #1355 round 8/9).**
4b. **Write the earlier-await regression test (PR #1355 round 8 finding, closed round 9) — retargets the
   fault injection to the site the round-7 callout's own motivating example names, not just a later one.**
   Fake `registry.linkage` (the call `verify` makes immediately after capturing `content`, per the ordering
   above) so that, on its first invocation only, as a side effect before it resolves, it calls
   `buffer.write(key, 'mutated-during-linkage-await')` on the same key. Assert `runVerifyGate()`'s result
   matches the PRE-mutation content's expected pass/fail outcome, not the post-mutation one — same shape as
   Task 4a, but the mutation now fires at the exact site (an `await` ahead of the buffer read, per the
   round-7 callout's own `linkage()` example) that Task 4a's injection point cannot reach, because Task 4a's
   fake only ever runs *after* `content` has already been captured in every ordering including the buggy
   one. This test is meaningless (and passes vacuously) against the current implementation, where `content`
   is captured before `linkage` is ever called — that is the point: it can only stay green if the buffer
   read genuinely precedes every subsequent call, including one a future refactor might make async and move
   ahead of the read. Task 4a and 4b together cover both reorder directions named across rounds 7 and 8;
   neither subsumes the other.
5. **Enforce the single-fixer scope boundary (PR #1355 round 3) — do not leave it as prose.** In
   `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts`: (a) inside `runVerifyGate()`, before
   calling `autofix()`, assert the fixer registry resolves to exactly one fixer for the synthetic
   `pending:${key}` failure — throw synchronously if not; (b) inside the single-purpose fixer's `fix()`,
   assert (dev-mode, throws on violation) that the patch content it returns is bit-identical to what it
   read, i.e. it is genuinely a no-op echo. Add TWO tests in
   `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts`, one per guard, because guard (a)
   short-circuits before guard (b) ever runs and a single scenario can only ever exercise the first
   (PR #1355 round 4):
   - **Guard (a):** register a SECOND, content-mutating fixer (two fixers total for the synthetic
     `pending:${key}` failure) against a fixture buffer and assert `runVerifyGate()` throws rather than
     silently running the settle-once latch against a now-invalid precondition.
   - **Guard (b), isolated from guard (a):** keep exactly ONE fixer registered (so guard (a)'s
     exactly-one-fixer check passes and does not short-circuit) but make that one fixer return content that
     differs from what it read — a content-mutating single fixer, standing in for a future engineer having
     edited the fixer body in place instead of adding a second fixer — and assert `runVerifyGate()` throws
     from the bit-identical assertion inside `fix()`. This is the ONLY scenario that can actually reach and
     redden guard (b): with two fixers, `fix()` on the single-purpose fixer is never called at all.
6. Run `plateau-app:` `npm test` scoped to the new files.

## Done when

- `runVerifyGate()` against a fixture edit that satisfies its linked vectors returns `{ ok: true, findings: [] }`.
- `runVerifyGate()` against a fixture edit that violates a linked vector returns `{ ok: false, findings: [...] }`
  **and** the buffer's content for that target is back to `before` (proves the engine's own revert path
  fired, not a no-op) — **and this holds even though the underlying `verify` callback is invoked multiple
  times over the course of the run, including at least once after the engine's internal revert has already
  restored the buffer to its passing `before` state** (the PR #1355 round-2 regression: a naive "report
  whatever `verify` returned last" implementation reports a false `{ ok: true, findings: [] }` here instead).
- `runVerifyGate()` against an edit whose `ruleKind` has zero linked vectors returns `{ ok: true, findings: [] }`.
- **`runVerifyGate()` throws when the fixer registry it builds resolves to more than one fixer for the
  `pending:${key}` failure** — asserted by a test that registers a second, content-mutating fixer against a
  fixture buffer and confirms `runVerifyGate()` throws rather than silently proceeding (the PR #1355
  round-3 fix for the previously-prose-only single-fixer scope boundary).
- **The single-purpose fixer's `fix()` throws if the patch it would return is not bit-identical to what it
  read, exercised in isolation from the guard above** — asserted by a SEPARATE test (PR #1355 round 4) that
  keeps exactly ONE fixer registered but makes it return content different from what it read, and confirms
  `runVerifyGate()` throws; the round-3 two-fixer test above cannot exercise this guard on its own, because
  the fixer-count check throws before `autofix()` (and therefore `fix()`) is ever reached.
- **(PR #1355 round 7, finding 2; retargeted round 8, closed round 9) The synchronous-first-read invariant
  is mechanically enforced for BOTH reorder directions, not just documented and not just the later one:**
  the Task 4a test — where `checkContentAgainstVectors` mutates the buffer as a side effect of its first
  (otherwise-async) call, before resolving — passes only because `verify` already captured `content` before
  making that call, and would fail if a future implementation moved the buffer read after that particular
  `await`. **The Task 4b test closes the gap round 8 found in 4a alone:** it mutates the buffer inside a
  fake `registry.linkage` instead, so it would fail if a future implementation moved the buffer read after
  an *earlier* `await` (the round-7 callout's own named example — `linkage()` growing an `await` of its own,
  ahead of the buffer read) — a reorder Task 4a's own injection point cannot reach because Task 4a's fake
  only ever runs after `content` is already captured in either ordering.
- `plateau-app:` `npm test` is green with the new files included.

## Delivery shape

**Lands as one PR, incrementally behind `main`, once Slice 1 has landed.** Adds one
`plateau-app:tsconfig.json` path entry (additive, no existing alias touched) plus two new files in the
still-unwired `safe-edit/` directory; still nothing imports this package from the live app, so it remains
dead code from the running app's point of view until Slice 3 lands. No flag needed.
