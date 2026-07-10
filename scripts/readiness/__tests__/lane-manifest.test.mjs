/**
 * @file scripts/readiness/__tests__/lane-manifest.test.mjs
 * @description Unit proof of the durable lane-manifest primitive (#2138 Fork 2) — the per-item cross-repo
 *   shape the deferred drain reads to land a queued item in a later session (impl-first/WE-last order,
 *   cross-item blockedBy, merge-risk files). Pairs with the ready-to-merge token (#2161).
 */
import { describe, it, expect } from 'vitest';
import {
  MANIFEST_FILENAME, INTEGRATION_ORDER,
  buildManifest, validateManifest, orderedRepos, parseManifest, serializeManifest,
  MANIFEST_BODY_BEGIN, MANIFEST_BODY_END, manifestBodyBlock, embedManifestInBody, extractManifestFromBody,
} from '../lane-manifest.mjs';

describe('lane-manifest primitive (#2138 Fork 2)', () => {
  const crossRepo = buildManifest({
    item: 2138,
    batchSlug: 'batch-2026-07-02-wf',
    repos: [
      { repo: 'we', ref: 'lane/2138-we-o2' },          // deliberately out of order on input
      { repo: 'frontierui', ref: 'lane/2138-fui-o2' },
    ],
    blockedBy: [2151],
    mergeRiskFiles: ['we:package.json'],
  });

  it('filename + integration order are the ratified constants', () => {
    expect(MANIFEST_FILENAME).toBe('.lane-manifest.json');
    expect(INTEGRATION_ORDER).toEqual(['frontierui', 'plateau-app', 'we']); // impl-first, WE last
  });

  it('normalizes to impl-first/WE-last order and defaults carriesResolve onto WE', () => {
    expect(crossRepo.repos.map((r) => r.repo)).toEqual(['frontierui', 'we']);
    expect(orderedRepos(crossRepo).map((r) => r.repo)).toEqual(['frontierui', 'we']);
    expect(crossRepo.repos.find((r) => r.repo === 'we').carriesResolve).toBe(true);
    expect(crossRepo.repos.find((r) => r.repo === 'frontierui').carriesResolve).toBe(false);
    expect(crossRepo.item).toBe(2138);      // coerced to number
    expect(crossRepo.blockedBy).toEqual([2151]);
    expect(crossRepo.mergeRiskFiles).toEqual(['we:package.json']);
  });

  it('#2171 — carries dismissedFindings (the drain escalation rubric signal); defaults to 0, clamps ≥0', () => {
    expect(buildManifest({ item: 1, repos: [{ repo: 'we', ref: 'lane/1-a' }] }).dismissedFindings).toBe(0);
    expect(buildManifest({ item: 1, repos: [{ repo: 'we', ref: 'lane/1-a' }], dismissedFindings: 3 }).dismissedFindings).toBe(3);
    expect(buildManifest({ item: 1, repos: [{ repo: 'we', ref: 'lane/1-a' }], dismissedFindings: -2 }).dismissedFindings).toBe(0);
  });

  it('validates a well-formed cross-repo and WE-only manifest', () => {
    expect(validateManifest(crossRepo)).toEqual({ ok: true, errors: [] });
    const weOnly = buildManifest({ item: 2161, repos: [{ repo: 'we', ref: 'lane/2161-we-o1' }] });
    expect(validateManifest(weOnly).ok).toBe(true);
    expect(weOnly.blockedBy).toEqual([]);   // defaults
  });

  it('rejects a manifest missing WE, missing a ref, or with a non-WE resolve carrier', () => {
    const noWe = buildManifest({ item: 9, repos: [{ repo: 'frontierui', ref: 'lane/9-fui-o1' }] });
    expect(validateManifest(noWe).ok).toBe(false);
    expect(validateManifest(noWe).errors.join(' ')).toMatch(/WE repo must be present/);

    const noRef = { item: 9, repos: [{ repo: 'we', ref: '', carriesResolve: true }], blockedBy: [], mergeRiskFiles: [] };
    expect(validateManifest(noRef).ok).toBe(false);
    expect(validateManifest(noRef).errors.join(' ')).toMatch(/missing its lane `ref`/);

    // Two carriers, and the resolve wrongly on an impl repo.
    const badCarrier = { item: 9, repos: [{ repo: 'frontierui', ref: 'a', carriesResolve: true }, { repo: 'we', ref: 'b', carriesResolve: true }], blockedBy: [], mergeRiskFiles: [] };
    expect(validateManifest(badCarrier).ok).toBe(false);
    expect(validateManifest(badCarrier).errors.join(' ')).toMatch(/exactly one repo must carry the resolve/);
  });

  it('round-trips through serialize/parse (durable across sessions)', () => {
    const back = parseManifest(serializeManifest(crossRepo));
    expect(back).toEqual(crossRepo);
    expect(validateManifest(back).ok).toBe(true);
  });

  it('parse tolerates empty/garbage → null (drain skips-and-reports, never crashes)', () => {
    expect(parseManifest('')).toBeNull();
    expect(parseManifest('   ')).toBeNull();
    expect(parseManifest('{ not json')).toBeNull();
  });

  describe('PR-body carrier (xnsk54v — manifest rides the PR body, not a committed file)', () => {
    it('embed→extract round-trips a manifest through a human PR body', () => {
      const body = '## What\n\nFixes the thing.\n';
      const withManifest = embedManifestInBody(body, crossRepo);
      expect(withManifest).toContain(MANIFEST_BODY_BEGIN);
      expect(withManifest).toContain(MANIFEST_BODY_END);
      expect(withManifest).toContain('Fixes the thing.'); // human body preserved
      expect(extractManifestFromBody(withManifest)).toEqual(crossRepo);
    });

    it('embed is idempotent — re-embedding REPLACES the block in place, never appends a second', () => {
      const once = embedManifestInBody('body text', crossRepo);
      const updated = buildManifest({ item: 2138, repos: [{ repo: 'we', ref: 'lane/2138-we-o3' }], dismissedFindings: 5 });
      const twice = embedManifestInBody(once, updated);
      expect(twice.match(new RegExp(MANIFEST_BODY_BEGIN, 'g')) || []).toHaveLength(1); // exactly one block
      expect(extractManifestFromBody(twice)).toEqual(updated);                          // and it's the new one
    });

    it('embeds into a null/empty body (manifest-only body is still a valid carrier)', () => {
      const block = embedManifestInBody(null, crossRepo);
      expect(extractManifestFromBody(block)).toEqual(crossRepo);
      expect(manifestBodyBlock(crossRepo)).toContain('```json');
    });

    it('extract returns null when there is no block, or the block JSON is garbage', () => {
      expect(extractManifestFromBody('a plain PR body with no manifest')).toBeNull();
      expect(extractManifestFromBody('')).toBeNull();
      expect(extractManifestFromBody(null)).toBeNull();
      const broken = `${MANIFEST_BODY_BEGIN}\n\`\`\`json\n{ not json\n\`\`\`\n${MANIFEST_BODY_END}`;
      expect(extractManifestFromBody(broken)).toBeNull();
    });

    it('extract ignores content around the block and survives an appended escalation-reason section', () => {
      const body = embedManifestInBody('intro', crossRepo) + '\n\n## Review escalation\n- size (…)\n';
      expect(extractManifestFromBody(body)).toEqual(crossRepo);
    });
  });
});
