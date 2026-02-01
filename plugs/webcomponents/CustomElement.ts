// Ported from plateau/src/plugs/custom-elements/CustomElement.ts
// Base class for custom elements with options support

export interface CustomElementOptions { }

/**
 * Enhanced base class for custom elements.
 * Extends HTMLElement with an options parameter in the constructor.
 * 
 * @example
 * class MyElement extends CustomElement<{ name: string }> {
 *   connectedCallback() {
 *     console.log(this.options.name);
 *   }
 * }
 */
export default class CustomElement<Options extends Record<string | number | symbol, unknown> = any> extends HTMLElement {
  static observedAttributes?: string[];
  static formAssociated?: boolean;

  options: Options;

  constructor(options: Options = {} as Options) {
    super();
    this.options = options;
  }

  connectedCallback?(): void;
  disconnectedCallback?(): void;
  adoptedCallback?(): void;
  attributeChangedCallback?(attributeName: string, oldValue: string | null, newValue: string | null): void;
  formAssociatedCallback?(): void;
  formDisabledCallback?(): void;
  formResetCallback?(): void;
  formStateRestoreCallback?(): void;
}
