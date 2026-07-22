/**
 * @file scripts/conveyor/__tests__/queue.test.mjs
 * @description CLI roundtrip proof of the operator's clear-for-build command (WE #2613). Runs the real
 *   `queue.mjs {add|remove|list}` as a subprocess against a TEMP git repo (so `git rev-parse --show-toplevel`
 *   resolves the sidecar under the temp root, not the real repo), and asserts add/remove/list write & read
 *   `.conveyor/queue.json`. Also pins that the CLI runs WITHOUT any lane guard firing — it is not a card
 *   mutation — which is the entire point (the operator clears work from the primary/main checkout).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue.mjs');

let repo;
const run = (args) =>
  execFileSync('node', [CLI, ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sidecar = () => join(repo, '.conveyor', 'queue.json');
const readSidecar = () => JSON.parse(readFileSync(sidecar(), 'utf8'));

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'conveyor-queue-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('queue.mjs CLI — add/remove/list roundtrip against a temp sidecar', () => {
  it('add creates the sidecar and lists the cleared id (--json)', () => {
    const out = JSON.parse(run(['add', '2613', '--json']));
    expect(out.ok).toBe(true);
    expect(out.action).toBe('add');
    expect(out.already).toBe(false);
    expect(existsSync(sidecar())).toBe(true);
    expect(readSidecar()).toHaveLength(1);
    expect(readSidecar()[0].num).toBe('2613');
    expect(typeof readSidecar()[0].addedAt).toBe('string'); // Date.now stamp in the CLI

    const list = JSON.parse(run(['list', '--json']));
    expect(list.queue.map((e) => e.num)).toEqual(['2613']);
  });

  it('add is idempotent — a second add reports already:true and does not duplicate', () => {
    run(['add', '2613']);
    const again = JSON.parse(run(['add', '2613', '--json']));
    expect(again.already).toBe(true);
    expect(readSidecar()).toHaveLength(1);
  });

  it('remove drops the id; removing an absent id is a no-op (removed:false)', () => {
    run(['add', '2613']);
    run(['add', 'xqxpeac']);
    const rm = JSON.parse(run(['remove', '2613', '--json']));
    expect(rm.removed).toBe(true);
    expect(readSidecar().map((e) => e.num)).toEqual(['xqxpeac']);

    const noop = JSON.parse(run(['remove', '999', '--json']));
    expect(noop.removed).toBe(false);
    expect(readSidecar().map((e) => e.num)).toEqual(['xqxpeac']);
  });

  it('list on an empty/absent sidecar returns []', () => {
    const list = JSON.parse(run(['list', '--json']));
    expect(list.queue).toEqual([]);
  });

  it('a bad action exits non-zero', () => {
    expect(() => run(['frobnicate', '1'])).toThrow();
  });
});
