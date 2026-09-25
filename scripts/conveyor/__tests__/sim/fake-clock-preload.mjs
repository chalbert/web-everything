/**
 * @file fake-clock-preload.mjs — epic #3383 part 5 (the simulator's clock). A `--import` PRELOAD, meant to be
 * loaded into EVERY node process a scenario runs — the daemon hosts, the pass-script children they spawn, the
 * fake `claude`/`gh` shims, and any `node -e` a test spawns directly — via
 * `NODE_OPTIONS=--import=<abs path to this file>`. Loaded through `--import` (not `-r`/`require`) because this
 * file is itself an ES module and every consumer in this repo is `.mjs`.
 *
 * WHY A FILE OFFSET, NOT AN ENV VAR. An env var set once at spawn time is frozen for that process's whole life;
 * the simulator's clock needs to JUMP mid-scenario (`clock.advance('31m')`) and have every ALREADY-RUNNING
 * process — in particular the long-lived daemon hosts (`daemon-host.mjs`, part 4) — see the jump on its next
 * tick without being respawned. A file `{@link module:clock.mjs}` rewrites atomically and this preload re-reads
 * gives that: `globalThis.__simClock.reload()` is the seam a host calls once per tick.
 *
 * NO-OP WHEN `SIM_CLOCK_FILE` IS UNSET, entirely — not even a `Date` subclass is installed. Every non-simulator
 * node process in this repo (the whole rest of the test suite, `npm run *`, a developer's own shell) imports
 * nothing that reaches this file, but a preload is exactly the kind of thing that is easy to leave wired into a
 * shared launch config by accident, so the unset case is a true no-op, not "installs a pass-through subclass".
 *
 * WHAT IS REPLACED, AND WHAT IS DELIBERATELY NOT:
 *   - `Date.now()` / `new Date()` (the ZERO-ARG constructor only) — both read `realNow() + offsetMs`.
 *   - `new Date(undefined)` is NOT simulated — the design brief is explicit ("only zero-arg"), and it matters:
 *     `undefined` is a value a caller can pass BY ACCIDENT (a destructured field that was never set), and its
 *     native behaviour is `Invalid Date` — a caller relying on that native footgun-as-signal must keep seeing
 *     it, unaffected by the simulator being loaded at all.
 *   - `Date.parse`, `Date.UTC` and every `Date.prototype` method (`getTime`, `toISOString`, …) are UNTOUCHED —
 *     inherited from the real `Date` via `class SimDate extends Date`, never overridden, so a timestamp string
 *     parses exactly as it would with no preload loaded and an already-constructed `Date` instance behaves
 *     identically regardless of which constructor made it.
 *   - `performance.now()` is UNTOUCHED — it is a monotonic clock for measuring durations, not a wall-clock
 *     reading, and nothing in the daemon code under test reads it as if it were one.
 *
 * `globalThis.__simClock` is the one integration point a long-lived host needs: `.now()` for a fresh reading,
 * `.offsetMs` for the current offset, `.reload()` to re-read the file (called once per tick by `daemon-host.mjs`
 * — part 4 — rather than trusting this preload to notice a file change on its own; node gives us no free file-
 * watch primitive worth trusting inside a test harness).
 */

import { readFileSync } from 'node:fs';

const SIM_CLOCK_FILE = process.env.SIM_CLOCK_FILE;

/** Read `{offsetMs}` from the clock file. Any failure (missing file, a write caught mid-rename, garbage) reads
 *  as offset zero — never throws, because a preload that can crash every child process in a scenario over a
 *  torn read of its OWN bookkeeping file would be a worse failure mode than a one-tick-late offset. */
function readOffsetMs() {
  try {
    const raw = readFileSync(SIM_CLOCK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const n = Number(parsed?.offsetMs);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

if (SIM_CLOCK_FILE) {
  const RealDate = globalThis.Date;
  const realNowMs = RealDate.now.bind(RealDate);

  let offsetMs = readOffsetMs();
  const simNowMs = () => realNowMs() + offsetMs;

  /**
   * A REAL subclass of the platform `Date`, not a hand-rolled look-alike — so every prototype method
   * (`getTime`, `toISOString`, `getDay`, …) and every static (`parse`, `UTC`) is the genuine implementation,
   * inherited automatically by `extends`, and instances remain `instanceof Date` for any code (including
   * native internals) that checks.
   */
  class SimDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(simNowMs());
      } else {
        super(...args);
      }
    }

    static now() {
      return simNowMs();
    }
  }

  globalThis.Date = SimDate;

  globalThis.__simClock = {
    now: () => simNowMs(),
    get offsetMs() {
      return offsetMs;
    },
    reload() {
      offsetMs = readOffsetMs();
      return offsetMs;
    },
  };
}
