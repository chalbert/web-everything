/**
 * Unit tests for withReplacement trait
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withReplacement } from '../../../resource-loader/traits/withReplacement';

describe('withReplacement', () => {
  let target: HTMLDivElement;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should hide existing children in a hidden container', () => {
    target.innerHTML = '<p>Original content</p>';
    withReplacement(target);

    const hidden = target.querySelector('[data-loader-hidden]');
    expect(hidden).not.toBeNull();
    expect(hidden?.hasAttribute('hidden')).toBe(true);
    expect(hidden?.querySelector('p')?.textContent).toBe('Original content');
  });

  it('should show default loading text when no fallback provided', () => {
    withReplacement(target);

    const fallback = target.querySelector('[data-loader-fallback]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toBe('Loading...');
  });

  it('should set role="status" on default fallback', () => {
    withReplacement(target);

    const fallback = target.querySelector('[data-loader-fallback]');
    expect(fallback?.getAttribute('role')).toBe('status');
    expect(fallback?.getAttribute('aria-label')).toBe('Loading');
  });

  it('should stamp template fallback when HTMLTemplateElement provided', () => {
    const template = document.createElement('template');
    template.innerHTML = '<div class="skeleton">Loading skeleton</div>';

    withReplacement(target, { fallback: template });

    const fallback = target.querySelector('[data-loader-fallback]');
    expect(fallback?.querySelector('.skeleton')).not.toBeNull();
    expect(fallback?.querySelector('.skeleton')?.textContent).toBe('Loading skeleton');
  });

  it('should use string HTML as fallback when string provided', () => {
    withReplacement(target, { fallback: '<span class="spinner">Spinning</span>' });

    const fallback = target.querySelector('[data-loader-fallback]');
    expect(fallback?.querySelector('.spinner')?.textContent).toBe('Spinning');
  });

  it('should set aria-busy="true"', () => {
    withReplacement(target);
    expect(target.getAttribute('aria-busy')).toBe('true');
  });

  it('should set data-loader-state="loading"', () => {
    withReplacement(target);
    expect(target.getAttribute('data-loader-state')).toBe('loading');
  });

  it('should restore original children on cleanup', () => {
    target.innerHTML = '<p>First</p><p>Second</p>';
    const handle = withReplacement(target);
    handle.cleanup();

    const paragraphs = target.querySelectorAll('p');
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].textContent).toBe('First');
    expect(paragraphs[1].textContent).toBe('Second');
  });

  it('should remove fallback on cleanup', () => {
    const handle = withReplacement(target);
    handle.cleanup();

    expect(target.querySelector('[data-loader-fallback]')).toBeNull();
    expect(target.querySelector('[data-loader-hidden]')).toBeNull();
  });

  it('should restore aria-busy on cleanup', () => {
    const handle = withReplacement(target);
    handle.cleanup();
    expect(target.hasAttribute('aria-busy')).toBe(false);
  });

  it('should preserve child node order after cleanup', () => {
    target.innerHTML = '<span>A</span><span>B</span><span>C</span>';
    const handle = withReplacement(target);
    handle.cleanup();

    const spans = target.querySelectorAll('span');
    expect(spans.length).toBe(3);
    expect(spans[0].textContent).toBe('A');
    expect(spans[1].textContent).toBe('B');
    expect(spans[2].textContent).toBe('C');
  });

  it('should handle target with no children', () => {
    const handle = withReplacement(target);
    handle.cleanup();

    // Should be clean — no hidden containers or fallbacks remaining
    expect(target.children.length).toBe(0);
  });
});
