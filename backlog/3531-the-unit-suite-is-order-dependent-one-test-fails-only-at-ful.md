---
bornAs: xh1ocqf
kind: story
size: 3
status: open
scope: ["we:src/_data/__tests__/backlog-leverage.test.ts", "we:src/_data/__tests__/backlog-visual-fixture-mode.test.ts"]
dateOpened: "2026-09-06"
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

## Why this is filed rather than fixed in the diff that found it

Found while gating a **decisions-only** change (the #3423 ruling — backlog cards plus a statute clause, zero
executable code). That diff cannot cause or fix a test-isolation bug, and chasing it there would widen a
principle-surface PR into test infrastructure. Base-branch-red, ported nowhere, reported here.
