/**
 * @file scripts/lib/atomic-json-file.mjs
 * @description Small, generic write-temp-then-rename-then-validate helper for a JSON file multiple processes may
 *   read concurrently (e.g. `~/.claude.json`, the CLI's own per-directory trust registry) — a bare
 *   `writeFileSync` on the real path lets a concurrent reader observe a half-written file if it races the
 *   write; a `rename` on the SAME filesystem is atomic, so a reader only ever sees the old file or the new one,
 *   never a partial one. Built for card #4188 (bornAs `x5qketq`, epic #4075): the session reaper's
 *   dispatch-scratch trust revoke needed exactly this guarantee for a file that already holds every OTHER
 *   repo's per-project CLI state too, so corrupting it on a bad write is a much bigger blast radius than losing
 *   one script's own sidecar record.
 *
 * VALIDATES TWICE: once against the in-memory string before ever touching disk (a caller that handed this a
 * value `JSON.stringify` cannot render faithfully — a BigInt, a cyclic object — fails LOUD, before any write),
 * and once against the bytes actually read back off the temp file after `writeFileSync` returns (catches a
 * filesystem-level truncation the in-memory check can never see). Only then does the rename happen, so a
 * validation failure never leaves a corrupt temp file where a caller might mistake it for the real target, and
 * the real target path is never touched by a write that didn't fully verify first.
 *
 * NEVER SWALLOWS AN ERROR ITSELF — every failure here throws. A caller that wants this repo's usual
 * "best-effort, never blocks the caller" discipline (e.g. `grantDispatchTrust`'s own convention) wraps the call
 * in its own try/catch, exactly as that function already does for its writer.
 *
 * LOCK-SAFE, VIA {@link withFileLock} — LIVE-CAUGHT (2026-09-26): atomicity alone (temp+rename) prevents a
 * concurrent READER from ever seeing a torn file, but it does NOT prevent a LOST UPDATE between two concurrent
 * WRITERS each doing "read whole file, modify, write whole file" with no mutual exclusion. Proved live on this
 * exact machine: a real dispatch-scratch revoke pass reported 81 trust entries removed, but a re-read of
 * `~/.claude.json` moments later still carried every one of them — a concurrent `grantDispatchTrust` call (the
 * live daemon dispatching new sessions throughout the same window) had read its OWN stale pre-revoke snapshot
 * and written it straight back, silently reverting the revoke. {@link withFileLock} closes that gap for any
 * caller that wraps its read-modify-write in it.
 */
import { writeFileSync, renameSync, readFileSync, unlinkSync, openSync, writeSync, closeSync, statSync } from 'node:fs';
import { sleepSyncMs } from '../readiness/drain-lock.mjs';

/**
 * Write `data` to `path` as pretty JSON, atomically (temp file + rename), validating the JSON both before and
 * after the write.
 * @param {string} path
 * @param {unknown} data
 */
export function writeJsonAtomic(path, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  JSON.parse(text); // validate the in-memory render before any disk write — throws loud on unserializable input
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  try {
    JSON.parse(readFileSync(tmp, 'utf8')); // validate the BYTES ON DISK, not just the string still in memory
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* best-effort cleanup of the now-useless temp file */ }
    throw e;
  }
  renameSync(tmp, path); // same-filesystem rename — atomic; a concurrent reader never sees a partial file
}

/** How long {@link withFileLock} waits for a contended lock before giving up — generous for a `~/.claude.json`
 *  read-modify-write (a handful of small sync fs calls), never meant to cover a genuinely hung holder. */
const LOCK_TIMEOUT_MS_DEFAULT = 5_000;

/** Backoff between acquire attempts — short, since the critical section this guards is itself short. */
const LOCK_POLL_MS_DEFAULT = 25;

/** A lock file older than this is assumed ABANDONED (its holder crashed or was killed mid-section) and is
 *  stolen rather than honored forever — the same "never let one dead holder wedge every future writer"
 *  discipline this repo's own lease locks (`we:scripts/readiness/file-locks.mjs`) apply, scaled down for a
 *  section this short. */
const LOCK_STALE_MS_DEFAULT = 30_000;

/**
 * Run `fn` while holding an exclusive, cross-process lock on `lockPath` (a sibling `<path>.lock` file, by
 * convention) — the mutual-exclusion half {@link writeJsonAtomic}'s atomicity does NOT provide (see this file's
 * own header for the live incident that proved the gap). Acquisition is `open(path, 'wx')` — the one atomic
 * "create-if-absent" primitive `node:fs` offers — so two concurrent callers can never both believe they hold
 * it. A caller that cannot acquire within `timeoutMs` gets a loud throw, never a silent skip of the critical
 * section it asked to protect.
 *
 * STALE-LOCK TAKEOVER: a lock file older than `staleMs` is assumed abandoned and is removed before retrying —
 * without this, one process crashing mid-section (between acquire and release) would wedge every future writer
 * forever, a worse failure than the rare double-steal a takeover risks.
 * @param {string} lockPath
 * @param {() => any} fn
 * @param {{timeoutMs?: number, pollMs?: number, staleMs?: number}} [o]
 * @returns {any} whatever `fn` returns
 */
export function withFileLock(lockPath, fn, { timeoutMs = LOCK_TIMEOUT_MS_DEFAULT, pollMs = LOCK_POLL_MS_DEFAULT, staleMs = LOCK_STALE_MS_DEFAULT } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      try { writeSync(fd, `${process.pid}\n`); } finally { closeSync(fd); }
      break; // acquired
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e; // any other failure (no permission, bad path) — never silently proceed unlocked
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > staleMs) { unlinkSync(lockPath); continue; } // steal a dead holder's lock
      } catch { /* lock vanished between our stat and unlink, or between EEXIST and our stat — just retry acquire */ }
      if (Date.now() >= deadline) throw new Error(`withFileLock: timed out waiting for ${lockPath} (held by another process)`);
      sleepSyncMs(Math.min(pollMs, Math.max(0, deadline - Date.now())));
    }
  }
  try {
    return fn();
  } finally {
    try { unlinkSync(lockPath); } catch { /* best-effort release — a takeover after a crash still self-heals */ }
  }
}
