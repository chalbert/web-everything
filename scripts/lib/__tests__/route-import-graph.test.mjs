/**
 * route-import-graph.test.mjs — off-server unit floor for the #2802 dependency-aware UI classifier
 * (`scripts/lib/route-import-graph.mjs`): the import-graph resolver that catches the change class a
 * path-regex misses — a DATA-LAYER edit a real route renders through.
 *
 * The load-bearing case is the acceptance: a change limited to
 * `plateau-app:src/backlog-view/lane-board-data.ts` MUST classify as UI-affecting for `/console-board`.
 * A pure path-regex (`isVisualTouch` with no route graph) misses it; the graph resolver catches it.
 *
 * The graph here is a FIXTURE that mirrors the real `lane-board-data → /console-board` chain (proven by
 * reading the real plateau-app source: `src/main.ts` imports `loadBoardData` from `lane-board-data` for
 * the `/console-board` mount; `lane-board-data.ts` imports `card-state-read-model`, `types`,
 * `card-taxonomy.webcases`, `lane-board`, `cross-lane-spans`). Driving the resolver from a fixture keeps
 * this WE-side and deterministic — no product boot, no sibling checkout — while proving the exact
 * data-layer→route linkage. Follow-up: wire `buildImportGraph` to a committed real-graph snapshot.
 */
import { describe, it, expect } from 'vitest';
import {
  moduleId,
  parseModuleId,
  parseImportSpecifiers,
  resolveTransitiveModules,
  buildImportGraph,
  routeRenderClosure,
  routesAffectedBy,
  isRouteAffectingChange,
  ROUTE_ENTRIES,
} from '../route-import-graph.mjs';
import { isVisualTouch } from '../render-check.mjs';

const PA = 'plateau-app:src/backlog-view/';
const DATA = `${PA}lane-board-data.ts`;
const VIEW = `${PA}lane-board.ts`;
const READ_MODEL = `${PA}card-state-read-model.ts`;

/**
 * A fixture mirroring the real /console-board render chain. In-memory sources carry REAL import
 * statements so `buildImportGraph` exercises its parser + resolver, not a hand-rolled adjacency.
 */
const FIXTURE_SOURCES = {
  [VIEW]: `
    import { registerSectionCard } from '@frontierui/blocks/card';
    import { glyphSvg } from './console-glyphs';
    import type { ScopePicture } from './types';
    import './lane-board.css';
  `,
  [DATA]: `
    import type { BacklogItemDTO, ScopePicture } from './types';
    import { deriveCardState, type CardSignals } from './card-state-read-model';
    import CONSOLE_CARD_CASES, { parseAssert } from './card-taxonomy.webcases';
    import type { Card, Lane } from './lane-board';
    import type { Leverage } from './cross-lane-spans';
  `,
  [READ_MODEL]: `import type { BacklogItemDTO } from './types';`,
  [`${PA}console-glyphs.ts`]: `export const glyphSvg = () => '';`,
  [`${PA}types.ts`]: `export interface ScopePicture {}`,
  [`${PA}card-taxonomy.webcases.ts`]: `export const parseAssert = () => {};`,
  [`${PA}cross-lane-spans.ts`]: `export type Leverage = number;`,
  [`${PA}lane-board.css`]: `.lane-board {}`,
};

/** Resolve a `./foo` specifier seen inside `fromId` to a repo-qualified node id; drop bare packages. */
function resolveSpecifier(fromId, spec) {
  if (!spec.startsWith('.')) return null; // external / bare package (e.g. @frontierui/blocks/card)
  const { repo, path } = parseModuleId(fromId);
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  let p = new URL(spec, `file:///${dir}`).pathname.replace(/^\/+/, '');
  if (!/\.[a-z]+$/i.test(p)) p += '.ts'; // extensionless import → .ts (css/webcases carry their own)
  const candidate = `${repo}:${p}`;
  return FIXTURE_SOURCES[candidate] != null ? candidate : null;
}

