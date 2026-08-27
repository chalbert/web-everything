---
bornAs: x3884p1
kind: story
size: 3
status: resolved
relatedTo: ["2748", "3151"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
preparedDate: "2026-08-26"
tags: [lane-pool, lease, concurrency, reaper]
---

# The lease reaper reclaims a lane seconds after it is acquired, so concurrent acquires all collide on one lane

`we:scripts/lane-pool.mjs acquire` runs the `#2748` ghost-lease reaper first, and the reaper judges a lease dead by a **terminal signal about the item the session slug names** — never by whether the lease itself is alive. A lane handed out seconds ago is therefore reclaimed on the next acquire, which then returns the same lane. Re-reproduced in this lane against a private throwaway pool: **seven back-to-back acquires with eight free lanes all returned `lane-1`**, each printing `reaped lane-1 before acquire (pr-merged)` against a lease seconds old. Concurrency collapses to a single lane.

## Reproduced in this lane, this session — real mechanism, not a double

Per the `#3264` tier-1 qualifier, this is a real pool: a real bare origin, a real reference clone, real
`we:scripts/lane-pool.mjs` child processes, under a private `LANE_POOL_ROOT` (no network, no shared pool). Eight lanes
provisioned, **no `release` between acquires**, backlog cards `1`–`7` pushed `status: resolved` to
`origin/main` — which mirrors the real backlog (see the grounding note below).

```
resolved cards on origin/main: 1 2 3 4 5 6 7 | 8 lanes provisioned | NO release between acquires
  acquire #1 --session=probe1  -> lane-1
  acquire #2 --session=probe2  -> lane-1  [reaped lane-1 (pr-merged)]
  acquire #3 --session=probe3  -> lane-1  [reaped lane-1 (pr-merged)]
  acquire #4 --session=probe4  -> lane-1  [reaped lane-1 (pr-merged)]
  acquire #5 --session=probe5  -> lane-1  [reaped lane-1 (pr-merged)]
  acquire #6 --session=probe6  -> lane-1  [reaped lane-1 (pr-merged)]
  acquire #7 --session=probe7  -> lane-1  [reaped lane-1 (pr-merged)]
  -> 1 distinct across 7 acquires
```

The same shape under a **genuine** conveyor slug, card `9999` `resolved`, five acquires with the *same*
slug — `conveyor-9999` → `'9999'` either way, so no aliasing is involved:

```
  acquire #1..#5 --session=conveyor-9999 -> lane-1, lane-1, lane-1, lane-1, lane-1
  lanes still holding a lease: 1
```

**Why the seven-acquire chain sustains, stated rather than assumed.** Each acquire's reap target is the
*previous* caller's lease, so the chain only continues while every successive aliased number names a resolved
card. Checked on `origin/main` today — `we:backlog/001-resource-specs-and-plans.md`, `we:backlog/002-injector-domain-concept-carry-forward.md`,
`we:backlog/003-map-statement-analysis.md`, `we:backlog/004-validation-engine-open-design-points.md`,
`we:backlog/005-validation-spec-versioning-adherence-tooling.md`, `we:backlog/006-gap-10-collection-ops-intent.md` and
`we:backlog/007-gap-11-clipboard-dnd-files-intents.md` are **all `status: resolved`**. Control, measured the same way:
with **only** card `1` resolved the chain breaks after one collision — seven acquires returned
`lane-1, lane-1, lane-2, lane-3, lane-4, lane-5, NONE` (5 distinct), because `probe2` aliases onto item `2`,
whose card is then absent. See retraction (g).

## Which axis actually fired — shown, not asserted

The reason string `pr-merged` is emitted by **two** different axes, and it was **not** the merged-PR one.
`we:scripts/lane-pool.mjs:893-899` builds the signal (two comment lines at `:896-897` elided; the trailing
comment on `:899` reads *"the pid axis is dormant under today's lease schema"*):

```js
const num = itemNumFromSession(c.lease?.session);
let prState = prStates && num ? (prStates.get(num) ?? null) : null;
if (prState !== 'open' && prState !== 'merged' && prState !== 'closed' && itemResolvedOnMain(num)) prState = 'merged';
return { prState, pidAlive: null };
```

`classifyReap` (`we:scripts/conveyor/lease-reaper.mjs:110`) then maps `'merged'` → reason `pr-merged`, and
the acquire-side log at `we:scripts/lane-pool.mjs:910` prints that reason — so an **item resolved on `main`**
and a **merged PR** are indistinguishable in the transcript. Re-measured in this lane, this session:

| step | result |
| --- | --- |
| `itemNumFromSession('rv1566j')` | `'1566'` |
| `itemNumFromSession('probe1')` | `'1'` |
| the PR axis, run as the code runs it — `gh pr list --state all --limit 400` (`we:scripts/lane-pool.mjs:880`) → `prStatesFromList` | 400 PRs scanned, **43** keyed by `laneRefItemNum` |
| the same at `--limit 1000` (the limit the previous version of this card measured — **not** what the code runs) | 1000 scanned, **306** keyed |
| `prStates.get('1566')` | `undefined` at **both** limits (→ `null` via `?? null` at `we:scripts/lane-pool.mjs:895`) |
| `prStates.get('1')` | `undefined` at **both** limits (→ `null` via `?? null` at `we:scripts/lane-pool.mjs:895`) |
| `we:backlog/1566-decision-we-renderer-conformance-…md` on `origin/main` | `status: resolved` (`dateResolved: "2026-06-22"`) |
| `we:backlog/001-resource-specs-and-plans.md` on `origin/main` | `status: resolved` (`dateResolved: "2026-06-06"`) |

So the PR axis **produced no signal** for either reap — the lookup ran and missed, at either limit. Both reaps
fired on the offline item-resolved axis at `we:scripts/lane-pool.mjs:898`. See retraction (e) for the limit.

## The defect, stated precisely

Two independent bugs compose. A fix that closes only the first leaves the measured collapse intact.

**1. A terminal signal about the item is used as a proxy for "is anyone using this lane?"**
*"The lane's item is finished"* — its PR merged **or** its card resolved on `main` — answers **is there
unlanded work here?** It does not answer **is anyone holding this lease?** `classifyReap`
(`we:scripts/conveyor/lease-reaper.mjs:104-117`) returns `pr-merged` on that terminal signal at `:110`,
**before** the `isLeaseStale` test at `:113`, and `signalsFor` hard-codes `pidAlive: null`
(`we:scripts/lane-pool.mjs:899`), so no axis consults liveness at all. The proxy is sound for a lease whose
holder has exited and stale for every lease that has not.

**2. `itemNumFromSession` aliases any digit-tailed session slug onto a backlog item.**
`we:scripts/conveyor/lease-reaper.mjs:60-63` reads the trailing digit-run of **any** session slug as an item
number:

```js
const m = String(session ?? '').match(/(\d+)[a-z]?$/i);
```

`probe1` is not item 1. `rv1566j` is a review-juror session for **PR** 1566, not **item** 1566. Any slug
ending in digits aliases onto whatever card those digits name — and if that card is `resolved`, the lease is
reapable the instant it is minted. **Holder liveness alone does not close this**; the aliasing does. This is
the root cause of the two reaps above, and neither was a lease whose item was genuinely finished.

**How big the aliasing target is, measured with the code's own predicate.** Running
`itemResolvedOnMain`'s exact regex (`^backlog/0*<num>-`, `we:scripts/lane-pool.mjs:888`) over
`git ls-tree origin/main -- backlog/` for every id `1..3325` (the live id range at `29dd36b1`): **3299** ids
resolve to a card, and **2628** of those cards are `status: resolved` — so **79.0% of the id space `1..3325`
is instantly reapable**. A digit-tailed slug landing anywhere in that range is far more likely than not to
alias onto a reapable card. The absolute counts drift as the backlog grows (they moved three times while this
card was being prepared); the stable claim is the ratio — roughly four in five ids name a reapable card.

**The default session is itself a digit-tailed slug.** `defaultSession()` (`we:scripts/lane-pool.mjs:526`)
falls back to `` `${hostname()}:${process.ppid}` ``, and `cmdAcquire` calls it at `we:scripts/lane-pool.mjs:933`
— so an acquire with no `--session`/`LANE_SESSION` mints a lease named `Mac:<ppid>`, whose trailing digit run
is a pid. That is a production path, not a probe artifact; it bites whenever a ppid falls inside `1..3322`.
`we:scripts/conveyor/__tests__/lease-reaper.test.mjs:37` asserts exactly this aliasing today (retraction (f)).

## RETRACTION — claims in earlier versions of this card that were false

**(a) The pid claim.** The first version ended the diagnosis with:

> *"…nothing consults holder liveness, which the pool already records: the holder slug carries a pid
> (`Mac:<pid>`), and the release path already checks it."*

**All three halves are false**, and an implementer trusting them would go looking for reusable plumbing that
does not exist:

- `mintHolderSlug` (`we:scripts/lane-pool.mjs:536-539`) is
  `` `${tag}-${basename(dir)}-${randomBytes(4).toString('hex')}` `` (the return at `:538`) — e.g.
  `review-juror-lane-24-8475edf6`. No pid, no host, nothing liveness-derived.
- `Mac:<pid>` is `defaultSession()` (`we:scripts/lane-pool.mjs:526`), a **different field**, and the number
  in it is the **shell's `ppid`**, not any holder's pid.
- The release path never checks liveness — verified, no match in either file that holds it:

  ```
  $ grep -n "process.kill" scripts/lane-pool.mjs scripts/lib/lane-lease.mjs
  (no matches)
  ```

  (The repo's one `process.kill` is inside `pidAliveForLease`, `we:scripts/conveyor/lease-reaper.mjs:217` —
  the dormant axis discussed below, not the release path.) `leaseOwnedByCaller`
  (`we:scripts/lib/lane-lease.mjs:249-281`) is **string equality on every branch** — exact `session`, the
  minted holder slug, then `ownerSession` — an ownership proof, never a liveness test.

The lease's real `pid` field (`we:scripts/lane-pool.mjs:797`, `pid: process.pid`) records the short-lived
`lane-pool acquire` CLI. `pidAliveForLease` (`we:scripts/conveyor/lease-reaper.mjs:203-222`) already documents
that this is **not** the delivery agent ("an LLM has no unix pid"), that a literal check on it "is
meaningless", and that `agentPid` is the plug-in point for a trustworthy signal. **The retracted sentence
proposed as new plumbing something the codebase had already evaluated and deliberately left dormant.** It is
struck rather than deleted, per this repo's convention.

**(b) "This is one predicate."** The first version's *Not in scope* section said:

> *"Changing which lane `acquire` picks, or the lease format. This is one predicate."*

**Two axes feed `prState`** at `we:scripts/lane-pool.mjs:894-898`, and the one this card's evidence exercises
is the item-resolved axis, not the PR axis. The first version's Criterion 4 mutation ("restoring the
merged-PR-only predicate") therefore mutated an axis that provably did not fire in the repro — an implementer
could have satisfied every criterion against the PR axis and left the demonstrated collapse fully intact.
Case 6(a) below is restated against the axis the fix touches, and 6(b) against the aliasing.

**(c) The `scope:` list was wrong twice, and incomplete a third time.** It named
`we:scripts/__tests__/lane-pool.test.mjs`, which **does not exist** in this checkout (re-confirmed today), and
omitted both files that hold the predicate: `we:scripts/conveyor/lease-reaper.mjs` (`classifyReap` — the
single-sourced verdict) and `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs`. It still omitted a
fourth file — see retraction (f). The frontmatter above is corrected.

**(d) Criterion 3 named a real test as proof of a property that test does not assert.** The second version
of this card's Criterion 3 read:

> *"a lane whose item is genuinely finished **and** whose holder is gone is still reaped, so `#2748`'s
> behaviour is preserved rather than traded away. Green today and must stay green — the existing
> `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73` case must not be weakened."*

**The named case has no holder-is-gone condition, and its ghost is not stale — it is seconds old.** `:73` is
the describe line and `:74` its first `it`; opened and run in this lane, this session (5/5 green):

```js
describe('lane-pool #2748 — acquire reaps a provably-dead (item-resolved) ghost before allocating', () => {
  it('reaps a lease whose item is RESOLVED on origin/main when a fresh acquire runs', () => {
    pushCard('9999', 'resolved');                     // :75
    const ghost = acquire(1, 'conveyor-9999');        // :76 — minted milliseconds before the reaping acquire
    …
    expect(existsSync(LEASE_FILE(ghost))).toBe(false); // :82 — ghost reaped
```

`DEFAULT_LEASE_TTL_MINUTES = 240` (`we:scripts/lib/lane-lease.mjs:35`), so that ghost is nowhere near
TTL-stale, and `pidAlive` is hard-coded `null` at `we:scripts/lane-pool.mjs:899`. It is **structurally the
same liveness state** as the `probe1` lease Criterion 1 says must *not* be reaped; the only thing separating
them is that `conveyor-9999` is a genuine conveyor slug and `probe1` is not.

So the two criteria pinned **opposite outcomes for the same liveness state**, and the consequence was that
defect 1 could not be fixed at all: closing defect 2 alone left `we:scripts/lane-pool.mjs:898` untouched, so
the old Criterion 5's mutation had no guard to revert; closing defect 1 as well turned `:74` red, which the
retracted sentence forbade. Cases 3 and 4 below replace it — case 3 is the fresh-lease outcome the fix must
invert, case 4 is the TTL-stale one `#2748` genuinely owns — and both say plainly that `:74` is expected to
change. Struck rather than deleted, per this repo's convention.

The old Criterion 5 was wrong in a second way that fell out of the same confusion: it claimed reverting the
`:898` guard would redden case 1. It would not — case 1 uses `probe1`, which defect 2's fix alone already
protects. Case 6 below splits the mutation in two so each one reddens a case that depends on exactly one
fix.

**(e) The PR-axis row measured a command the code does not run.** The previous version's evidence table read:

> | `gh pr list --state all --limit 1000` → `prStatesFromList` | 1000 PRs scanned, **307** keyed by `laneRefItemNum` |

`we:scripts/lane-pool.mjs:880` runs **`--limit 400`**, not `--limit 1000` — so the row measured a wider window
than the reap path ever sees. Re-run both ways today: at the code's own `--limit 400`, **400 scanned, 43
keyed**; at `--limit 1000`, **1000 scanned, 306 keyed** — not 307 either. **The conclusion survives
unchanged** — `get('1566')` and `get('1')` are `undefined` at *both* limits, so the PR axis produced no
signal — but the number and the command were wrong and are corrected in the table above. (The periodic reaper
at `we:scripts/conveyor/lease-reaper.mjs:233` defaults to the same 400, overridable via `--pr-limit`.)

**(f) A second existing test asserts the aliasing, and its file was missing from `scope:`.** Every prior
version named only `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` as the test surface. But
`itemNumFromSession` is unit-tested in a **different** file that no version listed —
`we:scripts/conveyor/__tests__/lease-reaper.test.mjs` — and two of its assertions pin the exact behaviour
defect 2's fix must invert. Opened and run in this lane, this session:

```js
  it('a non-item session → null', () => {                            // :36
    expect(itemNumFromSession('Mac:24827')).toBe('24827'); // :37 — trailing digits are the ppid — still a number
```

```js
    expect(itemNumFromSession('conveyor-3095')).toBe('7');              // :84
    expect(states.get(itemNumFromSession('conveyor-3095'))).toBeUndefined(); // :85
```

`:37` sits inside an `it` **titled** *"a non-item session → null"* and then asserts a non-item session
resolves to `'24827'` — the test's own name already describes the behaviour this card wants, and the
assertion under it contradicts the name. `:84` aliases a **hash-id** lease slug (`conveyor-3095`, for the
hash item `3095`) onto item `7`, whose card *is* `resolved` on `main`. Both go red under Criterion 2, and
the file is now in `scope:`. This is the same class as (d) — a criterion that did not name the assertions it
would break — and is exactly what `we:backlog/3285-…` was filed to catch.

**(g) The seven-acquire repro was stated without its precondition.** The previous version reported seven
acquires all returning `lane-24` but never said *why the chain sustained*: it requires every successive
aliased number to name a `resolved` card. Verified today (cards `001`–`007` are all resolved) and
re-reproduced in a private pool. The control matters and was missing: with only card `1` resolved the same
seven acquires yield **5 distinct lanes**, not 1. The original claim holds; its grounding did not exist.

**(h) Two re-measurements, corrected in place.** Not false claims — figures that did not reproduce here, and
this repo's rule is to re-run every one:

- The `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` suite was reported at **99.35s**. Measured in this lane today:
  **5 passed (5), 18.97s**. The 5/5-green half reproduces exactly; the timing does not, and wall-clock is
  machine-dependent, so it is stated as measured here and load-bears nothing.
- `leaseOwnedByCaller` was cited as `we:scripts/lib/lane-lease.mjs:249-255`. The function spans **`:249-281`**;
  `:249-255` covered only its first two branches. The conclusion is unchanged and now covers the whole
  function — every branch is string equality, none is a liveness test.

**Prevention for the two classes, filed with this fix:**

- `we:backlog/3284-gate-a-backlog-filing-that-asserts-existing-code-behaviour-m.md` — warn at
  `check:standards` time when a new, unlanded filing asserts existing code behaviour with no `file:line`
  citation in the same paragraph. Covers (a).
- `we:backlog/3285-review-lens-an-acceptance-criterion-that-names-an-existing-t.md` — a `correctness`
  lens clause: a criterion naming a concrete test location must quote the assertion it relies on. Covers
  (d) and (f), which the first card does **not** reach — there the citation resolves and the test is real;
  what is false is what the test is said to prove, or that it was never named at all.

## Why this is worse than a stale-lease annoyance

**It silently destroys concurrency.** Seven reviewers launched in parallel are each handed the same lane —
reproduced above. Two consequences, and the second is the dangerous one:

1. `review-pr`'s juror spawn passes through `assertLaneCwd` (`we:scripts/lib/judge-spawn.mjs:245`, `#3151`),
   which at `:273-276` refuses a juror `cwd` that resolves to the **driver's own lane** — *"the juror would be
   pointed at the working tree its caller is mid-run in, and its mandate is to mutate that tree"*. So those
   runs fail — loudly, which is the good case.
2. Where nothing checks, **two agents work in one clone**. The whole lane model rests on one worker per
   checkout, and the guard that enforces it keys on the lease this reaper just gave away.

It also inverts the reaper's own purpose. `#2748` exists to reclaim leases whose holder is gone. Here the
holder is a process that started seconds ago and is about to `cd` into the lane.

## Scope — both defects, decided

**Defect 1 is in scope.** Closing only defect 2 would leave the collapse reachable under a *legitimate*
slug — measured above: five acquires under `conveyor-9999`, a genuine slug, all returned `lane-1` once
`#9999` read `resolved`. The aliasing widens the blast radius; the liveness proxy is what makes any of it
fire. So the fix must gate **both** axes that feed `prState` (`we:scripts/lane-pool.mjs:894-898`) on a
staleness or liveness signal, and must stop `itemNumFromSession`
(`we:scripts/conveyor/lease-reaper.mjs:60-63`) aliasing arbitrary digit-tailed slugs.

This narrows `#2748`: after the fix, a terminal signal about the item is **necessary but not sufficient** to
reap. Cases 3 and 4 below state that narrowing explicitly — including which existing assertions are expected
to go red — rather than hiding it behind the word "preserved".

**Not in scope:** changing which lane `acquire` picks, or the lease format. Also out of scope, and **not
filed** — naming it here rather than absorbing it: the `Mac:<ppid>` default-session shape
(`we:scripts/lane-pool.mjs:526`) is a *lease-naming* question, not a reaper one. Defect 2's fix makes
`Mac:24827` resolve to `null`, which is sufficient for this card; whether acquire should refuse to mint an
ambiguous default session at all is a separate call nobody has made.

## Done when

Five proof cases, one mutation case, one gate — the ladder's 3–5 cap counts the proof cases. Cases 1–2 pin
defect 2, cases 3–4 pin defect 1, and case 5 pins the property that actually broke. Each mutation in case 6
reddens a case that depends on exactly one of the two fixes — that is why cases 3 and 4 have to exist
separately from case 1. Cases 1, 3, 4 and 5 drive the **real** `we:scripts/lane-pool.mjs` against a real pool under a
private `LANE_POOL_ROOT`, satisfying the `#3264` tier-1 mechanism qualifier (a stub returning `''` has no
clone geometry); case 2 is the pure unit half.

1. **Executable** — a lease minted seconds ago whose session slug **aliases** onto a resolved backlog item
   (`--session=probe1` against a resolved `#1`): acquire does **not** reap it, and returns a **different**
   lane. **Fails today**, measured in this lane: seven acquires with eight free lanes returned `lane-1`
   seven times, 1 distinct.
2. **Executable** — `itemNumFromSession` (`we:scripts/conveyor/lease-reaper.mjs:60-63`) no longer treats an
   arbitrary digit-tailed slug as an item number: a genuine conveyor slug (`conveyor-2500`,
   `prepare-decision-2500`, retry suffix `conveyor-2500b`) still resolves to `'2500'`, while `probe1`,
   `rv1566j`, `Mac:24827` and `conveyor-3095` resolve to `null`. **Fails today** — measured in this lane,
   all of them resolve the old way: `'2500'`, `'2500'`, `'2500'`, `'1'`, `'1566'`, `'24827'`, `'7'`; only
   `'fresh'` → `null`.

   **Two existing assertions are expected to go red, named with the text they assert.** In
   `we:scripts/conveyor/__tests__/lease-reaper.test.mjs`: `:37`
   `expect(itemNumFromSession('Mac:24827')).toBe('24827')` — inside an `it` at `:36` titled *"a non-item
   session → null"*, so the fix makes the assertion agree with its own test name; and `:84`
   `expect(itemNumFromSession('conveyor-3095')).toBe('7')`, whose follow-on `:85`
   (`expect(states.get(…)).toBeUndefined()`) stays green either way, since `null` and `'7'` both miss the
   hash key. Re-point `:37`/`:84`, don't weaken them. Say so in the commit.
3. **Executable, and this is a NEW case that fails today** — a lease minted seconds ago under a **genuine**
   conveyor slug whose item is resolved on `main` (`--session=conveyor-9999`, card `9999` `resolved`) is
   **not** reaped. This is the narrowing: a terminal signal about the item stops being sufficient on its
   own. Defect 2's fix does **not** produce this — `conveyor-9999` resolves to `'9999'` either way — so this
   case is the one that forces defect 1 to be closed. **Fails today**, measured in this lane: five acquires
   under `conveyor-9999` all returned `lane-1`, with one lease left in the pool.

   **It is the inverse of an assertion that exists today.**
   `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:74` (the first `it` of the `:73` describe block)
   mints exactly this lease with `acquire(1, 'conveyor-9999')` at `:76` and asserts at `:82` that it **is**
   reaped (plus `:83`, `expect(r.err).toMatch(/reaped lane-1 before acquire/)`). Both assertions are
   **expected to go red** and must be re-pointed at the TTL-stale ghost of case 4. Say so in the commit;
   this is `#2748` being deliberately narrowed, not weakened by accident.
4. **Executable, must stay green** — the same lease, but **TTL-stale**: backdated past
   `DEFAULT_LEASE_TTL_MINUTES = 240` (`we:scripts/lib/lane-lease.mjs:35`) with its card `resolved` on
   `main`, is still reaped. `#2748`'s reclaim of a genuinely dead lease survives the narrowing. Alongside
   it, the two `does NOT reap` cases in the same file (`:86` item still open, `:94` no card at all), the
   reserved-lane case (`:101`) and the `--no-reap` opt-out (`:110`) stay green **untouched** — the file is
   5/5 green in this lane today (18.97s), so any red among those four is a regression, not a narrowing.
5. **Executable** — N successive acquire calls with no release between them return **N distinct lanes**
   while N free lanes exist, for **both** slug shapes: aliased (`probe1`…`probeN`) and genuine-but-resolved
   (`conveyor-9999` for a resolved `#9999`). This is the property that actually broke, and no case above
   states it. **Fails today on both halves**, measured in this lane: 7 acquires → **1** distinct lane
   (aliased), 5 acquires → **1** distinct lane (genuine).
6. **Mutation** — two mutations, one per defect, each reddening a case the other cannot cover:
   - (a) revert the staleness/liveness guard on the **item-resolved** coercion at
     `we:scripts/lane-pool.mjs:898` (the axis the repro fired on) → reddens case 3 and the
     genuine-but-resolved half of case 5 **by name**, and leaves cases 1, 2 and 4 green.
   - (b) revert `itemNumFromSession`'s tightening at `we:scripts/conveyor/lease-reaper.mjs:60-63` →
     reddens cases 1, 2 and the aliased half of case 5 **by name**, and leaves cases 3 and 4 green.
   - If the fix also gates the **PR** axis at `we:scripts/lane-pool.mjs:895`, a third mutation there must
     redden a case of its own — the repro never exercised that axis (`get('1566')` and `get('1')` were
     `undefined` at both `--limit 400` and `--limit 1000`), so a case for it has to be written, not
     inherited.
7. `npm run check:standards` — no new errors and no new warnings against a baseline you
   **measure yourself at build time**. The requirement is the *delta*, not the absolute count, because the
   count moved four times during this prep alone. Measured here at `origin/main` `29dd36b1`, base and after
   run back-to-back on the same commit: **0 errors, 1436 warnings** both ways, and the two finding lists
   diff **byte-identical** — this card's body adds nothing to the gate.

   The drift, recorded so the next reader does not mistake it for a regression: **1 error / 1435 warnings**
   at `0b8db7b7` (stranded filing `3323`), **0 / 1435** at `a2f0cf3c` after the drain JIT-numbered it to
   `#3323`, **2 / 1436** at `ad5a1947` (two fresh stranded filings, `3324` and `3325`), **0 / 1436** at
   `29dd36b1` after the drain numbered those to `#3324`/`#3325`. Every one of those swings came from other
   lanes landing, none from this card. Compare like for like against a base you took yourself, never against
   this line.
