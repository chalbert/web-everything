/**
 * @file scripts/__tests__/workflow-meta-launchable.test.mjs
 * @description Proof of `scripts/lib/workflow-meta.mjs` — the core that decides whether a Workflow harness
 * script is LAUNCHABLE — plus the live sweep over every harness in the repo.
 *
 * The WHY, the runtime-model caveat, and the "when in doubt leave a kind out" rule all live in the module's own
 * header, single-sourced. Read that first.
 *
 * WHAT THIS FILE IS AND IS NOT. These are UNIT tests over pure functions. They are NOT an integration test, and
 * cannot be: the validator being modelled lives in the Workflow runtime and is not importable here. A green run
 * means the meta matches OUR MODEL of the runtime's rule; only a real launch proves the runtime agrees.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  metaPurity, metaKeys, checkWorkflowMeta, declaresMetaExport,
  REQUIRED_META_KEYS, WORKFLOW_HARNESS_ROOTS,
} from '../lib/workflow-meta.mjs';

/**
 * Every harness script under `roots`. Selection is by PARSE (`metaPurity(...).found`), never by a text match:
 * `src.includes('export const meta')` skipped `const meta = {…}; export { meta };` entirely, so an unlaunchable
 * file in that spelling was never scanned — the same reason-about-characters mistake the module argues against.
 */
function harnessScripts() {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(mjs|js)$/.test(e)) continue;
      let src; try { src = readFileSync(p, 'utf8'); } catch { continue; }
      if (metaPurity(src, p).found) out.push({ path: p, src });
    }
  };
  for (const r of WORKFLOW_HARNESS_ROOTS) walk(resolve(process.cwd(), r));
  return out;
}

describe('Workflow harness scripts must be launchable (pure-literal meta)', () => {
  const scripts = harnessScripts();

  it('finds the harness scripts at all (guards against a silently-empty sweep)', () => {
    // A test that scans nothing passes vacuously — the exact failure shape this file exists to catch.
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.some((s) => s.path.endsWith('review-parked-prs.mjs'))).toBe(true);
  });

  it.each(harnessScripts().map((s) => [s.path.replace(`${process.cwd()}/`, ''), s]))(
    '%s — launchable: pure-literal meta declaring the required fields',
    (_name, script) => {
      const r = checkWorkflowMeta(script.src, script.path);
      expect(r.found, 'no exported meta found').toBe(true);
      expect(r.impure, `meta is not a pure literal: ${r.impure.join(' | ')}`).toEqual([]);
      expect(r.missingKeys, `meta is missing required field(s): ${r.missingKeys.join(', ')}`).toEqual([]);
    },
  );
});

describe('metaPurity — the guard catches the CLASS, not one spelling', () => {
  const cases = {
    'string concatenation, same quotes': "export const meta = { name: 'a', description: 'x' + 'y' };",
    'string concatenation, mixed quotes across lines': "export const meta = { name: 'a', description: 'x' +\n \"y\" };",
    'concatenation with an identifier': "export const meta = { name: 'a', description: 'x ' + SUFFIX };",
    'a call expression': "export const meta = { name: 'a', phases: buildPhases() };",
    'template interpolation': 'export const meta = { name: `a${x}` };',
    'a spread': "export const meta = { name: 'a', ...rest };",
    'a bare identifier value': 'export const meta = { name: NAME };',
    'a member expression': 'export const meta = { name: cfg.name };',
    // The runtime walks the property NAME like any other node, so a computed key is an arbitrary expression in
    // name position. Exempting "names" wholesale let both of these read as pure.
    'a computed key': "export const meta = { [KEY]: 'x', name: 'a', description: 'b' };",
    'a computed key built by a call': "export const meta = { [f()]: 'x', name: 'a', description: 'b' };",
    'a computed key built by concatenation': "export const meta = { ['p' + X]: 'x', name: 'a', description: 'b' };",
  };
  for (const [label, src] of Object.entries(cases)) {
    it(`rejects: ${label}`, () => {
      const { found, impure } = metaPurity(src);
      expect(found).toBe(true);
      expect(impure.length, `expected ${label} to be rejected`).toBeGreaterThan(0);
    });
  }

  it('accepts a genuinely pure literal — including a prose ellipsis, which the regex guard false-flagged', () => {
    const src = "export const meta = {\n  name: 'a',\n  description: 'first... then second',\n  phases: [{ title: 'T', detail: 'd' }],\n  n: 1, ok: true, none: null,\n};";
    expect(metaPurity(src)).toEqual({ found: true, impure: [] });
  });

  it('does not false-flag launchable forms the runtime accepts', () => {
    expect(metaPurity("export const meta = { name: 'a', n: -1 };").impure).toEqual([]);
    expect(metaPurity("export const meta = ({ name: 'a' });").impure).toEqual([]);
    expect(metaPurity('export const meta = { name: "double-quoted" };').impure).toEqual([]);
    expect(metaPurity("export const meta = { 'quoted-key': 'a', 0: 'b' };").impure).toEqual([]);
  });

  it('still rejects a negated IDENTIFIER (only a negated numeric literal is pure)', () => {
    expect(metaPurity("export const meta = { name: 'a', n: -SOME_CONST };").impure.length).toBeGreaterThan(0);
  });

  it('reports found:false rather than passing vacuously when there is no exported meta', () => {
    expect(metaPurity('const x = 1;').found).toBe(false);
  });
});

