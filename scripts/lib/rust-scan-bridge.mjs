/**
 * rust-scan-bridge.mjs — the ONE call site that invokes the optional `we-scan` Rust binary (#3417),
 * falling back to the caller's JS implementation whenever it's unavailable: unbuilt (no
 * `cargo build --release` ever run in `scripts/rust-scan`), stale, or erroring. Never throws — a Rust
 * problem must never break `check:standards` itself, only forfeit its speedup for that run.
 *
 * `runWeScan` returns the SAME shape `we-scan`'s JSON output already matches its JS counterpart's return
 * value (verified byte-identical by `scripts/__tests__/rust-scan-*-parity.test.mjs`), so a caller does
 * `runWeScan(...) ?? theJsFunction(...)` and needs no other change.
 *
 * Concurrency (`--max-workers`) is NOT passed here — `we-scan` reads `WE_SCAN_MAX_WORKERS` itself when the
 * flag is omitted (default: a fixed 3, until the planned operation manager sets the env var per run). This
 * bridge stays a pure pass-through of that control, not a second place it could drift from the binary's own.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BIN = join(HERE, '..', 'rust-scan', 'target', 'release', 'we-scan');

/**
 * Build a `runWeScan`-shaped function bound to a specific binary path — the injection seam a test uses to
 * exercise the missing/erroring fallback paths without needing a real `cargo build` (see
 * scripts/lib/__tests__/rust-scan-bridge.test.mjs). `runWeScan` below is just this bound to the real path.
 * @param {string} binPath
 * @returns {(subcommand: string, args: string[]) => unknown|null}
 */
export function createWeScanRunner(binPath) {
  // One notice per RUNNER, not per call — check-standards.mjs calls this from more than one section, and a
  // missing binary is one fact worth stating once, not once per subcommand.
  let warnedMissing = false;
  return function runWeScan(subcommand, args) {
    if (!existsSync(binPath)) {
      if (!warnedMissing) {
        warnedMissing = true;
        process.stderr.write(
          `note: ${binPath} not built — falling back to the JS scan(s) it would otherwise replace (run ` +
          '`cargo build --release` in scripts/rust-scan for the faster, parallel path)\n',
        );
      }
      return null;
    }
    try {
      const out = execFileSync(binPath, [subcommand, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
      return JSON.parse(out);
    } catch (e) {
      process.stderr.write(`note: we-scan ${subcommand} failed (${e.message}) — falling back to the JS scan\n`);
      return null;
    }
  };
}

/**
 * Run a `we-scan` subcommand and return its parsed JSON, or `null` on ANY failure (binary missing, a stale
 * build from before a source change with no rebuild, non-zero exit, unparseable stdout). `null` is the
 * whole contract: "fall back to the JS scan", never a thrown error a caller has to handle.
 * @param {string} subcommand e.g. 'stdout-flush', 'secret-scrub'
 * @param {string[]} args e.g. [`--root=${ROOT}`]
 * @returns {unknown|null}
 */
export const runWeScan = createWeScanRunner(DEFAULT_BIN);
