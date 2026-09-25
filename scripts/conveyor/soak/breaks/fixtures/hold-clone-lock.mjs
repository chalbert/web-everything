#!/usr/bin/env node
/**
 * @file fixtures/hold-clone-lock.mjs — #4075 soak harness fixture for `breaks/fix-daemon-lock-wait.mjs` and
 * `breaks/skipped-tick-ontick.mjs`. Holds a REAL read or write slot on a clone's `daemon-clone-lock.mjs`
 * (imported live from the sim clone under test — never reimplemented) in a SEPARATE process, for a fixed
 * duration, the way a sibling daemon's own long tick (a read slot) or an in-flight rebuild (the write slot)
 * holds it live. A `perRound` hook spawns this, waits for its ready marker, then lets the round's daemon ticks
 * run into the contention — the harness's own "a second checkout / a held lock" allowance
 * (`we:scripts/conveyor/soak/soak-brief-common.md`).
 *
 * argv: <mode: read|write> <lockModulePath> <cloneRoot> <durationMs> <readyMarkerPath> [lockRoot]
 */
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const [, , mode, lockModulePath, cloneRoot, durationMs, readyMarkerPath, lockRoot] = process.argv;
const lockMod = await import(pathToFileURL(lockModulePath).href);
const opts = lockRoot ? { lockRoot } : {};

async function main() {
  if (mode === 'read') {
    const res = lockMod.acquireRead(cloneRoot, opts);
    if (!res.ok) {
      process.stderr.write(`hold-clone-lock: acquireRead refused: ${JSON.stringify(res)}\n`);
      process.exitCode = 1;
      return;
    }
    writeFileSync(readyMarkerPath, 'ready');
    await new Promise((r) => { setTimeout(r, Number(durationMs)); });
    lockMod.releaseRead(cloneRoot, opts);
  } else if (mode === 'write') {
    const res = await lockMod.acquireWrite(cloneRoot, opts);
    if (!res.ok) {
      process.stderr.write(`hold-clone-lock: acquireWrite refused: ${JSON.stringify(res)}\n`);
      process.exitCode = 1;
      return;
    }
    writeFileSync(readyMarkerPath, 'ready');
    await new Promise((r) => { setTimeout(r, Number(durationMs)); });
    lockMod.releaseWrite(cloneRoot, opts);
  } else {
    process.stderr.write(`hold-clone-lock: unknown mode ${JSON.stringify(mode)}\n`);
    process.exitCode = 2;
  }
}

main();
