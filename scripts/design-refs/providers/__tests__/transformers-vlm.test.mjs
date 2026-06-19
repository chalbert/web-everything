// Unit test for the Tier-2 in-browser VLM provider (#1082). Fixture-only: exercises the PURE Florence-2
// response→#1080-envelope mapping + the WebGPU device gate, with no model, browser, or WebGPU.
import { describe, it, expect } from 'vitest';
import {
  FLORENCE_TASKS,
  boxToUnit,
  tagsFromDetection,
  mapFlorenceResponse,
  isWebGPUAvailable,
  assertDeviceCapable,
  DEFAULT_MODEL,
} from '../transformers-vlm.mjs';

describe('boxToUnit (pixel bbox → normalized {x,y,w,h})', () => {
  it('converts a pixel [x1,y1,x2,y2] bbox against image dims', () => {
    expect(boxToUnit([100, 50, 300, 250], { width: 1000, height: 500 })).toEqual({
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.4,
    });
  });
  it('returns null for a malformed bbox or non-positive dims', () => {
    expect(boxToUnit([1, 2, 3], { width: 100, height: 100 })).toBeNull();
    expect(boxToUnit([1, 2, 3, 4], { width: 0, height: 100 })).toBeNull();
    expect(boxToUnit('nope', { width: 100, height: 100 })).toBeNull();
    expect(boxToUnit([1, 2, NaN, 4], { width: 100, height: 100 })).toBeNull();
  });
});

describe('tagsFromDetection', () => {
  it('lower-cases, trims, and dedupes detected labels', () => {
    expect(tagsFromDetection(['Button', ' button ', 'Icon', ''])).toEqual(['button', 'icon']);
  });
  it('tolerates a non-array', () => {
    expect(tagsFromDetection(undefined)).toEqual([]);
  });
});

describe('mapFlorenceResponse (#1080 envelope)', () => {
  const dims = { width: 200, height: 100 };
  it('merges caption + detection into a normalized rich envelope', () => {
    const out = mapFlorenceResponse(
      {
        [FLORENCE_TASKS.caption]: '  A settings dashboard with a sidebar.  ',
        [FLORENCE_TASKS.detection]: {
          bboxes: [[20, 10, 60, 50], [100, 0, 200, 100]],
          labels: ['sidebar', 'main panel'],
        },
      },
      dims,
    );
    expect(out.description).toBe('A settings dashboard with a sidebar.');
    expect(out.tags).toEqual(['sidebar', 'main panel']);
    expect(out.regions).toEqual([
      { label: 'sidebar', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.4 } },
      { label: 'main panel', box: { x: 0.5, y: 0, w: 0.5, h: 1 } },
    ]);
    expect(out.ungated).toBe(false);
  });

  it('keeps a label whose bbox is malformed but drops its box (label-without-localization)', () => {
    const out = mapFlorenceResponse(
      { [FLORENCE_TASKS.detection]: { bboxes: [[1, 2, 3]], labels: ['header'] } },
      dims,
    );
    expect(out.regions).toEqual([{ label: 'header', box: null }]);
  });

  it('is tolerant of a caption-only or detection-only or empty run', () => {
    expect(mapFlorenceResponse({ [FLORENCE_TASKS.caption]: 'just a caption' }, dims)).toMatchObject({
      description: 'just a caption',
      tags: [],
      regions: [],
    });
    expect(mapFlorenceResponse({}, dims)).toMatchObject({ description: null, tags: [], regions: [] });
  });
});

describe('WebGPU device gate', () => {
  it('isWebGPUAvailable reflects navigator.gpu', () => {
    expect(isWebGPUAvailable({ gpu: {} })).toBe(true);
    expect(isWebGPUAvailable({})).toBe(false);
    expect(isWebGPUAvailable(undefined)).toBe(false);
  });
  it('assertDeviceCapable throws an actionable error without WebGPU, passes with it', () => {
    expect(() => assertDeviceCapable({})).toThrow(/WebGPU/);
    expect(() => assertDeviceCapable({ gpu: {} })).not.toThrow();
  });
});

describe('model default', () => {
  it('defaults to a Transformers.js Florence-2 build', () => {
    expect(DEFAULT_MODEL).toMatch(/Florence-2/i);
  });
});
