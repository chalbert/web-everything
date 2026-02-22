/**
 * JSX Renderer for Web Everything
 *
 * Provides a custom JSX factory that creates real DOM elements.
 * Works with CustomElement, standard HTML tags, and DocumentFragment.
 *
 * ## Setup (tsconfig.json)
 * ```json
 * {
 *   "compilerOptions": {
 *     "jsx": "react",
 *     "jsxFactory": "jsx.createElement",
 *     "jsxFragmentFactory": "jsx.Fragment"
 *   }
 * }
 * ```
 *
 * ## Setup (vite.config.mts)
 * ```typescript
 * esbuild: {
 *   jsxInject: "import jsx from '/blocks/renderers/jsx'"
 * }
 * ```
 *
 * ## Usage
 * ```tsx
 * // Component using JSX
 * const button = <button onclick={handleClick}>Click me</button>;
 *
 * // Fragment
 * const items = <>
 *   <li>Item 1</li>
 *   <li>Item 2</li>
 * </>;
 *
 * // Custom Element
 * class MyElement extends HTMLElement {
 *   connectedCallback() {
 *     const content = <div class="wrapper">Hello</div>;
 *     this.appendChild(content);
 *   }
 * }
 * ```
 *
 * @module blocks/renderers/jsx
 */

/**
 * Valid child types for JSX elements
 */
export type JSXChild = Node | string | number | boolean | null | undefined | JSXChild[];

/**
 * Props that can be passed to JSX elements
 */
export interface JSXProps {
  children?: JSXChild | JSXChild[];
  [key: string]: unknown;
}

/**
 * Element type: string tag name, class constructor, or Fragment
 */
export type JSXElementType =
  | string
  | typeof DocumentFragment
  | (new (props?: JSXProps) => HTMLElement);

/**
 * JSX Renderer class
 *
 * Implements createElement and Fragment for custom JSX compilation.
 */
class JSXRenderer {
  /**
   * Fragment symbol - represents DocumentFragment in JSX
   */
  Fragment = DocumentFragment;

  /**
   * Create an element from JSX
   *
   * @param type - Tag name, class constructor, or Fragment
   * @param props - Element props/attributes
   * @param children - Child elements
   * @returns DOM element or fragment
   */
  createElement(
    type: JSXElementType,
    props: JSXProps | null,
    ...children: JSXChild[]
  ): HTMLElement | DocumentFragment {
    // Flatten and filter children
    const flatChildren = this.#flattenChildren(children);

    // Handle Fragment
    if (type === DocumentFragment || type === this.Fragment) {
      const fragment = document.createDocumentFragment();
      this.#appendChildren(fragment, flatChildren);
      return fragment;
    }

    // Create element
    const element = this.#createElement(type, props);

    // Apply props/attributes
    if (props) {
      this.#applyProps(element, props);
    }

    // Append children
    this.#appendChildren(element, flatChildren);

    return element;
  }

  /**
   * Create the actual DOM element
   */
  #createElement(
    type: JSXElementType,
    props: JSXProps | null
  ): HTMLElement {
    // String tag name - create standard HTML element
    if (typeof type === 'string') {
      return document.createElement(type);
    }

    // Class constructor - instantiate custom element
    if (typeof type === 'function') {
      const ElementClass = type as new (props?: JSXProps) => HTMLElement;
      return new ElementClass(props || undefined);
    }

    // Fallback
    throw new Error(`Invalid JSX element type: ${type}`);
  }

  /**
   * Apply props to an element
   */
  #applyProps(element: HTMLElement, props: JSXProps): void {
    for (const [key, value] of Object.entries(props)) {
      // Skip children - handled separately
      if (key === 'children') continue;

      // Skip null/undefined values
      if (value === null || value === undefined) continue;

      // Event handlers (onclick, onchange, etc.)
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value as EventListener);
        continue;
      }

      // className -> class
      if (key === 'className') {
        element.setAttribute('class', String(value));
        continue;
      }

      // htmlFor -> for
      if (key === 'htmlFor') {
        element.setAttribute('for', String(value));
        continue;
      }

      // Boolean attributes
      if (typeof value === 'boolean') {
        if (value) {
          element.setAttribute(key, '');
        }
        continue;
      }

      // Style object
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
        continue;
      }

      // Data attributes and custom attributes with hyphens
      if (key.includes('-') || key.startsWith('data')) {
        element.setAttribute(key, String(value));
        continue;
      }

      // Standard attributes - try property first, then attribute
      if (key in element) {
        try {
          (element as Record<string, unknown>)[key] = value;
        } catch {
          element.setAttribute(key, String(value));
        }
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  /**
   * Flatten nested children arrays and filter out nullish values
   */
  #flattenChildren(children: JSXChild[]): (Node | string)[] {
    const result: (Node | string)[] = [];

    const flatten = (child: JSXChild): void => {
      if (child === null || child === undefined || child === false || child === true) {
        return;
      }

      if (Array.isArray(child)) {
        child.forEach(flatten);
        return;
      }

      if (typeof child === 'number') {
        result.push(String(child));
        return;
      }

      if (typeof child === 'string' || child instanceof Node) {
        result.push(child);
      }
    };

    children.forEach(flatten);
    return result;
  }

  /**
   * Append children to a parent element
   */
  #appendChildren(parent: Element | DocumentFragment, children: (Node | string)[]): void {
    for (const child of children) {
      if (typeof child === 'string') {
        parent.appendChild(document.createTextNode(child));
      } else {
        parent.appendChild(child);
      }
    }
  }
}

/**
 * Default JSX renderer instance
 */
const jsx = new JSXRenderer();

export default jsx;

/**
 * Named exports for direct usage
 */
export const createElement = jsx.createElement.bind(jsx);
export const Fragment = jsx.Fragment;
