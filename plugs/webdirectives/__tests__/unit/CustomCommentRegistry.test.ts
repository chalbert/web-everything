/**
 * Unit test for CustomCommentRegistry — #1131 (webdirectives completion #1098).
 *
 * Proves the `customComments` registry drives the comment-node directive lifecycle: `define` + `upgrade`
 * re-prototypes a matched comment onto its CustomComment subclass and runs `connectedCallback`; an
 * unregistered or closing-marker comment is left untouched; `whenDefined` resolves on registration; and
 * `downgrade` disconnects. Non-invasive — instantiates the registry, patches no global.
 */
import { describe, it, expect, vi } from 'vitest';
import CustomCommentRegistry from '../../CustomCommentRegistry';
import CustomComment from '../../CustomComment';

// Registry-upgraded directives declare lifecycle hooks as PROTOTYPE METHODS, not arrow-function class
// fields: `upgrade` re-prototypes an existing comment node (it cannot re-run a constructor), so only
// prototype-reachable members survive — the same constraint native custom-element upgrade lives under.
class ResourceLoaderDirective extends CustomComment {
  connected = false;
  disconnected = false;
  connectedCallback(): void {
    this.connected = true;
  }
  disconnectedCallback(): void {
    this.disconnected = true;
  }
}

/** Build a container whose children include the given comment data strings. */
function treeWith(...commentData: string[]): HTMLElement {
  const container = document.createElement('div');
  for (const data of commentData) container.appendChild(document.createComment(data));
  return container;
}

describe('CustomCommentRegistry', () => {
  it('has localName customComments and extends the HTMLRegistry surface', () => {
    const registry = new CustomCommentRegistry();
    expect(registry.localName).toBe('customComments');
    registry.define('resource:loader', ResourceLoaderDirective);
    expect(registry.get('resource:loader')).toBe(ResourceLoaderDirective);
  });

  it('upgrade re-prototypes a matched comment onto its subclass and runs connectedCallback', () => {
    const registry = new CustomCommentRegistry();
    registry.define('resource:loader', ResourceLoaderDirective);
    const tree = treeWith(' resource:loader src="/x" ');
    const comment = tree.firstChild as Comment;

    expect(comment).not.toBeInstanceOf(ResourceLoaderDirective);
    registry.upgrade(tree);

    expect(comment).toBeInstanceOf(ResourceLoaderDirective);
    expect(comment).toBeInstanceOf(CustomComment);
    expect((comment as ResourceLoaderDirective).connected).toBe(true);
    expect((comment as CustomComment).options).toEqual({});
  });

  it('leaves an unregistered directive and a closing marker untouched', () => {
    const registry = new CustomCommentRegistry();
    registry.define('resource:loader', ResourceLoaderDirective);
    const tree = treeWith(' control:if cond ', ' /resource:loader ');
    registry.upgrade(tree);
    for (const child of Array.from(tree.childNodes))
      expect(child).not.toBeInstanceOf(ResourceLoaderDirective);
  });

  it('is idempotent — a second upgrade does not re-run connectedCallback', () => {
    const registry = new CustomCommentRegistry();
    const spy = vi.fn();
    class Spied extends CustomComment {
      connectedCallback(): void {
        spy();
      }
    }
    registry.define('resource:loader', Spied);
    const tree = treeWith(' resource:loader ');
    registry.upgrade(tree);
    registry.upgrade(tree);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('upgrades when the root itself is the directive comment', () => {
    const registry = new CustomCommentRegistry();
    registry.define('resource:loader', ResourceLoaderDirective);
    const comment = document.createComment(' resource:loader ');
    registry.upgrade(comment);
    expect(comment).toBeInstanceOf(ResourceLoaderDirective);
  });

  it('downgrade runs disconnectedCallback and lets a later upgrade re-connect', () => {
    const registry = new CustomCommentRegistry();
    registry.define('resource:loader', ResourceLoaderDirective);
    const tree = treeWith(' resource:loader ');
    registry.upgrade(tree);
    const comment = tree.firstChild as ResourceLoaderDirective;
    registry.downgrade(tree);
    expect(comment.disconnected).toBe(true);
    comment.connected = false;
    registry.upgrade(tree);
    expect(comment.connected).toBe(true);
  });

  it('whenDefined resolves immediately when already defined', async () => {
    const registry = new CustomCommentRegistry();
    registry.define('resource:loader', ResourceLoaderDirective);
    await expect(registry.whenDefined('resource:loader')).resolves.toBe(ResourceLoaderDirective);
  });

  it('whenDefined resolves on a later define', async () => {
    const registry = new CustomCommentRegistry();
    const pending = registry.whenDefined('control:if');
    registry.define('control:if', ResourceLoaderDirective);
    await expect(pending).resolves.toBe(ResourceLoaderDirective);
  });
});
