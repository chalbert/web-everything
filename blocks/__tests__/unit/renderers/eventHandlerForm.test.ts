/**
 * Unit tests for eventHandlerForm — the event-handler display-form axis (#324).
 *
 * The toggle switches a NAMED handler between its two spellings — canonical string behavior
 * (`on:click="inc($event)"`) and convenience function prop (`onclick={inc}`) — without changing
 * behavior. The string→function direction is total (every string-behavior input is a named handler);
 * the closure-lossy asymmetry lives in jsxToHtml's reverseEvents (#325), exercised there.
 */
import { describe, it, expect } from 'vitest';
import {
  toFunctionProp,
  toStringBehavior,
  applyEventHandlerForm,
  DEFAULT_EVENT_HANDLER_FORM,
} from '../../../renderers/jsx/eventHandlerForm';

describe('eventHandlerForm — toFunctionProp (canonical → convenience)', () => {
  it('rewrites on:click="inc($event)" to onclick={inc}', () => {
    expect(toFunctionProp('<button on:click="inc($event)">+</button>')).toBe(
      '<button onclick={inc}>+</button>'
    );
  });

  it('handles a member-path name', () => {
    expect(toFunctionProp('<button on:click="store.save($event)">Save</button>')).toBe(
      '<button onclick={store.save}>Save</button>'
    );
  });

  it('rewrites multiple handlers on one element', () => {
    expect(
      toFunctionProp('<input on:input="filter($event)" on:focus="open($event)" />')
    ).toBe('<input oninput={filter} onfocus={open} />');
  });

  it('leaves a non-canonical string behavior (literal args) verbatim — no bare-name form', () => {
    const src = '<button on:click="seek(42)">Skip</button>';
    expect(toFunctionProp(src)).toBe(src);
  });

  it('leaves ordinary attributes untouched', () => {
    const src = '<button class="btn" data-x="1">Go</button>';
    expect(toFunctionProp(src)).toBe(src);
  });
});

describe('eventHandlerForm — toStringBehavior (convenience → canonical, named only)', () => {
  it('rewrites onclick={inc} to on:click="inc($event)"', () => {
    expect(toStringBehavior('<button onclick={inc}>+</button>')).toBe(
      '<button on:click="inc($event)">+</button>'
    );
  });

  it('round-trips with toFunctionProp for a named handler', () => {
    const canonical = '<button on:click="inc($event)">+</button>';
    expect(toStringBehavior(toFunctionProp(canonical))).toBe(canonical);
  });

  it('does NOT touch an inline closure (its lossy handling is jsxToHtml.reverseEvents, #325)', () => {
    const src = '<button onclick={() => count++}>+</button>';
    expect(toStringBehavior(src)).toBe(src);
  });
});

describe('eventHandlerForm — applyEventHandlerForm', () => {
  it('string-behavior is the native-first default and identity', () => {
    expect(DEFAULT_EVENT_HANDLER_FORM).toBe('string-behavior');
    const canonical = '<button on:click="inc($event)">+</button>';
    expect(applyEventHandlerForm(canonical, 'string-behavior')).toBe(canonical);
  });

  it('function-prop renders the convenience spelling', () => {
    expect(applyEventHandlerForm('<button on:click="inc($event)">+</button>', 'function-prop')).toBe(
      '<button onclick={inc}>+</button>'
    );
  });
});
