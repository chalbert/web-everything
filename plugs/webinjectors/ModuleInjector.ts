/**
 * ModuleInjector - Module-scoped injector for ES Module dependency injection
 *
 * Source: plateau/src/plugs/custom-injectors/ModuleInjector.ts
 *
 * Unlike HTMLInjector which validates via DOM containment,
 * ModuleInjector allows any consumer to access its providers
 * because module scope is not spatially constrained.
 *
 * @module webinjectors
 */

import Injector from './Injector';
import type { Registry } from './Registry';

export default class ModuleInjector extends Injector<Registry<any>, ImportMeta, ImportMeta> {
  constructor(
    public target: ImportMeta,
    parentInjector: Injector<Registry<any>, ImportMeta, ImportMeta> | null = null,
  ) {
    super(target, parentInjector);
  }

  isQuerierValid(_querier: ImportMeta): boolean {
    return true;
  }
}
