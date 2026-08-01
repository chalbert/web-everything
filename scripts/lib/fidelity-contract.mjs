/**
 * @file scripts/lib/fidelity-contract.mjs
 * @description UI-fidelity CONTRACT SCHEMA + shape validator (#2805, epic #2804).
 *
 * The `fidelity:` frontmatter block a UI backlog item is born carrying (design reference
 * reports/2026-07-31-ui-fidelity-gate-design.md §"The `fidelity:` contract"). This module is the WE-side,
 * DETERMINISTIC, PURE well-formedness check — it validates SHAPE only and NEVER boots the product (WE holds
 * zero implementation, MEMORY #6): the real route table lives in the product repo; here we can only assert
 * the contract is complete and that `route` reads as an assembled served route, not a fixture.
 *
 * The block (placeholder paths):
 *   fidelity:
 *     route: "plateau:/console-board"      # REAL served route (repo:/path), the ASSEMBLED route, not a leaf
 *     host: "plateau:src/app-shell"        # shipped shell that owns chrome
 *     assembledOwner: true                 # OPTIONAL — exactly one child of a sliced UI epic carries it
 *     webcases:
 *       file: "plateau:src/….webcases"
 *       required: [UC-A5, UC-A6]           # the frozen required-set (non-empty)
 *     seeds:                               # empty + overflow MANDATORY; populated optional
 *       empty: "plateau:tests/fixtures/board-empty"
 *       populated: "plateau:tests/fixtures/board-populated"
 *       overflow: "plateau:tests/fixtures/board-overflow"
 *     themes: [light, dark]                # both mandatory
 *     target:
 *       registryId: "mock:console-board@v3"
 *       contentHash: "sha256:…"
 *       authoredInCommit: "<sha>"
 *     baseline:
 *       template: "plateau:tests/visual/baselines/console-board/{seed}.{theme}"
 *
 * Rejects (hard ERROR) — matching the design reference's NOT-READY reasons, restricted to what SHAPE reveals:
 *   • any required field / sub-field absent or empty (incomplete contract)
 *   • `route` that reads as a FIXTURE rather than an assembled served route (a `?demo=`/`?fixture`/query-
 *     string route, or a locus pointing at a leaf source file instead of a `repo:/served/path`)
 *   • `seeds` omitting the mandatory `empty` or `overflow` regime
 *   • `themes` missing `light` or `dark`
 *   • `assembledOwner`, when present, not a boolean
 *
 * Pure: takes the parsed `fidelity` value + an optional `{ id }` label for message prefixes; returns
 * `{ errors, warnings }` arrays of `{ message }` (the convention shared with validateBacklogItem /
 * validateWorkflowInvariants). Fixture-tested in scripts/__tests__/fidelity-contract.test.mjs.
 */

// A repo-qualified served route: a lowercase repo prefix, then `:/` and a non-empty served path.
// `plateau:/console-board` ✓ ; `plateau:src/backlog-view/board.ts` ✗ (a leaf source file, `:s` not `:/`).
const SERVED_ROUTE_RE = /^[a-z][a-z0-9-]*:\/\S*$/;
// Repo-qualified locus (prefix + `:` + any non-empty remainder) — for `host`, whose value is a source locus.
const LOCUS_RE = /^[a-z][a-z0-9-]*:\S+/;
// Fixture markers: a query string (any `?…`), or a `demo`/`fixture` token anywhere in the route.
// `plateau:/console-board?demo=1` ✗, `plateau:/demo-board` ✗, `plateau:/console-board` ✓.
const FIXTURE_ROUTE_RE = /(\?|\bdemo\b|\bfixture\b)/i;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const MANDATORY_SEEDS = ['empty', 'overflow'];
const MANDATORY_THEMES = ['light', 'dark'];
const TARGET_FIELDS = ['registryId', 'contentHash', 'authoredInCommit'];

/**
 * @param fidelity  the parsed `fidelity:` frontmatter value (any shape — this validates it).
 * @param opts.id   optional item id used to prefix messages (e.g. "2805-…").
 * @returns { errors: Array<{message}>, warnings: Array<{message}> }
 */
