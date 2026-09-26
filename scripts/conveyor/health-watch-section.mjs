/**
 * @file scripts/conveyor/health-watch-section.mjs
 * @description #4077 — the HEALTH section the operator queue prints (`operator-queue.mjs --with-health`), read
 *   from the health watch's own store. A deliberately SMALL module (fs + the pure core only, no child_process),
 *   so importing it into the operator queue adds no process-spawning code to that file's import graph.
 *
 *   Store: `<CONVEYOR_STATE_ROOT or repo root>/.conveyor/health/` (#4052) — `state.json` + `last-tick.json`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderHealthSection } from './health-watch-core.mjs';
import { pinnedStateRoot } from './queue-store.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The health watch's state dir under the pinned daemon state root (#4052), else this checkout's root. */
export function healthDir(stateRoot) { return join(stateRoot ?? pinnedStateRoot() ?? REPO_ROOT, '.conveyor', 'health'); }

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }

/**
 * The HEALTH section as lines. The first line is the health watch's last-tick-completed age, or says it has
 * never ticked; then one row per open episode. Never throws: a missing or corrupt store reads as "never ticked".
 * @param {{stateRoot?:string, now?:number}} [o]
 * @returns {string[]}
 */
export function healthSectionLines({ stateRoot, now = Date.now() } = {}) {
  const dir = healthDir(stateRoot);
  const state = readJson(join(dir, 'state.json'), null);
  const lastTick = readJson(join(dir, 'last-tick.json'), state?.lastTick ?? null);
  return renderHealthSection({ ...(state || {}), lastTick }, { now, reportDir: join(dir, 'episodes') });
}

/**
 * Card xvz55jf (epic #3931) — the SAME store {@link healthSectionLines} renders, as structured data instead
 * of formatted lines, for a machine consumer (the `live-state` operation) that needs to grade severity itself
 * rather than parse text back out of a rendered row. Reads the identical files at the identical path
 * ({@link healthDir}) and applies the identical "open episode" filter {@link
 * ./health-watch-core.mjs#renderHealthSection} already uses (`status !== 'pending'`) — a NON-pending episode
 * is one that has actually opened (or is flapping); a `pending` one is still accumulating breach streak and
 * has never been surfaced anywhere else either. Never throws: a missing or corrupt store reads as "never
 * ticked, no episodes" — the same fail-open shape `healthSectionLines` gives a caller.
 * @param {{stateRoot?:string, now?:number}} [o]
 * @returns {{lastTick: object|null, running: boolean, episodes: Array<{key:string, smell:string,
 *   subject:string, severity:string, status:string, openedAt:number|null, summary:string}>}}
 */
export function openHealthEpisodesData({ stateRoot } = {}) {
  const dir = healthDir(stateRoot);
  const state = readJson(join(dir, 'state.json'), null);
  const lastTick = readJson(join(dir, 'last-tick.json'), state?.lastTick ?? null);
  const episodes = Object.values(state?.episodes ?? {})
    .filter((e) => e.status !== 'pending')
    .map((e) => ({
      key: e.key, smell: e.smell, subject: e.subject, severity: e.severity ?? 'medium', status: e.status,
      openedAt: e.openedAt ?? null, summary: e.recommendation || e.summary || '',
    }));
  return { lastTick, running: !!lastTick, episodes };
}
