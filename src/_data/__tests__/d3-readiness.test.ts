// Regression test for the D3-readiness loader rule (#621), guarding the #608 `projectPending` demotion
// and its #613/#617 precision against silent regressions. Exercises the pure `deriveProjectReadiness`
// over SYNTHETIC items (the same approach `scripts/readiness/__tests__/engine.test.mjs` takes for
// `computeSelection`) — so the rule is pinned independently of whatever the live backlog happens to hold.
//
// The rule under test (src/_data/backlog.js): an OPEN issue/idea whose `relatedProject` is a `concept`
// project with ZERO shipped surface (no resolved item filed against it) is `projectPending` — demoted out
// of Tier A because the standard it builds into doesn't exist yet. A `concept` project that ALREADY has
// resolved work is status-DRIFT, not pending, so its dependents are NOT demoted.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deriveProjectReadiness } = require('../backlog.js') as {
  deriveProjectReadiness: (
    items: any[],
    projectStatus: Map<string, string>,
    builtSurfaceProjects?: Set<string>,
  ) => { relatedProjectStatus: string | undefined; projectPending: boolean }[];
};

/** Index the derivation back onto each item's num for readable assertions. */
function derive(items: any[], projectStatus: Map<string, string>, builtSurfaceProjects?: Set<string>) {
  const out = deriveProjectReadiness(items, projectStatus, builtSurfaceProjects);
  return new Map(items.map((it, i) => [it.num, out[i]]));
}

