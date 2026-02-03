import type { RootNode } from './types';

/**
 * Plug - Interface for pluggable registries
 *
 * All registries that can be used with the unplugged system must implement this interface.
 * This enables a unified upgrade/downgrade mechanism without requiring DOM patches.
 */
export interface Plug {
  /**
   * Unique identifier for the plug type.
   * Used as a key when registering.
   */
  readonly localName: string;

  /**
   * Upgrade a root node to activate this plug's behavior.
   * Called during the unified upgrade process.
   *
   * @param root - The root node (document or shadow root) to upgrade
   */
  upgrade(root: RootNode): void;

  /**
   * Downgrade a root node to deactivate this plug's behavior.
   * Called during the unified downgrade process.
   *
   * @param root - The root node to downgrade
   */
  downgrade(root: RootNode): void;
}

/**
 * Type guard to check if an object implements the Plug interface.
 */
export function isPlug(obj: unknown): obj is Plug {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Plug).localName === 'string' &&
    typeof (obj as Plug).upgrade === 'function' &&
    typeof (obj as Plug).downgrade === 'function'
  );
}
