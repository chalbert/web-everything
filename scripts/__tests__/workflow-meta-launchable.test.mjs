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
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const ROOTS = ['scripts/workflows', 'skills-src'];

// The node kinds a PURE literal may be built from. Anything else — an identifier, a call, a spread, a binary
// `+`, a template with a substitution — is what the runtime rejects.
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
  let init = null;
  const findMeta = (node) => {
    if (init) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'meta' && node.initializer) {
      init = node.initializer;
      return;
    }
    ts.forEachChild(node, findMeta);
  };
  findMeta(sf);
  if (!init) return { found: false, impure: [] };

  const impure = [];
  const walk = (node) => {
    if (!PURE_KINDS.has(node.kind)) {
      impure.push(`${ts.SyntaxKind[node.kind]} — ${node.getText().slice(0, 60).replace(/\s+/g, ' ')}`);
      return; // do not descend into an already-impure subtree; one report per offending node is enough
    }
    if (ts.isPropertyAssignment(node)) { walk(node.initializer); return; } // skip the NAME, walk the VALUE
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
      expect(script.src).toMatch(/\bname:\s*'/);
      expect(script.src).toMatch(/\bdescription:\s*'/);
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

    it('reports found:false rather than passing vacuously when there is no meta at all', () => {
      expect(metaPurity('const x = 1;').found).toBe(false);
    });
  });
});
