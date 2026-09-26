/**
 * @file scripts/operations/__tests__/agent-activity-io-real.test.mjs
 * @description backlog #3932 — the fidelity qualifier (#2949, motivated by #3264): `agent-activity-io.mjs`'s
 * real reads (a subprocess shell-out, and real directory/file enumeration under a project-slug tree) proved
 * against REAL processes and a REAL directory tree, not the injected doubles `agent-activity.test.mjs` uses
 * for the pure resolver. An injected `run`/`readFileSync` stub has no clone geometry and no directory tree —
 * see `heavy-queue-io-real.test.mjs`'s header for the shipped bug (#3264) this discipline exists to catch.
 */
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { withRealRepo } from './helpers/real-repo.mjs';
import {
  readLaneLeases, indexLeasesBySession, codexThreadRows, subagentRowsFor, claimedNumsFromTranscript,
  firstMessageText, interactiveRows, projectSlugFor,
} from '../agent-activity-io.mjs';

function assistantLine(toolCalls) {
  return JSON.stringify({ type: 'assistant', message: { content: toolCalls } });
}
function userLine(text) {
  return JSON.stringify({ type: 'user', message: { content: text } });
}

it('readLaneLeases shells out to a REAL `<root>/scripts/lane-pool.mjs status --json` child process and parses its real stdout', async () => {
  await withRealRepo(async ({ root }) => {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    // A real, tiny, real Node script — genuinely spawned by `execFileSync`, not an injected function.
    writeFileSync(join(root, 'scripts', 'lane-pool.mjs'),
      "process.stdout.write(JSON.stringify({ lanes: [{ lane: 1, lease: { purpose: 'build-3932', ownerSession: 'op-1', workerSession: 'op-1' } }, { lane: 2, lease: null }] }));\n");
    const leases = readLaneLeases({ run: execFileSync, root });
    expect(leases).toEqual([{ purpose: 'build-3932', ownerSession: 'op-1', workerSession: 'op-1' }]);
    expect(indexLeasesBySession(leases).get('op-1')).toMatchObject({ purpose: 'build-3932' });
  });
});

it('readLaneLeases fails soft (empty array, never throws) when the real child process exits non-zero', async () => {
  await withRealRepo(async ({ root }) => {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'scripts', 'lane-pool.mjs'), "process.exit(1);\n");
    expect(readLaneLeases({ run: execFileSync, root })).toEqual([]);
  });
});

it('codexThreadRows reads REAL `.operations/codex-delivery-threads/*.json` files off a real directory tree', async () => {
  await withRealRepo(async ({ root }) => {
    const dir = join(root, '.operations', 'codex-delivery-threads');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'conveyor-3445.json'), JSON.stringify({ sessionSlug: 'conveyor-3445', threadId: 'th_real1', at: '2026-09-26T10:00:00.000Z' }));
    // A corrupt/partial record must be skipped, not thrown on — real disk state includes half-written files.
    writeFileSync(join(dir, 'broken.json'), '{ not json');
    const rows = codexThreadRows(root);
    expect(rows).toEqual([{
      id: 'codex-th_real1', sessionId: null, runtime: 'codex', kind: 'codex', codexSlug: 'conveyor-3445',
      cwd: null, state: null, startedAt: Date.parse('2026-09-26T10:00:00.000Z'), lastEventAt: null,
    }]);
  });
});

it('codexThreadRows returns [] for a real root with no codex-delivery-threads directory at all', async () => {
  await withRealRepo(async ({ root }) => { expect(codexThreadRows(root)).toEqual([]); });
});

