/**
 * @file Element.insertion.patch.ts
 * @description Patches Element insertion methods and innerHTML to track creation injectors
 * @source Migrated from plateau/src/plugs/custom-elements/Element.patch.ts
 */

import InjectorRoot from '../webinjectors/InjectorRoot';
import pathInsertionMethods from '../core/utils/pathInsertionMethods';

// Capture original innerHTML descriptor at module load time
const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

// Store original HTML element constructors for prototype restoration
const originalElements: Record<string, typeof HTMLElement> = {};

// Capture all native HTML constructors
const HTML_ELEMENT_NAMES = [
  'HTMLElement',
  'HTMLAnchorElement',
  'HTMLAreaElement',
  'HTMLAudioElement',
  'HTMLBRElement',
  'HTMLBaseElement',
  'HTMLBodyElement',
  'HTMLButtonElement',
  'HTMLCanvasElement',
  'HTMLDListElement',
  'HTMLDataElement',
  'HTMLDataListElement',
  'HTMLDetailsElement',
  'HTMLDialogElement',
  'HTMLDivElement',
  'HTMLEmbedElement',
  'HTMLFieldSetElement',
  'HTMLFormElement',
  'HTMLHRElement',
  'HTMLHeadElement',
  'HTMLHeadingElement',
  'HTMLHtmlElement',
  'HTMLIFrameElement',
  'HTMLImageElement',
  'HTMLInputElement',
  'HTMLLIElement',
  'HTMLLabelElement',
  'HTMLLegendElement',
  'HTMLLinkElement',
  'HTMLMapElement',
  'HTMLMediaElement',
  'HTMLMenuElement',
  'HTMLMetaElement',
  'HTMLMeterElement',
  'HTMLModElement',
  'HTMLOListElement',
  'HTMLObjectElement',
  'HTMLOptGroupElement',
  'HTMLOptionElement',
  'HTMLOutputElement',
  'HTMLParagraphElement',
  'HTMLParamElement',
  'HTMLPictureElement',
  'HTMLPreElement',
  'HTMLProgressElement',
  'HTMLQuoteElement',
  'HTMLScriptElement',
  'HTMLSelectElement',
  'HTMLSlotElement',
  'HTMLSourceElement',
  'HTMLSpanElement',
  'HTMLStyleElement',
  'HTMLTableCaptionElement',
  'HTMLTableCellElement',
  'HTMLTableColElement',
  'HTMLTableElement',
  'HTMLTableRowElement',
  'HTMLTableSectionElement',
  'HTMLTemplateElement',
  'HTMLTextAreaElement',
  'HTMLTimeElement',
  'HTMLTitleElement',
  'HTMLTrackElement',
  'HTMLUListElement',
  'HTMLUnknownElement',
  'HTMLVideoElement',
] as const;

// Capture original constructors
HTML_ELEMENT_NAMES.forEach((constructorName) => {
  const descriptor = Object.getOwnPropertyDescriptor(window, constructorName);
  if (descriptor?.value) {
    originalElements[constructorName] = descriptor.value as typeof HTMLElement;
  }
});

/**
 * Restore proper prototype chain for elements created via innerHTML
 * This ensures instanceof checks work correctly for patched constructors
 */
function restorePrototypeChain(element: Element): void {
  const constructorName = element.constructor.name;
  
  if (originalElements[constructorName] && element instanceof originalElements[constructorName]) {
    // Set direct parent class to overridden class
    Object.setPrototypeOf(element, (window as any)[constructorName].prototype);
    
    // Check if we need to update HTMLElement ancestor
    const grandParentPrototype = Object.getPrototypeOf(Object.getPrototypeOf(element));
    const greatGrandParentConstructor = Object.getPrototypeOf(grandParentPrototype)?.constructor;
    
    if (greatGrandParentConstructor === originalElements.HTMLElement) {
      // Override parent HTMLElement ancestor to the extended one
      Object.setPrototypeOf(grandParentPrototype, window.HTMLElement.prototype);
    }
  }
}

/**
 * Apply patches to Element.prototype
 */
export function patch(): void {
  // Patch insertion methods using pathInsertionMethods utility
  
  // leadinMethods: First argument is NOT a node (e.g., position parameter)
  const leadinMethods = [
    'insertAdjacentElement', // insertAdjacentElement(position, element)
  ] as const;
  
  // spreadMethods: All arguments are nodes (spread syntax)
  const spreadMethods = [
    'after',
    'append',
    'before',
    'prepend',
    'replaceChildren',
    'replaceWith',
  ] as const;

  pathInsertionMethods(Element, leadinMethods, spreadMethods, []);

  // Patch innerHTML setter
  Object.defineProperty(Element.prototype, 'innerHTML', {
    ...innerHTMLDescriptor,
    set(this: Element, value: string) {
      const currentCreationInjector = InjectorRoot.creationInjector;
      InjectorRoot.creationInjector = this.getClosestInjector();
      
      // Call original innerHTML setter
      innerHTMLDescriptor?.set?.call(this, value);

      // Walk the tree and restore prototype chains for all elements
      const elementTreeWalker = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT);
      do {
        restorePrototypeChain(elementTreeWalker.currentNode as Element);
      } while (elementTreeWalker.nextNode());

      InjectorRoot.creationInjector = currentCreationInjector;
    },
  });
}

/**
 * Remove patches from Element.prototype
 */
export function removePatch(): void {
  // Restore innerHTML to original descriptor
  if (innerHTMLDescriptor) {
    Object.defineProperty(Element.prototype, 'innerHTML', innerHTMLDescriptor);
  }

  // Note: pathInsertionMethods patches are currently not reversible
  // This would require storing original descriptors for all patched methods
  // TODO: Add reversibility to pathInsertionMethods utility
}

// Log patch application in development
if (process.env.NODE_ENV !== 'production') {
  console.log('[webcomponents] Element.insertion patch ready');
}
