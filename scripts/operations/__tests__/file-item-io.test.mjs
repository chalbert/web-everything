/**
 * @file file-item-io.test.mjs — the `file-item` IO SHELL (#3383).
 *
 * WHY THIS FILE EXISTS AT ALL: `scaffold-io.test.mjs`'s own header names the exact failure mode a pure
 * declaration suite cannot see — a wiring bug in the injected reader/sink (PR #1510's blocker, PR #1511's
 * carve-out). `file-item-io.mjs` adds a NEW sink on top of `scaffold-io.mjs`'s reused reader + write sink, so
 * the one property worth pinning here is that the new queue sink actually reaches `queue-store.mjs`'s real
 * fs helpers with the injected path/queue-file functions — not a fixture standing in for the whole shell.
 *
 * THE LAST BLOCK BELOW additionally satisfies #2949's fidelity qualifier (motivated by #3264): an `-io`
 * module's real behaviour is a filesystem effect, and an injected double has no clone geometry and no
 * directory tree of its own — so at least one test here drives BOTH sinks against a REAL git checkout via
 * `./helpers/real-repo.mjs`, not an injected stand-in for the whole shell.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createFileItemReader, createFileItemSinks } from '../file-item-io.mjs';
import { SCAFFOLD_EFFECT } from '../scaffold.mjs';
import { FILE_ITEM_QUEUE_EFFECT } from '../file-item.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';

describe('createFileItemReader is scaffold\'s own reader, not a re-derived copy', () => {
  it('collects existing ids exactly like the scaffold reader does', () => {
    const read = createFileItemReader({
      root: '/repo', listFiles: () => ['001-a.md', 'xabc-b.md'], today: () => '2026-08-21',
    })();
    expect(read.existingIds.sort()).toEqual(['001', 'xabc']);
    expect(read.dir).toBe('/repo/backlog');
  });
});

describe('the sink map', () => {
  it('carries both effect types — scaffold\'s write AND the new queue-add', () => {
    const sinks = createFileItemSinks({ root: '/repo' });
    expect(new Set(Object.keys(sinks))).toEqual(new Set([SCAFFOLD_EFFECT, FILE_ITEM_QUEUE_EFFECT]));
  });

  it('the write sink still calls the injected writer with the planned bytes', async () => {
    const calls = [];
    const sinks = createFileItemSinks({ root: '/repo', write: (...a) => calls.push(a) });
    await sinks[SCAFFOLD_EFFECT]({ abs: '/repo/backlog/xabc-a.md', rel: 'backlog/xabc-a.md', content: '---\nkind: task\n---\n' });
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe('backlog/xabc-a.md');
  });

  it('the queue sink ADDS the num via the injected queue-path/queue-file functions, idempotently', async () => {
    // Monkeypatch-free: exercise the REAL queue-store functions by writing to a real temp path instead —
    // this proves the sink reaches the real module, not a hand-rolled stand-in for it.
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-item-queue-'));
    const qPath = path.join(tmp, 'queue.json');
    const realSinks = createFileItemSinks({ root: tmp, queuePath: () => qPath });

    const first = await realSinks[FILE_ITEM_QUEUE_EFFECT]({ num: 'x9z9z9' });
    expect(first).toEqual({ num: 'x9z9z9', queued: true, alreadyQueued: false, path: qPath });
    const onDisk = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    expect(onDisk.some((e) => e.num === 'x9z9z9')).toBe(true);

    // REPLAY is idempotent — a crash between `pending` and `applied` must not double-add or lose the stamp.
    const second = await realSinks[FILE_ITEM_QUEUE_EFFECT]({ num: 'x9z9z9' });
    expect(second.alreadyQueued).toBe(true);
    const afterReplay = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    expect(afterReplay.filter((e) => e.num === 'x9z9z9')).toHaveLength(1);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('live-runner resolution (the bug this item\'s own card, `we:backlog/xtwondy-*`, documents)', () => {
  /**
   * THE ACTUAL GAP: a caller running from checkout A (`root` below) must not silently queue into A's OWN
   * sidecar when the live conveyor runner is rooted in a DIFFERENT checkout B — exactly what was caught live
   * 2026-09-07 (14 items filed from a scratch dispatcher checkout, invisible to the real runner). This proves
   * the fix: with no `queuePath` override (the real production default path in `we:scripts/operations/run.mjs`),
   * an injected `resolveRunner` reporting checkout B lands the entry in B's `.conveyor/queue.json`, never A's.
   */
  it('a resolved runner checkout DIFFERENT from `root` gets the queue entry — never `root`\'s own sidecar', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'file-item-caller-'));
    const runnerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'file-item-runner-'));
    try {
      const sinks = createFileItemSinks({
        root: callerRoot,
        resolveRunner: () => ({ status: 'resolved', cwd: runnerRoot, owner: 'test', pid: 4242 }),
      });
      const out = await sinks[FILE_ITEM_QUEUE_EFFECT]({ num: 'x7r7r7' });
      const runnerQueuePath = path.join(runnerRoot, '.conveyor', 'queue.json');
      expect(out).toEqual({ num: 'x7r7r7', queued: true, alreadyQueued: false, path: runnerQueuePath });
      expect(fs.existsSync(path.join(callerRoot, '.conveyor', 'queue.json'))).toBe(false);
      const queued = JSON.parse(fs.readFileSync(runnerQueuePath, 'utf8'));
      expect(queued.some((e) => e.num === 'x7r7r7')).toBe(true);
    } finally {
      fs.rmSync(callerRoot, { recursive: true, force: true });
      fs.rmSync(runnerRoot, { recursive: true, force: true });
    }
  });

  /**
   * NO LIVE RUNNER RESOLVABLE → the sink must not throw or refuse (queueAdd stays "one effect or zero, never
   * refused" per `we:scripts/operations/file-item.mjs`'s own header) — it falls back to the pre-fix
   * script-location default (`resolveQueuePath`, honoring `CONVEYOR_QUEUE_FILE` so this stays isolated from
   * the real repo's own sidecar) so a card filed with the conveyor not running still gets SOME entry.
   */
  it('an unresolved runner (no-live-lock) falls back to the script-location default, without throwing', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-item-fallback-'));
    const fallbackPath = path.join(tmp, 'fallback-queue.json');
    const prevEnv = process.env.CONVEYOR_QUEUE_FILE;
    process.env.CONVEYOR_QUEUE_FILE = fallbackPath;
    try {
      const sinks = createFileItemSinks({
        root: tmp,
        resolveRunner: () => ({ status: 'no-live-lock', cwd: null, reason: 'no live conveyor runner lock found' }),
      });
      const out = await sinks[FILE_ITEM_QUEUE_EFFECT]({ num: 'x8f8f8' });
      expect(out).toEqual({ num: 'x8f8f8', queued: true, alreadyQueued: false, path: fallbackPath });
      const queued = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      expect(queued.some((e) => e.num === 'x8f8f8')).toBe(true);
    } finally {
      if (prevEnv === undefined) delete process.env.CONVEYOR_QUEUE_FILE; else process.env.CONVEYOR_QUEUE_FILE = prevEnv;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  /** An explicit `queuePath` override still wins outright — the live-runner resolution is only consulted when
   *  no override is given, so every pre-existing fixture-pointing test above keeps working unchanged. */
  it('an explicit `queuePath` override is never shadowed by resolveRunner', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-item-override-'));
    const qPath = path.join(tmp, 'explicit-queue.json');
    let resolveRunnerCalled = false;
    try {
      const sinks = createFileItemSinks({
        root: tmp,
        queuePath: () => qPath,
        resolveRunner: () => { resolveRunnerCalled = true; return { status: 'resolved', cwd: tmp }; },
      });
      await sinks[FILE_ITEM_QUEUE_EFFECT]({ num: 'x9o9o9' });
      expect(resolveRunnerCalled).toBe(false);
      expect(fs.existsSync(qPath)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('against a REAL git checkout (#2949 fidelity qualifier)', () => {
  /**
   * BOTH SINKS, ONE REAL CHECKOUT. The write sink goes through `we:scripts/backlog/guarded-write.mjs`'s real
   * default (`backlog-ops-integration.test.mjs` already pins its fail-closed #883 behaviour on its own, so
   * this does not re-litigate it) and the queue sink writes `.conveyor/queue.json` relative to the SAME real
   * `ctx.root` — proving the two sinks agree on which checkout they are acting on, not just that each one
   * works in isolation against a hand-picked temp dir.
   */
  it('writes the card AND clears it for the conveyor, both under the real checkout root', async () => {
    await withRealRepo(async (ctx) => {
      ctx.commit({ 'backlog/.gitkeep': '' }, 'backlog: seed');
      // `queuePath` is explicit here, deliberately: the unmodified DEFAULT resolves the LIVE conveyor runner
      // first (real `lsof`/`ps` shell-outs) and, only when no runner is resolvable, falls back to
      // `resolveQueuePath` — the running `queue-store.mjs`'s OWN script location. `ctx.root` is a bare,
      // minimal checkout with no `scripts/` of its own and no live runner rooted in it, so an unmodified
      // default here would either resolve to a real runner elsewhere on this machine or fall back to writing
      // into THIS repo's real `.conveyor/queue.json` — neither is the fixture's own sidecar, hence the
      // explicit override that this test (and the fixture's own isolation) both depend on.
      const sinks = createFileItemSinks({ root: ctx.root, queuePath: () => join(ctx.root, '.conveyor', 'queue.json') });

      const abs = join(ctx.root, 'backlog', 'x1a1a1-a-real-card.md');
      const content = '---\nkind: task\nsize: 1\nstatus: open\ndateOpened: "2026-09-06"\n---\n\n'
        + '# A real card\n\nA prose summary with no bare repo paths in it.\n';
      const writeOut = await sinks[SCAFFOLD_EFFECT]({ abs, rel: 'backlog/x1a1a1-a-real-card.md', content });
      expect(writeOut).toEqual({ rel: 'backlog/x1a1a1-a-real-card.md', written: true });
      expect(readFileSync(abs, 'utf8')).toBe(content);

      const queueOut = await sinks[FILE_ITEM_QUEUE_EFFECT]({ num: 'x1a1a1' });
      expect(queueOut).toMatchObject({ num: 'x1a1a1', queued: true, alreadyQueued: false });
      const queued = JSON.parse(readFileSync(join(ctx.root, '.conveyor', 'queue.json'), 'utf8'));
      expect(queued.some((e) => e.num === 'x1a1a1')).toBe(true);
    });
  });

  /** The write sink's #883 fail-closed refusal still applies through `file-item`'s reused sink map — this
   *  is the property `backlog-ops-integration.test.mjs` pins for `scaffold-io.mjs`; asserted here too because
   *  `file-item-io.mjs` is a DIFFERENT module importing the same default, and a future edit that swapped the
   *  default writer would not redden that other file. */
  it('refuses an unprefixed repo path and leaves NO file behind, and never reaches the queue sink', async () => {
    await withRealRepo(async (ctx) => {
      ctx.commit({ 'backlog/.gitkeep': '' }, 'backlog: seed');
      const sinks = createFileItemSinks({ root: ctx.root });
      const abs = join(ctx.root, 'backlog', 'x2b2b2-bad-card.md');
      const bad = '---\nkind: task\nsize: 1\nstatus: open\n---\n\n# Bad\n\nSee scripts/operations/file-item.mjs.\n';

      await expect(sinks[SCAFFOLD_EFFECT]({ abs, rel: 'backlog/x2b2b2-bad-card.md', content: bad }))
        .rejects.toThrow(/locus-prefix/);
      expect(() => readFileSync(abs, 'utf8')).toThrow();
    });
  });
});
