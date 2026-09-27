/**
 * @file scripts/conveyor/__tests__/bg-isolation-stall.test.mjs
 * @description #x9fbg1x — {@link classifyBgIsolationStall} (pure, over already-summarized transcript entries)
 *   and {@link readBgIsolationStallInfo} (the IO shell) against a REAL temp
 *   `~/.claude/projects/<slug>/<sessionId>.jsonl`-shaped fixture — same convention as
 *   `hung-session.test.mjs`'s own `readHungInfo` tests (the store root stubbed via `CLAUDE_PROJECTS_DIR`), since
 *   this module reuses the exact same `resolveSessionTranscript`/`tailLines`/`summarizeEntry` machinery.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BG_ISOLATION_STALL_SIGNATURE, classifyBgIsolationStall } from '../bg-isolation-stall.mjs';

const summarized = (blocks) => ({ kind: 'assistant', ts: '2026-09-26T18:00:00Z', blocks });
const toolResult = (content, isError = true) => ({ kind: 'tool_result', toolUseId: 'x', isError, content });
const text = (t) => ({ kind: 'text', text: t });

describe('BG_ISOLATION_STALL_SIGNATURE', () => {
  it('matches the guard\'s own real refusal text', () => {
    expect(BG_ISOLATION_STALL_SIGNATURE.test(
      'This background session hasn\'t isolated its changes yet. Call EnterWorktree first so edits land in a worktree.',
    )).toBe(true);
  });

  it('matches on the settings key name alone too', () => {
    expect(BG_ISOLATION_STALL_SIGNATURE.test('set "worktree": {"bgIsolation": "none"} in .claude/settings.json')).toBe(true);
  });

  it('does not match an unrelated permission refusal', () => {
    expect(BG_ISOLATION_STALL_SIGNATURE.test('Claude requested permission to use Bash, but you haven\'t granted it yet.')).toBe(false);
  });
});

describe('classifyBgIsolationStall', () => {
  it('flags a tool_result carrying the guard\'s refusal text', () => {
    const entries = [summarized([toolResult('This background session hasn\'t isolated its changes yet. Call EnterWorktree first…')])];
    const out = classifyBgIsolationStall(entries);
    expect(out.stall).toBe(true);
    expect(out.evidence).toMatch(/EnterWorktree/);
  });

  it('ignores a text block that happens to mention worktree in passing (only tool_result counts)', () => {
    const entries = [summarized([text('I will call EnterWorktree next.')])];
    expect(classifyBgIsolationStall(entries).stall).toBe(false);
  });

  it('ignores an ordinary, unrelated tool_result error', () => {
    const entries = [summarized([toolResult('permission denied: /some/other/path')])];
    expect(classifyBgIsolationStall(entries)).toEqual({ stall: false, evidence: null });
  });

  it('tolerates entries with no blocks / non-array input', () => {
    expect(classifyBgIsolationStall([{ kind: 'unparseable' }])).toEqual({ stall: false, evidence: null });
    expect(classifyBgIsolationStall(null)).toEqual({ stall: false, evidence: null });
  });
});

function entryLine(type, ts, content) {
  return JSON.stringify({ type, timestamp: ts, message: { role: type, content } });
}

describe('readBgIsolationStallInfo — the IO shell, against a REAL temp project store', () => {
  let root, projects, cwd, sessionId, transcriptFile, readBgIsolationStallInfo;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'bg-isolation-stall-test-'));
    projects = join(root, 'projects');
    cwd = '/Users/fixture/workspace/.operations/dispatch/f6b254c8-fixture';
    sessionId = '03bd61b3-f427-483f-9ab0-34649b75bc37';
    const slug = cwd.replaceAll('/', '-');
    mkdirSync(join(projects, slug), { recursive: true });
    transcriptFile = join(projects, slug, `${sessionId}.jsonl`);
    vi.stubEnv('CLAUDE_PROJECTS_DIR', projects);
    vi.resetModules();
    ({ readBgIsolationStallInfo } = await import('../bg-isolation-stall.mjs'));
  });
  afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

  it('confirms the stall off a real EnterWorktree tool_result in the transcript tail', () => {
    const content = [{
      type: 'tool_result', tool_use_id: 'edit-1', is_error: true,
      content: 'This background session hasn\'t isolated its changes yet. Call EnterWorktree first so edits land in a worktree instead of the shared checkout.',
    }];
    writeFileSync(transcriptFile, `${entryLine('user', new Date().toISOString(), content)}\n`);
    const info = readBgIsolationStallInfo({ cwd, sessionId });
    expect(info.stall).toBe(true);
    expect(info.evidence).toMatch(/EnterWorktree/);
  });

  it('does not confirm the stall for an ordinary permission-prompt transcript with no guard text', () => {
    const content = [{ type: 'tool_result', tool_use_id: 'edit-1', is_error: true, content: 'permission denied: /outside/cwd/file.txt' }];
    writeFileSync(transcriptFile, `${entryLine('user', new Date().toISOString(), content)}\n`);
    const info = readBgIsolationStallInfo({ cwd, sessionId });
    expect(info.stall).toBe(false);
    expect(info.reason).toBe('no-signal');
  });

  it('missing cwd/sessionId on the row answers no-signal, never a guess', () => {
    expect(readBgIsolationStallInfo({})).toEqual({ stall: false, reason: 'no-signal', evidence: null });
    expect(readBgIsolationStallInfo({ cwd })).toEqual({ stall: false, reason: 'no-signal', evidence: null });
  });

  it('a session id with no transcript on disk answers no-signal, never a guess', () => {
    const info = readBgIsolationStallInfo({ cwd, sessionId: 'no-such-session' });
    expect(info).toEqual({ stall: false, reason: 'no-signal', evidence: null });
  });
});
