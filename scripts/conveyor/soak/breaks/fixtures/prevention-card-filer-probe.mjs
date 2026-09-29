#!/usr/bin/env node
/**
 * @file fixtures/prevention-card-filer-probe.mjs — #4075 soak harness fixture for
 * `breaks/prevention-card-lands-in-daemon-clone.mjs`. Calls the REAL production
 * `fileApprovalPreventionCard` (`scripts/review-set-label.mjs`) from a SEPARATE process whose own cwd IS the
 * checkout under test — never re-implemented, never stubbed on the seam this break exists to prove.
 *
 * On a PRE-#4317 tree, `fileApprovalPreventionCard`'s second argument only destructures `{exec}` — no `root`,
 * no `runScript` — so the two extra flags below are silently ignored there and the call falls straight through
 * to its real default (`execFileSyncThrottled`), shelling `node scripts/operations/run.mjs file-item …` with
 * NO cwd override, inheriting THIS PROCESS's own cwd exactly as production does. On a POST-#4317 tree, those
 * same two flags are honored: `runScript` points at `prevention-card-noop-job.mjs` (a harmless stand-in for
 * the real landing job — see that file's own header for why), and the REAL `defaultSpawnDetached` still runs,
 * genuinely spawning it. Either way this fixture exercises the real function, unmodified.
 *
 * argv: <modulePath> <inputJson> <noopJobPath>
 * Prints the `fileApprovalPreventionCard()` result as one JSON line to stdout.
 */
import { pathToFileURL } from 'node:url';

const [, , modulePath, inputJson, noopJobPath] = process.argv;

async function main() {
  const mod = await import(pathToFileURL(modulePath).href);
  const input = JSON.parse(inputJson);
  return mod.fileApprovalPreventionCard(input, { runScript: noopJobPath, logPathFor: () => '/dev/null' });
}

main().then(
  (result) => { process.stdout.write(`${JSON.stringify(result ?? null)}\n`); },
  (e) => {
    process.stderr.write(`prevention-card-filer-probe: threw: ${String((e && e.stack) || e)}\n`);
    process.stdout.write('null\n');
    process.exitCode = 1;
  },
);
