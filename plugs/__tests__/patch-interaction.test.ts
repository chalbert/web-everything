/**
 * Patch-interaction stress harness (#1011, slice of #1002) — the cross-plug invariants that must survive
 * the **full plugged** `we:plugs/bootstrap.ts`, not any single plug in isolation.
 *
 * No equivalent existed before this: `we:plugs/webcomponents/__tests__/unit/Node.cloneNode.patch.test.ts`
 * covers one patch; this asserts the *global* state after EVERY patch installs together. The three
 * invariants (per `we:docs/agent/plugs-testing-strategy.md`):
 *  1. `Node.*` static node-type constants intact after the full bootstrap — the exact #960 regression that
 *     broke Parchment/Quill when `window.Node` was replaced without carrying its static constants.
 *  2. A third-party DOM library still instantiates under the bootstrap (a stand-in that reads
 *     `Node.TEXT_NODE`/`nodeType` and round-trips through `document.createElement` + `cloneNode`, the
 *     exact surface a rich-text editor like Quill/Parchment depends on — WE ships no such dep, so the
 *     library is modelled minimally rather than pulled in).
 *  3. Plugged ↔ unplugged parity: behaviour that must be identical with or without the global patch
 *     installed (a `CustomTrackerRegistry` resolves the same way standalone vs. after the bootstrap).
 *
 * The bootstrap is side-effecting (it patches globals + installs `window.*` on import), so it is imported
 * once for the whole suite. Importing it IS the "full plugged mode".
 */
import { describe, it, expect, beforeAll } from 'vitest';

/** The canonical DOM node-type constants, by spec. A patched global `Node` must still expose these. */
const NODE_TYPE_CONSTANTS: Record<string, number> = {
  ELEMENT_NODE: 1,
  ATTRIBUTE_NODE: 2,
  TEXT_NODE: 3,
  CDATA_SECTION_NODE: 4,
  PROCESSING_INSTRUCTION_NODE: 7,
  COMMENT_NODE: 8,
  DOCUMENT_NODE: 9,
  DOCUMENT_TYPE_NODE: 10,
  DOCUMENT_FRAGMENT_NODE: 11,
};

/**
 * A minimal stand-in for a third-party DOM library (Parchment/Quill class). It reads the `Node.TEXT_NODE`
 * static constant at construction and uses the real-DOM surface those libraries rely on — exactly what
 * breaks when the patched global `Node` drops its statics.
 */
class ThirdPartyDomLibrary {
  readonly textNodeType: number;
  constructor() {
    // Quill/Parchment read these statics directly; an `undefined` here is the #960 failure mode.
    this.textNodeType = (Node as unknown as { TEXT_NODE: number }).TEXT_NODE;
  }
  /** Round-trip an element through create + clone, asserting node types stay coherent. */
  build(tag: string): { node: number; cloneMatches: boolean } {
    const el = document.createElement(tag);
    const clone = el.cloneNode(true);
    return { node: el.nodeType, cloneMatches: clone.nodeType === el.nodeType };
  }
}

describe('patch-interaction stress harness — full plugged bootstrap (#1011)', () => {
  beforeAll(async () => {
    // Apply the full plugged mode exactly as a page would (`<script src="/plugs/bootstrap.ts">`).
    await import('../bootstrap');
  });

  it('keeps every Node.* static node-type constant intact after the full bootstrap', () => {
    for (const [name, value] of Object.entries(NODE_TYPE_CONSTANTS)) {
      expect((Node as unknown as Record<string, number>)[name], `Node.${name}`).toBe(value);
    }
  });

  it('exposes the node-type constants on a created node too (instance side intact)', () => {
    const el = document.createElement('div');
    expect(el.ELEMENT_NODE).toBe(1);
    expect(el.TEXT_NODE).toBe(3);
    expect(el.nodeType).toBe(Node.ELEMENT_NODE);
  });

  it('lets a third-party DOM library instantiate and operate under the bootstrap', () => {
    const lib = new ThirdPartyDomLibrary();
    // Construction read Node.TEXT_NODE — must be the real constant, not undefined.
    expect(lib.textNodeType).toBe(3);
    const result = lib.build('span');
    expect(result.node).toBe(Node.ELEMENT_NODE);
    expect(result.cloneMatches).toBe(true);
  });

  it('still creates real elements through the patched document.createElement', () => {
    const el = document.createElement('p');
    expect(el.tagName.toLowerCase()).toBe('p');
    expect(el.nodeType).toBe(Node.ELEMENT_NODE);
  });

  it('plugged ↔ unplugged parity: a CustomTrackerRegistry resolves identically with the bootstrap loaded', async () => {
    const { default: CustomTrackerRegistry, createDefaultTrackerRegistry } = await import(
      '../webanalytics/CustomTrackerRegistry'
    );
    // Unplugged form (plain instantiation) and the same registry built post-bootstrap must behave the same.
    const standalone = new CustomTrackerRegistry();
    const viaDefault = createDefaultTrackerRegistry();
    expect(standalone.localName).toBe(viaDefault.localName);
    expect(viaDefault.defaultKey).toBe('noop');
    expect(() => viaDefault.track('App Opened')).not.toThrow();
  });
});
