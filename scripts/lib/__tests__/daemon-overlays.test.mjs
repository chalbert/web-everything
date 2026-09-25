/**
 * @file scripts/lib/__tests__/daemon-overlays.test.mjs
 * @description Module B — the per-clone overlay list (`../daemon-overlays.mjs`) and its CLI
 *   (`../../daemon-overlay.mjs`). Every test points `WE_DAEMON_OVERLAY_DIR` at a fresh mkdtemp dir — never
 *   `~/.claude/*` — per the design's top rule that no state/lock dir may be written outside an injected temp
 *   path during tests. The CLI is exercised via `spawnSync` with `--no-lock` so these tests never import or
 *   depend on `daemon-clone-lock.mjs` (Module A), which is being authored concurrently by another worker.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  cloneKey,
  overlayFilePath,
  readOverlays,
  readOverlayState,
  writeOverlays,
  addOverlay,
  removeOverlay,
  appendOverlayEvent,
} from '../daemon-overlays.mjs';

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'daemon-overlay.mjs');

let overlayDir;
let cloneRoot;

beforeEach(() => {
  overlayDir = mkdtempSync(join(tmpdir(), 'we-daemon-overlays-'));
  cloneRoot = mkdtempSync(join(tmpdir(), 'we-daemon-overlays-clone-'));
});

afterEach(() => {
  rmSync(overlayDir, { recursive: true, force: true });
  rmSync(cloneRoot, { recursive: true, force: true });
});

function env() {
  return { WE_DAEMON_OVERLAY_DIR: overlayDir };
}

describe('cloneKey / overlayFilePath', () => {
  it('is deterministic and filesystem-safe', () => {
    const k1 = cloneKey(cloneRoot);
    const k2 = cloneKey(cloneRoot);
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[0-9a-f]{16}$/);
  });

  it('collides across different spellings of the same real path', () => {
    const spelled = join(cloneRoot, '.', 'x', '..');
    expect(cloneKey(spelled)).toBe(cloneKey(cloneRoot));
  });

  it('overlayFilePath sits under the env-pinned dir, keyed by cloneKey', () => {
    const file = overlayFilePath(cloneRoot, { WE_DAEMON_OVERLAY_DIR: overlayDir });
    expect(file).toBe(join(overlayDir, `${cloneKey(cloneRoot)}.json`));
  });
});

describe('readOverlays / readOverlayState', () => {
  it('missing file ⇒ [] and corrupt:false, never throws', () => {
    expect(readOverlays(cloneRoot, { env: env() })).toEqual([]);
    expect(readOverlayState(cloneRoot, { env: env() })).toEqual({ clone: null, overlays: [], corrupt: false });
  });

  it('corrupt (unparsable) file ⇒ [] and corrupt:true, never throws', () => {
    writeFileSync(overlayFilePath(cloneRoot, env()), '{not json', 'utf8');
    expect(() => readOverlays(cloneRoot, { env: env() })).not.toThrow();
    expect(readOverlays(cloneRoot, { env: env() })).toEqual([]);
    expect(readOverlayState(cloneRoot, { env: env() }).corrupt).toBe(true);
  });

  it('addOverlay / removeOverlay throw on a corrupt file instead of overwriting it with a fresh list', () => {
    const file = overlayFilePath(cloneRoot, env());
    writeFileSync(file, '{not json', 'utf8');
    expect(() => addOverlay(cloneRoot, { ref: 'lane/x' }, { env: env() })).toThrow(/corrupt/);
    expect(() => removeOverlay(cloneRoot, 'lane/x', { env: env() })).toThrow(/corrupt/);
    expect(readFileSync(file, 'utf8')).toBe('{not json');
  });

  it('wrong-shaped JSON (overlays not an array) ⇒ [] and corrupt:true', () => {
    writeFileSync(overlayFilePath(cloneRoot, env()), JSON.stringify({ clone: cloneRoot, overlays: 'nope' }), 'utf8');
    const state = readOverlayState(cloneRoot, { env: env() });
    expect(state.corrupt).toBe(true);
    expect(state.overlays).toEqual([]);
  });
});

describe('writeOverlays', () => {
  it('is atomic — no leftover tmp file after a write', () => {
    writeOverlays(cloneRoot, [{ ref: 'lane/x', pr: null, addedAt: 'now', addedBy: 'a', reason: null }], { env: env() });
    const entries = readdirSync(overlayDir);
    expect(entries.some((f) => f.includes('.tmp-'))).toBe(false);
    expect(readOverlays(cloneRoot, { env: env() })).toHaveLength(1);
  });

  it('records the resolved clone path in the file', () => {
    writeOverlays(cloneRoot, [], { env: env() });
    const state = readOverlayState(cloneRoot, { env: env() });
    expect(state.clone).toBe(realpathSync(cloneRoot));
  });
});

describe('addOverlay', () => {
  it('adds a new entry', () => {
    const list = addOverlay(cloneRoot, { ref: 'lane/foo', pr: 12, addedBy: 'nic', reason: 'fix' }, { env: env() });
    expect(list).toEqual([{ ref: 'lane/foo', pr: 12, addedAt: expect.any(String), addedBy: 'nic', reason: 'fix' }]);
  });

  it('duplicate ref updates pr/reason in place and keeps position + original addedAt/addedBy', () => {
    addOverlay(cloneRoot, { ref: 'lane/a', pr: 1, addedBy: 'nic', now: '2026-01-01T00:00:00.000Z' }, { env: env() });
    addOverlay(cloneRoot, { ref: 'lane/b', pr: 2, addedBy: 'nic', now: '2026-01-02T00:00:00.000Z' }, { env: env() });
    const list = addOverlay(cloneRoot, { ref: 'lane/a', pr: 99, addedBy: 'someone-else', reason: 'updated' }, { env: env() });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ ref: 'lane/a', pr: 99, reason: 'updated', addedAt: '2026-01-01T00:00:00.000Z', addedBy: 'nic' });
    expect(list[1]).toMatchObject({ ref: 'lane/b', pr: 2 });
  });

  it('rejects an unsafe ref without writing anything', () => {
    expect(() => addOverlay(cloneRoot, { ref: '--upload-pack=evil' }, { env: env() })).toThrow(TypeError);
    expect(readOverlays(cloneRoot, { env: env() })).toEqual([]);
  });
});

describe('removeOverlay', () => {
  it('removes an existing ref', () => {
    addOverlay(cloneRoot, { ref: 'lane/a' }, { env: env() });
    addOverlay(cloneRoot, { ref: 'lane/b' }, { env: env() });
    const result = removeOverlay(cloneRoot, 'lane/a', { env: env() });
    expect(result.removed).toBe(true);
    expect(result.list.map((o) => o.ref)).toEqual(['lane/b']);
  });

  it('is idempotent — removing an absent ref is not an error', () => {
    const result = removeOverlay(cloneRoot, 'lane/nope', { env: env() });
    expect(result).toEqual({ removed: false, list: [] });
  });
});

describe('appendOverlayEvent', () => {
  it('appends one JSON line with an `at` stamp per call', () => {
    appendOverlayEvent(cloneRoot, { kind: 'added', ref: 'lane/a' }, { env: env() });
    appendOverlayEvent(cloneRoot, { kind: 'removed', ref: 'lane/a' }, { env: env() });
    const file = join(overlayDir, `${cloneKey(cloneRoot)}.events.jsonl`);
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const events = lines.map((l) => JSON.parse(l));
    expect(events[0]).toMatchObject({ kind: 'added', ref: 'lane/a' });
    expect(events[1]).toMatchObject({ kind: 'removed', ref: 'lane/a' });
    expect(typeof events[0].at).toBe('string');
  });
});

describe('CLI (spawnSync, --no-lock — never imports daemon-clone-lock.mjs)', () => {
  function run(args) {
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
      encoding: 'utf8',
      env: { ...process.env, WE_DAEMON_OVERLAY_DIR: overlayDir },
      timeout: 20_000,
    });
  }

  it('add --no-lock --json registers the ref and appends an event', () => {
    const r = run(['add', `--clone=${cloneRoot}`, '--ref=lane/cli-test', '--pr=7', '--by=tester', '--no-lock', '--json']);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.list).toEqual([{ ref: 'lane/cli-test', pr: 7, addedAt: expect.any(String), addedBy: 'tester', reason: null }]);
    const events = readFileSync(join(overlayDir, `${cloneKey(cloneRoot)}.events.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'added', ref: 'lane/cli-test', pr: 7 });
  });

  it('list --json reflects what add wrote', () => {
    run(['add', `--clone=${cloneRoot}`, '--ref=lane/cli-test', '--no-lock']);
    const r = run(['list', `--clone=${cloneRoot}`, '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).list.map((o) => o.ref)).toEqual(['lane/cli-test']);
  });

  it('remove --no-lock --json drops the ref and appends a removed event', () => {
    run(['add', `--clone=${cloneRoot}`, '--ref=lane/cli-test', '--no-lock']);
    const r = run(['remove', `--clone=${cloneRoot}`, '--ref=lane/cli-test', '--no-lock', '--json']);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out).toEqual({ removed: true, list: [] });
    const events = readFileSync(join(overlayDir, `${cloneKey(cloneRoot)}.events.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(events.map((e) => e.kind)).toEqual(['added', 'removed']);
  });

  // Advisory 2026-09-25 (PR #2625): a corrupt file read as an empty list everywhere, silently.
  it('list on a corrupt file reports corrupt:true and exits 1, add/remove refuse and leave the file untouched', () => {
    const file = overlayFilePath(cloneRoot, env());
    writeFileSync(file, '{not json', 'utf8');
    const listed = run(['list', `--clone=${cloneRoot}`, '--json']);
    expect(listed.status).toBe(1);
    expect(JSON.parse(listed.stdout)).toEqual({ list: [], corrupt: true });
    for (const args of [['add', '--ref=lane/x'], ['remove', '--ref=lane/x']]) {
      const r = run([...args, `--clone=${cloneRoot}`, '--no-lock', '--json']);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/corrupt/);
    }
    expect(readFileSync(file, 'utf8')).toBe('{not json');
  });

  it('bad usage exits 2 and never writes anything', () => {
    const r = run(['add', `--clone=${cloneRoot}`, '--no-lock']); // missing --ref
    expect(r.status).toBe(2);
    expect(readdirSync(overlayDir)).toEqual([]);
  });

  it('unknown command exits 2', () => {
    const r = run(['bogus', `--clone=${cloneRoot}`]);
    expect(r.status).toBe(2);
  });
});

describe('pinned overlays (self-destruct guard, 2026-09-25)', () => {
  it('addOverlay records pinned:true, keeps it on a plain re-add, and clears it with pinned:false', () => {
    const env = { WE_DAEMON_OVERLAY_DIR: overlayDir };
    addOverlay(cloneRoot, { ref: 'lane/mech', pr: 1, pinned: true }, { env });
    expect(readOverlays(cloneRoot, { env })[0].pinned).toBe(true);
    addOverlay(cloneRoot, { ref: 'lane/mech', pr: 1 }, { env });
    expect(readOverlays(cloneRoot, { env })[0].pinned).toBe(true);
    addOverlay(cloneRoot, { ref: 'lane/mech', pr: 1, pinned: false }, { env });
    expect(readOverlays(cloneRoot, { env })[0].pinned).toBeUndefined();
  });

  it('CLI add --pinned writes pinned:true', () => {
    const r = spawnSync(process.execPath, [CLI_PATH, 'add', `--clone=${cloneRoot}`, '--ref=lane/mech', '--pinned', '--no-lock', '--json'], {
      encoding: 'utf8', env: { ...process.env, WE_DAEMON_OVERLAY_DIR: overlayDir },
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).list[0]).toMatchObject({ ref: 'lane/mech', pinned: true });
  });
});
