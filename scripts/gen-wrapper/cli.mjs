#!/usr/bin/env node
/**
 * gen-wrapper CLI (#821) — emit consume-mode per-framework wrappers for every
 * custom-element declaration in the WE CEM (custom-elements.json, derived by gen:cem).
 *
 * Writes `generated/wrappers/<target>/<TagName>.<ext>` per declaration × target. The
 * heavy lifting is the pure generator (genWrapper.mjs); this is the convenience driver the
 * FUI panel (#753) does NOT need (it imports `generateWrapper` directly) but that lets us
 * materialize + diff the artifacts and feed the #506 conformance gate.
 *
 * "Flag, don't fake": today blocks.json carries no `tagName`, so the CEM emits 0
 * custom-element declarations and this writes nothing — it reports that plainly rather
 * than fabricating tags (block-data enrichment tracked in #822).
 *
 * Run: `npm run gen:wrapper`  (add `-- --check` to fail if anything is stale/missing).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TARGETS,
  generateWrapper,
  customElementDeclarations,
  wrapperExtension,
} from './genWrapper.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CEM = join(ROOT, 'custom-elements.json');
const OUT = join(ROOT, 'generated', 'wrappers');
const check = process.argv.includes('--check');

const manifest = JSON.parse(readFileSync(CEM, 'utf8'));
const decls = customElementDeclarations(manifest);

if (decls.length === 0) {
  console.log(
    '✓ gen:wrapper — 0 custom-element declarations in custom-elements.json ' +
      '(no block carries a `tagName` yet; CEM emits class declarations only — see #822). Nothing emitted.',
  );
  process.exit(0);
}

const planned = [];
for (const { declaration } of decls) {
  for (const target of TARGETS) {
    const file = join(OUT, target, `${declaration.name}.${wrapperExtension(target)}`);
    planned.push({ file, source: generateWrapper(declaration, target) });
  }
}

if (check) {
  const stale = planned.filter((p) => !existsSync(p.file) || readFileSync(p.file, 'utf8') !== p.source);
  if (stale.length) {
    console.error(`✗ gen:wrapper --check — ${stale.length} wrapper(s) stale or missing. Run \`npm run gen:wrapper\`.`);
    stale.forEach((p) => console.error('  ' + p.file.replace(ROOT + '/', '')));
    process.exit(1);
  }
  console.log(`✓ gen:wrapper --check — ${planned.length} wrapper(s) up to date.`);
  process.exit(0);
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
for (const { file, source } of planned) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
}
console.log(`✓ gen:wrapper — wrote ${planned.length} wrapper(s) for ${decls.length} block(s) × ${TARGETS.length} target(s).`);
