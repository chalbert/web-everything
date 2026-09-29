/**
 * @file probe-wiring.test.mjs — every probe id a smell declares (`probes: [...]`) must actually be populated by
 * `we:scripts/conveyor/health-watch.mjs#tick`. A smell tested only through its own `evaluate` (and a probe tested
 * only in isolation) stays green even when the one `probes.<id> = attempt(...)` line in `tick()` that connects
 * them is deleted or renamed — the smell then silently never fires in production (#4317 advisory review,
 * 2026-09-29: `untrackedBacklogCards`, and the same gap for `ghShimLanes`).
 *
 * The real, on-disk smell registry is read through a plain `node` subprocess, for the same reason
 * `index-discovery.test.mjs` does. `tick()`'s own wiring is read from its source text: running `tick()` for real
 * would touch the host's real daemon clones, lease dirs and GitHub, so a static read of the assignment sites is
 * the deterministic check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SMELLS_INDEX = join(HERE, '..', 'index.mjs');
const HEALTH_WATCH = join(HERE, '..', '..', 'health-watch.mjs');

/** PURE. Every `probes.<id> =` / `probes.<id> ??=` assignment site in `source`. */
export function probeIdsAssignedIn(source) {
  return new Set([...String(source).matchAll(/\bprobes\.([A-Za-z_$][\w$]*)\s*(?:\?\?)?=(?!=)/g)].map((m) => m[1]));
}

function declaredProbes() {
  const script = `import { SMELLS } from ${JSON.stringify(pathToFileURL(SMELLS_INDEX).href)};`
    + 'process.stdout.write(JSON.stringify(SMELLS.map((s) => [s.id, s.probes || []])));';
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }));
}

describe('health smells — declared probes are wired into tick()', () => {
  it('probeIdsAssignedIn finds plain and ??= assignments, never comparisons', () => {
    const ids = probeIdsAssignedIn('probes.a = 1;\nprobes.b ??= 2;\nif (probes.c === 3) {}\nprobes.d == 4;');
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('every probe id any smell declares is assigned by tick()', () => {
    const assigned = probeIdsAssignedIn(readFileSync(HEALTH_WATCH, 'utf8'));
    const missing = declaredProbes()
      .flatMap(([id, probes]) => probes.filter((p) => !assigned.has(p)).map((p) => `${id} → ${p}`));
    expect(missing).toEqual([]);
  });

  it('the #4317 probe itself is covered: untracked-backlog-card declares untrackedBacklogCards', () => {
    const entry = declaredProbes().find(([id]) => id === 'untracked-backlog-card');
    expect(entry?.[1]).toContain('untrackedBacklogCards');
  });
});
