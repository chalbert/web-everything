/**
 * @file blocks/renderers/jsx/render-strategy/index.ts
 * @description Render Strategy contract + native-first declarative-static provider + registry.
 *              Spec: /projects/webcomponents/#protocol-render-strategy
 */

export type {
  CustomRenderStrategy,
  RenderInput,
  RenderHandle,
  RenderScope,
} from './CustomRenderStrategy';
export { DeclarativeStaticStrategy } from './DeclarativeStaticStrategy';
export {
  CustomRenderStrategyRegistry,
  createDeclarativeStaticFlavor,
  renderStrategyRegistry,
  render,
} from './CustomRenderStrategyRegistry';

// Axis-2 cross-strategy compiler: vdom JSX ⇄ declarative-static (lower / lift).
export { lower, lift } from './crossStrategy';
export type { ConversionResult, Diagnostic } from './crossStrategy';
