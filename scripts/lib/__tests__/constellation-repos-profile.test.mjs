/**
 * @file scripts/lib/__tests__/constellation-repos-profile.test.mjs
 * @description Executable proof for we:backlog/xjko7gy-multi-repo-slice-1-a-per-repo-profile.md: `repoProfile`
 *   collapses key/slug/slugTag/scope-prefix into ONE frozen per-repo profile, and `gateFor` reuses
 *   `verify-lane-gate.mjs#composeGate` (never a second gate derivation) against that profile's checkout path.
 *   No real filesystem/homedir IO: `home` and `gateFor`'s `checkoutExists`/`readPackageJson` are injected
 *   throughout, so this suite is hermetic and immune to whatever machine it runs on.
 */
import { describe, it, expect } from 'vitest';

import { repoProfile, gateFor, briefTokensForRepo } from '../repo-profile.mjs';
import { composeGate } from '../verify-lane-gate.mjs';

const HOME = '/home/test';

describe('repoProfile', () => {
  const EXPECT = {
    we: {
      slug: 'chalbert/web-everything', slugTag: '', lanePoolRepo: '.',
      scopePrefixes: ['we', 'webeverything'], canonicalPrefix: 'we',
      capabilities: { review: true, fix: true, ciHeal: true, build: 'direct' },
    },
    frontierui: {
      slug: 'chalbert/frontierui', slugTag: 'fui', lanePoolRepo: `${HOME}/workspace/frontierui`,
      scopePrefixes: ['fui', 'frontierui'], canonicalPrefix: 'fui',
      capabilities: { review: true, fix: false, ciHeal: false, build: 'couple' },
    },
    'plateau-app': {
      slug: 'chalbert/plateau-app', slugTag: 'pa', lanePoolRepo: `${HOME}/workspace/plateau-app`,
      scopePrefixes: ['plateau', 'plateau-app'], canonicalPrefix: 'plateau',
      capabilities: { review: true, fix: false, ciHeal: false, build: 'couple' },
    },
  };

  // Every input form this function documents itself as accepting, per repo.
  const INPUTS = {
    we: ['we', 'chalbert/web-everything', 'we:', 'webeverything', 'webeverything:'],
    frontierui: ['frontierui', 'chalbert/frontierui', 'fui', 'fui:', 'frontierui:'],
    'plateau-app': ['plateau-app', 'chalbert/plateau-app', 'pa', 'pa:', 'plateau', 'plateau:', 'plateau-app:'],
  };

  for (const [key, inputs] of Object.entries(INPUTS)) {
    for (const input of inputs) {
      it(`resolves ${JSON.stringify(input)} to the ${key} profile`, () => {
        const profile = repoProfile(input, { home: HOME });
        expect(profile.key).toBe(key);
        expect(profile.slug).toBe(EXPECT[key].slug);
        expect(profile.slugTag).toBe(EXPECT[key].slugTag);
        expect(profile.lanePoolRepo).toBe(EXPECT[key].lanePoolRepo);
        expect(profile.scopePrefixes).toEqual(EXPECT[key].scopePrefixes);
        expect(profile.canonicalPrefix).toBe(EXPECT[key].canonicalPrefix);
        expect(profile.capabilities).toEqual(EXPECT[key].capabilities);
      });
    }
  }

  it('every input form for one repo resolves to the SAME profile (deep-equal)', () => {
    const profiles = INPUTS.frontierui.map((input) => repoProfile(input, { home: HOME }));
    for (const p of profiles.slice(1)) expect(p).toEqual(profiles[0]);
  });

  it('checkoutPath is absolute and $HOME-expanded for a sibling repo', () => {
    const profile = repoProfile('frontierui', { home: HOME });
    expect(profile.checkoutPath).toBe(`${HOME}/workspace/frontierui`);
  });

  it('checkoutPath for `we` is an absolute path (this checkout\'s own root), and matches lanePoolRepo\'s `.` semantics', () => {
    const profile = repoProfile('we', { home: HOME });
    expect(profile.checkoutPath.startsWith('/')).toBe(true);
    expect(profile.lanePoolRepo).toBe('.');
  });

  it('defaults `home` to the real homedir() when not injected', () => {
    const profile = repoProfile('frontierui');
    expect(profile.lanePoolRepo.startsWith('/')).toBe(true);
    expect(profile.lanePoolRepo.endsWith('/workspace/frontierui')).toBe(true);
  });

  it('returns null for unknown input, and never throws', () => {
    for (const bad of ['nope', '', 'not-a-slug', 'chalbert/other-repo', 'plateauapp', null, undefined, 123, {}]) {
      expect(() => repoProfile(bad)).not.toThrow();
      expect(repoProfile(bad)).toBeNull();
    }
  });

  it('the returned profile is frozen', () => {
    const profile = repoProfile('we');
    expect(Object.isFrozen(profile)).toBe(true);
    expect(() => { 'use strict'; profile.key = 'frontierui'; }).toThrow(/read only|frozen/i);
    expect(profile.key).toBe('we');
    expect(Object.isFrozen(profile.capabilities)).toBe(true);
    expect(Object.isFrozen(profile.scopePrefixes)).toBe(true);
  });
});

