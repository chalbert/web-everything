/**
 * parity-conformance.mjs — the WE-side driver for the **design-system parity conformance harness**
 * (#2024), the repeatable *compliance score* for the reproduction-conformance program (#1226 / #1225).
 *
 * The parity claim — *"the difference between any two top design systems is theme tokens + intents and
 * nothing else"* — is scored, not eyeballed, by the FUI harness (`fui:plugs/webtheme/conformanceHarness.ts`
 * `scoreFlavor`). This script is the "invoke it from WE like the data-table hook" half: it loads a flavor's
 * manifest + resolved token sidecar + reference set from `we:design-systems/`, runs them through the FUI
 * harness, and emits a per-flavor compliance report under `we:reports/…`.
 *
 * ## How the bytes cross the WE→FUI boundary (#1731 `we-data-crosses-via-fui-served-route`)
 *
 * WE's build **cannot** `import '@frontierui'` (the #700/#239 build-import ban). Exactly as
 * `scripts/lib/token-css.mjs` does, this transpiles the real FUI harness TS with esbuild (bundled to one
 * ESM, imported via a `data:` URL) rather than depending on the package or duplicating the scorer — the
 * resolution stays the FUI SoT, never a re-implementation. Consumption is **detect-or-skip**: without
 * `../frontierui` (CI with no sibling repo) the script exits 0 with a skip notice, so a WE-only tree never
 * fails on FUI's absence.
 *
 * ## Boundary
 *
 * WE holds ZERO impl (#1282): the scorer lives in FUI. WE owns only the flavor *data* (the manifest,
 * token sidecar, and reference set under `we:design-systems/`) and the emitted *report*.
 *
 * Usage:
 *   node scripts/parity-conformance.mjs [flavor ...]   # default: shadcn material-like
 *   node scripts/parity-conformance.mjs --check        # re-emit and fail if any on-disk report drifts
 *
 * @module parity-conformance
 */
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_SYSTEMS = join(ROOT, 'design-systems');
const REPORTS = join(ROOT, 'reports');
const FUI_WEBTHEME = join(ROOT, '..', 'frontierui', 'plugs', 'webtheme');

/** ISO date (UTC) for the report filename, e.g. `2026-07-02`. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Transpile + import the FUI conformance harness once. Returns null when `../frontierui` is absent
 * (detect-or-skip), so the caller skips rather than failing.
 */
