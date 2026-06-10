/**
 * Drift guard for the /capabilities native-first worked example (#213).
 *
 * The page's "Native-first resolution" worked example no longer restates the resolver's conclusion as
 * prose — it renders the committed `src/_data/capabilityWorkedExample.json` artifact. This test pins
 * that artifact to the resolver: it recomputes the example from the *real* shipped provider and
 * asserts the committed JSON matches. Edit the matrix so the native-first resolution changes and the
 * committed artifact goes stale → this reddens (the #213 DoD). Run with `UPDATE_WORKED_EXAMPLE=1` to
 * regenerate the artifact after an intentional matrix change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNativeFirstWorkedExample } from '../workedExample.js';

// vitest runs from the repo root; the artifact lives beside the other `_data` files the page reads.
const ARTIFACT_PATH = resolve(process.cwd(), 'src/_data/capabilityWorkedExample.json');

describe('capabilityWorkedExample.json is computed from the resolver, not authored (#213)', () => {
  const computed = buildNativeFirstWorkedExample();

  // Update mode: regenerate the committed artifact after an intentional matrix change.
  if (process.env.UPDATE_WORKED_EXAMPLE) {
    writeFileSync(ARTIFACT_PATH, JSON.stringify(computed, null, 2) + '\n');
  }

  it('matches the committed artifact the page renders (stale ⇒ matrix drifted)', () => {
    const committed = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
    expect(committed).toEqual(computed);
  });

  // Sanity-pin the headline facts the prose used to assert by hand, so a wrong regeneration is loud.
  it('resolves the droplist slot to the native base-select impl, FACE blocked', () => {
    expect(computed.winner).toBe('base-select');
    expect(computed.requiredCapabilities).toEqual([
      'customizable-select',
      'custom-state',
      'anchor-positioning',
      'popover',
    ]);
    const baseSelect = computed.candidates.find((c) => c.impl === 'base-select')!;
    const face = computed.candidates.find((c) => c.impl === 'face')!;
    expect(baseSelect).toMatchObject({ native: true, eligible: true, cost: 0, blockers: [] });
    expect(face.eligible).toBe(false);
    expect(face.blockers).toContain('customizable-select');
  });
});
