/**
 * @file pathInsertionMethods.ts
 * @description Patches DOM insertion methods to upgrade undetermined nodes
 * @source Migrated from plateau/src/plugs/custom-elements/pathInsertionMethods.ts
 */

import InjectorRoot from '../../webinjectors/InjectorRoot';
import type CustomElement from '../../webcomponents/CustomElement';
import type { ElementDefinition } from '../../webregistries/CustomElementRegistry';

/**
 * Update an undetermined element to its determined form
 */
function updateElement<Type extends Node>(parentElement: Type, undeterminedElement: HTMLElement): HTMLElement | null {
  const definition = InjectorRoot.getDefinitionInProviderOf(
    parentElement,
    'customElements',
    undeterminedElement.constructor
  ) as ElementDefinition | undefined;
  
  const Element = definition?.constructor;
  if (Element) {
    const options = (undeterminedElement as any).options;
    const element = Reflect.construct(Element, [options]) as HTMLElement;
    
    if (definition.options?.extends) {
      element.setAttribute('is', definition.localName as string);
    }
    
    if (options) {
      (element as any).options = options;
    }
    
    return element;
  }
  
  return null;
}

/**
 * Update an undetermined text node to its determined form
 * Note: CustomTextNode support pending Phase 6+ migration
 */
function updateTextNode<Type extends Node>(parentElement: Type, undeterminedTextNode: Text): Text | null {
  // TODO: Requires CustomTextNodeRegistry from Phase 6+
  // const customTextNodes = InjectorRoot.getProviderOf(parentElement, 'customTextNodes');
  // const parserName = (undeterminedTextNode as any).parserName;
  // if (parserName) {
  //   const TextNode = customTextNodes.get(parserName);
  //   if (TextNode) {
  //     return Reflect.construct(TextNode, [{ children: undeterminedTextNode.textContent || '' }]);
  //   }
  // }
  return null;
}

/**
 * Update an undetermined comment to its determined form
 * Note: CustomComment support pending Phase 6+ migration
 */
function updateComment<Type extends Node>(parentElement: Type, undeterminedComment: Comment): Comment | null {
  // TODO: Requires CustomComment from Phase 6+
  // const definition = InjectorRoot.getDefinitionInProviderOf(
  //   parentElement,
  //   'customComments',
  //   undeterminedComment.constructor
  // );
  // if (definition) {
  //   const options = (undeterminedComment as any).options;
  //   return Reflect.construct(definition.constructor, [options]);
  // }
  return null;
}

/**
 * Upgrade undetermined nodes deeply in a tree
 */
function upgradeDeep<Type extends Node>(
  parentElement: Type,
  undeterminedElementHost: HTMLElement | DocumentFragment | Text | Comment
): {
  connectedNodes: Node[];
  determinedElementHost: HTMLElement | DocumentFragment | Text | Comment | null;
} {
  const connectedNodes: Node[] = [];
  let determinedElementHost: HTMLElement | DocumentFragment | Text | Comment | null = null;

  // Upgrade undetermined elements
  const treeWalker = document.createTreeWalker(undeterminedElementHost, NodeFilter.SHOW_ELEMENT);
  do {
    if (treeWalker.currentNode instanceof Element && !(treeWalker.currentNode as any).determined) {
      const upgradedElement = updateElement(parentElement, treeWalker.currentNode as HTMLElement);
      if (upgradedElement && undeterminedElementHost === treeWalker.currentNode) {
        determinedElementHost = upgradedElement;
      }
      if (upgradedElement) {
        treeWalker.currentNode.replaceWith(upgradedElement);
      }
    }

    // TODO: Upgrade undetermined attributes (requires CustomAttribute from Phase 6+)
  } while (treeWalker.nextNode());

  // Upgrade undetermined text nodes
  const textTreeWalker = document.createTreeWalker(undeterminedElementHost, NodeFilter.SHOW_TEXT);
  do {
    if (textTreeWalker.currentNode instanceof Text && (textTreeWalker.currentNode as any).determined === false) {
      const upgradedTextNode = updateTextNode(parentElement, textTreeWalker.currentNode);
      if (upgradedTextNode && undeterminedElementHost === textTreeWalker.currentNode) {
        determinedElementHost = upgradedTextNode;
      }
      if (upgradedTextNode) {
        textTreeWalker.currentNode.replaceWith(upgradedTextNode);
        connectedNodes.push(upgradedTextNode);
      }
    }
  } while (textTreeWalker.nextNode());

  // Upgrade undetermined comments
  const commentTreeWalker = document.createTreeWalker(undeterminedElementHost, NodeFilter.SHOW_COMMENT);
  const commentsToReplace: [Comment, Comment][] = [];

  do {
    if (commentTreeWalker.currentNode instanceof Comment) {
      const isDetermined = (commentTreeWalker.currentNode as any).determined;
      
      if (isDetermined === false) {
        const upgradedComment = updateComment(parentElement, commentTreeWalker.currentNode);
        if (upgradedComment && undeterminedElementHost === commentTreeWalker.currentNode) {
          determinedElementHost = upgradedComment;
        }
        if (upgradedComment) {
          commentsToReplace.push([commentTreeWalker.currentNode, upgradedComment]);
          connectedNodes.push(upgradedComment);
        }
      } else if (isDetermined === true) {
        // Already determined custom comment
        connectedNodes.push(commentTreeWalker.currentNode);
      }
    }
  } while (commentTreeWalker.nextNode());

  // Replace comments after tree walking (replacing during iteration stops traversal)
  commentsToReplace.forEach(([currentNode, upgradedComment]) => {
    currentNode.replaceWith(upgradedComment);
  });

  return {
    connectedNodes,
    determinedElementHost,
  };
}

