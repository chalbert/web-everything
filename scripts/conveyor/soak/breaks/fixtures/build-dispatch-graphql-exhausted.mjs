#!/usr/bin/env node
/**
 * Soak fixture for breaks/build-dispatch-graphql-exhausted.mjs — calls the build-dispatch daemon's OWN
 * `cliFetchOpenPrs()` (its per-tick open-PR read, once per constellation repo) against whatever PATH-faked `gh`
 * the break wired up, and reports success/failure as JSON on stdout instead of throwing across the
 * child-process boundary.
 *   node build-dispatch-graphql-exhausted.mjs <repoRoot>
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [, , repoRoot] = process.argv;
const daemon = await import(pathToFileURL(join(repoRoot, 'skills-src/conveyor/build-dispatch-daemon.mjs')).href);

try {
  const rows = await daemon.cliFetchOpenPrs();
  process.stdout.write(`${JSON.stringify({
    ok: true,
    repos: rows.map((r) => ({ repo: r.repo, count: Array.isArray(r.prs) ? r.prs.length : -1 })),
  })}\n`);
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: String(e?.message || e).split('\n')[0] })}\n`);
}
