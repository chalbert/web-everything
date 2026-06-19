/**
 * Changelog-Manifest protocol — the **pure-contract half** (#1021, slice #1057).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/changelog-manifest` entry (#872/#874) that FUI depends on (the FUI→WE
 * arrow), superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`.
 * The runtime half — the manifest reader / severity-derivation / migration-verification — is impl and
 * lives in FUI; only the schema crosses the seam (npm scope mirrors layer).
 *
 * A human `CHANGELOG.md` cannot be acted on by a machine. The Changelog Manifest is the machine-readable
 * contract the auto-update pipeline (#101) and upgraders (#094) consume: a **per-release, per-module**
 * description of every change — its severity, type, human summary, and (for breaking changes) the codemod
 * that mechanically applies it. This is a genuine Protocol — an **interchange schema** independent
 * tooling conforms to, per the Project/Protocol bar (#102 design).
 *
 * Two rulings are encoded here, not redecided downstream:
 *  - **The unit is the module/file, never the whole package** — so a consumer knows exactly what moved.
 *    Release severity is a *derived* fact (strictest-wins over the entries, see `Severity`), never a
 *    hand-asserted label; the reduction itself is impl.
 *  - **A migration is the one trust-sensitive field.** `MigrationRef` carries an `integrity` hash and an
 *    `author` so the pipeline can verify a codemod before running it on the consumer's source. The schema
 *    defines the *linkage and trust fields*; how a codemod is authored / trust established is the
 *    pipeline's security step (#101), not this schema.
 *
 * The protocol does not invent a versioning vocabulary: `Severity` is semver verbatim and `ChangeType`
 * is the Keep a Changelog set.
 */

/** semver severity, verbatim. Release severity is the strictest entry severity (strictest-wins). */
export type Severity = 'major' | 'minor' | 'patch';

/** Keep a Changelog change vocabulary (aligned with Conventional Commits) — borrowed, not invented. */
export type ChangeType = 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';

/**
 * The codemod that mechanically applies a breaking change to consumer source, plus the trust metadata
 * the pipeline (#101) verifies before running it — a migration executes on the *consumer's* code, so it
 * is the manifest's one security-sensitive surface.
 */
export interface MigrationRef {
  /** Reference to the codemod that applies this breaking change. */
  ref: string;
  /** Who authored the codemod — trust metadata. */
  author: string;
  /** Content hash of the referenced codemod — the pipeline refuses one whose hash does not match. */
  integrity: string;
  /** Human description of the scope of code the codemod rewrites. */
  rewrites: string;
}

/**
 * A single per-module change entry. `migration` is present iff the change is breaking *and* mechanically
 * applicable.
 */
export interface ChangelogEntry {
  /** The unit is the module/file, never the whole package. */
  module: string;
  severity: Severity;
  type: ChangeType;
  /** The human half of the dual format. */
  summary: string;
  /** Present iff the change is breaking and mechanically applicable. */
  migration?: MigrationRef;
}

/** A per-release manifest: the new version, the version it migrates from, and the per-module entries. */
export interface ChangelogManifest {
  manifestVersion: string;
  package: string;
  /** The new version (semver). */
  release: string;
  /** The version this manifest migrates from. */
  previous: string;
  entries: ChangelogEntry[];
}
