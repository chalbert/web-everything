/**
 * @file clock.mjs — epic #3383 part 5. The scenario-facing handle over the sim clock: mints a clock file, hands
 * back the env fragment that puts {@link ./fake-clock-preload.mjs} into a child process's `NODE_OPTIONS`, and
 * lets the scenario runner jump time (`advance('31m')`) or stamp a file's mtime to the sim's current instant
 * (`touch`, for a transcript or a lease marker whose AGE a decision reads).
 *
 * THE FILE IS THE SOURCE OF TRUTH, atomically written (tmp + rename, the same discipline every other store in
 * this simulator uses — see `fake-gh.mjs`'s own header for why: a reader must never observe a half-written
 * JSON object). `advance` rewrites it and then reloads THIS process's own in-process clock (via
 * `globalThis.__simClock.reload()`, a no-op if this process never loaded the preload itself) — a long-lived
 * daemon host (part 4) is expected to call `globalThis.__simClock.reload()` itself once per tick, independent
 * of this call, so its view of the offset is never more than one tick stale even though nothing here pushes to
 * it.
 *
 * `now()` PREFERS THE IN-PROCESS SIM CLOCK WHEN ONE IS LOADED (`globalThis.__simClock`), and falls back to
 * `realNow + offsetMs` otherwise. The two agree by construction — `globalThis.__simClock.now()` computes the
 * identical formula — so this is just "don't compute it twice when the answer is already sitting in
 * `globalThis`", not two different notions of now.
 */

import { mkdtempSync, renameSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the preload — hand this to `NODE_OPTIONS=--import=<preloadPath>` for any child process
 *  that should observe the sim clock. */
export const PRELOAD_PATH = resolve(HERE, 'fake-clock-preload.mjs');

const DURATION_RE = /^(-?\d+(?:\.\d+)?)(ms|s|m|h|d)?$/;
const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Parse `'31m'` / `'2h'` / a bare number (already ms) into milliseconds. Exported so a scenario/test can reuse
 * the same grammar without going through a whole clock instance.
 * @param {string|number} input
 * @returns {number}
 */
export function parseDurationMs(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error(`sim clock: not a finite duration: ${input}`);
    return input;
  }
  const s = String(input).trim();
  const m = DURATION_RE.exec(s);
  if (!m) throw new Error(`sim clock: cannot parse duration ${JSON.stringify(input)} — expected e.g. '31m', '2h', '500ms', or a bare number of ms`);
  const n = Number(m[1]);
  const unit = m[2] || 'ms';
  return n * UNIT_MS[unit];
}

function writeOffsetAtomic(file, offsetMs) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify({ offsetMs }), 'utf8');
  renameSync(tmp, file);
}

/**
 * Mint (or bind to) a sim clock.
 * @param {{file?: string, startOffsetMs?: number}} [o] - `file` defaults to a fresh temp file; a scenario
 *   world (part 1) is expected to pass its own path inside the scenario root so every child process's `env`
 *   can point at the SAME file.
 * @returns {{
 *   env: {SIM_CLOCK_FILE: string, NODE_OPTIONS: string},
 *   now: () => number,
 *   advance: (d: string|number) => number,
 *   offsetMs: () => number,
 *   touch: (path: string) => void,
 *   preloadPath: string,
 * }}
 */
export function createSimClock({ file, startOffsetMs = 0 } = {}) {
  const clockFile = file ?? join(mkdtempSync(join(tmpdir(), 'sim-clock-')), 'clock.json');
  let offsetMs = startOffsetMs;
  writeOffsetAtomic(clockFile, offsetMs);

  const now = () => (globalThis.__simClock ? globalThis.__simClock.now() : Date.now() + offsetMs);

  return {
    // `NODE_OPTIONS` is a FRAGMENT (`--import=<path>`), not a full replacement — a caller that already sets its
    // own `NODE_OPTIONS` (another `--import`, a `--max-old-space-size`, …) must join them with a space rather
    // than overwrite. Kept this way, rather than merged with `process.env.NODE_OPTIONS` here, because this
    // function has no way to know which `NODE_OPTIONS` the CALLER's eventual child spawn will already carry.
    env: { SIM_CLOCK_FILE: clockFile, NODE_OPTIONS: `--import=${PRELOAD_PATH}` },
    preloadPath: PRELOAD_PATH,
    now,
    /**
     * Jump the clock by a signed duration (or to an absolute ms delta from real-now, if you pass a negative
     * number to walk it back). Rewrites the file, then reloads THIS process's own clock if it has one loaded.
     * @param {string|number} d
     * @returns {number} the new total offset, in ms
     */
    advance(d) {
      offsetMs += parseDurationMs(d);
      writeOffsetAtomic(clockFile, offsetMs);
      if (globalThis.__simClock?.reload) globalThis.__simClock.reload();
      return offsetMs;
    },
    offsetMs: () => offsetMs,
    /** Stamp a file's atime/mtime to the sim's current instant — for a transcript or lease marker whose AGE a
     *  decision reads, so file age agrees with the fake clock rather than the real wall clock. */
    touch(path) {
      const d = new Date(now());
      utimesSync(path, d, d);
    },
  };
}
