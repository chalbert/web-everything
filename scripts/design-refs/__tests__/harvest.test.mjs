// Tests for the gallery-harvest captureMethod (backlog #397). The harvest flow itself shells out to
// cwebp/dwebp + writes the corpus, so it's exercised by the CLI; here we unit-test the pure
// `webpDims` RIFF-header parser the harvest path relies on (a harvested frame has no source PNG to
// measure, so dims come straight from the encoded WebP).

import { describe, it, expect } from 'vitest';
import { webpDims } from '../../design-refs.mjs';

// Minimal lossy-VP8 WebP header: RIFF....WEBP 'VP8 ' …keyframe… with 14-bit width/height at 26/28.
function vp8(width, height) {
  const b = Buffer.alloc(32);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8 ', 12, 'ascii');
  b.writeUInt16LE(width & 0x3fff, 26);
  b.writeUInt16LE(height & 0x3fff, 28);
  return b;
}

// Minimal extended-VP8X header: 24-bit (width-1)/(height-1) at offsets 24/27.
function vp8x(width, height) {
  const b = Buffer.alloc(32);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(width - 1, 24, 3);
  b.writeUIntLE(height - 1, 27, 3);
  return b;
}

describe('webpDims', () => {
  it('reads dimensions from a lossy VP8 header (what cwebp -q emits)', () => {
    expect(webpDims(vp8(2880, 1800))).toEqual({ width: 2880, height: 1800 });
    expect(webpDims(vp8(1, 1))).toEqual({ width: 1, height: 1 });
  });

  it('reads canvas dimensions from an extended VP8X header', () => {
    expect(webpDims(vp8x(4096, 2160))).toEqual({ width: 4096, height: 2160 });
  });

  it('returns {0,0} for a non-WebP or truncated buffer (non-load-bearing metadata)', () => {
    expect(webpDims(Buffer.from('not a webp at all here'))).toEqual({ width: 0, height: 0 });
    expect(webpDims(Buffer.alloc(10))).toEqual({ width: 0, height: 0 });
  });
});
