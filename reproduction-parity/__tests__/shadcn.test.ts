/**
 * First reproduction-conformance target — shadcn/ui (#1243, epic #1226, charter #1225). Proves the WE-side
 * foundational harness end to end: the theme pack resolves + gates through the webtheme runtime, the seed
 * targets + intent map are well-formed, the gap list (the deliverable) is typed and non-empty, and the
 * Plateau→WE verdict ingestion loop rolls up + conformance-checks readings without ever fabricating a
 * parity claim.
 */
import { describe, it, expect } from 'vitest';
// #1910: webtheme runtime relocated to fui:webtheme (impl→FUI, per #1282) — resolve via the alias.
import { flattenTokens, resolveTokens } from '@frontierui/webtheme';
import { SHADCN_TOKENS, shadcnTheme, shadcnTokens, buildShadcnScheme } from '../shadcn/theme';
import {
  SHADCN_COMPONENTS,
  SHADCN_TARGETS,
  INTENT_MAP,
  SHADCN_GAPS,
  assertVerdictGating,
  buildShadcnReport,
  targetKey,
} from '../shadcn/reproduction';
import type { ReproductionVerdict } from '../contract';

describe('shadcn theme pack', () => {
  it('extends the platform default with shadcn scheme anchors + accent seed', () => {
    const resolved = resolveTokens(flattenTokens(shadcnTokens));
    const byPath = new Map(resolved.map((t) => [t.path.join('.'), t.resolved]));
    expect(byPath.get('color.bg-light')).toBe(SHADCN_TOKENS.light.background);
    expect(byPath.get('color.bg-dark')).toBe(SHADCN_TOKENS.dark.background);
    expect(byPath.get('color.accent')).toBe(SHADCN_TOKENS.light.primary);
    // Inherited from the platform default (proves `extends`, not from-scratch).
    expect(byPath.get('space.4')).toBe('1rem');
  });

  it('pins shadcn base radius and tracks it through the button component token', () => {
    const resolved = resolveTokens(flattenTokens(shadcnTokens));
    const byPath = new Map(resolved.map((t) => [t.path.join('.'), t]));
    expect(byPath.get('radius.md')?.resolved).toBe(SHADCN_TOKENS.radius);
    // button.radius aliases radius.md, so it provably tracks the pinned base.
    expect(byPath.get('button.radius')?.aliasOf).toBe('radius.md');
    expect(byPath.get('button.radius')?.resolved).toBe(SHADCN_TOKENS.radius);
    // button.bg aliases the accent seed (shadcn's filled primary surface).
    expect(byPath.get('button.bg')?.aliasOf).toBe('color.accent');
  });

  it('builds a contrast-gated scheme runtime from the neutral primary seed', () => {
    const runtime = buildShadcnScheme();
    expect(runtime.scheme.bg).toBe(`light-dark(${SHADCN_TOKENS.light.background}, ${SHADCN_TOKENS.dark.background})`);
    expect(runtime.accent.length).toBeGreaterThan(0);
    // Every accent step was validated against both scheme backgrounds (the gate ran).
    expect(runtime.validation.length).toBe(runtime.accent.length * 2);
    expect(typeof runtime.accessible).toBe('boolean');
  });

  it('only declares tokens the DTCG model can express (semantic roles stay absent by design)', () => {
    const color = shadcnTheme.color as Record<string, unknown>;
    // The scheme-flipped/neutral-surface roles deliberately have NO token home — they are gaps, not tokens.
    for (const absent of ['border', 'input', 'ring', 'muted', 'secondary']) {
      expect(color[absent]).toBeUndefined();
    }
  });
});

