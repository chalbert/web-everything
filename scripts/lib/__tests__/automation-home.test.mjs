/**
 * @file automation-home.test.mjs — decouple-primary-checkout (epic #4075): where the automation's code (the
 * control clone) and state (the state home) live, and that neither is ever the operator's primary checkout.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  workspaceOf, controlClonePath, controlCloneExists, isControlClone, automationStateRoot, legacyStateRoots,
  CONTROL_CLONE_ENV, CONTROL_CLONE_DIRNAME,
} from '../automation-home.mjs';
import { daemonConveyorStateRoot } from '../daemon-last-good.mjs';

describe('workspaceOf', () => {
  it('a lane answers the workspace above `.lanes/`', () => {
    expect(workspaceOf('/w/.lanes/web-everything/lane-7')).toBe('/w');
  });
  it('any other checkout answers its parent', () => {
    expect(workspaceOf('/w/webeverything')).toBe('/w');
    expect(workspaceOf('/w/wev-review-daemon')).toBe('/w');
  });
});

describe('controlClonePath', () => {
  it('defaults to ~/workspace/wev-control — never the primary checkout', () => {
    const p = controlClonePath({ env: {}, home: '/h' });
    expect(p).toBe(join('/h', 'workspace', CONTROL_CLONE_DIRNAME));
    expect(p).not.toMatch(/web-?everything$/);
  });
  it('derives the workspace from `root` when given (a lane or a daemon clone)', () => {
    expect(controlClonePath({ env: {}, root: '/w/.lanes/web-everything/lane-2' })).toBe('/w/wev-control');
    expect(controlClonePath({ env: {}, root: '/w/wev-review-daemon' })).toBe('/w/wev-control');
  });
  it(`${CONTROL_CLONE_ENV} overrides it`, () => {
    expect(controlClonePath({ env: { [CONTROL_CLONE_ENV]: ' /srv/ctl ' }, home: '/h' })).toBe('/srv/ctl');
  });
  it('controlCloneExists probes the clone\'s .git', () => {
    const seen = [];
    expect(controlCloneExists({ env: {}, home: '/h', exists: (p) => { seen.push(p); return true; } })).toBe(true);
    expect(seen).toEqual(['/h/workspace/wev-control/.git']);
    expect(controlCloneExists({ env: {}, home: '/h', exists: () => { throw new Error('boom'); } })).toBe(false);
  });
  it('isControlClone recognises the clone itself, and nothing else', () => {
    expect(isControlClone('/w/wev-control', { env: {} })).toBe(true);
    expect(isControlClone('/w/webeverything', { env: {} })).toBe(false);
    expect(isControlClone('/srv/ctl', { env: { [CONTROL_CLONE_ENV]: '/srv/ctl' } })).toBe(true);
  });
});

describe('automationStateRoot', () => {
  it('is exactly daemonConveyorStateRoot — one state home, not two', () => {
    for (const env of [{}, { WE_DAEMON_STATE_DIR: '/tmp/d' }, { CONVEYOR_STATE_ROOT: '/tmp/pin' }]) {
      expect(automationStateRoot(env)).toBe(daemonConveyorStateRoot(env));
    }
    expect(automationStateRoot({ WE_DAEMON_STATE_DIR: '/tmp/d' })).toBe('/tmp/d/conveyor-state');
  });
});

describe('legacyStateRoots (one-release compatibility read only)', () => {
  const id = (p) => p;
  it('is the workspace PRIMARY only — never the running lane\'s own (stale) sidecar root', () => {
    const exists = (p) => ['/w/.lanes/web-everything/lane-1', '/w/webeverything'].includes(p);
    expect(legacyStateRoots({ root: '/w/.lanes/web-everything/lane-1', stateRoot: '/s', exists, realpath: id }))
      .toEqual(['/w/webeverything']);
  });
  it('the two aliases of one primary collapse to its real path; the state root itself is never listed', () => {
    const exists = (p) => ['/w/web-everything', '/w/webeverything'].includes(p);
    const realpath = (p) => (p === '/w/web-everything' ? '/w/webeverything' : p);
    expect(legacyStateRoots({ root: '/w/wev-control', stateRoot: '/s', exists, realpath })).toEqual(['/w/webeverything']);
    expect(legacyStateRoots({ root: '/w/wev-control', stateRoot: '/w/webeverything', exists, realpath })).toEqual([]);
  });
});
