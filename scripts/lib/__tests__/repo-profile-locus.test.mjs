import { describe, it, expect } from 'vitest';
import { deliveryLocusForScope } from '../repo-profile.mjs';

describe('#4649 deliveryLocusForScope', () => {
  it.each([
    ['we:a,plateau-app:b', { multiRepo: true, keys: ['we', 'plateau-app'] }],
    [['we:a', 'plateau-app:b'], { multiRepo: true, keys: ['we', 'plateau-app'] }],
    ['plateau-app:a,plateau-app:b', { multiRepo: false, keys: ['plateau-app'] }],
    ['', { multiRepo: false, keys: ['we'] }],
    [null, { multiRepo: false, keys: ['we'] }],
    ['unknown:a', { multiRepo: false, keys: ['we'] }],
  ])('resolves %j without loading profiles', (scope, expected) => {
    expect(deliveryLocusForScope(scope)).toEqual(expected);
  });
});
