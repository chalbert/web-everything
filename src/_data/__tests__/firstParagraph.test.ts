// Regression test for the digest derivation (#745), guarding `firstParagraph`'s heading skip against the
// lost-summary bug: a scaffolded item whose lead paragraph opens with a `#NNN` cross-reference (e.g.
// "#719 …") must KEEP that paragraph as its summary. The old `/^#/` skip treated `#719` as a markdown
// heading and dropped the whole lead, so `summary` came out empty and check:standards errored
// "missing required field summary" (hit on #743). A real ATX heading is hash(es) + a space (`# Title`).
//
// Exercises the pure `derive(body)` over SYNTHETIC bodies, so the rule is pinned independently of the
// live backlog (mirrors d3-readiness.test.ts / engine.test.mjs).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { derive } = require('../backlog.js') as {
  derive: (text: string, opts?: { isReport?: boolean }) => {
    title: string | undefined;
    summary: string | undefined;
    details: string | undefined;
  };
};

describe('derive — firstParagraph #NNN-leading digest (#745)', () => {
  it('keeps a lead paragraph that opens with a #NNN cross-reference', () => {
    const body = [
      '# Some item title',
      '',
      "#719 landed the served path; this item extends the resolver so /_maas/<trait>.js resolves.",
    ].join('\n');
    const { title, summary } = derive(body);
    expect(title).toBe('Some item title');
    expect(summary).toBe(
      '#719 landed the served path; this item extends the resolver so /_maas/<trait>.js resolves.',
    );
  });

  it('still skips a real ATX heading (hash + space) when finding the lead paragraph', () => {
    const body = [
      '# Title',
      '',
      '## A subheading that is NOT the summary',
      '',
      'The actual lead paragraph.',
    ].join('\n');
    expect(derive(body).summary).toBe('The actual lead paragraph.');
  });

  it('handles a digest that is entirely a #NNN-leading paragraph', () => {
    const { summary } = derive('# T\n\n#744 shipped the webpack adapter; Parcel carved to #756.');
    expect(summary).toBe('#744 shipped the webpack adapter; Parcel carved to #756.');
  });
});
