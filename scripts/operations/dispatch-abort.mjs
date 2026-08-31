#!/usr/bin/env node
/**
 * @file scripts/operations/dispatch-abort.mjs
 * @description SAFELY STOP AND CLOSE OUT ONE DISPATCHED AGENT — the recurring by-hand sequence from #3383's
 *   2026-08-31 live-fire session, mechanized (the operator's own request: "prefer the creation of operation
 *   for all recurring commands").
 *
 * WHAT WENT WRONG WITHOUT IT. That session stopped a stuck dispatched agent with a raw OS `kill <pid>` instead
 * of `claude stop <id>`. `kill` ends the process; it does not deregister the session, and whatever keeps
 * background sessions resumable (the same machinery that backs the mobile "remote agent" view) brought it back
 * under a NEW pid minutes later — twice, across two different scratch clones. One resurrection raced a second,
 * legitimate dispatch onto the same lane, producing a real double-dispatch onto `lane-5` (caught and cleaned up
 * by hand; no damage done, because the lane was still clean when found). `claude stop <id>` does not have this
 * problem — every stop that session issued through it never came back.
 *
 * THE COMPOSITION THIS FILE OWNS: stop, THEN close out — in that order, so `we:scripts/operations/wake.mjs`'s
 * own `assertHandleNotLive` passes NATURALLY instead of needing `--force`. `--force` exists for the case
 * `wake.mjs`'s header names — a listing that cannot be read, or an operator who already knows by other means
 * the agent is gone — not for "I did not stop it properly first." This file's whole job is to make the
 * properly-first path as easy to reach for as the unsafe one.
 *
 * TRUST IS A SEPARATE, SMALLER PIECE, same file because the same session hit both gaps back to back:
 * `we:scripts/bootstrap-session.mjs`'s own `trustableDirs()` only ever trusts the primary checkout and
 * lane-pool lanes — never an ad-hoc scratch clone, which is exactly what #3353's live-run protocol calls for
 * (a checkout named anything other than `lane-N`). A fresh scratch clone is therefore ALWAYS untrusted on
 * first use, and a dispatched agent spawned into it stalls on a permission-prompt dialog with nobody there to
 * answer it — the same class of failure the bootstrap's own `trust` step already exists to prevent for lanes,
 * just never extended to cover this one other place agents are spawned into. `trustCheckout` below reuses the
 * exact primitive (`withTrustedDirs`) the bootstrap step already uses, rather than re-deriving it.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO: release the lane a dispatch may have partially acquired. That is
 * one more judgement (is the lane actually clean? was ANYTHING started before the stop?) layered on top of two
 * already-real ones, and automating it risks silently discarding a dirty tree. `abortDispatch`'s report names
 * the lane from the effect's own payload when one was assigned, so the operator does not have to go looking —
 * releasing it stays a deliberate `node scripts/lane-pool.mjs release --lane=<n> --force` call.
 *
 * IO: `store`, `listAgents` and `exec` are all injected, exactly like `we:scripts/operations/wake.mjs` and
 * `we:scripts/operations/dispatch-lane-io.mjs`. The CLI block at the bottom is the only part that touches the
 * real filesystem, `claude agents --json`, `claude stop` and `~/.claude.json`.
 */

import { existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeOutEntry } from './wake.mjs';
import { defaultListAgents, listedSessionIds, normalizeHandle } from './dispatch-lane-io.mjs';
import { createFileRunStore } from './run-store.mjs';
import { TRUST_PATH, readJsonConfig, withTrustedDirs, untrustedDirs } from '../bootstrap-session.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/**
 * `claude stop <id>` — the ONLY way to end a background session that also deregisters it. A raw `kill <pid>`
 * ends the process but leaves the session resumable, which is the exact gap this file exists to close (see
 * the file header). Injectable `exec`, same shape as `we:scripts/operations/dispatch-lane-io.mjs`'s
 * `defaultSpawnAgent`.
 *
 * @param {{handle: string, exec?: Function}} o
 * @returns {{stopped: true, output: string}}
 */
export function stopSession({ handle, exec = execFileSync } = {}) {
  const id = normalizeHandle(handle);
  if (!id) throw new Error('dispatch-abort: stopSession needs a handle to stop');
  let output;
  try {
    output = String(exec('claude', ['stop', id], { encoding: 'utf8', timeout: 30_000 }));
  } catch (e) {
    throw new Error(`dispatch-abort: \`claude stop ${id}\` failed: ${String(e?.message ?? e).split('\n')[0]}`);
  }
  return { stopped: true, output };
}

