/**
 * @file scripts/backlog/__tests__/frontmatter.test.mjs
 * Tests the surgical frontmatter splice + status transitions against in-memory fixtures — the body is
 * never touched, illegal transitions are refused, and stamps land next to their anchors.
 */
import { describe, it, expect } from 'vitest';
import { setFrontmatterField, readField, applyTransition, quoteScalar, validateCodifiedIn } from '../frontmatter.mjs';
import { nextNum, slugify, renderItem } from '../scaffold.mjs';

const ITEM = [
  '---',
  'kind: story',
  'size: 3',
  'status: open',
  'blockedBy: ["035", "136"]',
  'dateOpened: "2026-06-06"',
  'tags: [droplist, filter]',
  '---',
  '',
  '# Build the filter surface',
  '',
  'A digest that mentions status: and dateStarted: and must never change.',
  '',
  '## Progress',
  '- **Status:** open',
  '',
].join('\n');

describe('setFrontmatterField — surgical, body never touched', () => {
  it('replaces an existing field in place', () => {
    const out = setFrontmatterField(ITEM, 'status', 'active');
    expect(readField(out, 'status')).toBe('active');
    expect(out).toContain('## Progress\n- **Status:** open'); // body status line untouched
    expect(out).toContain('must never change');
  });

  it('inserts a new field after its anchor, not at the bottom', () => {
    const out = setFrontmatterField(ITEM, 'dateStarted', '"2026-06-10"', { after: ['dateOpened', 'status'] });
    const fm = out.slice(0, out.indexOf('\n---', 4));
    expect(fm).toMatch(/dateOpened: "2026-06-06"\ndateStarted: "2026-06-10"/);
    expect(readField(out, 'dateStarted')).toBe('2026-06-10');
  });

  it('returns null when there is no frontmatter', () => {
    expect(setFrontmatterField('# just a body\n', 'status', 'active')).toBeNull();
  });

  it('only edits the frontmatter block — a body line that looks like a field is left alone', () => {
    const out = setFrontmatterField(ITEM, 'status', 'resolved');
    expect((out.match(/^status:/gm) || []).length).toBe(1); // still only one top-level status:
    expect(out).toContain('- **Status:** open');
  });
});

describe('applyTransition — legal from-status enforced', () => {
  it('claim: open → active + dateStarted', () => {
    const r = applyTransition(ITEM, 'claim', { today: '2026-06-10' });
    expect(readField(r.content, 'status')).toBe('active');
    expect(readField(r.content, 'dateStarted')).toBe('2026-06-10');
  });

  it('claim refuses a non-open item (lost the race)', () => {
    const active = setFrontmatterField(ITEM, 'status', 'active');
    const r = applyTransition(active, 'claim', { today: '2026-06-10' });
    expect(r.error).toMatch(/expected "open"/);
    expect(r.content).toBeUndefined();
  });

  it('claim --as=preparing: open → preparing + dateStarted (#375)', () => {
    const r = applyTransition(ITEM, 'claim', { today: '2026-06-10', as: 'preparing' });
    expect(readField(r.content, 'status')).toBe('preparing');
    expect(readField(r.content, 'dateStarted')).toBe('2026-06-10');
  });

  it('release: preparing → open, stamps untouched (#375)', () => {
    const preparing = applyTransition(ITEM, 'claim', { today: '2026-06-10', as: 'preparing' }).content;
    const r = applyTransition(preparing, 'release', {});
    expect(readField(r.content, 'status')).toBe('open');
    expect(readField(r.content, 'dateStarted')).toBe('2026-06-10'); // not removed
  });

  it('resolve: active → resolved + dateResolved + graduatedTo', () => {
    const active = setFrontmatterField(ITEM, 'status', 'active');
    const r = applyTransition(active, 'resolve', { today: '2026-06-10', graduatedTo: 'intent:filter' });
    expect(readField(r.content, 'status')).toBe('resolved');
    expect(readField(r.content, 'dateResolved')).toBe('2026-06-10');
    expect(readField(r.content, 'graduatedTo')).toBe('intent:filter');
  });

  it('resolve: a graduatedTo with YAML-significant chars is quoted so the loader re-parses it (#603)', () => {
    const active = setFrontmatterField(ITEM, 'status', 'active');
    const value = 'the gap-sweep-rerun skill + /gap-sweep + #366 ruling';
    const r = applyTransition(active, 'resolve', { today: '2026-06-10', graduatedTo: value });
    expect(r.content).toContain(`graduatedTo: "${value}"`); // wrapped, not bare
    expect(readField(r.content, 'graduatedTo')).toBe(value); // and round-trips back to the raw value
  });

  it('release: active → open, stamps untouched', () => {
    const active = applyTransition(ITEM, 'claim', { today: '2026-06-10' }).content;
    const r = applyTransition(active, 'release', {});
    expect(readField(r.content, 'status')).toBe('open');
    expect(readField(r.content, 'dateStarted')).toBe('2026-06-10'); // not removed
  });

  it('release refuses an item that is not active', () => {
    expect(applyTransition(ITEM, 'release', {}).error).toMatch(/expected "active"/);
  });

  it('is deterministic — same input, identical output', () => {
    const a = applyTransition(ITEM, 'claim', { today: '2026-06-10' }).content;
    const b = applyTransition(ITEM, 'claim', { today: '2026-06-10' }).content;
    expect(a).toBe(b);
  });
});

