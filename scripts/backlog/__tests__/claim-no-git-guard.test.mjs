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

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../../backlog.mjs'), 'utf8');

describe('backlog.mjs claim never refuses on the whole working tree (#510, reconciled #952/#1256)', () => {
  it('contains no whole-tree dirty/untracked refusal guard', () => {
    expect(SRC).not.toMatch(/\bisDirty\b/);
    // The only `die(...)` that mentions the tree is the claim-first guard, and it is scoped to the item's
    // OWN file. Assert there is no UNSCOPED whole-tree porcelain read feeding a refusal: every porcelain
    // read used as a precondition must carry the `'--', rel` path scope.
    const unscoped = SRC.match(/execFileSync\('git', \['status', '--porcelain'\]\)/g) || [];
    // (the bare-tree read is allowed ONLY as the post-write attribution snapshot — see the ordering test)
    expect(unscoped.length).toBeLessThanOrEqual(1);
  });

  it('makes exactly two git reads: a path-scoped claim-first guard + the opt-in attribution snapshot (#952/#1256)', () => {
    const gitCalls = SRC.match(/execFileSync\('git'/g) || [];
    expect(gitCalls.length).toBe(2);
    // (1) the claim-first guard reads ONLY the single item file being claimed (path-scoped via `-- rel`)…
    expect(SRC).toMatch(/execFileSync\('git', \['status', '--porcelain', '--', rel\]/);
    // …and refuses (best-effort) only on that file's own pre-claim edits, overridable with --force.
    expect(SRC).toMatch(/!argv\.includes\('--force'\)/);
    // (2) the attribution snapshot reads the whole tree, gated on a session derived from the `--session`
    //     flag (with the #1723 inference fallbacks: else the reserving session, else the most-recent claim)…
    expect(SRC).toMatch(/execFileSync\('git', \['status', '--porcelain'\]/);
    expect(SRC).toMatch(/const session = flag\('session'\)[^\n]*;\s*\n\s*if \(session\) \{/);
  });

  it('wraps each git read in a try/catch so a git/IO hiccup can never block a claim', () => {
    // both reads are best-effort: a failure is swallowed, never propagated into a refusal.
    const tryCatches = SRC.match(/try \{[\s\S]*?execFileSync\('git'[\s\S]*?\}\s*catch/g) || [];
    expect(tryCatches.length).toBe(2);
  });

  it('snapshots AFTER the status write, so the whole-tree read is attribution, not a pre-claim gate', () => {
    // the attribution snapshot is the LAST git read, and it must come after applyTransition (by then the
    // claim has already succeeded). The earlier (first) git read is the path-scoped claim-first guard.
    expect(SRC.lastIndexOf("execFileSync('git'")).toBeGreaterThan(SRC.indexOf('applyTransition(before, v'));
  });
});
