import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_VERSION, CAPABILITY_MARKER_PATH, parseCapabilityMarker, stackingSupported, readCapabilityFromMain } from '../readiness/drain-capability.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

describe('drain-capability — the durable proof-of-land capability marker (#2393)', () => {
  it('parseCapabilityMarker reads a valid marker and rejects every malformed shape', () => {
    expect(parseCapabilityMarker('{"gateVersion": 1}')).toEqual({ gateVersion: 1 });
    expect(parseCapabilityMarker('{"gateVersion": 3, "extra": true}')).toEqual({ gateVersion: 3 });
    // total on garbage: null/empty, bad JSON, non-object, missing/NaN/negative/non-integer version → null.
    expect(parseCapabilityMarker(null)).toBeNull();
    expect(parseCapabilityMarker('')).toBeNull();
    expect(parseCapabilityMarker('   ')).toBeNull();
    expect(parseCapabilityMarker('not json')).toBeNull();
    expect(parseCapabilityMarker('[1,2,3]')).toBeNull();
    expect(parseCapabilityMarker('{"nope": 1}')).toBeNull();
    expect(parseCapabilityMarker('{"gateVersion": -1}')).toBeNull();
    expect(parseCapabilityMarker('{"gateVersion": 1.5}')).toBeNull();
    expect(parseCapabilityMarker('{"gateVersion": "1"}')).toBeNull();
  });

  it('stackingSupported defaults HARD to false unless the marker positively proves gateVersion >= required', () => {
    expect(stackingSupported({ gateVersion: 1 }, 1)).toBe(true);
    expect(stackingSupported({ gateVersion: 2 }, 1)).toBe(true);   // newer than required → supported
    expect(stackingSupported({ gateVersion: 1 }, 2)).toBe(false);  // older than required → stay siblings
    expect(stackingSupported(null, 1)).toBe(false);                // no marker → stay siblings
    expect(stackingSupported({}, 1)).toBe(false);                  // malformed → stay siblings
    // default `required` is the current GATE_VERSION.
    expect(stackingSupported({ gateVersion: GATE_VERSION })).toBe(true);
  });

  it('readCapabilityFromMain defaults to unsupported when the main read throws or is empty (the safe default)', () => {
    const throwing = () => { throw new Error('no origin/main'); };
    expect(readCapabilityFromMain(throwing)).toEqual({ marker: null, supported: false });
    expect(readCapabilityFromMain(() => '')).toEqual({ marker: null, supported: false });
    // a live marker on main → supported at its own version.
    const ok = readCapabilityFromMain((p) => {
      expect(p).toBe(CAPABILITY_MARKER_PATH);
      return JSON.stringify({ gateVersion: GATE_VERSION });
    });
    expect(ok.marker).toEqual({ gateVersion: GATE_VERSION });
    expect(ok.supported).toBe(true);
  });

  it('the committed marker JSON is present, parses, and advertises the current GATE_VERSION (the gate is live on this ref)', () => {
    const text = readFileSync(resolve(REPO_ROOT, CAPABILITY_MARKER_PATH), 'utf8');
    const marker = parseCapabilityMarker(text);
    expect(marker).not.toBeNull();
    expect(marker.gateVersion).toBe(GATE_VERSION);
    expect(stackingSupported(marker)).toBe(true);
  });
});
