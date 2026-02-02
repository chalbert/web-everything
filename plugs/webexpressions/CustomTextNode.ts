/**
 * @file CustomTextNode.ts
 * @description Base class for custom text nodes with reactive text content
 * @source Migrated from plateau/src/plugs/custom-text-nodes/CustomTextNode.ts
 */

import InjectorRoot from '../webinjectors/InjectorRoot';

/**
 * Options for creating a CustomTextNode instance
 */
export interface CustomTextNodeOptions {
  /**
   * Initial text content or child nodes
   */
  children?: any;
}

/**
 * Type for an implemented custom text node constructor
 */
export type ImplementedTextNode<Options extends CustomTextNodeOptions = CustomTextNodeOptions> = 
  new (options?: Options) => CustomTextNode<Options>;

/**
 * Abstract base class for custom text nodes
 * 
 * Custom text nodes enable reactive text content with lifecycle management.
 * They extend native Text nodes and can observe text changes through callbacks.
 * 
 * @example
 * ```typescript
 * class ExpressionTextNode extends CustomTextNode {
 *   connectedCallback() {
 *     console.log('Expression connected:', this.textContent);
 *   }
 * 
 *   textChangedCallback(oldValue, newValue) {
 *     console.log('Text changed:', oldValue, '->', newValue);
 *   }
 * }
 * 
 * const registry = new CustomTextNodeRegistry();
 * registry.define('expression', ExpressionTextNode);
 * registry.upgrade(document.body);
 * ```
 */
export default class CustomTextNode<Options extends CustomTextNodeOptions = CustomTextNodeOptions> extends Text {
  /**
   * Options passed during construction
   */
  options: Options;

  /**
   * Parser name for lazy text node resolution
   * Set by parsers when creating undetermined text nodes
   */
  parserName?: string;

  /**
   * Whether this text node has been determined (resolved to a specific type)
   * False for undetermined text nodes that need resolution
   */
  determined: boolean = true;

  /**
   * Called when the text node is connected to the document
   */
  connectedCallback?(): void;

  /**
   * Called when the text node is disconnected from the document
   */
  disconnectedCallback?(): void;

  /**
   * Called when the text node is moved to a new document
   */
  adoptedCallback?(): void;

  /**
   * Called when the text content changes
   * 
   * @param oldValue - The previous text content
   * @param newValue - The new text content
   */
  textChangedCallback?(oldValue: string | null, newValue: string | null): void;

  /**
   * Get the local name of this text node within its registry
   * Looks up the name from the closest injector's customTextNodes registry
   * 
   * @returns The registered local name or 'undetermined'
   */
  get localName(): string {
    const constructor = this.constructor as ImplementedTextNode<Options>;
    const localName = InjectorRoot.getLocalNameInProviderOf(
      this,
      'customTextNodes',
      constructor
    );

    if (localName) {
      return localName;
    }

    return 'undetermined';
  }

  /**
   * Create a new CustomTextNode instance
   * 
   * Creates a text node with the specified content. If a global or injector-based
   * registry exists, the text node will be tracked for lifecycle callbacks.
   * 
   * @param options - Configuration options
   */
  constructor(options: Options = {} as Options) {
    // Process children before calling super
    let textContent = '';
    if (options.children !== undefined && options.children !== null) {
      if (Array.isArray(options.children)) {
        textContent = options.children
          .filter(child => child !== undefined && child !== null)
          .map(child => String(child))
          .join('');
      } else {
        textContent = String(options.children);
      }
    }

    super(textContent);
    this.options = options;
  }

  /**
   * Get whether this text node is connected to the document
   * Inherited from Text, but typed for TypeScript
   */
  declare isConnected: boolean;
}
