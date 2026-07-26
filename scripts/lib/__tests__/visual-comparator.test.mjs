/**
 * @file visual-comparator.test.mjs — proof of the screenshot-vs-baseline visual comparator (#2670).
 *
 * The shared primitive both the jury visual lens (#2671) and the build-time self-review (#2672) call. Covers the
 * three contract cases named in the spec — identical render → MATCH, a perturbed render → non-empty delta/findings,
 * a missing baseline → documented SKIP (never a false-fail) — plus the noise-tolerance and structural-diff
 * behaviours that distinguish this from naive pixel equality, and a PNG codec round-trip (the thin I/O seam).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  diffImages,
  compareToBaseline,
  DEFAULT_PIXEL_DELTA_THRESHOLD,
} from '../visual-comparator.mjs';
import { encodePng, decodePng, writePng, readPng } from '../png-io.mjs';

// --- PNG-with-arbitrary-filters encoder (test-only) ---------------------------------------------------------
// `encodePng` always writes filter 0, so a round-trip through it never exercises the decoder's Sub/Up/Average/
// Paeth paths — exactly the code that runs on every REAL Playwright screenshot (adaptive per-scanline filtering).
// This helper encodes an RGBA image applying a chosen filter PER ROW, so the test below pins those risky paths.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), out.length - 4);
  return out;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
/** Encode RGBA image, choosing `filterFor(y)` per row (0..4). Mirrors the PNG filter definitions the decoder inverts. */
function encodeWithFilters({ width, height, data }, filterFor) {
  const ch = 4, stride = width * ch;
  const raw = Buffer.alloc((stride + 1) * height);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const cur = data.subarray(y * stride, (y + 1) * stride);
    const f = filterFor(y);
    const rowStart = y * (stride + 1);
    raw[rowStart] = f;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v;
      switch (f) {
        case 0: v = cur[x]; break;
        case 1: v = cur[x] - a; break;
        case 2: v = cur[x] - b; break;
        case 3: v = cur[x] - ((a + b) >> 1); break;
        case 4: v = cur[x] - paeth(a, b, c); break;
        default: throw new Error('bad filter');
      }
      raw[rowStart + 1 + x] = v & 0xff;
    }
    prev.set(cur);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Build a solid-colour RGBA image. */
function solid(width, height, [r, g, b, a = 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { width, height, data };
}

/** Copy an image and paint a filled rectangle into it — simulates a shifted/added block. */
function withRect(img, { x, y, w, h }, [r, g, b, a = 255]) {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const d = (yy * img.width + xx) * 4;
      out.data[d] = r; out.data[d + 1] = g; out.data[d + 2] = b; out.data[d + 3] = a;
    }
  }
  return out;
}

/** Add small ±jitter to every channel — simulates antialiasing / hinting noise. */
function jitter(img, amount) {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  for (let i = 0; i < out.data.length; i++) {
    const j = ((i * 2654435761) % (2 * amount + 1)) - amount; // deterministic pseudo-jitter
    out.data[i] = Math.max(0, Math.min(255, out.data[i] + j));
  }
  return out;
}

describe('diffImages — the pure diff engine', () => {
  it('identical render → match, zero delta, no findings', () => {
    const a = solid(64, 48, [200, 100, 50]);
    const b = solid(64, 48, [200, 100, 50]);
    const r = diffImages(a, b);
    expect(r.match).toBe(true);
    expect(r.delta).toBe(0);
    expect(r.findings).toEqual([]);
  });

  it('perturbed render → non-empty findings and a non-zero delta', () => {
    const base = solid(64, 48, [240, 240, 240]);
    // Paint a dark block into a quadrant — a clear layout/structural change.
    const shot = withRect(base, { x: 4, y: 4, w: 24, h: 20 }, [10, 10, 10]);
    const r = diffImages(shot, base);
    expect(r.match).toBe(false);
    expect(r.delta).toBeGreaterThan(0);
    expect(r.findings.length).toBeGreaterThan(0);
    // The structural diff localises WHERE it changed.
    expect(r.findings.some((f) => f.kind === 'region-shift' && f.region)).toBe(true);
  });

  it('minor rendering noise stays a match (tolerant, not naive equality)', () => {
    const base = solid(80, 60, [128, 128, 128]);
    const noisy = jitter(base, 8); // within DEFAULT_PIXEL_TOLERANCE (24)
    const r = diffImages(noisy, base);
    expect(r.match).toBe(true);
    expect(r.delta).toBeLessThanOrEqual(DEFAULT_PIXEL_DELTA_THRESHOLD);
  });

  it('dimension mismatch → error finding and non-match', () => {
    const a = solid(64, 48, [0, 0, 0]);
    const b = solid(64, 40, [0, 0, 0]);
    const r = diffImages(a, b);
    expect(r.match).toBe(false);
    expect(r.findings.some((f) => f.kind === 'dimension-mismatch')).toBe(true);
  });

  it('structural threshold catches a shifted block a raw pixel count might tolerate', () => {
    const base = solid(160, 120, [255, 255, 255]);
    const original = withRect(base, { x: 10, y: 10, w: 20, h: 20 }, [0, 0, 0]);
    const shifted = withRect(base, { x: 40, y: 10, w: 20, h: 20 }, [0, 0, 0]);
    const r = diffImages(shifted, original);
    expect(r.match).toBe(false);
    expect(r.findings.some((f) => f.kind === 'region-shift')).toBe(true);
  });
});

