/**
 * Execution-conformance suite for the @generated .NET origin (backlog #549 — slice 3 of epic #507).
 *
 * The string-match snapshot in `generate.test.ts` proves the C# bytes were EMITTED; this proves they
 * EXECUTE. The generated origin (#548) is compiled and driven, as a `dotnet` subprocess, against the
 * exact `golden.json` the JS reference target passes — and held to the same bar by the same #506 runner:
 * byte-identical responses, identity-stable content-hash ids.
 *
 * This file lives OUTSIDE the default vitest `include` globs (no `__tests__/` segment) and is run only by
 * `npm run check:maas-conformance` via `vitest.maas-conformance.config.ts` — fork-1 option B: a separate
 * opt-in suite kept out of the portable inner loop. It self-skips unless the gate resolved a capable
 * `dotnet` into `MAAS_DOTNET`, so even when invoked directly it never fails for a missing toolchain.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDotnetTarget } from '../dotnetTarget';
import { runConformance, formatReport, type ConformanceVector } from '../runner';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(here, '../golden.json');
const committed: ConformanceVector[] = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));

const dotnet = process.env.MAAS_DOTNET;

describe('generated .NET origin conforms to the golden vectors (#549)', () => {
  it.skipIf(!dotnet)(
    'passes every golden vector with byte-identical responses (run via `npm run check:maas-conformance`)',
    async () => {
      const target = createDotnetTarget({ dotnet: dotnet!, goldenPath: GOLDEN_PATH });
      const report = await runConformance(target, committed);
      // The full per-vector diff prints on any failure — the exact field/expected/got the .NET origin drifted on.
      expect(formatReport(report)).toContain(`${committed.length}/${committed.length}`);
      expect(report.failed).toBe(0);
      expect(report.passed).toBe(committed.length);
    },
    120_000,
  );
});
