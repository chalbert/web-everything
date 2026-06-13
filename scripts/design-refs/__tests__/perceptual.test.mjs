// Tests for the perceptual near-dup pass (backlog #395): PPM parse → dHash fingerprint → Hamming
// distance → single-link clustering. Pure logic, no dwebp/sharp/browser — the decode (dwebp) is the
// only I/O and is exercised by the CLI, not here.

import { describe, it, expect } from 'vitest';
import { ppmToGray, dHash, hammingHex, clusterByHamming } from '../../design-refs.mjs';

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
