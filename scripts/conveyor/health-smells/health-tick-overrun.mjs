/**
 * Seed smell 15 / #4077 — the health watch itself: its last tick overran its budget, or the same probe errored
 * three ticks running. The watcher cannot report its own death (that is slice 6's outside check), but it can
 * report its own sickness.
 */
export default {
  id: 'health-tick-overrun',
  scope: 'host',
  cadence: 'every-tick',
  probes: [],
  openAfter: 1,
  closeAfter: 2,
  severity: 'medium',
  action: 'alert',
  probeErrorStreak: 3,
  recommendationHint: 'The health watch is slow or a probe keeps failing — the report names which.',
  evaluate(_probes, { lastTick, probeErrors, config }) {
    const over = lastTick && (lastTick.killedByWatchdog || lastTick.durationMs > config.tickBudgetMs);
    const failing = Object.entries(probeErrors || {}).filter(([, v]) => v.count >= this.probeErrorStreak);
    return [{
      subject: 'health-watch',
      breach: !!over || failing.length > 0,
      measure: { killedByWatchdog: !!lastTick?.killedByWatchdog, lastTickMs: lastTick?.durationMs ?? null, budgetMs: config.tickBudgetMs, failingProbes: Object.fromEntries(failing) },
      summary: `${lastTick?.killedByWatchdog ? `the previous tick was killed by the watchdog after ${Math.round(lastTick.durationMs / 1000)}s. ` : ''}${over && !lastTick?.killedByWatchdog ? `last tick took ${Math.round(lastTick.durationMs / 1000)}s (budget ${config.tickBudgetMs / 1000}s). ` : ''}${failing.map(([k, v]) => `probe ${k} failed ${v.count}x: ${v.last}`).join('; ')}`.trim() || 'healthy',
      recommendation: lastTick?.killedByWatchdog ? 'The previous health tick hung and was killed by its watchdog — a probe or diagnosis blocked past its own timeout; the last probe named in health-watch.log is the one to put a tighter timeout on.' : failing.length ? `Fix the failing probe(s): ${failing.map(([k]) => k).join(', ')}.` : 'A probe is slow — lower its cadence or its timeout.',
    }];
  },
};
