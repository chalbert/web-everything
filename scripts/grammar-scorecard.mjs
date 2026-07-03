/**
 * grammar-scorecard.mjs — the WE-side driver for the **grammar-fidelity scorecard** (#2113), the #2024
 * conformance-harness analogue for the #2094 framework-flavored delimiter bundles.
 *
 * Where `parity-conformance.mjs` scores a *theme flavor* against a design system's roles, this scores a
 * **delimiter bundle** (a set of #2074 `CustomNode` recipes) against a framework's **construct checklist**,
 * grading each construct reproduced / partial / out-of-scope-per-statute / gap and emitting the **gap
 * list** — the real deliverable of the parity program.
 *
 * **Consumer-at-birth (#2113):** scores FUI's own native grammar — the mustache `{{ }}` + polymer `[[ ]]`
 * interpolation recipes (`frontierui:plugs/webnodes/recipes/interpolationRecipes.ts`) — as **bundle zero**:
 *   1. against its own native checklist → 100% self-consistency (nothing to gap);
 *   2. against a Handlebars checklist → the gap list that seeds the Handlebars/Mustache bundle (#2114).
 *
 * ## How the bytes cross the WE→FUI boundary (#1731 `we-data-crosses-via-fui-served-route`)
 *
 * WE's build **cannot** `import '@frontierui'` (the #700/#239 build-import ban). Exactly as
 * `parity-conformance.mjs` / `scripts/lib/token-css.mjs` do, this transpiles the real FUI scorer +
 * bundle-zero recipes with esbuild (bundled to one ESM, imported via a `data:` URL) rather than depending
 * on the package or duplicating the scorer — resolution stays the FUI SoT, never a re-implementation.
 * Consumption is **detect-or-skip**: without `../frontierui` (CI with no sibling repo) the script exits 0
 * with a skip notice, so a WE-only tree never fails on FUI's absence.
 *
 * ## Boundary
 *
 * WE holds ZERO impl (#1282): the scorer + recipes live in FUI. WE owns only the grammar *checklist* data
 * (`we:design-systems/grammars/*.grammar.json`) and the emitted *report* (`we:reports/…`).
 *
 * Usage:
 *   node scripts/grammar-scorecard.mjs                 # score bundle zero vs. fui-native + handlebars
 *   node scripts/grammar-scorecard.mjs --check         # re-emit and fail if the on-disk report drifts
 *
 * @module grammar-scorecard
 */
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRAMMARS = join(ROOT, 'design-systems', 'grammars');
const REPORTS = join(ROOT, 'reports');
const FUI_WEBNODES = join(ROOT, '..', 'frontierui', 'plugs', 'webnodes');

/** ISO date (UTC) for the report filename, e.g. `2026-07-02`. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Per-flavor bundle files to try importing alongside bundle-zero. Each entry is a
 * `{ file, exports }` pair: `file` is relative to `FUI_WEBNODES/recipes/`; `exports` is the
 * named-export string for the esbuild entry. A bundle file is OPTIONAL — if the FUI PR hasn't
 * landed yet, the file is simply absent and the grammar falls back to bundle-zero scoring (gap-list
 * mode). This makes the scorecard detect-or-skip per-bundle, not just per-FUI.
 */
const FLAVOR_BUNDLE_FILES = [
  {
    file: 'recipes/liquidJinjaBundle.ts',
    exports:
      'export { LiquidJinjaInterpolationNode, LiquidJinjaForRegionNode, LiquidJinjaIfRegionNode, LiquidJinjaBlockRegionNode, LiquidJinjaRawRegionNode, LiquidJinjaCommentRegionNode, JinjaInlineCommentNode }',
  },
];

/**
 * Transpile + import the FUI scorer, bundle-zero recipes, AND any present per-flavor bundles (#2114+),
 * all in one ESM. Returns null when `../frontierui` is absent (detect-or-skip), so the caller skips
 * rather than failing. Per-flavor bundle files are conditionally included — if a bundle file doesn't
 * exist yet in FUI (the FUI PR is still pending), it is simply skipped (detect-or-skip per-bundle).
 */
