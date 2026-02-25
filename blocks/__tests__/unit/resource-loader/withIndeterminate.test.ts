/**
 * Unit tests for withIndeterminate trait
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withIndeterminate } from '../../../resource-loader/traits/withIndeterminate';

describe('withIndeterminate', () => {
  let target: HTMLDivElement;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should set data-loader-progress="indeterminate"', () => {
    withIndeterminate(target);
    expect(target.getAttribute('data-loader-progress')).toBe('indeterminate');
  });

  it('should set aria-busy="true"', () => {
    withIndeterminate(target);
    expect(target.getAttribute('aria-busy')).toBe('true');
  });

  it('should add custom className when provided', () => {
    withIndeterminate(target, { className: 'loading-spinner' });
    expect(target.classList.contains('loading-spinner')).toBe(true);
  });

  it('should remove data-loader-progress on cleanup', () => {
    const handle = withIndeterminate(target);
    handle.cleanup();
    expect(target.hasAttribute('data-loader-progress')).toBe(false);
  });

  it('should remove aria-busy on cleanup', () => {
    const handle = withIndeterminate(target);
    handle.cleanup();
    expect(target.hasAttribute('aria-busy')).toBe(false);
  });

  it('should remove custom className on cleanup', () => {
    const handle = withIndeterminate(target, { className: 'loading-spinner' });
    handle.cleanup();
    expect(target.classList.contains('loading-spinner')).toBe(false);
  });

  it('should preserve existing aria-busy on cleanup', () => {
    target.setAttribute('aria-busy', 'false');
    const handle = withIndeterminate(target);
    handle.cleanup();
    expect(target.getAttribute('aria-busy')).toBe('false');
  });

  it('should preserve existing data-loader-progress on cleanup', () => {
    target.setAttribute('data-loader-progress', 'determinate');
    const handle = withIndeterminate(target);
    expect(target.getAttribute('data-loader-progress')).toBe('indeterminate');
    handle.cleanup();
    expect(target.getAttribute('data-loader-progress')).toBe('determinate');
  });
});
