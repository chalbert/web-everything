#!/usr/bin/env node
/**
 * @file scripts/conveyor/driver-mode.mjs
 * @description THE DRIVER-MODE MARKER (epic #3383) — a two-field sidecar recording whether the conveyor runner
 *   in this checkout was launched **resident** (the supervisor's always-on driver: loop forever, tick after
 *   tick) or **bounded** (`--once` / `--max-ticks=N`: run that many ticks and exit). Nothing else in the repo
 *   records that distinction, and without it a bounded driver's perfectly correct exit is indistinguishable
 *   from a resident driver's crash.
 *
 * ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────────────────────────────────────
 *
 * {@link ./driver-watchdog.mjs#classifyDriver} answers "is this driver up?" from the machine-global singleton
 * lease alone. No live lease ⇒ `down`, and its message asserted, unconditionally, *"That is a crash, not silent
 * staleness"*. Observed live on 2026-09-12: a driver deliberately started `--once` ran its one tick, dispatched
 * a real item, exited 0, and released its lease CLEANLY (`held:false, stale:false`) — and the watchdog logged
 * "crash" every five minutes, forever, about a process that had done exactly what it was asked to do.
 *
 * Two facts were missing, and this file supplies the first:
 *   1. **Was it supposed to keep running?** Only the launcher knows, so the launcher records it — here.
 *   2. **Did it die or did it leave?** Already knowable and already computed: a crashed holder leaks its lease
 *      and the TTL sweeps it (`stale:true`); a clean exit releases it (`stale:false`). The watchdog was
 *      discarding that distinction, and now reads it.
 *
 * ── WHY A SEPARATE MODULE ───────────────────────────────────────────────────────────────────────────────────
 *
 * The WRITER is {@link ../../skills-src/conveyor/runner.mjs} (it alone knows how it was invoked) and the READER
 * is {@link ./driver-watchdog.mjs} — whose entire design rests on reaching NONE of the driver's decision logic
 * (a bug in the driver must not be able to disable the thing that catches it; its suite asserts the import
 * graph). So the two cannot import each other. What they share instead is only this sidecar's GRAMMAR, the
 * same carve-out {@link ./queue-store.mjs}'s `parseQueue` already has: a second, looser parser on the reading
 * side would disagree with the writer about what was even recorded, which is a worse failure than the one being
 * fixed. This file holds no judgment — no lease reading, no classification, no dispatch anything. Path, parse,
 * write.
 *
 * ── FAIL-BACKWARD, DELIBERATELY ─────────────────────────────────────────────────────────────────────────────
 *
 * A checkout with NO marker (every driver not yet restarted onto this code) parses to `null`, and `null` means
 * "assume resident" — byte-identical to the pre-#3383 verdict. Same for a corrupt marker, an unknown `mode`
 * string, or an unreadable file. The marker can only ever make the watchdog QUIETER about a driver that was
 * *told* to stop; it can never silence a resident driver's genuine crash, because a resident marker and a
 * missing marker take the identical path.
 *
 * SHAPE: `{ mode: 'bounded'|'resident', startedAt: <ISO>, pid: <number|null>, maxTicks: <number|null> }`.
 * `maxTicks` is advisory context for a human reading the file; nothing decides on it.
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

/** The two launch postures. RESIDENT = "keep driving until stopped" (the supervisor's driver). BOUNDED = "run
 *  N ticks and exit" (`--once`, `--max-ticks=N`) — a finish, not a failure, when it goes away. */
export const DRIVER_MODES = Object.freeze(['bounded', 'resident']);

/** What a missing/corrupt/unknown marker is read as. See the header: the no-marker case must stay byte-
 *  identical to the pre-#3383 behaviour, and that behaviour assumed every driver was resident. */
export const DEFAULT_DRIVER_MODE = 'resident';

/** The marker's path, beside the queue it describes and the watchdog's own sidecars. */
export function driverModePath(root) {
  return join(resolve(root), '.conveyor', 'driver-mode.json');
}

