/**
 * Unit tests for the multi-template slot-resolution helper (#1133, webdirectives completion #1098).
 *
 * The demo case: a 4-slot `resource:loader` comment region returns a 4-entry slot map. Also covers the
 * boundary rules — close-marker termination, last-write-wins per slot, the default slot, nested-region
 * skipping, and the non-directive no-op. Non-invasive: builds a real DOM region and reads it, patching
 * nothing global.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { collectSlotTemplates, DEFAULT_SLOT } from '../../multiTemplate';

/** Build a sibling region from an HTML string and return the leading comment (the directive open). */
function region(html: string): Comment {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  // the first comment node is the opening directive
  for (const n of Array.from(host.childNodes)) {
    if (n.nodeType === Node.COMMENT_NODE) return n as Comment;
  }
  throw new Error('no comment in region');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('collectSlotTemplates (#1133)', () => {
  it('a 4-slot resource:loader region returns a 4-entry slot map (the demo)', () => {
    const open = region(`
      <!-- resource:loader name="user-profile" -->
      <template slot="loading"><span>load</span></template>
      <template slot="success"><span>ok</span></template>
      <template slot="empty"><span>empty</span></template>
      <template slot="error"><span>err</span></template>
      <!-- /resource:loader -->
    `);
    const map = collectSlotTemplates(open);
    expect(map.size).toBe(4);
    expect([...map.keys()].sort()).toEqual(['empty', 'error', 'loading', 'success']);
    expect(map.get('loading')).toBeInstanceOf(HTMLTemplateElement);
  });

  it('stops at the matching closing marker — templates after the close are excluded', () => {
    const open = region(`
      <!-- resource:loader -->
      <template slot="a"></template>
      <!-- /resource:loader -->
      <template slot="b"></template>
    `);
    const map = collectSlotTemplates(open);
    expect([...map.keys()]).toEqual(['a']);
  });

  it('last template wins for a repeated slot name (native named-slot semantics)', () => {
    const open = region(`
      <!-- switch:on -->
      <template slot="x" id="first"></template>
      <template slot="x" id="second"></template>
      <!-- /switch:on -->
    `);
    const map = collectSlotTemplates(open);
    expect(map.size).toBe(1);
    expect(map.get('x')!.id).toBe('second');
  });

  it('a template with no slot attribute is keyed by the default slot', () => {
    const open = region(`
      <!-- resource:loader -->
      <template></template>
      <template slot="named"></template>
      <!-- /resource:loader -->
    `);
    const map = collectSlotTemplates(open);
    expect(map.has(DEFAULT_SLOT)).toBe(true);
    expect(map.has('named')).toBe(true);
  });

  it('skips a nested directive region — its templates are not absorbed', () => {
    const open = region(`
      <!-- resource:loader -->
      <template slot="outer"></template>
      <!-- switch:inner -->
      <template slot="inner-a"></template>
      <!-- /switch:inner -->
      <template slot="outer-after"></template>
      <!-- /resource:loader -->
    `);
    const map = collectSlotTemplates(open);
    expect([...map.keys()].sort()).toEqual(['outer', 'outer-after']);
    expect(map.has('inner-a')).toBe(false);
  });

  it('returns an empty map for a non-directive comment', () => {
    const open = region(`<!-- just a comment --><template slot="a"></template>`);
    expect(collectSlotTemplates(open).size).toBe(0);
  });

  it('returns an empty map when the region holds no templates', () => {
    const open = region(`<!-- resource:loader --><p>no templates</p><!-- /resource:loader -->`);
    expect(collectSlotTemplates(open).size).toBe(0);
  });
});
