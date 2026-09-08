// Tests for the perceptual near-dup pass (backlog #395): PPM parse → dHash fingerprint → Hamming
// distance → single-link clustering. Pure logic, no dwebp/sharp/browser — the decode (dwebp) is the
// only I/O and is exercised by the CLI, not here.
//
// fileDHash (#2806) is the one exception: it IS the dwebp/cwebp decode path, generalized to accept any
// raster file. Its tests below are real round-trips against the system cwebp/dwebp binaries — the same
// ones the CLI's `collect`/`dedup` paths already require. A round-2 review finding: "confirmed present"
// was previously asserted only in this prose comment, with no runtime check backing it — CWEBP_AVAILABLE
// below is the actual check, and the suite SKIPS (not fails) when the binaries are absent.

import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { ppmToGray, dHash, hammingHex, clusterByHamming, fileDHash, imageFileToWebp } from '../../design-refs.mjs';

function checkCwebpAvailable() {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
    execFileSync('dwebp', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const CWEBP_AVAILABLE = checkCwebpAvailable();

// ---- minimal PNG encoder (no deps) — just enough to feed fileDHash a real raster file ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
// width×height 8-bit RGB PNG; `fillFn(x, y) -> [r,g,b]` supplies pixel colour.
function makePng(width, height, fillFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fillFn(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b;
    }
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

// Build a binary P6 PPM buffer from a flat RGB array (width*height*3 bytes).
function ppm(width, height, rgb) {
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
  return Buffer.concat([header, Buffer.from(rgb)]);
}

describe('ppmToGray', () => {
  it('parses a P6 header and converts RGB to Rec.601 luma', () => {
    // 2×1: white then black.
    const buf = ppm(2, 1, [255, 255, 255, 0, 0, 0]);
    const { width, height, pixels } = ppmToGray(buf);
    expect([width, height]).toEqual([2, 1]);
    expect(pixels[0]).toBe(255); // white → 255
    expect(pixels[1]).toBe(0); // black → 0
  });

  it('tolerates a comment line in the header', () => {
    const header = Buffer.from('P6\n# dwebp output\n1 1\n255\n', 'ascii');
    const { width, height, pixels } = ppmToGray(Buffer.concat([header, Buffer.from([10, 20, 30])]));
    expect([width, height]).toEqual([1, 1]);
    expect(pixels[0]).toBe((0.299 * 10 + 0.587 * 20 + 0.114 * 30) | 0);
  });
});

describe('dHash', () => {
  it('emits 16 hex chars (64 bits) for a 9×8 matrix', () => {
    const gray = new Uint8Array(9 * 8).fill(0);
    expect(dHash(gray, 9, 8)).toHaveLength(16);
  });

  it('sets a bit where a pixel is brighter than its right neighbour', () => {
    // One row of width 9: a single bright→dark step at x=0, flat elsewhere.
    const row = [255, 0, 0, 0, 0, 0, 0, 0, 0];
    const gray = new Uint8Array([...row, ...Array(9 * 7).fill(0)]);
    const hex = dHash(gray, 9, 8);
    // First comparison (255 > 0) → leading bit 1 → first hex nibble 0b1000 = 8.
    expect(hex[0]).toBe('8');
  });

  it('an all-flat image hashes to all zeros (no left>right anywhere)', () => {
    expect(dHash(new Uint8Array(9 * 8).fill(128), 9, 8)).toBe('0000000000000000');
  });
});

describe('hammingHex', () => {
  it('counts differing bits', () => {
    expect(hammingHex('0', '1')).toBe(1); // 0000 vs 0001
    expect(hammingHex('f', '0')).toBe(4); // 1111 vs 0000
    expect(hammingHex('00', '00')).toBe(0);
  });

  it('is Infinity for missing or mismatched-length hashes (never falsely clusters)', () => {
    expect(hammingHex(null, '00')).toBe(Infinity);
    expect(hammingHex('000', '00')).toBe(Infinity);
  });
});

describe('clusterByHamming', () => {
  const items = [
    { id: 'a', pHash: '0000000000000000' },
    { id: 'b', pHash: '0000000000000001' }, // 1 bit from a
    { id: 'c', pHash: 'ffffffffffffffff' }, // far from a/b
    { id: 'd', pHash: 'fffffffffffffffe' }, // 1 bit from c
  ];

  it('groups near-dups within threshold and keeps far shots apart', () => {
    const clusters = clusterByHamming(items, 2).map((c) => c.map((x) => x.id).sort());
    // {a,b} and {c,d} — two near-dup pairs.
    expect(clusters.map((c) => c.join('')).sort()).toEqual(['ab', 'cd']);
  });

  it('a threshold of 0 leaves every distinct shot its own singleton', () => {
    const clusters = clusterByHamming(items, 0);
    expect(clusters).toHaveLength(4);
    expect(clusters.every((c) => c.length === 1)).toBe(true);
  });

  it('single-link transitively chains a near-dup run', () => {
    const chain = [
      { id: '1', pHash: '0000000000000000' },
      { id: '2', pHash: '0000000000000001' },
      { id: '3', pHash: '0000000000000003' }, // 1 bit from 2, 2 bits from 1
    ];
    const clusters = clusterByHamming(chain, 1);
    expect(clusters).toHaveLength(1); // 1—2—3 chained even though 1↔3 is 2 bits
    expect(clusters[0].map((x) => x.id).sort()).toEqual(['1', '2', '3']);
  });
});

describe.skipIf(!CWEBP_AVAILABLE)('fileDHash (#2806)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'file-dhash-test-'));
  const stripe = (x) => (x < 5 ? [255, 255, 255] : [0, 0, 0]); // left-white/right-black 9×8 pattern

  it('hashes a PNG file (routes through imageFileToWebp — dwebp cannot read PNG directly)', () => {
    const pngPath = join(dir, 'stripe.png');
    writeFileSync(pngPath, makePng(9, 8, (x) => stripe(x)));
    const hex = fileDHash(pngPath);
    expect(hex).toMatch(/^[0-9a-f]{16}$/);
  });

  it('hashes a WebP file directly, with no conversion step', () => {
    const pngPath = join(dir, 'stripe2.png');
    writeFileSync(pngPath, makePng(9, 8, (x) => stripe(x)));
    const webpPath = join(dir, 'stripe2.webp');
    writeFileSync(webpPath, imageFileToWebp(pngPath));
    const hex = fileDHash(webpPath);
    expect(hex).toMatch(/^[0-9a-f]{16}$/);
  });

  it('a PNG and its WebP re-encode of the same image hash identically', () => {
    const pngPath = join(dir, 'stripe3.png');
    writeFileSync(pngPath, makePng(9, 8, (x) => stripe(x)));
    const webpPath = join(dir, 'stripe3.webp');
    writeFileSync(webpPath, imageFileToWebp(pngPath));
    expect(fileDHash(pngPath)).toBe(fileDHash(webpPath));
  });

  it('a flat (no left>right anywhere) image hashes to all zeros, same convention as dHash', () => {
    const pngPath = join(dir, 'flat.png');
    writeFileSync(pngPath, makePng(9, 8, () => [128, 128, 128]));
    expect(fileDHash(pngPath)).toBe('0000000000000000');
  });

  it('returns null (never throws) for a nonexistent / undecodable path', () => {
    expect(fileDHash(join(dir, 'does-not-exist.png'))).toBeNull();
  });

  afterAll(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ } });
});