/**
 * WHICH POSTURE DID THESE FLAGS ASK FOR? PURE.
 *
 * Bounded iff the launch put a FINITE ceiling on the tick count — `--once` (which is `--max-ticks=1`) or an
 * explicit finite `--max-ticks=N`. Everything else, including a non-numeric or non-positive `--max-ticks` the
 * runner itself would fall back to `Infinity` on, is resident. Mirrors `runner.mjs#main`'s own
 * `flags.once ? 1 : finiteOr(flags['max-ticks'], Infinity)` — asserted against it in the suite rather than
 * trusted to stay in step by hand.
 *
 * @param {{once?:boolean, maxTicks?:number}} o
 * @returns {'bounded'|'resident'}
 */
export function driverModeFor({ once = false, maxTicks = Infinity } = {}) {
  if (once) return 'bounded';
  const n = Number(maxTicks);
  return Number.isFinite(n) && n > 0 ? 'bounded' : 'resident';
}

/**
 * Tolerant parse of the marker's text → a normalized record, or `null`. NEVER throws: empty, bad JSON, an
 * array, a missing/unknown `mode` all degrade to `null`, which every reader treats as
 * {@link DEFAULT_DRIVER_MODE}. A marker we cannot understand must never be more powerful than no marker.
 * @param {string|null|undefined} text
 * @returns {{mode:'bounded'|'resident', startedAt:string|null, pid:number|null, maxTicks:number|null}|null}
 */
export function parseDriverMode(text) {
  if (!text || !String(text).trim()) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const mode = String(raw.mode ?? '').trim().toLowerCase();
  if (!DRIVER_MODES.includes(mode)) return null;
  const pid = Number(raw.pid);
  const maxTicks = Number(raw.maxTicks);
  return {
    mode,
    startedAt: raw.startedAt == null ? null : String(raw.startedAt),
    pid: Number.isFinite(pid) && pid > 0 ? pid : null,
    maxTicks: Number.isFinite(maxTicks) && maxTicks > 0 ? maxTicks : null,
  };
}

/** Read + parse the marker for `root`. `null` for absent/unreadable/corrupt — never a throw, never a guess. */
export function readDriverMode(root, read = (p) => readFileSync(p, 'utf8')) {
  try { return parseDriverMode(read(driverModePath(root))); } catch { return null; }
}

/**
 * Record the posture this runner was launched in. Atomic temp+rename (the sidecar convention
 * `queue-store.mjs#writeQueueFile` sets) so a watchdog reading mid-write never sees partial JSON — which,
 * parsing to `null`, would read as "no marker" and put us straight back into the bug.
 *
 * BEST-EFFORT BY CONTRACT: the caller is the runner's startup path, and a runner that refused to start because
 * it could not write an observability sidecar would be a far worse bug than the one this fixes. Errors are
 * returned, never thrown.
 *
 * @returns {{ok:boolean, path:string, record:object|null, error:string|null}}
 */
export function writeDriverMode({
  root, mode, maxTicks = null, pid = null, now = () => Date.now(),
  write = (p, s) => writeFileSync(p, s), mkdir = mkdirSync, rename = renameSync,
} = {}) {
  const path = driverModePath(root);
  if (!DRIVER_MODES.includes(mode)) {
    return { ok: false, path, record: null, error: `driver-mode: ${JSON.stringify(mode)} is not one of ${DRIVER_MODES.join('/')}` };
  }
  const ticks = Number(maxTicks);
  const record = {
    mode,
    startedAt: new Date(now()).toISOString(),
    pid: Number.isFinite(Number(pid)) && Number(pid) > 0 ? Number(pid) : null,
    maxTicks: Number.isFinite(ticks) && ticks > 0 ? ticks : null,
  };
  try {
    mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${record.pid ?? 0}.${now()}.tmp`;
    write(tmp, JSON.stringify(record, null, 2) + '\n');
    rename(tmp, path);
    return { ok: true, path, record, error: null };
  } catch (e) {
    return { ok: false, path, record, error: String(e?.message ?? e).split('\n')[0] };
  }
}