describe('findExportedMeta — the EXPORTED meta, in either spelling', () => {
  it('reads the exported meta, not a shadowing local', () => {
    // A function-local `const meta` used to win, so an unlaunchable exported meta read as pure.
    const src = "function f(){ const meta = { name: 'ok' }; return meta; }\nexport const meta = { name: 'x' + 'y' };";
    const r = metaPurity(src);
    expect(r.found).toBe(true);
    expect(r.impure.length, 'the shadowing local hid an unlaunchable exported meta').toBeGreaterThan(0);
  });

  it('handles `const meta = {…}; export { meta };` — the spelling the text-match sweep skipped entirely', () => {
    const src = "const meta = { name: 'a', description: 'x' + 'y' };\nexport { meta };";
    const r = metaPurity(src);
    expect(r.found, 'this spelling was invisible to the old selector').toBe(true);
    expect(r.impure.length).toBeGreaterThan(0);
  });

  it('a non-exported meta is not a harness at all', () => {
    expect(metaPurity("const meta = { name: 'a' };").found).toBe(false);
  });
});

describe('the found/not-found axis must not default LOOSE (PR #1037 r2, finding A)', () => {
  // The dangerous direction is accepting what the runtime rejects. Three export spellings used to return
  // `found: false` and be silently skipped by the gate, and one of them returned an affirmative `ok: true` on
  // an unlaunchable harness — worse than a skip, because it reads as a pass.

  it('resolves `export { built as meta }` through the ALIAS to its real local', () => {
    const src = "const built = { name: 'a', description: 'x' + 'y' };\nexport { built as meta };";
    const r = checkWorkflowMeta(src);
    expect(r.found, 'the alias was not resolved').toBe(true);
    expect(r.impure.length, 'the aliased meta is unlaunchable and must be reported').toBeGreaterThan(0);
    expect(r.ok).toBe(false);
  });

  it('the DECOY case: an unrelated pure `const meta` must not launder an impure aliased export', () => {
    // Previously: the lookup was by the exported NAME, so it found this decoy and returned ok:true.
    const src = [
      "const meta = { name: 'decoy', description: 'pure' };",
      "const built = { name: 'a', description: 'x' + 'y' };",
      'export { built as meta };',
    ].join('\n');
    const r = checkWorkflowMeta(src);
    expect(r.ok, 'the decoy laundered an unlaunchable harness into a PASS').toBe(false);
    expect(r.impure.length).toBeGreaterThan(0);
  });

  it('an UNRESOLVABLE meta export is reported as unreadable, never as "not a harness"', () => {
    for (const [label, src] of Object.entries({
      'export default': "export default { name: 'a', description: 'x' + 'y' };",
      'late assignment': "export let meta;\nmeta = { name: 'a', description: 'x' + 'y' };",
      're-export from elsewhere': "export { meta } from './other.mjs';",
    })) {
      const r = checkWorkflowMeta(src);
      expect(r.found, `${label}: should not resolve`).toBe(false);
      expect(r.unreadable, `${label}: must be flagged unreadable so the gate can be LOUD`).toBe(true);
      expect(r.ok).toBe(false);
    }
  });

  it('a file with no meta export at all is genuinely not a harness (not "unreadable")', () => {
    const r = checkWorkflowMeta("export const other = 1;\nconst meta = { name: 'local-only' };");
    expect(r.found).toBe(false);
    expect(r.unreadable, 'a non-harness must stay silent, or every source file errors').toBe(false);
  });

  it('declaresMetaExport separates "exports meta" from "we could read it"', () => {
    expect(declaresMetaExport("export const meta = { name: 'a' };")).toBe(true);
    expect(declaresMetaExport('export { built as meta };')).toBe(true);
    expect(declaresMetaExport('export default {};')).toBe(true);
    expect(declaresMetaExport("const meta = { name: 'a' };")).toBe(false);
  });
});

describe('metaKeys / checkWorkflowMeta — required fields, read off the AST', () => {
  it('reads the declared keys in any quoting', () => {
    expect(metaKeys("export const meta = { name: 'a', description: 'b' };")).toEqual(['name', 'description']);
    expect(metaKeys('export const meta = { "name": "a", description: `b` };')).toEqual(['name', 'description']);
    // the regex form this replaced passed on an unrelated `name:` elsewhere in the file
    expect(metaKeys("const other = { name: 'x' };\nexport const meta = { description: 'b' };")).toEqual(['description']);
  });

  it('a computed key contributes no name (it is not statically known)', () => {
    expect(metaKeys("export const meta = { [KEY]: 'x', name: 'a', description: 'b' };")).toEqual(['name', 'description']);
  });

  it('reports every missing required field', () => {
    expect(checkWorkflowMeta("export const meta = { name: 'a', description: 'b' };").missingKeys).toEqual([]);
    expect(checkWorkflowMeta("export const meta = { name: 'a' };").missingKeys).toEqual(['description']);
    expect(checkWorkflowMeta("export const meta = { phases: [] };").missingKeys).toEqual(REQUIRED_META_KEYS);
  });

  it('ok is true only when found, pure, and complete', () => {
    expect(checkWorkflowMeta("export const meta = { name: 'a', description: 'b' };").ok).toBe(true);
    expect(checkWorkflowMeta("export const meta = { name: 'a', description: 'x' + 'y' };").ok).toBe(false);
    expect(checkWorkflowMeta("export const meta = { name: 'a' };").ok).toBe(false);
    expect(checkWorkflowMeta('const x = 1;').ok).toBe(false);
  });
});
