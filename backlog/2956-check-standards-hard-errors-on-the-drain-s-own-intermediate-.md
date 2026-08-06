---
bornAs: xoe1gys
kind: story
size: 2
status: open
relatedTo: ["2319", "2288", "2348", "2419"]
scope:
  - we:scripts/check-standards.mjs
  - we:scripts/pr-land.mjs
tags: [gate, drain, backlog, jit-numbering, false-positive]
dateOpened: "2026-08-06"
---

# check:standards hard-errors on the drain's own intermediate state — the stranded-hash gate reads a moving origin/main

The `strandedHashesOnMain` gate reads `git ls-tree origin/main -- backlog/` and errors on any hash-led backlog
file. The drain lands an item and JIT-numbers it in a **separate, later commit**, so a checkout fetched inside
that window sees hash-led files on main and `check:standards` goes red for a condition the checkout did not
cause and cannot correctly fix. Worse, `pr-land` ff-syncs the primary checkout **into** that window by design.
Make the gate tolerate the drain's own in-flight numbering.

## Why it is owed

The window is real and structural, not a rare race. Measured across recent lands, the numbering commit trails
its merge commit by **7-73 seconds** — e.g. merge `269a4f1a` at 09:53:14 followed by
`3394feee drain: JIT-number x3dvojd→#2954 at land (#2288)` at 09:54:24. `git ls-tree 269a4f1a -- backlog/`
lists `backlog/x3dvojd-…md` hash-led, so a fetch landing on that merge commit legitimately sees a stranded
hash that is about to be numbered.

**The primary checkout is pinned into the window by design.** `we:scripts/pr-land.mjs` fires
`triggerSingleCoupleDrain(prNum)` and then immediately `syncPrimaryMain()` (a `git pull --ff-only`), while the
drain's `numberPendingHashes` runs later in `we:scripts/lane-drain.mjs`. So the operator's checkout is routinely
fast-forwarded to the merge commit *before* the numbering commit is pushed — and stays red until the next fetch,
not "until it settles on its own".

Observed twice in one session (2026-08-06): once as **5 errors**, matching a numbering commit that handled
exactly five items, and once as a single error for `x3dvojd`, numbered to #2954 a minute later. Both were
transient and neither was the checkout's fault.

The `catch { }` fail-soft on the `ls-tree` covers only an **unresolvable** `origin/main` (a fresh or offline
clone), not a resolvable-but-mid-window one, so it does not help here.

## Why it matters beyond the noise

The error text instructs `node we:scripts/backlog.mjs number-stranded`. In the primary checkout that is an
**out-of-lane backlog mutation racing the drain's own numbering**, so the false red actively pushes toward a
wrong and conflicting action. And every spurious red trains the operator to dismiss the one detector #2319
built to catch a genuine strand — the failure mode #2348 / #2419 exist to prevent.

## Build

Pick one, and record why:
- **Tolerate the in-flight window** — skip (or downgrade to a warning) a hash-led file whose backlog entry is
  newer than the local `origin/main` ref, or whose id appears in an unmerged/unfetched numbering commit.
- **Warn, don't error, when the local `origin/main` ref is behind the remote** — the checkout cannot know
  whether numbering has since landed, so an error asserts more than it knows.
- **Scope the check to the PR's own merge-base** rather than to whatever `origin/main` happens to be.

Whichever is chosen, the error message must stop recommending an action that races the drain.

## Acceptance

- A checkout fast-forwarded to a merge commit whose numbering commit has not yet landed reports **no error**.
- A genuine strand — a hash-led file on `origin/main` with no numbering commit pending — still errors, with a
  test pinning both directions.
- The remedy named in the message is safe to run from the primary checkout, or the message no longer names one.