it('subagentRowsFor + firstMessageText read a REAL `<projects>/<slug>/<sessionId>/subagents/` tree — plain and workflow-lane children', async () => {
  await withRealRepo(async ({ root }) => {
    const cwd = '/Users/fixture/workspace/some-lane';
    const slug = projectSlugFor(cwd);
    const sessionDir = join(root, 'projects', slug, 'parent-session-1');
    const plainDir = join(sessionDir, 'subagents');
    mkdirSync(plainDir, { recursive: true });
    writeFileSync(join(plainDir, 'agent-a111.jsonl'), `${userLine('go read the file')}\n${assistantLine([{ type: 'text', text: 'ok' }])}\n`);

    const wfDir = join(plainDir, 'workflows', 'wf_run1');
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, 'agent-a222.jsonl'), `${userLine('verify:#3444 please proceed')}\n`);

    const rows = subagentRowsFor('parent-session-1', cwd, join(root, 'projects'));
    expect(rows).toHaveLength(2);
    const plain = rows.find((r) => r.id.endsWith('agent-a111.jsonl'));
    expect(plain).toMatchObject({ parentSessionId: 'parent-session-1', workflowLane: false, firstMessageText: 'go read the file' });
    const wf = rows.find((r) => r.id.includes('wf:wf_run1'));
    expect(wf).toMatchObject({ parentSessionId: 'parent-session-1', workflowLane: true, firstMessageText: 'verify:#3444 please proceed' });
  });
});

it('subagentRowsFor returns [] for a real session with no subagents directory', async () => {
  await withRealRepo(async ({ root }) => {
    expect(subagentRowsFor('sess-none', '/anywhere', join(root, 'projects'))).toEqual([]);
  });
});

it('firstMessageText reads a real multi-block first message off disk', async () => {
  await withRealRepo(async ({ root }) => {
    const p = join(root, 'one.jsonl');
    writeFileSync(p, `${JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'part one' }, { type: 'text', text: 'part two' }] } })}\n${assistantLine([])}\n`);
    expect(firstMessageText(p)).toBe('part one part two');
  });
});

it('claimedNumsFromTranscript replays REAL claim/release Bash calls off a real transcript file, net set in order', async () => {
  await withRealRepo(async ({ root }) => {
    const p = join(root, 'sess.jsonl');
    const lines = [
      assistantLine([{ type: 'tool_use', name: 'Bash', input: { command: 'node scripts/backlog.mjs claim 3401' } }]),
      assistantLine([{ type: 'tool_use', name: 'Bash', input: { command: 'node scripts/backlog.mjs claim 3555' } }]),
      assistantLine([{ type: 'tool_use', name: 'Bash', input: { command: 'node scripts/backlog.mjs resolve 3401' } }]),
    ];
    writeFileSync(p, lines.join('\n') + '\n');
    expect(claimedNumsFromTranscript(p)).toEqual(['3555']);
  });
});

it('claimedNumsFromTranscript returns [] for a real path that does not exist', async () => {
  await withRealRepo(async ({ root }) => { expect(claimedNumsFromTranscript(join(root, 'nope.jsonl'))).toEqual([]); });
});

it('interactiveRows sweeps REAL project directories, skipping known session ids and anything past the recency window', async () => {
  await withRealRepo(async ({ root }) => {
    const projectsDir = join(root, 'projects');
    const slugDir = join(projectsDir, 'some-slug');
    mkdirSync(slugDir, { recursive: true });
    const freshId = '11111111-1111-1111-1111-111111111111';
    const staleId = '22222222-2222-2222-2222-222222222222';
    const knownId = '33333333-3333-3333-3333-333333333333';
    for (const id of [freshId, staleId, knownId]) {
      writeFileSync(join(slugDir, `${id}.jsonl`), `${userLine('hello')}\n`);
    }
    const now = Date.now();
    utimesSync(join(slugDir, `${freshId}.jsonl`), now / 1000, now / 1000);
    const eightHoursAgo = (now - 8 * 3600_000) / 1000;
    utimesSync(join(slugDir, `${staleId}.jsonl`), eightHoursAgo, eightHoursAgo);
    utimesSync(join(slugDir, `${knownId}.jsonl`), now / 1000, now / 1000);

    const rows = interactiveRows(new Set([knownId]), projectsDir, now);
    expect(rows.map((r) => r.sessionId)).toEqual([freshId]);
    expect(rows[0]).toMatchObject({ kind: 'interactive', firstMessageText: 'hello' });
  });
});
