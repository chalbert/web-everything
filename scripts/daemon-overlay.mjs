#!/usr/bin/env node
/**
 * @file scripts/daemon-overlay.mjs
 * @description Operator/daemon CLI for the per-clone overlay list (`scripts/lib/daemon-overlays.mjs`, Module
 *   B) — docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clause 5: a daemon clone tracks
 *   `main` plus an explicit overlay list kept in a per-clone state file OUTSIDE the clone. This is the
 *   add/remove/list surface a person (or a future automated caller) uses to register/drop an overlay ref.
 *
 * THIS CLI NEVER TOUCHES THE CLONE'S WRITE LOCK (#4229/#2760 follow-up, epic #3383/#4075, 2026-09-26).
 * add/remove ONLY register/drop an entry in the overlay STORE (`~/.claude/daemon-overlays/<hash>.json`) and
 * return — the next automatic rebuild (`daemon-rebuild.mjs`'s object-DB build: main + overlays, smoke-gated,
 * falls back to last-good on a failed smoke) is what actually applies the overlay to the clone's tree. That
 * store already serializes its OWN read-modify-write under a tiny, separate mkdir-mutex
 * (`daemon-overlays.mjs#withListLock`, added for the #2640/#2641/#2643 lost-add incidents) held for
 * milliseconds — never across a smoke or a `git reset --hard` — so a concurrent add/remove and a rebuild's own
 * auto-drop can never race each other or lose an entry. Taking the CLONE's reader/writer lock
 * (`daemon-clone-lock.mjs`, Module A) on top of that added nothing but a way to block: a plain metadata write
 * has no reason to wait for the clone's tree to be quiet.
 *
 * HISTORY. Two earlier cuts both still took Module A's write lock around the mutation and only tightened HOW
 * that wait behaved:
 *   1. The very first cut used `withWriteLock(root, fn, {})` — an unbounded (raw 600s `acquireWrite` default)
 *      wait. A live operator `add --pinned` run against `wev-review-daemon` sat silently for 8+ minutes,
 *      refusing every daemon sharing that clone on every tick (xa4qo7n).
 *   2. xa4qo7n bounded that wait to `WE_DAEMON_OVERLAY_LOCK_WAIT_MS` (default 30s) and logged it. That
 *      shortened the freeze but did not remove it: whenever the daemon's OWN rebuild (which runs on every
 *      tick — often) held the writer slot, `add` still failed outright with `concurrent-mover`, no wait at
 *      all, because `acquireWrite` refuses immediately when another live writer already holds the key. Live
 *      2026-09-26: PR #2760 (`lane/4229-fix-dispatch-a-pr-refused-queue-cap-for-too-long-is-surfaced`) failed
 *      to register 4 times in a row this way, and an earlier `add` that DID win the race then hung holding the
 *      writer slot through its own readers-drain wait — freezing every other daemon on that clone meanwhile.
 * Both fixes treated the SYMPTOM (how long/loud the wait is). The actual fix is that this CLI never needed the
 * clone's lock in the first place — it never reads or writes anything inside the clone's working tree.
 *
 * IF SOMETHING EVER NEEDS "REGISTER AND ALSO APPLY RIGHT NOW, SYNCHRONOUSLY": that is a different, explicit
 * operation, not a hidden default here. `scripts/lib/daemon-load-overlay.mjs` already IS that — it registers
 * the ref (via the same `addOverlay`, Module B) and then runs a full gated `rebuildClone` (Module C, live-smoke
 * + adopt/rollback) under the clone's write lock, on purpose, as a one-shot manual CLI. A caller that truly
 * needs THIS CLI's mutation itself serialized with the clone's tree (rare — no current caller does) can already
 * compose that explicitly with `node scripts/lib/daemon-clone-lock.mjs hold --clone=<path> -- node
 * scripts/daemon-overlay.mjs add ...`, which takes the write lock around an arbitrary command. Nothing in this
 * file does that implicitly any more.
 *
 * USAGE:
 *   node scripts/daemon-overlay.mjs add    --clone=<path> --ref=<branch> [--pr=N] [--pinned|--unpinned] [--reason=..] [--by=..] [--json]
 *   node scripts/daemon-overlay.mjs remove --clone=<path> --ref=<branch> [--reason=..] [--by=..] [--json]
 *   node scripts/daemon-overlay.mjs list   --clone=<path> [--json]
 *
 * `--by` defaults to `$USER`. Every command prints the resulting list (remove also reports whether the ref was
 * actually present). `--no-lock` is still accepted (a no-op) so any older caller/script that still passes it
 * keeps working unchanged. Exit codes: 2 on bad usage (unknown command, missing `--clone`, `add`/`remove`
 * missing `--ref`, non-integer `--pr`); 1 on a fatal error (e.g. a corrupt overlay state file — `addOverlay`/
 * `removeOverlay` refuse to overwrite one); 0 otherwise — including a `remove` of a ref that was never present,
 * which is not a usage error.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { addOverlay, removeOverlay, readOverlayState, appendOverlayEvent } from './lib/daemon-overlays.mjs';
import { edgeEnabled, registerPr } from './lib/daemon-edge.mjs';

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
  const asJson = !!flags.json;
  const env = process.env;

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
    // Register-only: `addOverlay` (Module B) does its own atomic read-modify-write under the list's own tiny
    // mutex and returns immediately — this never touches the clone's tree or its reader/writer lock. See the
    // file header for why that lock was dropped here.
    const list = addOverlay(root, {
      ref: flags.ref, pr, addedBy: by, reason, pinned,
    }, { env });
    appendOverlayEvent(root, {
      kind: 'added', ref: flags.ref, pr, by, reason, ...(pinned !== undefined ? { pinned } : {}),
    }, { env });
    output = { list };
    // daemon-edge slice 1 (epic x59tqsg): ONLY with WE_DAEMON_EDGE=1 (default off) is the PR also registered
    // for the kept `daemon-edge` branch (admission check vs main + edge). Flag off ⇒ this block never runs.
    if (edgeEnabled(env) && pr != null) {
      const url = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
      output.edge = url.status === 0
        ? registerPr({ pr, ref: flags.ref, remoteUrl: String(url.stdout).trim(), env, by, reason })
        : { ok: false, reason: 'no-origin-url' };
    }
  } else {
    const { removed, list } = removeOverlay(root, flags.ref, { env, why: reason || 'operator' });
    if (removed) appendOverlayEvent(root, { kind: 'removed', ref: flags.ref, by, reason }, { env });
    output = { removed, list };
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
