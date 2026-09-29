#!/usr/bin/env node
/**
 * Soak fixture for breaks/already-done-burst-unattributed.mjs — calls the dispatch-plan already-done pass's
 * OWN concurrent reader (`defaultCheckAlreadyDoneAsync`, `scripts/operations/dispatch-lane-io.mjs`) the exact
 * way `dispatch-plan.mjs` itself does — `Promise.all` over many ids, no concurrency cap of its own — against
 * whatever PATH-faked `gh` the break wired up, with NO `execFileFn` override, i.e. the real production default.
 * Reports success/failure as JSON on stdout instead of throwing across the child-process boundary.
 *   node already-done-burst-unattributed.mjs <repoRoot> <count>
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [, , repoRoot, countArg] = process.argv;
const count = Number(countArg) || 20;
const mod = await import(pathToFileURL(join(repoRoot, 'scripts/operations/dispatch-lane-io.mjs')).href);

try {
  const ids = Array.from({ length: count }, (_, i) => String(9_000_000 + i));
  const results = await Promise.all(ids.map((id) => mod.defaultCheckAlreadyDoneAsync(id)));
  process.stdout.write(`${JSON.stringify({
    ok: true,
    count: results.length,
    everyChecked: results.every((r) => r.checked === true),
  })}\n`);
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: String(e?.message || e).split('\n')[0] })}\n`);
}
