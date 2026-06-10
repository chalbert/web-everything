/**
 * @file blocks/renderers/auto-define/index.ts
 * @description Auto-Define contract + native-first `explicit` baseline + the `defineElement` helper.
 *              Spec: /projects/webcomponents/#protocol-auto-define-strategy
 *              The inferring strategies + resolving registry land in #242.
 */

export { defineElement, explicitAutoDefine } from './defineElement';
export type {
  AutoDefineStrategy,
  AutoDefineTrigger,
  RegistryScope,
  DefiningModule,
} from './defineElement';