/**
 * Patches DOM insertion methods to upgrade undetermined nodes
 * 
 * Critical utility that enables the "undetermined" element upgrade flow:
 * 1. Elements created without a registry definition are "undetermined"
 * 2. When inserted into a connected node, they get upgraded
 * 3. Upgrade searches parent's injector hierarchy for definition
 * 4. Real element is constructed and swapped in
 * 
 * @param ConstructorToPatch - The constructor whose prototype to patch (e.g., Element, DocumentFragment)
 * @param leadinMethods - Methods with leading args before nodes (e.g., insertAdjacentElement)
 * @param spreadMethods - Methods with spread node args (e.g., append, prepend)
 * @param trailingMethods - Methods with trailing args after nodes (e.g., insertBefore, replaceChild)
 */
export default function pathInsertionMethods<Type extends Node>(
  ConstructorToPatch: new () => Type,
  leadinMethods: readonly (keyof Type)[],
  spreadMethods: readonly (keyof Type)[],
  trailingMethods: readonly (keyof Type)[] = [],
): void {
  const allMethods = [
    ...leadinMethods,
    ...spreadMethods,
    ...trailingMethods,
  ];

  Object.defineProperties(ConstructorToPatch.prototype, {
    ...allMethods.reduce((result, methodName) => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(ConstructorToPatch.prototype, methodName);
      
      result[methodName] = {
        ...originalDescriptor,
        value(this: Type, ...args: unknown[]) {
          const currentCreationInjector = InjectorRoot.creationInjector;
          InjectorRoot.creationInjector = this.getClosestInjector();

          const connectedNodes: Node[] = [];

          if (this.isConnected) {
            // Parse arguments based on method type
            const trailingArgs = leadinMethods.includes(methodName as any) ? args.slice(1) : [];
            const leadingArgs = trailingMethods.includes(methodName as any) ? args.slice(-1) : [];
            const nodes = args.slice(leadingArgs.length, args.length - trailingArgs.length);

            // Upgrade undetermined nodes
            const determinedNodes = nodes.map((arg) => {
              if (arg instanceof HTMLElement && !(arg as any).determined) {
                const element = updateElement(this, arg);
                if (element) return element;
              } else if (arg instanceof Comment && (arg as any).determined) {
                connectedNodes.push(arg);
              } else if (arg instanceof Text && (arg as any).determined) {
                connectedNodes.push(arg);
              } else if (
                arg instanceof HTMLElement ||
                arg instanceof DocumentFragment ||
                arg instanceof Comment ||
                arg instanceof Text
              ) {
                const { connectedNodes: newConnectedNodes, determinedElementHost } = upgradeDeep(this, arg as any);
                if (newConnectedNodes.length) {
                  connectedNodes.push(...newConnectedNodes);
                }
                if (determinedElementHost) return determinedElementHost;
              }

              return arg;
            });

            // Call original method with upgraded nodes
            const result = originalDescriptor?.value.call(this, ...leadingArgs, ...determinedNodes, ...trailingArgs);

            // Call connectedCallback on custom nodes
            connectedNodes.forEach((connectedNode) => {
              const callback = (connectedNode as any).connectedCallback;
              if (typeof callback === 'function') {
                callback.call(connectedNode);
              }
            });

            InjectorRoot.creationInjector = currentCreationInjector;
            return result;
          }

          // Not connected - just call original method
          InjectorRoot.creationInjector = currentCreationInjector;
          return originalDescriptor?.value.call(this, ...args);
        },
      };

      return result;
    }, {} as PropertyDescriptorMap),
  });
}