describe('compareToBaseline — the file-facing wrapper', () => {
  it('missing baseline → documented skip, never a false-fail', () => {
    const r = compareToBaseline({
      shotPath: '/does/not/matter.png',
      baselinePath: '/no/such/baseline.png',
    });
    expect(r.skipped).toBe(true);
    expect(r.match).toBe(null);
    expect(r.findings[0].kind).toBe('baseline-missing');
    expect(r.findings[0].severity).toBe('warn');
  });

  it('identical PNGs on disk → match; perturbed PNG → non-match (end-to-end through the codec)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'viscmp-'));
    try {
      const base = solid(48, 32, [90, 160, 210]);
      const shotSame = solid(48, 32, [90, 160, 210]);
      const shotDiff = withRect(base, { x: 2, y: 2, w: 16, h: 16 }, [255, 0, 0]);
      const basePath = join(dir, 'baseline.png');
      const samePath = join(dir, 'same.png');
      const diffPath = join(dir, 'diff.png');
      writeFileSync(basePath, encodePng(base));
      writeFileSync(samePath, encodePng(shotSame));
      writeFileSync(diffPath, encodePng(shotDiff));

      const same = compareToBaseline({ shotPath: samePath, baselinePath: basePath });
      expect(same.match).toBe(true);

      const diff = compareToBaseline({ shotPath: diffPath, baselinePath: basePath });
      expect(diff.match).toBe(false);
      expect(diff.findings.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('png-io — the thin codec round-trips', () => {
  it('encode → decode preserves dimensions and pixels', () => {
    const img = solid(20, 12, [17, 200, 99, 255]);
    const round = decodePng(encodePng(img));
    expect(round.width).toBe(20);
    expect(round.height).toBe(12);
    expect(Array.from(round.data.slice(0, 4))).toEqual([17, 200, 99, 255]);
  });

  it('decodes every PNG filter type (Sub/Up/Average/Paeth) — the paths real Playwright shots use', () => {
    // A gradient so adjacent pixels differ (the predictors actually do work), rows cycling filters 1..4 then 0.
    const w = 12, h = 10;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = (y * w + x) * 4;
        data[d] = (x * 17 + y * 3) & 0xff;
        data[d + 1] = (y * 23 + x * 5) & 0xff;
        data[d + 2] = (x * 7 + y * 29) & 0xff;
        data[d + 3] = 255;
      }
    }
    const png = encodeWithFilters({ width: w, height: h, data }, (y) => [1, 2, 3, 4, 0][y % 5]);
    const back = decodePng(png);
    expect(back.width).toBe(w);
    expect(back.height).toBe(h);
    expect(Array.from(back.data)).toEqual(Array.from(data)); // byte-exact through all filter types
  });

  it('throws loudly on a truncated pixel stream instead of silently zeroing pixels', () => {
    const good = encodePng(solid(8, 8, [50, 60, 70]));
    // Corrupt the IDAT so inflate yields too few bytes: flip the length of the IDAT chunk is complex; instead
    // decode a valid PNG whose IHDR claims a larger height than the data provides.
    const tall = encodePng(solid(8, 8, [50, 60, 70]));
    // Rewrite IHDR height (bytes 4..8 of IHDR data, which starts at signature(8)+len(4)+type(4)=16) to 9999.
    tall.writeUInt32BE(9999, 16 + 4);
    expect(() => decodePng(tall)).toThrow(/truncated/);
    expect(decodePng(good).width).toBe(8); // sanity: the uncorrupted one still decodes
  });

  it('writePng → readPng preserves a multi-colour image', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pngio-'));
    try {
      const base = withRect(solid(24, 24, [10, 20, 30]), { x: 6, y: 6, w: 8, h: 8 }, [200, 210, 220]);
      const p = join(dir, 'rt.png');
      writePng(p, base);
      const back = readPng(p);
      expect(back.width).toBe(24);
      expect(back.height).toBe(24);
      // A pixel inside the rect and one outside both survive the round-trip.
      const inside = (10 * 24 + 10) * 4;
      const outside = 0;
      expect(Array.from(back.data.slice(inside, inside + 4))).toEqual([200, 210, 220, 255]);
      expect(Array.from(back.data.slice(outside, outside + 4))).toEqual([10, 20, 30, 255]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
