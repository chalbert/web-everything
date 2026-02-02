/**
 * cloneUtils.ts - Shared utilities for node cloning
 * 
 * Common operations used across different clone handlers to avoid duplication.
 * 
 * @module core
 */

/**
 * Fix prototype of cloned node to match original.
 * 
 * @param original - The original node
 * @param clone - The cloned node
 */
export function fixPrototype(original: Node, clone: Node): void {
  Object.setPrototypeOf(clone, original.constructor.prototype);
}

/**
 * Copy options property from original to clone (if exists).
 * 
 * @param original - The original node
 * @param clone - The cloned node
 */
export function copyOptions(original: any, clone: any): void {
  if ('options' in original) {
    clone.options = original.options;
  }
}

/**
 * Reconstruct a node using its constructor and options.
 * 
 * @param Constructor - The node constructor
 * @param options - Options to pass to constructor
 * @returns The newly constructed node
 */
export function reconstructNode<T extends Node>(
  Constructor: new (options?: any) => T,
  options?: any
): T {
  return new Constructor(options);
}

/**
 * Copy attributes from one element to another.
 * 
 * @param source - Source element
 * @param target - Target element
 */
export function copyAttributes(source: Element, target: Element): void {
  Array.from(source.attributes).forEach(attr => {
    target.setAttribute(attr.name, attr.value);
  });
}

/**
 * Move all children from one node to another.
 * 
 * @param source - Source node
 * @param target - Target node
 */
export function moveChildren(source: Node, target: Node): void {
  while (source.firstChild) {
    target.appendChild(source.firstChild);
  }
}

/**
 * Replace a node with another node in the DOM.
 * 
 * @param oldNode - Node to replace
 * @param newNode - Replacement node
 * @returns True if replacement succeeded
 */
export function replaceNode(oldNode: Node, newNode: Node): boolean {
  if (oldNode.parentNode) {
    oldNode.parentNode.replaceChild(newNode, oldNode);
    return true;
  }
  return false;
}

/**
 * Create paired tree walkers for deep cloning iteration.
 * 
 * @param original - Original node tree
 * @param clone - Cloned node tree
 * @param filter - NodeFilter to apply
 * @returns Tuple of [originalWalker, cloneWalker]
 */
export function createPairedWalkers(
  original: Node,
  clone: Node,
  filter: number = NodeFilter.SHOW_ALL
): [TreeWalker, TreeWalker] {
  const originalWalker = document.createTreeWalker(original, filter);
  const cloneWalker = document.createTreeWalker(clone, filter);
  return [originalWalker, cloneWalker];
}

/**
 * Advance both walkers in sync.
 * 
 * @param walker1 - First walker
 * @param walker2 - Second walker
 * @returns True if both walkers advanced successfully
 */
export function advanceBothWalkers(walker1: TreeWalker, walker2: TreeWalker): boolean {
  const result1 = walker1.nextNode();
  const result2 = walker2.nextNode();
  return result1 !== null && result2 !== null;
}

/**
 * Iterate through paired walkers, calling callback for each pair.
 * 
 * @param originalWalker - Walker for original tree
 * @param cloneWalker - Walker for clone tree
 * @param callback - Function to call for each node pair
 */
export function iteratePairedWalkers(
  originalWalker: TreeWalker,
  cloneWalker: TreeWalker,
  callback: (originalNode: Node, clonedNode: Node) => void
): void {
  do {
    callback(originalWalker.currentNode, cloneWalker.currentNode);
  } while (advanceBothWalkers(originalWalker, cloneWalker));
}