describe('applyTransition — codification gate on kind:decision (#911)', () => {
  const DECISION = [
    '---', 'kind: decision', 'status: active',
    'dateOpened: "2026-06-18"', '---', '', '# A cross-cutting ruling', '',
  ].join('\n');

  it('refuses to resolve a decision with no codifiedIn (existing or flag)', () => {
    const r = applyTransition(DECISION, 'resolve', { today: '2026-06-18' });
    expect(r.error).toMatch(/no codifiedIn/);
    expect(r.content).toBeUndefined(); // never a half-written file
  });

  it('refuses a codifiedIn that is not a statute pointer', () => {
    const r = applyTransition(DECISION, 'resolve', { today: '2026-06-18', codifiedTo: 'see the docs' });
    expect(r.error).toMatch(/not a valid statute pointer/);
  });

  it('resolves with --codified-to a doc#anchor and stamps the field', () => {
    const ptr = 'docs/agent/platform-decisions.md#constellation-placement';
    const r = applyTransition(DECISION, 'resolve', { today: '2026-06-18', codifiedTo: ptr });
    expect(r.error).toBeUndefined();
    expect(readField(r.content, 'status')).toBe('resolved');
    expect(readField(r.content, 'codifiedIn')).toBe(ptr);
  });

  it('resolves with the one-off sentinel (a narrow call, no reusable rule)', () => {
    const r = applyTransition(DECISION, 'resolve', { today: '2026-06-18', codifiedTo: 'one-off' });
    expect(r.error).toBeUndefined();
    expect(readField(r.content, 'codifiedIn')).toBe('one-off');
  });

  it('resolves when codifiedIn already lives in frontmatter, no flag needed', () => {
    const withField = setFrontmatterField(DECISION, 'codifiedIn', '"docs/agent/platform-decisions.md#naming"');
    const r = applyTransition(withField, 'resolve', { today: '2026-06-18' });
    expect(r.error).toBeUndefined();
    expect(readField(r.content, 'status')).toBe('resolved');
  });

  it('does NOT gate non-decision items', () => {
    const idea = setFrontmatterField(ITEM, 'status', 'active');
    const r = applyTransition(idea, 'resolve', { today: '2026-06-18' });
    expect(r.error).toBeUndefined();
  });
});

describe('validateCodifiedIn', () => {
  it('accepts one-off and doc paths with/without anchor; rejects empty/bare/anchor-only', () => {
    expect(validateCodifiedIn('one-off')).toBeNull();
    expect(validateCodifiedIn('docs/agent/platform-decisions.md#constellation-placement')).toBeNull();
    expect(validateCodifiedIn('docs/agent/backlog-workflow.md')).toBeNull();
    expect(validateCodifiedIn(undefined)).toMatch(/no codifiedIn/);
    expect(validateCodifiedIn('')).toMatch(/no codifiedIn/);
    expect(validateCodifiedIn('#anchor-only')).toMatch(/not a valid/);
    expect(validateCodifiedIn('platform-decisions')).toMatch(/not a valid/);
  });
});

describe('quoteScalar — quotes iff a YAML-significant char is present (#603)', () => {
  it('leaves a plain slug untouched (diff-quiet)', () => {
    expect(quoteScalar('intent-filter')).toBe('intent-filter');
    expect(quoteScalar('/research/source-awareness-substrate/')).toBe('/research/source-awareness-substrate/');
    expect(quoteScalar('the gap-sweep-rerun skill and skill')).toBe('the gap-sweep-rerun skill and skill');
  });

  it('quotes a colon (the key/value separator) and a hash (comment intro)', () => {
    expect(quoteScalar('foo: bar')).toBe('"foo: bar"');
    expect(quoteScalar('see #492')).toBe('"see #492"');
  });

  it('quotes a leading YAML indicator char (@, *, !, [, {, -)', () => {
    expect(quoteScalar('@frontierui/plugs')).toBe('"@frontierui/plugs"');
    expect(quoteScalar('[a, b]')).toBe('"[a, b]"');
    expect(quoteScalar('- leading dash')).toBe('"- leading dash"');
  });

  it('escapes embedded double-quotes and passes an already-quoted value through', () => {
    expect(quoteScalar('a "quoted" word: x')).toBe('"a \\"quoted\\" word: x"');
    expect(quoteScalar('"already"')).toBe('"already"');
  });

  it('renders the empty string as explicit empty quotes', () => {
    expect(quoteScalar('')).toBe('""');
  });
});

describe('scaffold helpers', () => {
  it('nextNum is highest + 1, zero-padded', () => {
    expect(nextNum(['001', '002', '254'])).toBe('255');
    expect(nextNum([])).toBe('001');
  });

  it('slugify kebab-cases a title', () => {
    expect(slugify('Build the `filter` + clearable surface!')).toBe('build-the-filter-clearable-surface');
  });

  it('renderItem emits a check:standards-shaped skeleton (story carries size, digest present)', () => {
    const out = renderItem({ kind: 'story', size: 3, slug: 'x', title: 'Do the thing', today: '2026-06-10', blockedBy: ['254'] });
    expect(out).toContain('kind: story');
    expect(out).toContain('size: 3');
    expect(out).toContain('status: open');
    expect(out).toContain('blockedBy: ["254"]');
    expect(out).toContain('# Do the thing');
    expect(out).toMatch(/\n[^\n#-].*\n$/); // a non-empty digest paragraph at the end
  });

  it('a task carries no size', () => {
    const out = renderItem({ kind: 'task', slug: 'x', title: 'Fix it', today: '2026-06-10' });
    expect(out).not.toContain('size:');
  });
});
