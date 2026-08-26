---
kind: story
size: 3
status: open
relatedTo: ["2748", "3151"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs"]
dateOpened: "2026-08-26"
tags: [lane-pool, lease, concurrency, reaper]
---

# The lease reaper reclaims a lane seconds after it is acquired, so concurrent acquires all collide on one lane

`we:scripts/lane-pool.mjs acquire` runs the `#2748` ghost-lease reaper first, and the reaper judges a lease dead by a **terminal signal about the item the session slug names** — never by whether the lease itself is alive. A lane whose lease carries such a slug is therefore reclaimed **immediately after** being handed out, so the next acquire returns the same lane again. Measured 2026-08-26: seven back-to-back acquires all returned `lane-24`, each printing `reaped lane-24 before acquire (pr-merged; was leased by <the previous caller>) — ghost lease reclaimed (#2748)` against a lease under a minute old. Every concurrent worker collides on one lane.

## Reproduced, twice, with nothing else running

```
$ node scripts/lane-pool.mjs acquire --purpose=probe --session=probe1
  reaped lane-24 before acquire (pr-merged; was leased by rv1566j (review-juror) @ 2026-08-26T00:05:06Z) — ghost lease reclaimed (#2748)
  acquired lane-24 for probe1 → …/lane-24

$ node scripts/lane-pool.mjs acquire --purpose=probe --session=probe2
  reaped lane-24 before acquire (pr-merged; was leased by probe1 (probe) @ 2026-08-26T00:05:26Z) — ghost lease reclaimed (#2748)
  acquired lane-24 for probe2 → …/lane-24
```

Twenty seconds between the two, and `probe1`'s lease is reaped as a ghost.

## Which axis actually fired — shown, not asserted

The reason string `pr-merged` is emitted by **two** different axes, and it was **not** the merged-PR one.
`we:scripts/lane-pool.mjs:893-899` builds the signal:

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
| `gh pr list --state all --limit 1000` → `prStatesFromList` | 1000 PRs scanned, **307** keyed by `laneRefItemNum` |
| `prStates.get('1566')` | `undefined` (→ `null` via `?? null` at `we:scripts/lane-pool.mjs:895`) |
| `prStates.get('1')` | `undefined` (→ `null` via `?? null` at `we:scripts/lane-pool.mjs:895`) |
| `we:backlog/1566-decision-we-renderer-conformance-…md` on `origin/main` | `status: resolved` (`dateResolved: 2026-06-22`) |
| `we:backlog/001-resource-specs-and-plans.md` on `origin/main` | `status: resolved` (`dateResolved: 2026-06-06`) |

So the PR axis **produced no signal** for either reap — the lookup ran and missed. Both reaps fired on the
offline item-resolved-on-`main` axis at `we:scripts/lane-pool.mjs:898`. The existing test for that path is
named for it: `lane-pool #2748 — acquire reaps a provably-dead (item-resolved) ghost before allocating`
(`we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73`) — but see retraction (d): that test does not
assert what an earlier version of Criterion 3 said it did.

## The defect, stated precisely

Two independent bugs compose. A fix that closes only the first leaves the measured collapse intact.

**1. A terminal signal about the item is used as a proxy for "is anyone using this lane?"**
*"The lane's item is finished"* — its PR merged **or** its card resolved on `main` — answers **is there
unlanded work here?** It does not answer **is anyone holding this lease?** `classifyReap`
(`we:scripts/conveyor/lease-reaper.mjs:104-117`) returns `pr-merged` on that terminal signal **before any
staleness test**, and `signalsFor` hard-codes `pidAlive: null` (`we:scripts/lane-pool.mjs:899`), so no axis
consults liveness at all. The proxy is sound for a lease whose holder has exited and stale for every lease
that has not.

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

## RETRACTION — two claims in the first version of this card were false

**(a) The pid claim.** The first version ended the diagnosis with:

> *"…nothing consults holder liveness, which the pool already records: the holder slug carries a pid
> (`Mac:<pid>`), and the release path already checks it."*

**All three halves are false**, and an implementer trusting them would go looking for reusable plumbing that
does not exist:

- `mintHolderSlug` (`we:scripts/lane-pool.mjs:536-538`) is
  `` `${tag}-${basename(dir)}-${randomBytes(4).toString('hex')}` `` — e.g. `review-juror-lane-24-8475edf6`.
  No pid, no host, nothing liveness-derived.
- `Mac:<pid>` is `defaultSession()` (`we:scripts/lane-pool.mjs:526`), a **different field**, and the number
  in it is the **shell's `ppid`**, not any holder's pid.
- The release path never checks liveness — no match anywhere in either file:

  ```
  $ grep -n "process.kill" scripts/lane-pool.mjs scripts/lib/lane-lease.mjs
  (no matches)
  ```

  `leaseOwnedByCaller` (`we:scripts/lib/lane-lease.mjs:249-255`) is slug **string equality**, an ownership
  proof, not a liveness test.

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

**(c) The `scope:` list was wrong twice.** It named `we:scripts/__tests__/lane-pool.test.mjs`, which **does
not exist** in this checkout, and omitted both files that hold the predicate:
`we:scripts/conveyor/lease-reaper.mjs` (`classifyReap` — the single-sourced verdict) and
`we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` (the existing test for the axis that fired). The
frontmatter above is corrected.

**(d) Criterion 3 named a real test as proof of a property that test does not assert.** The second version
of this card's Criterion 3 read:

> *"a lane whose item is genuinely finished **and** whose holder is gone is still reaped, so `#2748`'s
> behaviour is preserved rather than traded away. Green today and must stay green — the existing
> `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73` case must not be weakened."*

**The named case has no holder-is-gone condition, and its ghost is not stale — it is seconds old.** `:73` is
the describe line and `:74` its first `it`; opened and run in this lane, this session (5/5 green, 99.35s):

```js
describe('lane-pool #2748 — acquire reaps a provably-dead (item-resolved) ghost before allocating', () => {
  it('reaps a lease whose item is RESOLVED on origin/main when a fresh acquire runs', () => {
    pushCard('9999', 'resolved');
    const ghost = acquire(1, 'conveyor-9999'); // ← the lease is minted milliseconds before the reaping acquire
    …
    expect(existsSync(LEASE_FILE(ghost))).toBe(false); // ghost reaped
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

**Prevention for the two classes, filed with this fix:**

- `we:backlog/x6fm4mx-gate-a-backlog-filing-that-asserts-existing-code-behaviour-m.md` — warn at
  `check:standards` time when a new, unlanded filing asserts existing code behaviour with no `file:line`
  citation in the same paragraph. Covers (a).
- `we:backlog/x9bca87-review-lens-an-acceptance-criterion-that-names-an-existing-t.md` — a `correctness`
  lens clause: a criterion naming a concrete test location must quote the assertion it relies on. Covers
  (d), which the first card does **not** reach — there the citation resolves and the test is real; what is
  false is what the test is said to prove.

## Why this is worse than a stale-lease annoyance

**It silently destroys concurrency.** Seven reviewers launched in parallel were each handed the same lane.
Two consequences, and the second is the dangerous one:

1. `review-pr`'s `assertLaneCwd` (`#3151`) refuses a juror lane that is the driver's lane, so those runs fail
   — loudly, which is the good case.
2. Where nothing checks, **two agents work in one clone**. The whole lane model rests on one worker per
   checkout, and the guard that enforces it keys on the lease this reaper just gave away.

It also inverts the reaper's own purpose. `#2748` exists to reclaim leases whose holder is gone. Here the
holder is a process that started seconds ago and is about to `cd` into the lane.

## Scope — both defects, decided

**Defect 1 is in scope.** Closing only defect 2 would leave the collapse reachable under a *legitimate*
slug: a live `conveyor-2500` lease, minted seconds ago, is still reaped the moment `#2500` is resolved on
`main`. The aliasing widens the blast radius; the liveness proxy is what makes any of it fire. So the fix
must gate **both** axes that feed `prState` (`we:scripts/lane-pool.mjs:894-898`) on a staleness or liveness
signal, and must stop `itemNumFromSession` (`we:scripts/conveyor/lease-reaper.mjs:60-63`) aliasing arbitrary
digit-tailed slugs.

This narrows `#2748`: after the fix, a terminal signal about the item is **necessary but not sufficient** to
reap. Cases 3 and 4 below state that narrowing explicitly — including which existing assertion is expected
to go red — rather than hiding it behind the word "preserved".

**Not in scope:** changing which lane `acquire` picks, or the lease format.

## Done when

Cases 1–2 pin defect 2, cases 3–4 pin defect 1, and case 5 pins the property that actually broke. Each
mutation in case 6 reddens a case that depends on exactly one of the two fixes — that is why cases 3 and 4
have to exist separately from case 1.

1. **Executable** — a lease minted seconds ago whose session slug **aliases** onto a resolved backlog item
   (`--session=probe1` against a resolved `#1`): acquire does **not** reap it, and returns a **different**
   lane. Fails today — this is the measured repro.
2. **Executable** — `itemNumFromSession` (`we:scripts/conveyor/lease-reaper.mjs:60-63`) no longer treats an
   arbitrary digit-tailed slug as an item number: a genuine conveyor slug (`conveyor-2500`,
   `prepare-decision-2500`, retry suffix `conveyor-2500b`) still resolves to `'2500'`, while `probe1` /
   `rv1566j` resolve to `null`. Measured today, all six resolve the old way: `'1'`, `'1566'`, `'2500'`,
   `'2500'`, `'2500'`, and `'fresh'` → `null`.
3. **Executable, and this is a NEW case that fails today** — a lease minted seconds ago under a **genuine**
   conveyor slug whose item is resolved on `main` (`--session=conveyor-9999`, card `9999` `resolved`) is
   **not** reaped. This is the narrowing: a terminal signal about the item stops being sufficient on its
   own. Defect 2's fix does **not** produce this — `conveyor-9999` resolves to `'9999'` either way — so this
   case is the one that forces defect 1 to be closed.

   **It is the inverse of an assertion that exists today.**
   `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:74` (the first `it` of the `:73` describe block)
   mints exactly this lease with `acquire(1, 'conveyor-9999')` and asserts it **is** reaped. That case is
   **expected to go red** and must be re-pointed at the TTL-stale ghost of case 4. Say so in the commit;
   this is `#2748` being deliberately narrowed, not weakened by accident.
4. **Executable, must stay green** — the same lease, but **TTL-stale**: backdated past
   `DEFAULT_LEASE_TTL_MINUTES = 240` (`we:scripts/lib/lane-lease.mjs:35`) with its card `resolved` on
   `main`, is still reaped. `#2748`'s reclaim of a genuinely dead lease survives the narrowing. Alongside
   it, the two `does NOT reap` cases in the same file (`:86` item still open, `:94` no card at all), the
   reserved-lane case (`:101`) and the `--no-reap` opt-out (`:110`) stay green **untouched** — 5/5 green in
   this lane today, so any red among those four is a regression, not a narrowing.
5. **Executable** — N successive acquire calls with no release between them return **N distinct lanes**
   while N free lanes exist, for **both** slug shapes: aliased (`probe1`…`probeN`) and genuine-but-resolved
   (`conveyor-9999` for a resolved `#9999`). This is the property that actually broke, and no case above
   states it.
6. **Mutation** — two mutations, one per defect, each reddening a case the other cannot cover:
   - (a) revert the staleness/liveness guard on the **item-resolved** coercion at
     `we:scripts/lane-pool.mjs:898` (the axis the repro fired on) → reddens case 3 and the
     genuine-but-resolved half of case 5 **by name**, and leaves cases 1, 2 and 4 green.
   - (b) revert `itemNumFromSession`'s tightening at `we:scripts/conveyor/lease-reaper.mjs:60-63` →
     reddens cases 1, 2 and the aliased half of case 5 **by name**, and leaves cases 3 and 4 green.
   - If the fix also gates the **PR** axis at `we:scripts/lane-pool.mjs:895`, a third mutation there must
     redden a case of its own — the repro never exercised that axis (it returned `undefined` for both
     reaps), so a case for it has to be written, not inherited.
7. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
