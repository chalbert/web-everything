// Tests for the verdict benchmark harness (backlog #512, epic #490 slice B): the harness runs a vision
// provider over the training manifest's held-out split (slice A / #511) and scores verdict-agreement +
// per-class quarantine-recall against the recipe's graduation floors. The scorer is pure — proven here
// without a browser, a model, or real corpus data (like export-corpus.test.mjs). The runner is exercised
// with a fixture provider + in-memory loadFrame.

import { describe, it, expect } from 'vitest';
import { scoreBenchmark, runBenchmark, parseThreshold, isQuarantineVerdict } from '../benchmark.mjs';

const hash = (c) => c.repeat(64);
const recipe = {
  graduationBenchmark: {
    verdictAgreement: '>=0.95 vs hosted model on the held-out split',
    quarantineRecallFloor: '>=0.98 vs hosted model on the held-out split',
  },
};

// 4 held-out frames (2 quarantine-class: marketing, non-app) + 1 train frame that must be ignored.
const records = [
  { contentHash: hash('a'), verdict: 'app', split: 'holdout', frame: 'items/a/screenshot.webp' },
  { contentHash: hash('b'), verdict: 'app', split: 'holdout', frame: 'items/b/screenshot.webp' },
  { contentHash: hash('m'), verdict: 'marketing', split: 'holdout', frame: 'quarantine/m/screenshot.webp' },
  { contentHash: hash('n'), verdict: 'non-app', split: 'holdout', frame: 'quarantine/n/screenshot.webp' },
  { contentHash: hash('t'), verdict: 'blank', split: 'train', frame: 'quarantine/t/screenshot.webp' },
];

describe('parseThreshold', () => {
  it('extracts the numeric floor from a recipe spec string', () => {
    expect(parseThreshold('>=0.95 vs hosted model')).toBe(0.95);
    expect(parseThreshold('>=0.98')).toBe(0.98);
  });
  it('returns null for a TBD/placeholder or non-string', () => {
    expect(parseThreshold('TBD — set by the harness')).toBe(null);
    expect(parseThreshold(undefined)).toBe(null);
  });
});

describe('isQuarantineVerdict', () => {
  it('marketing/error/blank/non-app are quarantine-class; app/obstructed/ungated are not', () => {
    expect(['marketing', 'error', 'blank', 'non-app'].every(isQuarantineVerdict)).toBe(true);
    expect(['app', 'obstructed', 'ungated'].some(isQuarantineVerdict)).toBe(false);
  });
});

