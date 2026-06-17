import { describe, it, expect } from 'vitest';
import { parseIncumbent, normalizeToCem, emitWeBlock, ingest } from '../ingestComponent.mjs';

/**
 * A realistic incumbent: a MUI-flavoured Button with a props interface mixing data props,
 * an `on*` handler, projected children, a render-prop callback, and a styling escape-hatch
 * — i.e. the full classification surface the ingest adapter must normalize and prune.
 */
const MUI_BUTTON = `
import * as React from 'react';
export interface ButtonProps {
  /** visual emphasis */
  variant?: 'text' | 'contained' | 'outlined';
  color?: 'primary' | 'secondary';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  tabIndex?: number;
  startIcon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  renderLabel?: (value: string) => React.ReactNode;
  sx?: object;
}
export function Button(props: ButtonProps) { return null as any; }
`;

describe('parseIncumbent — API-surface extraction', () => {
  const surface = parseIncumbent(MUI_BUTTON);

  it('finds the component name from the props interface', () => {
    expect(surface.name).toBe('Button');
  });

  it('extracts primitive + union data props as props', () => {
    const names = surface.props.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['variant', 'color', 'disabled', 'size', 'tabIndex']));
    expect(surface.props.find((p) => p.name === 'disabled').primitive).toBe(true);
    expect(surface.props.find((p) => p.name === 'variant').primitive).toBe(true); // string-literal union
  });

  it('maps on* function props to DOM events (kebab, sans on)', () => {
    expect(surface.events.map((e) => e.name)).toEqual(['click']);
  });

  it('maps children + ReactNode props to slots', () => {
    const slotNames = surface.slots.map((s) => s.name).sort();
    expect(slotNames).toEqual(['', 'start-icon']); // children → default slot, startIcon → named
  });

  it('drops framework-only props (render prop + sx) with a reason — lossiness is the value', () => {
    const dropped = surface.dropped.map((d) => d.name).sort();
    expect(dropped).toEqual(['renderLabel', 'sx']);
    expect(surface.dropped.every((d) => typeof d.reason === 'string' && d.reason.length)).toBe(true);
  });

  it('throws on source with no props type (flag, don\'t fake)', () => {
    expect(() => parseIncumbent('export const x = 1;')).toThrow(/props type/);
    expect(() => parseIncumbent('')).toThrow(/empty source/);
  });
});

describe('normalizeToCem — the neutral pivot', () => {
  const cem = normalizeToCem(parseIncumbent(MUI_BUTTON));

  it('produces a custom-element declaration with a prefixed kebab tag', () => {
    expect(cem.customElement).toBe(true);
    expect(cem.tagName).toBe('we-button');
    expect(cem.name).toBe('Button');
  });

  it('projects primitive props to attributes (kebab name + camel fieldName)', () => {
    const tab = cem.attributes.find((a) => a.name === 'tab-index');
    expect(tab).toMatchObject({ name: 'tab-index', fieldName: 'tabIndex' });
  });

  it('projects every data prop to a public field member', () => {
    expect(cem.members.every((m) => m.kind === 'field' && m.privacy === 'public')).toBe(true);
    expect(cem.members.map((m) => m.name)).toEqual(expect.arrayContaining(['variant', 'disabled', 'tabIndex']));
  });

  it('carries events + slots from the surface', () => {
    expect(cem.events).toEqual([{ name: 'click', type: { text: 'CustomEvent' } }]);
    expect(cem.slots.map((s) => s.name).sort()).toEqual(['', 'start-icon']);
  });

  it('honours a custom tag prefix', () => {
    expect(normalizeToCem({ name: 'Card', props: [], events: [], slots: [] }, { tagPrefix: 'acme' }).tagName).toBe(
      'acme-card',
    );
  });
});

describe('emitWeBlock — project-facing re-emit (blocks.json shape)', () => {
  const block = emitWeBlock(normalizeToCem(parseIncumbent(MUI_BUTTON)), { source: 'MUI Button' });

  it('emits a draft block keyed by the tag (minus prefix), with provenance', () => {
    expect(block).toMatchObject({ id: 'button', tagName: 'we-button', status: 'draft', type: 'Component' });
    expect(block['x-ingest']).toMatchObject({ source: 'MUI Button', adapter: '#851' });
  });

  it('carries attributes / properties / events / slots', () => {
    expect(block.attributes.find((a) => a.name === 'tab-index')).toBeTruthy();
    expect(block.properties.map((p) => p.name)).toContain('variant');
    expect(block.events).toEqual([{ name: 'click', class: 'CustomEvent' }]);
  });

  it('throws when handed a non-custom-element declaration', () => {
    expect(() => emitWeBlock({ kind: 'class', name: 'X' })).toThrow(/custom-element/);
  });
});

describe('ingest — the full round-trip chain', () => {
  it('returns surface + cem + block from one call', () => {
    const { surface, cem, block } = ingest(MUI_BUTTON, { source: 'MUI Button' });
    expect(surface.name).toBe('Button');
    expect(cem.tagName).toBe('we-button');
    expect(block.id).toBe('button');
  });
});
