import { describe, it, expect } from 'vitest';
import {
  generateWrapper,
  customElementDeclarations,
  wrapperExtension,
  TARGETS,
} from '../genWrapper.mjs';

/**
 * A realistic CEM `custom-element` declaration fixture (schema 2.1.0). Current WE
 * blocks.json carries no tagName/attributes/properties (see #822), so we fixture the
 * shape the generator is contracted against — exactly what Lit-Labs/Stencil tools consume.
 */
const fixture = {
  kind: 'class',
  name: 'ComboBox',
  customElement: true,
  tagName: 'fui-combo-box',
  attributes: [
    { name: 'label', fieldName: 'label', type: { text: 'string' } },
    { name: 'placeholder', type: { text: 'string' } },
  ],
  members: [
    { kind: 'field', name: 'open', type: { text: 'boolean' } },
    { kind: 'field', name: 'value', type: { text: 'string' } },
    { kind: 'field', name: 'secret', privacy: 'private', type: { text: 'string' } },
    { kind: 'method', name: 'reset' },
  ],
  events: [
    { name: 'change', type: { text: 'CustomEvent' } },
    { name: 'value-input', type: { text: 'CustomEvent' } },
  ],
  slots: [{ name: '' }],
};

describe('generateWrapper — React', () => {
  const src = generateWrapper(fixture, 'react');

  it('references the custom-element tag', () => {
    expect(src).toContain("React.createElement('fui-combo-box'");
  });

  it('forwards attributes as element bindings and typed props', () => {
    expect(src).toContain('label?: string;');
    expect(src).toContain('placeholder?: string;');
  });

  it('sets reactive properties on the instance (not as attributes)', () => {
    expect(src).toContain('.open = open;');
    expect(src).toContain('.value = value;');
  });

  it('omits private and method members from the property surface', () => {
    expect(src).not.toContain('secret');
    expect(src).not.toContain('.reset = reset');
  });

  it('wires events to React-style handler props (kebab → onPascal)', () => {
    expect(src).toContain('onChange?:');
    expect(src).toContain('onValueInput?:');
    expect(src).toContain("el.addEventListener('change', h)");
    expect(src).toContain("el.addEventListener('value-input', h)");
  });

  it('passes children through to the default slot', () => {
    expect(src).toContain('children?: React.ReactNode;');
    expect(src).toContain(', children)');
  });
});

describe('generateWrapper — Vue', () => {
  const src = generateWrapper(fixture, 'vue');

  it('renders the custom-element tag via h()', () => {
    expect(src).toContain("h(\n        'fui-combo-box'");
  });

  it('declares typed props for attributes and properties', () => {
    expect(src).toContain('label: { type: String, required: false }');
    expect(src).toContain('open: { type: Boolean, required: false }');
  });

  it('binds properties via the .prop syntax', () => {
    expect(src).toContain("'.open': props.open");
    expect(src).toContain("'.value': props.value");
  });

  it('declares and re-emits events', () => {
    expect(src).toContain("emits: ['change', 'value-input']");
    expect(src).toContain("emit('change', event)");
    expect(src).toContain("emit('value-input', event)");
  });

  it('forwards the default slot', () => {
    expect(src).toContain('slots.default ? slots.default()');
  });
});

describe('flag, don\'t fake', () => {
  it('throws on a non-custom-element (class) declaration — no tag to wrap', () => {
    const classDecl = { kind: 'class', name: 'TypeAheadBehavior' };
    expect(() => generateWrapper(classDecl, 'react')).toThrow(/not a custom-element/);
  });

  it('throws on an unknown target', () => {
    expect(() => generateWrapper(fixture, 'solid')).toThrow(/unknown target/);
  });
});

describe('customElementDeclarations', () => {
  it('extracts only custom-element declarations from a manifest', () => {
    const manifest = {
      modules: [
        { path: 'a.ts', declarations: [fixture] },
        { path: 'b.ts', declarations: [{ kind: 'class', name: 'Plain' }] },
      ],
    };
    const found = customElementDeclarations(manifest);
    expect(found).toHaveLength(1);
    expect(found[0].declaration.tagName).toBe('fui-combo-box');
    expect(found[0].module).toBe('a.ts');
  });

  it('handles an empty/malformed manifest without throwing', () => {
    expect(customElementDeclarations({})).toEqual([]);
    expect(customElementDeclarations(null)).toEqual([]);
  });
});

describe('targets metadata', () => {
  it('exposes the supported targets', () => {
    expect(TARGETS).toEqual(['react', 'vue']);
  });
  it('picks the right extension per target', () => {
    expect(wrapperExtension('react')).toBe('tsx');
    expect(wrapperExtension('vue')).toBe('ts');
  });
});
