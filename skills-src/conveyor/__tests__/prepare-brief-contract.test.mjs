/**
 * Prepare-brief contract (#4658): the worker and agent briefs authorize correcting factual drift (incl. `scope:`)
 * while keeping the stop boundaries, and the worker brief's permitted frontmatter keys equal the runner's
 * tamper allow-list (PREPARE_OWNED_FRONTMATTER_KEYS) — so the brief and the runner cannot drift apart.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PREPARE_OWNED_FRONTMATTER_KEYS } from '../../../scripts/lib/probation-launcher.mjs';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(DIR, `prepare-item-${name}-brief.md`), 'utf8');
const flat = (s) => s.replace(/\s+/g, ' ');

describe.each(['worker', 'agent'])('prepare-item-%s-brief', (name) => {
  const s = flat(read(name));
  it('authorizes factual-drift correction and records evidence', () => {
    expect(s).toMatch(/Correct factual drift/i);
    expect(s).toMatch(/`?scope:`?/);
    expect(s).toMatch(/## Progress/);
  });
  it('keeps the already-done exit with no edit / stamp / PR', () => {
    expect(s).toMatch(/already-done/);
    expect(s).toMatch(/without editing(, stamping| or stamping)/);
  });
  it('keeps the genuine-judgment-fork stop', () => {
    expect(s).toMatch(/genuine unresolved judgment call \/ design fork/);
    expect(s).toMatch(/could-not-prepare/);
  });
  it('does not regress to stopping on scope correction or resolving as a premise exit', () => {
    expect(s).not.toMatch(/If scope needs correction[^.]*stop/);
    expect(s).not.toMatch(/resolve it instead with/);
    expect(s).not.toMatch(/except the one premise-check exit/);
  });
});

describe('prepare-item-agent-brief result line', () => {
  it('names the already-done outcome in the return-line spec and the escalations', () => {
    const s = flat(read('agent'));
    expect(s).toMatch(/prepare-item → already-done/);
    expect(s).toMatch(/1a\. \*\*Already delivered\*\*/);
  });
});

describe('prepare-item-worker-brief frontmatter allow-list', () => {
  it('names exactly the runner\'s PREPARE_OWNED_FRONTMATTER_KEYS', () => {
    const s = flat(read('worker'));
    const m = /Only edit that card's body, ([^;]*?); preserve all other frontmatter/.exec(s);
    expect(m, 'worker brief must carry the "Only edit that card\'s body, …; preserve all other frontmatter" sentence').not.toBeNull();
    const named = [...m[1].matchAll(/[A-Za-z]+(?=:|\b)/g)].map((x) => x[0])
      .filter((w) => PREPARE_OWNED_FRONTMATTER_KEYS.includes(w));
    expect([...new Set(named)].sort()).toEqual([...PREPARE_OWNED_FRONTMATTER_KEYS].sort());
  });
});
