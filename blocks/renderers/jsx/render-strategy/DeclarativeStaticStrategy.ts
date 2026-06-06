import type { CustomRenderStrategy, RenderHandle, RenderInput } from './CustomRenderStrategy';

/**
 * Native-first default render strategy: parse-once DOM.
 *
 * The JSX factory ({@link ../JSXRenderer}) has already built the element tree; `mount` simply
 * appends it and is done. There is intentionally **no `update`** — this strategy is mount-once.
 * That makes the historical "eager construct-once DOM" assumption of the JSX renderer an
 * EXPLICIT, registered provider rather than a hidden default (backlog #077).
 *
 * Reactive-by-path bindings (`bind-*`, `{{ }}`) are layered on by the binding behaviours, not by
 * re-running `mount`, which is why a declarative-static tree needs no `update()`.
 */
export class DeclarativeStaticStrategy implements CustomRenderStrategy {
  readonly name = 'declarative-static';

  mount(tree: RenderInput, host: ParentNode): RenderHandle {
    const node: Node = typeof tree === 'string' ? document.createTextNode(tree) : tree;
    // Capture top-level nodes BEFORE insertion — appending a DocumentFragment empties it,
    // so reading childNodes afterwards would lose the handle's dispose targets. Test by
    // nodeType (not instanceof) to stay robust across DOM realms (happy-dom / linkedom).
    const nodes: Node[] =
      node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? Array.from(node.childNodes) : [node];
    host.appendChild(node);
    return { strategy: this.name, host, nodes };
  }

  dispose(handle: RenderHandle): void {
    for (const node of handle.nodes) {
      node.parentNode?.removeChild(node);
    }
  }
}
