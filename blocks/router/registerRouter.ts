/**
 * @file blocks/router/registerRouter.ts
 * @description Registration helper that registers all router components
 * and behaviors with default names. Individual registration is still
 * possible for custom naming.
 */

import type CustomAttributeRegistry from '../../plugs/webbehaviors/CustomAttributeRegistry';
import RouteViewElement from './elements/RouteViewElement';
import RouteOutletElement from './elements/RouteOutletElement';
import RouteLinkBehavior from './behaviors/RouteLinkBehavior';
import RoutePrefetchBehavior from './behaviors/RoutePrefetchBehavior';

/**
 * Register all router components and behaviors with default names.
 *
 * @param attributes - The CustomAttributeRegistry to register behaviors on
 *
 * @example
 * ```typescript
 * import { registerRouter } from 'blocks/router';
 *
 * // Default names
 * registerRouter(attributes);
 *
 * // Or register individually with custom names
 * customElements.define('app-view', RouteViewElement);
 * attributes.define('app:link', RouteLinkBehavior);
 * ```
 */
export function registerRouter(attributes: CustomAttributeRegistry): void {
  if (!customElements.get('route-view')) {
    customElements.define('route-view', RouteViewElement);
  }
  if (!customElements.get('route-outlet')) {
    customElements.define('route-outlet', RouteOutletElement);
  }
  attributes.define('route:link', RouteLinkBehavior);
  attributes.define('route:prefetch', RoutePrefetchBehavior);
}
