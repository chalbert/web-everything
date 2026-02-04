/**
 * Integration tests for on-event attribute block
 *
 * Tests the attribute working with the parser registry and injector system.
 * All context (handlers, state, named contexts) is provided via the injector chain.
 * Uses happy-dom which is configured as the vitest environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the blocks
import {
  createOnEventAttribute,
  MissingParsersError,
} from '../../attributes/on-event/OnEventAttribute';

// Import new composable parsers
import { CallParser } from '../../parsers/call/CallParser';
import { ValueParser } from '../../parsers/value/ValueParser';
import { PipeParser } from '../../parsers/pipe/PipeParser';

// Import plugs
import CustomAttribute from '../../../plugs/webbehaviors/CustomAttribute';
import CustomAttributeRegistry from '../../../plugs/webbehaviors/CustomAttributeRegistry';
import { CustomExpressionParserRegistry } from '../../../plugs/webexpressions';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';

describe('on-event attribute integration', () => {
  let injectorRoot: InjectorRoot;
  let attributes: CustomAttributeRegistry;
  let parsers: CustomExpressionParserRegistry;

  beforeEach(() => {
    // Clear document body
    document.body.innerHTML = '';

    // Setup injector system
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);

    // Setup parser registry with composable parsers
    parsers = new CustomExpressionParserRegistry();
    parsers.define('call', new CallParser());
    parsers.define('value', new ValueParser());
    parsers.define('pipe', new PipeParser());

    // Set parser registry on document injector
    const docInjector = injectorRoot.getInjectorOf(document);
    docInjector?.set('customExpressionParsers', parsers);

    // Setup attribute registry
    attributes = new CustomAttributeRegistry();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createOnEventAttribute', () => {
    it('should create an attribute class', () => {
      const OnClick = createOnEventAttribute();

      expect(OnClick).toBeDefined();
      expect(OnClick.prototype).toBeInstanceOf(CustomAttribute);
    });
  });

  describe('event handling with manual attribute instantiation', () => {
    it('should call handler on event when manually wired', () => {
      const clickHandler = vi.fn();

      // Provide handlers via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { click: clickHandler });

      const OnClick = createOnEventAttribute();

      // Create element
      const button = document.createElement('button');
      button.setAttribute('on:click', 'click($event)');
      document.body.appendChild(button);

      // Manually create and connect the attribute instance
      const attrInstance = new OnClick({ name: 'on:click', value: 'click($event)' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      // Dispatch event
      const event = new MouseEvent('click', { bubbles: true });
      button.dispatchEvent(event);

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(event);
    });

    it('should pass multiple arguments to handler', () => {
      const deleteHandler = vi.fn();

      // Provide handlers and context via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { deleteItem: deleteHandler });
      docInjector?.set('customContexts:item', { id: 123, name: 'test' });

      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'deleteItem($event, @item.id)');
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'deleteItem($event, @item.id)' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true });
      button.dispatchEvent(event);

      expect(deleteHandler).toHaveBeenCalledWith(event, 123);
    });

    it('should resolve state values', () => {
      const handler = vi.fn();

      // Provide handlers and state via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { update: handler });
      docInjector?.set('customContexts:state', { count: 42 });

      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'update(count)');
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'update(count)' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true });
      button.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith(42);
    });

    it('should handle handler without parens', () => {
      const handler = vi.fn();

      // Provide handlers via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { simple: handler });

      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'simple');
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'simple' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true });
      button.dispatchEvent(event);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('event types', () => {
    it('should extract event type from attribute name', () => {
      const submitHandler = vi.fn((e) => e.preventDefault());

      // Provide handlers via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { handle: submitHandler });

      const OnSubmit = createOnEventAttribute();

      const form = document.createElement('form');
      form.setAttribute('on:submit', 'handle($event)');
      document.body.appendChild(form);

      const attrInstance = new OnSubmit({ name: 'on:submit', value: 'handle($event)' });
      attrInstance.attach(form);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      expect(submitHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle on:change', () => {
      const changeHandler = vi.fn();

      // Provide handlers via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { onChange: changeHandler });

      const OnChange = createOnEventAttribute();

      const input = document.createElement('input');
      input.setAttribute('on:change', 'onChange($event)');
      document.body.appendChild(input);

      const attrInstance = new OnChange({ name: 'on:change', value: 'onChange($event)' });
      attrInstance.attach(input);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      const event = new Event('change', { bubbles: true });
      input.dispatchEvent(event);

      expect(changeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnection', () => {
    it('should remove event listener on disconnect', () => {
      const handler = vi.fn();

      // Provide handlers via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', { click: handler });

      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'click($event)');
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'click($event)' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      // Disconnect
      attrInstance.disconnectedCallback?.();
      attrInstance.isConnected = false;

      // Try to dispatch - should not call handler
      const event = new MouseEvent('click', { bubbles: true });
      button.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw MissingParsersError when no parsers provided', () => {
      // Create a fresh injector without parsers
      const freshInjectorRoot = new InjectorRoot();
      freshInjectorRoot.attach(document);

      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'click($event)');
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'click($event)' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;

      expect(() => {
        attrInstance.connectedCallback?.();
      }).toThrow(MissingParsersError);
    });

    it('should log error for unparseable expression', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'invalid(syntax'); // Missing closing paren
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'invalid(syntax' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse expression'),
      );

      consoleError.mockRestore();
    });
  });

  describe('pipe expressions', () => {
    it('should apply filter to value', () => {
      const uppercaseFilter = vi.fn((value: string) => value.toUpperCase());

      // Provide handlers and filters via injector system
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:handlers', {});
      docInjector?.set('customContexts:filters', { uppercase: uppercaseFilter });
      docInjector?.set('customContexts:state', { name: 'hello' });

      const OnClick = createOnEventAttribute();

      const button = document.createElement('button');
      button.setAttribute('on:click', 'name | uppercase');
      document.body.appendChild(button);

      const attrInstance = new OnClick({ name: 'on:click', value: 'name | uppercase' });
      attrInstance.attach(button);
      attrInstance.isConnected = true;
      attrInstance.connectedCallback?.();

      const event = new MouseEvent('click', { bubbles: true });
      button.dispatchEvent(event);

      expect(uppercaseFilter).toHaveBeenCalledWith('hello');
    });
  });
});
