/**
 * @file scripts/__tests__/lane-manifest-write.test.mjs
 * @description Proof of the producer-side manifest writer (`scripts/lane-manifest-write.mjs`, #2174 under
 *   #2162) — the stop-at-push call-site that writes `.lane-manifest.json` into a lane commit. It wires flags
 *   → the pure `lane-manifest.mjs` builder/validator → fs, so the on-disk file always conforms to the schema
 *   the drain's `planDrain` reads. These spawn the CLI against a temp out-path and assert the written file.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseManifest, validateManifest } from '../readiness/lane-manifest.mjs';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-manifest-write.mjs');
function run(args) {
  try { return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status ?? 1, out: String(e.stdout || '') }; }
}

describe('lane-manifest-write (#2174 producer stop-at-push)', () => {
  it('writes a schema-valid manifest, impl-first/WE-last, WE carrying the resolve', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lmw-'));
    const out = join(dir, '.lane-manifest.json');
    const r = run(['--item=2174', '--repos=[{"repo":"we","ref":"lane/s-2174"},{"repo":"frontierui","ref":"lane/s-2174"}]', '--blocked-by=2173', '--out=' + out, '--json']);
    expect(r.code).toBe(0);
    const m = parseManifest(readFileSync(out, 'utf8'));
    expect(validateManifest(m).ok).toBe(true);
    expect(m.repos.map((x) => x.repo)).toEqual(['frontierui', 'we']); // impl first, WE last
    expect(m.repos.find((x) => x.repo === 'we').carriesResolve).toBe(true);
    expect(m.blockedBy).toEqual([2173]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('REFUSES to write an invalid manifest (no WE repo) — exit 3, nothing written', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lmw-'));
    const out = join(dir, '.lane-manifest.json');
    const r = run(['--item=2174', '--repos=[{"repo":"frontierui","ref":"x"}]', '--out=' + out, '--json']);
    expect(r.code).toBe(3);
    expect(() => readFileSync(out, 'utf8')).toThrow(); // never created
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects missing/invalid --item and --repos', () => {
    expect(run(['--repos=[{"repo":"we","ref":"x"}]', '--json']).code).toBe(3); // no --item
    expect(run(['--item=2174', '--json']).code).toBe(3); // no --repos
    expect(run(['--item=2174', '--repos=notjson', '--json']).code).toBe(3);
  });

  it('#2387 F3 — --stack-parent is repeatable and --base defaults onto every repo lacking its own', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lmw-'));
    const out = join(dir, '.lane-manifest.json');
    const r = run([
      '--item=2387',
      '--repos=[{"repo":"we","ref":"lane/s-2387"},{"repo":"frontierui","ref":"lane/s-2387","base":"facef00d"}]',
      '--stack-parent=2151', '--stack-parent=x7k2q9a',
      '--base=deadbeef',
      '--out=' + out, '--json',
    ]);
    expect(r.code).toBe(0);
    const m = parseManifest(readFileSync(out, 'utf8'));
    expect(validateManifest(m).ok).toBe(true);
    expect(m.stackParents).toEqual([2151, 'x7k2q9a']);
    expect(m.repos.find((x) => x.repo === 'we').base).toBe('deadbeef');        // gets the --base default
    expect(m.repos.find((x) => x.repo === 'frontierui').base).toBe('facef00d'); // its own base wins
    rmSync(dir, { recursive: true, force: true });
  });

  it('#2387 F3 — omitting --stack-parent/--base is backward compatible (today\'s sibling behavior)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lmw-'));
    const out = join(dir, '.lane-manifest.json');
    const r = run(['--item=2388', '--repos=[{"repo":"we","ref":"lane/s-2388"}]', '--out=' + out, '--json']);
    expect(r.code).toBe(0);
    const m = parseManifest(readFileSync(out, 'utf8'));
    expect(m.stackParents).toEqual([]);
    expect(m.repos[0]).not.toHaveProperty('base');
    rmSync(dir, { recursive: true, force: true });
  });

  it('xnsk54v — default --out is a SCRATCH temp path, never the tracked repo-root .lane-manifest.json', () => {
    const r = run(['--item=2174', '--repos=[{"repo":"we","ref":"lane/s-2174"}]', '--json']);
    expect(r.code).toBe(0);
    const { path } = JSON.parse(r.out);
    expect(path.startsWith(tmpdir())).toBe(true);                 // under the OS temp dir
    expect(path).not.toBe(resolve(process.cwd(), '.lane-manifest.json')); // NOT committed into the tree
    expect(parseManifest(readFileSync(path, 'utf8')).item).toBe(2174);    // and it really wrote there
    rmSync(path, { force: true });
  });
});
