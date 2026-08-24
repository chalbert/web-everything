/**
 * #3265 — the two defects that between them left a cloud VM with NO writable surface at all: the primary is
 * denied by `guard-lane.mjs` (committed hook) and no lane could be provisioned to work in instead.
 *
 * Both are about a path being ASSUMED rather than derived, so both are pinned here as pure functions.
 */
import { describe, it, expect } from 'vitest';
import { join, sep } from 'node:path';
import { workspaceFor, defaultPoolRoot } from '../lib/lane-pool-paths.mjs';

describe('workspaceFor — where the siblings and the pool actually sit', () => {
  it('is the parent of a primary checkout', () => {
    expect(workspaceFor('/home/user/web-everything')).toBe('/home/user');
    expect(workspaceFor('/Users/nic/workspace/webeverything')).toBe('/Users/nic/workspace');
  });

  it('resolves a LANE to the workspace above `.lanes`, not to the lane pool directory', () => {
    // The load-bearing case: a caller standing in a lane must find the SAME pool as one in the primary.
    expect(workspaceFor('/home/user/.lanes/web-everything/lane-1')).toBe('/home/user');
  });

  it('resolves a subdirectory of a lane the same way', () => {
    expect(workspaceFor('/home/user/.lanes/web-everything/lane-9/scripts')).toBe('/home/user');
  });

  it('takes the OUTERMOST .lanes, so a nested pool cannot re-root the answer', () => {
    expect(workspaceFor(`/ws/.lanes/we/lane-1/.lanes/x/lane-2`)).toBe('/ws');
  });
});

describe('defaultPoolRoot — derived from the checkout, never from $HOME', () => {
  it('puts the pool beside the checkout when $HOME disagrees (the cloud VM)', () => {
    // $HOME=/root, checkouts under /home/user — the exact split that resolved to a phantom
    // /root/workspace/.lanes and made provisioning impossible.
    expect(defaultPoolRoot('/home/user/web-everything', { HOME: '/root' })).toBe('/home/user/.lanes');
  });

  it('is unchanged on a laptop, where $HOME and the checkouts agree', () => {
    expect(defaultPoolRoot('/Users/nic/workspace/webeverything', { HOME: '/Users/nic' }))
      .toBe(join('/Users/nic/workspace', '.lanes'));
  });

  it('resolves the same pool from inside a lane as from the primary', () => {
    const env = { HOME: '/root' };
    expect(defaultPoolRoot('/home/user/.lanes/web-everything/lane-1', env))
      .toBe(defaultPoolRoot('/home/user/web-everything', env));
  });

  it('LANE_POOL_ROOT still wins, and still expands ~', () => {
    expect(defaultPoolRoot('/home/user/web-everything', { LANE_POOL_ROOT: '/custom/.lanes' }))
      .toBe('/custom/.lanes');
    expect(defaultPoolRoot('/anywhere', { HOME: '/root', LANE_POOL_ROOT: '~/pool' }))
      .toBe(join('/root', 'pool'));
  });

  it('never returns a path under $HOME merely because $HOME exists', () => {
    expect(defaultPoolRoot('/srv/checkouts/web-everything', { HOME: '/root' }).startsWith('/root')).toBe(false);
  });
});
