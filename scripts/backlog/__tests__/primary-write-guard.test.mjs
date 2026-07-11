// Regression guard for the source-level lane-isolation enforcement (item x1vw9g7, related #2302/#2219/#2339).
//
// The lane-isolation rule "no backlog item-mutation ever writes a card file on the shared PRIMARY checkout"
// was, before this item, enforced ONLY by guard-bash.mjs — a PreToolUse(Bash) hook. That hook fires only for
// Bash-*tool* calls in a session that loads .claude/settings.json, so a mutation issued by a workflow agent,
// subagent, cron/scheduled close, or headless SDK run bypassed it and stamped the card on primary (observed
// 2026-07-10: three `cost` stamps left uncommitted in the primary tree). The fix shifts the guard to the
// SOURCE — writeBacklogMd, the single writer EVERY card-content mutation (cost/claim/resolve/release/
// scaffold/settle/retype/yield/prepare-stamp) funnels through — so no invocation channel can bypass it.
//
// The classification itself ("is this realpath a primary checkout?") is guard-lane.mjs's laneGuardDecision,
// exhaustively unit-tested in scripts/__tests__/guard-lane.test.mjs. This file pins the WIRING: that
// writeBacklogMd applies that decision at the source, before it writes, and that the numbering-repair /
// drain JIT-numbering path (a SEPARATE writer) is intentionally NOT routed through it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { laneGuardDecision, resolveReal } from '../../guard-lane.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../../backlog.mjs'), 'utf8');

// Isolate the writeBacklogMd body — the source guard must live in THIS choke point (not scattered per-verb,
// not in a numbering path), so scope the assertions to it.
const wStart = SRC.indexOf('function writeBacklogMd(');
const wEnd = SRC.indexOf('\nfunction ', wStart + 1);
const WRITE_SRC = SRC.slice(wStart, wEnd === -1 ? undefined : wEnd);

describe('writeBacklogMd enforces lane-isolation at the source (item x1vw9g7)', () => {
  it('reuses guard-lane\'s classification — single source of truth for "is this a primary checkout"', () => {
    expect(SRC).toMatch(/import \{ laneGuardDecision, resolveReal \} from '\.\/guard-lane\.mjs'/);
  });

  it('applies the guard to the target file\'s realpath, keyed on the checkout ROOT', () => {
    expect(WRITE_SRC).toMatch(/laneGuardDecision\(resolveReal\(abs\), ROOT\)/);
  });

  it('DENIES (die) on a primary target, before it writes the file', () => {
    const guardAt = WRITE_SRC.search(/laneGuardDecision\(/);
    const writeAt = WRITE_SRC.indexOf('writeFileSync(');
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(writeAt).toBeGreaterThan(guardAt); // guard runs BEFORE the write
    // the guard's truthy decision must feed a die(...) — a refusal, not a warning
    expect(WRITE_SRC).toMatch(/if \(laneGuardDecision\(resolveReal\(abs\), ROOT\)\) \{[\s\S]*?die\(/);
    expect(WRITE_SRC).toMatch(/There is no override/); // matches guard-bash's now-unconditional denial (#2339)
  });

  it('is the SOLE card writer, and the numbering-repair path is intentionally NOT routed through it', () => {
    // number-stranded / drain JIT-numbering legitimately rewrite cards in the primary/land checkout, so they
    // must use a separate writer (numberPendingHashes) and stay unaffected by this guard.
    expect(SRC).toMatch(/numberPendingHashes/);
    const nsStart = SRC.indexOf('function numberStranded(');
    const nsEnd = SRC.indexOf('\nfunction ', nsStart + 1);
    const NS_SRC = SRC.slice(nsStart, nsEnd === -1 ? undefined : nsEnd);
    expect(NS_SRC).not.toMatch(/writeBacklogMd\(/); // numbering does NOT go through the guarded writer
  });

  // Executable contract the wiring depends on (belt-and-suspenders with guard-lane.test.mjs): a primary
  // backlog target is denied, a lane-clone target is allowed.
  it('classification: primary backlog target → denied, lane-clone target → allowed', () => {
    const WS = '/ws';
    const PRIMARY_ROOT = resolve(WS, 'webeverything');
    const LANE_ROOT = resolve(WS, '.lanes', 'web-everything', 'lane-3');
    expect(laneGuardDecision(resolveReal(resolve(PRIMARY_ROOT, 'backlog', '1-a.md')), PRIMARY_ROOT)).toMatch(/BLOCKED/);
    expect(laneGuardDecision(resolveReal(resolve(LANE_ROOT, 'backlog', '1-a.md')), LANE_ROOT)).toBe(null);
  });
});