describe('gateFor', () => {
  it('returns null for an unknown repo', () => {
    expect(gateFor('not-a-repo')).toBeNull();
  });

  it('returns null when the checkout does not exist (injected)', () => {
    const result = gateFor('frontierui', { home: HOME, checkoutExists: () => false });
    expect(result).toBeNull();
  });

  it('builds the gate from the checkout\'s OWN package.json scripts via composeGate — never a second derivation', () => {
    const packageJson = JSON.stringify({ scripts: { test: 'vitest run' } });
    const result = gateFor('plateau-app', {
      home: HOME,
      checkoutExists: (p) => { expect(p).toBe(`${HOME}/workspace/plateau-app`); return true; },
      readPackageJson: (p) => { expect(p).toBe(`${HOME}/workspace/plateau-app/package.json`); return packageJson; },
    });
    const expected = composeGate({
      vitestCmd: 'npm run test:unit', checkStandardsCmd: 'npm run check:standards', scripts: ['test'],
    }).command;
    expect(result).toBe(expected);
    expect(result).toBe('npm test'); // plateau-app has no test:unit/check:standards today — full-fallback + skip
  });

  it('a WE-shaped checkout (both scripts) gets the unabridged historical gate', () => {
    const packageJson = JSON.stringify({ scripts: { 'test:unit': 'vitest run', 'check:standards': 'node scripts/check-standards.mjs' } });
    const result = gateFor('we', {
      checkoutExists: () => true,
      readPackageJson: () => packageJson,
    });
    expect(result).toBe('npm run test:unit && npm run check:standards');
  });

  it('falls back gracefully when package.json is missing/unreadable (treated as WE-shaped, unchanged default)', () => {
    const result = gateFor('we', {
      checkoutExists: () => true,
      readPackageJson: () => { throw new Error('ENOENT'); },
    });
    expect(result).toBe('npm run test:unit && npm run check:standards');
  });
});

// #3960 (multi-repo slice 4) — `briefTokensForRepo` is the ONE place `dispatchFix`/`dispatchCiHeal` get the five
// repo-aware brief placeholders from; these tests pin its WE shape (must reproduce today's hardcoded literal
// values byte-for-byte) and prove it also resolves correctly for a sibling repo, ready for slice 5.
describe('briefTokensForRepo', () => {
  const WE_PACKAGE_JSON = JSON.stringify({ scripts: { 'test:unit': 'vitest run', 'check:standards': 'node scripts/check-standards.mjs' } });
  const PLATEAU_PACKAGE_JSON = JSON.stringify({ scripts: { test: 'vitest run' } });

  it('for `we`, reproduces exactly what the pre-#3960 briefs hardcoded', () => {
    const tokens = briefTokensForRepo('we', {
      itemNum: '3960', prNum: 743,
      checkoutExists: () => true, readPackageJson: () => WE_PACKAGE_JSON,
    });
    expect(tokens).toEqual({
      REPO: 'chalbert/web-everything',
      LANE_REPO: '.',
      GATE_COMMAND: 'npm run test:unit && npm run check:standards',
      WE_ROOT: expect.any(String),
      ATTRIBUTION: 'WE #3960',
    });
    // `WE_ROOT` is THIS checkout's own root, not injected — it must be absolute either way.
    expect(tokens.WE_ROOT.startsWith('/')).toBe(true);
  });

  it('ATTRIBUTION falls back to `PR #<n>` when there is no item (an item-less fix, slice 6)', () => {
    const tokens = briefTokensForRepo('we', {
      prNum: 743, checkoutExists: () => true, readPackageJson: () => WE_PACKAGE_JSON,
    });
    expect(tokens.ATTRIBUTION).toBe('PR #743');
  });

  it('for a sibling repo, WE_ROOT still points at WE (the tools live only there), everything else is the target repo\'s own', () => {
    const tokens = briefTokensForRepo('plateau-app', {
      itemNum: '3960', home: '/home/test',
      checkoutExists: () => true, readPackageJson: () => PLATEAU_PACKAGE_JSON,
    });
    expect(tokens.REPO).toBe('chalbert/plateau-app');
    expect(tokens.LANE_REPO).toBe('/home/test/workspace/plateau-app');
    expect(tokens.GATE_COMMAND).toBe('npm test'); // no test:unit/check:standards script — see `gateFor`'s own tests
    expect(tokens.ATTRIBUTION).toBe('PLATEAU #3960');
    expect(tokens.WE_ROOT.startsWith('/')).toBe(true);
    expect(tokens.WE_ROOT).not.toBe(tokens.LANE_REPO);
  });

  it('returns null for an unknown repo', () => {
    expect(briefTokensForRepo('not-a-repo', { itemNum: '1' })).toBeNull();
  });

  it('returns null when the target checkout does not exist (gate unresolvable) — fail-closed, never a guess', () => {
    expect(briefTokensForRepo('frontierui', { itemNum: '1', checkoutExists: () => false })).toBeNull();
  });

  it('the returned tokens are frozen', () => {
    const tokens = briefTokensForRepo('we', { itemNum: '1', checkoutExists: () => true, readPackageJson: () => WE_PACKAGE_JSON });
    expect(Object.isFrozen(tokens)).toBe(true);
  });
});
