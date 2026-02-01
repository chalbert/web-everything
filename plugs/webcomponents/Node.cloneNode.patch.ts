/**
 * Node.cloneNode.patch.ts - Enhanced cloneNode for custom elements
 * 
 * Source: plateau/src/plugs/custom-elements/Node.patch.ts (lines 64-180)
 * 
 * This patch enhances Node.prototype.cloneNode to properly handle:
 * - CustomElement instances with options
 * - CustomComment instances  
 * - CustomTextNode instances
 * - Undetermined elements that need prototype restoration
 * - Standard HTML elements with overridden prototypes
 * 
 * @module webcomponents
 */

const baseDescriptor = { configurable: true, enumerable: true };

/**
 * Store references to original HTML constructors before patching.
 * TODO: Import from originalElements when available.
 */
const originalElements: Record<string, any> = {};

/**
 * Store original cloneNode descriptor (captured on module load).
 */
const cloneNodeDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'cloneNode');

/**
 * Apply cloneNode patch to Node.prototype.
 */
export function applyCloneNodePatch(): void {
  if (isCloneNodePatched()) {
    console.warn('Node.cloneNode patch already applied');
    return;
  }

  // Store original HTML element constructors
  [
    'HTMLElement',
    'HTMLDivElement',
    'HTMLSpanElement',
    'HTMLInputElement',
    'HTMLButtonElement',
    'HTMLFormElement',
    // Add more as needed
  ].forEach((name) => {
    if ((window as any)[name]) {
      originalElements[name] = (window as any)[name];
    }
  });

  Object.defineProperty(Node.prototype, 'cloneNode', {
    ...baseDescriptor,
    value: function cloneNode(this: Node, deep: boolean = false): Node {
      const clone = cloneNodeDescriptor!.value!.call(this, deep);

      // Only process deep clones
      if (!deep) {
        // For shallow clones, just fix the prototype
        if (this instanceof HTMLElement || this instanceof DocumentFragment || this instanceof Comment) {
          Object.setPrototypeOf(clone, this.constructor.prototype);
        }
        return clone;
      }

      const originalElementTreeWalker = document.createTreeWalker(this, NodeFilter.SHOW_ALL);
      const elementTreeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ALL);

      do {
        // Handle custom HTML elements
        if (elementTreeWalker.currentNode instanceof originalElements.HTMLElement) {
          // Only reconstruct if element has custom options (CustomElement)
          const options = (originalElementTreeWalker.currentNode as any).options;
          if (options) {
            try {
              const OriginalConstructor = originalElementTreeWalker.currentNode.constructor as any;
              const newElement = new OriginalConstructor(options);
              // Copy attributes and children from cloned element
              Array.from((elementTreeWalker.currentNode as Element).attributes).forEach(attr => {
                newElement.setAttribute(attr.name, attr.value);
              });
              while (elementTreeWalker.currentNode.firstChild) {
                newElement.appendChild(elementTreeWalker.currentNode.firstChild);
              }
              // Preserve options property
              (newElement as any).options = options;
              elementTreeWalker.currentNode.replaceWith(newElement);
            } catch {
              // If reconstruction fails, just fix prototype and copy options
              Object.setPrototypeOf(
                elementTreeWalker.currentNode,
                originalElementTreeWalker.currentNode.constructor.prototype
              );
              (elementTreeWalker.currentNode as any).options = options;
            }
          } else {
            // Regular HTML element - just fix prototype if needed
            const { name } = elementTreeWalker.currentNode.constructor;
            if (originalElements[name] && elementTreeWalker.currentNode instanceof originalElements[name]) {
              // Set direct parent class to overridden class
              Object.setPrototypeOf(
                elementTreeWalker.currentNode,
                (window as any)[name].prototype
              );

              // Fix HTMLElement ancestor in prototype chain
              const proto1 = Object.getPrototypeOf(elementTreeWalker.currentNode);
              const proto2 = Object.getPrototypeOf(proto1);
              const proto3 = Object.getPrototypeOf(proto2);
              const BaseHTMLConstructor = proto3?.constructor;

              if (BaseHTMLConstructor === originalElements.HTMLElement) {
                Object.setPrototypeOf(proto2, window.HTMLElement.prototype);
              }
            }
          }
        }
        // Handle CustomComment
        else if ((originalElementTreeWalker.currentNode as any).constructor.name === 'CustomComment') {
          const OriginalConstructor = originalElementTreeWalker.currentNode.constructor as any;
          const options = (originalElementTreeWalker.currentNode as any).options;
          const newComment = new OriginalConstructor(options);
          elementTreeWalker.currentNode.parentNode?.replaceChild(
            newComment,
            elementTreeWalker.currentNode
          );
        }
        // Handle CustomTextNode
        else if ((originalElementTreeWalker.currentNode as any).constructor.name === 'CustomTextNode') {
          const OriginalConstructor = originalElementTreeWalker.currentNode.constructor as any;
          const textContent = (originalElementTreeWalker.currentNode as any).textContent;
          const options = (originalElementTreeWalker.currentNode as any).options;
          const newTextNode = new OriginalConstructor({
            children: textContent,
            ...options,
          });
          elementTreeWalker.currentNode.parentNode?.replaceChild(
            newTextNode,
            elementTreeWalker.currentNode
          );
        }
      } while (elementTreeWalker.nextNode() && originalElementTreeWalker.nextNode());

      // Fix clone prototype
      if (this instanceof HTMLElement || this instanceof DocumentFragment || this instanceof Comment) {
        Object.setPrototypeOf(clone, this.constructor.prototype);
      }

      // Restore undetermined elements
      if ('querySelectorAll' in this && 'querySelectorAll' in clone) {
        const undeterminedElements = (this as any).querySelectorAll('undetermined');
        const clonedUndeterminedElements = (clone as any).querySelectorAll('undetermined');

        Array.from(clonedUndeterminedElements).forEach((clonedElement: any, index: number) => {
          const originalElement = undeterminedElements[index];
          if (originalElement) {
            const newProto = Object.getPrototypeOf(originalElement);
            Object.setPrototypeOf(clonedElement, newProto);

            if ((originalElement as any).options) {
              (clonedElement as any).options = (originalElement as any).options;
            }
          }
        });
      }

      // Restore undetermined text nodes
      if (deep) {
        const treeWalker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
        const undeterminedTextNodes: any[] = [];
        let index = 0;

        do {
          const currentNode = treeWalker.currentNode as any;
          if (
            currentNode.constructor.name === 'CustomTextNode' &&
            currentNode.determined === false
          ) {
            undeterminedTextNodes[index] = currentNode;
          }
          index += 1;
        } while (treeWalker.nextNode());

        const clonedTreeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        index = 0;

        do {
          if (undeterminedTextNodes[index]) {
            const originalNode = undeterminedTextNodes[index];
            const clonedNode = clonedTreeWalker.currentNode as any;

            // Restore prototype
            Object.setPrototypeOf(clonedNode, originalNode.constructor.prototype);

            // Restore properties
            if (originalNode.parserName) {
              clonedNode.parserName = originalNode.parserName;
            }
            clonedNode.options = {
              children: originalNode.textContent,
            };
          }
          index += 1;
        } while (clonedTreeWalker.nextNode());
      }

      // Restore undetermined comments
      if (deep) {
        const commentTreeWalker = document.createTreeWalker(this, NodeFilter.SHOW_COMMENT);
        const undeterminedComments: any[] = [];
        let index = 0;

        do {
          const currentNode = commentTreeWalker.currentNode as any;
          if (
            currentNode.constructor.name === 'CustomComment' &&
            !currentNode.determined
          ) {
            undeterminedComments[index] = {
              constructor: currentNode.constructor,
              options: currentNode.options,
            };
          }
          index += 1;
        } while (commentTreeWalker.nextNode());

        const cloneCommentTreeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
        index = 0;

        do {
          const currentNode = cloneCommentTreeWalker.currentNode as Comment;
          if (
            currentNode.textContent === 'undetermined' &&
            undeterminedComments[index]
          ) {
            const { constructor, options } = undeterminedComments[index];
            Object.setPrototypeOf(currentNode, constructor.prototype);
            (currentNode as any).options = options;
          }
          index += 1;
        } while (cloneCommentTreeWalker.nextNode());
      }

      return clone;
    },
  });

  // Also add 'determined' property to HTMLElement.prototype (for elements) and Node.prototype (for all nodes)
  Object.defineProperty(HTMLElement.prototype, 'determined', {
    ...baseDescriptor,
    get() {
      return (this as any).localName !== 'undetermined';
    },
    set() {
      // Read-only (setter does nothing)
    },
  });

  Object.defineProperty(Node.prototype, 'determined', {
    ...baseDescriptor,
    get() {
      return (this as any).localName !== 'undetermined';
    },
    set() {
      // Read-only (setter does nothing)
    },
  });
}

/**
 * Remove cloneNode patch from Node.prototype.
 */
export function removeCloneNodePatch(): void {
  if (!isCloneNodePatched()) {
    console.warn('Node.cloneNode patch not applied');
    return;
  }

  if (cloneNodeDescriptor) {
    Object.defineProperty(Node.prototype, 'cloneNode', cloneNodeDescriptor);
  }

  delete (HTMLElement.prototype as any).determined;
  delete (Node.prototype as any).determined;
}

/**
 * Check if cloneNode patch is applied.
 */
export function isCloneNodePatched(): boolean {
  return 'determined' in Node.prototype;
}
