/**
 * @file blocks/renderers/module-service/conformance/dotnetTarget.ts
 * @description The @generated .NET origin (#548) wrapped as a conformance {@link ConformanceTarget}
 * (backlog #549 — slice 3 of epic #507).
 *
 * This is the third leg #463 fork c chartered: a generated origin driven against the SAME `golden.json`
 * the JS reference is driven against, held to byte-identical / identity-stable fidelity by the one
 * neutral runner (`./runner.ts`). The runner knows nothing about .NET — a `ConformanceTarget` is just
 * `(vector) => Promise<ActualResponse>`; here that promise is fulfilled by a `dotnet` subprocess hosting
 * `GeneratedMaaSOrigin` (`./dotnet/Program.cs` + the compiled goldens), exactly as the header of
 * `runner.ts` pre-committed: *"a generated origin is driven via a subprocess target that reads the very
 * same `golden.json`."*
 *
 * The subprocess is spawned ONCE (it processes the whole vector set into a name→response map), so a
 * suite of N vectors pays one `dotnet` build+run, not N. Requires a capable `dotnet` toolchain; the gate
 * (`scripts/check-maas-conformance.mjs`, fork-1 option B) detects that and skips-with-notice when absent,
 * so this target is only ever constructed once a usable `dotnet` has been resolved.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActualResponse, ConformanceTarget, ConformanceVector } from './runner';

const here = dirname(fileURLToPath(import.meta.url));

export interface DotnetTargetOptions {
  /** Absolute path to a capable `dotnet` executable (resolved + version-gated by the caller). */
  readonly dotnet: string;
  /** Absolute path to the committed `golden.json` the host reads. */
  readonly goldenPath: string;
  /** The host project directory (holds `MaasConformanceHost.csproj`). Defaults to `./dotnet`. */
  readonly hostDir?: string;
}

/**
 * Build a {@link ConformanceTarget} backed by the .NET host. The first `run()` spawns `dotnet run`,
 * which compiles the generated origin and writes every vector's neutral response to a temp file; later
 * `run()` calls read from the cached map. A non-zero exit (a compile error or a host crash) throws — the
 * runner turns that into a per-vector `threw` mismatch, so a broken generation is a loud failure, not a
 * silent pass.
 */
export function createDotnetTarget(options: DotnetTargetOptions): ConformanceTarget {
  const hostDir = options.hostDir ?? join(here, 'dotnet');
  let cache: Map<string, ActualResponse> | null = null;

  const ensureRun = (): Map<string, ActualResponse> => {
    if (cache) return cache;
    const outPath = join(mkdtempSync(join(tmpdir(), 'maas-conformance-')), 'host-out.json');
    execFileSync(
      options.dotnet,
      ['run', '--project', hostDir, '-c', 'Release', '--', options.goldenPath, outPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const raw = JSON.parse(readFileSync(outPath, 'utf8')) as Record<string, ActualResponse>;
    cache = new Map(Object.entries(raw));
    return cache;
  };

  return {
    name: 'dotnet (#548 GeneratedMaaSOrigin)',
    async run(vector: ConformanceVector): Promise<ActualResponse> {
      const response = ensureRun().get(vector.name);
      if (!response) throw new Error(`.NET host produced no response for vector "${vector.name}"`);
      return response;
    },
  };
}
