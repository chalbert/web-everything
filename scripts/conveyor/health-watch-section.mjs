/**
 * @file scripts/conveyor/health-watch-section.mjs
 * @description #4077 — the HEALTH section the operator queue prints (`operator-queue.mjs --with-health`), read
 *   from the health watch's own store. A deliberately SMALL module (fs + the pure core only, no child_process),
 *   so importing it into the operator queue adds no process-spawning code to that file's import graph.
 *
 *   Store: `<pinned daemon state root, #4052>/.conveyor/health/` — `state.json` + `last-tick.json`.
 *
 *   THE ONE STATE-ROOT RESOLVER every reader of this store goes through (`operator-queue.mjs --with-health`
 *   via {@link healthSectionLines}, the `live-state` operation via {@link openHealthEpisodesData}, and
 *   `health-watch.mjs`'s own tick/section/silence/unsilence commands, which import {@link healthDir} from
 *   HERE rather than re-deriving it) is {@link healthDir}, which now defers ENTIRELY to
 *   `we:scripts/lib/daemon-last-good.mjs#daemonConveyorStateRoot` (re-exported unchanged from
 *   `we:scripts/lib/daemon-rebuild.mjs`, which used to define it) — the SAME shared helper
 *   `we:scripts/conveyor/run-scorecard-store.mjs` already uses for its own #4052-pinned daemon state file.
 *   Before this, an UNSET `CONVEYOR_STATE_ROOT` made this module
 *   fall back to ITS OWN SCRIPT-LOCATION checkout root — a DIFFERENT default than `daemonConveyorStateRoot`'s
 *   (which falls back to `~/.claude/daemon-self-sync-state/conveyor-state`, never a checkout). The health
 *   watch's real `com.we.health-watch` launchd plist pins `CONVEYOR_STATE_ROOT` to exactly that
 *   `daemonConveyorStateRoot` default — so the daemon has always written there — but every reader invoked
 *   from an interactive shell with no `CONVEYOR_STATE_ROOT` exported (the operator's own shell has never had
 *   one) fell back to WHATEVER checkout happened to run it instead, landing on an empty/nonexistent
 *   `.conveyor/health/` there. `operator-queue.mjs --with-health` run from `~/workspace/wev-review-daemon`
 *   is exactly this: that clone has no `.conveyor/health/` at all, so it read "never ticked" while the real
 *   store (at the `daemonConveyorStateRoot` default) had a live tick every few minutes the whole time. Making
 *   every reader resolve through the SAME helper — with the SAME out-of-tree, zero-config default the sibling
 *   daemon-state files already use — makes this byte-identical regardless of which checkout invokes it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderHealthSection } from './health-watch-core.mjs';
// Imported straight from `daemon-last-good.mjs` (import-light: node builtins only), NEVER from
// `daemon-rebuild.mjs` — that module pulls in the whole clone-rebuild/live-smoke/child_process graph,
// and this file's own header promises "no process-spawning code" in the operator queue's import graph. Doing
// this via `daemon-rebuild.mjs` once broke the operator-queue CLI entry guard's symlink tests (a live
// regression caught by `we:scripts/operations/__tests__/operator-queue-entry.test.mjs`) — this import path is
// the fix.
import { daemonConveyorStateRoot } from '../lib/daemon-last-good.mjs';

/**
 * The health watch's state dir: an explicit `stateRoot` (the CLI's `--state-root`) wins; otherwise
 * {@link daemonConveyorStateRoot} — the operator's `CONVEYOR_STATE_ROOT` pin when set, else the fixed
 * out-of-tree default every #4052 daemon-state file already shares. `env` is injectable for tests; real
 * callers always read the process's own environment.
 * @param {string} [stateRoot]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function healthDir(stateRoot, env = process.env) { return join(stateRoot ?? daemonConveyorStateRoot(env), '.conveyor', 'health'); }

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }

/**
 * The HEALTH section as lines. The first line is the health watch's last-tick-completed age, or says it has
 * never ticked; then one row per open episode. Never throws: a missing or corrupt store reads as "never ticked".
 * @param {{stateRoot?:string, now?:number, env?:NodeJS.ProcessEnv}} [o]
 * @returns {string[]}
 */
export function healthSectionLines({ stateRoot, now = Date.now(), env = process.env } = {}) {
  const dir = healthDir(stateRoot, env);
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
 * @param {{stateRoot?:string, env?:NodeJS.ProcessEnv}} [o]
 * @returns {{lastTick: object|null, running: boolean, episodes: Array<{key:string, smell:string,
 *   subject:string, severity:string, status:string, openedAt:number|null, summary:string}>}}
 */
export function openHealthEpisodesData({ stateRoot, env = process.env } = {}) {
  const dir = healthDir(stateRoot, env);
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
