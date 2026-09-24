/**
 * @file node-spy.mjs — a `node` on `PATH` that records every script it is asked to run, then runs it (#x7xv2xt).
 *
 * WHY. The readiness CLIs shell their collectors as `node <script> …` through `PATH`. A fixture harness that
 * wants to PROVE it never touched the real lane pool needs to see which scripts were actually started — not
 * trust that a flag was honored. This shim logs each call's argv (one JSON line per call) and then `exec`s the
 * real node binary, so behavior is unchanged. Mirrors `fake-gh.mjs`: a real executable prepended onto `PATH`.
 */
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * @returns {{ env: {PATH: string, NODE_SPY_LOG: string}, scripts: () => string[], cleanup: () => void }}
 *   `scripts()` = the first argv entry of every recorded call (the script path, for `node <script>` calls).
 */
export function withNodeSpy() {
  const dir = mkdtempSync(join(tmpdir(), 'node-spy-'));
  const logPath = join(dir, 'calls.log');
  writeFileSync(logPath, '', 'utf8');
  const bin = join(dir, 'node');
  const realNode = process.execPath.replace(/'/g, `'\\''`);
  writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$1" >> "$NODE_SPY_LOG"\nexec '${realNode}' "$@"\n`, 'utf8');
  chmodSync(bin, 0o755);
  return {
    env: { PATH: `${dir}:${process.env.PATH}`, NODE_SPY_LOG: logPath },
    scripts: () => readFileSync(logPath, 'utf8').split('\n').filter(Boolean),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
