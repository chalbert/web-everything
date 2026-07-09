/**
 * @file scripts/__tests__/guard-lane.test.mjs
 * @description Proof of the #2123 lane-isolation gate (guard-lane.mjs). The stdin/exit-code plumbing is the
 *   I/O boundary; the pure allow/deny decision is unit-tested here (mirrors guard-git-push.test.mjs).
 *   Regression anchor (2026-07-09): agent memory is NO LONGER exempt — a primary memory edit, INCLUDING one
 *   reached through the user-level `~/.claude/projects/<slug>/memory` symlink (which realpaths into
 *   `<primary>/agent-memory-src/`), must be denied and routed to a lane.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { laneGuardDecision, resolveReal } from '../guard-lane.mjs';

// A fake constellation: <workspace>/{webeverything,frontierui} primaries + a <workspace>/.lanes/ clone.
const WORKSPACE = '/ws';
const WE_ROOT = path.join(WORKSPACE, 'webeverything');
const p = (...seg) => path.join(WORKSPACE, ...seg);

describe('laneGuardDecision (pure)', () => {
  it('DENIES a plain primary-tree edit', () => {
    expect(laneGuardDecision(p('webeverything', 'scripts', 'x.mjs'), WE_ROOT)).toMatch(/BLOCKED/);
  });

  it('DENIES a primary edit in another constellation repo (frontierui)', () => {
    expect(laneGuardDecision(p('frontierui', 'src', 'a.ts'), WE_ROOT)).toMatch(/BLOCKED/);
  });

  it('ALLOWS an edit inside a lane clone (under .lanes/)', () => {
    expect(laneGuardDecision(p('.lanes', 'web-everything', 'lane-3', 'scripts', 'x.mjs'), WE_ROOT)).toBe(null);
  });

  it('ALLOWS a lane edit to agent-memory-src (memory work rides a lane)', () => {
    expect(laneGuardDecision(p('.lanes', 'web-everything', 'lane-3', 'agent-memory-src', 'r.md'), WE_ROOT)).toBe(null);
  });

  it('ALLOWS a genuinely-personal ~/.claude path that does not resolve into a repo', () => {
    expect(laneGuardDecision('/home/u/.claude/settings.json', WE_ROOT)).toBe(null);
  });

  it('DENIES a primary agent-memory-src edit WITH the not-exempt memory notice', () => {
    const msg = laneGuardDecision(p('webeverything', 'agent-memory-src', 'rule.md'), WE_ROOT);
    expect(msg).toMatch(/BLOCKED/);
    expect(msg).toMatch(/Agent memory is git-tracked/);
    expect(msg).not.toMatch(/LANE_GUARD_OFF/); // the bypass is NOT advertised for memory
  });

  it('DENIES via the legacy .claude/agent-memory alias too', () => {
    const msg = laneGuardDecision(p('webeverything', '.claude', 'agent-memory', 'rule.md'), WE_ROOT);
    expect(msg).toMatch(/Agent memory is git-tracked/);
  });

  it('still advertises the LANE_GUARD_OFF bypass for a NON-memory primary file', () => {
    expect(laneGuardDecision(p('webeverything', 'scripts', 'x.mjs'), WE_ROOT)).toMatch(/LANE_GUARD_OFF/);
  });

  it('never blocks on an empty path', () => {
    expect(laneGuardDecision('', WE_ROOT)).toBe(null);
  });
});

// End-to-end path classification through a real symlink chain — the exact shape that let the interactive
// memory hole exist: `~/.claude/projects/<slug>/memory` → `<repo>/.claude/agent-memory` → `agent-memory-src`.
describe('resolveReal + decision through the user-level memory symlink', () => {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), 'guard-lane-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('a write via the ~/.claude/.../memory symlink is DENIED as a primary memory edit', () => {
    const weRoot = path.join(root, 'webeverything');
    mkdirSync(path.join(weRoot, 'agent-memory-src'), { recursive: true });
    mkdirSync(path.join(weRoot, '.claude'), { recursive: true });
    // <repo>/.claude/agent-memory → ../agent-memory-src
    symlinkSync('../agent-memory-src', path.join(weRoot, '.claude', 'agent-memory'));
    // ~/.claude/projects/<slug>/memory → <repo>/.claude/agent-memory
    const projMem = path.join(root, 'home', '.claude', 'projects', 'slug');
    mkdirSync(projMem, { recursive: true });
    symlinkSync(path.join(weRoot, '.claude', 'agent-memory'), path.join(projMem, 'memory'));
    // an existing sibling memory file so realpath can resolve the dir for a not-yet-existing target
    writeFileSync(path.join(weRoot, 'agent-memory-src', 'existing.md'), '# x\n');

    const target = path.join(projMem, 'memory', 'new-rule.md'); // does not exist yet
    const real = resolveReal(target);
    expect(real).toContain(`${path.sep}webeverything${path.sep}agent-memory-src${path.sep}`);
    expect(laneGuardDecision(real, weRoot)).toMatch(/Agent memory is git-tracked/);
  });
});
