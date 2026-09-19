/**
 * @file decision-docket-render.test.mjs — proof of the Decision Docket's TEMPLATE half: a PURE function from
 * {data JSON, template.html} to HTML. Covers determinism (same input → byte-identical output), that every
 * prepared item gets a full `.dcard` fork breakdown (the docket's hard rule — docs/agent/backlog-workflow.md
 * #decision-docket), that a parse-incomplete item is flagged rather than silently thinned to a table row, and
 * — the whole point of this rebuild — that there is NO code path that renders freeform narrative sections
 * ("Correction —", "second pass", "false alarm") anywhere in the output.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderDocketHtml, mdInline, ageClass } from '../decision-docket-render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const TEMPLATE = readFileSync(join(ROOT, 'skills-src/decision-docket/template.html'), 'utf8');

function sampleData(overrides = {}) {
  return {
    generatedFromRef: 'origin/main',
    items: [
      {
        num: '64', title: 'Tree-select block', prepared: true, preparedDate: '2026-01-01',
        leverageScore: 100, directUnblocks: 2, transitiveUnblocks: 3, unblocksToReady: 1, ageInDays: 10,
        digest: ['This is the digest.'],
        forks: [{
          n: 1, crux: 'A question', why: 'Because reasons.',
          options: [
            { label: '(a)', kind: 'rejected', body: 'Rejected: bad idea.' },
            { label: '(b)', kind: 'default', body: 'The good idea.' },
          ],
          notes: [], skeptic: 'SURVIVES.', screen: 'clear.', parseOk: true, warning: null,
        }],
        doneWhen: ['1. Ships the thing.'],
        parseOk: true, warnings: [],
      },
    ],
    ...overrides,
  };
}

describe('renderDocketHtml', () => {
  it('is a pure function — identical input always produces identical output', () => {
    const a = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13T00:00:00Z') });
    const b = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13T00:00:00Z') });
    expect(a).toBe(b);
  });

  it('renders a full .dcard fork breakdown for every prepared item — never a bare table row', () => {
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('class="dcard"');
    expect(html).toContain('FORK 1');
    expect(html).toContain('class="opt oc"'); // the default option
    expect(html).toContain('class="opt ov"'); // the rejected option
    expect(html).toContain('Rejected: bad idea.'); // the rejection reason survives, never dropped
    expect(html).toContain('SURVIVES.');
    expect(html).toContain('clear.');
  });

  it('shows only the heading + a referral for a parse-incomplete FORK — never a best-effort render of unreliable content', () => {
    const data = sampleData();
    data.items[0].forks[0].parseOk = false;
    data.items[0].forks[0].warning = 'Fork 1: no option marked RECOMMENDED — default could not be identified.';
    const html = renderDocketHtml(data, TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('Parse incomplete:');
    expect(html).toContain('FORK 1');
    // the (possibly garbled, from a non-canonical legacy dialect) option/skeptic text is NOT rendered
    expect(html).not.toContain('Rejected: bad idea.');
    expect(html).not.toContain('SURVIVES.');
  });

  it('flags a parse-incomplete prepared item rather than silently thinning it to a table row', () => {
    const data = sampleData();
    data.items[0].parseOk = false;
    data.items[0].warnings = ['No "## Fork N" sections found in the body.'];
    const html = renderDocketHtml(data, TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('Parse incomplete');
    // it still gets a .dcard (the hard rule: never fall back to a table-only row for a prepared item)
    expect(html).toContain('class="dcard"');
  });

  it('lists an un-prepared item only in the upstream table, never as a fake .dcard', () => {
    const data = sampleData();
    data.items.push({
      num: '99', title: 'Cold item', prepared: false, preparedDate: null,
      leverageScore: 1, directUnblocks: 0, transitiveUnblocks: 0, unblocksToReady: 0, ageInDays: 1,
      digest: [], forks: [], doneWhen: [], parseOk: true, warnings: [],
    });
    const html = renderDocketHtml(data, TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('#99');
    expect(html.match(/class="dcard"/g)?.length).toBe(1); // only #64, never #99
  });

  it('has no code path for freeform narrative sections — the schema has no field for one', () => {
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    for (const forbidden of ['Correction —', 'second pass', 'false alarm', 'Retraction']) {
      expect(html).not.toContain(forbidden);
    }
  });

  it('reads the verdict class off the START of Skeptic/Screen text, not a substring match on the prose', () => {
    // The Skeptic prose routinely uses the word "flagged" in an unrelated sense ("the attack also flagged X
    // as under-specified") — a naive substring search would misclassify this as a flagged verdict.
    const data = sampleData();
    data.items[0].forks[0].skeptic = 'SURVIVES-WITH-AMENDMENT — the attack also flagged "X" as under-specified, then fixed it.';
    data.items[0].forks[0].screen = 'clear — no implementation concern.';
    const html = renderDocketHtml(data, TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('class="attack clear"');
  });

  it('reuses template.html\'s own CSS shell verbatim rather than re-declaring the visual language', () => {
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('--accent:#5A3A6B');
    expect(html).toContain('.dcard{background:var(--surface)');
  });

  it('never leaks template.html\'s own editor-facing instructional comment into the rendered page', () => {
    // Regression test for the leaked-comment bug: template.html's top-of-file documentation comment quoted a
    // LITERAL "<!-- REPEAT -->" as part of its own prose (documenting a marker used elsewhere in the file) —
    // under real HTML parsing a comment ends at the FIRST "-->" it contains, so that literal example closed
    // the comment early and everything after it (through the real closing "-->" many lines later) was never
    // actually inside a comment at all — it rendered as literal, visible page text, above the real "Decision
    // Docket" title. Assert none of that documentation text, nor any raw comment delimiter, survives.
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).not.toContain('THE ONE RULE THIS TEMPLATE EXISTS TO ENFORCE');
    expect(html).not.toContain('Fill the {{PLACEHOLDER}}');
    expect(html).not.toContain('<!--');
    expect(html).not.toContain('-->');
    // the real title is the first visible heading-shaped content, not stray prose above it
    expect(html.indexOf('<h1>Decision Docket</h1>')).toBeGreaterThan(-1);
  });

  it('strips a well-formed instructional HTML comment out of ANY template shell before rendering, not just the current file', () => {
    const customTemplate = '<title>X</title>\n<!-- Instructions for editors: do not restyle this file. -->\n'
      + '<style>.dcard{color:red}</style>\n<div class="wrap">';
    const html = renderDocketHtml(sampleData(), customTemplate, { now: new Date('2026-09-13') });
    expect(html).not.toContain('Instructions for editors');
    expect(html).toContain('.dcard{color:red}'); // real, non-comment shell content is preserved verbatim
  });

  it('gives every prepared item\'s .dcard a stable id and links the summary table row to it', () => {
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('id="item-64"');
    expect(html).toContain('href="#item-64"');
  });

  it('does not link an un-prepared row to a fragment that has no .dcard to land on', () => {
    const data = sampleData();
    data.items.push({
      num: '99', title: 'Cold item', prepared: false, preparedDate: null,
      leverageScore: 1, directUnblocks: 0, transitiveUnblocks: 0, unblocksToReady: 0, ageInDays: 1,
      digest: [], forks: [], doneWhen: [], parseOk: true, warnings: [],
    });
    const html = renderDocketHtml(data, TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).not.toContain('href="#item-99"');
    expect(html).not.toContain('id="item-99"');
  });

  it('renders the filter toolbar with the data attributes its own inline script filters on', () => {
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).toContain('class="filters"');
    expect(html).toMatch(/data-status="ready"/);
    expect(html).toMatch(/data-age="fresh"/);
    expect(html).toMatch(/data-detail="full"/);
  });

  it('carries no age-based "stale" row text-coloring rule (dropped — it overloaded the same red used for "needs prep")', () => {
    const html = renderDocketHtml(sampleData(), TEMPLATE, { now: new Date('2026-09-13') });
    expect(html).not.toMatch(/tr\.stale[^{]*td\.ti\{color/);
    expect(html).not.toMatch(/tr\.stale\s+\.age\{color/);
  });
});

describe('mdInline', () => {
  it('converts bold, code and italic, and escapes raw HTML', () => {
    expect(mdInline('**bold** and `code` and *italic*')).toBe('<strong>bold</strong> and <code>code</code> and <em>italic</em>');
    expect(mdInline('<script>alert(1)</script>')).not.toContain('<script>');
  });
  it('drops markdown link hrefs but keeps the visible text', () => {
    expect(mdInline('see [#64](/backlog/064/) for detail')).toBe('see #64 for detail');
  });
  it('converts a bold span that itself contains a nested italic word', () => {
    // A real fork option body shape: "**A minimum count N *and* at least one …**" — the naive "no asterisk
    // inside" bold regex refuses to match this at all, leaving literal ** in the rendered page.
    const out = mdInline('**A count *and* a trial**');
    expect(out).toBe('<strong>A count <em>and</em> a trial</strong>');
    expect(out).not.toContain('*');
  });
});

describe('ageClass', () => {
  it('buckets fresh/waiting/stale at the documented thresholds', () => {
    expect(ageClass(5)).toBe('fresh');
    expect(ageClass(45)).toBe('waiting');
    expect(ageClass(90)).toBe('stale');
  });
});
