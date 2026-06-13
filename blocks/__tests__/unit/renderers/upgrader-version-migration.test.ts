/**
 * Version-migration input adapter (#493, slice (c) of #191). Proves it is a SECOND provider on the
 * engine's analyzer seam: `upgrade()` routes `language: 'version-migration'` to it, it migrates a
 * conformant <component>'s template across versions via planner+interpreter, and the EXISTING
 * verifyUpgrade gate offers the result only when it re-parses, round-trips, and conforms — failing
 * (offered:false) on an unreachable target or an untrusted/missing codemod.
 */
import { describe, it, expect } from 'vitest';
import { CustomAnalyzerRegistry, upgrade } from '../../../renderers/upgrader/upgraderEngine';
import { registerReferenceAnalyzers } from '../../../renderers/upgrader/analyzers/legacyWebComponent';
import { registerVersionMigrationAnalyzer } from '../../../renderers/upgrader/analyzers/versionMigration';
import { CustomCodemodRegistry } from '../../../renderers/upgrader/transformInterpreter';
import type { ChangelogManifest } from '../../../renderers/upgrader/versionMigrationPlanner';

const SOURCE = '<component name="we-card" shadow="open"><we-badge tone="legacy">Hi</we-badge></component>';

// 1.0.0 -> 2.0.0 renames @tone -> @variant; 2.0.0 -> 3.0.0 re-namespaces the we- prefix to fui-.
const declarativeChain: ChangelogManifest[] = [
  {
    manifestVersion: '1', package: 'cards', previous: '1.0.0', release: '2.0.0',
    entries: [{ module: 'badge', severity: 'major', type: 'changed', summary: 'tone→variant', migration: { mode: 'declarative', transform: { kind: 'rename-attr', element: 'we-badge', from: 'tone', to: 'variant' } } }],
  },
  {
    manifestVersion: '1', package: 'cards', previous: '2.0.0', release: '3.0.0',
    entries: [{ module: 'all', severity: 'major', type: 'changed', summary: 're-namespace', migration: { mode: 'declarative', transform: { kind: 're-namespace', from: 'we-', to: 'fui-' } } }],
  },
];

const freshRegistry = () => {
  const r = new CustomAnalyzerRegistry();
  registerReferenceAnalyzers(r); // the legacy→standard path stays registered alongside
  return r;
};

describe('version-migration adapter (#493)', () => {
  it('registers as a second provider — upgrade() routes version-migration input to it', () => {
    const r = freshRegistry();
    registerVersionMigrationAnalyzer(r, { installed: '1.0.0', target: '2.0.0', manifests: declarativeChain });
    expect(r.ids()).toContain('version-migration');
    expect(r.ids()).toContain('reference:legacy-web-component');
  });

  it('migrates a conformant component across versions and offers the verified result', async () => {
    const registry = freshRegistry();
    registerVersionMigrationAnalyzer(registry, { installed: '1.0.0', target: '3.0.0', manifests: declarativeChain });

    const result = await upgrade({ code: SOURCE, language: 'version-migration' }, { registry });

    expect(result.analyzerId).toBe('version-migration');
    expect(result.offered).toBe(true); // re-parsed, round-tripped, conformed
    expect(result.generated).toContain('<fui-badge'); // re-namespaced (2→3)
    expect(result.generated).toContain('variant="legacy"'); // renamed attr (1→2)
    expect(result.generated).not.toContain('tone=');
    expect(result.ir?.name).toBe('we-card'); // wrapper name carried through
  });

  it('does not offer (diagnostic) when the manifest chain cannot reach the target', async () => {
    const registry = freshRegistry();
    registerVersionMigrationAnalyzer(registry, { installed: '1.0.0', target: '9.0.0', manifests: declarativeChain });

    const result = await upgrade({ code: SOURCE, language: 'version-migration' }, { registry });
    expect(result.offered).toBe(false);
    expect(result.diagnostics.join(' ')).toMatch(/cannot fully migrate/);
  });

  it('does not offer when an imperative step references an untrusted codemod', async () => {
    const imperativeChain: ChangelogManifest[] = [{
      manifestVersion: '1', package: 'cards', previous: '1.0.0', release: '2.0.0',
      entries: [{ module: 'badge', severity: 'major', type: 'changed', summary: 'complex', migration: { mode: 'imperative', ref: 'm-x', author: 'we', integrity: 'sha256-trusted', rewrites: 'r' } }],
    }];
    const codemods = new CustomCodemodRegistry().register({ ref: 'm-x', integrity: 'sha256-TAMPERED', apply: (s) => s });
    const registry = freshRegistry();
    registerVersionMigrationAnalyzer(registry, { installed: '1.0.0', target: '2.0.0', manifests: imperativeChain, codemods });

    const result = await upgrade({ code: SOURCE, language: 'version-migration' }, { registry });
    expect(result.offered).toBe(false);
    expect(result.diagnostics.join(' ')).toMatch(/could not be applied cleanly|integrity mismatch/);
  });
});
