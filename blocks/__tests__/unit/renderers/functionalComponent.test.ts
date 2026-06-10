/**
 * Unit tests for the Functional Component generator (backlog #081 phase 2c) and the htmlToJsx
 * raw-text fix it depends on. The functional form is the first served form that is NOT self-
 * contained (it imports the jsx runtime) — these prove it generates parseable JSX that esbuild
 * can lower, and that <style> braces no longer break the JSX.
 */
import { describe, it, expect } from 'vitest';
import { transform } from 'esbuild';
import { parseDefinition } from '../../../renderers/component/declarativeComponent';
import { generateFunctionalSource, JSX_RUNTIME_SPECIFIER } from '../../../renderers/functional/functionalComponent';
import { htmlToJsx } from '../../../renderers/jsx/htmlToJsx';

const SHADOW_DEF =
  `<component name="user-card" shadow="open">\n` +
  `  <style>:host { display:block } h3 { margin:0 }</style>\n` +
  `  <h3><slot name="title">Untitled</slot></h3>\n` +
  `  <slot></slot>\n` +
  `</component>`;

const LIGHT_DEF = `<component name="x-tag" shadow="none"><strong><slot></slot></strong></component>`;

describe('htmlToJsx — raw-text elements (the functional form prerequisite)', () => {
  it('wraps <style> content as a JSX string expression so CSS braces do not break parsing', () => {
    const jsx = htmlToJsx('<style>:host { display:block }</style>');
    expect(jsx).toBe('<style>{`:host { display:block }`}</style>');
  });

  it('emits self-closing for an empty <style>', () => {
    expect(htmlToJsx('<style></style>')).toBe('<style />');
  });
});

describe('generateFunctionalSource', () => {
  it('emits a function, an element wrapper, the runtime import, static tagName, and defineElement()', () => {
    const src = generateFunctionalSource(parseDefinition(SHADOW_DEF));
    // Auto-Define #241: the functional form pulls `defineElement` off the same jsx-runtime import
    // and self-registers idempotently (not a bare customElements.define).
    expect(src).toContain(`import jsx, { defineElement } from '${JSX_RUNTIME_SPECIFIER}'`);
    expect(src).toContain('export function UserCard()');
    expect(src).toContain('class UserCardElement extends HTMLElement');
    expect(src).toContain("static tagName = 'user-card';");
    expect(src).toContain("defineElement('user-card', UserCardElement)");
    expect(src).not.toContain('customElements.define');
    expect(src).toContain('this.attachShadow({ mode: \'open\' })');
  });

  it('uses light-DOM append for shadow="none"', () => {
    const src = generateFunctionalSource(parseDefinition(LIGHT_DEF));
    expect(src).toContain('this.append(XTag())');
    expect(src).not.toContain('attachShadow');
  });

  it('produces JSX that esbuild can lower with the jsx factory (the served-module path)', async () => {
    const src = generateFunctionalSource(parseDefinition(SHADOW_DEF));
    const out = await transform(src, {
      loader: 'jsx',
      target: 'esnext',
      jsxFactory: 'jsx.createElement',
      jsxFragment: 'jsx.Fragment',
    });
    expect(out.code).toContain('jsx.createElement');
    expect(out.code).toContain(`import jsx, { defineElement } from "${JSX_RUNTIME_SPECIFIER}"`);
    // No JSX left behind — it really lowered.
    expect(out.code).not.toMatch(/<\/?\w/);
  });
});
