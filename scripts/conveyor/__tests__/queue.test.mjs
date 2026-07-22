/**
 * @file scripts/conveyor/__tests__/queue.test.mjs
 * @description CLI roundtrip proof of the operator's clear-for-build command (WE #2613). Runs the real
 *   `queue.mjs {add|remove|list}` as a subprocess against a TEMP sidecar (via the `CONVEYOR_QUEUE_FILE` env
 *   override — the same resolver the readiness shells use), and asserts add/remove/list write & read the
 *   sidecar. Pins the #2613-review fixes: a `#`-prefixed id stores/dispatches as the bare id (req 1), and
 *   clearing a not-currently-ready id still adds but WARNS (req 2a). The roundtrip cases set
 *   `CONVEYOR_NO_READY_CHECK` to skip the build-queue subprocess (fast + hermetic); the warn case does not.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue.mjs');

let dir;
let SIDECAR;
// Roundtrip runs skip the readiness build-queue shell (fast + hermetic); pass {ready:true} to exercise it.
const run = (args, { ready = false } = {}) =>
  execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CONVEYOR_QUEUE_FILE: SIDECAR, ...(ready ? {} : { CONVEYOR_NO_READY_CHECK: '1' }) },
  });
const readSidecar = () => JSON.parse(readFileSync(SIDECAR, 'utf8'));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'conveyor-queue-'));
  SIDECAR = join(dir, '.conveyor', 'queue.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('queue.mjs CLI — add/remove/list roundtrip against a temp sidecar', () => {
  it('add creates the sidecar and lists the cleared id (--json)', () => {
    const out = JSON.parse(run(['add', '2613', '--json']));
    expect(out.ok).toBe(true);
    expect(out.action).toBe('add');
    expect(out.already).toBe(false);
    expect(existsSync(SIDECAR)).toBe(true);
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

  it("a `#`-prefixed id stores the BARE id so it matches a build-queue row (#2613 review req 1)", () => {
    const out = JSON.parse(run(['add', '#2613', '--json']));
    expect(out.num).toBe('2613'); // the `#` sigil is stripped
    expect(readSidecar()[0].num).toBe('2613');
    // idempotent across the sigil: adding the bare form is a no-op, not a duplicate
    const again = JSON.parse(run(['add', '2613', '--json']));
    expect(again.already).toBe(true);
    expect(readSidecar()).toHaveLength(1);
  });
});

describe('queue.mjs CLI — clearing a not-ready id still adds but WARNS (#2613 review req 2a)', () => {
  it('a nonexistent id is added AND flagged not-currently-ready (never a silent "✓ cleared")', () => {
    // No CONVEYOR_NO_READY_CHECK → the real build-queue is consulted. 9999999 is never a ready row, so this is
    // deterministic. The id is still stored (a blocked item should auto-arm later), but the operator is warned.
    const out = JSON.parse(run(['add', '9999999', '--json'], { ready: true }));
    expect(out.ok).toBe(true);
    expect(out.ready).toBe(false); // checked and NOT ready
    expect(readSidecar().map((e) => e.num)).toEqual(['9999999']); // still added
    // human output carries the warning (stderr+stdout are both captured by execFileSync's return on success is
    // stdout only; assert via the --json `ready:false` above, which is the machine signal the skill reads).
  });
});