describe('D3-readiness — projectPending demotion (#608/#621)', () => {
  it('(a) demotes an open build whose relatedProject is a concept project with 0 resolved surface', () => {
    const items = [
      { num: '1', kind: 'story', status: 'open', relatedProject: 'webplugs' },
    ];
    const projectStatus = new Map([['webplugs', 'concept']]);
    const r = derive(items, projectStatus).get('1')!;
    expect(r.projectPending).toBe(true);
  });

  it('(b) does NOT demote when the concept project HAS resolved surface (status-drift, not pending)', () => {
    // webblocks is labelled `concept` but already has resolved work filed against it (#617 precision):
    // that is data-drift, not a project that genuinely isn't built — its open builds stay Tier A.
    const items = [
      { num: '1', kind: 'story', status: 'open', relatedProject: 'webblocks' },
      { num: '2', kind: 'story', status: 'resolved', relatedProject: 'webblocks' },
    ];
    const projectStatus = new Map([['webblocks', 'concept']]);
    const r = derive(items, projectStatus).get('1')!;
    expect(r.projectPending).toBe(false);
  });

  it('(c) populates relatedProjectStatus (and leaves it undefined when there is no relatedProject)', () => {
    const items = [
      { num: '1', kind: 'story', status: 'open', relatedProject: 'webplugs' },
      { num: '2', kind: 'story', status: 'open', relatedProject: 'mystery' }, // not in the status map
      { num: '3', kind: 'story', status: 'open' }, // no relatedProject at all
    ];
    const projectStatus = new Map([['webplugs', 'concept']]);
    const d = derive(items, projectStatus);
    expect(d.get('1')!.relatedProjectStatus).toBe('concept');
    expect(d.get('2')!.relatedProjectStatus).toBe('unknown'); // has a project, but it's not in the map
    expect(d.get('3')!.relatedProjectStatus).toBeUndefined(); // no relatedProject ⇒ no status
  });

  it('never demotes on a concept label alone — only the concept+zero-surface conjunction pends', () => {
    const items = [
      { num: '1', kind: 'story', status: 'open', relatedProject: 'shipped' }, // poc, not concept
      { num: '2', kind: 'story', status: 'open', relatedProject: 'pending' }, // concept, 0 resolved
    ];
    const projectStatus = new Map([['shipped', 'poc'], ['pending', 'concept']]);
    const d = derive(items, projectStatus);
    expect(d.get('1')!.projectPending).toBe(false); // non-concept project never pends
    expect(d.get('2')!.projectPending).toBe(true);
  });

  it('only OPEN issue/idea builds pend — resolved/active items and decisions are never demoted', () => {
    // Each item points at its OWN zero-surface concept project, so the only thing varying is the item's
    // own status/type (no shipped-surface side effect to confound the assertion).
    const items = [
      { num: '1', kind: 'story', status: 'open', relatedProject: 'p1' }, // open issue → pends
      { num: '2', kind: 'story', status: 'resolved', relatedProject: 'p2' }, // resolved → moot
      { num: '3', kind: 'story', status: 'active', relatedProject: 'p3' }, // active → moot
      { num: '4', kind: 'decision', status: 'open', relatedProject: 'p4' }, // decision is not a build
    ];
    const projectStatus = new Map([
      ['p1', 'concept'], ['p2', 'concept'], ['p3', 'concept'], ['p4', 'concept'],
    ]);
    const d = derive(items, projectStatus);
    expect(d.get('1')!.projectPending).toBe(true);
    expect(d.get('2')!.projectPending).toBe(false);
    expect(d.get('3')!.projectPending).toBe(false);
    expect(d.get('4')!.projectPending).toBe(false);
  });

  // ── #1260 — broadened shipped-surface proxy (parent-chain / graduatedTo / built demo) ──
  it('(#1260 shape 2) does NOT demote when surface ships via a resolved parent-CHAIN, not a repeated tag', () => {
    // The normal carve shape: build slices parented to an impl epic that names the project; the slices
    // themselves carry no `relatedProject`. The original proxy (own-frontmatter only) missed this.
    const items = [
      { num: '10', kind: 'epic', status: 'open', relatedProject: 'webrealtime' }, // impl epic names the project
      { num: '11', kind: 'story', status: 'resolved', parent: '10' }, // resolved slice, NO own relatedProject
      { num: '12', kind: 'story', status: 'open', relatedProject: 'webrealtime' }, // the open build under test
    ];
    const projectStatus = new Map([['webrealtime', 'concept']]);
    const d = derive(items, projectStatus);
    expect(d.get('12')!.projectPending).toBe(false); // chain reaches a resolved surface ⇒ not pending
  });

  it('(#1260 webcharts lesson) graduatedTo: project:<id> does NOT clear pending — it scaffolds, not builds', () => {
    // `graduatedTo: project:<id>` marks the item that CREATED the project entity + its design slices
    // (webcharts #570), which is project creation, not a shipped runtime. Counting it would wrongly clear a
    // designed-not-built project, so it is deliberately excluded. (The webcharts shape: a resolved scaffold
    // epic with `graduatedTo: project:webcharts`, design tasks parented under it, but an OPEN impl epic.)
    const items = [
      { num: '20', kind: 'epic', status: 'resolved', graduatedTo: 'project:webcharts' }, // the scaffold
      { num: '21', kind: 'task', status: 'resolved', parent: '20' }, // a design slice under the scaffold
      { num: '22', kind: 'story', status: 'open', relatedProject: 'webcharts' }, // the build under test
    ];
    const projectStatus = new Map([['webcharts', 'concept']]);
    expect(derive(items, projectStatus).get('22')!.projectPending).toBe(true); // scaffold ≠ built surface
  });

  it('(#1260 shape — built demo) a built demo clears pending; without one the same project pends', () => {
    const items = [{ num: '30', kind: 'story', status: 'open', relatedProject: 'webportals' }];
    const projectStatus = new Map([['webportals', 'concept']]);
    // no demo names it (and no resolved surface) ⇒ pends
    expect(derive(items, projectStatus, new Set()).get('30')!.projectPending).toBe(true);
    // a conformance/demo names it (a built runtime surface) ⇒ not pending
    expect(derive(items, projectStatus, new Set(['webportals'])).get('30')!.projectPending).toBe(false);
  });

  it('(#1260 webcharts counter-case) KEEPS pending a designed-not-built project (spec page only, no built surface)', () => {
    // webcharts: a `concept` project whose design/spec shipped but whose runtime genuinely does not exist
    // (an OPEN impl epic, zero resolved build items, no demo). Spec pages are deliberately NOT a signal, so
    // it must stay demoted — the over-correction the broadening must avoid.
    const items = [
      { num: '40', kind: 'epic', status: 'open', relatedProject: 'webcharts' }, // OPEN impl epic, not resolved
      { num: '41', kind: 'story', status: 'open', relatedProject: 'webcharts' }, // the build under test
    ];
    const projectStatus = new Map([['webcharts', 'concept']]);
    const d = derive(items, projectStatus, new Set()); // no demo names webcharts
    expect(d.get('41')!.projectPending).toBe(true);
  });
});
