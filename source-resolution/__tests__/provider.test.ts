/**
 * Source-anchor contract + resolvers (#575, the #562 ruling-A DoD): the opaque-id `data-*` attribute is
 * the named anchor; the anchor resolver maps node→source via the sidecar manifest and is the only one
 * that works with no framework metadata (the cold-deployed case); an absent manifest degrades to a
 * clean `null`, never an error; framework-debug reads `__source` defensively; source-map is inert.
 */
import { describe, it, expect } from 'vitest';
import {
  SOURCE_ANCHOR_ATTR,
  SOURCE_ANCHOR_SPEC_VERSION,
  readSourceAnchorId,
  SourceAnchorResolver,
  FrameworkDebugResolver,
  SourceMapResolver,
  type SourceAnchorManifest,
} from '../provider.js';

const withAnchor = (id: string): Element => {
  const el = document.createElement('div');
  el.setAttribute(SOURCE_ANCHOR_ATTR, id);
  return el;
};

const MANIFEST: SourceAnchorManifest = {
  specVersion: SOURCE_ANCHOR_SPEC_VERSION,
  anchors: { a1: { file: 'src/App.tsx', line: 42 }, a2: { file: 'src/Nav.tsx', line: 7, column: 3 } },
};

describe('readSourceAnchorId — the opaque-id contract', () => {
  it('reads the named attribute, or null when absent (opt-in off)', () => {
    expect(readSourceAnchorId(withAnchor('a1'))).toBe('a1');
    expect(readSourceAnchorId(document.createElement('div'))).toBeNull();
  });

  it('treats an empty attribute as no anchor', () => {
    expect(readSourceAnchorId(withAnchor(''))).toBeNull();
  });
});

describe('SourceAnchorResolver — the cold-deployed-capable resolver', () => {
  it('resolves an anchored node through the manifest', () => {
    const r = new SourceAnchorResolver(MANIFEST);
    expect(r.resolve(withAnchor('a1'))).toEqual({ file: 'src/App.tsx', line: 42 });
    expect(r.resolve(withAnchor('a2'))).toEqual({ file: 'src/Nav.tsx', line: 7, column: 3 });
  });

  it('misses (null) on an unknown id or an unanchored node — never throws', () => {
    const r = new SourceAnchorResolver(MANIFEST);
    expect(r.resolve(withAnchor('nope'))).toBeNull();
    expect(r.resolve(document.createElement('div'))).toBeNull();
  });

  it('degrades to null with no manifest (emission off by default)', () => {
    expect(new SourceAnchorResolver().resolve(withAnchor('a1'))).toBeNull();
    expect(new SourceAnchorResolver(null).resolve(withAnchor('a1'))).toBeNull();
  });
});

describe('FrameworkDebugResolver — dev-only, defensive', () => {
  it('reads a __source-shaped property when present', () => {
    const el = document.createElement('div');
    (el as unknown as { __source: unknown }).__source = { fileName: 'src/X.tsx', lineNumber: 5, columnNumber: 2 };
    expect(new FrameworkDebugResolver().resolve(el)).toEqual({ file: 'src/X.tsx', line: 5, column: 2 });
  });

  it('yields null without the metadata (the stripped-prod / React-19 case)', () => {
    expect(new FrameworkDebugResolver().resolve(document.createElement('div'))).toBeNull();
  });
});

describe('SourceMapResolver — inert placeholder', () => {
  it('always yields null (wrong granularity, usually stripped)', () => {
    expect(new SourceMapResolver().resolve(withAnchor('a1'))).toBeNull();
  });
});
