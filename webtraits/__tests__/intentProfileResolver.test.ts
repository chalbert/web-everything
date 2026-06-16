// Intent-profile → trait build-time resolver (#776). Exercises the mapping against the real shape of the
// `intentDimension` keys traits declare in blocks.json (e.g. "type-ahead.matching.prefix") — proving the
// indirect path: a profile of intent-dimension VALUES resolves to which traits bundle + how they ship.
import { describe, it, expect } from 'vitest';
import {
  splitIntentDimension,
  resolveTraits,
  bundlePlan,
  type TraitCandidate,
  type IntentProfile,
} from '../intentProfileResolver';

// Mirrors real blocks.json trait entries (type-ahead + a baseline unconditional trait).
const candidates: TraitCandidate[] = [
  { name: 'withPrefixMatching', intentDimension: 'type-ahead.matching.prefix' },
  { name: 'withSameLetterCycling', intentDimension: 'type-ahead.matching.cycle' },
  { name: 'withWrapAround', intentDimension: 'type-ahead.wrap.wrap', delivery: 'eager' },
  { name: 'withBaseline', intentDimension: null }, // unconditional
];

describe('splitIntentDimension — "<intent>.<dimension>.<value>" → dimension + value', () => {
  it('splits on the last dot (intent ids may contain hyphens, not dots)', () => {
    expect(splitIntentDimension('type-ahead.matching.prefix')).toEqual({ dimension: 'type-ahead.matching', value: 'prefix' });
    expect(splitIntentDimension('loader.strategy.optimistic')).toEqual({ dimension: 'loader.strategy', value: 'optimistic' });
  });
  it('rejects malformed keys', () => {
    expect(splitIntentDimension('nodot')).toBeNull();
    expect(splitIntentDimension('trailing.')).toBeNull();
  });
});

describe('resolveTraits — only the traits the active profile selects (+ unconditional ones) bundle', () => {
  it('includes the profile-matched trait and every unconditional trait, drops the rest', () => {
    const profile: IntentProfile = { 'type-ahead.matching': 'prefix' };
    const names = resolveTraits(profile, candidates).map((t) => t.name).sort();
    expect(names).toEqual(['withBaseline', 'withPrefixMatching']);
  });

  it('switches the bundled trait when the profile value changes', () => {
    const profile: IntentProfile = { 'type-ahead.matching': 'cycle' };
    const names = resolveTraits(profile, candidates).map((t) => t.name);
    expect(names).toContain('withSameLetterCycling');
    expect(names).not.toContain('withPrefixMatching');
  });

  it('labels why each trait was included', () => {
    const resolved = resolveTraits({ 'type-ahead.matching': 'prefix' }, candidates);
    expect(resolved.find((t) => t.name === 'withBaseline')?.reason).toBe('unconditional');
    expect(resolved.find((t) => t.name === 'withPrefixMatching')?.reason).toBe('profile-match');
  });

  it('defaults delivery to lazy, honoring an explicit eager', () => {
    const profile: IntentProfile = { 'type-ahead.matching': 'prefix', 'type-ahead.wrap': 'wrap' };
    const byName = Object.fromEntries(resolveTraits(profile, candidates).map((t) => [t.name, t.delivery]));
    expect(byName['withPrefixMatching']).toBe('lazy');
    expect(byName['withWrapAround']).toBe('eager');
  });
});

describe('bundlePlan — eager/lazy buckets a bundler consumes', () => {
  it('groups the resolved traits by delivery', () => {
    const plan = bundlePlan({ 'type-ahead.matching': 'prefix', 'type-ahead.wrap': 'wrap' }, candidates);
    expect(plan.eager).toEqual(['withWrapAround']);
    expect(plan.lazy.sort()).toEqual(['withBaseline', 'withPrefixMatching']);
  });
});
