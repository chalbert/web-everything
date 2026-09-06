---
bornAs: xh1ocqf
kind: story
size: 3
status: resolved
scope: ["we:src/_data/__tests__/backlog-leverage.test.ts", "we:src/_data/__tests__/frozen-backlog.ts", "we:src/_data/__tests__/frozen-backlog.test.ts"]
dateOpened: "2026-09-06"
dateResolved: "2026-09-06"
tags: [testing, vitest, isolation, backlog, ci]
---

# The unit suite is order-dependent — one test fails only at full-suite size, and CI cannot see it

`npx vitest run` (no shard) fails on `main` today:

```
FAIL src/_data/__tests__/backlog-leverage.test.ts
  > backlog unblock-leverage — derivation invariants
  > is deterministic — a second load produces identical leverage fields
```

`Test Files 1 failed | 408 passed`. **CI is green**, because `we:.github/workflows/ci.yml` runs the suite in
**four shards** and the shard packing never co-locates whatever pollutes it. So the local full run and CI
disagree, and CI is the one that cannot see the defect.

## What was established by running it, not by reading it

| probe | result |
| --- | --- |
| full `npx vitest run` on a **clean tree at `main`** | **fails** — so it is pre-existing, not any working-tree change |
| the same run, twice | **fails both times** — reproducible, not a flake |
| the file alone | passes |
| with its two sibling data tests (`backlogGraph`, `backlog-visual-fixture-mode`) | passes |
| `src/` only · `src/ scripts/` · `src/ blocks/ capabilities/` | passes |
| CI, 4-way sharded | passes |

It only manifests at **full-suite file count**. That is the signature of worker packing: vitest reuses a worker
across files, and at 409 files this test lands in a worker that some earlier file has already left dirty.

## The leading hypothesis — stated as a hypothesis, because it is not yet proven

`we:src/_data/backlog.js` computes `BACKLOG_DIR` **once at module-load time** from `process.env`
(`WE_BACKLOG_DIR`, then `WE_VISUAL_FIXTURES`), and reads three more env-switched paths for reservations,
claims and queued state. `we:src/_data/__tests__/backlog-visual-fixture-mode.test.ts` deliberately mutates
exactly that global state — it sets and deletes `process.env.WE_VISUAL_FIXTURES` and **busts
`require.cache[backlogPath]` by hand** between reads, which its own header comment explains is required
*because* the constant is frozen at load.

`we:src/_data/__tests__/backlog-leverage.test.ts` captures `loadBacklog` **once at module scope**, calls it there for `items`, and
calls it again inside the test for `again`. Any cross-file mutation of that module's env or cache between the
two calls makes the two loads disagree — which is precisely the assertion that fails.

**What is NOT established:** that the fixture-mode test is the actual polluter. Running the two together
passes, so if it is the cause it needs a third file's packing to line up. Do not fix on this hypothesis
without first identifying the polluter by name.

## Done when

1. **The polluter is identified by name, not inferred** — e.g. by bisecting the full file list, or by running
   with `--sequence.seed` / a fixed order until the pair reproduces. Record the file and the exact shared state
   it mutates on this card.
2. **Executable** — `npx vitest run` with no shard is green, and the fix is at the *isolation* seam (restore
   the mutated global, or stop the leverage test caching a module-scope handle across calls), never by
   deleting, skipping or weakening the determinism assertion — that assertion is the thing of value here.
3. A named test pins the isolation so the same pollution reddens rather than returning at a different file
   count.
4. **The CI blind spot is stated**: either the sharded run is made capable of catching an order dependency, or
   this card records explicitly that it cannot and why that is accepted. A gate that passes only because it
   splits the suite is worth knowing about either way.

## RESOLVED — what it actually was (established by running it, not by reading it)

**There is no polluting test file, and the leading hypothesis above is falsified.** Three probes, all
executable and all pinned in `we:src/_data/__tests__/frozen-backlog.test.ts`:

| probe | result |
| --- | --- |
| flip `WE_VISUAL_FIXTURES` **and** `WE_BACKLOG_DIR` between the two loads | fields **identical** — env cannot reach them |
| write one card into the corpus between the two loads | fields **differ**, by the exact expected delta |
| change nothing between the two loads | **identical** — the derivation itself was never at fault |

`we:src/_data/backlog.js` resolves `BACKLOG_DIR` **once, at module load**; it holds no module-level cache,
and nothing on the leverage path reads the clock or the environment at call time. So once the module is
required, no `process.env` mutation by any sibling file can move `directUnblocks` / `transitiveUnblocks` /
`unblocksToReady` / `leverageScore`. That eliminates cross-file env pollution as a candidate outright — and
with it the need to name a polluter, since the remaining reachable cause is singular:

**The four fields are a pure function of the `we:backlog/*.md` corpus, and the test read that corpus twice,
seconds apart, from a LIVE directory.** `we:backlog/` is a working directory that `scaffold`, `resolve` and
the drain write to. Any write landing between the two reads reddens the assertion. At small suite size the
two reads are milliseconds apart and nothing lands; at full-suite size the window is wide enough that
something does. That is precisely the probe table above — the file alone passes, every subset passes, only
the full run fails — with no worker-packing explanation required.

## The fix — at the isolation seam, with the assertion untouched

`we:src/_data/__tests__/frozen-backlog.ts` copies the corpus to a temp directory once per file and points the
loader at the copy via `WE_BACKLOG_DIR`, restoring the variable immediately after the `require` (it only has
to survive that one call) so the file leaves **no** `process.env` residue for whatever vitest packs in next.
The determinism assertion keeps its full force: the same derivation, run twice, over the real 3500-card
corpus — it simply stops racing a directory other processes own.

`we:src/_data/__tests__/frozen-backlog.test.ts` pins it: the hazard, the falsification, the control, the
helper's immutability and exact env restoration, and the **wiring** — mutating the leverage test's call site
back to a bare, unwrapped require of `we:src/_data/backlog.js` reddens two of its cases (verified by mutation).

## The CI blind spot, stated

**CI could never have caught this, and sharding is not the reason.** A CI checkout has no concurrent writer
to `we:backlog/`, so the race has no second party there — the sharded run and an unsharded one would both be
green. Sharding *is* a real blind spot for order dependence in general (four shards never co-locate every
pair of files), and that is **accepted**: an unsharded gate costs the `test` lane its wall-clock budget, and
the isolation fix here means this particular defect can no longer occur at any file count, in or out of CI.

## Why this is filed rather than fixed in the diff that found it

Found while gating a **decisions-only** change (the #3423 ruling — backlog cards plus a statute clause, zero
executable code). That diff cannot cause or fix a test-isolation bug, and chasing it there would widen a
principle-surface PR into test infrastructure. Base-branch-red, ported nowhere, reported here.
