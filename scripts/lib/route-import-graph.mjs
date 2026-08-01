/**
 * route-import-graph.mjs — the dependency-aware half of the #2802 UI-item classifier.
 *
 * ## Why this exists (the data-layer dodge)
 * A path-regex classifier (`isVisualTouch` in `render-check.mjs`) asks "does this file LOOK like a
 * presentation surface?" — `.css`, `.njk`, a template dir. That question is blind to the change class
 * that actually emptied the console board: an edit to a pure DATA-LAYER module
 * (`plateau-app:src/backlog-view/lane-board-data.ts`) that the `/console-board` route renders THROUGH.
 * The file is `.ts`, lives under `src/`, imports no CSS — every path-regex misses it, yet changing it
 * repaints the board. The correct question is a GRAPH question: "is this file in the set of modules a
 * real route transitively renders through — its data mappers and store included?"
 *
 * This module answers that question deterministically and WE-side: no product boot, no browser. It
 * resolves a route's render closure over a static import graph and reports which routes a changed-file
 * set touches. The graph is INJECTED (`readModule` / `resolveSpecifier` or a prebuilt adjacency map),
 * so the same resolver runs against a fixture in a unit test OR — as a follow-up — against the real
 * plateau-app source (an fs-backed reader) without WE holding any product code.
 *
 * ## Repo-qualified node ids
 * Every module is identified `repo:path`, e.g. `plateau-app:src/backlog-view/lane-board-data.ts`, so a
 * changed-file set that spans repos (WE templates + FUI tokens + plateau-app modules) classifies under
 * one graph. `moduleId` / `parseModuleId` convert between the string form and `{repo, path}`.
 *
 * ## Follow-up (#2802)
 * `buildImportGraph` is the REAL resolver interface — give it an fs-backed `readModule` +
 * `resolveSpecifier` (relative-path resolution + the plateau-app `@/…` aliases) and it walks the live
 * source. This slice proves the data-layer→route linkage with a FIXTURE graph that mirrors the real
 * `lane-board-data → /console-board` chain (kept WE-side deterministic, no sibling checkout at gate
 * time). Wiring `buildImportGraph` to a committed module-manifest snapshot of the real graph — so it
 * runs in `check:standards` without the plateau-app clone present — is the follow-up.
 *
 * @module route-import-graph
 */

/**
 * A repo-qualified module id string, `repo:path`. A bare string is treated as a WE-relative path.
 * @param {string | {repo?: string, path: string}} f
 * @returns {string | null} `repo:path`, or null if unparseable.
 */
export function moduleId(f) {
  if (typeof f === 'string') return f.includes(':') ? f : `we:${f}`;
  if (f && typeof f === 'object' && typeof f.path === 'string') return `${f.repo || 'we'}:${f.path}`;
  return null;
}

/**
 * Split a `repo:path` id back into its parts. The path may itself contain colons (rare); only the first
 * colon delimits the repo.
 * @param {string} id
 * @returns {{repo: string, path: string} | null}
 */
export function parseModuleId(id) {
  if (typeof id !== 'string' || !id.includes(':')) return null;
  const i = id.indexOf(':');
  return { repo: id.slice(0, i), path: id.slice(i + 1) };
}

/**
 * Strip `//` line comments and `/* *​/` block comments so a commented-out `import` never registers as a
 * real edge. Intentionally simple (no template-literal / regex-literal awareness) — import statements
 * live at module top-level in this codebase, well clear of the edge cases, and a deterministic
 * over-strip is safer for a classifier than a missed edge.
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Extract every module specifier a source file imports or re-exports — static `import … from 'x'`,
 * side-effect `import 'x'`, re-export `export … from 'x'`, and dynamic `import('x')`. Order-preserving,
 * de-duplicated. Type-only imports (`import type …`) ARE included: a data-layer type change can still
 * shift what a route renders, and the closure is a superset by design (better to over-classify than
 * miss the console-board dodge).
 * @param {string} source
 * @returns {string[]} the raw specifier strings, e.g. `['./lane-board', '@frontierui/blocks/card']`
 */
export function parseImportSpecifiers(source) {
  if (typeof source !== 'string') return [];
  const clean = stripComments(source);
  const specs = [];
  const push = (s) => { if (s && !specs.includes(s)) specs.push(s); };
  // `import … from 'x'` and `export … from 'x'` (the `from` keyword pins it to a module edge).
  for (const m of clean.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) push(m[1]);
  // side-effect `import 'x'` (no `from`) — e.g. `import './lane-board.css'`.
  for (const m of clean.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) push(m[1]);
  // dynamic `import('x')`.
  for (const m of clean.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) push(m[1]);
  return specs;
}

/**
 * Walk a static import graph from a set of entry modules and return the transitive closure — every
 * internal module reachable from any entry, entries included. Cycle-safe (visited set). The graph is an
 * adjacency map `Map<nodeId, Iterable<nodeId>>` (module → the internal modules it imports); a node with
 * no entry in the map is a leaf (external/unresolved edges are simply absent).
 * @param {Map<string, Iterable<string>> | Record<string, Iterable<string>>} graph
 * @param {Iterable<string>} entries repo-qualified entry node ids
 * @returns {Set<string>} the closure, entries included
 */
