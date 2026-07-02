/**
 * @file scripts/lib/component-render-build-hook.cjs
 * @description WE Eleventy build orchestration for the SSR component-render harness (#2016, keystone of
 *   the #777 WE-docs dogfood epic).
 *
 *   The general build-time component→HTML render path, modeled on the data-table hook
 *   (`scripts/lib/data-table-build-hook.cjs`). Given a declarative spec for a `we-card` / `we-badge` /
 *   `we-tag` surface it returns ready-to-paint SSR HTML, so a catalog page renders correctly with JS
 *   disabled and the client custom-element upgrade (`src/_layouts/base.njk`) becomes a pure enhancement.
 *
 *   **Render-from-data, not markup-as-source (#2007).** Card/badge/tag own their rendered shape, so under
 *   the ratified feed-mechanism rule they are fed inert *data* — this hook composes a declarative spec and
 *   the FUI harness emits the canonical shape. It does NOT scan authored light-DOM as source. The emitted
 *   HTML is byte-identical to what the transient `<we-card>`/`<we-badge>`/`<we-tag>` elements upgrade to,
 *   so the SSR page carries the finished native element (no `<we-*>` wrapper) — nothing to re-upgrade,
 *   idempotent by construction.
 *
 *   WHY a subprocess and not an import: the block factories (`createCard`/`createBadge`/`createTag`) live
 *   in FUI; a WE→FUI code import is a banned backward DAG edge (constellation-placement). So WE
 *   orchestrates the FUI compute over a process boundary — keyed-batch JSON in on stdin, keyed-batch
 *   `{producer, results:[{key, html|error}]}` out on stdout. ONE subprocess renders every component on a
 *   page (no per-tile spawn storm).
 *
 *   The CLI is resolved as a LOCKED build-artifact at a FIXED relative path, never PATH-resolved (the
 *   #1867 reproducibility amendment carried over). FUI's `npm run build:tools` (#1946/#2016) emits it; a
 *   missing artifact is a hard build error, never a silent skip.
 *
 *   Authored as CommonJS so the sync-only Eleventy 2.x config can `require` it directly.
 */

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

/**
 * The pinned FUI build-artifact — a FIXED relative path resolved from the WE repo root against the
 * sibling `../frontierui` checkout, no PATH lookup. FUI's `npm run build:tools` esbuild-bundles the CLI
 * to exactly this self-contained ESM file.
 */
const PINNED_CLI_RELATIVE = path.join('..', 'frontierui', 'dist', 'tools', 'component-render', 'cli.mjs');

/** Producer pin the FUI harness stamps onto its batch envelope — surfaced so a stale artifact is visible.
 *  Kept in sync with `frontierui/blocks/renderers/component-render/buildHarness.ts:BUILD_HARNESS_PRODUCER`. */
const EXPECTED_PRODUCER = 'frontierui/component-render-build-harness/1';

/**
 * Shell out to the pinned FUI build-CLI: keyed-batch JSON on stdin, keyed-batch envelope on stdout.
 * `repoRoot` is the WE repo root the fixed relative artifact path is resolved against. Throws a hard
 * build error when the artifact is absent (the ratified ordering means FUI built it first) or the process
 * fails — a missing/mis-emitted artifact must NOT silently skip (non-reproducible build).
 */
