import { it, expect } from 'vitest';
import { dispatchProviderAvailable } from '../dispatch-provider-availability.mjs';
it('checks the selected binary and refuses a known quota hold before launch', () => {
  const now = Date.parse('2026-09-30T20:00:00Z');
  const options = { env: { PATH: '/bin' }, now, access: () => {}, records: [] };
  expect(dispatchProviderAvailable('codex', options)).toBe(true);
  expect(dispatchProviderAvailable('codex', { ...options, access: () => { throw new Error('missing'); } })).toBe(false);
  expect(dispatchProviderAvailable('codex', { ...options, records: [{ provider: 'codex', status: 'quota-exhausted', scoredAt: '2026-09-30T19:59:00Z', quotaResetsAt: '2026-09-30T21:00:00Z' }] })).toBe(false);
  expect(dispatchProviderAvailable('agy-gemini', { ...options, access: path => { expect(path).toBe('/bin/agy'); } })).toBe(true);
});
