/**
 * @file breaks-shape.mjs — the break-descriptor shape check for `breaks/index.mjs`'s directory discovery. Lives
 * OUTSIDE `breaks/` on purpose: that directory's own contents are directory-discovered (every `.mjs` file in it
 * is loaded as a break module), so a shape-check helper file sitting inside it would itself get picked up and
 * fail validation for having no default export. Also split out from `index.mjs` itself: `index.mjs` eagerly
 * loads every real break module at import time (top-level `await`), and some of those modules need a real
 * subprocess/env (the reason `vitest.soak.config.ts` isolates their own tests to a `forks` pool run) —
 * importing this file alone touches none of that, so a test can pull in just the validator (or feed it into
 * `loadModuleRegistry` against a throwaway fixture directory) safely under any vitest pool.
 *
 * A break module's default export shape (`breaks/index.mjs`'s header has the full field-by-field description):
 *   { id, title, card, fixedBy: { sha, where }, fixPresent(root), async run({ log }), judge(report) }
 */
const REQUIRED_BREAK_FIELDS = Object.freeze(['id', 'title', 'card', 'fixedBy', 'fixPresent', 'run', 'judge']);

/** Throws a loud, specific error when `mod` (the default export of `file`) is not a valid break shape; returns
 *  `mod` unchanged otherwise. */
export function validateBreakShape(mod, file) {
  if (!mod || typeof mod !== 'object' || Array.isArray(mod)) {
    throw new Error(`soak/breaks/${file}: default export must be an object (a break descriptor) — got ${Array.isArray(mod) ? 'an array' : typeof mod}`);
  }
  const missing = REQUIRED_BREAK_FIELDS.filter((k) => !(k in mod));
  if (missing.length) {
    throw new Error(`soak/breaks/${file}: default export is missing required field(s): ${missing.join(', ')} (need ${REQUIRED_BREAK_FIELDS.join(', ')})`);
  }
  if (typeof mod.id !== 'string' || !mod.id.trim()) throw new Error(`soak/breaks/${file}: "id" must be a non-empty string`);
  if (typeof mod.title !== 'string' || !mod.title.trim()) throw new Error(`soak/breaks/${file}: "title" must be a non-empty string`);
  if (typeof mod.card !== 'string' || !mod.card.trim()) throw new Error(`soak/breaks/${file}: "card" must be a non-empty string`);
  if (!mod.fixedBy || typeof mod.fixedBy !== 'object' || typeof mod.fixedBy.sha !== 'string' || typeof mod.fixedBy.where !== 'string') {
    throw new Error(`soak/breaks/${file}: "fixedBy" must be an object with string "sha" and "where"`);
  }
  if (typeof mod.fixPresent !== 'function') throw new Error(`soak/breaks/${file}: "fixPresent" must be a function`);
  if (typeof mod.run !== 'function') throw new Error(`soak/breaks/${file}: "run" must be a function`);
  if (typeof mod.judge !== 'function') throw new Error(`soak/breaks/${file}: "judge" must be a function`);
  return mod;
}