describe('scoreBenchmark', () => {
  it('scores only the held-out split, ignoring train records', () => {
    const perfect = { [hash('a')]: 'app', [hash('b')]: 'app', [hash('m')]: 'marketing', [hash('n')]: 'non-app' };
    const r = scoreBenchmark({ records, predictions: perfect, recipe });
    expect(r.total).toBe(4); // the split:'train' record is excluded
    expect(r.agreement).toMatchObject({ matched: 4, total: 4, fraction: 1 });
  });

  it('a perfect provider passes both graduation gates', () => {
    const perfect = { [hash('a')]: 'app', [hash('b')]: 'app', [hash('m')]: 'marketing', [hash('n')]: 'non-app' };
    const r = scoreBenchmark({ records, predictions: perfect, recipe });
    expect(r.quarantineRecall.overall).toMatchObject({ recalled: 2, total: 2, fraction: 1 });
    expect(r.graduation.verdictAgreement.pass).toBe(true);
    expect(r.graduation.quarantineRecall.pass).toBe(true);
    expect(r.graduation.pass).toBe(true);
  });

  it('counts quarantine-recall by the admission DECISION, not exact-verdict match', () => {
    // 'm' truly marketing but predicted non-app: wrong verdict (agreement miss) yet still quarantined → recalled.
    const preds = { [hash('a')]: 'app', [hash('b')]: 'app', [hash('m')]: 'non-app', [hash('n')]: 'non-app' };
    const r = scoreBenchmark({ records, predictions: preds, recipe });
    expect(r.agreement.matched).toBe(3); // m's verdict disagrees
    expect(r.quarantineRecall.overall.fraction).toBe(1); // but both quarantine-class frames stay quarantined
    expect(r.quarantineRecall.byClass.marketing).toMatchObject({ recalled: 1, total: 1 });
  });

  it('a quarantine miss (junk predicted admit) fails the quarantine-recall gate', () => {
    // 'm' marketing predicted 'app' → would be ADMITTED: a recall miss, the costly asymmetric error.
    const preds = { [hash('a')]: 'app', [hash('b')]: 'app', [hash('m')]: 'app', [hash('n')]: 'non-app' };
    const r = scoreBenchmark({ records, predictions: preds, recipe });
    expect(r.quarantineRecall.overall).toMatchObject({ recalled: 1, total: 2, fraction: 0.5 });
    expect(r.graduation.quarantineRecall.pass).toBe(false);
    expect(r.graduation.pass).toBe(false);
  });

  it('a missing prediction is a miss, never silently dropped', () => {
    const preds = { [hash('a')]: 'app', [hash('b')]: 'app', [hash('m')]: 'marketing' }; // n unpredicted
    const r = scoreBenchmark({ records, predictions: preds, recipe });
    expect(r.agreement.matched).toBe(3);
    expect(r.confusion['non-app'].unpredicted).toBe(1);
    expect(r.quarantineRecall.overall).toMatchObject({ recalled: 1, total: 2 }); // n not recalled
  });

  it('an unset floor (TBD) yields a null, non-graduating gate', () => {
    const tbdRecipe = { graduationBenchmark: { verdictAgreement: '>=0.95', quarantineRecallFloor: 'TBD' } };
    const perfect = { [hash('a')]: 'app', [hash('b')]: 'app', [hash('m')]: 'marketing', [hash('n')]: 'non-app' };
    const r = scoreBenchmark({ records, predictions: perfect, recipe: tbdRecipe });
    expect(r.graduation.quarantineRecall.pass).toBe(null);
    expect(r.graduation.pass).toBe(false); // can't graduate while a floor is unset
  });

  it('an empty held-out split yields a valid, null-fraction result', () => {
    const r = scoreBenchmark({ records: [], predictions: {}, recipe });
    expect(r.total).toBe(0);
    expect(r.agreement.fraction).toBe(null);
    expect(r.quarantineRecall.overall.fraction).toBe(null);
    expect(r.graduation.pass).toBe(false);
  });
});

describe('runBenchmark', () => {
  const provider = {
    name: 'fixture',
    // echoes back the verdict encoded in the loaded input — stands in for a real model
    async classifyCandidate(input) { return { verdict: input.verdict }; },
  };
  const loadFrame = (r) => ({ url: r.frame, verdict: r.verdict, pngBase64: '', dims: null });

  it('drives the provider over held-out frames and reports the provider name', async () => {
    const r = await runBenchmark({ provider, records, recipe, loadFrame });
    expect(r.provider).toBe('fixture');
    expect(r.total).toBe(4);
    expect(r.agreement.fraction).toBe(1); // fixture echoes truth → perfect
    expect(r.skipped).toBe(0);
  });

  it('an unloadable frame is skipped and counts as an unpredicted miss', async () => {
    const flaky = (r) => (r.contentHash === hash('n') ? null : { url: r.frame, verdict: r.verdict });
    const r = await runBenchmark({ provider, records, recipe, loadFrame: flaky });
    expect(r.skipped).toBe(1);
    expect(r.agreement.matched).toBe(3);
    expect(r.quarantineRecall.overall.recalled).toBe(1); // n never classified → not recalled
  });

  it('throws if the provider lacks classifyCandidate', async () => {
    await expect(runBenchmark({ provider: {}, records, recipe, loadFrame })).rejects.toThrow(/classifyCandidate/);
  });
});
