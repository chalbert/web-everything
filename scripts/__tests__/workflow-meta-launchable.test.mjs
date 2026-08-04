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

const ROOTS = ['scripts/workflows', 'skills-src'];

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

/** The `export const meta = { … }` block's source text, up to the first line that is exactly `}`. */
function metaBlock(src) {
  const start = src.indexOf('export const meta');
  if (start === -1) return '';
  const m = src.slice(start).match(/^[\s\S]*?\n\}/);
  return m ? m[0] : src.slice(start);
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
      const meta = metaBlock(script.src);
      expect(meta, 'meta block not found').not.toBe('');
      // String concatenation — the defect that made review-parked-prs.mjs unlaunchable. The runtime reports
      // `meta must be a pure literal: non-literal node type in meta: BinaryExpression`.
      expect(meta, 'meta uses string concatenation (`+`) — the runtime rejects it as non-literal').not.toMatch(/'\s*\n?\s*\+\s*'/);
      expect(meta, 'meta uses string concatenation (`+`) — the runtime rejects it as non-literal').not.toMatch(/"\s*\n?\s*\+\s*"/);
      // Template interpolation and spreads are rejected by the same validator.
      expect(meta, 'meta uses template interpolation').not.toMatch(/\$\{/);
      expect(meta, 'meta uses a spread').not.toMatch(/\.\.\./);
    },
  );

  it.each(harnessScripts().map((s) => [s.path.replace(`${process.cwd()}/`, ''), s]))(
    '%s — meta declares the required fields',
    (_name, script) => {
      const meta = metaBlock(script.src);
      expect(meta).toMatch(/\bname:\s*'/);
      expect(meta).toMatch(/\bdescription:\s*'/);
    },
  );
});
