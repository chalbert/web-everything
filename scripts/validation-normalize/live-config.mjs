// Live-config CLI — the fourth thread of the adapter-as-normalization hub (#284, spun off #236's
// `see` leg). Where `see(configsByTool)` runs the comparative model over *fixtures*, this discovers a
// project's OWN ESLint + Oxlint configs in place and runs the very same model over them, then prints
// (or `--json` emits) it.
//
// Zero lock-in by construction: it only ever *reads* the incumbents' own files, writes nothing, and
// leaves no project-facing artifact — run it once and stop, exactly like the hub. It adds only
// discovery + reading on top of the existing engine (index.mjs `see()`); it re-implements none of the
// normalization.
//
// Usage:  node scripts/validation-normalize/live-config.mjs [projectDir] [--json]
//   projectDir  directory to scan for configs (default: cwd)
//   --json      emit the full comparative model as JSON instead of the readable summary

import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { see } from './index.mjs';

// ESLint config files in the platform's own resolution precedence (flat config wins, then eslintrc
// variants, then the package.json key). The first that exists is the project's active ESLint config.
export const ESLINT_CANDIDATES = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  '.eslintrc',
];

export const OXLINT_CANDIDATES = ['.oxlintrc.json', 'oxlint.json', '.oxlintrc'];

/** Merge the `rules` of a flat-config array (or single object) into one rules map (later wins). */
export function flattenFlatConfigRules(exported) {
  const blocks = Array.isArray(exported) ? exported : [exported];
  const rules = {};
  for (const block of blocks) {
    if (block && typeof block === 'object' && block.rules && typeof block.rules === 'object')
      Object.assign(rules, block.rules);
  }
  return { rules };
}

/** Parse a JSON or JSONC-ish config file (strips `//` and `/* *​/` comments — oxlintrc allows them). */
function parseJsonConfig(text) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return JSON.parse(stripped);
}

/**
 * Read one ESLint config file into a shape the eslint adapter ingests (`{ rules }`). Returns
 * `{ config }` on success or `{ error }` if the file can't be read/parsed — never throws, so one
 * unreadable config doesn't sink the whole run (read-only resilience).
 */
export async function readEslintConfigFile(path) {
  try {
    const ext = extname(path);
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || path.includes('eslint.config')) {
      const mod = await import(pathToFileURL(path).href);
      return { config: flattenFlatConfigRules(mod.default ?? mod) };
    }
    if (ext === '.yml' || ext === '.yaml') {
      try {
        const yaml = await import('js-yaml');
        return { config: yaml.load(readFileSync(path, 'utf8')) ?? {} };
      } catch {
        return { error: 'YAML config found but no YAML parser available — skipped' };
      }
    }
    // .json / .eslintrc (JSON) / bare
    return { config: parseJsonConfig(readFileSync(path, 'utf8')) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Read one Oxlint config file (always JSON/JSONC). */
export function readOxlintConfigFile(path) {
  try {
    return { config: parseJsonConfig(readFileSync(path, 'utf8')) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function firstExisting(dir, candidates) {
  for (const name of candidates) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Discover a project's own ESLint + Oxlint configs under `dir`. Returns the `configsByTool` map
 * `see()` consumes, the `sources` actually read (for provenance), and any `notes` (a config present
 * but unreadable, or `package.json#eslintConfig` used as the fallback). Pure discovery — reads only.
 */
export async function discoverConfigs(dir) {
  const sources = {};
  const notes = [];
  const configsByTool = {};

  const eslintPath = firstExisting(dir, ESLINT_CANDIDATES);
  if (eslintPath) {
    const { config, error } = await readEslintConfigFile(eslintPath);
    if (error) notes.push(`eslint: ${eslintPath} — ${error}`);
    else {
      configsByTool.eslint = config;
      sources.eslint = eslintPath;
    }
  } else {
    // Fallback: package.json#eslintConfig (the inline legacy form).
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.eslintConfig) {
          configsByTool.eslint = pkg.eslintConfig;
          sources.eslint = `${pkgPath}#eslintConfig`;
        }
      } catch {
        /* ignore an unreadable package.json — not our file to police */
      }
    }
  }

  const oxlintPath = firstExisting(dir, OXLINT_CANDIDATES);
  if (oxlintPath) {
    const { config, error } = readOxlintConfigFile(oxlintPath);
    if (error) notes.push(`oxlint: ${oxlintPath} — ${error}`);
    else {
      configsByTool.oxlint = config;
      sources.oxlint = oxlintPath;
    }
  }

  return { configsByTool, sources, notes };
}

/** Render the live comparative view as a readable text block. */
export function formatLiveReport({ model, summary, sources, notes }) {
  const lines = [];
  const found = Object.entries(sources);
  if (found.length === 0) {
    lines.push('No ESLint or Oxlint config discovered in this project — nothing to compare.');
    if (notes.length) lines.push('', ...notes.map((n) => `  note: ${n}`));
    return lines.join('\n');
  }

  lines.push('Validation-rules — live comparison of this project’s own lint configs');
  for (const [tool, src] of found) lines.push(`  ${tool}: ${src}`);
  if (notes.length) lines.push(...notes.map((n) => `  note: ${n}`));
  lines.push(
    '',
    `${summary.concerns} concerns · ${summary.active} active in project · ` +
      `${summary.divergences} diverge across tools · ${summary.noEquivalentCells} no-equivalent cells`,
    '',
  );

  for (const concern of model) {
    const flag = concern.activeInProject ? '●' : '○';
    lines.push(`${flag} ${concern.name ?? concern.id}${concern.divergence ? '  (diverges)' : ''}`);
    for (const cell of concern.cells) {
      const state = !cell.covered
        ? 'no equivalent'
        : cell.active
          ? `active (${cell.severity})`
          : `available (${cell.confidence}), not enabled`;
      lines.push(`    ${cell.tool}: ${state}${cell.rule ? ` — ${cell.rule}` : ''}`);
    }
  }
  return lines.join('\n');
}

/** Discover + normalize in one call. */
export async function seeLiveConfigs(dir) {
  const { configsByTool, sources, notes } = await discoverConfigs(dir);
  const { model, summary } = see(configsByTool);
  return { model, summary, sources, notes };
}

// --- CLI entry (run-as-main) ---------------------------------------------------------------------
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const dirArg = args.find((a) => !a.startsWith('--'));
  const dir = dirArg ? (isAbsolute(dirArg) ? dirArg : resolve(process.cwd(), dirArg)) : process.cwd();

  const result = await seeLiveConfigs(dir);
  if (asJson) {
    process.stdout.write(JSON.stringify({ sources: result.sources, notes: result.notes, model: result.model }, null, 2) + '\n');
  } else {
    process.stdout.write(formatLiveReport(result) + '\n');
  }
}
