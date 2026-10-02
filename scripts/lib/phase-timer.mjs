/** Per-round wall time. Preserve synchronous effects and count failures as work too. */
export function createPhaseTimer({ now = () => performance.now() } = {}) {
  const started = now();
  const phases = {};
  function measure(name, fn) {
    const start = now();
    const finish = () => {
      const p = phases[name] ??= { ms: 0, calls: 0 };
      p.ms += now() - start;
      p.calls++;
    };
    try {
      const value = fn();
      if (value && typeof value.then === 'function') return Promise.resolve(value).finally(finish);
      finish();
      return value;
    } catch (e) { finish(); throw e; }
  }
  return {
    measure,
    wrap: effects => Object.fromEntries(Object.entries(effects).map(([name, effect]) =>
      [name, typeof effect === 'function' ? (...args) => measure(name, () => effect.apply(effects, args)) : effect])),
    snapshot: () => ({ totalMs: Math.round(now() - started), phases: Object.fromEntries(
      Object.entries(phases).map(([name, p]) => [name, { ...p, ms: Math.round(p.ms) }])) }),
  };
}
