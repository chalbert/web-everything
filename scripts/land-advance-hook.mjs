#!/usr/bin/env node
/**
 * @file land-advance-hook.mjs
 * The `Stop` hook entry for land-advance (#3720): a worker finishing or a turn ending is a completion event, a WAKE
 * only. It never awaits the operation: it exits at once when another call holds the single-flight lease, when the
 * cooldown (default 60 s) has not elapsed, or when `WE_LAND_ADVANCE_HOOK=0`; otherwise it stamps the cooldown and
 * starts `land-advance-cli.mjs --mode=dispatch` detached. Dispatch mode only ASKS: the CLI stays plan-only until the
 * operator's opt-in is set and no pause marker is, both read from the canonical checkout. Always exits 0 and prints
 * nothing, so a turn is never blocked. Installed by the operator in `.claude/settings.json` (`hooks.Stop`), never here.
 */
import * as fs from 'node:fs';
import { spawn as spawnDefault } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { singleFlightHeld, LAND_ADVANCE_LOCK_ROOT } from './operations/land-advance-gate.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_COOLDOWN_MS = 60000;
export const CLI = join(HERE, 'operations', 'land-advance-cli.mjs');
const STAMP = 'land-advance-hook-last-run.json';
export function hookDecision({ disabled = false, leaseHeld = false, lastRunMs = null, nowMs = Date.now(), cooldownMs = DEFAULT_COOLDOWN_MS } = {}) {
  if (disabled) return 'skip-disabled';
  if (leaseHeld) return 'skip-busy';
  if (Number.isFinite(lastRunMs) && nowMs - lastRunMs < cooldownMs) return 'skip-cooldown';
  return 'launch';
}
export function runHook({ lockRoot = LAND_ADVANCE_LOCK_ROOT, env = process.env, nowMs = Date.now(), spawn = spawnDefault } = {}) {
  const stamp = join(lockRoot, STAMP);
  let lastRunMs = null;
  try { lastRunMs = JSON.parse(fs.readFileSync(stamp, 'utf8')).at; } catch { lastRunMs = null; }
  const cooldownOverride = Number(env.WE_LAND_ADVANCE_COOLDOWN_MS);
  const decision = hookDecision({ disabled: env.WE_LAND_ADVANCE_HOOK === '0', leaseHeld: singleFlightHeld({ lockRoot, nowMs }), lastRunMs,
    nowMs, cooldownMs: Number.isFinite(cooldownOverride) ? cooldownOverride : DEFAULT_COOLDOWN_MS });
  if (decision !== 'launch') return decision;
  fs.mkdirSync(lockRoot, { recursive: true });
  fs.writeFileSync(stamp, JSON.stringify({ at: nowMs }));
  const log = fs.openSync(join(lockRoot, 'land-advance-hook.log'), 'a');
  spawn(process.execPath, [CLI, '--mode=dispatch', '--caller=stop-hook'], { detached: true, stdio: ['ignore', log, log], cwd: resolve(HERE, '..') }).unref();
  return decision;
}
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) { try { runHook(); } catch { /* a wake that fails is a missed wake, never a blocked turn */ } process.exitCode = 0; }
