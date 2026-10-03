/** UserPromptSubmit/PostToolUse broadcast delivery: pure decisions and the real stdin boundary. */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appliesTo, deliver, hasApprovalWording, wrap } from '../broadcast-inject.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'broadcast-inject.mjs');
const NOW = Date.parse('2026-10-03T18:30:00Z');
const rec = (o = {}) => ({ id: 'b1', text: 'Pause pushes to main.', by: 'nic', at: '2026-10-03T18:00:00Z', expiresAt: '2026-10-03T22:00:00Z', filter: { kind: null, repo: null }, targets: [], refused: null, ...o });
const mem = (files) => ({ readJsonImpl: (p) => files[p.split('/').pop()] ?? null, ackExists: () => false, dir: '/d', now: NOW });
const ev = (o = {}) => ({ hook_event_name: 'PostToolUse', session_id: 'sess-aaaa1111', cwd: '/Users/n/workspace/.lanes/web-everything/lane-3', ...o });

describe('appliesTo', () => {
  it('explicit targets win; the index decides kind and repo; an unindexed lane session gets an unfiltered broadcast only', () => {
    expect(appliesTo(rec({ targets: ['sess-aaaa1111'], filter: { kind: 'fix', repo: null } }), 'sess-aaaa1111', null, ev())).toBe(true);
    const idx = { sessions: { 'sess-aaaa1111': { kind: 'review', repo: 'webeverything' } } };
    expect(appliesTo(rec({ filter: { kind: 'fix', repo: null } }), 'sess-aaaa1111', idx, ev())).toBe(false);
    expect(appliesTo(rec({ filter: { kind: 'review', repo: 'web-everything' } }), 'sess-aaaa1111', idx, ev())).toBe(true);
    expect(appliesTo(rec(), 'sess-new0000', idx, ev({ session_id: 'sess-new0000' }))).toBe(true);
    expect(appliesTo(rec({ filter: { kind: 'fix', repo: null } }), 'sess-new0000', idx, ev())).toBe(false); // kind unknown: waits
    expect(appliesTo(rec({ filter: { kind: null, repo: 'plateau-app' } }), 'sess-new0000', idx, ev())).toBe(false);
    expect(appliesTo(rec(), 'sess-new0000', idx, ev({ cwd: '/Users/n/workspace/webeverything' }))).toBe(false); // the operator's own checkout is not an agent lane
  });
});

describe('deliver', () => {
  it('injects an active broadcast once, wrapped, and returns the ack to write', () => {
    const out = deliver(ev(), mem({ 'broadcasts.json': { items: [rec()] }, 'sessions.json': null }));
    expect(out.context).toContain('Pause pushes to main.');
    expect(out.context).toContain('does NOT approve anything');
    expect(out.acks).toHaveLength(1);
    expect(out.acks[0].path).toBe('/d/acks/b1.sess-aaaa1111.json');
  });
  it('skips expired, refused and already-acked broadcasts, and nothing recorded', () => {
    expect(deliver(ev(), mem({ 'broadcasts.json': { items: [rec({ expiresAt: '2026-10-03T18:00:01Z' })] } }))).toBeNull();
    expect(deliver(ev(), mem({ 'broadcasts.json': { items: [rec({ refused: 'Refused: x' })] } }))).toBeNull();
    expect(deliver(ev(), mem({}))).toBeNull();
    expect(deliver(ev(), { ...mem({ 'broadcasts.json': { items: [rec()] } }), ackExists: () => true }).context).toBe('');
    expect(deliver({ hook_event_name: 'PostToolUse' }, mem({ 'broadcasts.json': { items: [rec()] } }))).toBeNull();
  });
  it('refuses approval wording even if it was recorded: acks "refused", injects nothing', () => {
    const out = deliver(ev(), mem({ 'broadcasts.json': { items: [rec({ text: 'LGTM, you can merge now' })] } }));
    expect(out.context).toBe('');
    expect(out.acks[0].body.refused).toBe(true);
  });
  it('hasApprovalWording is strict on approval and gate-clearing, quiet on plain instructions', () => {
    for (const t of ['LGTM', 'approved', 'skip the review gate', 'the check is cleared']) expect(hasApprovalWording(t), t).toBe(true);
    expect(hasApprovalWording('Report status in the PR when you stop.')).toBe(false);
  });
  it('wrap keeps the text verbatim between markers', () => {
    expect(wrap(rec({ text: 'line one\nline "two"' }))).toContain('"""\nline one\nline "two"\n"""');
  });
});

describe('real stdin boundary', () => {
  const run = (dir, event) => spawnSync('node', [SCRIPT], { input: JSON.stringify(event), env: { ...process.env, AGENT_BROADCAST_DIR: dir }, encoding: 'utf8' });
  it('prints additionalContext for the event, writes the ack once, and stays silent the second time', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bi-'));
    mkdirSync(join(dir, 'acks'));
    writeFileSync(join(dir, 'broadcasts.json'), JSON.stringify({ items: [rec({ expiresAt: new Date(Date.now() + 3_600_000).toISOString() })] }));
    const first = run(dir, ev({ hook_event_name: 'UserPromptSubmit' }));
    const out = JSON.parse(first.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(out.hookSpecificOutput.additionalContext).toContain('Pause pushes to main.');
    expect(JSON.parse(readFileSync(join(dir, 'acks', 'b1.sess-aaaa1111.json'), 'utf8')).event).toBe('UserPromptSubmit');
    expect(run(dir, ev()).stdout).toBe('');
  });
  it('no store: silent and exit 0; garbage stdin: silent and exit 0', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'bi-')), 'none');
    const r = run(dir, ev());
    expect(r.status).toBe(0); expect(r.stdout).toBe(''); expect(existsSync(dir)).toBe(false);
    const g = spawnSync('node', [SCRIPT], { input: 'not json', env: { ...process.env, AGENT_BROADCAST_DIR: dir }, encoding: 'utf8' });
    expect(g.status).toBe(0); expect(g.stdout).toBe('');
  });
});
