/** Pre-launch availability only; never retry a provider after a session may have started. */
import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';
import { readStore } from '../conveyor/run-scorecard-store.mjs';
import { providerQuotaHold } from './provider-quota-hold.mjs';
export function dispatchProviderAvailable(provider, { env = process.env, records = readStore().records, now = Date.now(), access = accessSync } = {}) {
  const family = provider.startsWith('agy-') ? 'antigravity' : provider;
  // Claude is the fallback of last resort (critical-scope work has no other route) and was always launchable;
  // a quota row must never strand it with no provider at all.
  if (family === 'claude') return true;
  if (providerQuotaHold(records, family, now)) return false;
  const binary = family === 'antigravity' ? 'agy' : family;
  return String(env.PATH ?? '').split(':').some(dir => {
    try { access(join(dir, binary), constants.X_OK); return true; } catch { return false; }
  });
}
