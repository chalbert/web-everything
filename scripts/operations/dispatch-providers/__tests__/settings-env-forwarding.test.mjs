/**
 * #landing-freeze-2779 — every mechanical dispatch provider forwards `request.settingsEnv` (the gh-App-shim
 * PATH override `dispatch-lane-io.mjs#createDispatchSinks` already computes via `resolveSettingsEnv`) into
 * `spawnDetached`, so the wrapper process it starts never falls back to a static, expiring `GH_TOKEN`
 * inherited from whoever dispatched it. Before this fix, `settingsEnv` was computed and handed to every
 * provider but silently dropped on the floor — none of them read it. See
 * `../../detached-dispatch.mjs#defaultSpawnDetached`'s own docblock for the full incident (ci-heal-2779,
 * 2026-09-26) this closes.
 */
import { describe, it, expect } from 'vitest';
import { deliverItemDetachedProvider } from '../build.mjs';
import { fixDetachedProvider } from '../fix.mjs';
import { ciHealDetachedProvider } from '../ci-heal.mjs';
import { prepareScopeDetachedProvider } from '../prepare.mjs';
import { prepareDecisionDetachedProvider } from '../prepare-decision.mjs';

const FAKE_SETTINGS_ENV = { PATH: '/fake/gh-shim:/usr/bin', BASH_DEFAULT_TIMEOUT_MS: '600000' };

function fakeSpawnDetached() {
  const calls = [];
  const spawnDetached = (argv, opts) => { calls.push({ argv, opts }); return { pid: 4242 }; };
  return { spawnDetached, calls };
}

describe('every mechanical provider forwards request.settingsEnv to spawnDetached (#landing-freeze-2779)', () => {
  it('build (deliverItemDetachedProvider)', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    deliverItemDetachedProvider(
      { num: '1234', lane: '3', sessionSlug: 'conveyor-1234', settingsEnv: FAKE_SETTINGS_ENV },
      { spawnDetached, logPathFor: () => '/x/log', readDeliveryAgentMarker: () => null },
    );
    expect(calls[0].opts.settingsEnv).toEqual(FAKE_SETTINGS_ENV);
  });

  it('fix (fixDetachedProvider)', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    fixDetachedProvider(
      { pr: '2779', sessionSlug: 'fix-2779', settingsEnv: FAKE_SETTINGS_ENV },
      { spawnDetached, logPathFor: () => '/x/log', readDeliveryAgentMarker: () => null },
    );
    expect(calls[0].opts.settingsEnv).toEqual(FAKE_SETTINGS_ENV);
  });

  it('ci-heal (ciHealDetachedProvider) — the launch kind the live incident hit', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    ciHealDetachedProvider(
      { pr: '2779', sessionSlug: 'ci-heal-2779', settingsEnv: FAKE_SETTINGS_ENV },
      { spawnDetached, logPathFor: () => '/x/log', readDeliveryAgentMarker: () => null },
    );
    expect(calls[0].opts.settingsEnv).toEqual(FAKE_SETTINGS_ENV);
  });

  it('prepare (prepareScopeDetachedProvider)', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    prepareScopeDetachedProvider(
      { num: '1234', lane: '3', sessionSlug: 'prepare-1234', settingsEnv: FAKE_SETTINGS_ENV },
      { spawnDetached, logPathFor: () => '/x/log' },
    );
    expect(calls[0].opts.settingsEnv).toEqual(FAKE_SETTINGS_ENV);
  });

  it('prepare-decision (prepareDecisionDetachedProvider)', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    prepareDecisionDetachedProvider(
      { num: '1234', lane: '3', sessionSlug: 'prepare-decision-1234', settingsEnv: FAKE_SETTINGS_ENV },
      { spawnDetached, logPathFor: () => '/x/log' },
    );
    expect(calls[0].opts.settingsEnv).toEqual(FAKE_SETTINGS_ENV);
  });

  it('a request with no settingsEnv (e.g. App auth unconfigured) forwards undefined — never invents one', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    ciHealDetachedProvider(
      { pr: '2779', sessionSlug: 'ci-heal-2779' },
      { spawnDetached, logPathFor: () => '/x/log', readDeliveryAgentMarker: () => null },
    );
    expect(calls[0].opts.settingsEnv).toBeUndefined();
  });
});
