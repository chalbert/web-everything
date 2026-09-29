#!/usr/bin/env node
/**
 * Soak fixture for breaks/lease-reaper-graphql-unattributed.mjs — calls the resident `lease-reaper` daemon's OWN
 * PR-terminal read (`fetchPrStatesForRepo`, once per constellation repo with a held lease, every tick) against
 * whatever PATH-faked `gh` the break wired up, with NO `exec` override — i.e. exactly the daemon's own default
 * path, never a hand-injected fake bypassing the real default. Reports success/failure as JSON on stdout instead
 * of throwing across the child-process boundary.
 *   node lease-reaper-graphql-unattributed.mjs <repoRoot>
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [, , repoRoot] = process.argv;
const mod = await import(pathToFileURL(join(repoRoot, 'scripts/conveyor/lease-reaper.mjs')).href);

try {
  const states = mod.fetchPrStatesForRepo('we', {}, {});
  process.stdout.write(`${JSON.stringify({
    ok: true,
    axisOn: states !== null,
    itemCount: states ? states.byItem.size : 0,
  })}\n`);
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: String(e?.message || e).split('\n')[0] })}\n`);
}
