/**
 * Integration tests for the Router block.
 *
 * Tests the full navigation flow with:
 * - InjectorRoot for dependency injection
 * - RouteViewElement for route orchestration
 * - RouteOutletElement for named auxiliary views
 * - Guards and loaders resolved from customContexts
 * - RouteLinkBehavior for navigation links
 *
 * Uses happy-dom (History API fallback path).
 */

import 'urlpattern-polyfill';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import router block
import RouteViewElement from '../../router/elements/RouteViewElement';
import RouteOutletElement from '../../router/elements/RouteOutletElement';
import RouteLinkBehavior from '../../router/behaviors/RouteLinkBehavior';

// Import plugs
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';
import CustomAttributeRegistry from '../../../plugs/webbehaviors/CustomAttributeRegistry';

// Register custom elements once
if (!customElements.get('route-view')) {
  customElements.define('route-view', RouteViewElement);
}
if (!customElements.get('route-outlet')) {
  customElements.define('route-outlet', RouteOutletElement);
}

describe('Router integration', () => {
  let injectorRoot: InjectorRoot;
  let attributes: CustomAttributeRegistry;

  beforeEach(() => {
    document.body.innerHTML = '';
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
    attributes = new CustomAttributeRegistry();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('full navigation flow', () => {
    it('should navigate between routes with in-place rendering', async () => {
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><h1 class="home">Home Page</h1></template>
        <template route="/about"><h1 class="about">About Page</h1></template>
        <template route="/contact"><h1 class="contact">Contact Page</h1></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      expect(el.querySelector('.home')).not.toBeNull();

      // Navigate to about
      await el.navigate('/about').finished;
      expect(el.querySelector('.home')).toBeNull();
      expect(el.querySelector('.about')).not.toBeNull();

      // Navigate to contact
      await el.navigate('/contact').finished;
      expect(el.querySelector('.about')).toBeNull();
      expect(el.querySelector('.contact')).not.toBeNull();
    });
  });

  describe('guards + loaders + context', () => {
    it('should run guard → loader → stamp with context pipeline', async () => {
      const guard = vi.fn(() => true);
      const loader = vi.fn(async ({ params }: any) => ({
        name: `User ${params.id}`,
      }));

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { requireAuth: guard });
      docInjector?.set('customContexts:routeLoader', { loadUser: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Home</p></template>
        <template route="/users/:id" route:guard="requireAuth" route:loader="loadUser">
          <p class="user">User Profile</p>
        </template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/users/42').finished;

      // Guard was called
      expect(guard).toHaveBeenCalledTimes(1);
      expect(guard).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/users/42', params: { id: '42' } }),
        expect.anything(),
      );

      // Loader was called
      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: '42' } }),
      );

      // Content was stamped
      expect(el.querySelector('.user')).not.toBeNull();

      // Route context was set
      const context = InjectorRoot.getProviderOf(el, 'customContexts:route' as any);
      expect(context).toBeDefined();
      expect(context.params).toEqual({ id: '42' });
      expect(context.data).toEqual({ name: 'User 42' });
      expect(context.error).toBeNull();
    });
  });

  describe('canDeactivate guard blocks navigation', () => {
    it('should prevent leaving when guard returns false', async () => {
      const leaveGuard = vi.fn(() => false);

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { confirmLeave: leaveGuard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/" route:guard:leave="confirmLeave">
          <p class="editor">Editor</p>
        </template>
        <template route="/home"><p class="home">Home</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));
      expect(el.querySelector('.editor')).not.toBeNull();

      await el.navigate('/home').finished;

      // Should stay on editor
      expect(el.querySelector('.editor')).not.toBeNull();
      expect(el.querySelector('.home')).toBeNull();
      expect(leaveGuard).toHaveBeenCalledTimes(1);
    });
  });

  describe('canActivate guard redirects', () => {
    it('should redirect when guard returns a path string', async () => {
      const guard = vi.fn(() => '/login');

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeGuard', { requireAuth: guard });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p class="home">Home</p></template>
        <template route="/admin" route:guard="requireAuth">
          <p class="admin">Admin</p>
        </template>
        <template route="/login"><p class="login">Login Page</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/admin').finished;
      // Give time for the redirect chain
      await new Promise(r => setTimeout(r, 50));

      // Should be on login, not admin
      expect(el.querySelector('.admin')).toBeNull();
      expect(el.querySelector('.login')).not.toBeNull();
    });
  });

  describe('loader error → error boundary', () => {
    it('should stamp error boundary when loader throws', async () => {
      const loader = vi.fn(async () => {
        throw new Error('User not found');
      });

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { loadUser: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Home</p></template>
        <template route="/users/:id" route:loader="loadUser">
          <p class="user">User Profile</p>
        </template>
        <template route="/users/:id" route:error>
          <p class="error">User not found</p>
        </template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      await el.navigate('/users/999').finished;

      expect(el.querySelector('.user')).toBeNull();
      expect(el.querySelector('.error')).not.toBeNull();

      // Context should have the error
      const context = InjectorRoot.getProviderOf(el, 'customContexts:route' as any);
      expect(context.error).toBeInstanceOf(Error);
      expect(context.error.message).toBe('User not found');
    });
  });

  describe('named outlets', () => {
    it('should stamp content into named outlet', async () => {
      // Create the named outlet
      const outlet = document.createElement('route-outlet') as RouteOutletElement;
      outlet.setAttribute('name', 'sidebar');
      document.body.appendChild(outlet);

      // Create the route view
      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/">
          <p class="main">Main Content</p>
        </template>
        <template route="/" route:outlet="sidebar">
          <nav class="sidebar-nav">Dashboard Nav</nav>
        </template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      // Main content should be in route-view
      expect(el.querySelector('.main')).not.toBeNull();

      // Sidebar content should be in the outlet
      expect(outlet.querySelector('.sidebar-nav')).not.toBeNull();
    });
  });

  describe('link behavior', () => {
    it('should set active class on matching link', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('route:link', '/');
      document.body.appendChild(anchor);

      const behavior = new RouteLinkBehavior({ name: 'route:link', value: '/' });
      behavior.attach(anchor);
      behavior.isConnected = true;
      behavior.connectedCallback?.();

      // happy-dom starts at "/" so this should be active
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('should not set active class on non-matching link', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('route:link', '/other');
      document.body.appendChild(anchor);

      const behavior = new RouteLinkBehavior({ name: 'route:link', value: '/other' });
      behavior.attach(anchor);
      behavior.isConnected = true;
      behavior.connectedCallback?.();

      expect(anchor.classList.contains('active')).toBe(false);
    });
  });

  describe('event flow', () => {
    it('should dispatch events in order during navigation', async () => {
      const loader = vi.fn(async () => ({ data: true }));

      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:routeLoader', { load: loader });

      const el = document.createElement('route-view') as RouteViewElement;
      el.innerHTML = `
        <template route="/"><p>Home</p></template>
        <template route="/data" route:loader="load"><p>Data</p></template>
      `;
      document.body.appendChild(el);

      await new Promise(r => setTimeout(r, 10));

      const events: string[] = [];
      el.addEventListener('route-load-start', () => events.push('load-start'));
      el.addEventListener('route-load-end', () => events.push('load-end'));
      el.addEventListener('route-change', () => events.push('change'));

      await el.navigate('/data').finished;

      // Stamp happens before events: load-start → change → load-end
      expect(events).toEqual(['load-start', 'change', 'load-end']);
    });
  });
});