/**
 * Grant checkout trust the SAME way `we:scripts/bootstrap-session.mjs`'s own `trust` step grants it for a lane
 * — one additive boolean per directory in `~/.claude.json`, backed up first. Reuses `withTrustedDirs` rather
 * than re-deriving the shape, so this can never drift from what the bootstrap step itself considers "trusted".
 *
 * PURE over the injected `readConfig`/`writeConfig`; the CLI block binds the real file.
 *
 * @param {{dir: string, readConfig: () => object|null, writeConfig: (next: object) => void}} o
 * @returns {string} one operator-facing line.
 */
export function trustCheckout({ dir, readConfig, writeConfig } = {}) {
  if (!dir) throw new Error('dispatch-abort: trustCheckout needs a directory');
  if (typeof readConfig !== 'function' || typeof writeConfig !== 'function') {
    throw new TypeError('dispatch-abort: trustCheckout needs injected readConfig/writeConfig — see the CLI block for the real binding');
  }
  const before = readConfig();
  if (before === null) return `dispatch-abort: could not read ${TRUST_PATH} — nothing trusted`;
  if (!untrustedDirs(before, [dir]).length) return `dispatch-abort: ${dir} already trusted`;
  writeConfig(withTrustedDirs(before, [dir]));
  return `dispatch-abort: trusted ${dir}`;
}

/**
 * THE COMPOSITION: stop the dispatched agent (if its handle is still listed live), THEN close its run record
 * out — in that order, so `wake.mjs`'s own `assertHandleNotLive` passes on its own merits and this never needs
 * `--force`. Mirrors `we:scripts/operations/wake.mjs#closeOutEntry`'s signature closely on purpose; this is
 * that function plus the one step tonight's session kept doing by hand in front of it.
 *
 * @param {object} o
 * @param {string} o.runId
 * @param {string} o.key - the effect key, exactly as `wake.mjs --status` printed it.
 * @param {'failed'|'applied'} [o.status]
 * @param {string} [o.note]
 * @param {{read: Function, write: Function}} o.store
 * @param {() => object[]} [o.listAgents]
 * @param {Function} [o.exec]
 * @returns {string} one operator-facing line, including a lane hint when the dispatch had one.
 */
export function abortDispatch({ runId, key, status = 'failed', note = '', store, listAgents = defaultListAgents, exec = execFileSync } = {}) {
  if (!runId || !key) throw new Error('dispatch-abort: needs both runId and key (wake.mjs --status prints them)');
  const run = store.read(runId);
  if (!run) throw new Error(`dispatch-abort: no run record for ${JSON.stringify(runId)}`);
  const entry = (run.effects || []).find((e) => e.key === key);
  if (!entry) throw new Error(`dispatch-abort: no effect ${JSON.stringify(key)} on run ${JSON.stringify(runId)}`);

  const handle = normalizeHandle(entry.handle);
  let stopLine = 'no handle to stop';
  if (handle) {
    const sessions = listAgents();
    const listed = Array.isArray(sessions) ? listedSessionIds(sessions) : new Set();
    if (listed.has(handle)) {
      stopSession({ handle, exec });
      stopLine = `stopped ${handle}`;
    } else {
      stopLine = `${handle} was not listed live — nothing to stop`;
    }
  }

  const closeLine = closeOutEntry({ runId, key, status, note, store, listAgents });
  const lane = entry?.payload?.lane;
  const laneHint = lane != null
    ? ` Lane ${lane} may still be leased from this dispatch — release it by hand once you've checked it: `
      + `\`node scripts/lane-pool.mjs release --lane=${lane} --force\` (only if it is clean).`
    : '';
  return `dispatch-abort: ${stopLine}; ${closeLine}${laneHint}`;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flagValue = (name) => {
    const hit = argv.find((a) => a === `--${name}` || String(a).startsWith(`--${name}=`));
    if (hit === undefined) return undefined;
    const eq = String(hit).indexOf('=');
    return eq === -1 ? '' : String(hit).slice(eq + 1);
  };

  const trustDir = flagValue('trust');
  if (trustDir !== undefined) {
    try {
      writeAllSync(1, `${trustCheckout({
        dir: resolve(trustDir),
        readConfig: () => readJsonConfig(TRUST_PATH),
        writeConfig: (next) => {
          if (existsSync(TRUST_PATH)) copyFileSync(TRUST_PATH, `${TRUST_PATH}.bak`);
          writeFileSync(TRUST_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        },
      })}\n`);
    } catch (e) {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    }
  } else {
    const runId = flagValue('abort');
    try {
      writeAllSync(1, `${abortDispatch({
        runId,
        key: flagValue('key'),
        status: flagValue('status') || 'failed',
        note: flagValue('note') || '',
        store: createFileRunStore(),
      })}\n`);
    } catch (e) {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    }
  }
}
