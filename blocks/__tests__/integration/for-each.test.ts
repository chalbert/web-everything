/**
 * Integration tests for the For-Each directive.
 *
 * Tests ForEachBehavior + InjectorRoot + text interpolation pipeline
 * working together: stamping a list from injector context and verifying
 * that {{@item.name}} resolves correctly through the injector chain.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import ForEachBehavior from '../../for-each/ForEachBehavior';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';
import CustomAttributeRegistry from '../../../plugs/webbehaviors/CustomAttributeRegistry';
import { CustomExpressionParserRegistry, CustomTextNodeParserRegistry, CustomTextNodeRegistry } from '../../../plugs/webexpressions';
import { ValueParser } from '../../parsers/value/ValueParser';
import { PipeParser } from '../../parsers/pipe/PipeParser';
import { DoubleCurlyBracketParser } from '../../parsers/text-node/double-curly/DoubleCurlyBracketParser';
import { InterpolationTextNode } from '../../text-nodes/interpolation/InterpolationTextNode';

describe('For-Each integration', () => {
  let injectorRoot: InjectorRoot;
  let attributes: CustomAttributeRegistry;

  beforeEach(() => {
    document.body.innerHTML = '';

    // Setup injector system
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);

    // Setup expression parser registry
    const expressionParsers = new CustomExpressionParserRegistry();
    expressionParsers.define('value', new ValueParser());
    expressionParsers.define('pipe', new PipeParser());

    // Setup text node parser registry
    const textNodeParsers = new CustomTextNodeParserRegistry();
    textNodeParsers.define('mustache', new DoubleCurlyBracketParser());

    // Setup text node registry
    const textNodes = new CustomTextNodeRegistry();
    textNodes.define('mustache', InterpolationTextNode);

    // Provide all registries on the document injector
    const docInjector = injectorRoot.getInjectorOf(document);
    docInjector?.set('customExpressionParsers', expressionParsers);
    docInjector?.set('customTextNodeParsers', textNodeParsers);
    docInjector?.set('customTextNodes', textNodes);

    // Setup attribute registry
    attributes = new CustomAttributeRegistry();
    attributes.define('for-each', ForEachBehavior);
  });

  afterEach(() => {
    injectorRoot.detach(document);
    document.body.innerHTML = '';
  });

  it('should stamp list items from injector context', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Provide data context
    const injector = injectorRoot.ensureInjector(container);
    injector.set('customContexts:data', [
      { name: 'Alice', role: 'Admin' },
      { name: 'Bob', role: 'User' },
      { name: 'Carol', role: 'Moderator' },
    ]);

    // Create template
    const template = document.createElement('template');
    template.innerHTML = '<div class="user-card"><span class="name"></span></div>';
    container.appendChild(template);

    // Create and connect for-each
    const behavior = new ForEachBehavior({ name: 'for-each', value: '@data as user' });
    behavior.attach(template);
    behavior.isConnected = true;
    behavior.connectedCallback?.();

    // Verify 3 items stamped
    const cards = container.querySelectorAll('.user-card');
    expect(cards.length).toBe(3);
  });

  it('should set correct context on each stamped item', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const injector = injectorRoot.ensureInjector(container);
    injector.set('customContexts:data', users);

    const template = document.createElement('template');
    template.innerHTML = '<div class="row"></div>';
    container.appendChild(template);

    const behavior = new ForEachBehavior({ name: 'for-each', value: '@data as user' });
    behavior.attach(template);
    behavior.isConnected = true;
    behavior.connectedCallback?.();

    const rows = container.querySelectorAll('.row');

    // Verify context resolution from the injector chain
    const row0Context = InjectorRoot.getProviderOf(rows[0], 'customContexts:user' as any);
    expect(row0Context).toEqual({ id: 1, name: 'Alice' });

    const row1Context = InjectorRoot.getProviderOf(rows[1], 'customContexts:user' as any);
    expect(row1Context).toEqual({ id: 2, name: 'Bob' });
  });

  it('should resolve nested context paths', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const injector = injectorRoot.ensureInjector(container);
    injector.set('customContexts:route', {
      data: {
        items: [{ title: 'First' }, { title: 'Second' }],
      },
    });

    const template = document.createElement('template');
    template.innerHTML = '<div class="item"></div>';
    container.appendChild(template);

    const behavior = new ForEachBehavior({
      name: 'for-each',
      value: '@route.data.items as item',
    });
    behavior.attach(template);
    behavior.isConnected = true;
    behavior.connectedCallback?.();

    expect(container.querySelectorAll('.item').length).toBe(2);
  });

  it('should allow parent context to be accessible from stamped items', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Set both a parent context and the list context
    const injector = injectorRoot.ensureInjector(container);
    injector.set('customContexts:theme', { primary: 'blue' });
    injector.set('customContexts:data', [{ name: 'Alice' }]);

    const template = document.createElement('template');
    template.innerHTML = '<div class="row"></div>';
    container.appendChild(template);

    const behavior = new ForEachBehavior({ name: 'for-each', value: '@data as item' });
    behavior.attach(template);
    behavior.isConnected = true;
    behavior.connectedCallback?.();

    const row = container.querySelector('.row')!;

    // Stamped items should be able to access parent context via injector chain
    const themeContext = InjectorRoot.getProviderOf(row, 'customContexts:theme' as any);
    expect(themeContext).toEqual({ primary: 'blue' });

    // And their own context
    const itemContext = InjectorRoot.getProviderOf(row, 'customContexts:item' as any);
    expect(itemContext).toEqual({ name: 'Alice' });
  });

  it('should clean up completely on disconnect', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const injector = injectorRoot.ensureInjector(container);
    injector.set('customContexts:data', [1, 2, 3]);

    const template = document.createElement('template');
    template.innerHTML = '<div class="item"></div>';
    container.appendChild(template);

    const behavior = new ForEachBehavior({ name: 'for-each', value: '@data as item' });
    behavior.attach(template);
    behavior.isConnected = true;
    behavior.connectedCallback?.();

    expect(container.querySelectorAll('.item').length).toBe(3);

    // Disconnect
    behavior.disconnectedCallback?.();

    expect(container.querySelectorAll('.item').length).toBe(0);

    // Verify no comment markers remain
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
    const comments: Comment[] = [];
    while (walker.nextNode()) {
      comments.push(walker.currentNode as Comment);
    }
    expect(comments.length).toBe(0);
  });

  it('should work with multiple for-each on the same page', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const injector = injectorRoot.ensureInjector(container);
    injector.set('customContexts:fruits', ['Apple', 'Banana']);
    injector.set('customContexts:colors', ['Red', 'Blue', 'Green']);

    // First for-each
    const template1 = document.createElement('template');
    template1.innerHTML = '<li class="fruit"></li>';
    container.appendChild(template1);

    const behavior1 = new ForEachBehavior({ name: 'for-each', value: '@fruits as fruit' });
    behavior1.attach(template1);
    behavior1.isConnected = true;
    behavior1.connectedCallback?.();

    // Second for-each
    const template2 = document.createElement('template');
    template2.innerHTML = '<li class="color"></li>';
    container.appendChild(template2);

    const behavior2 = new ForEachBehavior({ name: 'for-each', value: '@colors as color' });
    behavior2.attach(template2);
    behavior2.isConnected = true;
    behavior2.connectedCallback?.();

    expect(container.querySelectorAll('.fruit').length).toBe(2);
    expect(container.querySelectorAll('.color').length).toBe(3);
  });
});
