/**
 * Unit test for the CustomContext.claim() negotiation hook (#1115, webcontexts completion #1091).
 * Proves the base claims everything (most-flexible default) and a subclass narrows ownership by
 * inspecting the query expression — the selective-resolution example from the webcontexts spec.
 */
import { describe, it, expect } from 'vitest';
import CustomContext, { type ContextQuery } from '../CustomContext';

describe('CustomContext.claim() (negotiation hook)', () => {
  it('the base claims everything by default (most-flexible-default)', () => {
    class PlainContext extends CustomContext<{ value: string }> {
      initialValue = { value: 'x' };
    }
    const ctx = new PlainContext();
    expect(ctx.claim({ expression: 'anything.at.all' })).toBe(true);
    expect(ctx.claim({ expression: null })).toBe(true);
    expect(ctx.claim({})).toBe(true);
  });

  it('a subclass narrows ownership by query expression (declines non-matching)', () => {
    class UserContext extends CustomContext<{ name: string }> {
      initialValue = { name: 'ada' };
      override claim(query: ContextQuery): boolean {
        return !!query.expression && (query.expression.startsWith('user.') || query.expression.startsWith('currentUser.'));
      }
    }
    const ctx = new UserContext();
    expect(ctx.claim({ expression: 'user.name' })).toBe(true);
    expect(ctx.claim({ expression: 'currentUser.id' })).toBe(true);
    expect(ctx.claim({ expression: 'app.theme' })).toBe(false);
    expect(ctx.claim({ expression: null })).toBe(false);
  });

  it('a fallback context can claim by key presence (the spec AppStateContext pattern)', () => {
    class AppStateContext extends CustomContext<{ theme: string }> {
      initialValue = { theme: 'dark' };
      override claim(query: ContextQuery): boolean {
        const root = query.expression?.split('.')[0] as keyof { theme: string } | undefined;
        return root !== undefined && this.has(root);
      }
    }
    const ctx = new AppStateContext();
    expect(ctx.claim({ expression: 'theme.shade' })).toBe(true);
    expect(ctx.claim({ expression: 'missing.key' })).toBe(false);
  });
});
