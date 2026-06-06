/**
 * @file blocks/renderers/jsx/index.ts
 * @description JSX Renderer exports
 */

export { default } from './JSXRenderer';
export { createElement, Fragment } from './JSXRenderer';
export type { JSXChild, JSXProps, JSXElementType } from './JSXRenderer';

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
