/**
 * Registry + precedence chain (#575): resolvers register in precedence order and the chain returns the
 * first hit; the anchor wins over a lower provider; an all-miss chain degrades to inert (null); a
 * throwing resolver is treated as a miss; named lookup throws on an unknown key; the default wiring
 * registers the three shipped resolvers in the ratified order.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomSourceResolverRegistry,
  UnknownSourceResolverError,
} from '../registry.js';
import {
  SOURCE_ANCHOR_ATTR,
  SOURCE_ANCHOR_SPEC_VERSION,
  type CustomSourceResolver,
  type SourceLocation,
} from '../provider.js';
import { createDefaultResolverRegistry, resolveNodeSource } from '../index.js';

const node = (id?: string): Element => {
  const el = document.createElement('div');
  if (id) el.setAttribute(SOURCE_ANCHOR_ATTR, id);
  return el;
};
const fixed = (key: string, loc: SourceLocation | null): CustomSourceResolver => ({ key, resolve: () => loc });

describe('CustomSourceResolverRegistry — precedence chain', () => {
  it('returns the first non-null resolver in registration (precedence) order', () => {
    const reg = new CustomSourceResolverRegistry();
    reg.define(fixed('a', null));
    reg.define(fixed('b', { file: 'b.ts', line: 2 }));
    reg.define(fixed('c', { file: 'c.ts', line: 3 }));
    expect(reg.resolve(node())).toEqual({ file: 'b.ts', line: 2 }); // b beats c — earlier slot wins
    expect(reg.keys()).toEqual(['a', 'b', 'c']);
  });

  it('degrades to inert (null) when every resolver misses', () => {
    const reg = new CustomSourceResolverRegistry();
    reg.define(fixed('a', null));
    reg.define(fixed('b', null));
    expect(reg.resolve(node())).toBeNull();
  });

  it('treats a throwing resolver as a miss and continues the chain', () => {
    const reg = new CustomSourceResolverRegistry();
    reg.define({ key: 'boom', resolve: () => { throw new Error('provider fault'); } });
    reg.define(fixed('ok', { file: 'ok.ts', line: 1 }));
    expect(reg.resolve(node())).toEqual({ file: 'ok.ts', line: 1 });
  });

  it('re-registering a key overrides the resolver but keeps its precedence slot', () => {
    const reg = new CustomSourceResolverRegistry();
    reg.define(fixed('a', { file: 'old.ts', line: 1 }));
    reg.define(fixed('b', { file: 'b.ts', line: 2 }));
    reg.define(fixed('a', { file: 'new.ts', line: 9 })); // override a — still slot 0
    expect(reg.keys()).toEqual(['a', 'b']);
    expect(reg.resolve(node())).toEqual({ file: 'new.ts', line: 9 });
  });

  it('require() throws UnknownSourceResolverError on an unregistered key', () => {
    const reg = new CustomSourceResolverRegistry();
    reg.define(fixed('a', null));
    expect(() => reg.require('ghost')).toThrow(UnknownSourceResolverError);
    expect(reg.require('a').key).toBe('a');
  });
});

describe('default wiring', () => {
  it('registers the three shipped resolvers in the ratified precedence order', () => {
    expect(createDefaultResolverRegistry().keys()).toEqual(['source-anchor', 'framework-debug', 'source-map']);
  });

  it('resolveNodeSource maps an anchored node through the opt-in manifest', () => {
    const manifest = { specVersion: SOURCE_ANCHOR_SPEC_VERSION, anchors: { x: { file: 'src/A.tsx', line: 11 } } };
    expect(resolveNodeSource(node('x'), manifest)).toEqual({ file: 'src/A.tsx', line: 11 });
  });

  it('resolveNodeSource is inert (null) when no manifest is served (deployed-without-anchors)', () => {
    expect(resolveNodeSource(node('x'))).toBeNull();
  });
});
