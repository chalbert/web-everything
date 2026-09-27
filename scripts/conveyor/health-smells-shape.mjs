/**
 * @file health-smells-shape.mjs — the smell-descriptor shape check for `health-smells/index.mjs`'s directory
 * discovery. Lives OUTSIDE `health-smells/` on purpose (mirrors `soak/breaks-shape.mjs`): that directory's own
 * contents are directory-discovered (every `.mjs` file in it is loaded as a smell module), so a shape-check
 * helper sitting inside it would itself get picked up and fail validation for having no default export. Also
 * split out from `index.mjs` itself: `index.mjs` eagerly loads every real smell module at import time
 * (top-level `await`), and importing just the validator here touches none of that, so a test can pull it in (or
 * feed it into `loadModuleRegistry` against a throwaway fixture directory) without importing the real registry.
 *
 * A smell module's default export shape (`health-smells/index.mjs`'s header has the full field-by-field
 * description): { id, scope (host|repo), cadence (every-tick|gh), probes: [...], openAfter, closeAfter,
 * severity, action (alert|investigate|file), evaluate(probes, ctx), optional diagnose }
 */
const REQUIRED_SMELL_FIELDS = Object.freeze(['id', 'scope', 'cadence', 'probes', 'openAfter', 'closeAfter', 'severity', 'action', 'evaluate']);
const VALID_SCOPES = new Set(['host', 'repo']);
const VALID_CADENCES = new Set(['every-tick', 'gh']);
const VALID_ACTIONS = new Set(['alert', 'investigate', 'file']);

/** Throws a loud, specific error when `mod` (the default export of `file`) is not a valid smell shape; returns
 *  `mod` unchanged otherwise. */
export function validateSmellShape(mod, file) {
  if (!mod || typeof mod !== 'object' || Array.isArray(mod)) {
    throw new Error(`health-smells/${file}: default export must be an object (a smell descriptor) — got ${Array.isArray(mod) ? 'an array' : typeof mod}`);
  }
  const missing = REQUIRED_SMELL_FIELDS.filter((k) => !(k in mod));
  if (missing.length) {
    throw new Error(`health-smells/${file}: default export is missing required field(s): ${missing.join(', ')} (need ${REQUIRED_SMELL_FIELDS.join(', ')})`);
  }
  if (typeof mod.id !== 'string' || !mod.id.trim()) throw new Error(`health-smells/${file}: "id" must be a non-empty string`);
  if (!VALID_SCOPES.has(mod.scope)) throw new Error(`health-smells/${file}: "scope" must be one of ${[...VALID_SCOPES].join('|')}, got ${JSON.stringify(mod.scope)}`);
  if (!VALID_CADENCES.has(mod.cadence)) throw new Error(`health-smells/${file}: "cadence" must be one of ${[...VALID_CADENCES].join('|')}, got ${JSON.stringify(mod.cadence)}`);
  if (!Array.isArray(mod.probes)) throw new Error(`health-smells/${file}: "probes" must be an array`);
  if (!Number.isFinite(mod.openAfter)) throw new Error(`health-smells/${file}: "openAfter" must be a number`);
  if (!Number.isFinite(mod.closeAfter)) throw new Error(`health-smells/${file}: "closeAfter" must be a number`);
  if (typeof mod.severity !== 'string' || !mod.severity.trim()) throw new Error(`health-smells/${file}: "severity" must be a non-empty string`);
  if (!VALID_ACTIONS.has(mod.action)) throw new Error(`health-smells/${file}: "action" must be one of ${[...VALID_ACTIONS].join('|')}, got ${JSON.stringify(mod.action)}`);
  if (typeof mod.evaluate !== 'function') throw new Error(`health-smells/${file}: "evaluate" must be a function`);
  if ('diagnose' in mod && mod.diagnose != null && typeof mod.diagnose !== 'object') {
    throw new Error(`health-smells/${file}: "diagnose", when present, must be an object`);
  }
  return mod;
}
