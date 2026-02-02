/**
 * @file CustomTextNodeRegistry.ts
 * @description Registry for managing custom text node definitions and lifecycle
 * @source Migrated from plateau/src/plugs/custom-text-nodes/CustomTextNodeRegistry.ts
 */

import HTMLRegistry, { type BaseDefinition } from '../core/HTMLRegistry';
import CustomTextNode, { type ImplementedTextNode } from './CustomTextNode';
import InjectorRoot from '../webinjectors/InjectorRoot';

/**
 * Definition for a registered custom text node
 */
export interface TextNodeDefinition extends BaseDefinition {
  constructor: typeof CustomTextNode;
  textChangedCallback?: (oldValue: string | null, newValue: string | null) => void;
}

/**
 * Registry for managing custom text nodes with automatic observation
 * 
 * Extends HTMLRegistry to provide:
 * - Text node type registration
 * - MutationObserver-based text change tracking
 * - Parser integration for declarative syntax
 * - Automatic upgrade/downgrade of text nodes
 * 
 * @example
 * ```typescript
 * const registry = new CustomTextNodeRegistry();
 * 
 * class ExpressionTextNode extends CustomTextNode {
 *   textChangedCallback(oldValue, newValue) {
 *     console.log('Expression changed:', oldValue, '->', newValue);
 *   }
 * }
 * 
 * registry.define('expression', ExpressionTextNode);
 * registry.upgrade(document.body);
 * ```
 */
export default class CustomTextNodeRegistry extends HTMLRegistry<TextNodeDefinition, ImplementedTextNode> {
  /**
   * MutationObservers for each root node being watched
   */
  #observers: Map<RootNode, MutationObserver> = new Map();

  /**
   * Local name for this registry type (used by InjectorRoot)
   */
  localName = 'customTextNodes';

  /**
   * Define a new custom text node type
   * 
   * @param name - The text node type name to register
   * @param TextNode - The CustomTextNode class
   */
  define(name: string, TextNode: ImplementedTextNode): void {
    const definition: TextNodeDefinition = {
      constructor: TextNode,
      connectedCallback: TextNode.prototype.connectedCallback,
      disconnectedCallback: TextNode.prototype.disconnectedCallback,
      textChangedCallback: TextNode.prototype.textChangedCallback,
      adoptedCallback: TextNode.prototype.adoptedCallback,
    };

    this.set(name, definition);
  }

  /**
   * Upgrade a DOM tree to activate custom text nodes
   * 
   * @param root - The root node to upgrade
   */
  upgrade(root: RootNode): void {
    this.#addTextNodesOnTree(root);
    this.#disconnect(root);
    this.#observe(root);
  }

  /**
   * Downgrade a DOM tree to deactivate custom text nodes
   * 
   * @param root - The root node to downgrade
   */
  downgrade(root: RootNode): void {
    this.#removeTextNodesFromTree(root);
    this.#disconnect(root);
  }

