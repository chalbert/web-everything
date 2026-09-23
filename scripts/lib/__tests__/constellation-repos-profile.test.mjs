/**
 * @file scripts/lib/__tests__/constellation-repos-profile.test.mjs
 * @description Executable proof for we:backlog/xjko7gy-multi-repo-slice-1-a-per-repo-profile.md: `repoProfile`
 *   collapses key/slug/slugTag/scope-prefix into ONE frozen per-repo profile, and `gateFor` reuses
 *   `verify-lane-gate.mjs#composeGate` (never a second gate derivation) against that profile's checkout path.
 *   No real filesystem/homedir IO: `home` and `gateFor`'s `checkoutExists`/`readPackageJson` are injected
 *   throughout, so this suite is hermetic and immune to whatever machine it runs on.
 */
import { describe, it, expect } from 'vitest';

import { repoProfile, gateFor } from '../repo-profile.mjs';
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
