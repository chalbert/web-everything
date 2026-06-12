/**
 * Unit tests for MaaS production runtime delivery (backlog #312). Proves the production hardening of the
 * native-ESM seam: an importable, compiled served form becomes a deliverable @frontierui bare-specifier
 * package (manifest + import-map entry + compiled bytes), and undeliverable forms (display-only or not
 * yet compiled) are flagged — never silently emitted.
 */
import { describe, it, expect } from 'vitest';
import {
  deliverModule,
  buildImportMap,
  DEFAULT_DELIVERY_SCOPE,
  type DeliveryArtifact,
} from '../../../renderers/module-service/productionDelivery';
import { serve, type ServeResult } from '../../../renderers/module-service/moduleService';

const DEF =
  `<component name="user-card" shadow="open">\n` +
  `  <style>:host { display:block }</style>\n` +
  `  <slot></slot>\n` +
  `</component>`;

describe('deliverModule', () => {
  it('frames an importable, compiled (wc-class) form as a @frontierui delivery artifact', () => {
    const served = serve(DEF, { form: 'wc-class' }); // language: 'javascript', importable
    const artifact = deliverModule(served, { id: 'user-card' });

    expect(artifact.deliverable).toBe(true);
    expect(artifact.bareSpecifier).toBe('@frontierui/user-card');
    expect(DEFAULT_DELIVERY_SCOPE).toBe('@frontierui');
    expect(artifact.fileName).toBe('user-card.js');
    expect(artifact.url).toBe('./user-card.js');
    expect(artifact.code).toBe(served.code);
    expect(artifact.importMapEntry).toEqual({ specifier: '@frontierui/user-card', url: './user-card.js' });
  });

  it('emits a publish-ready ESM package.json (sideEffects true — define() must survive tree-shaking)', () => {
    const served = serve(DEF, { form: 'wc-class' });
    const { packageManifest } = deliverModule(served, { id: 'user-card', version: '1.2.3' });
    expect(packageManifest).toEqual({
      name: '@frontierui/user-card',
      version: '1.2.3',
      type: 'module',
      main: 'user-card.js',
      exports: { '.': './user-card.js' },
      sideEffects: true,
    });
  });

  it('honours a custom scope and base URL (cache-friendly absolute delivery)', () => {
    const served = serve(DEF, { form: 'wc-class' });
    const artifact = deliverModule(served, { id: 'user-card', scope: '@acme', baseUrl: 'https://cdn.example.com/v1/' });
    expect(artifact.bareSpecifier).toBe('@acme/user-card');
    expect(artifact.url).toBe('https://cdn.example.com/v1/user-card.js');
    expect(artifact.importMapEntry.url).toBe('https://cdn.example.com/v1/user-card.js');
  });

  it('flags a display-only form as undeliverable (never silently emits a non-module)', () => {
    const served = serve(DEF, { form: 'html' }); // not importable
    const artifact = deliverModule(served, { id: 'user-card' });
    expect(artifact.deliverable).toBe(false);
    expect(artifact.diagnostics.join('\n')).toMatch(/display-only/);
  });

  it('flags an importable-but-uncompiled (jsx) form as undeliverable until lowered', () => {
    // The functional form is importable but its served language is 'jsx' until serveCompiled lowers it.
    const served: ServeResult = { form: 'functional', code: '() => null', language: 'jsx', lossy: false, diagnostics: [] };
    const artifact = deliverModule(served, { id: 'user-card' });
    expect(artifact.deliverable).toBe(false);
    expect(artifact.diagnostics.join('\n')).toMatch(/not compiled \.js/);
  });
});

describe('buildImportMap', () => {
  it('maps only deliverable artifacts to their URLs (skips undeliverable, never resolves a broken module)', () => {
    const good = deliverModule(serve(DEF, { form: 'wc-class' }), { id: 'user-card' });
    const bad = deliverModule(serve(DEF, { form: 'html' }), { id: 'user-card-html' });
    const map = buildImportMap([good, bad]);
    expect(map).toEqual({ imports: { '@frontierui/user-card': './user-card.js' } });
  });

  it('is the production replacement for the dev source-pointing map', () => {
    const artifacts: DeliveryArtifact[] = [
      deliverModule(serve(DEF, { form: 'wc-class' }), { id: 'user-card', baseUrl: 'https://cdn.example.com' }),
    ];
    expect(buildImportMap(artifacts).imports['@frontierui/user-card']).toBe('https://cdn.example.com/user-card.js');
  });
});
