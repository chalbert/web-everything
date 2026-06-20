/**
 * Changelog-Manifest protocol — the **runtime-impl half** (#1021, slice #1058).
 *
 * The contract's sibling `./changelog-contract.ts` is the pure-contract half (types only, compile-erased,
 * the future `@webeverything/contracts/changelog-manifest` entry FUI depends on). This file is the
 * **reader runtime** that fulfils it: parse a {@link ChangelogManifest} and expose the queries the
 * auto-update pipeline (#101) and upgraders (#094) consume — per-module entries, the *derived* release
 * severity, and the breaking/migration view. Runtime stays impl (`locus: frontierui`, future
 * `@frontierui` package); interim byte-replicated here alongside the contract, mirroring the landed
 * `intl/` (#1055) and `reliability/` (#1052) provider precedents.
 *
 * Two rulings from the contract are *realized* here, not redecided:
 *  - **Release severity is derived, never hand-asserted.** `releaseSeverity()` is the strictest-wins
 *    reduction over the per-module entries (any `major` ⇒ `major`, else any `minor` ⇒ `minor`, else
 *    `patch`) — semver as a derived fact of the entries (the same reduction validity-merge / the
 *    auto-update pipeline use). An empty manifest derives `patch` (no change is the gentlest band).
 *  - **A migration is the one trust-sensitive surface.** `verifyMigration()` is the integrity gate the
 *    pipeline runs *before* trusting a referenced codemod: a migration is acceptable only when its
 *    `integrity` is a non-empty hash that matches the actual content hash supplied by the caller. The
 *    reader performs the *comparison*; computing the content hash (I/O over the codemod file) is the
 *    pipeline's step (#101 security), not the reader's — so the reader stays pure and dependency-free.
 */
import type {
  ChangelogManifest,
  ChangelogEntry,
  Severity,
  MigrationRef,
} from './changelog-contract.js';

// Re-export the pure-contract surface so `./reader.js` importers reach the types and the runtime from one
// site (the split is at the file seam — mirrors `intl/provider.ts` / `reliability/provider.ts`).
export type * from './changelog-contract.js';

/** Strictest-first severity order — index 0 is the strictest. Drives the strictest-wins reduction. */
const SEVERITY_RANK: readonly Severity[] = ['major', 'minor', 'patch'];

/** The outcome of an integrity check on a {@link MigrationRef} (the reader does the comparison only). */
export interface MigrationVerification {
  /** True iff the supplied content hash equals the migration's declared `integrity`. */
  ok: boolean;
  /** The hash the manifest declares for the codemod. */
  expected: string;
  /** The content hash the caller computed over the referenced codemod. */
  actual: string;
}

/**
 * A read-only view over a single {@link ChangelogManifest}. Construct one per release manifest; every
 * query is a pure projection of its entries (no mutation, no I/O). This is the surface the conformance
 * demo (#1059) exercises and the auto-update pipeline (#101) / upgraders (#094) consume.
 */
export class ChangelogReader {
  constructor(readonly manifest: ChangelogManifest) {}

  /** The release this manifest publishes (semver). */
  get release(): string {
    return this.manifest.release;
  }

  /** The version this manifest migrates from. */
  get previous(): string {
    return this.manifest.previous;
  }

  /** All entries, in manifest order. */
  entries(): ChangelogEntry[] {
    return this.manifest.entries;
  }

  /** Only `module`'s entries — the unit is the module/file, never the whole package. */
  entriesFor(module: string): ChangelogEntry[] {
    return this.manifest.entries.filter((e) => e.module === module);
  }

  /** Entries of exactly `severity`, per the semver major/minor/patch vocabulary. */
  bySeverity(severity: Severity): ChangelogEntry[] {
    return this.manifest.entries.filter((e) => e.severity === severity);
  }

  /** The breaking changes — exactly the `major`-severity entries. */
  breaking(): ChangelogEntry[] {
    return this.bySeverity('major');
  }

  /** Entries that carry a migration (breaking *and* mechanically applicable). */
  withMigration(): ChangelogEntry[] {
    return this.manifest.entries.filter((e) => e.migration !== undefined);
  }

  /**
   * The **derived** release severity: the strictest entry severity (any `major` ⇒ `major`, else any
   * `minor` ⇒ `minor`, else `patch`). Never the package's hand-asserted label. An empty manifest derives
   * `patch` (the gentlest band — no change).
   */
  releaseSeverity(): Severity {
    let rank = SEVERITY_RANK.length - 1; // start at the gentlest (patch)
    for (const entry of this.manifest.entries) {
      const r = SEVERITY_RANK.indexOf(entry.severity);
      if (r >= 0 && r < rank) rank = r;
    }
    return SEVERITY_RANK[rank];
  }

  /**
   * The integrity gate the pipeline runs **before** trusting a codemod: compare the migration's declared
   * `integrity` against `actualHash` — the content hash the caller computed over the referenced codemod.
   * A migration with an empty declared `integrity` never verifies (the manifest must commit to a hash).
   * The reader does the *comparison* only; computing `actualHash` (I/O over the codemod file) is the
   * pipeline's security step (#101), keeping the reader pure.
   */
  verifyMigration(migration: MigrationRef, actualHash: string): MigrationVerification {
    return {
      ok: migration.integrity.length > 0 && migration.integrity === actualHash,
      expected: migration.integrity,
      actual: actualHash,
    };
  }
}
