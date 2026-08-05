/**
 * @file scripts/__tests__/workflow-meta-launchable.test.mjs
 * @description Every Workflow harness script must be LAUNCHABLE. The runtime requires `export const meta` to be
 * a PURE LITERAL — no variables, calls, spreads or string concatenation — and rejects the script at validation
 * time, before a single agent is spawned.
 *
 * WHY THIS TEST EXISTS. `scripts/workflows/review-parked-prs.mjs` — the editor↔reviewer convergence loop that
 * reviews every drain-parked PR (#2639, the linchpin of the autonomous review chain) — built its
 * `meta.description` by concatenating string fragments across lines. It was therefore **unlaunchable from the
 * day it was written**, and nobody noticed, because the failure is silent in the only way that matters: it never
 * ran, so it never produced a wrong answer. It just produced nothing.
 *
 * The cost of that was not one broken script. Three layers sat on top of it: the durable jury ledger had no
 * entries to hold, the scheduled review runner read an empty ledger and fail-closed every parked PR to a human,
 * and the operator hand-queued reviews for weeks believing the automation was simply unbuilt. A syntax
 * constraint, invisible at the bottom, surfaced as "we need to build an autonomous reviewer" at the top.
 *
 * A harness script cannot be unit-tested by running it (it needs live agents), and it is not an importable
 * module (its top-level `return` fails `node --check`). So this is the ONE cheap check that proves the thing
 * everyone assumed: that it can start at all.
 *
 * WHAT THIS FILE IS AND IS NOT. It is a UNIT test over `metaPurity`/`metaKeys` — pure functions run against
 * source text. It is NOT an integration test, and it cannot be: the validator it models lives in the Workflow
 * runtime and is unavailable to this repo. See the note on `PURE_KINDS` for what is observed vs inferred, and
 * for why the safe failure direction is "too strict". A green run here means the meta matches OUR MODEL of the
 * runtime's rule; only a real launch proves the runtime agrees.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const ROOTS = ['scripts/workflows', 'skills-src'];

// ⚠️ THIS SET IS A MODEL OF AN EXTERNAL VALIDATOR, NOT A CHECKED CONTRACT. Read this before trusting it.
//
// The real validator lives in the Claude Code Workflow runtime. It is NOT importable from this repo (grepped:
// nothing here implements it), so NOTHING in this file can prove the list below matches it. This is a unit test
// over our own belief about a boundary — the same shape as a fake that returns what its author assumed the real
// dependency does, which is precisely how the `rev-parse --end-of-options` defect shipped green in this suite.
//
// What is GROUNDED — two observed rejections from the live runtime, both `BinaryExpression`:
//   • backlog/2664 recorded `meta must be a pure literal: BinaryExpression` from a real failed launch;
//   • `review-parked-prs.mjs` hit the same, which is why this file exists.
// Everything else here is INFERENCE from the error's wording ("pure literal", "non-literal node type").
//
// The DIRECTIONS of error are not symmetric, and only one is dangerous:
//   • too STRICT (we reject something the runtime accepts) → a false alarm, loud, fixed in minutes;
//   • too LOOSE (we accept something the runtime rejects) → this test passes and the harness STILL cannot
//     start — the exact silent failure it was written to end.
// So when in doubt, leave a kind OUT. Adding one is a claim about the runtime that nothing here can check.
//
// The only real integration proof is a LAUNCH: the runtime validates `meta` before spawning any agent, so a
// workflow that gets past validation has exercised the actual validator. That cannot run in CI (it needs the
// harness), so it belongs in the PR's verification notes, not here. #xkvvdpf tracks grounding boundary claims
// against real dependencies generally; this is the one boundary where the dependency is unavailable to us.
const PURE_KINDS = new Set([
  ts.SyntaxKind.ObjectLiteralExpression,
  ts.SyntaxKind.ArrayLiteralExpression,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.ParenthesizedExpression, // `({ … })` is the same literal with parens — launchable
  ts.SyntaxKind.PrefixUnaryExpression,   // `-1` / `+1`; the operand is checked below, so only numeric survives
]);
// Identifier is deliberately ABSENT: the walk never descends into a property NAME (it jumps straight to the
// initializer), so the only way an Identifier is reached is in a VALUE position — `description: SUFFIX` — which
// is exactly the impurity being caught.

/**
 * Parse `src` and return the impure nodes inside `export const meta = …`, by KIND rather than by spelling.
 *
 * WHY AN AST AND NOT REGEXES. The first version of this test asserted four spellings — quote-`+`-quote, `${`,
 * and `...`. The PR #1031 review demonstrated it passing on `description: 'a ' + SUFFIX`, `phases: buildPhases()`
 * and the mixed-quote `'a' +\n "b"`, all of which are unlaunchable, while `\.\.\.` false-positives on a prose
 * ellipsis. A guard for "is this a literal?" that reasons about characters instead of syntax will always be one
 * spelling behind the next author. `typescript` is already a declared dependency.
 *
 * @returns {{found: boolean, impure: string[]}} `found:false` when the file declares no `meta`
 */
