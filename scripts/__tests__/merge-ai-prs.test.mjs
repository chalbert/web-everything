/**
 * @file scripts/__tests__/merge-ai-prs.test.mjs
 * @description The drain's graduatedTo RESOLUTION BASIS surface (#2447). (The original monolithic file of this
 *   name was split into the `merge-ai-prs-*.test.mjs` siblings; this one covers only the #2447 slice.) A
 *   backlog-only PR that resolves its item via `graduatedTo` must lead its durable park/skip comment with the
 *   "no code change — deliverable already landed" banner, while every other PR's comment — and the dedupe keyed
 *   on its text — stays byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { withResolutionBasis, buildDrainReasonComment, hasDrainReasonComment, buildDrainVerdicts } from '../merge-ai-prs.mjs';
import { buildManifest } from '../readiness/lane-manifest.mjs';
import { deriveResolutionBasis, graduatedToFromBody } from '../lib/review-render.mjs';

describe('withResolutionBasis — the drain park/skip comment (#2447)', () => {
  const reason = 'branch is BEHIND main — rebase needed';

  it('leads the comment with the banner for a backlog-only graduatedTo resolve', () => {
    // Mirrors the drain's own derivation inputs: the body note extracted at verdict-build, the PR's file set.
    const basis = deriveResolutionBasis({
      bodyGraduatedTo: graduatedToFromBody('Resolves #2403.\n\ngraduatedTo: 6b5874f7\n'),
      changedFiles: ['backlog/2403-review-disposition.md'],
    });
    const comment = buildDrainReasonComment('skip', withResolutionBasis(reason, basis), null);
    expect(comment).toContain('`graduatedTo: 6b5874f7` — no code change — deliverable already landed in `6b5874f7`');
    expect(comment.indexOf('Resolution basis')).toBeLessThan(comment.indexOf(reason));
    expect(hasDrainReasonComment([{ body: comment }], 'skip', withResolutionBasis(reason, basis), null)).toBe(true);
  });

  it('returns the reason UNCHANGED for a code resolve, a missing basis, or an empty reason', () => {
    const codeBasis = deriveResolutionBasis({ bodyGraduatedTo: '6b5874f7', changedFiles: ['backlog/2403-x.md', 'scripts/x.mjs'] });
    expect(codeBasis).toBe(null);
    expect(withResolutionBasis(reason, codeBasis)).toBe(reason);
    expect(withResolutionBasis(reason, undefined)).toBe(reason);
    expect(withResolutionBasis('', { graduatedTo: '6b5874f7', ref: '6b5874f7' })).toBe('');
    expect(withResolutionBasis(null, { graduatedTo: '6b5874f7', ref: '6b5874f7' })).toBe(null);
  });
});

describe('buildDrainVerdicts — carries the graduatedTo sources the escalation pass derives the basis from (#2447)', () => {
  const green = [{ name: 'test', conclusion: 'SUCCESS' }];
  const ghPr = (number, body) => ({ number, title: 't', body, headRefName: `lane/${number}-x`, statusCheckRollup: green, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', labels: [{ name: 'ready-to-merge' }] });
  const verdictFor = (pr, manifest) => buildDrainVerdicts({ prsByRepo: new Map([[null, [pr]]]), readOf: () => ({ commits: [{ oid: 'abc' }], manifest }), repos: [null] })[0];

  it('attaches the manifest graduatedTo and the body note, which derive the banner for a backlog-only diff', () => {
    const manifest = buildManifest({ item: 2403, repos: [{ repo: 'we', ref: 'lane/2403-x' }], graduatedTo: '6b5874f7' });
    const v = verdictFor(ghPr(421, 'Dedup-resolve.\n\ngraduatedTo: b54f49a8\n'), manifest);
    expect(v.manifestGraduatedTo).toBe('6b5874f7');
    expect(v.bodyGraduatedTo).toBe('b54f49a8');
    // the escalation pass's exact derivation call, over a backlog-only file set — the manifest wins
    const basis = deriveResolutionBasis({ manifest: { graduatedTo: v.manifestGraduatedTo }, bodyGraduatedTo: v.bodyGraduatedTo, changedFiles: ['backlog/2403-x.md'], crossRepo: v.crossRepo });
    expect(basis).toMatchObject({ ref: '6b5874f7', source: 'manifest' });
  });

  it('a plain PR carries null sources', () => {
    const v = verdictFor(ghPr(422, 'what changed and why'), null);
    expect(v.manifestGraduatedTo).toBe(null);
    expect(v.bodyGraduatedTo).toBe(null);
  });
});
