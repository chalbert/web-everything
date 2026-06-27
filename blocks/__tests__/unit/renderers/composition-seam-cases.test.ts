/**
 * Structural lock for the four sanctioned HTML-first composition seams (#1834, ratified #1795 / rule
 * `we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract`).
 *
 * WE owns the seam *catalog* only (build-agnostic authoring forms + the add-only annotation); the
 * runtimes live in FUI. This test guards the catalog's invariants so the demo and FUI's conformance run
 * can't drift from the ruling: the support-all set is exactly the four strategies, sub-component
 * replacement stays marked blocked-on the webregistries re-home, and every first-class seam is annotated
 * add-only (never an override). It does NOT execute a runtime — composed-tuple verification is downstream.
 */
import { describe, it, expect } from 'vitest';
import {
  compositionBaseDef,
  compositionSeamCases,
  compositionRejectedExample,
  type CompositionStrategy,
} from '../../../renderers/composition/__fixtures__/composition-seam-cases';

describe('composition seam catalog (#1834 / #1795)', () => {
  it('ships exactly the four sanctioned add-only strategies (support-all set)', () => {
    const strategies = new Set<CompositionStrategy>(compositionSeamCases.map((c) => c.strategy));
    expect([...strategies].sort()).toEqual(
      ['abstract-split', 'decoration', 'scoped-replace', 'slots'].sort(),
    );
    expect(compositionSeamCases).toHaveLength(4);
  });

  it('single-sources the a11y contract on one base block (the <a> lives there, once)', () => {
    expect(compositionBaseDef).toContain('name="nav-item"');
    // The base owns the anchor + the add-only slot injection points.
    expect(compositionBaseDef).toContain('<a part="link">');
    expect(compositionBaseDef).toMatch(/<slot name="icon">/);
    expect(compositionBaseDef).toMatch(/<slot name="badge">/);
  });

  it('marks sub-component replacement sanctioned-but-blocked on the webregistries FUI re-home', () => {
    const scoped = compositionSeamCases.find((c) => c.strategy === 'scoped-replace');
    expect(scoped).toBeDefined();
    expect(scoped!.runtime).toBe('blocked-on-webregistries-rehome');
    expect(scoped!.tier).toBe('first-class');
  });

  it('treats abstract-piece split as a userland convention with no WE primitive', () => {
    const split = compositionSeamCases.find((c) => c.strategy === 'abstract-split');
    expect(split!.tier).toBe('userland-convention');
    // It composes new tags, so it adds nothing to an *existing* base's surface.
    expect(split!.addsToA11y).toBeNull();
  });

  it('annotates every first-class seam add-only (extends the a11y surface, never overrides)', () => {
    for (const c of compositionSeamCases.filter((s) => s.tier === 'first-class')) {
      expect(c.addsToA11y, `${c.id} must state its a11y effect`).toBeTruthy();
      // Non-destructive: the seam must either ADD to the surface or PRESERVE it — never override/remove.
      expect(c.addsToA11y!.toLowerCase()).toMatch(/add|preserve/);
    }
  });

  it('keeps the rejected as="menubar" contrast example (trips the actual fork test)', () => {
    expect(compositionRejectedExample.usage).toContain('as="menubar"');
    expect(compositionRejectedExample.reason.toLowerCase()).toContain('role=menuitem');
  });
});