async function loadHarness() {
  if (!existsSync(FUI_WEBTHEME)) return null;
  const res = await build({
    stdin: {
      contents:
        "export { scoreFlavor, renderComplianceReport, formatScore } from './conformanceHarness.ts';",
      resolveDir: FUI_WEBTHEME,
      sourcefile: 'fui-conformance-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = res.outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

/** Read + parse a JSON file under `we:design-systems/`, or throw a clear error naming the missing file. */
function readJson(file) {
  const path = join(DESIGN_SYSTEMS, file);
  if (!existsSync(path)) throw new Error(`parity-conformance — missing WE data file: design-systems/${file}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Assemble a resolved manifest object for the FUI loader from a flavor's `we:design-systems/*` files.
 * The on-disk `*.designsystem.json` references its token sidecar by a relative `themeTokens` path (a
 * *sidecar path* the loader expects the caller to resolve — #2017); this reads + inlines it so the FUI
 * loader receives a resolved DTCG document and imports no design-system-specific file itself.
 */
function loadFlavor(flavor) {
  const manifest = readJson(`${flavor}.designsystem.json`);
  const reference = readJson(`${flavor}.reference.json`);
  let themeTokens = {};
  if (typeof manifest.themeTokens === 'string') {
    // Resolve the sidecar relative to design-systems/ (paths are authored as `./x.tokens.json`).
    themeTokens = readJson(manifest.themeTokens.replace(/^\.\//, ''));
    // Drop the DTCG `$description` meta nodes — they are documentation, not token groups.
  } else if (manifest.themeTokens && typeof manifest.themeTokens === 'object') {
    themeTokens = manifest.themeTokens;
  }
  const resolved = { extends: manifest.extends, themeTokens, intentDefaults: manifest.intentDefaults, traitDefaults: manifest.traitDefaults };
  return { manifest: resolved, reference };
}

/**
 * The single combined compliance report body: a program header, then one harness-rendered score section
 * per scored flavor. Emitting ONE report (referenced by #2024's `relatedReport`) keeps it visible on the
 * site (§6e reports-not-hidden) and puts the target-agnostic proof — two flavors, one harness, one
 * artifact — side by side. Every code-path reference carries a `we:`/`frontierui:` locus prefix (#883/#884).
 */
function combinedReport(scored) {
  const header = [
    '# Design-system parity compliance scores (#2024)',
    '',
    '**Program:** reproduction-conformance (#1226 / #1225) — *"the difference between any two top design',
    'systems is theme tokens + intents and nothing else."*',
    '**Harness:** `frontierui:plugs/webtheme/conformanceHarness.ts` `scoreFlavor` — a single, target-agnostic',
    'scorer. All target knowledge is the WE-owned reference sets (`we:design-systems/*.reference.json`); there',
    'is **no per-system code** (the #2024 acceptance-2 proof is the two flavors below scored through the *same*',
    'function). The scorer reuses the #2017 manifest loader, so the scoring path is the injection path — not a',
    'parallel re-implementation.',
    '**Flavor data (WE-owned):** for each flavor, a `we:design-systems/` manifest + its DTCG token sidecar',
    '+ reference set (`.designsystem` / `.tokens` / `.reference` JSON).',
    '**Re-derivable:** `we:scripts/parity-conformance.mjs` (`npm run parity:score`) re-emits this report;',
    '`npm run parity:check` fails the gate on drift.',
    '',
    '> A role scores as *reproduced* only when its DTCG path both bridges to a legacy slot AND that slot is',
    '> aliased (so a scoped override reaches the `var(--…)` a component reads — #2026/#2049) AND the resolved',
    '> value actually differs from the platform default — a token-name lookalike or a no-op override never',
    '> inflates the score (the naming-fork precedent). Everything else is a gap: the concrete increment the',
    '> reproduction-conformance standard (#1226) must grow.',
    '',
    '',
  ].join('\n');
  const summary = [
    '## Summary',
    '',
    '| flavor | compliance | reproduced / total |',
    '| --- | --- | --- |',
    ...scored.map((s) => `| ${s.reference.target} | ${s.formatted} | ${s.result.reproduced} / ${s.result.total} |`),
    '',
  ].join('\n');
  const sections = scored
    .map((s) => `> Flavor data: \`we:design-systems/${s.flavor}.*\`.\n\n${s.rendered}`)
    .join('\n\n---\n\n');
  return header + summary + '\n' + sections + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const flavors = args.filter((a) => !a.startsWith('--'));
  const targets = flavors.length ? flavors : ['shadcn', 'material-like'];

  const harness = await loadHarness();
  if (!harness) {
    console.log('parity-conformance — ../frontierui not found; skipped (detect-or-skip). Clone FUI next to WE for the score.');
    return;
  }

  const scored = targets.map((flavor) => {
    const { manifest, reference } = loadFlavor(flavor);
    const result = harness.scoreFlavor(manifest, reference);
    return {
      flavor,
      reference,
      result,
      formatted: harness.formatScore(result.score),
      rendered: harness.renderComplianceReport(result),
    };
  });

  const path = join(REPORTS, `${today()}-parity-compliance.md`);
  const body = combinedReport(scored);
  const rel = path.replace(ROOT + '/', '');

  if (check) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current !== body) {
      console.error(`  drift  ${rel} is stale — re-run 'npm run parity:score'`);
      process.exit(1);
    }
    for (const s of scored) console.log(`  ok     ${s.flavor}: ${s.formatted} (${s.result.reproduced}/${s.result.total})`);
  } else {
    writeFileSync(path, body);
    for (const s of scored) console.log(`  scored ${s.flavor}: ${s.formatted} (${s.result.reproduced}/${s.result.total})`);
    console.log(`  wrote  → ${rel}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
