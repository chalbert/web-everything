/**
 * @file blocks/__tests__/unit/renderers/generation/corpus.test.ts
 * @description Tests for the adapter dev-time regression corpus + snapshot gate (backlog #551, slice 4 of
 * #507). The corpus is the substrate an improver edits a backend's templates against; this gate makes a
 * change reviewable (snapshot drift) and proves the snapshot is meaningfully input-sensitive.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  runCorpus,
  serializeSnapshot,
  CORPUS,
  javascriptBackend,
  csharpBackend,
} from '../../../../renderers/module-service/generation';

const here = dirname(fileURLToPath(import.meta.url));
const snapshotPath = join(
  here,
  '../../../../renderers/module-service/generation/corpus/__snapshots__/corpus.snapshot.json',
);
const backends = [javascriptBackend, csharpBackend];

describe('regression corpus (#551)', () => {
  it('matches the committed snapshot (the drift gate)', () => {
    const fresh = serializeSnapshot(runCorpus(backends));
    expect(fresh).toBe(readFileSync(snapshotPath, 'utf8'));
  });

  it('is deterministic — two runs serialize identically', () => {
    expect(serializeSnapshot(runCorpus(backends))).toBe(serializeSnapshot(runCorpus(backends)));
  });

  it('covers every (fixture × backend × module)', () => {
    const snap = runCorpus(backends);
    expect(Object.keys(snap).length).toBe(CORPUS.length * backends.length * 2);
  });

  it('is input-sensitive — distinct fixtures produce distinct output (a real regression substrate)', () => {
    const snap = runCorpus(backends);
    // The same backend+module differs across fixtures (else the corpus would catch no input-driven drift).
    expect(snap['minimal/javascript/origin.core.js']).not.toBe(snap['canonical/javascript/origin.core.js']);
    expect(snap['edge-shapes/csharp/OriginCore.cs']).not.toBe(snap['canonical/csharp/OriginCore.cs']);
  });

  it('exercises the edge branches the canonical input cannot', () => {
    const snap = runCorpus(backends);
    // edge-shapes has a null-mediaType + empty-headers response and a required param.
    expect(snap['edge-shapes/csharp/OriginCore.cs']).toContain('System.Array.Empty<string>()'); // empty headers
    expect(snap['edge-shapes/csharp/OriginCore.cs']).toContain('new ServePathResponse(304,');
    expect(snap['edge-shapes/javascript/origin.core.js']).toContain('mediaType: null');
    // escaping branch: the apostrophe + quote in the edge fixture's param description survive emit.
    expect(snap['edge-shapes/javascript/origin.core.js']).toContain("apostrophe \\' and a \"quote\"");
  });
});
