/**
 * Default wiring for the changelog-manifest protocol (#1021/#1058). Re-exports the reader runtime + the
 * pure-contract surface from one site, and supplies the `readManifest()` factory — the one entry point a
 * consumer calls to get a {@link ChangelogReader} over a release manifest. Mirrors `intl/index.ts` /
 * `reliability/index.ts`'s default-wiring shape; unlike those provider seams there is no swappable
 * registry — a manifest reader is a stateless projection, so the wiring is just the factory.
 */
import type { ChangelogManifest } from './changelog-contract.js';
import { ChangelogReader } from './reader.js';

export * from './reader.js';

/** Open a {@link ChangelogReader} over a release `manifest` — the canonical reader entry point. */
export function readManifest(manifest: ChangelogManifest): ChangelogReader {
  return new ChangelogReader(manifest);
}