export function validateFidelityContract(fidelity, { id } = {}) {
  const errors = [];
  const warnings = [];
  const label = id ? `Backlog item "${id}"` : 'fidelity contract';
  const err = (m) => errors.push({ message: `${label} fidelity contract ${m}` });

  if (fidelity === undefined || fidelity === null) {
    err('is absent');
    return { errors, warnings };
  }
  if (typeof fidelity !== 'object' || Array.isArray(fidelity)) {
    err('must be a mapping of the contract fields (route, host, webcases, seeds, themes, target, baseline)');
    return { errors, warnings };
  }

  // ── route — a REAL assembled served route, never a fixture ──
  if (!isNonEmptyString(fidelity.route)) {
    err('is missing required field "route" (the REAL served route, e.g. "plateau:/console-board")');
  } else {
    const route = fidelity.route.trim();
    if (FIXTURE_ROUTE_RE.test(route))
      err(`route "${route}" reads as a FIXTURE, not the assembled real route — it must not carry a query ` +
        `string or a demo/fixture marker (the console-board post-mortem: every story was verified on a ` +
        `\`?demo=\` fixture, never the embedded route). Point it at the served route (e.g. "plateau:/console-board").`);
    else if (!SERVED_ROUTE_RE.test(route))
      err(`route "${route}" is not a repo-qualified served route — it must be "repo:/served/path" (the ` +
        `ASSEMBLED route), not a bare path or a locus pointing at a leaf source file.`);
  }

  // ── host — the shipped shell locus that owns chrome ──
  if (!isNonEmptyString(fidelity.host))
    err('is missing required field "host" (the shipped shell that owns chrome, e.g. "plateau:src/app-shell")');
  else if (!LOCUS_RE.test(fidelity.host.trim()))
    err(`host "${fidelity.host}" must be a repo-qualified locus (e.g. "plateau:src/app-shell")`);

  // ── assembledOwner — OPTIONAL, but must be a boolean when present ──
  if (fidelity.assembledOwner !== undefined && typeof fidelity.assembledOwner !== 'boolean')
    err(`assembledOwner must be a boolean when present (got ${JSON.stringify(fidelity.assembledOwner)})`);

  // ── webcases — a required-set of frozen webcase ids ──
  const wc = fidelity.webcases;
  if (wc === undefined || wc === null || typeof wc !== 'object' || Array.isArray(wc)) {
    err('is missing required block "webcases" (with a "file" and a non-empty "required" list)');
  } else {
    if (!isNonEmptyString(wc.file))
      err('webcases is missing "file" (the .webcases source of the required-set)');
    if (!Array.isArray(wc.required) || wc.required.length === 0)
      err('webcases.required must be a non-empty list of the frozen webcase ids the route must render');
    else if (!wc.required.every(isNonEmptyString))
      err('webcases.required must contain only non-empty webcase ids');
  }

  // ── seeds — the data regimes that break layout; empty + overflow MANDATORY ──
  const seeds = fidelity.seeds;
  if (seeds === undefined || seeds === null || typeof seeds !== 'object' || Array.isArray(seeds)) {
    err('is missing required block "seeds" (must include the mandatory "empty" and "overflow" regimes)');
  } else {
    for (const s of MANDATORY_SEEDS) {
      if (!isNonEmptyString(seeds[s]))
        err(`seeds is missing the mandatory "${s}" regime — ${s === 'empty'
          ? 'the zero-data state'
          : 'the high-cardinality state that collapses the grid'} must be declared (the console-board grid ` +
          `collapse was exactly an un-tested seed regime).`);
    }
  }

  // ── themes — both light and dark mandatory ──
  if (!Array.isArray(fidelity.themes) || fidelity.themes.length === 0) {
    err('is missing required field "themes" (must list both "light" and "dark")');
  } else {
    for (const t of MANDATORY_THEMES)
      if (!fidelity.themes.includes(t))
        err(`themes must include "${t}" — both light and dark are mandatory`);
  }

  // ── target — the independent, registry-anchored design source (INVARIANT A) ──
  const target = fidelity.target;
  if (target === undefined || target === null || typeof target !== 'object' || Array.isArray(target)) {
    err('is missing required block "target" (registryId, contentHash, authoredInCommit)');
  } else {
    for (const f of TARGET_FIELDS)
      if (!isNonEmptyString(target[f]))
        err(`target is missing "${f}" — the registry-anchored design source must name its ${f}`);
  }

  // ── baseline — the committed PNG template per seed × theme ──
  const baseline = fidelity.baseline;
  if (baseline === undefined || baseline === null || typeof baseline !== 'object' || Array.isArray(baseline))
    err('is missing required block "baseline" (with a "template" path per seed × theme)');
  else if (!isNonEmptyString(baseline.template))
    err('baseline is missing "template" (the committed baseline path template, e.g. ".../{seed}.{theme}")');

  return { errors, warnings };
}

export default validateFidelityContract;
