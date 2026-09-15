/**
 * @file explore-scratch-reclaim.test.mjs — who reclaims an explore run's panelist scratch directory, and when (#2304).
 *
 * `explore-io.mjs`'s header used to call `<workspace>/.operations/explore/<runId>/` transient while nothing ever
 * removed one. The waker now does, once per pass, and only for a run that is `complete` with no `in-flight`
 * entry. These tests drive REAL committee runs through the real sinks and observers against a real temp scratch
 * root — the directories, the report files and the removal are all on disk — and only `claude` is stubbed.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { advance, advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { observeRun } from '../effect-observer.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { EXPLORE_OP, exploreOperation } from '../explore.mjs';
import {
  REPORT_DIR_ENV,
  REPORT_END_MARKER,
  SCRATCH_KEPT,
  createExploreObservers,
  createExploreSinks,
  defaultListRunDirs,
  panelistReportDir,
  panelistReportPath,
  reclaimExploreScratch,
} from '../explore-io.mjs';
import { renderPass, wakePass } from '../wake.mjs';

const ROOT = '/primary/webeverything';

let scratch;
let env;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'we-explore-reclaim-'));
  env = { [REPORT_DIR_ENV]: scratch };
});
afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function exploreRegistry() {
  const registry = createRegistry();
  registry.register(exploreOperation());
  return registry;
}

/**
 * Drive one committee through the REAL sinks (which `mkdir` the run's directory) and observers (which read the
 * report back off disk). Stops after `seatsReported` panelists have written a report; with every seat reported
 * it answers the juror and the confirm, so the run ends `complete` — unless `finish` is false, which leaves it
 * waiting on its juror with nothing in flight.
 */
async function driveCommittee({ id, store, seatsReported = 3, finish = true }) {
  const registry = exploreRegistry();
  let minted = 0;
  const sinks = createExploreSinks({
    root: ROOT, env, spawnAgent: () => '', mintSessionId: () => { minted += 1; return `${id}-sess${minted}`; },
  });
  const observers = createExploreObservers({ root: ROOT, env, listAgents: () => [] });
  let run = advanceWhileRunning(startRun({
    op: EXPLORE_OP, id, input: { question: 'Does anything reclaim scratch?', terminal: 'report-only' }, registry,
  }), { registry });

  for (let seat = 0; seat < run.findings.plan.panelSize; seat += 1) {
    const applied = await applyPendingEffects(run, { sinks, store });
    run = applied.run;
    const entry = run.effects.find((e) => e.key === applied.inFlight[0]);
    if (seat >= seatsReported) return { run, registry, entry };
    writeFileSync(
      panelistReportPath(run.id, entry.payload.panelist, entry.handle, { root: ROOT, env }),
      `# ${entry.payload.panelist}\n\nFound it.\n\n${REPORT_END_MARKER}\n`,
    );
    run = (await observeRun(run, { observers })).run;
    run = advanceWhileRunning(run, { registry });
  }
  if (!finish) { store.write(run); return { run, registry }; }
  run = advance(run, { registry, resume: { value: { summary: 'Nothing reclaims it.', findings: [] } } });
  run = advanceWhileRunning(run, { registry });
  run = advanceWhileRunning(advance(run, { registry, resume: { value: 'proceed' } }), { registry });
  store.write(run);
  return { run, registry };
}

const dirOf = (runId) => panelistReportDir(runId, { root: ROOT, env });

