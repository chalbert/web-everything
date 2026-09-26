#!/usr/bin/env node
/**
 * @file scripts/daemon-overlay.mjs
 * @description Operator/daemon CLI for the per-clone overlay list (`scripts/lib/daemon-overlays.mjs`, Module
 *   B) — docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clause 5: a daemon clone tracks
 *   `main` plus an explicit overlay list kept in a per-clone state file OUTSIDE the clone. This is the
 *   add/remove/list surface a person (or a future automated caller) uses to register/drop an overlay ref.
 *
 * WHY THE WRITE LOCK IS IMPORTED LAZILY. `scripts/lib/daemon-clone-lock.mjs` (Module A, card 4041/x3ecgta) is
 * the per-clone reader/writer mutex clause 3(ii) requires, so on a real run this CLI takes the WRITE lock
 * around its add/remove mutation — it must serialize with a daemon's own tick/rebuild, never race it. But
 * Module A is a SEPARATE file authored concurrently with this one; importing it eagerly at module load would
 * make this file — and its own tests — depend on Module A's exact shape landing first. So the import is
 * DYNAMIC and happens ONLY inside the add/remove path, at the point the mutation actually runs. `list` never
 * touches it (a plain read needs no lock), and `--no-lock` (tests; or a future caller that already holds the
 * lock itself, e.g. `daemon-rebuild.mjs`) skips it entirely.
 *
 * USAGE:
 *   node scripts/daemon-overlay.mjs add    --clone=<path> --ref=<branch> [--pr=N] [--pinned|--unpinned] [--reason=..] [--by=..] [--no-lock] [--json]
 *   node scripts/daemon-overlay.mjs remove --clone=<path> --ref=<branch> [--reason=..] [--by=..] [--no-lock] [--json]
 *   node scripts/daemon-overlay.mjs list   --clone=<path> [--json]
 *
 * `--by` defaults to `$USER`. Every command prints the resulting list (remove also reports whether the ref was
 * actually present). Exit codes: 2 on bad usage (unknown command, missing `--clone`, `add`/`remove` missing
 * `--ref`, non-integer `--pr`); 1 when the write lock is refused (add/remove only); 0 otherwise — including a
 * `remove` of a ref that was never present, which is not a usage error.
 *
 * xa4qo7n follow-up (live 2026-09-26, epic #4075): this CLI's add/remove used to call `withWriteLock(root, fn,
 * {})` with NO wait bound at all — it inherited `acquireWrite`'s raw 600s (10 MINUTE) default. A live operator
 * run of `add` reserved the writer key, then sat silently (0% CPU, no log line) for 8+ minutes waiting for a
 * busy clone's readers to drain, during which EVERY daemon sharing the clone was refused `writer-active` on
 * every tick — the exact class of freeze card 4044/#2625 fixed for `daemon-rebuild.mjs#rebuildClone` (which
 * bounds its OWN write-lock wait to {@link DEFAULT_OVERLAY_LOCK_WAIT_MS}-scale via `WE_DAEMON_REBUILD_LOCK_WAIT_MS`,
 * logging both the wait start and the give-up) — this CLI just never got that same fix. It now bounds its wait
 * the same way (env `WE_DAEMON_OVERLAY_LOCK_WAIT_MS`, default {@link DEFAULT_OVERLAY_LOCK_WAIT_MS}), logs when
 * it starts waiting and who is blocking it, and on timeout reports `tick-in-progress` (retryable — the caller
 * already treats any `!ok` as "write lock refused" and exits 1) instead of silently hanging.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addOverlay, removeOverlay, readOverlayState, appendOverlayEvent } from './lib/daemon-overlays.mjs';

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function fail(msg) {
  process.stderr.write(`daemon-overlay: ${msg}\n`);
  process.exitCode = 2;
}

/** Env var bounding how long add/remove waits for live readers to drain before giving up — see the file header
 *  (xa4qo7n follow-up). Kept short: this CLI's own mutation is a tiny metadata write, not a rebuild, so it only
 *  ever needs to outlast whatever tick(s) are CURRENTLY in flight, never a long one. */
