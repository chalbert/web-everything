/**
 * #4200-ish (gh-shim-stable-path) — a generated `gh` shim (`~/.claude/github-app-token/gh-shim/gh` or a
 * per-checkout `gh-shim.d/<hash>/gh`, see `scripts/lib/gh-app-shim.mjs`) bakes its `GH_THROTTLE_CLI` (or
 * `REAL_GH`) path into a lane clone (`.lanes/`). The lane pool resets/recycles/deletes a lane the moment its
 * own PR lands, so a shim baked this way is a ticking outage: every `gh` call routed through it breaks the
 * instant that lane goes away, with no warning until something tries to call `gh`. Live-caught: a shim was
 * found hard-coding `.../.lanes/web-everything/lane-22/scripts/lib/gh-throttle.mjs`.
 *
 * `defaultGhThrottleCliPath` (gh-app-shim.mjs) now resolves this through `primaryCheckout`, never a lane — but
 * an existing shim written before that fix, or one a still-unpatched checkout keeps rewriting, keeps the old
 * lane-path baked in until it is regenerated. This smell surfaces exactly that shim, by path, so it gets
 * regenerated (or the writing checkout upgraded) before the lane it names is recycled — never after.
 */
import { MINUTE } from '../health-watch-core.mjs';

export default {
  id: 'gh-shim-lane-path',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['ghShimLanes'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'medium',
  action: 'alert',
  windowMs: 15 * MINUTE, // unused by evaluate (no time-decayed count here) — kept for shape parity with siblings
  recommendationHint: 'A generated gh shim bakes its throttle CLI (or real gh) into a lane clone — that lane resetting/recycling breaks every gh call routed through this shim.',
  evaluate({ ghShimLanes }) {
    return (ghShimLanes || []).map((s) => {
      const bakedLanePath = /\/\.lanes\//.test(s.throttleCli || '') ? s.throttleCli : s.realGh;
      return {
        subject: s.path,
        breach: s.inLane,
        measure: { throttleCli: s.throttleCli, realGh: s.realGh },
        summary: s.inLane
          ? `${s.path} bakes a lane-clone path (${bakedLanePath}) — that lane resetting/recycling breaks every gh call routed through this shim.`
          : `${s.path}: no lane-clone path baked in.`,
        recommendation: `Regenerate ${s.path} from an up-to-date scripts/lib/gh-app-shim.mjs — its defaultGhThrottleCliPath now resolves through primaryCheckout (never a lane); the checkout that wrote this shim is running stale code and should be upgraded, not hand-edited.`,
      };
    });
  },
};
