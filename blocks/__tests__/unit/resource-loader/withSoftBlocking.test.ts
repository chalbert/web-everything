/**
 * Unit tests for withSoftBlocking trait
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withSoftBlocking } from '../../../resource-loader/traits/withSoftBlocking';

describe('withSoftBlocking', () => {
  let target: HTMLDivElement;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should set aria-busy="true"', () => {
    withSoftBlocking(target);
    expect(target.getAttribute('aria-busy')).toBe('true');
  });

  it('should set pointer-events to none', () => {
    withSoftBlocking(target);
    expect(target.style.pointerEvents).toBe('none');
  });

  it('should set opacity to 0.6 by default', () => {
    withSoftBlocking(target);
    expect(target.style.opacity).toBe('0.6');
  });

  it('should accept custom opacity', () => {
    withSoftBlocking(target, { opacity: 0.3 });
    expect(target.style.opacity).toBe('0.3');
  });

  it('should set data-loader-state="loading"', () => {
    withSoftBlocking(target);
    expect(target.getAttribute('data-loader-state')).toBe('loading');
  });

  it('should restore aria-busy on cleanup', () => {
    const handle = withSoftBlocking(target);
    handle.cleanup();
    expect(target.hasAttribute('aria-busy')).toBe(false);
  });

  it('should preserve existing aria-busy value on cleanup', () => {
    target.setAttribute('aria-busy', 'false');
    const handle = withSoftBlocking(target);
    expect(target.getAttribute('aria-busy')).toBe('true');
    handle.cleanup();
    expect(target.getAttribute('aria-busy')).toBe('false');
  });

  it('should restore pointer-events on cleanup', () => {
    target.style.pointerEvents = 'auto';
    const handle = withSoftBlocking(target);
    expect(target.style.pointerEvents).toBe('none');
    handle.cleanup();
    expect(target.style.pointerEvents).toBe('auto');
  });

  it('should restore opacity on cleanup', () => {
    target.style.opacity = '1';
    const handle = withSoftBlocking(target);
    expect(target.style.opacity).toBe('0.6');
    handle.cleanup();
    expect(target.style.opacity).toBe('1');
  });

  it('should restore data-loader-state on cleanup', () => {
    const handle = withSoftBlocking(target);
    handle.cleanup();
    expect(target.hasAttribute('data-loader-state')).toBe(false);
  });
});
