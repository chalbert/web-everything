/**
 * visual-comparator.mjs — the screenshot-vs-baseline visual comparator (#2670).
 *
 * THE SHARED PRIMITIVE. This is the ONE callable comparator both review layers consume: the build-time visual
 * self-review (Layer 1, #2672) and the jury's visual lens (Layer 2, #2671, via `design-pixels-adapter.mjs`'s
 * `screenshot-vs-target` method, wired to this comparator by #2671). Constellation single-impl (#96): there is
 * exactly ONE diff engine — no second implementation in the adapter, no third in a Playwright reporter. Both
 * layers import `compareToBaseline` from here.
 *
 * WHY NOT NAIVE PIXEL EQUALITY. A screenshot re-rendered on a different machine, at a different time, differs from
 * its baseline in thousands of pixels that a human would call identical: font hinting, antialiasing on curved
 * edges, sub-pixel glyph positioning, GPU vs CPU rasterisation. Byte-for-byte equality would false-fail on every
 * such shot — useless as a review signal. So this comparator uses TWO tolerant, complementary measures:
 *
 *   1. STRUCTURAL / LAYOUT diff (the primary signal). The image is partitioned into a coarse grid of regions; the
 *      MEAN colour of each region is compared between shot and baseline. Region means are stable under rendering
 *      noise (averaging cancels antialiasing) but move sharply when a block SHIFTS, RESIZES, RECOLOURS, or
 *      DISAPPEARS — the layout regressions that actually matter (the console-board cluster shipped code-correct
 *      with a large visual delta exactly here). Each region whose mean colour distance exceeds the cell threshold
 *      becomes a `region-shift` finding carrying its bounding box, so a caller can point at WHERE the design drifted.
 *
 *   2. PIXEL-DELTA threshold (the magnitude signal). The fraction of pixels whose colour differs by more than a
 *      per-pixel tolerance (so antialiasing noise is ignored). This is the scalar `delta` in `[0,1]` — a global
 *      "how different overall" number the caller can trend or threshold.
 *
 * A shot MATCHES its baseline when there is no dimension mismatch, no region exceeds the structural threshold, AND
 * the pixel delta is within tolerance. All three thresholds are options with sensible defaults (below) so a caller
 * can tighten or loosen the lens without forking the engine.
 *
 * MISSING BASELINE = DOCUMENTED SKIP, NEVER A FALSE-FAIL. A surface with no committed baseline PNG returns
 * `{ skipped: true, match: null, ... }` — the comparator makes NO claim. The CALLER decides what a skip means:
 * Layer 1 falls back to a by-eye pass; the jury notes an ungrounded visual lens (per the #2657 adapter). A skip is
 * never a failure — a brand-new surface must not red a gate just because nobody has drawn its target yet.
 *
 * PURITY SEAM. `diffImages(shot, baseline, opts)` is PURE — plain `{ width, height, data }` in, verdict out, no
 * I/O, no deps — so the jury adapter can call it on in-memory captures. `compareToBaseline({ shotPath,
 * baselinePath })` is the thin file-facing wrapper: it does the missing-baseline check and the PNG decode (via the
 * isolated `png-io.mjs` codec), then delegates ALL judgement to `diffImages`. Keep new logic in `diffImages`.
 */
import { existsSync } from 'node:fs';
import { readPng } from './png-io.mjs';

/** Per-channel tolerance (0–255): a pixel counts as "different" only if some RGBA channel differs by MORE than
 *  this. Absorbs antialiasing / hinting noise. */
export const DEFAULT_PIXEL_TOLERANCE = 24;

/** Max fraction of differing pixels (0–1) still considered a MATCH. Above this the shot has drifted too far. */
export const DEFAULT_PIXEL_DELTA_THRESHOLD = 0.02;

/** Grid resolution for the structural diff — the image is split into GRID×GRID regions. Coarse enough to be
 *  noise-immune, fine enough to localise a shifted block. */
export const DEFAULT_GRID = 16;

/** Max region mean-colour distance (Euclidean over RGBA, 0–~510) before a region is flagged as a structural
 *  `region-shift`. A whole block moving/recolouring swings a region mean well past this; noise never does. */
export const DEFAULT_CELL_THRESHOLD = 24;

/**
 * @typedef {{ kind: string, severity: 'error'|'warn', detail: string,
 *             region?: { x: number, y: number, w: number, h: number } }} Finding
 * @typedef {{ match: boolean|null, delta: number, findings: Finding[], skipped?: boolean,
 *             dimensions?: { shot: [number, number], baseline: [number, number] } }} ComparisonResult
 */

