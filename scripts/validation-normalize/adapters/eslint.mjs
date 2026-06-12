// ESLint adapter — ingests an ESLint config *into* the normalized model's terms.
//
// It only ever reads the project's own config; this `see` leg writes nothing back to
// ESLint. (Re-export — emitting an equivalent config for a different tool — is a separate,
// deferred leg.) Accepts both flat-config (`{ rules: {...} }` or a bare rules object) and
// legacy eslintrc shape; severity is normalised to 'error' | 'warn' | 'off'.

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
