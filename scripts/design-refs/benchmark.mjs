// design-refs/benchmark.mjs — on-device verdict benchmark harness (backlog #512, epic #490 slice B, #488 F1/F4)
//
// Slice A (#511) emits a {frame, verdict} training manifest with a deterministic held-out split. This
// harness runs ANY registered vision provider (vision.mjs classifyCandidate) over that held-out slice and
// reports two graduation metrics against the recipe's thresholds:
//
//   - verdict-agreement %     — fraction of held-out frames whose predicted verdict == the labeled verdict.
//   - per-class quarantine-recall — of the held-out frames whose TRUE verdict is a quarantine-class
//                                   (decideAdmission → 'quarantine': marketing/error/blank/non-app), the
//                                   fraction the provider ALSO sends to quarantine. This is the safety
//                                   metric: a miss here admits junk into the corpus, costlier than a
//                                   plain agreement miss, so it carries its own (higher) floor.
//
// Meeting both floors promotes the API bridge (#485) to the bundled on-device default; the hosted API then
// stays as the premium upgrade (#488 F1/F4). The harness is provider-agnostic and no-leakage (#475): it
// names no vendor — it scores whatever provider the environment selects, and the scorer is pure so it is
// fixture-tested without a browser, a model, or real corpus data (like export-corpus.test.mjs).

import { normalizeVerdict, decideAdmission } from './vision.mjs';

// A verdict is "quarantine-class" when the admission gate would quarantine it (the junk we must catch).
export function isQuarantineVerdict(verdict) {
  return decideAdmission(verdict) === 'quarantine';
}

// Parse a numeric floor out of a recipe threshold string like ">=0.95 vs hosted model …".
// Returns the float, or null when no concrete number is set yet (e.g. a "TBD — …" placeholder).
export function parseThreshold(spec) {
  if (typeof spec !== 'string') return null;
  const m = spec.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// ---- pure scorer -----------------------------------------------------------
// Score predictions against the held-out labeled slice. Pure + deterministic — no disk, model, or browser.
//   records     — labeled manifest records [{ contentHash, verdict, split, frame }]; only split:'holdout' is scored.
//   predictions — { [contentHash]: predictedVerdict }; a missing or null prediction counts as a miss
//                 (an un-scored held-out frame is a failure to classify, never silently dropped).
//   recipe      — provides graduationBenchmark thresholds (verdictAgreement, quarantineRecallFloor).
export function scoreBenchmark({ records = [], predictions = {}, recipe } = {}) {
  const holdout = records.filter((r) => r.split === 'holdout');
  const get = (h) => (predictions instanceof Map ? predictions.get(h) : predictions[h]);

  let matched = 0;
  const confusion = {};
  // quarantine-recall accumulators, keyed by TRUE verdict
  const qByClass = {};
  let qRecalled = 0;
  let qTotal = 0;

  for (const r of holdout) {
    const truth = normalizeVerdict(r.verdict);
    const has = get(r.contentHash) != null;
    const pred = has ? normalizeVerdict(get(r.contentHash)) : null;

    if (pred === truth) matched += 1;
    (confusion[truth] ??= {});
    const predKey = pred ?? 'unpredicted';
    confusion[truth][predKey] = (confusion[truth][predKey] ?? 0) + 1;

    if (isQuarantineVerdict(truth)) {
      qTotal += 1;
      const recalled = has && isQuarantineVerdict(pred);
      if (recalled) qRecalled += 1;
      const c = (qByClass[truth] ??= { recalled: 0, total: 0, fraction: 0 });
      c.total += 1;
      if (recalled) c.recalled += 1;
    }
  }
  for (const c of Object.values(qByClass)) c.fraction = c.total ? c.recalled / c.total : null;

  const total = holdout.length;
  const agreement = { matched, total, fraction: total ? matched / total : null };
  const quarantineRecall = {
    overall: { recalled: qRecalled, total: qTotal, fraction: qTotal ? qRecalled / qTotal : null },
    byClass: qByClass,
  };

  const grad = recipe?.graduationBenchmark ?? {};
  const agreeFloor = parseThreshold(grad.verdictAgreement);
  const qFloor = parseThreshold(grad.quarantineRecallFloor);
  const gate = (value, floor) =>
    floor == null ? { floor: null, value, pass: null } // no concrete floor set yet → not gating
      : { floor, value, pass: value != null && value >= floor };
  const graduation = {
    verdictAgreement: gate(agreement.fraction, agreeFloor),
    quarantineRecall: gate(quarantineRecall.overall.fraction, qFloor),
  };
  // Overall pass requires every gate with a concrete floor to pass; a null (unset/empty) gate can't graduate.
  const gates = [graduation.verdictAgreement, graduation.quarantineRecall];
  graduation.pass = gates.every((g) => g.pass === true);

  return { provider: null, total, agreement, quarantineRecall, confusion, graduation };
}

// ---- provider-driving runner (impure) --------------------------------------
// Drive a resolved vision provider over the held-out frames and score the result.
//   provider  — { name, classifyCandidate(input) }
//   records   — manifest records (holdout filtered inside scoreBenchmark)
//   loadFrame — async (record) => provider input { url, pngBase64, dims, selectorState }; a thrown/null
//               result means the frame couldn't be loaded → recorded as an unpredicted miss.
export async function runBenchmark({ provider, records = [], recipe, loadFrame } = {}) {
  if (!provider || typeof provider.classifyCandidate !== 'function') {
    throw new Error('runBenchmark: provider must have classifyCandidate()');
  }
  const holdout = records.filter((r) => r.split === 'holdout');
  const predictions = {};
  let skipped = 0;
  for (const r of holdout) {
    let input = null;
    try {
      input = loadFrame ? await loadFrame(r) : null;
    } catch {
      input = null;
    }
    if (!input) { skipped += 1; continue; } // unpredicted → counts as a miss in the scorer
    const out = await provider.classifyCandidate(input);
    predictions[r.contentHash] = normalizeVerdict(out?.verdict);
  }
  const score = scoreBenchmark({ records, predictions, recipe });
  return { ...score, provider: provider.name, skipped };
}
