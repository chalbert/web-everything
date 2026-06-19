/**
 * @file webdirectives/CustomCommentRegistry.ts
 * @description The `customComments` registry — the real-app surface for comment-node directives
 * (#1131, webdirectives completion #1098).
 *
 * Comment nodes have no native lifecycle and `customElements` only upgrades *elements*, so a directive
 * expressed as an HTML comment (`<!-- resource:loader … -->`) needs its own registry to drive the
 * {@link ./CustomComment} lifecycle. This registry is that surface: it `define`s a name → constructor,
 * and `upgrade(root)` walks the comment nodes of a tree (`NodeFilter.SHOW_COMMENT`), re-prototypes each
 * comment matching a registered name onto its `CustomComment` subclass, and calls `connectedCallback` —
 * the comment-node analog of `CustomElementRegistry.upgrade` and of the SHOW_ELEMENT upgrade-walk in
 * `we:plugs/webinjectors/InjectorRoot.ts:453,247`. Non-invasive (#606): patches no global, pollutes no
 * shared prototype — a real app instantiates this registry and drives it.
 *
 * Spec: `we:src/_includes/project-webdirectives.njk` (§4 `CustomCommentRegistry`). The comment *syntax*
 * (the `namespace:name` grammar + options parsing) is deliberately NOT owned here — that is the
 * `CustomCommentParserRegistry` (#1132). This registry only needs the directive *name* to match a
 * comment to a definition, so it extracts the leading token; the full parse (options + closing marker) is
 * the parser registry's job, injected once #1132 lands.
 */
import HTMLRegistry, { type ConstructorDefinition } from '../core/HTMLRegistry';
import CustomComment, { type CustomCommentOptions } from './CustomComment';

/** A constructor for a {@link CustomComment} subclass — what `define` registers. */
export type CustomCommentConstructor = new (options?: CustomCommentOptions, data?: string) => CustomComment;

/** A registered comment-directive definition: its constructor plus the lifecycle hooks pulled off the prototype. */
export interface CommentDefinition extends ConstructorDefinition<CustomCommentConstructor> {
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
}

/**
 * Extract the directive name a comment matches against — the leading whitespace-delimited token of the
 * trimmed comment data (`<!-- namespace:name … -->` → `namespace:name`). A closing marker
 * (`<!-- /namespace:name -->`) is not an opening directive, so it returns `null`. This is intentionally
 * minimal; the full namespaced grammar belongs to the parser registry (#1132).
 */
function directiveNameOf(comment: Comment): string | null {
  const first = (comment.data ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first || first.startsWith('/')) return null;
  return first;
}

/**
 * Registry for comment-node directives. Extends {@link HTMLRegistry} (`localName` `customComments`, used
 * by `InjectorRoot`), mirroring `CustomAttributeRegistry`'s shape but without the lazy-load/observer
 * machinery — comment directives are upgraded eagerly on `upgrade(root)`.
 */
export default class CustomCommentRegistry extends HTMLRegistry<CommentDefinition, CustomCommentConstructor> {
  localName = 'customComments';

  /** Comments already upgraded, so a re-`upgrade` of an overlapping tree is idempotent (no double connect). */
  #upgraded = new WeakSet<Comment>();

  /** Pending `whenDefined` resolvers per name — settled the moment that name is `define`d. */
  #whenDefinedResolvers = new Map<string, ((ctor: CustomCommentConstructor) => void)[]>();

  /**
   * Register a comment directive. Pulls the lifecycle hooks off the prototype (as `HTMLRegistry`
   * definitions carry them) and resolves any pending {@link whenDefined} promises for this name.
   */
  define(name: string, constructor: CustomCommentConstructor): void {
    const definition: CommentDefinition = {
      constructor,
      connectedCallback: constructor.prototype.connectedCallback,
      disconnectedCallback: constructor.prototype.disconnectedCallback,
    };
    this.set(name, definition);

    const pending = this.#whenDefinedResolvers.get(name);
    if (pending) {
      this.#whenDefinedResolvers.delete(name);
      pending.forEach((resolve) => resolve(constructor));
    }
  }

  /**
   * Upgrade a tree's comment-node directives: walk every comment under `root`, and for each whose leading
   * token names a registered directive, re-prototype it onto the registered `CustomComment` subclass and
   * invoke `connectedCallback`. Idempotent — an already-upgraded comment is skipped.
   */
  upgrade(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    // The TreeWalker root itself is included when it is a comment; iterate inclusively.
    let node: Node | null = root.nodeType === Node.COMMENT_NODE ? root : walker.nextNode();
    while (node) {
      this.#upgradeComment(node as Comment);
      node = walker.nextNode();
    }
  }

  /**
   * Downgrade a tree's comment-node directives: invoke `disconnectedCallback` on each upgraded comment and
   * forget it, so a later `upgrade` re-connects it.
   */
  downgrade(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    let node: Node | null = root.nodeType === Node.COMMENT_NODE ? root : walker.nextNode();
    while (node) {
      const comment = node as Comment;
      if (this.#upgraded.has(comment)) {
        (comment as CustomComment).disconnectedCallback?.();
        this.#upgraded.delete(comment);
      }
      node = walker.nextNode();
    }
  }

  /**
   * Resolve when a comment directive with `name` is defined — the comment-node analog of
   * `customElements.whenDefined`. Resolves immediately if already registered, otherwise on the next
   * matching {@link define}.
   */
  whenDefined(name: string): Promise<CustomCommentConstructor> {
    const existing = this.get(name);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const list = this.#whenDefinedResolvers.get(name) ?? [];
      list.push(resolve);
      this.#whenDefinedResolvers.set(name, list);
    });
  }

  /** Re-prototype one comment onto its registered subclass and connect it. */
  #upgradeComment(comment: Comment): void {
    if (this.#upgraded.has(comment)) return;
    const name = directiveNameOf(comment);
    if (name === null) return;
    const Constructor = this.get(name);
    if (!Constructor) return;

    Object.setPrototypeOf(comment, Constructor.prototype);
    // The native node skips the `CustomComment` constructor, so seed `options` directly (the parser
    // registry, #1132, will supply the real parsed options; an empty record is the pre-parser default).
    Object.defineProperty(comment, 'options', { value: {}, writable: true, configurable: true });
    this.#upgraded.add(comment);
    (comment as CustomComment).connectedCallback?.();
  }
}
