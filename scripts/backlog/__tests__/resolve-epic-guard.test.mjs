// Regression guard for backlog #658: `resolve` must refuse to close an epic that still has open child
// slices, enumerating them by the `parent:` EDGE (never the body's "N children" prose, which goes stale
// and let #658 resolve over three open children). The contradiction is mirrored by the gate
// (check-standards' resolved-epic-with-open-child rule) — but this CLI-side guard refuses BEFORE writing
// so the bad state is never created, and so a direct CLI / batch call is protected, not just the
// LLM-driven /resolve command grep. `--force` is the deliberate-override escape hatch. This test pins
// that the guard exists and reads child edges; removing it (regressing to body-listing trust) fails here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../../backlog.mjs'), 'utf8');

describe('backlog.mjs resolve refuses an epic with open children (#658)', () => {
  it('enumerates children by the parent: edge via a dedicated helper', () => {
    expect(SRC).toMatch(/function openChildrenOf\(/);
    // it must compare against the `parent:` field, not parse the body prose
    expect(SRC).toMatch(/readField\(content, 'parent'\)/);
  });

  it('guards the resolve path on kind: epic and dies before applyTransition', () => {
    expect(SRC).toMatch(/v === 'resolve' && readField\(before, 'kind'\) === 'epic'/);
    // the guard sits ahead of the write (applyTransition) in source order
    expect(SRC.indexOf('openChildrenOf(padded)')).toBeLessThan(SRC.indexOf('applyTransition(before, v'));
  });

  it('offers a --force override rather than being an absolute wall', () => {
    expect(SRC).toMatch(/argv\.includes\('--force'\)/);
  });
});
