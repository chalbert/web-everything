/**
 * @file scripts/conveyor/health-smells/__tests__/gh-shim-lane-path.test.mjs
 * @description #4200-ish (gh-shim-stable-path) — the PURE `evaluate()` of the `gh-shim-lane-path` smell, over
 *   plain `ghShimLanes` fixtures shaped like `probeGhShimLanes`'s own return value (no fs here — see the sibling
 *   smell tests for the same no-fs convention).
 */
import { describe, it, expect } from 'vitest';
import ghShimLanePath from '../gh-shim-lane-path.mjs';

describe('gh-shim-lane-path', () => {
  it('breaches on a shim whose GH_THROTTLE_CLI is baked into a lane clone', () => {
    const ghShimLanes = [{
      path: '/Users/op/.claude/github-app-token/gh-shim/gh',
      throttleCli: '/Users/op/workspace/.lanes/web-everything/lane-22/scripts/lib/gh-throttle.mjs',
      realGh: '/opt/homebrew/bin/gh',
      inLane: true,
    }];
    const [out] = ghShimLanePath.evaluate({ ghShimLanes });
    expect(out.breach).toBe(true);
    expect(out.subject).toBe(ghShimLanes[0].path);
    expect(out.summary).toContain('lane-22');
  });

  it('breaches on a shim whose REAL_GH (not the throttle CLI) is the one baked into a lane', () => {
    const ghShimLanes = [{
      path: '/Users/op/.claude/github-app-token/gh-shim.d/abc123/gh',
      throttleCli: '/Users/op/workspace/webeverything/scripts/lib/gh-throttle.mjs',
      realGh: '/Users/op/workspace/.lanes/web-everything/lane-9/scripts/lib/gh-app-shim.mjs',
      inLane: true,
    }];
    const [out] = ghShimLanePath.evaluate({ ghShimLanes });
    expect(out.breach).toBe(true);
    expect(out.summary).toContain('lane-9');
  });

  it('does NOT breach on a shim whose baked paths are both stable (the primary checkout)', () => {
    const ghShimLanes = [{
      path: '/Users/op/.claude/github-app-token/gh-shim.d/def456/gh',
      throttleCli: '/Users/op/workspace/webeverything/scripts/lib/gh-throttle.mjs',
      realGh: '/opt/homebrew/bin/gh',
      inLane: false,
    }];
    const [out] = ghShimLanePath.evaluate({ ghShimLanes });
    expect(out.breach).toBe(false);
  });

  it('returns no episodes when no shim exists yet', () => {
    expect(ghShimLanePath.evaluate({ ghShimLanes: [] })).toEqual([]);
  });
});
