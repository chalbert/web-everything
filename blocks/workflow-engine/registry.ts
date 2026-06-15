/**
 * @file blocks/workflow-engine/registry.ts
 * @description The `CustomWorkflowEngine` provider seam (#634): a small registry that
 * resolves a named engine, with the native-first default pre-registered. Mirrors the
 * `CustomXRegistry` shape used across the plugs — apps register an alternative engine
 * (XState, SCION) once and the workflow runtime delegates through it.
 */

import NativeWorkflowEngine from './NativeWorkflowEngine';
import type { CustomWorkflowEngine } from './types';

export class CustomWorkflowEngineRegistry {
  #engines = new Map<string, CustomWorkflowEngine>();
  #defaultName: string;

  constructor() {
    const native = new NativeWorkflowEngine();
    this.#engines.set(native.name, native);
    this.#defaultName = native.name; // native-first default
  }

  /** Register (or replace) a named engine. */
  define(engine: CustomWorkflowEngine): void {
    this.#engines.set(engine.name, engine);
  }

  /** Make `name` the default resolved engine. Throws if it isn't registered. */
  setDefault(name: string): void {
    if (!this.#engines.has(name)) throw new Error(`CustomWorkflowEngine "${name}" is not registered`);
    this.#defaultName = name;
  }

  /** Resolve an engine by name, or the default when omitted. */
  resolve(name?: string): CustomWorkflowEngine {
    const engine = this.#engines.get(name ?? this.#defaultName);
    if (!engine) throw new Error(`CustomWorkflowEngine "${name}" is not registered`);
    return engine;
  }

  /** All registered engine names. */
  names(): string[] {
    return [...this.#engines.keys()];
  }
}

/** The shared registry instance — the global provider seam. */
export const customWorkflowEngine = new CustomWorkflowEngineRegistry();
