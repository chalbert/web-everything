/**
 * Abstract base class for **comment-node directives** (#1130, webdirectives completion #1098).
 *
 * The comment-node analog of {@link ./CustomTemplateDirective} (which extends `HTMLTemplateElement`):
 * `CustomComment` extends the native `Comment` so a directive expressed as an HTML comment
 * (`<!-- resource:loader … -->`) carries lifecycle + parsed options, mirroring the customizable-
 * built-in pattern. Like the rest of webdirectives it is **non-invasive** — it patches no global and
 * pollutes no shared prototype; a subclass just derives from it and the `customComments` registry
 * invokes the lifecycle callbacks (the registry is the real-app surface, not a plug global, #606).
 *
 * Spec: `we:src/_includes/project-webdirectives.njk` (the `CustomComment` interface — `readonly options`
 * plus optional `connectedCallback` / `disconnectedCallback` / `optionsChangedCallback`). Comment nodes
 * have no native lifecycle, so the callbacks are *optional hooks* a subclass implements and the registry
 * calls; the base declares the shape and holds the parsed `options`, nothing more.
 */

/** Parsed options from a directive comment's content (`<!-- resource:loader key=value -->`). Opaque to the base. */
export type CustomCommentOptions = Record<string, unknown>;

/**
 * Abstract base for a comment-node directive. Extends the native `Comment` (so the prototype chain is
 * `instance → CustomComment → Comment → CharacterData → Node`) and adds the parsed `options` plus the
 * three optional lifecycle hooks the `customComments` registry calls when the directive is connected,
 * disconnected, or its options change. Construct with the parsed options; the comment's text data is the
 * native `Comment` payload and is left to the subclass / registry.
 */
export default abstract class CustomComment extends Comment {
  /** The parsed options for this directive instance (set at construction; the registry re-parses on change). */
  readonly options: CustomCommentOptions;

  constructor(options: CustomCommentOptions = {}, data = '') {
    super(data);
    this.options = options;
  }

  // NB: a subclass upgraded by `CustomCommentRegistry` (#1131) must declare these as PROTOTYPE METHODS,
  // not arrow-function class fields — `upgrade` re-prototypes an existing comment node and cannot re-run
  // a constructor, so only prototype-reachable members survive (the native custom-element constraint).
  /** Called when the directive comment is connected to the document (invoked by the registry). */
  connectedCallback?: () => void;
  /** Called when the directive comment is disconnected from the document. */
  disconnectedCallback?: () => void;
  /** Called when the directive's parsed options change. */
  optionsChangedCallback?: (oldValue: unknown, newValue: unknown) => void;
}
