/**
 * Tests for the neutral MaaS serve-path IR and its OpenAPI projection (backlog #505, #463 fork b).
 *
 * The IR is the authority. The OpenAPI projection is a faithful, deterministic function of the IR,
 * and the committed `maas-servepath.openapi.json` is in sync (the drift gate). Reference-handler
 * conformance tests live in FUI with the handler (#1730 — handler relocated per #1282/#1771).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SERVE_PATH,
  DEFAULT_BASE_PATH,
} from '../../../renderers/module-service/servePathIR';
import { servePathToOpenAPI } from '../../../renderers/module-service/servePathOpenAPI';

describe('serve-path IR — shape', () => {
  it('is a frozen, single-GET contract under the default base path', () => {
    expect(Object.isFrozen(SERVE_PATH)).toBe(true);
    expect(SERVE_PATH.method).toBe('GET');
    expect(SERVE_PATH.basePath).toBe(DEFAULT_BASE_PATH);
    expect(SERVE_PATH.params.map((p) => p.name)).toEqual(['form', 'mode', 'target', 'strategy']);
    expect(SERVE_PATH.responses.map((r) => r.status).sort()).toEqual([200, 302, 304, 400, 404, 500]);
  });

  it('exposes mode as an optional, catalog-gated, byte-determining axis (plugged/unplugged)', () => {
    const mode = SERVE_PATH.params.find((p) => p.name === 'mode');
    expect(mode).toBeDefined();
    // Optional: this slice makes both modes serveable, independent of the default-mode call (#1843).
    expect(mode?.required).toBe(false);
    // Catalog-gated: the plugged/unplugged value set is an injected implementation catalog, not the
    // neutral contract — an unknown mode value mints a 400, like an unknown form.
    expect(mode?.catalogGated).toBe(true);
  });
});

describe('OpenAPI projection', () => {
  const doc = servePathToOpenAPI();

  it('projects the single GET route with every IR param and response', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toBe(SERVE_PATH.version);
    const op = doc.paths[`${SERVE_PATH.basePath}{spec}`].get;
    expect(op.parameters.find((p) => p.in === 'path')?.required).toBe(true);
    for (const p of SERVE_PATH.params) expect(op.parameters.some((q) => q.name === p.name)).toBe(true);
    for (const r of SERVE_PATH.responses) expect(op.responses[String(r.status)]).toBeDefined();
  });

  it('carries the structured error schema on a 4xx', () => {
    const op = doc.paths[`${SERVE_PATH.basePath}{spec}`].get;
    expect(op.responses['404'].content?.['application/json']).toBeDefined();
    expect(doc.components.schemas.MaaSError).toBeDefined();
  });

  it('is deterministic — same IR projects byte-identically', () => {
    expect(JSON.stringify(servePathToOpenAPI())).toBe(JSON.stringify(servePathToOpenAPI()));
  });

  it('matches the committed maas-servepath.openapi.json (drift gate)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const committed = readFileSync(
      join(here, '../../../renderers/module-service/maas-servepath.openapi.json'),
      'utf8',
    );
    expect(JSON.parse(committed)).toEqual(doc);
  });
});