export const OVERLAY_LOCK_WAIT_ENV = 'WE_DAEMON_OVERLAY_LOCK_WAIT_MS';
export const DEFAULT_OVERLAY_LOCK_WAIT_MS = 30_000;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== 'add' && cmd !== 'remove' && cmd !== 'list') {
    fail(`expected add|remove|list, got ${JSON.stringify(cmd ?? null)}`);
    return;
  }

  const flags = parseFlags(rest);
  const clone = typeof flags.clone === 'string' ? flags.clone : null;
  if (!clone) return fail('--clone=<path> is required');
  const root = resolve(clone);

  if ((cmd === 'add' || cmd === 'remove') && typeof flags.ref !== 'string') {
    return fail(`--ref=<branch> is required for ${cmd}`);
  }

  let pr = null;
  if (typeof flags.pr === 'string') {
    pr = Number(flags.pr);
    if (!Number.isInteger(pr)) return fail(`--pr must be an integer, got ${JSON.stringify(flags.pr)}`);
  }
  const reason = typeof flags.reason === 'string' ? flags.reason : null;
  const by = typeof flags.by === 'string' ? flags.by : (process.env.USER || null);
  // `--pinned`: the rebuild refuses (keeps the current tree) rather than ever conflict-drop this overlay.
  let pinned;
  if (flags.pinned) pinned = true;
  else if (flags.unpinned) pinned = false;
  const noLock = !!flags['no-lock'];
  const asJson = !!flags.json;
  const env = process.env;

  // Run `fn` (the actual mutation) either bare (`--no-lock`) or under Module A's write lock, imported lazily —
  // see the file header for why this import cannot be a top-of-file `import`. BOUNDED (xa4qo7n follow-up):
  // never the raw 600s `acquireWrite` default — see OVERLAY_LOCK_WAIT_ENV.
  const waitMs = Number(env[OVERLAY_LOCK_WAIT_ENV]) > 0 ? Number(env[OVERLAY_LOCK_WAIT_ENV]) : DEFAULT_OVERLAY_LOCK_WAIT_MS;
  const withLockIfNeeded = async (fn) => {
    if (noLock) return { ok: true, value: fn() };
    const { withWriteLock } = await import('./lib/daemon-clone-lock.mjs');
    return withWriteLock(root, () => fn(), {
      waitMs,
      onBlocked: ({ blockers, waitMs: w }) => process.stderr.write(
        `daemon-overlay: waiting up to ${Math.round(w / 1000)}s for live reader(s) ${blockers.join(', ')} to finish their tick (xa4qo7n)\n`,
      ),
    });
  };

  let output;
  if (cmd === 'list') {
    // A corrupt file must not read as a plain empty list: flag it and exit 1 (add/remove throw on it instead).
    const state = readOverlayState(root, { env });
    output = state.corrupt ? { list: [], corrupt: true } : { list: state.overlays };
    if (state.corrupt) {
      process.stderr.write('daemon-overlay: overlay state file is corrupt — fix or remove it by hand\n');
      process.exitCode = 1;
    }
  } else if (cmd === 'add') {
    const locked = await withLockIfNeeded(() => {
      const list = addOverlay(root, {
        ref: flags.ref, pr, addedBy: by, reason, pinned,
      }, { env });
      appendOverlayEvent(root, {
        kind: 'added', ref: flags.ref, pr, by, reason, ...(pinned !== undefined ? { pinned } : {}),
      }, { env });
      return list;
    });
    if (!locked.ok) {
      process.stderr.write(`daemon-overlay: write lock refused (${locked.reason}${locked.heldBy ? ` — held by ${locked.heldBy}` : ''})\n`);
      process.exitCode = 1;
      return;
    }
    output = { list: locked.value };
  } else {
    const locked = await withLockIfNeeded(() => {
      const { removed, list } = removeOverlay(root, flags.ref, { env, why: reason || 'operator' });
      if (removed) appendOverlayEvent(root, { kind: 'removed', ref: flags.ref, by, reason }, { env });
      return { removed, list };
    });
    if (!locked.ok) {
      process.stderr.write(`daemon-overlay: write lock refused (${locked.reason}${locked.heldBy ? ` — held by ${locked.heldBy}` : ''})\n`);
      process.exitCode = 1;
      return;
    }
    output = locked.value;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } else if (cmd === 'remove') {
    process.stdout.write(`daemon-overlay: removed=${output.removed} list=${JSON.stringify(output.list)}\n`);
  } else {
    process.stdout.write(`daemon-overlay: list=${JSON.stringify(output.list)}\n`);
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main().catch((e) => {
    process.stderr.write(`daemon-overlay: fatal: ${String((e && e.message) || e)}\n`);
    process.exitCode = 1;
  });
}
