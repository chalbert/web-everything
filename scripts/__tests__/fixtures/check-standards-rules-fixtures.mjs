/**
 * @file scripts/__tests__/fixtures/check-standards-rules-fixtures.mjs
 * @description Shared module-scope fixtures for the check-standards-rules-*.test.mjs split (#3383
 * test-speedup). `check-standards-rules.test.mjs` was one 2793-line file with these constants declared
 * once at the top and reused across dozens of describe blocks; splitting it into several files means any
 * constant used by describes that landed in MORE THAN ONE file has to live somewhere shared instead of
 * being duplicated. Only `require`, `ROOT` and `SRC` cross a file boundary — everything else (`DATA`,
 * `INC`, the `messages()` helper) is used within a single split file and stays local there.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

export const require = createRequire(import.meta.url);
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
export const SRC = join(ROOT, 'src');
