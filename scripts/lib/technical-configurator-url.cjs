'use strict';

/**
 * Build the URL-canonical seed for the embedded Technical Configurator (#752, transport ratified
 * by #788).
 *
 * Per the #788 ruling (Plateau↔WE embed/seed transport): the **URL query params are canonical** and
 * **typed** — they mirror the block's technical dimensions, never an opaque blob. Plateau owns the
 * route (`/technical-configurator`) and the param vocabulary; WE only *builds* the URL here. An
 * optional `postMessage` channel (readback / auto-resize) layers on top but is not the seed.
 *
 * Two URLs come off the same builder: the **embed** src (`embed=1`, slim chrome inside the iframe)
 * and the **deep-link** to the full project-wide configurator (no `embed` flag). Keeping both on one
 * typed serialization is what makes the seed round-trippable (the #754 permalink/export shape).
 *
 * Param vocabulary (all optional; absent → the configurator's own defaults apply):
 *   - `domain`   → focus one of the four WE dimensions (#789): render-strategy | delivery-transport
 *                  | trait-lazy-load | chunk-split
 *   - `strategy` → pre-select a strategy within that domain
 *   - `req-<axis>` → seed a requirement level on an axis (e.g. `req-first-paint=pre-rendered`)
 *   - `embed`    → `1` for the iframe embed; omitted for the deep-link
 */

const TC_ROUTE = '/technical-configurator';

// The four WE technical dimensions exposed as Configurator domains (#789). Used to validate a
// block's `technicalConfig.domain` at build time so a typo doesn't silently seed a dead domain.
const TC_DOMAIN_IDS = ['render-strategy', 'delivery-transport', 'trait-lazy-load', 'chunk-split'];

/**
 * @param {string} base   Plateau base origin, e.g. `http://localhost:4000` (env-parameterised like
 *                        `FUI_DEMO_BASE`); a trailing slash is tolerated.
 * @param {{domain?: string, strategy?: string, requirements?: Record<string,string>}} [config]
 *                        the block's seeded technical config.
 * @param {{embed?: boolean}} [opts]  `embed: true` → iframe seed; omit → deep-link.
 * @returns {string} the fully-built seed URL.
 */
function buildTechnicalConfiguratorUrl(base, config, opts) {
  config = config || {};
  opts = opts || {};
  const root = String(base || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  if (config.domain) params.set('domain', String(config.domain));
  if (config.strategy) params.set('strategy', String(config.strategy));
  if (config.requirements && typeof config.requirements === 'object') {
    for (const [axis, level] of Object.entries(config.requirements)) {
      if (level != null && level !== '') params.set('req-' + axis, String(level));
    }
  }
  if (opts.embed) params.set('embed', '1');
  const qs = params.toString();
  return root + TC_ROUTE + (qs ? '?' + qs : '');
}

module.exports = { buildTechnicalConfiguratorUrl, TC_ROUTE, TC_DOMAIN_IDS };
