/**
 * Unplugged-mode (non-invasive) test for webinjectors — #649 / #636 backfill.
 *
 * Drives the injector directly as a library — composing an Injector instance and calling
 * provide/consume — WITHOUT the plugged `Node.injectors.patch` global patch. Centres on the #400
 * consumption-edge introspection (the consumer→provider graph): opt-in, off by default, so the
 * unplugged production path stays zero-cost. This is the automated proof the plug works in the
 * mandatory unplugged surface (#606) and that the ported #400 tracking records edges.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';
import CustomRegistry from '../../../core/CustomRegistry';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

class TestRegistry extends CustomRegistry<any> {
  localName = 'testRegistry';
}

describe('webinjectors — unplugged (non-invasive) mode', () => {
  let target: HTMLElement;
  let querier: HTMLElement;
  let injector: TestInjector;

  beforeEach(() => {
    target = document.createElement('div');
    querier = document.createElement('span');
    target.appendChild(querier);
    document.body.appendChild(target);
    injector = new TestInjector(target);
  });

  afterEach(() => {
    Injector.trackConsumption = false;
    target.remove();
  });

  it('provides and consumes a registry through the injector without any global patch', async () => {
    const registry = new TestRegistry();
    injector.set('testRegistry', registry);

    await expect(injector.consume('testRegistry', querier)).resolves.toBe(registry);
  });

  it('records no consumption edges by default (#400 tracking is opt-in / zero-cost)', async () => {
    const registry = new TestRegistry();
    injector.set('testRegistry', registry);

    await injector.consume('testRegistry', querier);

    expect(injector.consumptionEdges()).toEqual([]);
  });

  it('records the consumer→provider edge when tracking is enabled (#400)', async () => {
    Injector.trackConsumption = true;
    const registry = new TestRegistry();
    injector.set('testRegistry', registry);

    await injector.consume('testRegistry', querier);

    expect(injector.consumptionEdges()).toEqual([{ provider: 'testRegistry', querier }]);
  });

  it('dedupes repeated consumption of the same provider by the same querier', async () => {
    Injector.trackConsumption = true;
    const registry = new TestRegistry();
    injector.set('testRegistry', registry);

    await injector.consume('testRegistry', querier);
    await injector.consume('testRegistry', querier);

    expect(injector.consumptionEdges()).toHaveLength(1);
  });
});