describe('shadcn reproduction scaffold', () => {
  it('enumerates a seed set of leaf-component targets across states and schemes', () => {
    expect([...SHADCN_COMPONENTS]).toEqual(['button', 'input', 'badge']);
    expect(SHADCN_TARGETS.length).toBeGreaterThan(0);
    for (const t of SHADCN_TARGETS) {
      expect(t.system).toBe('shadcn');
      expect(SHADCN_COMPONENTS).toContain(t.component);
      expect(['light', 'dark']).toContain(t.scheme);
    }
    // Light + dark for every (component, state) — schemes fan out evenly.
    expect(SHADCN_TARGETS.filter((t) => t.scheme === 'light').length).toBe(
      SHADCN_TARGETS.filter((t) => t.scheme === 'dark').length,
    );
  });

  it('maps every seed component to WE intent(s) + token roles + shadcn variants', () => {
    for (const component of SHADCN_COMPONENTS) {
      const m = INTENT_MAP[component];
      expect(m.component).toBe(component);
      expect(m.intents.length).toBeGreaterThan(0);
      expect(m.tokens.length).toBeGreaterThan(0);
      expect(m.variants.length).toBeGreaterThan(0);
    }
    expect(INTENT_MAP.button.intents).toContain('action');
    expect(INTENT_MAP.input.intents).toContain('input');
    expect(INTENT_MAP.badge.intents).toContain('status-indicator');
  });
});

describe('shadcn gap list (the deliverable)', () => {
  it('is non-empty and every gap is a well-typed gap-sweep intake line', () => {
    expect(SHADCN_GAPS.length).toBeGreaterThan(0);
    for (const g of SHADCN_GAPS) {
      expect(['token', 'intent', 'behavior', 'primitive']).toContain(g.kind);
      expect(g.target.system).toBe('shadcn');
      expect(g.description.length).toBeGreaterThan(20);
      expect(g.suggested && g.suggested.length).toBeTruthy();
    }
  });

  it('attributes gaps to both the token and the intent layers (the thesis residue)', () => {
    const kinds = new Set(SHADCN_GAPS.map((g) => g.kind));
    expect(kinds.has('token')).toBe(true);
    expect(kinds.has('intent')).toBe(true);
  });
});

describe('Plateau→WE verdict ingestion loop', () => {
  const reading = (pixelPass: boolean, structuralPass: boolean, withAdvisory = false): ReproductionVerdict['oracle'] => ({
    pixel: { pass: pixelPass, score: pixelPass ? 0.99 : 0.6 },
    structural: { pass: structuralPass, score: structuralPass ? 1 : 0.5 },
    ...(withAdvisory ? { vlm: { pass: true, note: 'looks faithful' } } : {}),
  });

  it('seed run ships the gap list with zero parity claims (no measurement, no claim)', () => {
    const report = buildShadcnReport([], '2026-06-20T00:00:00Z');
    expect(report.system).toBe('shadcn');
    expect(report.verdicts).toEqual([]);
    expect(report.summary).toEqual({ passed: 0, failed: 0, gaps: SHADCN_GAPS.length });
    expect(report.gaps).toBe(SHADCN_GAPS);
  });

  it('rolls up ingested measured verdicts', () => {
    const verdicts: ReproductionVerdict[] = [
      { target: SHADCN_TARGETS[0], pass: true, oracle: reading(true, true, true) },
      { target: SHADCN_TARGETS[1], pass: false, oracle: reading(false, true) },
    ];
    const report = buildShadcnReport(verdicts, '2026-06-20T00:00:00Z');
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
    expect(report.verdicts.length).toBe(2);
  });

  it('rejects a verdict whose pass disagrees with its gating legs (advisory must not flip pass)', () => {
    const bad: ReproductionVerdict = {
      target: SHADCN_TARGETS[0],
      pass: true, // claims pass, but a gating leg failed
      oracle: reading(false, true),
    };
    expect(() => assertVerdictGating(bad)).toThrow(/gating legs/);
    expect(() => buildShadcnReport([bad])).toThrow();
  });

  it('rejects an advisory VLM leg that carries a score (it annotates, never scores)', () => {
    const bad: ReproductionVerdict = {
      target: SHADCN_TARGETS[0],
      pass: true,
      oracle: { pixel: { pass: true, score: 1 }, structural: { pass: true, score: 1 }, vlm: { pass: true, score: 0.9 } },
    };
    expect(() => assertVerdictGating(bad)).toThrow(/advisory/);
  });

  it('exposes a stable target key', () => {
    expect(targetKey({ system: 'shadcn', component: 'button', state: 'hover', scheme: 'dark' })).toBe(
      'shadcn/button/hover/dark',
    );
  });
});
