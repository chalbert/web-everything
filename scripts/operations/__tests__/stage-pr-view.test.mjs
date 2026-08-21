/**
 * @file stage-pr-view.test.mjs — refusing an incomplete PR view before it can be believed.
 *
 * THE DEFECT UNDER TEST is not a crash, it is a QUIET DEFAULT. `assembleReviewDetail` reads
 * `labelNames(v.labels)`, `Array.isArray(v.comments) ? … : []` and `Array.isArray(v.files) ? … : []`, so a
 * view assembled by hand with a field forgotten reviews the PR as if it genuinely had no labels, no comments
 * and no changed files. The most expensive of those is `labels`: a `review:human` PR whose view lost its
 * labels reads as an ordinary PR, and the whole human-only gate is invisible to the reviewer.
 *
 * So the assertions below are about the line this operation draws: ABSENT is refused, EMPTY is believed.
 * Several of them exist specifically to stop a later "simplification" from collapsing the two.
 */
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGraph } from './import-graph.mjs';
import { stagePrViewOperation, checkStagedView, VIEW_FIELD_TYPES, STAGE_PR_VIEW_OP, WRITE_VIEW_EFFECT } from '../stage-pr-view.mjs';
import { createPayloadReader, createStagePrViewSinks, defaultViewDir } from '../stage-pr-view-io.mjs';
import { PR_VIEW_FIELDS, prViewFileName } from '../review-pr-io.mjs';

const view = (over = {}) => ({
  number: 1496,
  title: 'verify: declare over verify-lane',
  url: 'https://github.com/chalbert/web-everything/pull/1496',
  body: 'the PR body',
  labels: [{ name: 'review:human' }],
  comments: [],
  files: [{ path: 'scripts/operations/verify.mjs', additions: 10, deletions: 0 }],
  headRefName: 'lane/verify-operation',
  state: 'OPEN', // #xwp8ioh — a staged view without it cannot be reviewed at all (see VIEW_FIELD_TYPES)
  ...over,
});
const check = (v, over = {}) => checkStagedView({ view: v, pr: 1496, repo: 'chalbert/web-everything', fields: PR_VIEW_FIELDS, ...over });
const ops = (readPayload = () => view()) => stagePrViewOperation(
  { readPayload },
  { fields: PR_VIEW_FIELDS, viewFileName: prViewFileName, defaultDir: '/views' },
);
const step = (decl, name) => decl.steps.find((s) => s.name === name).step;

describe('the declared shape stays tied to the reader\'s', () => {
  /**
   * NOT DERIVED FROM `PR_VIEW_FIELDS` ON PURPOSE. If the type table were built from the reader's list, a new
   * field would arrive with no declared type and be waved through — a completeness check that silently stops
   * being complete. Asserting equality instead makes adding a field to the reader a failure HERE until
   * somebody decides what it must be.
   */
  it('covers exactly the fields the reader asks for — no more, no fewer', () => {
    expect(Object.keys(VIEW_FIELD_TYPES).sort()).toEqual([...PR_VIEW_FIELDS].sort());
  });

  it('refuses a field the reader wants that has no declared type, rather than skipping it', () => {
    expect(() => check(view(), { fields: [...PR_VIEW_FIELDS, 'reviewDecision'] }))
      .toThrow(/no declared type here/);
  });

  it('restates neither the field list nor the filename — both must be injected', () => {
    expect(() => stagePrViewOperation({ readPayload: () => ({}) }, { fields: PR_VIEW_FIELDS })).toThrow(/prViewFileName/);
    expect(() => stagePrViewOperation({ readPayload: () => ({}) }, { viewFileName: prViewFileName })).toThrow(/PR_VIEW_FIELDS/);
    expect(() => stagePrViewOperation({}, { fields: PR_VIEW_FIELDS, viewFileName: prViewFileName })).toThrow(/readPayload/);
  });
});

describe('absent is refused', () => {
  it('accepts a complete view', () => {
    expect(check(view()).view.number).toBe(1496);
  });

  // Each field named individually rather than looped, because the CONSEQUENCE differs per field and the
  // refusal message is supposed to say which one the operator is about to lose.
  it('refuses a view with no `labels` — the field that hides a human-only gate', () => {
    const { labels, ...rest } = view();
    expect(() => check(rest)).toThrow(/missing labels/);
    expect(() => check(rest)).toThrow(/review:human/);
  });

  it('refuses a view with no `comments` — the field that hides the escalation and the last verdict', () => {
    const { comments, ...rest } = view();
    expect(() => check(rest)).toThrow(/missing comments/);
  });

  it('refuses a view with no `files`, no `body`, no `headRefName`', () => {
    for (const field of ['files', 'body', 'headRefName']) {
      const v = view();
      delete v[field];
      expect(() => check(v)).toThrow(new RegExp(`missing ${field}`));
    }
  });

  // `null` is what a mapping from another API produces for a field it looked up and did not find — which is
  // exactly the case that must not read as "none".
  it('treats an explicit null the same as an omission', () => {
    expect(() => check(view({ labels: null }))).toThrow(/missing labels/);
  });

  it('names every missing field at once, not just the first', () => {
    const v = view();
    delete v.labels; delete v.comments;
    expect(() => check(v)).toThrow(/missing labels, comments/);
  });
});

