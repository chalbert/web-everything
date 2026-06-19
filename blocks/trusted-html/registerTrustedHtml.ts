/**
 * Register the trusted-html attribute behavior with the custom attribute registry.
 *
 * @module blocks/trusted-html
 */

import type CustomAttributeRegistry from '@frontierui/plugs/webbehaviors/CustomAttributeRegistry';
import TrustedHtmlBehavior from './TrustedHtmlBehavior';

export function registerTrustedHtml(attributes: CustomAttributeRegistry): void {
  attributes.define('trusted-html', TrustedHtmlBehavior);
}