export function resolveTransitiveModules(graph, entries) {
  const get = graph instanceof Map ? (k) => graph.get(k) : (k) => graph[k];
  const seen = new Set();
  const stack = [...(entries || [])];
  while (stack.length) {
    const id = stack.pop();
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const deps = get(id);
    if (deps) for (const d of deps) if (!seen.has(d)) stack.push(d);
  }
  return seen;
}

/**
 * Build a static import graph by walking real (or fixtured) source from a set of entry modules. This is
 * the resolver INTERFACE the follow-up wires to live plateau-app source; here it runs against any
 * injected reader, so a unit test drives it with an in-memory fixture and no product boot.
 *
 * @param {object} opts
 * @param {Iterable<string>} opts.entries repo-qualified entry node ids
 * @param {(id: string) => (string | null | undefined)} opts.readModule source for a node id, or null if
 *   it can't be read (treated as a leaf).
 * @param {(fromId: string, specifier: string) => (string | null | undefined)} opts.resolveSpecifier map
 *   an import specifier (relative or alias) seen INSIDE `fromId` to a repo-qualified node id, or null to
 *   drop it (bare/external package, unresolved). Only non-null resolutions become graph edges.
 * @returns {Map<string, string[]>} adjacency map over the internal modules actually reached.
 */
export function buildImportGraph({ entries, readModule, resolveSpecifier }) {
  const graph = new Map();
  const stack = [...(entries || [])];
  while (stack.length) {
    const id = stack.pop();
    if (id == null || graph.has(id)) continue;
    const source = readModule(id);
    if (source == null) { graph.set(id, []); continue; }
    const edges = [];
    for (const spec of parseImportSpecifiers(source)) {
      const dep = resolveSpecifier(id, spec);
      if (dep && !edges.includes(dep)) { edges.push(dep); if (!graph.has(dep)) stack.push(dep); }
    }
    graph.set(id, edges);
  }
  return graph;
}

/**
 * The route registry: each real route mapped to the entry modules its mount path directly pulls in. The
 * render closure of a route is the transitive import closure of these entries.
 *
 * `/console-board` (plateau-app `src/main.ts` → `tryMountLaneBoard`/`refreshBoard`, #2505/#2628) mounts
 * through two entries: the view (`lane-board`) and the DATA layer (`lane-board-data`, whose
 * `loadBoardData` feeds the board). Listing the data module as a first-class entry is the whole point —
 * its transitive imports (the read-model, card taxonomy, span types) all fall into the route's closure,
 * so a change to any of them classifies as UI-affecting for `/console-board`.
 * @type {Readonly<Record<string, string[]>>}
 */
export const ROUTE_ENTRIES = Object.freeze({
  '/console-board': [
    'plateau-app:src/backlog-view/lane-board.ts',
    'plateau-app:src/backlog-view/lane-board-data.ts',
  ],
});

/**
 * The set of modules a route renders through — the transitive import closure of its entry modules over
 * the given graph. Unknown route ⇒ empty set.
 * @param {string} route
 * @param {object} [ctx]
 * @param {Record<string, string[]>} [ctx.routeEntries] route→entries (defaults to {@link ROUTE_ENTRIES})
 * @param {Map<string, Iterable<string>> | Record<string, Iterable<string>>} [ctx.graph] adjacency map
 *   (defaults to empty — closure is then just the entries themselves)
 * @returns {Set<string>}
 */
export function routeRenderClosure(route, { routeEntries = ROUTE_ENTRIES, graph = new Map() } = {}) {
  const entries = routeEntries[route];
  if (!entries) return new Set();
  return resolveTransitiveModules(graph, entries);
}

/**
 * Which routes a changed-file set touches: a route is affected when ANY changed file is in its render
 * closure (data mappers/store included). Files may be repo-qualified objects or `repo:path` strings; a
 * bare string is WE-relative.
 * @param {Array<string | {repo?: string, path: string}>} changedFiles
 * @param {object} [ctx] see {@link routeRenderClosure}
 * @returns {string[]} affected route paths (subset of `routeEntries` keys), in registry order
 */
export function routesAffectedBy(changedFiles, { routeEntries = ROUTE_ENTRIES, graph = new Map() } = {}) {
  if (!Array.isArray(changedFiles)) return [];
  const changed = new Set(changedFiles.map(moduleId).filter(Boolean));
  if (changed.size === 0) return [];
  const affected = [];
  for (const route of Object.keys(routeEntries)) {
    const closure = routeRenderClosure(route, { routeEntries, graph });
    for (const id of changed) {
      if (closure.has(id)) { affected.push(route); break; }
    }
  }
  return affected;
}

/**
 * Boolean form of {@link routesAffectedBy}: does the changed-file set land in ANY route's render
 * closure? This is the dependency-aware signal `isVisualTouch` folds in alongside its path-regex.
 * @param {Array<string | {repo?: string, path: string}>} changedFiles
 * @param {object} [ctx] see {@link routeRenderClosure}
 * @returns {boolean}
 */
export function isRouteAffectingChange(changedFiles, ctx) {
  return routesAffectedBy(changedFiles, ctx).length > 0;
}
