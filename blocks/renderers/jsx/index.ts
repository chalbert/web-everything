/**
 * @file blocks/renderers/jsx/index.ts
 * @description JSX Renderer exports
 */

export { default } from './JSXRenderer';
export { createElement, Fragment } from './JSXRenderer';
export type { JSXChild, JSXProps, JSXElementType, JSXFunctionComponent } from './JSXRenderer';

// Directive-sugar layer (#070): <For>/<Show>/<Resource> — an optional, reversible *spelling* of the
// canonical <template is="…"> directives. `desugar`/`sugarize` convert source either way; the runtime
// components build the same DOM. Spec: /adapters/jsx-adapter/ (mapping rows 7–8).
export {
  For,
  Show,
  Resource,
  desugar,
  sugarize,
  directiveRegistry,
  isDirectiveComponent,
} from './directives';
export type { DirectiveDef, DirectiveComponent } from './directives';

// Axis-2: render strategy — how the JSX-built tree updates over time.
// The JSX factory above builds the tree; these decide the update machine (declarative-static
// is the native-first default). Spec: /projects/webcomponents/#protocol-render-strategy
export {
  CustomRenderStrategyRegistry,
  DeclarativeStaticStrategy,
  renderStrategyRegistry,
  render,
} from './render-strategy';
export type {
  CustomRenderStrategy,
  RenderInput,
  RenderHandle,
  RenderScope,
} from './render-strategy';
