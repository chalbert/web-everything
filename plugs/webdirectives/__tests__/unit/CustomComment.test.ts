/**
 * Unplugged-mode (non-invasive) test for CustomComment — #1130 (webdirectives completion #1098).
 *
 * Proves CustomComment is a plain base extending the native `Comment` that a subclass derives from
 * WITHOUT any global prototype patch — webdirectives monkeypatches nothing; the comment-node directive
 * surface registers through the `customComments` registry, not a plug global. Static, deterministic
 * proof the plug does not REQUIRE plugged mode (#606) and pollutes no shared prototype.
 */
import { describe, it, expect, vi } from 'vitest';
import CustomComment from '../../CustomComment';

class ResourceLoaderDirective extends CustomComment {
  ran = false;
  connectedCallback = (): void => {
    this.ran = true;
  };
}

describe('CustomComment (non-invasive comment-node directive base)', () => {
  it('extends the native Comment — the prototype chain reaches Comment → CharacterData → Node', () => {
    const directive = new ResourceLoaderDirective({ key: 'value' });
    expect(directive).toBeInstanceOf(CustomComment);
    expect(directive).toBeInstanceOf(Comment);
    expect(directive).toBeInstanceOf(Node);
    expect(directive.nodeType).toBe(Node.COMMENT_NODE);
  });

  it('holds the parsed options passed at construction', () => {
    const directive = new ResourceLoaderDirective({ key: 'value', n: 3 });
    expect(directive.options).toEqual({ key: 'value', n: 3 });
  });

  it('carries the native comment data payload', () => {
    const directive = new ResourceLoaderDirective({}, ' resource:loader ');
    expect(directive.data).toBe(' resource:loader ');
  });

  it('lifecycle hooks are optional — a base with none defined exposes undefined', () => {
    class Bare extends CustomComment {}
    const bare = new Bare();
    expect(bare.connectedCallback).toBeUndefined();
    expect(bare.disconnectedCallback).toBeUndefined();
    expect(bare.optionsChangedCallback).toBeUndefined();
  });

  it('a subclass lifecycle hook is the registry-callable surface (invoked here directly)', () => {
    const directive = new ResourceLoaderDirective({});
    expect(directive.ran).toBe(false);
    directive.connectedCallback?.();
    expect(directive.ran).toBe(true);
  });

  it('patches no global — native Comment.prototype gains no CustomComment members', () => {
    expect(Object.prototype.hasOwnProperty.call(Comment.prototype, 'options')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(Comment.prototype, 'connectedCallback')).toBe(false);
  });
});