  /**
   * Upgrade an undetermined text node to its determined type
   */
  #upgradeTextNode(element: Text, parsedNodes: Text[]): void {
    if (element.isConnected) {
      const customTextNodeRegistry = InjectorRoot.getProviderOf(element, 'customTextNodes') as CustomTextNodeRegistry;

      const determinedTextNodes = parsedNodes.map((textNode) => {
        if (
          textNode instanceof CustomTextNode &&
          textNode.determined === false &&
          textNode.parserName
        ) {
          const TextNodeType = customTextNodeRegistry?.get(textNode.parserName);
          if (TextNodeType) {
            const textNodeInstance = new TextNodeType({ children: textNode.textContent || '' });
            textNodeInstance.connectedCallback?.();
            return textNodeInstance;
          }
        }
        return textNode;
      });

      // Replace original text node with determined node(s)
      if (determinedTextNodes.length > 1 || determinedTextNodes[0] !== element) {
        element.replaceWith(...determinedTextNodes);
      }
    } else {
      // Not connected - just replace
      if (parsedNodes.length > 1 || parsedNodes[0] !== element) {
        element.replaceWith(...parsedNodes);
      }
    }
  }

  /**
   * Handle text content change on a custom text node
   */
  #updateTextNode(element: CustomTextNode, oldValue: string | null): void {
    const newValue = element.textContent;
    element.textChangedCallback?.(oldValue, newValue);
  }

  /**
   * Remove a custom text node (disconnect callback)
   */
  #removeTextNode(element: CustomTextNode): void {
    element.disconnectedCallback?.();
  }

  /**
   * Add custom text nodes to all text nodes in a tree
   */
  #addTextNodesOnTree(tree: Node): void {
    this.#applyOnTree(tree, 'add');
  }

  /**
   * Remove custom text nodes from all text nodes in a tree
   */
  #removeTextNodesFromTree(tree: Node): void {
    this.#applyOnTree(tree, 'remove');
  }

  /**
   * Get available text node parsers from global registry
   * Parsers can split text content into multiple text nodes
   */
  #getTextNodeParsers(): Array<{ parse: (text: string) => Text[] }> {
    const parserRegistry = (window as any).customTextNodeParsers;
    return parserRegistry?.values() || [];
  }

  /**
   * Parse a text node using all available parsers
   * Each parser can split the text into multiple nodes
   * 
   * @param text - The text node to parse
   * @returns Array of parsed text nodes (or original if no parsing)
   */
  #getParsedTextNodes(text: Text): Text[] {
    const parsers = this.#getTextNodeParsers();

    return parsers.reduce<Text[]>((result, parser) => {
      const nodes: Text[] = [];
      
      result.forEach((currentText) => {
        if (currentText.textContent) {
          const parsedTextNodes = parser.parse(currentText.textContent);
          if (parsedTextNodes && parsedTextNodes.length > 0) {
            nodes.push(...parsedTextNodes);
          } else {
            nodes.push(currentText);
          }
        } else {
          nodes.push(currentText);
        }
      });
      
      return nodes;
    }, [text]);
  }

  /**
   * Apply add or remove action to all text nodes in a tree
   */
  #applyOnTree(tree: Node, action: 'add' | 'remove'): void {
    const treeWalker = document.createTreeWalker(tree, NodeFilter.SHOW_TEXT);

    do {
      const currentNode = treeWalker.currentNode;

      if (currentNode instanceof CustomTextNode) {
        // Already a custom text node
        if (action === 'add') {
          currentNode.connectedCallback?.();
        } else {
          currentNode.disconnectedCallback?.();
        }
      } else if (currentNode instanceof Text) {
        // Regular text node - parse and upgrade
        if (action === 'add') {
          const parsedTextNodes = this.#getParsedTextNodes(currentNode);
          this.#upgradeTextNode(currentNode, parsedTextNodes);
        } else {
          // Remove action on regular text node - no-op
        }
      }
    } while (treeWalker.nextNode());
  }

  /**
   * Start observing a root node for text changes
   */
  #observe(root: RootNode): void {
    const observer = this.#getRootObserver(root);

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    });
  }

  /**
   * Stop observing a root node
   */
  #disconnect(root: RootNode): void {
    const observer = this.#observers.get(root);
    observer?.disconnect();
  }

  /**
   * Get or create the MutationObserver for a root node
   */
  #getRootObserver(root: RootNode): MutationObserver {
    let observer = this.#observers.get(root);

    if (!observer) {
      observer = this.#createObserver();
      this.#observers.set(root, observer);
    }

    return observer;
  }

  /**
   * Create a new MutationObserver for text node tracking
   */
  #createObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Handle removed nodes
          if (mutation.removedNodes.length > 0) {
            Array.from(mutation.removedNodes).forEach((removedNode) => {
              this.#removeTextNodesFromTree(removedNode);
            });
          }
        } else if (mutation.type === 'characterData' && mutation.target instanceof CustomTextNode) {
          // Text content changed on a custom text node
          this.#updateTextNode(mutation.target, mutation.oldValue);
        }
      }
    });
  }

  /**
   * Get a custom text node type by name
   * 
   * @param name - The registered name
   * @returns The text node constructor or undefined
   */
  override get(name: string): ImplementedTextNode | undefined {
    const definition = this.getDefinition(name);
    return definition?.constructor as ImplementedTextNode | undefined;
  }
}