describe('#2304 — the waker reclaims a finished committee\'s scratch directory, and nothing else', () => {
  it('RECLAIMS a completed run\'s directory — through a real waker pass — superseded attempts included', async () => {
    const store = createMemoryRunStore();
    const { run, registry } = await driveCommittee({ id: 'run-explore-done', store });
    expect(runStatus(run, { registry })).toBe('complete');
    // A superseded attempt's report sits beside the live ones; the unit of reclaim is the RUN, so it goes too.
    writeFileSync(join(dirOf(run.id), 'p1-superseded-attempt.md'), 'an earlier attempt\n');
    expect(readdirSync(dirOf(run.id))).toHaveLength(4);

    const pass = await wakePass({
      store, observers: {}, resolveFor: () => ({ registry, sinks: {} }),
      reclaim: ({ store: s }) => reclaimExploreScratch({ store: s, root: ROOT, env }),
    });

    expect(pass.reclaimed).toEqual(['run-explore-done']);
    expect(pass.errors).toEqual([]);
    expect(existsSync(dirOf(run.id))).toBe(false);
    expect(existsSync(scratch)).toBe(true); // the ROOT is shared by every checkout's runs and is never removed
    // The reports were already folded onto the record, which is untouched.
    expect(store.read(run.id).effects.filter((e) => e.result?.report).length).toBe(3);
    expect(renderPass(pass)).toEqual([
      'wake: 1 run(s) scanned, none parked on a dispatch.',
      '  reclaimed the explore scratch directory of 1 completed run(s): run-explore-done',
    ]);
  });

  it('REFUSES to reclaim a run that still holds an in-flight panelist — even across a waker pass', async () => {
    const store = createMemoryRunStore();
    const { run, registry, entry } = await driveCommittee({ id: 'run-explore-live', store, seatsReported: 1 });
    expect(entry.status).toBe('in-flight');
    const before = readdirSync(dirOf(run.id));
    expect(before).toHaveLength(1); // p1's finished report; p2 is investigating and has not written yet

    const pass = await wakePass({
      store,
      // p2 is still listed, so the pass leaves it running and the run stays parked.
      observers: createExploreObservers({ root: ROOT, env, listAgents: () => [{ sessionId: entry.handle }] }),
      resolveFor: () => ({ registry, sinks: {} }),
      reclaim: ({ store: s }) => reclaimExploreScratch({ store: s, root: ROOT, env }),
    });

    expect(pass.parked).toBe(1);
    expect(pass.reclaimed).toEqual([]);
    expect(readdirSync(dirOf(run.id))).toEqual(before);
    expect(reclaimExploreScratch({ store, root: ROOT, env }).kept).toEqual([
      { runId: 'run-explore-live', reason: SCRATCH_KEPT.IN_FLIGHT },
    ]);
  });

  it('the in-flight refusal does not lean on the status check — a record claiming `complete` with one is kept', async () => {
    const store = createMemoryRunStore();
    const { run, registry } = await driveCommittee({ id: 'run-explore-odd', store });
    const odd = { ...run, effects: run.effects.map((e, i) => (i === 0 ? { ...e, status: 'in-flight' } : e)) };
    store.write(odd);
    expect(runStatus(odd, { registry })).toBe('complete');

    const out = reclaimExploreScratch({ store, root: ROOT, env });
    expect(out.kept).toEqual([{ runId: 'run-explore-odd', reason: SCRATCH_KEPT.IN_FLIGHT }]);
    expect(existsSync(dirOf(run.id))).toBe(true);
  });

  it('keeps a run that is not complete even with nothing in flight — a committee waiting on its juror', async () => {
    const store = createMemoryRunStore();
    const { run, registry } = await driveCommittee({ id: 'run-explore-judging', store, finish: false });
    expect(runStatus(run, { registry })).toBe('awaiting-judge');
    expect(run.effects.some((e) => e.status === 'in-flight')).toBe(false);

    expect(reclaimExploreScratch({ store, root: ROOT, env }).kept).toEqual([
      { runId: 'run-explore-judging', reason: SCRATCH_KEPT.NOT_COMPLETE },
    ]);
    expect(existsSync(dirOf(run.id))).toBe(true);
  });

  it('keeps a directory THIS store has no record for — it is most likely another checkout\'s committee', () => {
    mkdirSync(dirOf('run-elsewhere'));
    writeFileSync(join(dirOf('run-elsewhere'), 'p1-abc.md'), 'someone else\'s live report\n');
    const out = reclaimExploreScratch({ store: createMemoryRunStore(), root: ROOT, env });
    expect(out).toMatchObject({ reclaimed: [], kept: [{ runId: 'run-elsewhere', reason: SCRATCH_KEPT.NO_RECORD }] });
    expect(existsSync(join(dirOf('run-elsewhere'), 'p1-abc.md'))).toBe(true);
  });

  it('keeps a directory whose record belongs to a different operation', () => {
    mkdirSync(dirOf('run-other-op'));
    const store = { read: (id) => ({ id, op: 'dispatch-lane', cursor: 9, effects: [] }) };
    expect(reclaimExploreScratch({ store, root: ROOT, env }).kept).toEqual([
      { runId: 'run-other-op', reason: SCRATCH_KEPT.NOT_EXPLORE },
    ]);
  });

  it('never lists a symlink, a stray file or a name that is not a run id — so none can be removed', () => {
    const outside = mkdtempSync(join(tmpdir(), 'we-explore-reclaim-outside-'));
    try {
      writeFileSync(join(outside, 'precious.md'), 'not scratch\n');
      symlinkSync(outside, join(scratch, 'run-linked'));
      writeFileSync(join(scratch, 'run-a-file'), 'x');
      mkdirSync(join(scratch, 'not a run id'));
      mkdirSync(join(scratch, 'run-real'));
      expect(defaultListRunDirs(scratch)).toEqual(['run-real']);
      expect(existsSync(join(outside, 'precious.md'))).toBe(true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
    expect(defaultListRunDirs(join(scratch, 'no-such-root'))).toEqual([]);
  });

  it('is fail-soft per directory: an unreadable record or a failed removal is reported and the rest proceed', async () => {
    const store = createMemoryRunStore();
    await driveCommittee({ id: 'run-explore-ok', store });
    mkdirSync(dirOf('run-explore-torn'));
    const reading = { read: (id) => { if (id === 'run-explore-torn') throw new Error('torn record'); return store.read(id); } };

    const out = reclaimExploreScratch({ store: reading, root: ROOT, env });
    expect(out.errors).toEqual([{ runId: 'run-explore-torn', error: 'torn record' }]);
    expect(out.reclaimed).toEqual(['run-explore-ok']);
    expect(existsSync(dirOf('run-explore-torn'))).toBe(true);

    const failing = await wakePass({
      store: { list: () => [], read: () => null },
      observers: {},
      resolveFor: () => ({}),
      reclaim: () => { throw new Error('EACCES'); },
    });
    expect(failing.errors).toEqual([{ error: 'scratch reclaim: EACCES' }]);
  });

  it('an unreclaimable id from an injected lister never reaches the remover', () => {
    const removed = [];
    reclaimExploreScratch({
      store: { read: () => { throw new Error('should not be read'); } },
      root: ROOT, env, listRunDirs: () => ['../escape', ''], removeDir: (d) => removed.push(d),
    });
    expect(removed).toEqual([]);
  });
});
