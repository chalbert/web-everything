/**
 * @file registry-discovery.mjs — the shared, side-effect-free core behind both `soak/breaks/index.mjs` and
 * `health-smells/index.mjs`: build a registry array from every module file in a directory instead of a
 * hand-maintained import list (#3729-style merge conflict — every PR adding a break or a smell used to edit the
 * SAME index.mjs, so two same-window PRs collided on the same lines). Dropping a new `<id>.mjs` file into the
 * directory is now the WHOLE registration step.
 *
 * Deliberately has NO top-level await and does no directory scan at import time — it only defines functions.
 * The two `index.mjs` files import it and do their OWN eager `await loadModuleRegistry(DIR, validate)` at
 * their own module scope; keeping that eagerness OUT of this file means a test can import
 * `discoverModuleFiles`/`loadModuleRegistry` here without ever touching a real breaks/ or health-smells/
 * directory (and, incidentally, the daemon soak break modules that need a real subprocess/env — the same
 * reason `vitest.soak.config.ts` isolates them to their own `forks`-pool run).
 */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

/**
 * Every candidate module file directly in `dir`: real files only (not `fixtures/`, `__tests__/`, or any other
 * subdirectory), `.mjs` extension, excluding `index.mjs` itself and anything ending `.test.mjs` (covers both a
 * plain `<id>.test.mjs` and this repo's `<id>.soak.test.mjs` convention — both end in `.test.mjs`). Sorted by
 * filename so load order (and any listing built from it) is deterministic.
 */
export function discoverModuleFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.mjs') && d.name !== 'index.mjs' && !d.name.endsWith('.test.mjs'))
    .map((d) => d.name)
    .sort();
}

/**
 * Discover, import and validate every module in `dir`. `validate(mod, file)` must return the validated default
 * export or throw a descriptive error — a malformed module fails LOUDLY here (at load time) instead of silently
 * vanishing from the registry or crashing something far away. Every module's `id` must be unique within `dir`.
 */
export async function loadModuleRegistry(dir, validate) {
  const files = discoverModuleFiles(dir);
  const loaded = [];
  const fileById = new Map();
  for (const file of files) {
    const imported = await import(pathToFileURL(join(dir, file)).href);
    const mod = validate(imported.default, file);
    const dupe = fileById.get(mod.id);
    if (dupe) throw new Error(`${dir}/${file}: id "${mod.id}" duplicates ${dupe} — ids must be unique within this registry`);
    fileById.set(mod.id, file);
    loaded.push(mod);
  }
  return loaded;
}
