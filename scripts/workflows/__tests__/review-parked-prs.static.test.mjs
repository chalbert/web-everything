/**
 * @file review-parked-prs.static.test.mjs — a STATIC-SOURCE check on `review-parked-prs.mjs` (#3158).
 *
 * WHY STATIC, NOT AN IMPORT-AND-CALL TEST. `review-parked-prs.mjs` is a Workflow SANDBOX body, not an ES
 * module — it ends in a top-level `return` (see `we:skills-src/jury/panel-fanout.mjs`'s header for the same
 * constraint on a sibling file), so `import()`ing it or calling its unexported `lensPrompt` directly is not
 * available here. Reading the source text and asserting on the literal command-line fragment it embeds is the
 * cheapest test that still catches the failure mode #3158's round-1/round-2 panel and red-team both flagged
 * twice: a dropped, mistyped, or malformed `--toolsAvailable` flag on this ONE call site silently falls back to
 * `toolsAvailable: false` (the tool-free default review-core.mjs now has), telling a genuinely tool-bearing
 * Workflow subagent it "has no tools and cannot run or clone the code at all" — a false, self-contradictory
 * instruction with nothing else in this diff positioned to catch it (`review-core-cli.test.mjs`'s bare-flag
 * test only pins the generic `parseFlags` mechanism, never this specific call site's literal).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'review-parked-prs.mjs'),
  'utf8',
);

describe('review-parked-prs.mjs — the lens-mandate command line (#3158)', () => {
  it('the `mandate --lens=...` command this workflow tells its tool-bearing juror to run carries `--toolsAvailable`', () => {
    // The exact template-literal line lensPrompt emits — pinned as a substring so a rename/reflow of
    // surrounding prose does not make this brittle, but a dropped/mistyped flag on THIS line does redden it.
    expect(SOURCE).toContain(
      'node scripts/review-core-cli.mjs mandate --lens=${lens} --diffBasis=${diffBasis} --toolsAvailable',
    );
  });

  it('is the ONE occurrence of this command line — no stale sibling missing the flag', () => {
    const matches = SOURCE.match(/node scripts\/review-core-cli\.mjs mandate --lens=/g) || [];
    expect(matches).toHaveLength(1);
  });
});
