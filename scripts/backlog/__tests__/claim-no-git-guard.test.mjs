// Regression guard for backlog #510 / #422 — RECONCILED with #952 (2026-06-20).
//
// #510's real invariant: `claim` must never REFUSE an item based on the working tree. The original bug
// was a `git status --short` truthiness guard that read an untracked (`??`) file as "another session is
// editing this" — but this repo's backlog is globally uncommitted, so a freshly-scaffolded item is `??`
// from birth, making `claim` reject every brand-new item (a guaranteed false stop, not a real
// concurrency signal). Concurrency is owned by the status transition (`claim` only succeeds from `open`)
// + the reservation soft-holds (#083), so the tree must never gate a claim.
//
// The first version of this test pinned that invariant by a PROXY — "backlog.mjs imports no
// child_process at all". #952 (#949 Fork 2-A) then legitimately added a git `--porcelain` snapshot ON
// claim, used purely for later `check:standards --scope=<session>` attribution. That snapshot honours
// #510's actual invariant — it's opt-in (only with `--session`), runs AFTER the status write, and is
// wrapped in a try/catch that swallows every failure so it can NEVER block a claim — but it breaks the
// blunt "no child_process" proxy. So this test now pins the INVARIANT, not the proxy: the tree may be
// READ (best-effort, for attribution) but must never be a precondition that refuses a claim.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../../backlog.mjs'), 'utf8');

describe('backlog.mjs claim never refuses on working-tree state (#510, reconciled #952)', () => {
  it('contains no dirty/untracked refusal guard', () => {
    expect(SRC).not.toMatch(/\bisDirty\b/);
    // no `die(...)` whose message blames the working tree (dirty / untracked / uncommitted)
    expect(SRC).not.toMatch(/die\([^)]*\b(dirty|untracked|uncommitted)\b/i);
  });

  it('reads git only as a best-effort, opt-in attribution snapshot (#952), never as a precondition', () => {
    // the only git invocation is the porcelain attribution snapshot…
    const gitCalls = SRC.match(/execFileSync\('git'/g) || [];
    expect(gitCalls.length).toBe(1);
    expect(SRC).toMatch(/execFileSync\('git', \['status', '--porcelain'\]/);
    // …gated on the opt-in `--session` flag…
    expect(SRC).toMatch(/const session = flag\('session'\);\s*\n\s*if \(session\) \{/);
    // …and wrapped in a try/catch that swallows failures so it can't block the claim.
    expect(SRC).toMatch(/try \{[\s\S]*?execFileSync\('git'[\s\S]*?\} catch \{[^}]*\}/);
  });

  it('snapshots AFTER the status write, so the tree read is attribution, not a pre-claim gate', () => {
    // the git read must come after applyTransition (the claim has already succeeded by then)
    expect(SRC.indexOf("execFileSync('git'")).toBeGreaterThan(SRC.indexOf('applyTransition(before, v'));
  });
});
