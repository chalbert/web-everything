#!/usr/bin/env node
/**
 * conformance-autofix.mjs — the conformance auto-fix agent CLI (backlog #095).
 *
 * Wires the pure {@link file://./autofix/engine.mjs} loop to the REAL suite: it reads failures from
 * `check:standards --json`, lets registered fixers propose patches, applies them, and re-runs the
 * suite — keeping a patch ONLY if its target failure cleared and introduced no new error (the
 * verify gate / #089 propose-and-verify moat). Loops until green or nothing fixable remains.
 *
 * Usage:
 *   node scripts/conformance-autofix.mjs            # apply verify-gated fixes, then report
 *   node scripts/conformance-autofix.mjs --dry-run  # list fixable failures + proposed patches, write nothing
 *
 * AI is a swappable provider: this CLI registers only the deterministic *reference* fixers. A
 * BYO-key model fixer for content-generation classes (e.g. missing-description) registers into the
 * same `fixerRegistry` — see the engine header.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { autofix, fixerRegistry, registerReferenceFixers } from './autofix/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = join(ROOT, 'scripts/check-standards.mjs');
const DRY = process.argv.includes('--dry-run');

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', CYA = '\x1b[36m', RST = '\x1b[0m';

registerReferenceFixers();

/** Re-run the suite in JSON mode and return its structured failures (exit 1 still prints JSON). */
function runSuite() {
  let out;
  try {
    out = execFileSync('node', [CHECK, '--json'], { encoding: 'utf8' });
  } catch (e) {
    out = e.stdout; // non-zero exit (errors present) still emits the JSON report on stdout
  }
  const parsed = JSON.parse(out);
  return { ok: parsed.ok, failures: parsed.errors };
}

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const write = (rel, content) => writeFileSync(join(ROOT, rel), content);

const initial = runSuite();
console.log(`${DIM}conformance-autofix — Web Everything${RST}`);

if (initial.ok) {
  console.log(`${GRN}✓ check:standards is already green — nothing to fix.${RST}`);
  process.exit(0);
}

const fixable = initial.failures.filter((f) => fixerRegistry.resolve(f));
console.log(`${DIM}${initial.failures.length} error(s); ${fixable.length} match a registered fixer (${fixerRegistry.ids().join(', ')}).${RST}`);

if (!fixable.length) {
  console.log(`${YEL}No auto-fixable failures. The remaining errors need a fixer this build doesn't have:${RST}`);
  for (const f of initial.failures) console.log(`  ${DIM}-${RST} ${f.message}`);
  process.exit(1);
}

if (DRY) {
  console.log(`${CYA}Dry run — would attempt ${fixable.length} fix(es) (verify-gated, nothing written):${RST}`);
  for (const f of fixable) {
    const fixer = fixerRegistry.resolve(f);
    let patch = null;
    try { patch = await fixer.fix(f, { read }); } catch (e) { patch = { summary: `(fixer threw: ${e.message})` }; }
    console.log(`  ${DIM}-${RST} [${fixer.id}] ${patch ? patch.summary : '(no safe patch)'}`);
  }
  process.exit(0);
}

const result = await autofix({ verify: runSuite, read, write, registry: fixerRegistry });

for (const a of result.applied) console.log(`${GRN}  fixed${RST} ${a.summary} ${DIM}(${a.fixerId}, ${a.file})${RST}`);
for (const g of result.gaveUp) console.log(`${YEL}  reverted${RST} ${g.failure.message} ${DIM}— ${g.reason}${RST}`);
for (const s of result.skipped) console.log(`${DIM}  skipped${RST} ${s.message} ${DIM}(no registered fixer)${RST}`);

const tail = result.ok ? `${GRN}✓ suite green` : `${RED}✗ ${result.skipped.length + result.gaveUp.length} failure(s) remain`;
console.log(
  `\n${tail}${RST} ${DIM}— ${result.applied.length} fixed, ${result.gaveUp.length} reverted, ` +
  `${result.skipped.length} skipped, ${result.rounds} verify round(s).${RST}`,
);
process.exit(result.ok ? 0 : 1);