/** Euclidean distance over RGBA between two flat pixel arrays at the given byte offsets. */
function pixelDistance(a, ai, b, bi) {
  const dr = a[ai] - b[bi];
  const dg = a[ai + 1] - b[bi + 1];
  const db = a[ai + 2] - b[bi + 2];
  const da = a[ai + 3] - b[bi + 3];
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/** Max absolute per-channel difference between two RGBA pixels — the noise-tolerant "did this pixel change" test. */
function maxChannelDiff(a, ai, b, bi) {
  return Math.max(
    Math.abs(a[ai] - b[bi]),
    Math.abs(a[ai + 1] - b[bi + 1]),
    Math.abs(a[ai + 2] - b[bi + 2]),
    Math.abs(a[ai + 3] - b[bi + 3]),
  );
}

/**
 * PURE diff engine. Compare a shot against a baseline and return `{ match, delta, findings }`. No I/O.
 * @param {{width:number,height:number,data:Uint8Array}} shot
 * @param {{width:number,height:number,data:Uint8Array}} baseline
 * @param {{pixelTolerance?:number, pixelDeltaThreshold?:number, grid?:number, cellThreshold?:number}} [opts]
 * @returns {ComparisonResult}
 */
export function diffImages(shot, baseline, opts = {}) {
  const pixelTolerance = opts.pixelTolerance ?? DEFAULT_PIXEL_TOLERANCE;
  const pixelDeltaThreshold = opts.pixelDeltaThreshold ?? DEFAULT_PIXEL_DELTA_THRESHOLD;
  const grid = opts.grid ?? DEFAULT_GRID;
  const cellThreshold = opts.cellThreshold ?? DEFAULT_CELL_THRESHOLD;

  const findings = [];

  // The comparison window is the overlap; the denominator is the LARGER canvas so a size change inflates delta
  // (a shot that is smaller/larger than its baseline is genuinely wrong, not a match on the shared region).
  const ow = Math.min(shot.width, baseline.width);
  const oh = Math.min(shot.height, baseline.height);
  const maxArea = Math.max(shot.width * shot.height, baseline.width * baseline.height);

  const dimensionMismatch = shot.width !== baseline.width || shot.height !== baseline.height;
  if (dimensionMismatch) {
    findings.push({
      kind: 'dimension-mismatch',
      severity: 'error',
      detail: `shot ${shot.width}x${shot.height} vs baseline ${baseline.width}x${baseline.height}`,
    });
  }

  // --- 1. Pixel-delta over the overlap ---
  let differing = 0;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const si = (y * shot.width + x) * 4;
      const bi = (y * baseline.width + x) * 4;
      if (maxChannelDiff(shot.data, si, baseline.data, bi) > pixelTolerance) differing++;
    }
  }
  // Pixels outside the overlap (present in only one image) count as differing.
  const nonOverlap = maxArea - ow * oh;
  const delta = maxArea === 0 ? 0 : (differing + nonOverlap) / maxArea;
  if (delta > pixelDeltaThreshold && !dimensionMismatch) {
    findings.push({
      kind: 'pixel-delta-exceeded',
      severity: 'error',
      detail: `pixel delta ${delta.toFixed(4)} exceeds threshold ${pixelDeltaThreshold}`,
    });
  }

  // --- 2. Structural / layout diff over a GRID×GRID mesh of the overlap ---
  let structuralFindings = 0;
  if (ow > 0 && oh > 0) {
    for (let gy = 0; gy < grid; gy++) {
      const y0 = Math.floor((gy * oh) / grid);
      const y1 = Math.floor(((gy + 1) * oh) / grid);
      for (let gx = 0; gx < grid; gx++) {
        const x0 = Math.floor((gx * ow) / grid);
        const x1 = Math.floor(((gx + 1) * ow) / grid);
        let sr = 0, sg = 0, sb = 0, sa = 0, br = 0, bg = 0, bb = 0, ba = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const si = (y * shot.width + x) * 4;
            const bi = (y * baseline.width + x) * 4;
            sr += shot.data[si]; sg += shot.data[si + 1]; sb += shot.data[si + 2]; sa += shot.data[si + 3];
            br += baseline.data[bi]; bg += baseline.data[bi + 1]; bb += baseline.data[bi + 2]; ba += baseline.data[bi + 3];
            n++;
          }
        }
        if (n === 0) continue;
        const dr = sr / n - br / n;
        const dg = sg / n - bg / n;
        const db = sb / n - bb / n;
        const da = sa / n - ba / n;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
        if (dist > cellThreshold) {
          structuralFindings++;
          findings.push({
            kind: 'region-shift',
            severity: 'error',
            detail: `region mean-colour distance ${dist.toFixed(1)} exceeds ${cellThreshold}`,
            region: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
          });
        }
      }
    }
  }

  const match = !dimensionMismatch && delta <= pixelDeltaThreshold && structuralFindings === 0;
  return {
    match,
    delta,
    findings,
    dimensions: { shot: [shot.width, shot.height], baseline: [baseline.width, baseline.height] },
  };
}

/**
 * File-facing wrapper: compare a captured screenshot against a committed baseline PNG. Thin I/O only — the
 * missing-baseline skip and the PNG decode; the verdict comes from the pure `diffImages`.
 *
 * @param {{ shotPath: string, baselinePath: string,
 *           pixelTolerance?: number, pixelDeltaThreshold?: number, grid?: number, cellThreshold?: number }} args
 * @returns {ComparisonResult} On a missing baseline: `{ match: null, delta: 0, findings: [skip], skipped: true }`.
 */
export function compareToBaseline({ shotPath, baselinePath, ...opts }) {
  if (!baselinePath || !existsSync(baselinePath)) {
    return {
      match: null,
      delta: 0,
      skipped: true,
      findings: [
        {
          kind: 'baseline-missing',
          severity: 'warn',
          detail: `no committed baseline at ${baselinePath ?? '(unset)'} — documented skip, not a failure`,
        },
      ],
    };
  }
  const shot = readPng(shotPath);
  const baseline = readPng(baselinePath);
  return diffImages(shot, baseline, opts);
}
