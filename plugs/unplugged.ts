/**
 * Unplugged - Functional API for using plugs without DOM patches
 *
 * This module provides a clean, functional API for using the plugs system
 * without requiring global DOM patches. All registered plugs are upgraded
 * through a single, unified `upgrade` function.
 *
 * Usage:
 * ```typescript
 * import { register, upgrade } from '@webeverything/plugs/unplugged';
 * import { CustomAttributeRegistry } from '@webeverything/plugs/webbehaviors';
 *
 * const attributes = new CustomAttributeRegistry();
 * attributes.define('my-attr', MyAttribute);
 *
 * register(attributes);
 * upgrade(document);
 * ```
 */

import type { Plug } from './core/Plug';
import { isPlug } from './core/Plug';
import type { RootNode } from './core/types';

// Module-level state
const plugs = new Map<string, Plug>();
const roots = new Set<RootNode>();
const upgradedRoots = new Set<RootNode>();

/**
 * Register a plug with the unplugged system.
 *
 * @param plug - The plug to register (must implement Plug interface)
 * @throws Error if the plug doesn't implement the Plug interface
 */
export function register(plug: Plug): void {
  if (!isPlug(plug)) {
    throw new Error(
      `Cannot register plug: object must implement the Plug interface (localName, upgrade, downgrade)`
    );
  }

  const existingPlug = plugs.get(plug.localName);
  if (existingPlug && existingPlug !== plug) {
    console.warn(`[unplugged] Replacing existing plug '${plug.localName}'`);
  }

  plugs.set(plug.localName, plug);
}

/**
 * Unregister a plug from the unplugged system.
 *
 * @param plug - The plug to unregister (or its localName)
 */
export function unregister(plug: Plug | string): void {
  const localName = typeof plug === 'string' ? plug : plug.localName;
  const existingPlug = plugs.get(localName);

  if (existingPlug) {
    // Downgrade all roots before removing
    for (const root of upgradedRoots) {
      existingPlug.downgrade(root);
    }
    plugs.delete(localName);
  }
}

/**
 * Get a registered plug by name.
 */
export function getPlug<T extends Plug = Plug>(localName: string): T | undefined {
  return plugs.get(localName) as T | undefined;
}

/**
 * Check if a plug is registered.
 */
export function hasPlug(localName: string): boolean {
  return plugs.has(localName);
}

/**
 * Get all registered plug names.
 */
export function getPlugNames(): string[] {
  return Array.from(plugs.keys());
}

/**
 * Get all registered plugs.
 */
export function getPlugs(): Plug[] {
  return Array.from(plugs.values());
}

/**
 * Attach a root node to the unplugged system.
 * This associates the root but does not upgrade it.
 *
 * @param root - The root node to attach to
 */
export function attach(root: RootNode): void {
  roots.add(root);
}

/**
 * Detach a root node from the unplugged system.
 * Automatically downgrades before detaching.
 *
 * @param root - The root node to detach from
 */
export function detach(root: RootNode): void {
  if (upgradedRoots.has(root)) {
    downgrade(root);
  }
  roots.delete(root);
}

/**
 * Upgrade a root node by calling upgrade on all registered plugs.
 * This is the main entry point for activating all plugs.
 *
 * @param root - The root node to upgrade. If not provided, upgrades all attached roots.
 */
export function upgrade(root?: RootNode): void {
  const targetRoots = root ? [root] : Array.from(roots);

  for (const currentRoot of targetRoots) {
    // Auto-attach if not already attached
    if (!roots.has(currentRoot)) {
      roots.add(currentRoot);
    }

    // Upgrade all plugs in registration order
    for (const plug of plugs.values()) {
      plug.upgrade(currentRoot);
    }

    upgradedRoots.add(currentRoot);
  }
}

/**
 * Downgrade a root node by calling downgrade on all registered plugs.
 *
 * @param root - The root node to downgrade. If not provided, downgrades all upgraded roots.
 */
export function downgrade(root?: RootNode): void {
  const targetRoots = root ? [root] : Array.from(upgradedRoots);

  for (const currentRoot of targetRoots) {
    if (!upgradedRoots.has(currentRoot)) {
      continue;
    }

    // Downgrade all plugs in reverse registration order
    const plugList = Array.from(plugs.values()).reverse();
    for (const plug of plugList) {
      plug.downgrade(currentRoot);
    }

    upgradedRoots.delete(currentRoot);
  }
}

/**
 * Check if a root node has been upgraded.
 */
export function isUpgraded(root: RootNode): boolean {
  return upgradedRoots.has(root);
}

/**
 * Get all attached roots.
 */
export function getRoots(): RootNode[] {
  return Array.from(roots);
}

/**
 * Reset the unplugged system to its initial state.
 * Useful for testing or hot module replacement.
 */
export function reset(): void {
  // Downgrade all roots first
  for (const root of Array.from(upgradedRoots)) {
    downgrade(root);
  }

  plugs.clear();
  roots.clear();
  upgradedRoots.clear();
}

// Re-export Plug interface
export type { Plug } from './core/Plug';
export { isPlug } from './core/Plug';
