// Oxlint adapter — ingests an `.oxlintrc.json` into the normalized model's terms.
//
// Oxlint deliberately mirrors ESLint's severity vocabulary ('error' | 'warn' | 'off' /
// 'allow' | 'deny'), so ingestion is close to the ESLint adapter — but it is its own adapter
// on purpose: the rule *namespaces* differ (e.g. `react/exhaustive-deps` vs ESLint's
// `react-hooks/exhaustive-deps`), and Oxlint has no equivalent for some concerns at all.
// Those differences are exactly what the normalization hub exists to surface.

export const tool = 'oxlint';

export function ingest(config) {
  const rules = config?.rules ?? config ?? {};
  return Object.entries(rules).map(([rule, setting]) => {
    const severity = severityOf(setting);
    return { rule, severity, enabled: severity !== 'off' };
  });
}

function severityOf(setting) {
  const level = Array.isArray(setting) ? setting[0] : setting;
  if (level === 2 || level === 'error' || level === 'deny') return 'error';
  if (level === 1 || level === 'warn') return 'warn';
  return 'off'; // 0 | 'off' | 'allow' | unrecognised
}
