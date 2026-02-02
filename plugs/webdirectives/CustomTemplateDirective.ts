/**
 * @file CustomTemplateDirective.ts
 * @description Base class for custom template directives
 * @source Migrated from plateau/src/plugs/custom-template-directives/CustomTemplateDirective.ts
 */

/**
 * Options for creating a CustomTemplateDirective instance
 */
export interface CustomTemplateDirectiveOptions {
  /**
   * Child nodes to append to the template content
   */
  children?: Node | Node[];
}

/**
 * Convert a string from PascalCase or camelCase to kebab-case
 * @param str - The string to convert
 * @returns The kebab-cased string
 */
function toKebabCase(str: string): string {
  return str.replace(/(?!^)([A-Z0-9\u00C0-\u00D6])/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * Abstract base class for custom template directives
 * 
 * Template directives extend HTMLTemplateElement and provide lifecycle
 * management for declarative template-based components. They automatically
 * set the 'is' attribute based on the constructor name and manage template
 * content through the children option.
 * 
 * @example
 * ```typescript
 * class LoopDirective extends CustomTemplateDirective {
 *   connectedCallback() {
 *     const items = this.getAttribute('items');
 *     // Process template with loop logic
 *   }
 * }
 * 
 * customElements.define('loop-directive', LoopDirective, { extends: 'template' });
 * ```
 */
export default abstract class CustomTemplateDirective<
  Options extends CustomTemplateDirectiveOptions = CustomTemplateDirectiveOptions
> extends HTMLTemplateElement {
  /**
   * Options passed during construction
   */
  options: Partial<Options & CustomTemplateDirectiveOptions> = {};

  /**
   * Attributes to observe for changes
   * Subclasses can override to specify which attributes trigger attributeChangedCallback
   */
  static observedAttributes?: string[];

  /**
   * Create a new CustomTemplateDirective instance
   * 
   * @param options - Configuration options
   */
  constructor(options: Options & CustomTemplateDirectiveOptions) {
    super();
    this.options = options;

    // Store original connectedCallback for chaining
    const originalConnectedCallback = this.connectedCallback?.bind(this);

    // Override connectedCallback to handle initialization
    this.connectedCallback = function (this: CustomTemplateDirective<Options>) {
      // Set 'is' attribute based on constructor name
      const directiveName = toKebabCase(this.constructor.name).toLowerCase();
      this.setAttribute('is', directiveName);

      // Append children to template content if provided
      if (this.options.children) {
        const nodes = Array.isArray(this.options.children)
          ? this.options.children
          : [this.options.children];
        this.content.append(...nodes);
      }

      // Call original connectedCallback if it exists
      originalConnectedCallback?.call(this);
    };
  }

  /**
   * Called when the directive is connected to the document (legacy)
   * @deprecated Use connectedCallback instead
   */
  attachedCallback?(): void;

  /**
   * Called when the directive is disconnected from the document (legacy)
   * @deprecated Use disconnectedCallback instead
   */
  detachedCallback?(): void;

  /**
   * Called when the directive is connected to the document
   */
  connectedCallback?(): void;

  /**
   * Called when the directive is disconnected from the document
   */
  disconnectedCallback?(): void;

  /**
   * Called when the directive is moved to a new document
   */
  adoptedCallback?(): void;

  /**
   * Called when an observed attribute changes
   * 
   * @param attributeName - The name of the changed attribute
   * @param oldValue - The previous value
   * @param newValue - The new value
   */
  attributeChangedCallback?(
    attributeName: string,
    oldValue: string | null,
    newValue: string | null
  ): void;
}