async function loadScorer() {
  if (!existsSync(FUI_WEBNODES)) return null;

  // Conditionally include per-flavor bundle exports — only if the bundle file exists in FUI.
  // This makes the scorecard resilient to partial FUI trees (WE PR landed before FUI PR).
  const presentBundles = FLAVOR_BUNDLE_FILES.filter((b) =>
    existsSync(join(FUI_WEBNODES, b.file)),
  );
  const bundleExports = presentBundles
    .map((b) => `${b.exports} from './${b.file}';`)
    .join('');

  const res = await build({
    stdin: {
      contents:
        "export { scoreGrammar, renderGrammarReport, formatFidelity } from './grammarScorecard.ts';" +
        "export { MustacheInterpolationNode, PolymerInterpolationNode } from './recipes/interpolationRecipes.ts';" +
        // Per-flavor bundles — conditionally appended (only if the file exists in FUI).
        bundleExports,
      resolveDir: FUI_WEBNODES,
      sourcefile: 'fui-grammar-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    // The bundle recipes extend `Text`/`RegionNode`/`MarkerNode` (polyfill hosts evaluated at class
    // definition). The scorer only reads their *static* config — never instantiates — so minimal
    // DOM globals are enough for the class bodies to load in plain Node (no real DOM needed).
    banner: {
      js: [
        'if (typeof globalThis.Text === "undefined") { globalThis.Text = class Text {}; }',
        'if (typeof globalThis.MutationObserver === "undefined") { globalThis.MutationObserver = class MutationObserver { constructor(cb){} observe(){} disconnect(){} }; }',
      ].join('\n'),
    },
  });
  const code = res.outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

/** Read + parse a grammar checklist under `we:design-systems/grammars/`, or throw a clear error. */
function readGrammar(name) {
  const path = join(GRAMMARS, `${name}.grammar.json`);
  if (!existsSync(path)) throw new Error(`grammar-scorecard — missing WE data file: design-systems/grammars/${name}.grammar.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * The single combined fidelity report body: a program header, then one scorer-rendered section per scored
 * grammar. Emitting ONE report (referenced by #2113's `relatedReport`) keeps it visible on the site (§6e
 * reports-not-hidden) and puts bundle zero's self-consistency proof beside its first real gap list. Every
 * code-path reference carries a `we:`/`frontierui:` locus prefix (#883/#884).
 */
function combinedReport(scored) {
  const header = [
    '# Delimiter-bundle grammar-fidelity scores (#2113)',
    '',
    '**Program:** framework-flavored delimiter bundles (#2094) — reproduce popular template languages as',
    'ready-made authoring styles over the #2074 `CustomNode` recipe model, each scored on faithful',
    'reproduction with the **gap list** as the real deliverable (the #2024 analogue for delimiter grammars).',
    '**Scorer:** `frontierui:plugs/webnodes/grammarScorecard.ts` `scoreGrammar` — a single, framework-agnostic',
    'scorer. All framework knowledge is the WE-owned checklists (`we:design-systems/grammars/*.grammar.json`);',
    'there is **no per-framework code**. Each construct scores exactly one of **reproduced** (recipe',
    'delimiter + nature match) / **partial** (delimiter claimed, nature diverges) / **out-of-scope** (a',
    'concern the #2074 statute does not own — attribute-keyed → #1986 registry, attribute-value',
    'interpolation → sibling surface) / **gap** (the recipe model cannot express it — the standard increment).',
    '**Bundle zero (consumer-at-birth):** FUI’s own native grammar — the mustache `{{ }}` + polymer `[[ ]]`',
    'interpolation recipes (`frontierui:plugs/webnodes/recipes/interpolationRecipes.ts`).',
    '**Re-derivable:** `we:scripts/grammar-scorecard.mjs` re-emits this report; `--check` fails the gate on drift.',
    '',
    '> Bundle zero scores **100%** against its own native checklist (self-consistency — nothing to gap), and',
    '> exposes its real gaps only when scored against a *framework* checklist (Handlebars, Vue, etc. below):',
    '> regions, raw/unescaped output, partials, comments — the concrete increments the per-flavor bundle',
    '> stories (#2114–#2119) grow, and the mid-region-marker gap (`{{else}}`) whose decision card the first',
    '> confirming gap list earns (not a guess). Vue is the firewall proof (#2119): its delimiter surface is',
    '> only `{{ }}` text interpolation — every other construct is attribute-keyed, out-of-scope per #2074.',
    '',
    '',
  ].join('\n');
  const summary = [
    '## Summary',
    '',
    '| checklist | fidelity | reproduced / scorable | out-of-scope |',
    '| --- | --- | --- | --- |',
    ...scored.map(
      (s) =>
        `| ${s.result.framework} | ${s.formatted} | ${s.result.reproduced} / ${s.result.scorable} | ${s.result.total - s.result.scorable} |`,
    ),
    '',
  ].join('\n');
  const sections = scored
    .map((s) => `> Checklist data: \`we:design-systems/grammars/${s.name}.grammar.json\`.\n\n${s.rendered}`)
    .join('\n\n---\n\n');
  return header + summary + '\n' + sections + '\n';
}

/**
 * The per-flavor bundles that have been built (#2115+). Each entry maps a grammar checklist name to
 * its FUI bundle (the recipe classes). When a bundle is not yet built (its file is absent from FUI —
 * e.g., the FUI PR is still pending), the bundle entry is `null` and the grammar falls back to
 * bundle-zero scoring (gap-list mode). When the bundle is present it is scored against its own
 * checklist (fidelity-proof mode). The two passes serve different purposes — the gap list is the
 * real deliverable; the fidelity proof is the acceptance gate.
 */
function builtBundles(scorer) {
  // Guard: only include a bundle entry when ALL its exports are present in the scorer module.
  // If the bundle file was absent from FUI (detect-or-skip per-bundle in loadScorer), the
  // named exports are undefined — treat that as "not yet built" and fall back to bundle zero.
  const liquidJinja =
    scorer.LiquidJinjaInterpolationNode &&
    scorer.LiquidJinjaForRegionNode &&
    scorer.LiquidJinjaIfRegionNode &&
    scorer.LiquidJinjaBlockRegionNode &&
    scorer.LiquidJinjaRawRegionNode &&
    scorer.LiquidJinjaCommentRegionNode &&
    scorer.JinjaInlineCommentNode
      ? [
          scorer.LiquidJinjaInterpolationNode,
          scorer.LiquidJinjaForRegionNode,
          scorer.LiquidJinjaIfRegionNode,
          scorer.LiquidJinjaBlockRegionNode,
          scorer.LiquidJinjaRawRegionNode,
          scorer.LiquidJinjaCommentRegionNode,
          scorer.JinjaInlineCommentNode,
        ]
      : null;
  return { 'liquid-jinja': liquidJinja };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const names = args.filter((a) => !a.startsWith('--'));
  const checklists = names.length ? names : ['fui-native', 'handlebars', 'liquid-jinja', 'vue', 'angular'];

  const scorer = await loadScorer();
  if (!scorer) {
    console.log('grammar-scorecard — ../frontierui not found; skipped (detect-or-skip). Clone FUI next to WE for the score.');
    return;
  }

  // Bundle zero: FUI's native grammar — the two shipped interpolation recipes.
  const bundleZero = [scorer.MustacheInterpolationNode, scorer.PolymerInterpolationNode];
  // Per-flavor bundles that have been built: scored against their own checklist (fidelity proof).
  const built = builtBundles(scorer);

  const scored = checklists.map((name) => {
    const reference = readGrammar(name);
    // If a per-flavor bundle exists for this grammar (non-null), score it (fidelity proof);
    // otherwise score bundle zero against the checklist (gap-list mode — seeds the bundle story).
    // `null` means the bundle file is absent from FUI (FUI PR not yet landed): fall back gracefully.
    const bundle = built[name] ?? bundleZero;
    const result = scorer.scoreGrammar(bundle, reference);
    return {
      name,
      result,
      formatted: scorer.formatFidelity(result.score),
      rendered: scorer.renderGrammarReport(result),
    };
  });

  const path = join(REPORTS, `${today()}-delimiter-bundle-grammar-fidelity.md`);
  const body = combinedReport(scored);
  const rel = path.replace(ROOT + '/', '');

  if (check) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current !== body) {
      console.error(`  drift  ${rel} is stale — re-run 'node scripts/grammar-scorecard.mjs'`);
      process.exit(1);
    }
    for (const s of scored) console.log(`  ok     ${s.name}: ${s.formatted} (${s.result.reproduced}/${s.result.scorable})`);
  } else {
    writeFileSync(path, body);
    for (const s of scored) console.log(`  scored ${s.name}: ${s.formatted} (${s.result.reproduced}/${s.result.scorable})`);
    console.log(`  wrote  → ${rel}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
