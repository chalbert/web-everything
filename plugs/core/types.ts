/**
 * Core type definitions shared across all plugs modules
 */

/**
 * Valid root node types that can be upgraded/downgraded.
 * - Document: Main document
 * - DocumentFragment: Template content, detached trees
 * - ShadowRoot: Shadow DOM roots
 */
export type RootNode = Document | DocumentFragment | ShadowRoot;
