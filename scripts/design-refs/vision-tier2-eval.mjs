// design-refs/vision-tier2-eval.mjs — Tier-2 small-VLM offline eval harness (backlog #1081, epic #1073 slice B)
//
// The Tier-2 analogue of benchmark.mjs (the Tier-1 verdict benchmark). Where benchmark.mjs scores a
// closed-set classifier's verdict-agreement, this harness scores a small VLM's RICH output (#1080
// contract: { description, tags, regions }) on the OBJECTIVELY-measurable capabilities ONLY:
//
//   - tagging          — multi-label set agreement: precision / recall / F1 of predicted tags vs truth.
//   - element/region   — localization: a predicted region matches a truth region when their labels agree
//     detection          AND their boxes overlap at IoU ≥ threshold; greedy best-IoU matching → P/R/F1.
//
// Description / critique quality is DELIBERATELY out of scope (it is subjective and waits on the #1034
// critique rubric); scoping to objective capabilities is what lets this slice start now and stay a hard,
// reproducible number. Like benchmark.mjs the scorers are PURE and provider-agnostic (#475 no-leakage):
// they name no vendor and score whatever normalized rich-output the environment produced, so they are
// fixture-tested without a model, a browser, or real corpus data. A candidate is named only in the eval
// DATA / report, never in this core.

import { normalizeRichOutput } from './vision.mjs';

// ---- tagging score (pure) --------------------------------------------------
// Multi-label set agreement. Tags are compared case-insensitively after the #1080 normalizer has already
// trimmed/deduped them. Empty truth + empty prediction is a vacuous perfect score (nothing to find, none
// hallucinated); empty truth + non-empty prediction is precision 0 (all false positives).
export function scoreTagging(predicted = [], truth = []) {
  const norm = (arr) => new Set((Array.isArray(arr) ? arr : []).map((t) => String(t).trim().toLowerCase()).filter(Boolean));
  const p = norm(predicted);
  const t = norm(truth);
  let tp = 0;
  for (const tag of p) if (t.has(tag)) tp += 1;
  const fp = p.size - tp;
  const fn = t.size - tp;
  return prf(tp, fp, fn);
}

// ---- region detection score (pure) ----------------------------------------
// Intersection-over-union of two normalized boxes ({ x, y, w, h } in 0..1). Returns 0 for any null box
// (a label-without-localization region cannot count as a localization match) or for non-overlapping boxes.
export function iou(a, b) {
  if (!a || !b) return 0;
  const ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

// Greedy label-matched detection: a predicted region matches a truth region of the SAME label whose box
// overlaps at IoU ≥ threshold; each truth region is consumed at most once (best IoU first). Unmatched
// predictions are false positives, unmatched truths false negatives. Box-less regions never match (their
// label still contributes through tagging).
export function scoreDetection(predicted = [], truth = [], iouThreshold = 0.5) {
  const preds = (Array.isArray(predicted) ? predicted : []).filter((r) => r && r.box);
  const truths = (Array.isArray(truth) ? truth : []).filter((r) => r && r.box);
  const claimed = new Array(truths.length).fill(false);
  let tp = 0;
  for (const pr of preds) {
    let bestIdx = -1;
    let bestIou = iouThreshold; // must meet the floor to count
    for (let i = 0; i < truths.length; i += 1) {
      if (claimed[i]) continue;
      if (String(truths[i].label).trim().toLowerCase() !== String(pr.label).trim().toLowerCase()) continue;
      const score = iou(pr.box, truths[i].box);
      if (score >= bestIou) { bestIou = score; bestIdx = i; }
    }
    if (bestIdx >= 0) { claimed[bestIdx] = true; tp += 1; }
  }
  const fp = preds.length - tp;
  const fn = truths.length - tp;
  return prf(tp, fp, fn);
}

// ---- per-sample + per-candidate aggregation (pure) -------------------------
// Score one held-out sample: normalize both sides through the #1080 contract, then tagging + detection.
export function scoreSample({ predicted, truth, iouThreshold = 0.5 } = {}) {
  const p = normalizeRichOutput(predicted ?? {});
  const t = normalizeRichOutput(truth ?? {});
  return {
    tagging: scoreTagging(p.tags, t.tags),
    detection: scoreDetection(p.regions, t.regions, iouThreshold),
  };
}

// Aggregate a candidate over the held-out set. `samples` = [{ contentHash, predicted, truth }]; a missing
// prediction is scored as an empty rich-output (a no-answer is a miss, never silently dropped — mirrors
// benchmark.mjs). Returns mean tagging-F1, mean detection-F1, and a combined score (their weighted mean,
// both objective capabilities equal by default — a recipe can reweight downstream).
//
// Detection is averaged ONLY over samples that carry a localization signal (≥1 boxed region on either
// side): a sample with no truth regions and no predicted regions is non-informative for detection (its
// degenerate F1 would be a vacuous 1.0 and inflate the score), so it is excluded — `detectionF1` is null
// when the whole set has no boxed regions, and `combined` then falls back to tagging alone.
export function scoreCandidate({ candidate, samples = [], iouThreshold = 0.5, taggingWeight = 0.5 } = {}) {
  const w = clamp01(taggingWeight);
  const scored = samples.map((s) => scoreSample({ predicted: s.predicted, truth: s.truth, iouThreshold }));
  const taggingF1 = mean(scored.map((s) => s.tagging.f1));
  const detApplicable = scored
    .map((s) => s.detection)
    .filter((d) => d.tp + d.fp + d.fn > 0);
  const detectionF1 = detApplicable.length ? mean(detApplicable.map((d) => d.f1)) : null;
  const combined = detectionF1 === null ? taggingF1 : w * taggingF1 + (1 - w) * detectionF1;
  return {
    candidate: candidate ?? null,
    n: samples.length,
    detectionSamples: detApplicable.length,
    iouThreshold,
    taggingF1,
    detectionF1,
    combined,
  };
}

// Rank candidate results by combined score, descending. Stable for ties (preserves input order). Returns
// a new array of { rank, ...result }.
export function rankCandidates(results = []) {
  return [...results]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.combined - a.r.combined || a.i - b.i)
    .map(({ r }, idx) => ({ rank: idx + 1, ...r }));
}

// ---- shared helpers --------------------------------------------------------
function prf(tp, fp, fn) {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function clamp01(x) {
  return typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5;
}
