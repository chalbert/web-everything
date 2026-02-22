/**
 * Unit tests for RouteViewElement.
 *
 * happy-dom does not have the Navigation API, so these tests exercise
 * the History API fallback path. Navigation API path is tested in
 * E2E tests (real browser).
 *
 * Note: happy-dom does NOT update window.location on history.replaceState.
 * Tests use navigate() for all navigation, and define a root "/" route
 * to match the initial URL (http://localhost/).
 */

import 'urlpattern-polyfill';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RouteViewElement from '../../../router/elements/RouteViewElement';
import InjectorRoot from '../../../../plugs/webinjectors/InjectorRoot';

// Register the custom element once
if (!customElements.get('route-view')) {
  customElements.define('route-view', RouteViewElement);
}

describe('RouteViewElement', () => {
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    document.body.innerHTML = '';
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('element creation', () => {
    it('should be a custom element', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      expect(el).toBeInstanceOf(RouteViewElement);
      expect(el).toBeInstanceOf(HTMLElement);
    });

    it('should have observed attributes', () => {
      expect(RouteViewElement.observedAttributes).toEqual([
        'scroll', 'base', 'transition', 'keep-alive',
      ]);
    });
  });

  describe('attribute getters', () => {
    it('should return scroll mode from attribute', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      expect(el.scroll).toBeNull();

      el.setAttribute('scroll', 'manual');
      expect(el.scroll).toBe('manual');
    });

    it('should return base path from attribute', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      expect(el.base).toBe('');

      el.setAttribute('base', '/app');
      expect(el.base).toBe('/app');
    });

    it('should return transition flag', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      expect(el.transition).toBe(false);

      el.setAttribute('transition', '');
      expect(el.transition).toBe(true);
    });

    it('should return keep-alive flag', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      expect(el.keepAlive).toBe(false);

      el.setAttribute('keep-alive', '');
      expect(el.keepAlive).toBe(true);
    });
  });

  describe('route parsing', () => {
    it('should parse child templates on connect', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/about"><p>About</p></template>
      `;
      document.body.appendChild(el);

      expect(el.routes).toHaveLength(2);
      expect(el.routes[0].path).toBe('/');
      expect(el.routes[1].path).toBe('/about');
    });

    it('should apply base to route patterns', () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.setAttribute('base', '/app');
      el.innerHTML = '<template route="/home"><p>Home</p></template>';
      document.body.appendChild(el);

      expect(el.routes[0].path).toBe('/app/home');
    });
  });

  describe('in-place rendering', () => {
    it('should stamp matched route content as children on initial load', async () => {
      // happy-dom starts at http://localhost/ so "/" matches
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p class="root-content">Welcome</p></template>
        <template route="/about"><p>About</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const stamped = el.querySelector('.root-content');
      expect(stamped).not.toBeNull();
      expect(stamped!.textContent).toBe('Welcome');
    });

    it('should set currentRoute after stamping', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = '<template route="/"><p>Root</p></template>';
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      expect(el.currentRoute).not.toBeNull();
      expect(el.currentRoute!.definition.path).toBe('/');
    });

    it('should unstamp previous content when navigating', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p class="root">Root</p></template>
        <template route="/about"><p class="about">About</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      expect(el.querySelector('.root')).not.toBeNull();

      await el.navigate('/about').finished;

      expect(el.querySelector('.root')).toBeNull();
      expect(el.querySelector('.about')).not.toBeNull();
    });

    it('should keep template elements inert', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = '<template route="/"><p>Root</p></template>';
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const templates = el.querySelectorAll('template[route]');
      expect(templates).toHaveLength(1);
    });
  });

  describe('programmatic navigation', () => {
    it('should navigate via navigate() method', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p class="root">Root</p></template>
        <template route="/about"><p class="about">About</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const result = el.navigate('/about');
      await result.finished;

      expect(el.querySelector('.about')).not.toBeNull();
      expect(el.currentRoute!.definition.path).toBe('/about');
    });

    it('should return NavigationResult with committed and finished promises', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = '<template route="/"><p>Root</p></template>';
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const result = el.navigate('/');
      expect(result.committed).toBeInstanceOf(Promise);
      expect(result.finished).toBeInstanceOf(Promise);

      await result.committed;
      await result.finished;
    });
  });

  describe('route params', () => {
    it('should extract params from URL', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/users/:id"><p class="user">User</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      await el.navigate('/users/42').finished;

      expect(el.currentRoute!.params).toEqual({ id: '42' });
    });

    it('should extract multiple params', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/users/:userId/posts/:postId"><p>Post</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      await el.navigate('/users/42/posts/7').finished;

      expect(el.currentRoute!.params).toEqual({ userId: '42', postId: '7' });
    });
  });

  describe('guards', () => {
    it('should run canActivate guard before stamping', async () => {
      const guard = vi.fn(() => true);

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { requireAuth: guard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/admin" route:guard="requireAuth"><p class="admin">Admin</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/admin').finished;

      expect(guard).toHaveBeenCalledTimes(1);
      expect(el.querySelector('.admin')).not.toBeNull();
    });

    it('should block navigation when canActivate guard returns false', async () => {
      const guard = vi.fn(() => false);

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { requireAuth: guard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p class="root">Root</p></template>
        <template route="/admin" route:guard="requireAuth"><p class="admin">Admin</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      expect(el.querySelector('.root')).not.toBeNull();

      await el.navigate('/admin').finished;

      // Should not stamp admin content
      expect(el.querySelector('.admin')).toBeNull();
      // Should stay on root route
      expect(el.currentRoute!.definition.path).toBe('/');
    });

    it('should redirect when canActivate guard returns a string', async () => {
      const guard = vi.fn(() => '/login');

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { requireAuth: guard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p class="root">Root</p></template>
        <template route="/admin" route:guard="requireAuth"><p class="admin">Admin</p></template>
        <template route="/login"><p class="login">Login</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/admin').finished;
      await new Promise(r => setTimeout(r, 50));

      expect(el.querySelector('.login')).not.toBeNull();
    });

    it('should run canDeactivate guard before leaving route', async () => {
      const guard = vi.fn(() => true);

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { confirmLeave: guard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/" route:guard:leave="confirmLeave"><p class="root">Root</p></template>
        <template route="/about"><p class="about">About</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/about').finished;

      expect(guard).toHaveBeenCalledTimes(1);
      expect(el.querySelector('.about')).not.toBeNull();
    });

    it('should block navigation when canDeactivate guard returns false', async () => {
      const guard = vi.fn(() => false);

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { confirmLeave: guard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/" route:guard:leave="confirmLeave"><p class="root">Root</p></template>
        <template route="/about"><p class="about">About</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      expect(el.querySelector('.root')).not.toBeNull();

      await el.navigate('/about').finished;

      // Should stay on root
      expect(el.querySelector('.root')).not.toBeNull();
      expect(el.querySelector('.about')).toBeNull();
    });
  });

  describe('loaders', () => {
    it('should run loader and stamp content', async () => {
      const loader = vi.fn(async () => ({ name: 'John' }));

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { loadUser: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/users/:id" route:loader="loadUser"><p class="user">User</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/users/42').finished;

      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: '42' },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(el.querySelector('.user')).not.toBeNull();
    });

    it('should set aria-busy during loading', async () => {
      let resolveLoader!: (value: unknown) => void;
      const loader = vi.fn(() => new Promise(r => { resolveLoader = r; }));

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { loadSlow: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/slow" route:loader="loadSlow"><p>Slow</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const navResult = el.navigate('/slow');
      await new Promise(r => setTimeout(r, 10));

      expect(el.getAttribute('aria-busy')).toBe('true');

      resolveLoader({ done: true });
      await navResult.finished;

      expect(el.getAttribute('aria-busy')).toBeNull();
    });

    it('should dispatch route-load-start and route-load-end events', async () => {
      const loader = vi.fn(async () => ({ data: true }));

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { load: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/data" route:loader="load"><p>Data</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const events: string[] = [];
      el.addEventListener('route-load-start', () => events.push('start'));
      el.addEventListener('route-load-end', () => events.push('end'));

      await el.navigate('/data').finished;

      expect(events).toEqual(['start', 'end']);
    });
  });

  describe('error boundaries', () => {
    it('should stamp error boundary when loader throws', async () => {
      const loader = vi.fn(async () => { throw new Error('Not found'); });

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { loadUser: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/users/:id" route:loader="loadUser"><p class="user">User</p></template>
        <template route="/users/:id" route:error><p class="error">Error occurred</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/users/999').finished;

      expect(el.querySelector('.user')).toBeNull();
      expect(el.querySelector('.error')).not.toBeNull();
    });

    it('should dispatch route-error event when loader throws', async () => {
      const loader = vi.fn(async () => { throw new Error('fail'); });

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { loadFail: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/fail" route:loader="loadFail"><p>Content</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const errors: Error[] = [];
      el.addEventListener('route-error', (e: any) => errors.push(e.detail.error));

      await el.navigate('/fail').finished;

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('fail');
    });
  });

  describe('route context injection', () => {
    it('should set customContexts:route on the element injector', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/users/:id"><p>User</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      await el.navigate('/users/42').finished;

      const context = InjectorRoot.getProviderOf(el, 'customContexts:route' as any);
      expect(context).toBeDefined();
      expect(context.params).toEqual({ id: '42' });
      expect(context.path).toBe('/users/42');
    });
  });

  describe('events', () => {
    it('should dispatch route-change event on navigation', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Root</p></template>
        <template route="/about"><p>About</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const changes: any[] = [];
      el.addEventListener('route-change', (e: any) => changes.push(e.detail));

      await el.navigate('/about').finished;

      expect(changes.length).toBeGreaterThanOrEqual(1);
      const lastChange = changes[changes.length - 1];
      expect(lastChange.matched.definition.path).toBe('/about');
    });
  });
});