export function metaPurity(src, fileName = 'meta.mjs') {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // The EXPORTED `meta` — not merely the first declaration named `meta`. A local `const meta` inside some helper
  // would otherwise shadow it and the guard would pass on an unlaunchable file (probed: a function-local
  // `const meta = { name: 'ok' }` made an `export const meta = { name: 'x' + 'y' }` read as pure).
  let init = null;
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    if (!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'meta' && d.initializer) init = d.initializer;
    }
  }
  if (!init) return { found: false, impure: [] };

  const impure = [];
  const walk = (node) => {
    if (!PURE_KINDS.has(node.kind)) {
      impure.push(`${ts.SyntaxKind[node.kind]} — ${node.getText().slice(0, 60).replace(/\s+/g, ' ')}`);
      return; // do not descend into an already-impure subtree; one report per offending node is enough
    }
    if (ts.isPropertyAssignment(node)) { walk(node.initializer); return; } // skip the NAME, walk the VALUE
    // `-x` is launchable only when x is a numeric literal; `-SOME_CONST` is not.
    if (ts.isPrefixUnaryExpression(node) && !ts.isNumericLiteral(node.operand)) {
      impure.push(`${ts.SyntaxKind[node.operand.kind]} — ${node.getText().slice(0, 60)}`);
      return;
    }
    ts.forEachChild(node, walk);
  };
  walk(init);
  return { found: true, impure };
}

/** Every file under `roots` that declares a Workflow `meta` block. */
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
      if (src.includes('export const meta')) out.push({ path: p, src });
    }
  };
  for (const r of ROOTS) walk(resolve(process.cwd(), r));
  return out;
}

/** The property names declared on the exported `meta` literal. `[]` when there is no exported meta. */
export function metaKeys(src, fileName = 'meta.mjs') {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    if (!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== 'meta' || !d.initializer) continue;
      let obj = d.initializer;
      while (ts.isParenthesizedExpression(obj)) obj = obj.expression;
      if (!ts.isObjectLiteralExpression(obj)) return [];
      return obj.properties
        .filter((p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
        .map((p) => p.name.text);
    }
  }
  return [];
}

describe('Workflow harness scripts must be launchable (pure-literal meta)', () => {
  const scripts = harnessScripts();

  it('finds the harness scripts at all (guards against a silently-empty sweep)', () => {
    // A test that scans nothing passes vacuously — the exact failure shape this file exists to catch.
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.some((s) => s.path.endsWith('review-parked-prs.mjs'))).toBe(true);
  });

  it.each(harnessScripts().map((s) => [s.path.replace(`${process.cwd()}/`, ''), s]))(
    '%s — meta is a pure literal',
    (_name, script) => {
      const { found, impure } = metaPurity(script.src, script.path);
      expect(found, 'meta block not found').toBe(true);
      expect(impure, `meta is not a pure literal: ${impure.join(' | ')}`).toEqual([]);
    },
  );

  it.each(harnessScripts().map((s) => [s.path.replace(`${process.cwd()}/`, ''), s]))(
    '%s — meta declares the required fields',
    (_name, script) => {
      // Read the KEYS off the parsed object, not a whole-file regex. The regex form required single quotes (so a
      // launchable double-quoted meta failed) and matched an unrelated `name: 'x'` anywhere in the file (so a
      // meta missing the key passed). Same spelling-vs-syntax mistake this file's docstring argues against.
      expect(metaKeys(script.src, script.path)).toEqual(expect.arrayContaining(['name', 'description']));
    },
  );

  // The guard must REJECT what the runtime rejects. These are the spellings the regex version passed — each one
  // is genuinely unlaunchable, and each was demonstrated slipping through in the PR #1031 review.
  describe('the guard catches the CLASS, not one spelling', () => {
    const cases = {
      'string concatenation, same quotes': "export const meta = { name: 'a', description: 'x' + 'y' };",
      'string concatenation, mixed quotes across lines': "export const meta = { name: 'a', description: 'x' +\n \"y\" };",
      'concatenation with an identifier': "export const meta = { name: 'a', description: 'x ' + SUFFIX };",
      'a call expression': "export const meta = { name: 'a', phases: buildPhases() };",
      'template interpolation': 'export const meta = { name: `a${x}` };',
      'a spread': "export const meta = { name: 'a', ...rest };",
      'a bare identifier value': "export const meta = { name: NAME };",
      'a member expression': "export const meta = { name: cfg.name };",
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

    it('reads the EXPORTED meta, not a shadowing local (probed as a live miss)', () => {
      // A function-local `const meta` used to win, so an unlaunchable exported meta read as pure.
      const src = "function f(){ const meta = { name: 'ok' }; return meta; }\nexport const meta = { name: 'x' + 'y' };";
      const r = metaPurity(src);
      expect(r.found).toBe(true);
      expect(r.impure.length, 'the shadowing local hid an unlaunchable exported meta').toBeGreaterThan(0);
    });

    it('does not false-flag launchable forms the runtime accepts', () => {
      expect(metaPurity("export const meta = { name: 'a', n: -1 };").impure).toEqual([]);
      expect(metaPurity("export const meta = ({ name: 'a' });").impure).toEqual([]);
      expect(metaPurity('export const meta = { name: "double-quoted" };').impure).toEqual([]);
    });

    it('still rejects a negated IDENTIFIER (only a negated numeric literal is pure)', () => {
      expect(metaPurity("export const meta = { name: 'a', n: -SOME_CONST };").impure.length).toBeGreaterThan(0);
    });

    it('metaKeys reads the declared keys off the AST, in any quoting', () => {
      expect(metaKeys("export const meta = { name: 'a', description: 'b' };")).toEqual(['name', 'description']);
      expect(metaKeys('export const meta = { "name": "a", description: `b` };')).toEqual(['name', 'description']);
      // the regex form this replaced passed on an unrelated `name:` elsewhere in the file
      expect(metaKeys("const other = { name: 'x' };\nexport const meta = { description: 'b' };")).toEqual(['description']);
    });

    it('reports found:false rather than passing vacuously when there is no meta at all', () => {
      expect(metaPurity('const x = 1;').found).toBe(false);
    });
  });
});
