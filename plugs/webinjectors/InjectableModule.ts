/**
 * InjectableModule - Facade for module-scoped dependency injection
 *
 * Source: plateau/src/plugs/custom-injectors/InjectableModule.ts
 *
 * Wraps a ModuleInjector with an ergonomic API for registering
 * and consuming providers within a module's scope.
 *
 * @example
 * ```typescript
 * const mod = new InjectableModule('my-module', import.meta, (m) => {
 *   m.provide('customContexts:logger', new Logger());
 *   const config = m.consume('customContexts:config', import.meta);
 * });
 * mod.bootstrap();
 * ```
 *
 * @module webinjectors
 */

import ModuleInjector from './ModuleInjector';
import type { ProviderTypeMap } from './InjectorRoot';

type InjectableModuleSetup = (module: InjectableModule) => void;

export default class InjectableModule {
  injector: ModuleInjector;
  name: string;
  #setup: InjectableModuleSetup;

  constructor(name: string, importMeta: ImportMeta, setup: InjectableModuleSetup) {
    this.name = name;
    this.injector = new ModuleInjector(importMeta);
    this.#setup = setup;
  }

  /**
   * Register a provider on this module's injector.
   */
  provide<Key extends keyof ProviderTypeMap>(name: Key, value: ProviderTypeMap[Key]): void {
    this.injector.set(name, value);
  }

  /**
   * Consume a provider from this module's injector chain.
   * Lazy-loads the provider if registered but not yet loaded.
   *
   * @throws Error if provider is not registered anywhere in the chain
   */
  async consume<Key extends keyof ProviderTypeMap>(
    name: Key,
    consumer: ImportMeta,
  ): Promise<ProviderTypeMap[Key]> {
    return this.injector.consume(name, consumer);
  }

  /**
   * Register a lazy-loaded provider on this module's injector.
   */
  register<Key extends keyof ProviderTypeMap>(
    name: Key,
    loader: () => Promise<ProviderTypeMap[Key]>,
  ): void {
    this.injector.register(name, loader);
  }

  /**
   * Get a provider by key.
   */
  get<Key extends keyof ProviderTypeMap>(name: Key): ProviderTypeMap[Key] | undefined {
    return this.injector.get(name);
  }

  /**
   * Set a provider by key.
   */
  set<Key extends keyof ProviderTypeMap>(name: Key, value: ProviderTypeMap[Key]): void {
    this.injector.set(name, value);
  }

  /**
   * Execute the setup function, initializing this module's providers.
   */
  bootstrap(): void {
    this.#setup(this);
  }
}
