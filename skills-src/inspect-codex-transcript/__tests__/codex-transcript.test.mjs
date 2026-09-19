/**
 * @file skills-src/inspect-codex-transcript/__tests__/codex-transcript.test.mjs
 * @description Unit proof of the guarantees `inspect-codex-transcript` is built around, mirroring the
 *   precedent suite for `inspect-agent-health`:
 *   1. the byte-capped "never read the whole file" bound, including that the hard ceilings hold against an
 *      explicit oversized override (a ceiling, not just a default) — a rollout file's FIRST line alone is
 *      ~40 KB of base instructions, so an unbounded read here is a guaranteed context blowout;
 *   2. `readSessionMeta` never retains `base_instructions` — the single largest field in the file — and
 *      honestly returns null rather than widening its read when the header exceeds the cap;
 *   3. `detectPendingCall` pairs by `call_id` and specifically does NOT trust `payload.status`, which was
 *      observed live reading "completed" on a call whose output had not been written yet;
 *   4. `detectOpenTurn` / `buildVerdict` produce the Codex-specific ABANDONED_MID_TURN verdict, which has
 *      no Claude analogue (no harness notices a dead `codex exec`).
 *   Plus proof that `truncate()` strips terminal escape sequences — a Codex rollout embeds raw command
 *   STDOUT verbatim, making it the likeliest place for such sequences to appear.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  HARD_MAX_BYTES, HARD_MAX_LINES, HARD_MAX_FIELD, HARD_META_BYTES, STALL_S,
  parseArgs, threadIdFromAny, tailLines, countLines, readSessionMeta,
  truncate, stripControlSequences, flattenParts, exitCodeOf,
  summarizeRecord, formatRecord, detectPendingCall, detectOpenTurn, buildVerdict,
} from '../codex-transcript.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'codex-transcript-test-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function writeRecords(file, records) {
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
const rec = (type, payload) => ({ timestamp: '2026-09-13T10:00:00.000Z', type, payload });
const toolCall = (callId, name = 'exec', input = 'tools.exec_command({cmd:"ls"})') =>
  rec('response_item', { type: 'custom_tool_call', call_id: callId, name, input, status: 'completed' });
const toolOut = (callId, text = '{"exit_code":0,"output":"ok"}') =>
  rec('response_item', { type: 'custom_tool_call_output', call_id: callId, output: [{ type: 'input_text', text }] });

// ── (1) bounded read: hard ceilings hold even against an oversized override ────────────────────────
describe('parseArgs — hard ceilings clamp even an explicit oversized override', () => {
  it('clamps --max-bytes to HARD_MAX_BYTES no matter how large the request', () => {
    const opts = parseArgs(['tid', '--max-bytes=999999999999']);
    expect(opts.maxBytes).toBe(HARD_MAX_BYTES);
  });
  it('clamps --lines and --field-max to their ceilings', () => {
    expect(parseArgs(['tid', '--lines=999999']).lines).toBe(HARD_MAX_LINES);
    expect(parseArgs(['tid', '--field-max=999999']).fieldMax).toBe(HARD_MAX_FIELD);
  });
  it('clamps --meta-bytes to HARD_META_BYTES no matter how large the request', () => {
    const opts = parseArgs(['tid', '--meta-bytes=999999999999']);
    expect(opts.metaBytes).toBe(HARD_META_BYTES);
  });
  it('floor-clamps a too-small request', () => {
    expect(parseArgs(['tid', '--max-bytes=1']).maxBytes).toBe(1024);
    expect(parseArgs(['tid', '--lines=-5']).lines).toBe(1);
    expect(parseArgs(['tid', '--meta-bytes=1']).metaBytes).toBe(1024);
  });
});

describe('tailLines / countLines — the bound holds on a large file', () => {
  it('never reads more than maxBytes off the end', () => {
    const file = join(dir, 'big.jsonl');
    const records = Array.from({ length: 2000 }, (_, i) => rec('response_item', { type: 'message', role: 'assistant', content: [{ type: 'input_text', text: `msg ${i} ${'x'.repeat(200)}` }] }));
    writeRecords(file, records);
    const { lines, truncatedHead } = tailLines(file, 5, 4096);
    expect(truncatedHead).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(5);
    // the whole file is far larger than the window we allowed ourselves to read
    expect(lines.join('').length).toBeLessThan(8192);
  });
  it('counts every line without parsing or holding the file', () => {
    const file = join(dir, 'c.jsonl');
    writeRecords(file, Array.from({ length: 137 }, () => rec('event_msg', { type: 'token_count' })));
    expect(countLines(file)).toBe(137);
  });
  it('surfaces a single oversized line rather than silently returning zero lines', () => {
    const file = join(dir, 'one.jsonl');
    writeFileSync(file, 'y'.repeat(50_000)); // one line, no newline at all
    const { lines } = tailLines(file, 5, 4096);
    expect(lines.length).toBe(1);
    expect(lines[0].length).toBeGreaterThan(0);
  });
});

// ── (2) the session header must never drag base_instructions into memory/output ────────────────────
describe('readSessionMeta — bounded head read that never retains base_instructions', () => {
  it('extracts only the short whitelisted fields, dropping the huge base_instructions blob', () => {
    const file = join(dir, 's.jsonl');
    writeRecords(file, [
      rec('session_meta', {
        session_id: 'abc-123', timestamp: '2026-09-13T10:00:00Z', cwd: '/tmp/x',
        originator: 'codex_exec', cli_version: '0.153.4', source: 'exec', model_provider: 'openai',
        base_instructions: { text: 'B'.repeat(40_000) },
      }),
      rec('event_msg', { type: 'task_started' }),
    ]);
    const meta = readSessionMeta(file, 512_000);
    expect(meta.threadId).toBe('abc-123');
    expect(meta.cliVersion).toBe('0.153.4');
    expect(meta.originator).toBe('codex_exec');
    // the guarantee: no field of the returned object carries the 40 KB blob
    expect(JSON.stringify(meta)).not.toContain('BBBB');
    expect(JSON.stringify(meta).length).toBeLessThan(1000);
  });
  it('returns null instead of widening the read when the header exceeds the cap', () => {
    const file = join(dir, 'huge-header.jsonl');
    writeRecords(file, [rec('session_meta', { session_id: 'x', base_instructions: { text: 'B'.repeat(200_000) } })]);
    expect(readSessionMeta(file, 2048)).toBeNull();
  });
});

// ── (3) pending detection pairs by call_id and ignores the misleading `status` field ───────────────
describe('detectPendingCall — call_id pairing, never payload.status', () => {
  const summarize = (records) => records.map((r) => summarizeRecord(JSON.stringify(r), 400));

  it('reports pending when a tool call has no matching output', () => {
    const r = summarize([toolCall('call_A'), toolOut('call_A'), toolCall('call_B')]);
    const p = detectPendingCall(r);
    expect(p.pending).toBe(true);
    expect(p.callId).toBe('call_B');
  });
  it('reports nothing pending when the newest call is matched', () => {
    const r = summarize([toolCall('call_A'), toolCall('call_B'), toolOut('call_B')]);
    expect(detectPendingCall(r).pending).toBe(false);
  });
  it('does NOT treat status:"completed" as evidence the call returned (observed live)', () => {
    // This exact shape was on disk while a run was blocked inside a 50-second shell command: the item
    // says "completed" (the MODEL finished emitting it) while the command had plainly not finished.
    const r = summarize([toolCall('call_live')]);
    expect(r[0].kind).toBe('tool_call');
    expect(detectPendingCall(r).pending).toBe(true);
  });
  it('handles the function_call/function_call_output shape as well as custom_tool_call', () => {
    const r = summarize([
      rec('response_item', { type: 'function_call', call_id: 'f1', name: 'exec_command', arguments: '{"cmd":"ls"}' }),
      rec('response_item', { type: 'function_call_output', call_id: 'f1', output: [{ type: 'input_text', text: '{"exit_code":0}' }] }),
    ]);
    expect(r[0].kind).toBe('tool_call');
    expect(r[1].kind).toBe('tool_output');
    expect(detectPendingCall(r).pending).toBe(false);
  });
});

describe('summarizeRecord — reasoning is reported as opaque, never as content', () => {
  it('marks an encrypted reasoning item as unreadable rather than inventing a summary', () => {
    const r = summarizeRecord(JSON.stringify(rec('response_item', {
      type: 'reasoning', encrypted_content: 'gAAAAA' + 'x'.repeat(500), summary: [],
    })), 400);
    expect(r.kind).toBe('reasoning');
    expect(r.encrypted).toBe(true);
    expect(r.hasSummary).toBe(false);
    expect(JSON.stringify(r)).not.toContain('gAAAAA'); // the blob itself is never carried through
  });
  it('pulls a non-zero exit code out of a tool output envelope', () => {
    const r = summarizeRecord(JSON.stringify(toolOut('c1', '{"exit_code":2,"output":"boom"}')), 400);
    expect(r.exitCode).toBe(2);
    expect(r.isError).toBe(true);
  });
  it('treats exit code 0 as success', () => {
    expect(summarizeRecord(JSON.stringify(toolOut('c1')), 400).isError).toBe(false);
  });
});

// ── (4) the Codex-specific verdict with no Claude analogue ─────────────────────────────────────────
describe('detectOpenTurn + buildVerdict', () => {
  const summarize = (records) => records.map((r) => summarizeRecord(JSON.stringify(r), 400));
  const started = rec('event_msg', { type: 'task_started', turn_id: 't1' });
  const complete = rec('event_msg', { type: 'task_complete' });

  it('sees an open turn when task_started has no later task_complete', () => {
    expect(detectOpenTurn(summarize([started, toolCall('a'), toolOut('a')]))).toBe(true);
  });
  it('sees a closed turn once task_complete lands', () => {
    expect(detectOpenTurn(summarize([started, complete]))).toBe(false);
  });
  it('returns null when no turn boundary is in the window', () => {
    expect(detectOpenTurn(summarize([toolCall('a')]))).toBeNull();
  });

  it('RUNNING_TOOL while a call is outstanding and recent', () => {
    const [v] = buildVerdict({ pending: { pending: true, name: 'exec' }, openTurn: true, idleS: 10 });
    expect(v).toBe('RUNNING_TOOL');
  });
  it('STALLED_IN_TOOL once that same call goes quiet past the threshold', () => {
    const [v] = buildVerdict({ pending: { pending: true, name: 'exec' }, openTurn: true, idleS: STALL_S + 1 });
    expect(v).toBe('STALLED_IN_TOOL');
  });
  it('ABANDONED_MID_TURN — the Codex-only case: turn open, nothing pending, long silent', () => {
    const [v, detail] = buildVerdict({ pending: { pending: false }, openTurn: true, idleS: STALL_S + 1 });
    expect(v).toBe('ABANDONED_MID_TURN');
    expect(detail).toContain('resume'); // must tell the operator the thread is still recoverable by hand
  });
  it('COMPLETED means the process EXITED, not that it is idle', () => {
    const [v, detail] = buildVerdict({ pending: { pending: false }, openTurn: false, idleS: 5 });
    expect(v).toBe('COMPLETED');
    expect(detail).toMatch(/EXITED/);
  });
  it('ACTIVE when a turn is open, nothing pending and activity is recent', () => {
    const [v] = buildVerdict({ pending: { pending: false }, openTurn: true, idleS: 5 });
    expect(v).toBe('ACTIVE');
  });
  it('UNKNOWN names the window size so the caller knows to widen it', () => {
    const [v, detail] = buildVerdict({ pending: { pending: false }, openTurn: null, idleS: 5, windowSize: 15 });
    expect(v).toBe('UNKNOWN');
    expect(detail).toContain('15');
  });
});

// ── misc: id parsing, escape stripping, part flattening ────────────────────────────────────────────
describe('threadIdFromAny', () => {
  it('recovers the id from a full rollout filename', () => {
    expect(threadIdFromAny('/x/sessions/2026/09/13/rollout-2026-09-13T06-40-29-01a09a5a-aef6-7f82-b546-d99f7e98b3c3.jsonl'))
      .toBe('01a09a5a-aef6-7f82-b546-d99f7e98b3c3');
  });
  it('passes a bare id through untouched', () => {
    expect(threadIdFromAny('01a09a5a-aef6-7f82-b546-d99f7e98b3c3')).toBe('01a09a5a-aef6-7f82-b546-d99f7e98b3c3');
  });
});

describe('truncate / stripControlSequences — command STDOUT is echoed verbatim, so sanitize it', () => {
  it('strips ANSI colour and cursor sequences', () => {
    expect(stripControlSequences('\x1b[31mred\x1b[0m')).toBe('red');
  });
  it('strips an OSC title-set sequence a crafted command could emit', () => {
    expect(stripControlSequences('\x1b]0;pwned\x07ok')).toBe('ok');
  });
  it('truncates past the field cap and says by how much', () => {
    const out = truncate('z'.repeat(100), 10);
    expect(out).toContain('truncated');
    expect(out.length).toBeLessThan(60);
  });
});

// ── security: a crafted rollout must not smuggle escape sequences via the "identifier" fields ──────
// `truncate()` already sanitizes free-text fields (message/tool-output content). These fields carry the
// SAME attacker-controlled JSON but are short scalars printed as-is (no truncation) in the human-readable
// report — so they need the identical stripping, not a separate mechanism.
describe('summarizeRecord / readSessionMeta — name/role/callId/turnId/cwd/approvalPolicy are sanitized', () => {
  const evil = '\x1b]0;pwned\x07innocent-looking-name';
  const evilClean = 'innocent-looking-name';

  it('strips an escape sequence smuggled in a tool_call name and call_id', () => {
    const r = summarizeRecord(JSON.stringify(rec('response_item', {
      type: 'custom_tool_call', call_id: evil, name: evil, input: 'x',
    })), 400);
    expect(r.name).toBe(evilClean);
    expect(r.callId).toBe(evilClean);
    expect(formatRecord(r)).not.toContain('\x1b');
  });

  it('strips an escape sequence smuggled in a tool_output call_id', () => {
    const r = summarizeRecord(JSON.stringify(rec('response_item', {
      type: 'custom_tool_call_output', call_id: evil, output: [{ type: 'input_text', text: 'ok' }],
    })), 400);
    expect(r.callId).toBe(evilClean);
  });

  it('strips an escape sequence smuggled in a message role', () => {
    const r = summarizeRecord(JSON.stringify(rec('response_item', {
      type: 'message', role: evil, content: [{ type: 'input_text', text: 'hi' }],
    })), 400);
    expect(r.role).toBe(evilClean);
    expect(formatRecord(r)).not.toContain('\x1b');
  });

  it('strips an escape sequence smuggled in a task_started turn_id', () => {
    const r = summarizeRecord(JSON.stringify(rec('event_msg', { type: 'task_started', turn_id: evil })), 400);
    expect(r.turnId).toBe(evilClean);
  });

  it('strips an escape sequence smuggled in turn_context.cwd and approval_policy', () => {
    const r = summarizeRecord(JSON.stringify(rec('turn_context', { cwd: evil, approval_policy: evil })), 400);
    expect(r.cwd).toBe(evilClean);
    expect(r.approvalPolicy).toBe(evilClean);
    expect(formatRecord(r)).not.toContain('\x1b');
  });

  it('strips an escape sequence smuggled in the session_meta header (cwd, originator, etc.)', () => {
    const file = join(dir, 'evil-meta.jsonl');
    writeRecords(file, [
      rec('session_meta', { session_id: evil, timestamp: evil, cwd: evil, originator: evil, cli_version: evil, source: evil, model_provider: evil }),
      rec('event_msg', { type: 'task_started' }),
    ]);
    const meta = readSessionMeta(file, 512_000);
    expect(meta.threadId).toBe(evilClean);
    expect(meta.cwd).toBe(evilClean);
    expect(meta.originator).toBe(evilClean);
  });
});

describe('flattenParts / exitCodeOf', () => {
  it('flattens the input_text part array Codex uses for tool output', () => {
    expect(flattenParts([{ type: 'input_text', text: 'a' }, { type: 'input_text', text: 'b' }])).toBe('a\nb');
  });
  it('returns null when no exit code is present', () => {
    expect(exitCodeOf('no code here')).toBeNull();
  });
});
