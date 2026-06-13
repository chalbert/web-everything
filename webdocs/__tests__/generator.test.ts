/**
 * Web Docs generator (backlog #424). Proves the webcases pivot parser (the generalized `cases.js` header
 * convention + fallback), the docs-site generator (manifest-driven page order/scope), and the one-contract
 * resolver over the three input kinds (bundle inline; git/registry behind an injected fetchSource).
 */
import { describe, it, expect } from 'vitest';
import {
  parseWebCase,
  parseWebCases,
  generateDocsSite,
  resolveWebcasesInput,
  type RawCases,
  type WebManifest,
} from '../generator';

const html = (n: number, title: string, desc: string, body: string) =>
  `<!--\n  WEB CASE ${n}: ${title}\n  ${desc}\n-->\n${body}`;

describe('parseWebCase', () => {
  it('extracts title + description from the WEB CASE header', () => {
    const c = parseWebCase({ id: '01-basic.html', content: html(1, 'The Title', 'What it shows.', '<div></div>') });
    expect(c).toEqual({ id: '01-basic.html', title: 'The Title', description: 'What it shows.', code: html(1, 'The Title', 'What it shows.', '<div></div>') });
  });
  it('falls back to the filename when there is no recognizable header', () => {
    const c = parseWebCase({ id: 'raw.ts', content: 'export const x = 1;' });
    expect(c.title).toBe('raw.ts');
    expect(c.description).toBe('');
    expect(c.code).toBe('export const x = 1;');
  });
});

describe('parseWebCases', () => {
  it('parses per-block and sorts cases by id', () => {
    const raw: RawCases = {
      dialog: [
        { id: '02-b.html', content: html(2, 'B', '', '') },
        { id: '01-a.html', content: html(1, 'A', '', '') },
      ],
    };
    const cases = parseWebCases(raw);
    expect(cases.dialog.map((c) => c.title)).toEqual(['A', 'B']);
  });
});

describe('generateDocsSite', () => {
  const cases = parseWebCases({
    dialog: [{ id: '01.html', content: html(1, 'Dialog', '', '') }],
    select: [{ id: '01.html', content: html(1, 'Select', '', '') }],
  });

  it('uses manifest.blocks for page order/scope when given', () => {
    const manifest: WebManifest = { id: 'm', name: 'My Docs', blocks: ['select', 'dialog'] };
    const site = generateDocsSite(manifest, cases);
    expect(site.pages.map((p) => p.blockId)).toEqual(['select', 'dialog']);
    expect(site.name).toBe('My Docs');
  });
  it('documents every case block (sorted) when manifest.blocks is omitted', () => {
    const site = generateDocsSite({ id: 'm', name: 'All' }, cases);
    expect(site.pages.map((p) => p.blockId)).toEqual(['dialog', 'select']);
  });
  it('emits an empty page for a manifest block with no cases', () => {
    const site = generateDocsSite({ id: 'm', name: 'X', blocks: ['ghost'] }, cases);
    expect(site.pages).toEqual([{ blockId: 'ghost', cases: [] }]);
  });
});

describe('resolveWebcasesInput', () => {
  it('resolves a bundle inline, no fetchSource needed', async () => {
    const cases = await resolveWebcasesInput({ kind: 'bundle', cases: { dialog: [{ id: '01.html', content: html(1, 'D', '', '') }] } });
    expect(cases.dialog[0].title).toBe('D');
  });
  it('delegates git/registry to the injected fetchSource', async () => {
    const fetchSource = async () => ({ block: [{ id: '01.html', content: html(1, 'Fetched', '', '') }] });
    const fromGit = await resolveWebcasesInput({ kind: 'git', repo: 'x/y' }, fetchSource);
    const fromReg = await resolveWebcasesInput({ kind: 'registry', url: 'https://r/x' }, fetchSource);
    expect(fromGit.block[0].title).toBe('Fetched');
    expect(fromReg.block[0].title).toBe('Fetched');
  });
  it('throws when a remote kind has no transport', async () => {
    await expect(resolveWebcasesInput({ kind: 'git', repo: 'x/y' })).rejects.toThrow(/needs a fetchSource/);
  });
});