function runBuildBatch(entries, repoRoot, runner = execFileSync) {
  const cliPath = path.resolve(repoRoot, PINNED_CLI_RELATIVE);
  if (!fs.existsSync(cliPath)) {
    throw new Error(
      `[component-render build] pinned FUI artifact missing at ${cliPath} — run FUI \`npm run build:tools\` `
      + `before WE \`build:docs\` (ratified ordering, #1946/#2016). A missing artifact is a hard build error.`,
    );
  }
  const input = JSON.stringify(entries);
  const out = runner('node', [cliPath], { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let batch;
  try {
    batch = JSON.parse(out);
  } catch (e) {
    throw new Error(`[component-render build] CLI returned non-JSON output: ${e && e.message}`);
  }
  if (!batch || batch.producer !== EXPECTED_PRODUCER) {
    throw new Error(
      `[component-render build] producer pin mismatch (got ${batch && batch.producer}, expected `
      + `${EXPECTED_PRODUCER}) — the pinned artifact is stale or PATH-resolved.`,
    );
  }
  return batch;
}

/**
 * Render a keyed batch of component specs to a `{ key -> html }` map in one subprocess call. Each spec is
 * `{ key, component: 'card'|'badge'|'tag', config }`. A per-entry error is surfaced to the build log and
 * that key is omitted from the map (keyed-batch isolation — one bad spec never poisons the others).
 */
function renderComponents(specs, repoRoot, runner = execFileSync) {
  if (!Array.isArray(specs) || specs.length === 0) return new Map();
  const batch = runBuildBatch(specs, repoRoot, runner);
  const byKey = new Map();
  for (const res of batch.results) {
    if (!res || res.error || !res.html) {
      if (res && res.error) {
        // eslint-disable-next-line no-console
        console.warn(`[component-render build] spec "${res && res.key}" failed, omitted: ${res.error}`);
      }
      continue;
    }
    byKey.set(res.key, res.html);
  }
  return byKey;
}

/** Map an intent status to its badge tone (mirrors the prior template ternary in `src/intents.njk`). */
function statusTone(status) {
  if (status === 'active' || status === 'stable') return 'success';
  if (status === 'draft') return 'info';
  if (status === 'poc') return 'info';
  if (status === 'concept' || status === 'experimental') return 'warning';
  return 'neutral';
}

/** Uppercase-first (the `| title` the template applied to the status label). */
function titleCase(s) {
  return typeof s === 'string' && s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Minimal HTML-attribute escaper for values spliced into the grid wrapper markup. */
function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The dimension keys of an intent (its `dimensions` object keys), in declared order. */
function dimensionKeys(intent) {
  const dims = intent && intent.dimensions;
  return dims && typeof dims === 'object' ? Object.keys(dims) : [];
}

/**
 * Build the keyed component specs for one intent tile: a status `badge`, one `tag` per dimension, and the
 * `card` shell whose body composes the summary + tag row and whose header actions carry the badge. The
 * card body/actions reference the sibling specs by key — the caller resolves them AFTER the batch renders
 * (a card spec's `actionsHtml`/`body` need the rendered badge/tag HTML), so this returns the leaf specs
 * (badge + tags) to render in the batch plus a `compose(rendered)` that assembles the card spec.
 */
function intentTileSpecs(intent, i) {
  const badgeKey = `intent-${i}-badge`;
  const dimKeys = dimensionKeys(intent);
  const tagSpecs = dimKeys.map((key, j) => ({
    key: `intent-${i}-tag-${j}`,
    component: 'tag',
    config: { label: key, shape: 'pill', className: 'intent-dim-tag' },
  }));
  const leaves = [
    { key: badgeKey, component: 'badge', config: { label: titleCase(intent.status), tone: statusTone(intent.status) } },
    ...tagSpecs,
  ];
  return { leaves, badgeKey, tagKeys: tagSpecs.map((t) => t.key) };
}

/**
 * Render the full intents catalog grid to SSR HTML in ONE subprocess batch (#2016 acceptance surface).
 * Two-pass over the batch: (1) render every tile's leaf badge + tags; (2) render each tile's card shell,
 * feeding the already-rendered badge as the header `actionsHtml` and the summary + tag row as the body.
 * Returns the `<div class="project-grid">…</div>` markup ready to splice into `src/intents.njk`.
 *
 * The outer `<a class="project-card intent-tile">` linking wrapper + the search/filter `data-*` are kept
 * in the template (they are page chrome, not the card block); this only emits the SSR card frame each
 * anchor wraps — the same division of labour the prior `<we-card>`-in-template markup had.
 */
function renderIntentGrid(intents, repoRoot, runner = execFileSync) {
  const list = Array.isArray(intents) ? intents : [];

  // Pass 1 — batch every tile's leaf badge + tags in a single subprocess call.
  const tiles = list.map((intent, i) => intentTileSpecs(intent, i));
  const leafSpecs = tiles.flatMap((t) => t.leaves);
  const leaves = renderComponents(leafSpecs, repoRoot, runner);

  // Pass 2 — batch every tile's card shell, fed the pass-1 badge/tag HTML. The body is an escape-safe
  // PARTS list: the summary is TEXT (set via textContent downstream, so a literal `<title>` in a summary
  // can't inject a tag), the dimension-chip row is trusted HTML (the pre-serialized `.fui-tag` spans).
  const cardSpecs = list.map((intent, i) => {
    const t = tiles[i];
    const badgeHtml = leaves.get(t.badgeKey) || '';
    const tagHtml = t.tagKeys.map((k) => leaves.get(k) || '').join('');
    const bodyParts = [{ tag: 'p', className: 'intent-summary', text: String(intent.summary || '') }];
    if (tagHtml) bodyParts.push({ tag: 'div', className: 'intent-dim-row', html: tagHtml });
    return {
      key: `intent-${i}-card`,
      component: 'card',
      config: {
        title: intent.name,
        actionsHtml: badgeHtml,
        bodyParts,
        className: 'intent-card',
      },
    };
  });
  const cards = renderComponents(cardSpecs, repoRoot, runner);

  // Assemble the grid: each card frame wrapped in its linking anchor + search/filter data-*.
  const anchors = list.map((intent, i) => {
    const cardHtml = cards.get(`intent-${i}-card`) || '';
    const dimKeys = dimensionKeys(intent);
    const haystack = `${intent.id} ${String(intent.name || '').toLowerCase()} `
      + `${String(intent.summary || '').toLowerCase()} ${dimKeys.join(' ').toLowerCase()}`;
    return (
      `<a href="/intents/${escapeAttr(intent.id)}/" class="project-card intent-tile" `
      + `data-status="${escapeAttr(intent.status)}" data-haystack="${escapeAttr(haystack)}" `
      + `style="text-decoration: none; color: inherit; display: block;">${cardHtml}</a>`
    );
  });

  return `<div class="project-grid" id="intent-grid">${anchors.join('')}</div>`;
}

/**
 * Render one project's icon block as trusted HTML (leading body row). `isSvg` projects carry an
 * `<img>` path; the emoji/text projects carry a literal glyph. Mirrors the `.project-icon` markup the
 * prior hand-rolled `.project-card` template emitted.
 */
function projectIconHtml(project) {
  if (project && project.isSvg) {
    const src = escapeAttr(project.icon);
    const alt = escapeAttr(`${project.name || ''} icon`);
    return `<img src="${src}" alt="${alt}" width="48" height="48">`;
  }
  // Trusted literal glyph (emoji or short text from our own project data).
  return String(project && project.icon != null ? project.icon : '');
}

/**
 * Render the home/index project grid to SSR HTML in ONE subprocess batch (#2019, generalizing the
 * #2016 `renderIntentGrid` pattern from the intents catalog to the landing page). Each project becomes a
 * `we-card` SSR tile: the name is the card title, the status is a header-trailing `we-badge` (render-from-
 * data), and the body carries the icon + description + the existing status-meter progress bar. The outer
 * click-through `<a class="project-card">` linking wrapper stays page chrome (same division of labour as
 * `renderIntentGrid`); the anchor's own frame is stripped by `.project-card:has(> .fui-card)` in
 * `style.css`, so the card is the sole visual frame.
 *
 * `projects` is the list to render; `hrefFor(project)` returns the tile's link target (the landing page
 * links standard/protocol tiles to `/projects/{id}/` but the impls tile to an external URL, so the caller
 * supplies it). `gridClass` is the wrapping grid's class list (e.g. `project-grid project-grid--centered`).
 */
function renderProjectGrid(projects, { repoRoot, hrefFor, gridClass = 'project-grid', external = false }, runner = execFileSync) {
  const list = Array.isArray(projects) ? projects : [];

  // Pass 1 — batch every tile's status badge in one subprocess call.
  const badgeSpecs = list.map((project, i) => ({
    key: `project-${i}-badge`,
    component: 'badge',
    config: { label: titleCase(project.status), tone: statusTone(project.status) },
  }));
  const badges = renderComponents(badgeSpecs, repoRoot, runner);

  // Pass 2 — batch every tile's card shell, fed the pass-1 badge as the header actions. The body is an
  // escape-safe PARTS list: the icon row + status-meter row are TRUSTED HTML (our own template data), the
  // description is likewise trusted HTML (it carries authored `<strong>`/`<code>`/`<a>` markup, spliced by
  // `| safe` in the prior template). None of it is user input.
  const cardSpecs = list.map((project, i) => {
    const badgeHtml = badges.get(`project-${i}-badge`) || '';
    const meterHtml =
      `<div class="status-meter status-${escapeAttr(project.status)}">`
      + `<span class="status-label">Status: ${escapeAttr(titleCase(project.status))}</span>`
      + `<div class="meter-track"><div class="meter-fill"></div></div></div>`;
    const bodyParts = [
      { tag: 'div', className: 'project-icon', html: projectIconHtml(project) },
      { tag: 'p', className: 'project-desc', html: String(project.description || '') },
      { tag: 'div', className: 'project-status-row', html: meterHtml },
    ];
    return {
      key: `project-${i}-card`,
      component: 'card',
      config: {
        title: project.name,
        actionsHtml: badgeHtml,
        bodyParts,
        className: 'project-tile-card',
      },
    };
  });
  const cards = renderComponents(cardSpecs, repoRoot, runner);

  // Assemble the grid: each card frame wrapped in its linking anchor.
  const anchors = list.map((project, i) => {
    const cardHtml = cards.get(`project-${i}-card`) || '';
    const rel = external ? ' target="_blank" rel="noopener"' : '';
    return (
      `<a href="${escapeAttr(hrefFor(project))}" class="project-card" `
      + `aria-label="View ${escapeAttr(project.name)}"${rel} `
      + `style="text-decoration: none; color: inherit; display: block;">${cardHtml}</a>`
    );
  });

  return `<div class="${escapeAttr(gridClass)}">${anchors.join('')}</div>`;
}

/**
 * Render the governance lifecycle stage grid to SSR HTML in ONE subprocess batch (#2020, generalizing the
 * #2016 SSR path to the governance page). Each stage becomes a `we-card` SSR tile: the `N · Name` line is
 * the card title, the stage marker (`We are here` / the future-gate label) is a header-trailing `we-badge`
 * (render-from-data per #2007 — the current stage takes the `info` tone, the future stages `neutral`), and
 * the body carries the role line + description + the "moves on when" gate. There is NO outer linking anchor
 * (stage cards are not click-throughs — unlike the intent/project grids), so the `.fui-card` is spliced
 * straight into the grid. The current stage's card gets a `.stage-tile-card--current` class so the accent
 * border (`src/css/style.css`) can key off it, replacing the retired `.stage-card.is-current` rule.
 *
 * `stages` is the list of `{ n, name, tag, current, role, description, gate }` — `role`/`description`/`gate`
 * carry trusted authored HTML (our own template data with `<strong>` emphasis), spliced via body `html`
 * parts. The client `<we-card>`/`<we-badge>` CE upgrade (base.njk) is a pure enhancement over this
 * JS-off-correct baseline.
 */
function renderStageGrid(stages, repoRoot, runner = execFileSync) {
  const list = Array.isArray(stages) ? stages : [];

  // Pass 1 — batch every stage's marker badge in one subprocess call.
  const badgeSpecs = list.map((stage, i) => ({
    key: `stage-${i}-badge`,
    component: 'badge',
    config: { label: String(stage.tag || ''), tone: stage.current ? 'info' : 'neutral' },
  }));
  const badges = renderComponents(badgeSpecs, repoRoot, runner);

  // Pass 2 — batch every stage's card shell, fed the pass-1 badge as the header actions. The body parts are
  // TRUSTED authored HTML (our own governance copy carrying `<strong>` emphasis), not user input.
  const cardSpecs = list.map((stage, i) => {
    const badgeHtml = badges.get(`stage-${i}-badge`) || '';
    const bodyParts = [
      { tag: 'p', className: 'stage-role', html: String(stage.role || '') },
      { tag: 'p', className: 'stage-desc', html: String(stage.description || '') },
      { tag: 'p', className: 'stage-gate', html: String(stage.gate || '') },
    ];
    return {
      key: `stage-${i}-card`,
      component: 'card',
      config: {
        title: `${stage.n} · ${stage.name}`,
        actionsHtml: badgeHtml,
        bodyParts,
        className: stage.current ? 'stage-tile-card stage-tile-card--current' : 'stage-tile-card',
      },
    };
  });
  const cards = renderComponents(cardSpecs, repoRoot, runner);

  const tiles = list.map((stage, i) => cards.get(`stage-${i}-card`) || '');
  return `<div class="gov-stages">${tiles.join('')}</div>`;
}

module.exports = {
  PINNED_CLI_RELATIVE,
  EXPECTED_PRODUCER,
  runBuildBatch,
  renderComponents,
  renderIntentGrid,
  renderProjectGrid,
  renderStageGrid,
  projectIconHtml,
  statusTone,
  intentTileSpecs,
};
