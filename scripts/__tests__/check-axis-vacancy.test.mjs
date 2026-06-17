/**
 * @file scripts/__tests__/check-axis-vacancy.test.mjs
 * @description Unit harness for the corpus axis-vacancy alerter (#863). The tally is a pure function
 * (categories + sources → per-axis live counts + vacancy flags), so retirement-driven and
 * sweep-driven vacancies are tested offline with synthetic corpora. A standing guard runs the real
 * corpus to catch a live regression.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeAxisVacancy, deadUrlsFromSweep, DEAD_CLASSES } from '../check-axis-vacancy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cats = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];

describe('computeAxisVacancy — retirement-driven', () => {
  it('flags an axis whose live count falls below the threshold', () => {
    const sources = [
      { category: 'a' }, { category: 'a' }, { category: 'a', retired: true },
      { category: 'b' }, // only 1 live in b
    ];
    const { axes, vacancies } = computeAxisVacancy(cats, sources, { threshold: 2 });
    const a = axes.find((x) => x.id === 'a');
    const b = axes.find((x) => x.id === 'b');
    expect(a.live).toBe(2); expect(a.retired).toBe(1); expect(a.vacant).toBe(false);
    expect(b.live).toBe(1); expect(b.vacant).toBe(true);
    expect(vacancies.map((v) => v.id)).toEqual(['b']);
  });

  it('a stricter threshold flags more axes', () => {
    const sources = [{ category: 'a' }, { category: 'a' }, { category: 'b' }, { category: 'b' }];
    expect(computeAxisVacancy(cats, sources, { threshold: 2 }).vacancies).toHaveLength(0);
    expect(computeAxisVacancy(cats, sources, { threshold: 3 }).vacancies).toHaveLength(2);
  });
});

describe('computeAxisVacancy — sweep-driven dead sources', () => {
  it('counts a swept-dead docsUrl as not-live', () => {
    const sources = [
      { category: 'a', docsUrl: 'https://ok.com/' },
      { category: 'a', docsUrl: 'https://dead.com/' },
    ];
    const deadUrls = new Set(['https://dead.com/']);
    const a = computeAxisVacancy(cats, sources, { threshold: 2, deadUrls }).axes.find((x) => x.id === 'a');
    expect(a.live).toBe(1); expect(a.dead).toBe(1); expect(a.vacant).toBe(true);
  });

  it('deadUrlsFromSweep extracts only the dead classes', () => {
    const report = { results: [
      { url: 'https://g/', class: 'gone' },
      { url: 'https://u/', class: 'unreachable' },
      { url: 'https://s/', class: 'superseded' },
      { url: 'https://l/', class: 'live' },
      { url: 'https://p/', class: 'paywall' },
    ] };
    const set = deadUrlsFromSweep(report);
    expect([...set].sort()).toEqual(['https://g/', 'https://s/', 'https://u/']);
    expect(set.has('https://l/')).toBe(false);
    expect(DEAD_CLASSES).toContain('gone');
  });
});

describe('computeAxisVacancy — orphan category', () => {
  it('surfaces a source in an undefined category as a vacant axis', () => {
    const sources = [{ category: 'a' }, { category: 'a' }, { category: 'ghost' }];
    const { axes } = computeAxisVacancy(cats, sources, { threshold: 2 });
    const ghost = axes.find((x) => x.id === 'ghost');
    expect(ghost).toBeTruthy();
    expect(ghost.vacant).toBe(true);
  });
});

describe('real corpus stays clean', () => {
  it('every defined category meets the default floor (regression guard)', () => {
    const corpus = JSON.parse(readFileSync(join(ROOT, 'src/_data/benchmarkCorpus.json'), 'utf8'));
    const { vacancies } = computeAxisVacancy(corpus.categories, corpus.sources, { threshold: 2 });
    expect(vacancies, `vacant axes: ${vacancies.map((v) => v.id).join(', ')}`).toHaveLength(0);
  });
});
