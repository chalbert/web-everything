/**
 * @file scripts/__tests__/pr-land.test.mjs
 * @description Unit proof of the pure helpers in `scripts/pr-land.mjs` — the self-approved-PR landing
 *   substrate for #2138 Fork 5 (#2153): the `gh pr create`/`gh pr merge` arg construction and the
 *   check-classification that decides merge-vs-wait-vs-abort. The live gh/git driver is the I/O boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeMethodFlag, buildCreateArgs, buildMergeArgs, buildRenumberHealArgs, buildRegenArgs, classifyChecks } from '../pr-land.mjs';

describe('pr-land pure helpers (#2138 Fork 5 / #2153)', () => {
  it('maps merge methods to gh flags (default = --merge, the no-ff history the drain wants)', () => {
    expect(mergeMethodFlag('merge')).toBe('--merge');
    expect(mergeMethodFlag('squash')).toBe('--squash');
    expect(mergeMethodFlag('rebase')).toBe('--rebase');
    expect(mergeMethodFlag(undefined)).toBe('--merge');
    expect(mergeMethodFlag('bogus')).toBe('--merge');
  });

  it('builds a self-approved PR create (NO reviewer; body never dropped; --fill only when nothing given)', () => {
    // Bare create (no title, no body): --fill autofills both from commits — the fallback branch.
    expect(buildCreateArgs({ base: 'main', head: 'lane/2153-x' }))
      .toEqual(['pr', 'create', '--base', 'main', '--head', 'lane/2153-x', '--fill']);
    // No --reviewer is ever added — self-approved (0 required approvals, #2152).
    expect(buildCreateArgs({ base: 'main', head: 'lane/2153-x' })).not.toContain('--reviewer');
    // With an explicit title+body: --title/--body, NO --fill (an explicit pair is complete on its own).
    const withTitle = buildCreateArgs({ base: 'main', head: 'lane/2153-x', title: 'land #2153', body: 'b' });
    expect(withTitle).toContain('--title');
    expect(withTitle).not.toContain('--fill');
    expect(withTitle[withTitle.indexOf('--body') + 1]).toBe('b');
    // BODY WITHOUT TITLE (the #2170 dismissals path): the body is HONORED, not dropped — and no --fill (which
    // is unusable for a remote-only lane/* head). The pr-land CLI derives a title from the commit subject so
    // a real create is always complete; this pure builder faithfully keeps the body regardless.
    const bodyOnly = buildCreateArgs({ base: 'main', head: 'lane/2170-x', body: '## Dismissed review findings\n- x' });
    expect(bodyOnly).toContain('--body');                     // body is present…
    expect(bodyOnly[bodyOnly.indexOf('--body') + 1]).toBe('## Dismissed review findings\n- x'); // …and unmangled
    expect(bodyOnly).not.toContain('--fill');                 // never --fill when a body is supplied
    // TITLE WITHOUT BODY (#2176): a title-only argv drops gh into an interactive body prompt and fails
    // headless — so the builder must ALWAYS carry a body when a title is present (an empty `--body ""`),
    // and never fall back to --fill (unusable for a remote-only lane/* head).
    const titleOnly = buildCreateArgs({ base: 'main', head: 'lane/2176-x', title: 'land #2176', body: null });
    expect(titleOnly).toContain('--body');                    // a body is always present…
    expect(titleOnly[titleOnly.indexOf('--body') + 1]).toBe(''); // …an explicit empty body (non-interactive)
    expect(titleOnly).not.toContain('--fill');                // never --fill for a lane/* head
  });

  it('builds a one-PR merge that deletes the lane ref (not --auto on a native queue)', () => {
    expect(buildMergeArgs({ pr: 4, method: 'merge' }))
      .toEqual(['pr', 'merge', '4', '--merge', '--delete-branch']);
    expect(buildMergeArgs({ pr: 7, method: 'squash' })).not.toContain('--auto'); // drain owns ordering
  });

  it('builds the post-land id-collision heal with NO --base-ref (the single-land case, #2071)', () => {
    // The batch integrator passes --base-ref to shield ids inherited from a shared pre-claim base; a single
    // land runs on post-merge main where every duplicate NNN is a real allocation collision, so the base
    // guard is deliberately OMITTED (with it, a genuine collision would be wrongly skipped).
    expect(buildRenumberHealArgs()).toEqual(['scripts/backlog-renumber-collisions.mjs', '--json']);
    expect(buildRenumberHealArgs().some((a) => a.startsWith('--base-ref'))).toBe(false);
    expect(buildRenumberHealArgs()).not.toContain('--force');
  });

  it('returns the derived-artifact regen command set in lock-step with the drain (gen:inventory + gen:reference-index, #2182)', () => {
    const cmds = buildRegenArgs();
    // Must be an array of [cmd, ...args] tuples (same shape as lane-drain.mjs DERIVED_REGEN).
    expect(Array.isArray(cmds)).toBe(true);
    expect(cmds.length).toBeGreaterThan(0);
    // Every entry is itself an array (the [cmd, ...args] tuple shape).
    for (const entry of cmds) expect(Array.isArray(entry)).toBe(true);
    // The two drain-equivalent generators must be present.
    const flat = cmds.map((c) => c.join(' '));
    expect(flat).toContain('npm run gen:inventory');
    expect(flat).toContain('npm run gen:reference-index');
    // No generator that writes OUTSIDE the WE repo (no impl-repo commands).
    for (const f of flat) expect(f).not.toMatch(/frontierui|plateau-app/);
  });

  it('classifies checks: pass → merge, any fail → abort, any pending → wait', () => {
    expect(classifyChecks([]).status).toBe('passed');                                  // no required checks
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'skipping' }]).status).toBe('passed');
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'pending' }]).status).toBe('pending');
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'fail' }]).status).toBe('failed');
    // fail dominates pending (never merge a red PR even if something else is still running).
    expect(classifyChecks([{ bucket: 'pending' }, { bucket: 'fail' }]).status).toBe('failed');
    // tolerates the raw `state` field when `bucket` is absent.
    expect(classifyChecks([{ state: 'in_progress' }]).status).toBe('pending');
  });
});

describe('pr-land contract guards (source-level, mirrors gated-push-wiring)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/pr-land.mjs'), 'utf8');
  it('only ever pushes a lane/* head (guard carve-out) and never force-pushes', () => {
    expect(src).toMatch(/\/\^lane\\\//);        // enforces --ref starts with lane/
    expect(src).not.toMatch(/--force/);          // never force
  });
  it('aborts on a red required check (never merges a red PR)', () => {
    expect(src).toMatch(/check-red/);            // the abort path exists
    // The functional guarantee that no --auto native-queue flag is ever emitted is covered by the
    // buildMergeArgs test above (…).not.toContain('--auto') — the drain owns ordering, not GitHub.
  });
  it('retains a git-merge fallback (#2138 Fork 5 (a))', () => {
    expect(src).toMatch(/fallback-git/);
    expect(src).toMatch(/merge', '--no-ff'/);
  });
  it('self-heals id collisions AFTER the merge, non-destructively, without ever failing the land (#2071)', () => {
    expect(src).toMatch(/function runHeal/);                      // the heal step exists
    expect(src).toMatch(/const HEAL = !flags\['no-heal'\]/);      // on by default, --no-heal opts out
    // Non-destructive sync: detached checkout of the post-merge base, NEVER `git reset --hard` on a branch
    // (so an accidental --repo=<primary-with-work> can't be reset out from under the user).
    expect(src).toMatch(/checkout', '--detach'/);
    expect(src).not.toMatch(/reset', '--hard'/);
    // Skips a dirty tree, and gates the healed tree before the (non-force) push.
    expect(src).toMatch(/skipped id-collision heal/);
    expect(src).toMatch(/check:standards/);
    // The heal runs only after a successful merge (its call sites sit after the gh/ git-fallback merges).
    expect(src.indexOf('function runHeal')).toBeGreaterThan(src.indexOf('buildMergeArgs({ pr: prNum'));
  });
  it('regenerates derived artifacts AFTER the merge (and after heal), without ever failing the land (#2182)', () => {
    expect(src).toMatch(/function runRegen/);                       // the regen step exists
    expect(src).toMatch(/const REGEN = !flags\['no-regen'\]/);     // on by default, --no-regen opts out
    // runRegen must be defined/called AFTER runHeal — heal wins ordering over regen (#2071 before #2182).
    expect(src.indexOf('function runRegen')).toBeGreaterThan(src.indexOf('function runHeal'));
    // Non-destructive: detached checkout (reuses runHeal's pattern), NEVER reset --hard on a branch.
    expect(src.indexOf('function runRegen')).toBeGreaterThan(src.indexOf('checkout', '--detach'.length));
    expect(src).not.toMatch(/reset', '--hard'/);
    // Skips a dirty tree (can't regen against uncommitted inputs).
    expect(src).toMatch(/skipped derived-artifact regen/);
    // A regen failure is surfaced but never fails the land.
    expect(src).toMatch(/regen failed \(non-fatal\)/);
    // Never force-pushes the regen commit.
    expect(src).not.toMatch(/--force/);
  });
});
