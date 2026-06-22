/**
 * Tests for the author-mode source projection (backlog #818, placement #954).
 *
 * The artifact (`src/_data/authorModeSource.json`) is the #954 build-emit: WE runs `serve()` over the
 * canonical `<component>` definitions and commits the per-case × per-form `{code, language, lossy,
 * diagnostics}` output, which the FUI workbench author-mode panel reads. Three things are proven here:
 *   1. Generation is deterministic (no clock, no randomness — a pure `serve()` projection).
 *   2. The committed JSON is in sync (the drift gate — same guard as the MaaS golden vectors, #506).
 *   3. The shape is exactly the contract the FUI panel consumes (every form present, native-first order).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildAuthorModeSource,
  serialize,
  type AuthorModeSourceArtifact,
} from '../../../renderers/module-service/authorModeSource';
import { FORMS } from '../../../renderers/module-service/moduleService';

const here = dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = join(here, '../../../../src/_data/authorModeSource.json');
const committed: AuthorModeSourceArtifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));

describe('author-mode source — generation is deterministic & in sync', () => {
  it('regenerates byte-identically (deterministic projection of serve())', () => {
    expect(serialize(buildAuthorModeSource())).toBe(serialize(buildAuthorModeSource()));
  });

  it('matches the committed authorModeSource.json (drift gate — run `npm run gen:author-mode-source`)', () => {
    expect(readFileSync(ARTIFACT_PATH, 'utf8')).toBe(serialize(buildAuthorModeSource()));
  });

  it('emits every serve form per case, in the native-first FORMS order', () => {
    const expected = FORMS.map((f) => f.id);
    expect(committed.cases.length).toBeGreaterThan(0);
    for (const c of committed.cases) {
      expect(c.forms.map((f) => f.form)).toEqual(expected);
      expect(c.definition).toContain('<component');
    }
  });

  it('flags, does not fake: a lossy form always carries at least one diagnostic', () => {
    for (const c of committed.cases) {
      for (const form of c.forms) {
        if (form.lossy) expect(form.diagnostics.length).toBeGreaterThan(0);
      }
    }
  });
});
