/**
 * Unit tests for Router types and helper functions.
 *
 * Tests parseRouteDefinitions, matchRoute, findErrorBoundary,
 * buildNavigationTarget, and buildRouteContext.
 */

import 'urlpattern-polyfill';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseRouteDefinitions,
  matchRoute,
  findErrorBoundary,
  buildNavigationTarget,
  buildRouteContext,
} from '../../../router/types';
import type { MatchedRoute } from '../../../router/types';

describe('parseRouteDefinitions', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should parse a single template with route attribute', () => {
    container.innerHTML = '<template route="/home"><p>Home</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs).toHaveLength(1);
    expect(defs[0].path).toBe('/home');
    expect(defs[0].pattern).toBeInstanceOf(URLPattern);
    expect(defs[0].guard).toBeUndefined();
    expect(defs[0].loader).toBeUndefined();
    expect(defs[0].outlet).toBeUndefined();
    expect(defs[0].isErrorBoundary).toBe(false);
  });

  it('should parse multiple templates in order', () => {
    container.innerHTML = `
      <template route="/home"><p>Home</p></template>
      <template route="/about"><p>About</p></template>
      <template route="/contact"><p>Contact</p></template>
    `;
    const defs = parseRouteDefinitions(container);

    expect(defs).toHaveLength(3);
    expect(defs[0].path).toBe('/home');
    expect(defs[1].path).toBe('/about');
    expect(defs[2].path).toBe('/contact');
  });

  it('should parse route:guard attribute', () => {
    container.innerHTML = '<template route="/admin" route:guard="requireAuth"><p>Admin</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].guard).toBe('requireAuth');
  });

  it('should parse route:guard:leave attribute', () => {
    container.innerHTML = '<template route="/editor" route:guard:leave="confirmUnsaved"><p>Editor</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].guardLeave).toBe('confirmUnsaved');
  });

  it('should parse route:loader attribute', () => {
    container.innerHTML = '<template route="/users/:id" route:loader="loadUser"><p>User</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].loader).toBe('loadUser');
  });

  it('should parse route:outlet attribute', () => {
    container.innerHTML = '<template route="/dashboard" route:outlet="sidebar"><nav>Nav</nav></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].outlet).toBe('sidebar');
  });

  it('should detect route:error boolean attribute', () => {
    container.innerHTML = '<template route="/users/:id" route:error><p>Error</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].isErrorBoundary).toBe(true);
  });

  it('should parse all attributes together', () => {
    container.innerHTML = `
      <template route="/admin"
                route:guard="requireAuth"
                route:guard:leave="confirmLeave"
                route:loader="loadAdmin"
                route:outlet="main">
        <p>Admin</p>
      </template>
    `;
    const defs = parseRouteDefinitions(container);

    expect(defs[0].guard).toBe('requireAuth');
    expect(defs[0].guardLeave).toBe('confirmLeave');
    expect(defs[0].loader).toBe('loadAdmin');
    expect(defs[0].outlet).toBe('main');
    expect(defs[0].isErrorBoundary).toBe(false);
  });

  it('should skip templates without route attribute', () => {
    container.innerHTML = `
      <template route="/home"><p>Home</p></template>
      <template><p>Not a route</p></template>
      <template route="/about"><p>About</p></template>
    `;
    const defs = parseRouteDefinitions(container);

    expect(defs).toHaveLength(2);
    expect(defs[0].path).toBe('/home');
    expect(defs[1].path).toBe('/about');
  });

  it('should apply base path to patterns', () => {
    container.innerHTML = '<template route="/users"><p>Users</p></template>';
    const defs = parseRouteDefinitions(container, '/app');

    expect(defs[0].path).toBe('/app/users');
  });

  it('should normalize double slashes with base path', () => {
    container.innerHTML = '<template route="/users"><p>Users</p></template>';
    const defs = parseRouteDefinitions(container, '/app/');

    expect(defs[0].path).toBe('/app/users');
  });

  it('should handle route patterns with params', () => {
    container.innerHTML = '<template route="/users/:id"><p>User</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].path).toBe('/users/:id');
    expect(defs[0].pattern).toBeInstanceOf(URLPattern);
  });

  it('should handle wildcard patterns', () => {
    container.innerHTML = '<template route="/files/*"><p>Files</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].path).toBe('/files/*');
  });

  it('should store reference to source template element', () => {
    container.innerHTML = '<template route="/home"><p>Home</p></template>';
    const defs = parseRouteDefinitions(container);

    expect(defs[0].template).toBeInstanceOf(HTMLTemplateElement);
    expect(defs[0].template.content.querySelector('p')?.textContent).toBe('Home');
  });
});

describe('matchRoute', () => {
  function createDefs(container: HTMLElement) {
    return parseRouteDefinitions(container);
  }

  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should match an exact path', () => {
    container.innerHTML = '<template route="/home"><p>Home</p></template>';
    const defs = createDefs(container);

    const url = new URL('http://localhost/home');
    const result = matchRoute(url, defs);

    expect(result).not.toBeNull();
    expect(result!.definition.path).toBe('/home');
    expect(result!.params).toEqual({});
  });

  it('should match a path with params', () => {
    container.innerHTML = '<template route="/users/:id"><p>User</p></template>';
    const defs = createDefs(container);

    const url = new URL('http://localhost/users/123');
    const result = matchRoute(url, defs);

    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: '123' });
  });

  it('should match a path with multiple params', () => {
    container.innerHTML = '<template route="/users/:userId/posts/:postId"><p>Post</p></template>';
    const defs = createDefs(container);

    const url = new URL('http://localhost/users/42/posts/7');
    const result = matchRoute(url, defs);

    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ userId: '42', postId: '7' });
  });

  it('should return first match in order', () => {
    container.innerHTML = `
      <template route="/users/:id"><p>Specific</p></template>
      <template route="/users/*"><p>Catch-all</p></template>
    `;
    const defs = createDefs(container);

    const url = new URL('http://localhost/users/123');
    const result = matchRoute(url, defs);

    expect(result!.definition.template.content.querySelector('p')?.textContent).toBe('Specific');
  });

  it('should return null for no match', () => {
    container.innerHTML = '<template route="/home"><p>Home</p></template>';
    const defs = createDefs(container);

    const url = new URL('http://localhost/about');
    const result = matchRoute(url, defs);

    expect(result).toBeNull();
  });

  it('should skip error boundary templates', () => {
    container.innerHTML = `
      <template route="/users/:id"><p>User</p></template>
      <template route="/users/:id" route:error><p>Error</p></template>
    `;
    const defs = createDefs(container);

    const url = new URL('http://localhost/users/123');
    const result = matchRoute(url, defs);

    expect(result!.definition.isErrorBoundary).toBe(false);
    expect(result!.definition.template.content.querySelector('p')?.textContent).toBe('User');
  });

  it('should include the URL in the result', () => {
    container.innerHTML = '<template route="/home"><p>Home</p></template>';
    const defs = createDefs(container);

    const url = new URL('http://localhost/home?tab=1#section');
    const result = matchRoute(url, defs);

    expect(result!.url).toBe(url);
  });
});

describe('findErrorBoundary', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should find error boundary for a route', () => {
    container.innerHTML = `
      <template route="/users/:id"><p>User</p></template>
      <template route="/users/:id" route:error><p>Error</p></template>
    `;
    const defs = parseRouteDefinitions(container);

    const boundary = findErrorBoundary('/users/:id', defs);
    expect(boundary).toBeDefined();
    expect(boundary!.isErrorBoundary).toBe(true);
  });

  it('should return undefined when no error boundary exists', () => {
    container.innerHTML = '<template route="/home"><p>Home</p></template>';
    const defs = parseRouteDefinitions(container);

    const boundary = findErrorBoundary('/home', defs);
    expect(boundary).toBeUndefined();
  });
});

describe('buildNavigationTarget', () => {
  it('should build a target from a matched route', () => {
    const matched: MatchedRoute = {
      definition: {} as any,
      params: { id: '42' },
      url: new URL('http://localhost/users/42?tab=posts#bio'),
    };

    const target = buildNavigationTarget(matched, 'push');

    expect(target.url).toBe(matched.url);
    expect(target.path).toBe('/users/42');
    expect(target.params).toEqual({ id: '42' });
    expect(target.query.get('tab')).toBe('posts');
    expect(target.hash).toBe('bio');
    expect(target.navigationType).toBe('push');
  });
});

describe('buildRouteContext', () => {
  it('should build a route context', () => {
    const matched: MatchedRoute = {
      definition: {} as any,
      params: { id: '42' },
      url: new URL('http://localhost/users/42?tab=posts#bio'),
    };

    const context = buildRouteContext(matched, { name: 'John' }, null, { from: 'nav' });

    expect(context.params).toEqual({ id: '42' });
    expect(context.data).toEqual({ name: 'John' });
    expect(context.error).toBeNull();
    expect(context.path).toBe('/users/42');
    expect(context.query.get('tab')).toBe('posts');
    expect(context.hash).toBe('bio');
    expect(context.state).toEqual({ from: 'nav' });
  });

  it('should build context with error', () => {
    const matched: MatchedRoute = {
      definition: {} as any,
      params: {},
      url: new URL('http://localhost/broken'),
    };
    const err = new Error('failed');

    const context = buildRouteContext(matched, undefined, err);

    expect(context.data).toBeUndefined();
    expect(context.error).toBe(err);
  });

  it('should use defaults for optional params', () => {
    const matched: MatchedRoute = {
      definition: {} as any,
      params: {},
      url: new URL('http://localhost/home'),
    };

    const context = buildRouteContext(matched);

    expect(context.data).toBeUndefined();
    expect(context.error).toBeNull();
    expect(context.state).toBeNull();
  });
});
