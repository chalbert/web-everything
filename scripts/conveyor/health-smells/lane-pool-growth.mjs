/**
 * Seed smell 12 / #4066 — the lane pool is growing toward its ceiling, or dirty unleased lanes are piling up.
 * 2026-09-24: the WE pool passed 100 clones while only a handful were acquirable; the rest held uncommitted or
 * un-provably-pushed work nobody would come back for. `lane-starvation` fires when acquirable lanes run OUT; this
 * fires earlier, on the growth and the litter that lead there.
 *
 * Reads the lane-pool health watcher's own per-tick line (`lanePools` probe:
 * `{total, leased, acquirable, dirtyUnleased}` per constellation repo). Breaches when `total` is above
 * `capFraction` (90%) of the pool's hard ceiling, or when more than `dirtyFraction` (20%) of the pool is dirty and
 * unleased. `hardCap` mirrors `we:scripts/lane-pool.mjs`'s `ACQUIRE_HARD_MAX` (90 / 30 / 30 — the ceiling
 * acquire's growth-on-empty may clone up to); that script is a CLI with top-level side effects, so it cannot be
 * imported here. A host that sets `LANE_POOL_HARD_MAX` overrides it via `<healthDir>/config.json`
 * (`laneHardCap: {we: N, …}`).
 *
 * Alert-only. The 4065 table's "file when litter-only" needs a per-lane litter-vs-real-work split this health
 * line does not carry; it stays out of this slice.
 */
export const LANE_HARD_CAP = Object.freeze({ we: 90, frontierui: 30, 'plateau-app': 30 });
const HARD_CAP_FALLBACK = 30;

export default {
  id: 'lane-pool-growth',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['lanePools'],
  openAfter: 3,
  closeAfter: 3,
  severity: 'medium',
  action: 'alert',
  capFraction: 0.9,
  dirtyFraction: 0.2,
  recommendationHint: 'The lane pool is near its ceiling or full of dirty unleased lanes.',
  evaluate({ lanePools }, { now, config }) {
    const caps = { ...LANE_HARD_CAP, ...(config?.laneHardCap || {}) };
    const out = [];
    for (const p of lanePools || []) {
      const h = p?.health || {};
      const total = Number(h.total) || 0;
      if (!total) continue;
      const cap = Number(caps[p.repo]) || HARD_CAP_FALLBACK;
      const dirty = Number(h.dirtyUnleased) || 0;
      const nearCap = total > this.capFraction * cap;
      const littered = dirty / total > this.dirtyFraction;
      const reasons = [
        ...(nearCap ? [`${total}/${cap} lanes (> ${Math.round(this.capFraction * 100)}% of the ceiling)`] : []),
        ...(littered ? [`${dirty}/${total} dirty unleased (> ${Math.round(this.dirtyFraction * 100)}%)`] : []),
      ];
      out.push({
        subject: `lane-pool:${p.repo}`,
        breach: nearCap || littered,
        measure: {
          repo: p.repo, total, cap, leased: h.leased ?? null, acquirable: h.acquirable ?? null, dirtyUnleased: dirty,
          capPct: Math.round((total / cap) * 100), dirtyPct: Math.round((dirty / total) * 100),
          readingAgeMs: Number.isFinite(p.at) ? now - p.at : null,
        },
        summary: `${p.repo} lane pool: ${total}/${cap} lanes, ${h.leased ?? '?'} leased, ${h.acquirable ?? '?'} acquirable, ${dirty} dirty unleased`
          + `${reasons.length ? ` — ${reasons.join('; ')}` : ''}.`,
        recommendation: !reasons.length ? 'ok'
          : [
            nearCap ? `The ${p.repo} pool is at ${total}/${cap}: preview a shrink with \`node scripts/lane-pool.mjs trim --dry-run\` (it only removes lanes whose work is provably pushed).` : null,
            littered ? `${dirty} lanes are dirty with no lease: list them (\`node scripts/lane-pool.mjs list\`) and check whether the work in them is real before anything cleans them; a growing count means some flow leaves lanes dirty on release.` : null,
          ].filter(Boolean).join(' '),
      });
    }
    return out;
  },
};