describe('empty is believed', () => {
  /**
   * THE OTHER HALF OF THE DECISION, and the one a later refactor is most likely to break by "tightening" the
   * check into a truthiness test. A PR really can have no labels and no comments; refusing that would make
   * the operation unusable on exactly the ordinary PRs it is meant to serve.
   */
  it('accepts explicitly-empty arrays — an empty array is a claim, and claims are believed', () => {
    const out = check(view({ labels: [], comments: [], files: [] }));
    expect(out.view.labels).toEqual([]);
    expect(out.empty.sort()).toEqual(['comments', 'files', 'labels']);
  });

  it('accepts an empty body — a PR with no description is ordinary', () => {
    expect(check(view({ body: '' })).view.body).toBe('');
  });
});

describe('wrong types are refused', () => {
  // `typeof [] === 'object'`, so a presence-plus-typeof check would wave a bare object through as `labels`.
  it('refuses an object where an array is declared', () => {
    expect(() => check(view({ labels: { nodes: [] } }))).toThrow(/want array, got object/);
  });

  it('refuses a number where a string is declared, and a string where a number is', () => {
    expect(() => check(view({ headRefName: 42 }))).toThrow(/want string, got number/);
    expect(() => check(view({ number: '1496' }))).toThrow(/want number, got string/);
  });

  it('refuses a payload that is not an object at all', () => {
    for (const bad of [null, [], 'text', 7]) expect(() => check(bad)).toThrow(/not a JSON object/);
  });
});

describe('the subject is checked at STAGING, not only at reading (#1466)', () => {
  it('refuses a view whose number is not the PR being staged', () => {
    expect(() => check(view({ number: 1495 }))).toThrow(/says it is #1495/);
  });
});

describe('the path is the reader\'s own name', () => {
  it('stages under `prViewFileName`, so the reader finds it', () => {
    const decl = ops();
    const out = step(decl, 'check').fn({
      input: { pr: 1496, repo: 'chalbert/web-everything', dir: '/views' },
      findings: { read: view() },
    });
    expect(out.path).toBe(`/views/${prViewFileName('chalbert/web-everything', 1496)}`);
    // The slash is percent-encoded, NOT flattened to `-`: `foo-bar/baz` and `foo/bar-baz` collided under the
    // old scheme and one repo's view silently answered for the other's.
    expect(out.path).toContain('%2F');
  });

  it('refuses to stage with no directory rather than guessing one', () => {
    const decl = stagePrViewOperation({ readPayload: () => view() }, { fields: PR_VIEW_FIELDS, viewFileName: prViewFileName });
    expect(() => step(decl, 'check').fn({ input: { pr: 1496, repo: 'chalbert/web-everything', dir: '' }, findings: { read: view() } }))
      .toThrow(/no directory to stage into/);
  });
});

describe('the write effect', () => {
  it('declares one idempotent write carrying bytes the check already produced', () => {
    const effects = step(ops(), 'write').effects({ verdict: { path: '/views/x.json', view: view() } });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: WRITE_VIEW_EFFECT, idempotent: true });
    expect(JSON.parse(effects[0].payload.content).number).toBe(1496);
  });

  it('writes exactly where the check said, creating the directory', () => {
    const wrote = [];
    const made = [];
    const sinks = createStagePrViewSinks({ write: (p, c) => wrote.push([p, c]), mkdir: (d) => made.push(d) });
    return sinks[WRITE_VIEW_EFFECT]({ path: '/views/a.json', content: '{}\n' }).then((out) => {
      expect(wrote).toEqual([['/views/a.json', '{}\n']]);
      expect(made).toEqual(['/views']);
      expect(out).toMatchObject({ path: '/views/a.json' });
    });
  });
});

describe('the io shell fails closed on each half separately', () => {
  it('names an unreadable path', () => {
    const read = createPayloadReader({ read: () => { const e = new Error('x'); e.code = 'ENOENT'; throw e; } });
    expect(() => read({ from: '/nope.json' })).toThrow(/could not read the payload at \/nope.json — ENOENT/);
  });

  it('names unparseable bytes separately — the operator has to know which to fix', () => {
    const read = createPayloadReader({ read: () => 'not json' });
    expect(() => read({ from: '/x.json' })).toThrow(/\/x.json is not valid JSON/);
  });

  /**
   * `null` rather than a guessed default: a fabricated directory writes the view where the reader does not
   * look, and the review then fails with "no pre-fetched view" naming a path that was never the one staged —
   * an error message pointing away from the mistake.
   */
  it('reports no default directory rather than inventing one', () => {
    expect(defaultViewDir({})).toBeNull();
    expect(defaultViewDir({ WE_PR_VIEW_DIR: '/tmp/views' })).toBe('/tmp/views');
  });
});

describe('the declaration reaches nothing that can act', () => {
  // #3036's property. This operation WRITES, so `http-adapter.test.mjs`'s pinned read-only list cannot make
  // the claim on its behalf; without this, the module could grow an `fs` import and write straight out of a
  // `compute` step, where no effect ledger would record that it happened.
  it('keeps every write in the io shell', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    expect(importGraph(resolve(here, '..', 'stage-pr-view.mjs')).external).toEqual([]);
    expect(importGraph(resolve(here, '..', 'stage-pr-view-io.mjs')).external).toContain('node:fs');
  });
});
