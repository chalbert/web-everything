/**
 * @file TrackAttribute.test.ts
 * @description Conformance vector for the `data-track` declarative emission seam (#1475). Asserts that a
 *   declared interaction binds to the resolved tracker's `track(event, properties)` — click/submit/
 *   focus/view/custom — that static `data-track-props` are merged, and that with no `customTrackers`
 *   registry in scope the binding degrades silently (no throw, no delivery).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CustomAttributeRegistry from '../../webbehaviors/CustomAttributeRegistry';
import TrackAttribute from '../TrackAttribute';
import CustomTrackerRegistry from '../CustomTrackerRegistry';
import type { CustomTracker } from '../../../analytics/provider.js';

/** Records every routed call so the vector can assert event name + properties. */
class SpyTracker implements CustomTracker {
  readonly key = 'spy';
  identify = vi.fn();
  track = vi.fn();
  page = vi.fn();
  group = vi.fn();
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('TrackAttribute — the `data-track` emission seam (#1475)', () => {
  let registry: CustomAttributeRegistry;
  let container: HTMLDivElement;
  let spy: SpyTracker;

  beforeEach(() => {
    registry = new CustomAttributeRegistry();
    registry.define('data-track', TrackAttribute);
    container = document.createElement('div');
    document.body.appendChild(container);
    spy = new SpyTracker();
    const trackers = new CustomTrackerRegistry();
    trackers.define(spy, true);
    window.customTrackers = trackers;
  });

  afterEach(() => {
    registry.downgrade(container);
    container.remove();
    delete window.customTrackers;
  });

  it('binds a default-click interaction and routes to the resolved tracker', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-track', 'cta-clicked');
    container.appendChild(btn);
    registry.upgrade(container);
    await tick();
    btn.click();
    expect(spy.track).toHaveBeenCalledWith('cta-clicked', undefined);
  });

  it('parses an explicit interaction prefix (focus → focusin)', async () => {
    const input = document.createElement('input');
    input.setAttribute('data-track', 'focus:field-focused');
    container.appendChild(input);
    registry.upgrade(container);
    await tick();
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(spy.track).toHaveBeenCalledWith('field-focused', undefined);
  });

  it('merges static data-track-props into the tracked event', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-track', 'upgraded');
    btn.setAttribute('data-track-props', '{"plan":"pro"}');
    container.appendChild(btn);
    registry.upgrade(container);
    await tick();
    btn.click();
    expect(spy.track).toHaveBeenCalledWith('upgraded', { plan: 'pro' });
  });

  it('binds a named custom event via data-track-on', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-track', 'custom:thing-happened');
    el.setAttribute('data-track-on', 'my-event');
    container.appendChild(el);
    registry.upgrade(container);
    await tick();
    el.dispatchEvent(new CustomEvent('my-event'));
    expect(spy.track).toHaveBeenCalledWith('thing-happened', undefined);
  });

  it('degrades silently with no customTrackers registry in scope (no throw, no delivery)', async () => {
    delete window.customTrackers;
    const btn = document.createElement('button');
    btn.setAttribute('data-track', 'orphan-event');
    container.appendChild(btn);
    registry.upgrade(container);
    await tick();
    expect(() => btn.click()).not.toThrow();
    expect(spy.track).not.toHaveBeenCalled();
  });
});
