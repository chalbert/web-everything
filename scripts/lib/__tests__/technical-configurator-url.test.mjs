// #752 fixture — the embedded Technical Configurator seed transport (#788: URL-canonical + typed).
// Two contracts under test: (1) the builder emits typed query params mirroring a block's technical
// dimensions (never an opaque blob), with `embed=1` for the iframe and omitted for the deep-link;
// (2) at least one real block carries a *non-default* technicalConfig that round-trips through it.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildTechnicalConfiguratorUrl, TC_ROUTE, TC_DOMAIN_IDS } = require('../technical-configurator-url.cjs');
const blocks = require('../blocks-loader.cjs').loadBlocks(); // per-block specs, assembled (#882)

const BASE = 'http://localhost:4000';
// The configurator's first-listed domain (#789 ordering puts the legacy domains first), i.e. the
// state a bare /technical-configurator load would show — what "non-default" is measured against.
const DEFAULT_DOMAIN = 'change-tracking';

describe('buildTechnicalConfiguratorUrl (#752/#788 seed transport)', () => {
  it('emits typed params mirroring the block dimensions, with embed=1 for the iframe', () => {
    const url = buildTechnicalConfiguratorUrl(
      BASE,
      { domain: 'render-strategy', strategy: 'declarative-shadow-dom', requirements: { 'first-paint': 'pre-rendered', hydration: 'light' } },
      { embed: true },
    );
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(BASE + TC_ROUTE);
    expect(u.searchParams.get('domain')).toBe('render-strategy');
    expect(u.searchParams.get('strategy')).toBe('declarative-shadow-dom');
    expect(u.searchParams.get('req-first-paint')).toBe('pre-rendered');
    expect(u.searchParams.get('req-hydration')).toBe('light');
    expect(u.searchParams.get('embed')).toBe('1');
  });

  it('the deep-link variant drops embed but keeps the seed', () => {
    const cfg = { domain: 'chunk-split', strategy: 'monolithic' };
    const deep = buildTechnicalConfiguratorUrl(BASE, cfg, {});
    const u = new URL(deep);
    expect(u.searchParams.has('embed')).toBe(false);
    expect(u.searchParams.get('domain')).toBe('chunk-split');
    expect(u.searchParams.get('strategy')).toBe('monolithic');
  });

  it('tolerates a trailing slash on the base and an empty config', () => {
    expect(buildTechnicalConfiguratorUrl('http://localhost:4000/', {}, {})).toBe(BASE + TC_ROUTE);
  });
});

describe('block technicalConfig seeds (#752 acceptance: a non-default config on a real block)', () => {
  const seeded = blocks.filter((b) => b && b.technicalConfig);

  it('at least one block carries a technicalConfig', () => {
    expect(seeded.length).toBeGreaterThan(0);
  });

  it('every seeded config targets a valid WE dimension and at least one is non-default', () => {
    for (const b of seeded) {
      expect(TC_DOMAIN_IDS).toContain(b.technicalConfig.domain);
    }
    expect(seeded.some((b) => b.technicalConfig.domain !== DEFAULT_DOMAIN)).toBe(true);
  });

  it('a seeded block round-trips into a valid embed URL', () => {
    const b = seeded.find((x) => x.technicalConfig.domain !== DEFAULT_DOMAIN);
    const url = buildTechnicalConfiguratorUrl(BASE, b.technicalConfig, { embed: true });
    const u = new URL(url);
    expect(u.searchParams.get('domain')).toBe(b.technicalConfig.domain);
    expect(u.searchParams.get('embed')).toBe('1');
  });
});
