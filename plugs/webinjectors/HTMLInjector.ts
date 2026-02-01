/**
 * HTMLInjector - HTML-specific injector implementation
 * 
 * Source: plateau/src/plugs/custom-injectors/HTMLInjector.ts
 * 
 * Extends Injector with HTML-specific functionality:
 * - Targets HTML elements, root nodes, or custom comments
 * - Integrates with CustomContext attachment
 * - Validates queriers based on DOM containment
 * 
 * @module webinjectors
 */

import Injector from './Injector';
import HTMLRegistry from './HTMLRegistry';
import type { ProviderTypeMap } from './InjectorRoot';

/**
 * Valid targets for HTML injection.
 */
export type HTMLInjectorTarget = RootNode | HTMLElement | Comment;

/**
 * Provider types specific to HTML injection.
 * TODO: Import CustomContext from webcontexts when migrated.
 */
export type HTMLProviderType = HTMLRegistry<any, any> | any; // | CustomContext<any>

/**
 * HTML-specific injector that manages providers for DOM nodes.
 */
export default class HTMLInjector extends Injector<HTMLProviderType, Node, HTMLInjectorTarget> {
  constructor(
    public target: HTMLInjectorTarget = document,
    parentInjector: Injector<HTMLProviderType, Node, HTMLInjectorTarget> | null = null,
  ) {
    super(target, parentInjector);
  }

  /**
   * Set a provider with CustomContext attachment support.
   * 
   * If the provider is a CustomContext and the target is connected,
   * automatically attach and claim it.
   */
  set<Key extends keyof ProviderTypeMap>(name: Key, provider: ProviderTypeMap[Key]): this {
    // TODO: Uncomment when CustomContext is migrated from webcontexts
    // if (provider instanceof CustomContext && !provider.isAttached && this.target.isConnected) {
    //   provider.attach(this.target);
    //   this.claim(provider);
    // }

    return this.providers.set(name, provider), this;
  }

  /**
   * Validate that a querier is within this injector's target subtree.
   */
  isQuerierValid(querier: Node): boolean {
    return this.target.contains(querier);
  }
}
