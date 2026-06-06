/**
 * Unit tests for the Module-as-a-Service resolver (backlog #081, v1 walking skeleton).
 *
 * Proves the three v1 objectives:
 *   1. one definition serves in ≥2 forms from a single `form` param;
 *   2. the served form reuses the SHARED transforms (no parallel copy — asserted by equality with
 *      the very modules the /adapters/ demos call);
 *   3. reserved params (transpileTarget/strategy) are flagged, never silently dropped.
 */
import { describe, it, expect } from 'vitest';
import { serve, serveCompiled, FORMS, compilerRegistry } from '../../../renderers/module-service/moduleService';
import { parseDefinition, generateClassSource } from '../../../renderers/component/declarativeComponent';
import { htmlToJsx } from '../../../renderers/jsx/htmlToJsx';

const DEF =
  `<component name="user-card" shadow="open">\n` +
  `  <style>:host { display:block }</style>\n` +
  `  <h3><slot name="title">Untitled</slot></h3>\n` +
  `  <slot></slot>\n` +
  `</component>`;

describe('serve — one definition, many forms', () => {
  it('serves the declarative form as a trimmed passthrough', () => {
    const r = serve(DEF, { form: 'declarative' });
    expect(r.code).toBe(DEF.trim());
    expect(r.language).toBe('html');
  });

  it('serves the wc-class form via the SHARED component transform (no drift)', () => {
    const r = serve(DEF, { form: 'wc-class' });
    expect(r.code).toBe(generateClassSource(parseDefinition(DEF)));
    expect(r.code).toContain("customElements.define('user-card'");
    expect(r.language).toBe('javascript');
  });

  it('serves the html form as the extracted template (shared parser)', () => {
    const r = serve(DEF, { form: 'html' });
    expect(r.code).toBe(parseDefinition(DEF).templateHTML);
  });

  it('serves the jsx form via the SHARED htmlToJsx transform (no drift)', () => {
    const r = serve(DEF, { form: 'jsx' });
    expect(r.code).toBe(htmlToJsx(parseDefinition(DEF).templateHTML));
    expect(r.language).toBe('jsx');
  });

  it('covers every catalog form without throwing', () => {
    for (const f of FORMS) {
      const r = serve(DEF, { form: f.id });
      expect(r.form).toBe(f.id);
      expect(typeof r.code).toBe('string');
      expect(r.code.length).toBeGreaterThan(0);
    }
  });
});

describe('serve — error vs lossy boundary', () => {
  it('throws on an unknown form (caller error)', () => {
    // @ts-expect-error — exercising the runtime guard with an invalid form id
    expect(() => serve(DEF, { form: 'svelte' })).toThrow(/Unknown form/);
  });

  it('throws on an unparseable definition (caller error)', () => {
    expect(() => serve('<div>not a component</div>', { form: 'wc-class' })).toThrow();
  });

  it('flags an unsupported transpileTarget instead of silently ignoring it', () => {
    const r = serve(DEF, { form: 'wc-class', transpileTarget: 'es5' });
    expect(r.lossy).toBe(true);
    expect(r.diagnostics.join(' ')).toMatch(/transpileTarget/);
  });

  it('flags an unsupported strategy instead of silently ignoring it', () => {
    const r = serve(DEF, { form: 'jsx', strategy: 'signals' });
    expect(r.lossy).toBe(true);
    expect(r.diagnostics.join(' ')).toMatch(/strategy/);
  });

  it('is not lossy for the default param set', () => {
    const r = serve(DEF, { form: 'wc-class' });
    expect(r.lossy).toBe(false);
    expect(r.diagnostics).toEqual([]);
  });
});

// NB: order matters — the "no compiler" assertions run before any compiler is registered into the
// shared singleton (vitest gives this file a fresh module graph, so the registry starts empty).
describe('serveCompiled — delegated transpile (#081 phase 2b)', () => {
  it('passes through unchanged for the default (esnext / unset) target', async () => {
    const a = await serveCompiled(DEF, { form: 'wc-class' });
    expect(a.code).toBe(serve(DEF, { form: 'wc-class' }).code);
    expect(a.lossy).toBe(false);
  });

  it('flags a non-default target when NO compiler is registered (never silent)', async () => {
    const r = await serveCompiled(DEF, { form: 'wc-class', transpileTarget: 'es2015' });
    expect(r.lossy).toBe(true);
    expect(r.diagnostics.join(' ')).toMatch(/no compiler registered/);
  });

  it('flags a non-JS form even with a target (jsx lowering is phase 2c)', async () => {
    const r = await serveCompiled(DEF, { form: 'jsx', transpileTarget: 'es2015' });
    expect(r.lossy).toBe(true);
    expect(r.diagnostics.join(' ')).toMatch(/not a JS module/);
  });

  it('flags the functional form when NO compiler is registered (it must transpile to import)', async () => {
    const r = await serveCompiled(DEF, { form: 'functional' });
    expect(r.lossy).toBe(true);
    expect(r.diagnostics.join(' ')).toMatch(/requires transpilation/);
  });

  it('lowers JS via a registered compiler and is no longer lossy', async () => {
    // Inject a fake compiler — proves the seam without depending on esbuild in unit tests.
    compilerRegistry.register(
      { id: 'fake', transpile: async ({ code, loader, target }) => ({ code: `/* ${loader}:${target} */\n${code}` }) },
      { default: true },
    );
    const r = await serveCompiled(DEF, { form: 'wc-class', transpileTarget: 'es2015' });
    expect(r.lossy).toBe(false);
    expect(r.code).toMatch(/^\/\* js:es2015 \*\//);
    expect(r.code).toContain("customElements.define('user-card'");
  });

  it('transpiles the functional form (jsx loader) and reports it as javascript', async () => {
    // Relies on the fake compiler registered above (same file, runs after).
    const r = await serveCompiled(DEF, { form: 'functional' });
    expect(r.lossy).toBe(false);
    expect(r.language).toBe('javascript');
    expect(r.code).toMatch(/^\/\* jsx:esnext \*\//);
  });
});
