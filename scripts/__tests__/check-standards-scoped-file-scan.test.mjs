/**
 * #4168 — the per-file content scanners (6f repo-locus, 6f-i secret sweep, 6f-i-b harness-scaffolding,
 * 6f-ii citation-verification, 6f-ii-b's 5b symbol-anchor scan) must accept the scope context's
 * changed-file set under `--local --files=…` instead of walking the whole backlog/reports/docs/
 * agent-memory-src corpus. Source-level guard, same style as `check-standards-local-skip-work.test.mjs`
 * (#4167) — running the whole script here would re-run every gate (~13s).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(ROOT, 'scripts', 'check-standards.mjs'), 'utf8');

/** The substring between the FIRST occurrence of `start` and the NEXT occurrence of `end` after it. Throws
 *  (loudly, not a silent empty match) if either anchor is missing — a renamed anchor must fail this test. */
function between(text, start, end) {
  const s = text.indexOf(start);
  if (s === -1) throw new Error(`anchor not found: ${JSON.stringify(start)}`);
  const e = text.indexOf(end, s + start.length);
  if (e === -1) throw new Error(`end anchor not found after start: ${JSON.stringify(end)}`);
  return text.slice(s, e);
}

describe('check-standards.mjs — SCOPE_TO_FILES is derived BEFORE any section runs (#4168)', () => {
  it('parses --files= once, before `errors` is even declared, and reuses it at the bottom', () => {
    const filesEarlyIdx = src.indexOf('const filesArgEarly = process.argv.find');
    expect(filesEarlyIdx).toBeGreaterThan(-1);
    expect(filesEarlyIdx).toBeLessThan(src.indexOf('const errors = []'));
    expect(src).toContain('const SCOPE_TO_FILES = LOCAL_MODE && !!LOCAL_FILES;');
    // the bottom-of-file `--files` consumer (#1144) must reuse the hoisted parse, not re-derive it —
    // only ONE `.split(/[\\s,]+/)`-shaped parse of `--files=` should exist in the whole file.
    const splitCount = (src.match(/split\(\/\[\\s,\]\+\/\)/g) || []).length;
    expect(splitCount).toBe(1);
    expect(src).toContain('const filesArg = filesArgEarly;');
  });

  it('declares a scopedReaddir helper that falls back to the full listing when not scoped', () => {
    expect(src).toContain('const scopedReaddir = (dirRel, exts) => {');
    const helper = between(src, 'const scopedReaddir = (dirRel, exts) => {', 'const REPORTS =');
    expect(helper).toContain('SCOPE_TO_FILES ? names.filter(');
  });
});

describe('check-standards.mjs — per-file scanners use scopedReaddir instead of a raw readdirSync walk (#4168)', () => {
  it('6f (repo-locus prefix) scopes both backlog/ and reports/', () => {
    const block = between(src, '── 6f. Repo-locus prefix', '── 6f-i. PUBLISH-SEAM secret sweep');
    expect(block).toContain("scopedReaddir('backlog/', ['.md'])");
    expect(block).toContain('scopedReportFiles');
    expect(block).not.toMatch(/readdirSync\(join\(ROOT, 'backlog'\)\)/);
  });

  it('6f-i (secret sweep) scopes its JS-fallback directory reads and tells the bridge it is scoped', () => {
    const block = between(src, '── 6f-i. PUBLISH-SEAM secret sweep', '── 6f-i-b. HARNESS-SCAFFOLDING');
    expect(block).toContain('scoped: SCOPE_TO_FILES');
    expect(block).toContain("scopedReaddir(`${label}/`, ['.md'])");
  });

  it('6f-i-b (harness-scaffolding) scopes both backlog/ and reports/', () => {
    const block = between(src, '── 6f-i-b. HARNESS-SCAFFOLDING', '── 6f-ii. CITATION-VERIFICATION');
    expect(block).toContain("scopedReaddir('backlog/', ['.md'])");
    expect(block).toContain('scopedReportFiles');
  });

  it('6f-ii (citation-verification) tells the bridge it is scoped AND scopes the scanDir helper', () => {
    const block = between(src, '── 6f-ii. CITATION-VERIFICATION', '── 6f-ii-b. REFERENCE-RESOLUTION');
    expect(block).toContain('scoped: SCOPE_TO_FILES');
    const scanDir = between(block, 'const scanDir = (dir, exts) => {', 'scanDir(\'backlog/\'');
    expect(scanDir).toContain('scopedReaddir(dir, exts)');
    expect(scanDir).not.toMatch(/readdirSync\(abs\)\) if/);
  });

  it('6f-ii-b scopes the 5b symbol-anchor scan but leaves 5c (not file-attributable) untouched', () => {
    const block = between(src, '── 6f-ii-b. REFERENCE-RESOLUTION', '── 6f-iii. PROVENANCE gate');
    const scanAnchors = between(block, 'const scanAnchors = (dir, exts) => {', "scanAnchors('backlog/'");
    expect(scanAnchors).toContain('scopedReaddir(dir, exts)');
    // 5c stays a plain full-backlog walk — no scopedReaddir/SCOPE_TO_FILES token near it.
    const fiveC = between(block, "// 5c — a resolved item's graduatedTo", '// 5b —');
    expect(fiveC).not.toContain('scopedReaddir');
    expect(fiveC).not.toContain('SCOPE_TO_FILES');
  });
});

describe('check-standards.mjs — the default no-flag run is untouched (#4168)', () => {
  it('SCOPE_TO_FILES is false whenever --local is absent, exactly like LOCAL_MODE', () => {
    // SCOPE_TO_FILES is defined as `LOCAL_MODE && !!LOCAL_FILES` — with no `--local` flag LOCAL_MODE is
    // false, so the `&&` short-circuits to false regardless of `--files`. Pin the exact expression so a
    // future edit can't accidentally drop the `LOCAL_MODE &&` half (which would scope even the CI run).
    expect(src).toMatch(/const SCOPE_TO_FILES = LOCAL_MODE && !!LOCAL_FILES;/);
  });
});
