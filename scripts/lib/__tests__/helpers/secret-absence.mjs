/**
 * @file scripts/lib/__tests__/helpers/secret-absence.mjs
 * @description Shared test helper for any module that handles a credential: assert a sentinel secret is absent
 *   from the call-log sidecar, any captured output sinks, and `process.env`. Only checks with teeth are claimed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'vitest';

/** Snapshot of `process.env` to diff after the call under test (guards a `process.env.GH_TOKEN = …` regression). */
export const snapshotEnv = () => ({ ...process.env });

/**
 * @param {string} sentinel the secret string that must not appear anywhere
 * @param {{logPath?:string, sinks?:Array<string|Buffer|null|undefined>, envBefore?:Record<string,string|undefined>}} [o]
 */
export function expectSecretAbsent(sentinel, { logPath, sinks = [], envBefore } = {}) {
  if (logPath && existsSync(logPath)) expect(readFileSync(logPath, 'utf8')).not.toContain(sentinel);
  for (const sink of sinks) expect(String(sink ?? '')).not.toContain(sentinel);
  expect(Object.values(process.env)).not.toContain(sentinel);
  if (envBefore) expect({ ...process.env }).toEqual(envBefore);
}
