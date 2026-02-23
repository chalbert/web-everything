import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateHeadingLevel } from '../../../transient/calculateHeadingLevel';

describe('calculateHeadingLevel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should return 1 with no sectioning ancestors', () => {
    const target = document.createElement('span');
    document.body.appendChild(target);

    expect(calculateHeadingLevel(target)).toBe(1);
  });

  it('should return 1 when only non-sectioning ancestors exist', () => {
    document.body.innerHTML = '<div><main><span id="target"></span></main></div>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(1);
  });

  it('should return 2 with one section ancestor', () => {
    document.body.innerHTML = '<section><span id="target"></span></section>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(2);
  });

  it('should return 3 with section > article ancestors', () => {
    document.body.innerHTML = '<section><article><span id="target"></span></article></section>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(3);
  });

  it('should count nav as sectioning element', () => {
    document.body.innerHTML = '<nav><span id="target"></span></nav>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(2);
  });

  it('should count aside as sectioning element', () => {
    document.body.innerHTML = '<aside><span id="target"></span></aside>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(2);
  });

  it('should NOT count div as sectioning', () => {
    document.body.innerHTML = '<div><span id="target"></span></div>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(1);
  });

  it('should NOT count main as sectioning', () => {
    document.body.innerHTML = '<main><span id="target"></span></main>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(1);
  });

  it('should NOT count header as sectioning', () => {
    document.body.innerHTML = '<header><span id="target"></span></header>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(1);
  });

  it('should NOT count footer as sectioning', () => {
    document.body.innerHTML = '<footer><span id="target"></span></footer>';
    const target = document.getElementById('target')!;

    expect(calculateHeadingLevel(target)).toBe(1);
  });

  it('should skip non-sectioning elements in the chain', () => {
    document.body.innerHTML = '<section><div><article><div><span id="target"></span></div></article></div></section>';
    const target = document.getElementById('target')!;

    // 2 sectioning ancestors (section, article) → level 3
    expect(calculateHeadingLevel(target)).toBe(3);
  });

  it('should handle deeply nested structure', () => {
    document.body.innerHTML = `
      <section><section><section><section><section>
        <span id="target"></span>
      </section></section></section></section></section>
    `;
    const target = document.getElementById('target')!;

    // 5 ancestors → level 6
    expect(calculateHeadingLevel(target)).toBe(6);
  });

  it('should clamp at 6 with more than 5 sectioning ancestors', () => {
    document.body.innerHTML = `
      <section><article><nav><aside><section><article>
        <section><span id="target"></span></section>
      </article></section></aside></nav></article></section>
    `;
    const target = document.getElementById('target')!;

    // 7 ancestors → clamped to 6
    expect(calculateHeadingLevel(target)).toBe(6);
  });
});
