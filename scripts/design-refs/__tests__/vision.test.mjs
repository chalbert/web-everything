// Tests for the vision-gated capture-QC seam (backlog #480, ruling #475).
// Proves the pure gate logic + the swappable-provider seam without a browser or a network/model call —
// a mock provider injects the verdicts a real model would return for the two known-bad corpus targets.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VERDICTS, UNGATED, normalizeVerdict, decideAdmission, reviewStateFor,
  registerVisionProvider, getVisionProvider, listVisionProviders,
  selectedProviderName, visionEnabled, resolveVisionProvider, classifyCandidate,
} from '../vision.mjs';

describe('verdict taxonomy', () => {
  it('exposes the six real-vision verdicts (Fork 3)', () => {
    expect(VERDICTS).toEqual(['app', 'obstructed', 'marketing', 'error', 'blank', 'non-app']);
  });

  it('normalises case/whitespace and keeps the ungated sentinel', () => {
    expect(normalizeVerdict('  App ')).toBe('app');
    expect(normalizeVerdict('UNGATED')).toBe(UNGATED);
  });

  it('maps any unknown/garbage verdict to the safe quarantine side', () => {
    for (const bad of ['', 'yes', '???', null, undefined, 42]) {
      expect(normalizeVerdict(bad)).toBe('non-app');
      expect(decideAdmission(bad)).toBe('quarantine');
    }
  });
});

describe('decideAdmission (the gate, pure)', () => {
  it('admits a clean app surface and the ungated sentinel', () => {
    expect(decideAdmission('app')).toBe('admit');
    expect(decideAdmission(UNGATED)).toBe('admit');
  });
  it('remediates an obstructed surface', () => {
    expect(decideAdmission('obstructed')).toBe('remediate');
  });
  it('quarantines marketing / error / blank / non-app', () => {
    for (const v of ['marketing', 'error', 'blank', 'non-app']) {
      expect(decideAdmission(v)).toBe('quarantine');
    }
  });
});

describe('reviewState', () => {
  it('is confirmed for a real verdict and ungated for the sentinel', () => {
    expect(reviewStateFor('app')).toBe('confirmed');
    expect(reviewStateFor(UNGATED)).toBe('ungated');
  });
});

describe('provider registry (the swap point)', () => {
  it('ships only the null `manual` provider by default; it emits ungated', async () => {
    expect(listVisionProviders()).toContain('manual');
    const res = await getVisionProvider('manual').classifyCandidate({ url: 'x' });
    expect(res.verdict).toBe(UNGATED);
  });

  it('selects manual by default and reports vision disabled', () => {
    expect(selectedProviderName({})).toBe('manual');
    expect(visionEnabled({})).toBe(false);
    expect(selectedProviderName({ DESIGN_REFS_VISION_PROVIDER: 'mock' })).toBe('mock');
    expect(visionEnabled({ DESIGN_REFS_VISION_PROVIDER: 'mock' })).toBe(true);
  });

  it('rejects a malformed provider', () => {
    expect(() => registerVisionProvider('bad', {})).toThrow();
  });
});

describe('classifyCandidate envelope', () => {
  it('normalises a provider response into {verdict, reasons, provider}', async () => {
    const prov = { name: 'p', async classifyCandidate() { return { verdict: 'APP', reasons: ['toolbar visible'] }; } };
    const res = await classifyCandidate(prov, { url: 'x' });
    expect(res).toEqual({ verdict: 'app', reasons: ['toolbar visible'], provider: 'p' });
  });

  it('defends against a provider returning no reasons / a bad verdict', async () => {
    const prov = { name: 'p', async classifyCandidate() { return { verdict: 'splash-screen' }; } };
    const res = await classifyCandidate(prov, { url: 'x' });
    expect(res.verdict).toBe('non-app'); // unknown → quarantine side
    expect(res.reasons).toEqual([]);
  });
});

// The acceptance scenario from #480: a mock provider returns what a real model would for the two
// targets the deterministic gate let through. The gate must quarantine the marketing splash and admit
// the real app — and recover an obstructed app after remediation.
describe('acceptance — the two known-bad targets + remediation, via a mock provider', () => {
  beforeEach(() => {
    registerVisionProvider('mock', {
      // Verdicts a vision model would return, keyed by url; obstructed clears after one re-shoot.
      _seen: new Map(),
      async classifyCandidate({ url }) {
        if (url.includes('photopea')) return { verdict: 'marketing', reasons: ['hero + Start button, not the editor'] };
        if (url.includes('grafana')) return { verdict: 'error', reasons: ['dashboard-not-found panel'] };
        if (url.includes('obstructed-app')) {
          const n = (this._seen.get(url) ?? 0) + 1; this._seen.set(url, n);
          return n === 1 ? { verdict: 'obstructed', reasons: ['cookie banner'] } : { verdict: 'app', reasons: ['canvas visible'] };
        }
        return { verdict: 'app', reasons: ['clean app surface'] };
      },
    });
  });

  it('quarantines the Photopea marketing splash', async () => {
    const prov = await resolveVisionProvider({ DESIGN_REFS_VISION_PROVIDER: 'mock' });
    const res = await classifyCandidate(prov, { url: 'https://www.photopea.com' });
    expect(res.verdict).toBe('marketing');
    expect(decideAdmission(res.verdict)).toBe('quarantine');
  });

  it('quarantines the Grafana error panel even though a shell selector would have passed (override)', async () => {
    const prov = await resolveVisionProvider({ DESIGN_REFS_VISION_PROVIDER: 'mock' });
    const res = await classifyCandidate(prov, { url: 'https://play.grafana.org/stale', selectorState: 'confirmed' });
    expect(res.verdict).toBe('error');
    expect(decideAdmission(res.verdict)).toBe('quarantine');
  });

  it('admits a clean app surface', async () => {
    const prov = await resolveVisionProvider({ DESIGN_REFS_VISION_PROVIDER: 'mock' });
    const res = await classifyCandidate(prov, { url: 'https://app.example.com/dashboard' });
    expect(decideAdmission(res.verdict)).toBe('admit');
    expect(reviewStateFor(res.verdict)).toBe('confirmed');
  });

  it('recovers an obstructed app: remediate then admit (bounded)', async () => {
    const prov = await resolveVisionProvider({ DESIGN_REFS_VISION_PROVIDER: 'mock' });
    const cap = 2;
    let res = await classifyCandidate(prov, { url: 'https://obstructed-app.example.com' });
    let attempts = 0;
    while (decideAdmission(res.verdict) === 'remediate' && attempts < cap) {
      attempts++;
      res = await classifyCandidate(prov, { url: 'https://obstructed-app.example.com' });
    }
    expect(attempts).toBe(1);
    expect(decideAdmission(res.verdict)).toBe('admit');
  });
});
