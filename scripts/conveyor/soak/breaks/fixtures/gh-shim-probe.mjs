#!/usr/bin/env node
/**
 * @file fixtures/gh-shim-probe.mjs — #4075 soak harness fixture for `breaks/gh-shim-mid-rebuild.mjs`. Calls the
 * REAL production gh-shim functions (`scripts/lib/gh-app-shim.mjs`, `scripts/operations/dispatch-lane-io.mjs`,
 * `scripts/lib/daemon-live-smoke.mjs`) from a SEPARATE process whose own `process.env`/`homedir()` is exactly
 * what the caller (the break's `perRound` hook) wants a real checkout/dispatch site to see — never reimplemented,
 * never mocked; only the orchestration (which checkout calls it, and when) is scenario-specific.
 *
 * argv: <mode: build-shim|resolve-dispatch-env|dispatched-session-env> <modulePath> [arg]
 *   build-shim             — arg = cwd (a checkout writing its OWN shim): calls buildGhShimSettingsEnv({cwd}).
 *   resolve-dispatch-env   — arg = cwd (a dispatch site): calls resolveGhShimSettingsEnv(cwd)
 *                            (scripts/operations/dispatch-lane-io.mjs).
 *   dispatched-session-env — calls ghDispatchedSessionEnv(process.env) (scripts/lib/daemon-live-smoke.mjs).
 * Prints the result as one JSON line to stdout; a thrown error exits 1 with the message on stderr and `null`
 * still printed to stdout so a caller's JSON.parse never has to special-case an empty pipe.
 */
import { pathToFileURL } from 'node:url';

const [, , mode, modulePath, arg] = process.argv;

async function main() {
  const mod = await import(pathToFileURL(modulePath).href);
  if (mode === 'build-shim') return mod.buildGhShimSettingsEnv({ cwd: arg });
  if (mode === 'resolve-dispatch-env') return mod.resolveGhShimSettingsEnv(arg);
  if (mode === 'dispatched-session-env') return mod.ghDispatchedSessionEnv(process.env);
  throw new Error(`gh-shim-probe: unknown mode ${JSON.stringify(mode)}`);
}

main().then(
  (result) => { process.stdout.write(`${JSON.stringify(result ?? null)}\n`); },
  (e) => {
    process.stderr.write(`gh-shim-probe: ${mode} threw: ${String((e && e.stack) || e)}\n`);
    process.stdout.write('null\n');
    process.exitCode = 1;
  },
);
