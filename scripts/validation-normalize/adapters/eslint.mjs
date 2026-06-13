// ESLint adapter — ingests an ESLint config *into* the normalized model's terms, and (the #282
// re-export leg) emits an equivalent ESLint flat-config back out from resolved rule/severity pairs.
//
// `ingest` accepts both flat-config (`{ rules: {...} }` or a bare rules object) and legacy eslintrc
// shape; severity is normalised to 'error' | 'warn' | 'off'. `emit` is its inverse.

export const tool = 'eslint';

export function ingest(config) {
  const rules = config?.rules ?? config ?? {};
  return Object.entries(rules).map(([rule, setting]) => {
    const severity = severityOf(setting);
    return { rule, severity, enabled: severity !== 'off' };
  });
}

function severityOf(setting) {
  const level = Array.isArray(setting) ? setting[0] : setting;
  if (level === 2 || level === 'error') return 'error';
  if (level === 1 || level === 'warn') return 'warn';
  return 'off'; // 0 | 'off' | anything unrecognised
}

// Re-export (#282): the inverse of `ingest` — serialize resolved `{ rule, severity }` pairs into an
// ESLint flat-config `{ rules }` object. ESLint accepts the string severities directly; a missing
// severity defaults to 'error'.
export function emit(rules) {
  const out = {};
  for (const { rule, severity } of rules) out[rule] = severity ?? 'error';
  return { rules: out };
}
