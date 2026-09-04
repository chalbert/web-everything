/**
 * @file skills-src/inspect-agent-health/__tests__/agent-health.test.mjs
 * @description Unit proof of the two guarantees `inspect-agent-health` is built around (PR #1905
 *   independent review, care=elevated, findings all CONFIRMED-and-fixed):
 *   1. the byte-capped "never read the whole file" bound — including that it holds even against an
 *      explicit oversized `--max-bytes` override (a hard ceiling, not just a default) — and the
 *      single-oversized-line fallback actually surfaces a line instead of silently returning zero;
 *   2. `detectBlockedOnChild` firing correctly on a synthetic pending vs. resolved nested
 *      `Agent(run_in_background:false)` `tool_use`, INCLUDING the multi-tool_use-in-one-turn case the
 *      review's first finding named directly (a still-pending call that is not the structurally-last
 *      tool_use block in its entry must still be detected).
 *   Plus a small proof that `truncate()` strips ANSI/control escape sequences before anything is
 *   printed (review's terminal-escape-injection finding).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  HARD_MAX_BYTES, HARD_MAX_LINES, HARD_MAX_FIELD,
  parseArgs, tailLines, truncate, stripControlSequences, summarizeEntry, detectBlockedOnChild,
} from '../agent-health.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'agent-health-test-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function writeLines(file, lines) { writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n'); }

function assistantEntry(blocks) {
  return { type: 'assistant', message: { role: 'assistant', content: blocks } };
}
function toolUseBlock(id, name, input) { return { type: 'tool_use', id, name, input }; }
function toolResultBlock(toolUseId, content = 'ok') { return { type: 'tool_result', tool_use_id: toolUseId, content }; }
function userEntry(blocks) { return { type: 'user', message: { role: 'user', content: blocks } }; }

// ── (1) bounded read: hard ceilings hold even against an oversized override ────────────────────────
describe('parseArgs — hard ceilings clamp even an explicit oversized override (#1905 finding)', () => {
  it('clamps --max-bytes to HARD_MAX_BYTES no matter how large the request', () => {
    const opts = parseArgs(['agentId', '--max-bytes=999999999999']);
    expect(opts.maxBytes).toBe(HARD_MAX_BYTES);
    expect(opts.maxBytes).toBeLessThan(999999999999);
  });
  it('clamps --lines to HARD_MAX_LINES', () => {
    const opts = parseArgs(['agentId', '--lines=999999']);
    expect(opts.lines).toBe(HARD_MAX_LINES);
  });
  it('clamps --field-max to HARD_MAX_FIELD', () => {
    const opts = parseArgs(['agentId', '--field-max=999999']);
    expect(opts.fieldMax).toBe(HARD_MAX_FIELD);
  });
  it('still floor-clamps a too-small (but truthy) request as before', () => {
    expect(parseArgs(['agentId', '--max-bytes=1']).maxBytes).toBe(1024);
    expect(parseArgs(['agentId', '--lines=-5']).lines).toBe(1);
  });
});

describe('tailLines — byte cap + the oversized-line fallback (#1905 finding)', () => {
  it('never reads more than maxBytes off a large file, even when the file vastly exceeds it', () => {
    const file = join(dir, 't.jsonl');
    const lines = Array.from({ length: 5000 }, (_, i) => JSON.stringify({ n: i, pad: 'x'.repeat(200) }));
    writeFileSync(file, lines.join('\n') + '\n');
    const { lines: got, truncatedHead } = tailLines(file, 10, 2000); // file is far larger than 2000 bytes
    expect(truncatedHead).toBe(true);
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(10);
    // every returned line must itself be valid JSON — proof the partial leading line was correctly dropped
    for (const l of got) expect(() => JSON.parse(l)).not.toThrow();
  });

  it('a single line exceeding maxBytes with NO newline anywhere: falls back to that content, not empty (regression for the review-confirmed bug)', () => {
    const file = join(dir, 'huge-single-line.jsonl');
    const huge = 'x'.repeat(5000); // no newline at all
    writeFileSync(file, huge);
    const { lines: got, truncatedHead } = tailLines(file, 10, 2000); // maxBytes < file size, start > 0
    expect(truncatedHead).toBe(true);
    // OLD BUG: this came back as [] because the fallback read from the already-emptied `text`.
    expect(got.length).toBe(1);
    expect(got[0].length).toBeGreaterThan(0);
  });

  it('a single line exceeding maxBytes with no newline, read from the START of the file (start=0): still returns the line', () => {
    const file = join(dir, 'huge-from-start.jsonl');
    const huge = 'y'.repeat(500);
    writeFileSync(file, huge);
    const { lines: got, truncatedHead } = tailLines(file, 10, 2000); // file smaller than cap → start=0
    expect(truncatedHead).toBe(false);
    expect(got.length).toBe(1);
  });

  it('normal small file: returns real lines untruncated at the head', () => {
    const file = join(dir, 'small.jsonl');
    writeLines(file, [{ a: 1 }, { a: 2 }, { a: 3 }]);
    const { lines: got, truncatedHead } = tailLines(file, 10, 2_000_000);
    expect(truncatedHead).toBe(false);
    expect(got.length).toBe(3);
  });
});

// ── (2) control-sequence stripping (#1905 security finding) ────────────────────────────────────────
describe('stripControlSequences / truncate — strips ANSI/OSC/C0 control bytes before printing', () => {
  it('removes a CSI escape sequence (e.g. a screen-clear)', () => {
    const s = 'hello \x1b[2J\x1b[H world';
    expect(stripControlSequences(s)).toBe('hello  world');
  });
  it('removes an OSC sequence (e.g. a terminal-title / clipboard-write attempt)', () => {
    const s = 'before\x1b]0;evil title\x07after';
    expect(stripControlSequences(s)).toBe('beforeafter');
  });
  it('removes raw C0 control bytes but keeps normal text', () => {
    const s = 'a\x00b\x07c\x1bd normal text';
    const cleaned = stripControlSequences(s);
    expect(cleaned).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/);
    expect(cleaned).toContain('normal text');
  });
  it('truncate() strips control sequences before applying the length cap', () => {
    const out = truncate('\x1b[31mred alert\x1b[0m', 400);
    expect(out).not.toContain('\x1b');
    expect(out).toContain('red alert');
  });
});

// ── (3) detectBlockedOnChild — the headline capability, including the multi-tool_use fix ───────────
describe('detectBlockedOnChild', () => {
  it('detects a pending nested Agent(run_in_background:false) as the ONLY tool_use in the newest entry', () => {
    const entries = [
      summarizeEntry(JSON.stringify(userEntry([toolResultBlock('t0')])), 4000),
      summarizeEntry(JSON.stringify(assistantEntry([
        toolUseBlock('t1', 'Agent', { description: 'reconcile', run_in_background: false }),
      ])), 4000),
    ];
    const r = detectBlockedOnChild(entries);
    expect(r.pending).toBe(true);
    expect(r.isNestedBlockingAgent).toBe(true);
    expect(r.description).toBe('reconcile');
  });

  it('does NOT flag a background Agent() call (run_in_background:true) as blocking', () => {
    const entries = [
      summarizeEntry(JSON.stringify(assistantEntry([
        toolUseBlock('t1', 'Agent', { description: 'bg work', run_in_background: true }),
      ])), 4000),
    ];
    const r = detectBlockedOnChild(entries);
    // still "pending" in the sense of no result yet, but must not be reported as the nested-child case
    expect(r.isNestedBlockingAgent).toBe(false);
  });

  it('reports not-pending once the tool_result for the newest tool_use has arrived', () => {
    const entries = [
      summarizeEntry(JSON.stringify(assistantEntry([toolUseBlock('t1', 'Bash', { command: 'ls' })])), 4000),
      summarizeEntry(JSON.stringify(userEntry([toolResultBlock('t1')])), 4000),
    ];
    expect(detectBlockedOnChild(entries).pending).toBe(false);
  });

  it('REGRESSION (review-confirmed): a pending Agent() issued alongside an already-resolved tool_use in the SAME turn is still detected', () => {
    // Exactly the review's repro shape: one assistant turn carries two tool_use blocks — a blocking
    // Agent() call issued first, then an unrelated Read — and the Read's result comes back while the
    // Agent call is still pending. The OLD code walked this entry's blocks in reverse and returned
    // `pending:false` as soon as it met the Read's already-resolved tool_use, never inspecting the
    // earlier, still-pending Agent call.
    const entries = [
      summarizeEntry(JSON.stringify(assistantEntry([
        toolUseBlock('agent-call', 'Agent', { description: 'child work', run_in_background: false }),
        toolUseBlock('read-call', 'Read', { file_path: '/tmp/x' }),
      ])), 4000),
      summarizeEntry(JSON.stringify(userEntry([toolResultBlock('read-call', 'file contents')])), 4000),
    ];
    const r = detectBlockedOnChild(entries);
    expect(r.pending).toBe(true);
    expect(r.isNestedBlockingAgent).toBe(true);
    expect(r.toolName).toBe('Agent');
  });

  it('with no tool_use anywhere, reports not-pending', () => {
    const entries = [summarizeEntry(JSON.stringify(userEntry([{ type: 'text', text: 'just chatting' }])), 4000)];
    expect(detectBlockedOnChild(entries).pending).toBe(false);
  });
});