const graph = buildImportGraph({
  entries: ROUTE_ENTRIES['/console-board'],
  readModule: (id) => FIXTURE_SOURCES[id] ?? null,
  resolveSpecifier,
});
const routeGraph = { graph };

describe('moduleId / parseModuleId', () => {
  it('qualifies bare strings as WE and round-trips objects', () => {
    expect(moduleId('src/index.njk')).toBe('we:src/index.njk');
    expect(moduleId({ repo: 'plateau-app', path: 'src/main.ts' })).toBe('plateau-app:src/main.ts');
    expect(moduleId('plateau-app:src/main.ts')).toBe('plateau-app:src/main.ts');
    expect(parseModuleId('plateau-app:src/main.ts')).toEqual({ repo: 'plateau-app', path: 'src/main.ts' });
  });
});

describe('parseImportSpecifiers', () => {
  it('extracts static, side-effect, re-export, and dynamic specifiers; skips comments', () => {
    const src = `
      import a from './a';
      import './side-effect.css';
      export { b } from './b';
      const c = await import('./c');
      // import './commented';
      /* import './blockcommented'; */
    `;
    expect(parseImportSpecifiers(src)).toEqual(['./a', './b', './side-effect.css', './c']);
  });
  it('includes type-only imports (a data-layer type change can still shift a route)', () => {
    expect(parseImportSpecifiers(`import type { X } from './types';`)).toEqual(['./types']);
  });
});

describe('resolveTransitiveModules', () => {
  it('returns the closure, entries included, and is cycle-safe', () => {
    const cyclic = { a: ['b'], b: ['a', 'c'], c: [] };
    expect(resolveTransitiveModules(cyclic, ['a'])).toEqual(new Set(['a', 'b', 'c']));
  });
});

describe('buildImportGraph (real parse over an injected reader)', () => {
  it('walks the fixture chain from the /console-board entries', () => {
    expect(graph.get(DATA)).toContain(READ_MODEL); // data → read-model edge parsed + resolved
    expect(graph.has(READ_MODEL)).toBe(true); // transitively reached
  });
});

describe('routeRenderClosure', () => {
  it('includes the data layer AND its transitive imports for /console-board', () => {
    const closure = routeRenderClosure('/console-board', { graph });
    expect(closure.has(DATA)).toBe(true); // the data-layer entry itself
    expect(closure.has(READ_MODEL)).toBe(true); // imported BY the data layer — transitive
    expect(closure.has(`${PA}types.ts`)).toBe(true);
  });
  it('is empty for an unknown route', () => {
    expect(routeRenderClosure('/nope', { graph }).size).toBe(0);
  });
});

describe('ACCEPTANCE #2802 — data-layer change classifies as UI-affecting for /console-board', () => {
  it('the import-graph resolver catches the lane-board-data.ts change', () => {
    expect(routesAffectedBy([DATA], routeGraph)).toEqual(['/console-board']);
    expect(isRouteAffectingChange([DATA], routeGraph)).toBe(true);
  });

  it('a PURE path-regex misses it (the dodge) — graph-aware isVisualTouch catches it', () => {
    // Path-regex only: a .ts data module under src/ matches no presentation surface → false.
    expect(isVisualTouch([DATA])).toBe(false);
    // Widened with the route graph → the change is UI-affecting.
    expect(isVisualTouch([DATA], { routeGraph })).toBe(true);
  });

  it('catches a change to a module the data layer transitively imports (card-state-read-model)', () => {
    expect(isVisualTouch([READ_MODEL])).toBe(false); // path-regex miss
    expect(isVisualTouch([READ_MODEL], { routeGraph })).toBe(true); // graph catch
    expect(routesAffectedBy([READ_MODEL], routeGraph)).toEqual(['/console-board']);
  });

  it('does NOT fire on a module outside any route closure', () => {
    const off = 'plateau-app:src/backlog-view/unrelated-tool.ts';
    expect(isVisualTouch([off], { routeGraph })).toBe(false);
    expect(routesAffectedBy([off], routeGraph)).toEqual([]);
  });
});
