/**
 * @file scripts/lib/__tests__/lane-transcript-attribution.test.mjs
 * @description Proof of #3383's "EXACT ATTRIBUTION FROM TRANSCRIPTS" ask: a session that wrote exactly the
 * files sitting uncommitted in a lane is findable from its own JSONL transcript, and ranks ABOVE a session
 * that merely `cd`ed through the lane. `scanLaneTranscripts` does this in ONE grep pass for every lane at once
 * (never one grep per lane) via an injected `exec`, so no real filesystem/grep/`~/.claude` tree is touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, rmSync, writeFileSync, utimesSync, mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  laneTouchFromLine, summarizeLaneTouches, scanLaneTranscripts, recentTranscriptFiles,
} from '../lane-transcript-attribution.mjs';

const LANE = '/Users/x/workspace/.lanes/web-everything/lane-17';

// `scanLaneTranscripts` real-checks `existsSync(root)` before grepping (an absent `~/.claude/projects` tree
// degrades to "no matches" rather than a spawn error) — so its own tests need a REAL directory for `root`,
// even though the grep/read calls themselves are injected fakes that never touch it.
let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'lane-transcript-root-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

// A fake `listFiles` for the `scanLaneTranscripts` tests below — they exercise the grep/exec seam, not the
// real recency-bounded directory walk (that has its own dedicated `recentTranscriptFiles` tests further down).
const fakeFiles = () => ['/root/a.jsonl', '/root/b.jsonl'];

const editLine = (sessionId, file_path, ts) => JSON.stringify({
  type: 'assistant', sessionId, timestamp: ts,
  message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path } }] },
});
const bashLine = (sessionId, command, ts) => JSON.stringify({
  type: 'assistant', sessionId, timestamp: ts,
  message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] },
});

describe('laneTouchFromLine', () => {
  it('matches an Edit/Write/NotebookEdit whose file_path sits under the lane', () => {
    const t = laneTouchFromLine(editLine('sess-A', `${LANE}/scripts/foo.mjs`, '2026-01-01T00:00:00Z'), LANE);
    expect(t).toEqual({ ts: '2026-01-01T00:00:00Z', sessionId: 'sess-A', tool: 'Edit', path: `${LANE}/scripts/foo.mjs` });
  });

  it('matches a Bash command that mentions the lane path (a cd, or an absolute-path op)', () => {
    const t = laneTouchFromLine(bashLine('sess-B', `cd ${LANE} && git status`, '2026-01-01T00:01:00Z'), LANE);
    expect(t.tool).toBe('Bash');
    expect(t.path).toBeNull();
  });

  it('ignores a file_path OUTSIDE this lane (a different lane, or the primary checkout)', () => {
    expect(laneTouchFromLine(editLine('sess-A', '/Users/x/workspace/.lanes/web-everything/lane-9/foo.mjs', 't'), LANE)).toBeNull();
  });

  it('returns null for a non-assistant line, and never throws on unparsable JSON', () => {
    expect(laneTouchFromLine('{"type":"user"}', LANE)).toBeNull();
    expect(laneTouchFromLine('not json at all', LANE)).toBeNull();
  });
});

describe('summarizeLaneTouches', () => {
  it('ranks the session whose edited files match the lane\'s actual dirty paths ABOVE one that only cd\'d through', () => {
    const touches = [
      laneTouchFromLine(bashLine('sess-cd-only', `cd ${LANE} && ls`, '2026-01-01T00:00:00Z'), LANE),
      laneTouchFromLine(editLine('sess-writer', `${LANE}/scripts/real-work.mjs`, '2026-01-02T00:00:00Z'), LANE),
    ];
    const rows = summarizeLaneTouches(touches, LANE, ['scripts/real-work.mjs']);
    expect(rows[0].sessionId).toBe('sess-writer');
    expect(rows[0].coverage).toBe(1);
    expect(rows.find((r) => r.sessionId === 'sess-cd-only').coverage).toBe(0);
  });

  it('breaks a coverage tie by recency (the LATER write wins)', () => {
    const touches = [
      laneTouchFromLine(editLine('sess-early', `${LANE}/a.mjs`, '2026-01-01T00:00:00Z'), LANE),
      laneTouchFromLine(editLine('sess-late', `${LANE}/a.mjs`, '2026-01-02T00:00:00Z'), LANE),
    ];
    const rows = summarizeLaneTouches(touches, LANE, ['a.mjs']);
    expect(rows[0].sessionId).toBe('sess-late');
  });
});

describe('scanLaneTranscripts', () => {
  it('greps the whole tree ONCE for every lane at once — rg/grep hand back matching LINES, never a file list', () => {
    // #3383-perf: `exec` now returns the matching lines directly (rg/grep filter them natively) — Node never
    // reads a whole transcript file just to re-scan it for the (usually tiny) handful of relevant lines.
    const calls = [];
    const exec = (file, args) => {
      calls.push({ file, args });
      return `${editLine('sess-1', `${LANE}/x.mjs`, 't1')}\n${editLine('sess-2', '/Users/x/workspace/.lanes/web-everything/lane-9/y.mjs', 't2')}\n`;
    };
    const result = scanLaneTranscripts(root, { 17: LANE, 9: '/Users/x/workspace/.lanes/web-everything/lane-9' }, { exec, listFiles: fakeFiles });
    expect(calls).toHaveLength(1); // ONE call for both lanes
    expect(result.get('17')).toHaveLength(1);
    expect(result.get('17')[0].sessionId).toBe('sess-1');
    expect(result.get('9')).toHaveLength(1);
    expect(result.get('9')[0].sessionId).toBe('sess-2');
  });

  it('degrades to empty maps when grep/rg fails or finds nothing — never throws', () => {
    const exec = () => { const e = new Error('no matches'); e.status = 1; throw e; };
    const result = scanLaneTranscripts(root, { 17: LANE }, { exec, listFiles: fakeFiles });
    expect(result.get('17')).toEqual([]);
  });

  it('returns an empty map for no lanes requested, without calling exec at all', () => {
    let called = false;
    const exec = () => { called = true; return ''; };
    const result = scanLaneTranscripts(root, {}, { exec, listFiles: fakeFiles });
    expect(result.size).toBe(0);
    expect(called).toBe(false);
  });

  it('never calls exec at all when the recent-file window finds NO candidate transcripts', () => {
    let called = false;
    const exec = () => { called = true; return ''; };
    const result = scanLaneTranscripts(root, { 17: LANE }, { exec, listFiles: () => [] });
    expect(result.get('17')).toEqual([]);
    expect(called).toBe(false);
  });
});

describe('recentTranscriptFiles — #3383-perf r2 (bound the scanned volume, not just the call shape)', () => {
  it('finds a .jsonl file, including one nested under subagents/, within the age window', () => {
    writeFileSync(join(root, 'a.jsonl'), '{}\n');
    const sub = join(root, 'proj', 'subagents');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, 'b.jsonl'), '{}\n');
    const files = recentTranscriptFiles(root, { maxAgeMs: 7 * 24 * 60 * 60_000 });
    expect(files.sort()).toEqual([join(root, 'a.jsonl'), join(sub, 'b.jsonl')].sort());
  });

  it('ignores a non-.jsonl file', () => {
    writeFileSync(join(root, 'notes.txt'), 'hi\n');
    expect(recentTranscriptFiles(root, { maxAgeMs: 7 * 24 * 60 * 60_000 })).toEqual([]);
  });

  it('excludes a file OLDER than the age window — the actual perf bound', () => {
    const oldFile = join(root, 'old.jsonl');
    writeFileSync(oldFile, '{}\n');
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    utimesSync(oldFile, longAgo, longAgo);
    const newFile = join(root, 'new.jsonl');
    writeFileSync(newFile, '{}\n');
    const files = recentTranscriptFiles(root, { maxAgeMs: 7 * 24 * 60 * 60_000 });
    expect(files).toEqual([newFile]);
  });

  it('caps the result at maxFiles, newest first', () => {
    const now = Date.now();
    const paths = [0, 1, 2].map((i) => join(root, `t${i}.jsonl`));
    paths.forEach((p, i) => {
      writeFileSync(p, '{}\n');
      const t = new Date(now - i * 60_000); // t0 newest, t2 oldest
      utimesSync(p, t, t);
    });
    const files = recentTranscriptFiles(root, { maxAgeMs: 7 * 24 * 60 * 60_000, maxFiles: 2 });
    expect(files).toEqual([paths[0], paths[1]]);
  });

  it('returns [] for an absent root — never throws', () => {
    expect(recentTranscriptFiles(join(root, 'does-not-exist'))).toEqual([]);
  });
});
