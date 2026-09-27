/**
 * @file check-standards-rules-registry-discovery-guard.test.mjs
 * @description The standing guard against `scripts/conveyor/soak/breaks/index.mjs` or
 * `scripts/conveyor/health-smells/index.mjs` regressing back to a hand-maintained import list (#3729-style
 * merge-conflict prevention — both registries now discover their contents from disk via
 * `registry-discovery.mjs#loadModuleRegistry`). Pure detector: `findHandMaintainedRegistryIndex`.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { findHandMaintainedRegistryIndex, REGISTRY_DISCOVERY_INDEX_FILES } from '../check-standards-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('findHandMaintainedRegistryIndex', () => {
  it('is silent on a directory-discovery index (calls loadModuleRegistry, no sibling import)', () => {
    const findings = findHandMaintainedRegistryIndex([{
      file: 'scripts/conveyor/soak/breaks/index.mjs',
      content: `
        import { loadModuleRegistry } from '../../registry-discovery.mjs';
        import { validateBreakShape } from '../breaks-shape.mjs';
        export const BREAKS = Object.freeze(await loadModuleRegistry(DIR, validateBreakShape));
      `,
    }]);
    expect(findings).toEqual([]);
  });

  it('flags a hand-maintained sibling import (the regression this guard exists for)', () => {
    const findings = findHandMaintainedRegistryIndex([{
      file: 'scripts/conveyor/soak/breaks/index.mjs',
      content: `
        import unsupportedRepoDirt from './unsupported-repo-dirt.mjs';
        export const BREAKS = Object.freeze([unsupportedRepoDirt]);
      `,
    }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('scripts/conveyor/soak/breaks/index.mjs');
    expect(findings[0].reason).toMatch(/hand-imports the sibling module/);
    expect(findings[0].reason).toMatch(/unsupported-repo-dirt\.mjs/);
  });

  it('flags an index.mjs that no longer calls loadModuleRegistry at all', () => {
    const findings = findHandMaintainedRegistryIndex([{
      file: 'scripts/conveyor/health-smells/index.mjs',
      content: 'export const SMELLS = Object.freeze([]);\n',
    }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toMatch(/no longer calls loadModuleRegistry/);
  });

  it('ignores files outside the two known registry-index paths', () => {
    const findings = findHandMaintainedRegistryIndex([{
      file: 'scripts/conveyor/soak/breaks/some-break.mjs',
      content: "import x from './y.mjs'; export default { id: 'x' };",
    }]);
    expect(findings).toEqual([]);
  });

  it('does not flag a parent-directory import (../registry-discovery.mjs, ../breaks-shape.mjs)', () => {
    const findings = findHandMaintainedRegistryIndex([{
      file: 'scripts/conveyor/health-smells/index.mjs',
      content: `
        import { loadModuleRegistry } from '../registry-discovery.mjs';
        import { validateSmellShape } from '../health-smells-shape.mjs';
        export const SMELLS = Object.freeze(await loadModuleRegistry(DIR, validateSmellShape));
      `,
    }]);
    expect(findings).toEqual([]);
  });

  it('the real, on-disk registry-index files pass this guard clean', () => {
    const files = REGISTRY_DISCOVERY_INDEX_FILES.map((file) => ({ file, content: readFileSync(join(ROOT, file), 'utf8') }));
    expect(findHandMaintainedRegistryIndex(files)).toEqual([]);
  });
});
