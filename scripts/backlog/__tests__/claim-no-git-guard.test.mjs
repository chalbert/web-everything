// Regression guard for backlog #510 / #422 — RECONCILED with #952 and the claim-first guard (#1256, 2026-06-20).
//
// #510's real invariant: `claim` must never REFUSE an item based on the WHOLE working tree. The original
// bug was a `git status --short` truthiness guard that read an untracked (`??`) file as "another session
// is editing this" — but this repo's backlog is globally uncommitted, so a freshly-scaffolded item is `??`
// from birth, making `claim` reject every brand-new item (a guaranteed false stop, not a real concurrency
// signal). Concurrency is owned by the status transition (`claim` only succeeds from `open`) + the
// reservation soft-holds (#083), so the BROAD tree must never gate a claim.
//
// The file now makes TWO git reads, and both honour that invariant:
//   1. Claim-first guard — `git status --porcelain -- <rel>`, scoped to the SINGLE item file being
//      claimed. It refuses only when THAT file is already dirty (pre-claim edits the status transition
//      would silently absorb), never on the routinely-dirty tree at large, and `--force` overrides. The
//      `-- <path>` scoping is what keeps #510's invariant intact: a dirty *other* file never trips it.
//   2. Attribution snapshot — `git status --porcelain` (whole tree), added by #952 purely for later
//      `check:standards --scope=<session>` attribution. It is opt-in (only with `--session`), runs AFTER
//      the status write, and is wrapped in a try/catch that swallows every failure so it can NEVER block
//      a claim.
//
// So this test pins the reconciled INVARIANT, not a proxy: the tree may be READ (best-effort) but the only
// refusal is the path-scoped claim-first guard on the item's own file — never a whole-tree precondition.
//
// #3034 REWIRE: `claim` no longer runs through backlog.mjs's `transition()` at all — it is routed to the
// declared `claim` operation (scripts/operations/claim.mjs, IO in scripts/operations/claim-io.mjs) via
// backlog.mjs's own `claimViaOperation()`. The two git reads this test pins therefore now live in two
// different files: the path-scoped claim-first guard moved into claim-io.mjs's `createClaimReader` (the
// operation's injected reader), while the opt-in whole-tree attribution snapshot — pure CLI bookkeeping the
// operation itself doesn't own — stayed behind in claimViaOperation(). Both still honour the SAME invariant;
// this file re-scopes to where each one now lives instead of re-deriving the invariant.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../../backlog.mjs'), 'utf8');
const IO_SRC = readFileSync(resolve(here, '../../operations/claim-io.mjs'), 'utf8');

// Isolate claimViaOperation()'s body — the attribution-snapshot half of the invariant lives here now. Bound on
// the next TOP-LEVEL function declaration, `async` or not (a bare `\nfunction ` search misses `async function`
// and silently runs on into the FOLLOWING plain function, which is what let this drift unnoticed).
const txStart = SRC.indexOf('async function claimViaOperation(');
const txRestSearch = SRC.slice(txStart + 1).search(/\n(?:async )?function /);
const CLAIM_SRC = txRestSearch === -1 ? SRC.slice(txStart) : SRC.slice(txStart, txStart + 1 + txRestSearch);

describe('backlog.mjs claim never refuses on the whole working tree (#510, reconciled #952/#1256/#3034)', () => {
  it('contains no whole-tree dirty/untracked refusal guard', () => {
    expect(SRC).not.toMatch(/\bisDirty\b/);
    expect(IO_SRC).not.toMatch(/\bisDirty\b/);
    // The only refusal that mentions the tree is the claim-first guard, and it is scoped to the item's OWN
    // file (in claim-io.mjs now). Assert there is no UNSCOPED whole-tree porcelain read feeding a refusal:
    // every porcelain read used as a precondition must carry the `'--', rel` path scope.
    const unscoped = SRC.match(/execFileSync\('git', \['status', '--porcelain'\]\)/g) || [];
    // (the bare-tree read is allowed ONLY as the post-write attribution snapshot — see the ordering test)
    expect(unscoped.length).toBeLessThanOrEqual(1);
    expect(IO_SRC).not.toMatch(/exec\('git', \['status', '--porcelain'\]\)/); // no unscoped read in the IO reader
  });

  it('the path-scoped claim-first guard (claim-io.mjs) reads ONLY the single item file being claimed, best-effort', () => {
    // scoped via `-- rel` — never the whole tree — mirroring what backlog.mjs used to do inline pre-#3034.
    expect(IO_SRC).toMatch(/exec\('git', \['status', '--porcelain', '--', rel\]/);
    // best-effort: a git/IO hiccup reads as clean, never blocks a claim.
    const tryCatches = IO_SRC.match(/try \{[\s\S]*?exec\('git'[\s\S]*?\}\s*catch/g) || [];
    expect(tryCatches.length).toBe(1);
    // `--force` overrides the REFUSAL (in planClaim, scripts/operations/claim.mjs), not the read itself —
    // pin that the skip-on-force still exists somewhere in the claim path.
    const PLAN_SRC = readFileSync(resolve(here, '../../operations/claim.mjs'), 'utf8');
    expect(PLAN_SRC).toMatch(/if \(!force\)/);
  });

  it('the opt-in attribution snapshot (claimViaOperation) is the ONLY git read there, gated on session, wrapped in try/catch (#952/#1256)', () => {
    const gitCalls = CLAIM_SRC.match(/execFileSync\('git'/g) || [];
    expect(gitCalls.length).toBe(1);
    // reads the whole tree, gated on a session derived from the `--session` flag (with the #1723 inference
    // fallbacks: else the reserving session, else the most-recent claim)…
    expect(CLAIM_SRC).toMatch(/execFileSync\('git', \['status', '--porcelain'\]/);
    expect(CLAIM_SRC).toMatch(/const session = flag\('session'\)[^\n]*;\s*\n\s*if \(session\) \{/);
    // …and is wrapped in a try/catch so a git/IO hiccup can never block a claim (attribution is best-effort).
    const tryCatches = CLAIM_SRC.match(/try \{[\s\S]*?execFileSync\('git'[\s\S]*?\}\s*catch/g) || [];
    expect(tryCatches.length).toBe(1);
  });

  it('snapshots AFTER the operation\'s write completes, so the whole-tree read is attribution, not a pre-claim gate', () => {
    // the write happens inside `driveRun` (the operation's declared effect is applied there); the attribution
    // snapshot must run strictly after that await resolves, never before.
    expect(CLAIM_SRC.indexOf("execFileSync('git'")).toBeGreaterThan(CLAIM_SRC.indexOf('await driveRun('));
  });
});
