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

`we:scripts/lane-pool.mjs acquire` runs the `#2748` ghost-lease reaper first, and the reaper judges a lease dead by a **terminal signal about the item the session slug names** — never by whether the lease itself is alive. A lane whose lease carries such a slug is therefore reclaimed **immediately after** being handed out, so the next acquire returns the same lane again. Measured 2026-08-26: seven back-to-back acquires all returned `lane-24`, each printing `reaped lane-24 before acquire (pr-merged; was leased by <the previous caller>)` against a lease under a minute old. Every concurrent worker collides on one lane.

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
`:910` prints that reason — so an **item resolved on `main`** and a **merged PR** are indistinguishable in the
transcript. Measured in this lane against this repo:

| step | result |
| --- | --- |
| `itemNumFromSession('rv1566j')` | `'1566'` |
| `itemNumFromSession('probe1')` | `'1'` |
| `gh pr list --state all --limit 1000` → `prStatesFromList` | 1000 PRs scanned, **307** keyed by `laneRefItemNum` |
| `prStates.get('1566')` | `null` |
| `prStates.get('1')` | `null` |
| `we:backlog/1566-decision-we-renderer-conformance-…md` on `origin/main` | `status: resolved` (`dateResolved: 2026-06-22`) |
| `we:backlog/001-resource-specs-and-plans.md` on `origin/main` | `status: resolved` (`dateResolved: 2026-06-06`) |

So the PR axis returned `null` for both reaps and **never ran**. Both fired on the offline
item-resolved-on-`main` axis at `:898`. The existing test for that path is named for it:
`lane-pool #2748 — acquire reaps a provably-dead (item-resolved) ghost before allocating`
(`we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73`).

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
Criterion 5 below is restated against the axis the fix touches.

**(c) The `scope:` list was wrong twice.** It named `we:scripts/__tests__/lane-pool.test.mjs`, which **does
not exist** in this checkout, and omitted both files that hold the predicate:
`we:scripts/conveyor/lease-reaper.mjs` (`classifyReap` — the single-sourced verdict) and
`we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` (the existing test for the axis that fired). The
frontmatter above is corrected.

**Prevention for the class, filed with this fix:**
`we:backlog/x6fm4mx-gate-a-backlog-filing-that-asserts-existing-code-behaviour-m.md` — warn at
`check:standards` time when a new, unlanded filing asserts existing code behaviour with no `file:line`
citation in the same paragraph.

## Why this is worse than a stale-lease annoyance

**It silently destroys concurrency.** Seven reviewers launched in parallel were each handed the same lane.
Two consequences, and the second is the dangerous one:

1. `review-pr`'s `assertLaneCwd` (`#3151`) refuses a juror lane that is the driver's lane, so those runs fail
   — loudly, which is the good case.
2. Where nothing checks, **two agents work in one clone**. The whole lane model rests on one worker per
   checkout, and the guard that enforces it keys on the lease this reaper just gave away.

It also inverts the reaper's own purpose. `#2748` exists to reclaim leases whose holder is gone. Here the
holder is a process that started seconds ago and is about to `cd` into the lane.

## Not in scope

Changing which lane `acquire` picks, or the lease format. In scope are exactly the two named defects: the
terminal-signal-as-liveness proxy on **both** axes that feed `prState`, and `itemNumFromSession`'s
digit-tail aliasing.

## Done when

1. **Executable** — a lease minted seconds ago whose session slug aliases onto a **resolved** backlog item
   (e.g. `--session=probe1` against a resolved `#1`): acquire does **not** reap it, and returns a
   **different** lane. Fails today — this is the measured repro.
2. **Executable** — `itemNumFromSession` no longer treats an arbitrary digit-tailed slug as an item number:
   a genuine conveyor slug (`conveyor-2500`, `prepare-decision-2500`, retry suffix `conveyor-2500b`) still
   resolves to `2500`, while `probe1` / `rv1566j` resolve to `null`.
3. **Executable** — a lane whose item is genuinely finished **and** whose holder is gone is still reaped, so
   `#2748`'s behaviour is preserved rather than traded away. Green today and must stay green — the existing
   `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73` case must not be weakened.
4. **Executable** — N successive acquire calls with no release between them return **N distinct lanes** while
   N free lanes exist. This is the property that actually broke, and no case above states it.
5. **Mutation** — reverting the guard on the **item-resolved** coercion at `we:scripts/lane-pool.mjs:898`
   (the axis the repro fired on) reddens cases 1 and 4 by name and leaves case 3 green. If the fix also
   touches the PR axis, a second mutation there must redden a case of its own.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
