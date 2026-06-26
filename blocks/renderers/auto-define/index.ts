/**
 * @file blocks/renderers/auto-define/index.ts
 * @description Auto-Define contract + native-first `explicit` baseline + the `defineElement` helper
 *              (#241). The open registry, platform-config flavors, and inferring strategies (#242)
 *              live in FUI (`fui:blocks/renderers/auto-define/`), relocated by #1779 per #1282
 *              (impl→FUI). WE keeps only the contract here.
 *              Spec: /projects/webcomponents/#protocol-auto-define-strategy
 */

export { defineElement, explicitAutoDefine } from './defineElement';
export type {
  AutoDefineStrategy,
  AutoDefineTrigger,
  RegistryScope,
  DefiningModule,
} from './defineElement';
