/**
 * @file scripts/__tests__/pr-land.test.mjs
 * @description Unit proof of the pure helpers in `scripts/pr-land.mjs` — the self-approved-PR landing
 *   substrate for #2138 Fork 5 (#2153): the `gh pr create`/`gh pr merge` arg construction and the
 *   check-classification that decides merge-vs-wait-vs-abort. The live gh/git driver is the I/O boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeMethodFlag, buildCreateArgs, prCreateBodyGuard, buildMergeArgs, buildRenumberHealArgs, buildRegenArgs, buildAddLabelArgs, classifyChecks, planPrLand, pollVerdict, isPostLandTreeDirty, postLandSkips, postLandReport, scopeHealChangedPaths, resolveProducerReviewLabel } from '../pr-land.mjs';
import { REVIEW_LABELS } from '../lib/review-escalation.mjs';

describe('resolveProducerReviewLabel — #2307 deterministic review-escalation label AT PR-OPEN', () => {
  it('a policy-core diff (edits the leash-defining trust chain) → review:human, applied', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['scripts/lib/review-escalation.mjs'], diffLines: 10 });
    expect(v.label).toBe(REVIEW_LABELS.human);
    expect(v.apply).toBe(true);
    expect(v.humanRequired).toBe(true);
    expect(v.reasons.join(' ')).toMatch(/gate-self/);
  });
  it('an escalating non-gate-self diff (blast-radius) → review:pending, applied', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 10 });
    expect(v.label).toBe(REVIEW_LABELS.pending);
    expect(v.apply).toBe(true);
    expect(v.humanRequired).toBe(false);
  });
  it('a leaf diff with no escalation signal → no review label at all', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['backlog/2307-x.md'], diffLines: 10 });
    expect(v.label).toBe(null);
    expect(v.apply).toBe(false);
  });
  it('cross-repo + dismissed-findings signals off the manifest also escalate (review:pending)', () => {
    expect(resolveProducerReviewLabel({ crossRepo: true }).label).toBe(REVIEW_LABELS.pending);
    expect(resolveProducerReviewLabel({ dismissedFindings: 2 }).label).toBe(REVIEW_LABELS.pending);
  });
  it('a PR that already carries the verdict label is NOT re-applied (idempotent — never a double-apply)', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 10, currentLabels: [REVIEW_LABELS.pending] });
    expect(v.label).toBe(REVIEW_LABELS.pending);
    expect(v.apply).toBe(false);
  });
});

describe('pr-land post-land dirty-probe (#2225 — deps-symlinked clone must still heal/regen)', () => {
  it('a tree whose ONLY dirt is the untracked node_modules symlink is NOT blocking-dirty', () => {
    // `git status --porcelain --untracked-files=no` already hides it; the extra guard covers a tracked symlink.
    expect(isPostLandTreeDirty('?? node_modules\n')).toBe(false);
    expect(isPostLandTreeDirty(' M node_modules\n')).toBe(false);
    expect(isPostLandTreeDirty('')).toBe(false);
  });
  it('a genuinely TRACKED-dirty file blocks (a detached checkout could sweep it into the post-land commit)', () => {
    expect(isPostLandTreeDirty(' M .claude/skills/batch-backlog-items/claims.json\n')).toBe(true);
    expect(isPostLandTreeDirty(' M src/_data/blocks.json\n?? node_modules\n')).toBe(true);
  });
  it('postLandSkips lists only the steps that actually skipped (loud-skip surfacing)', () => {
    expect(postLandSkips({ skipped: true }, { done: [], failed: [] })).toEqual(['heal']);
    expect(postLandSkips({ healed: false }, { skipped: true })).toEqual(['regen']);
    expect(postLandSkips({ skipped: true }, { skipped: true })).toEqual(['heal', 'regen']);
    expect(postLandSkips({ healed: true }, { done: ['x'] })).toEqual([]);
    expect(postLandSkips(null, null)).toEqual([]);
  });
});

describe('postLandReport — the success line never throws when regen/heal is skipped or unset (#2218)', () => {
  it('SKIPPED regen (dirty checkout) reports "skipped", it does NOT read regen.done.length and crash', () => {
    // The reported bug: `regen` is `{ skipped:true, done:[], failed:[] }` (or unset) on the dirty-checkout /
    // --no-regen path; the old `regen.done.length` read threw a TypeError and misreported a successful land.
    const regen = { skipped: true, done: [], failed: [], warning: 'skipped derived-artifact regen — …' };
    expect(() => postLandReport(null, regen)).not.toThrow();
    expect(postLandReport(null, regen)).toBe('; derived-artifact regen: skipped (tracked-dirty tree)');
  });
  it('--no-regen / --no-heal (both null) → empty suffix, no throw', () => {
    expect(postLandReport(null, null)).toBe('');
  });
  it('a regen that ran but changed nothing reports "regenerated: none" (not a crash, not silence)', () => {
    expect(postLandReport(null, { done: [], failed: [] })).toBe('; regenerated: none');
  });
  it('reports the healed collisions and the regenerated artifacts on the happy path', () => {
    const heal = { healed: true, renumbered: [{ oldNum: '2219', newNum: '2220' }] };
    const regen = { done: ['npm run gen:inventory'], failed: [] };
    expect(postLandReport(heal, regen)).toBe('; healed id collision(s): #2219→#2220; regenerated: npm run gen:inventory');
  });
  it('a skipped heal reports skipped; a non-fatal regen failure is surfaced', () => {
    expect(postLandReport({ skipped: true }, { done: [], failed: [{ cmd: 'npm run gen:reference-index' }] }))
      .toBe('; id-collision heal: skipped (tracked-dirty tree); regen failed (non-fatal): npm run gen:reference-index');
  });
  it('tolerates a regen object missing its arrays entirely (optional-chained reads)', () => {
    expect(() => postLandReport({}, {})).not.toThrow();
    expect(postLandReport({}, {})).toBe('; regenerated: none');
  });
});

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

  it('#2332 prCreateBodyGuard — refuses a bodyless create, allows a non-empty body (producer fail-fast)', () => {
    // A real, non-empty body → ok (the create proceeds).
    expect(prCreateBodyGuard('## Real body\n- x').ok).toBe(true);
    expect(prCreateBodyGuard('## Real body\n- x').reason).toBeUndefined();
    // The bodyless cases the #2324 drain gate would later refuse to LAND — the producer must fail fast now.
    for (const empty of [null, undefined, '', '   ', '\n\t ']) {
      const g = prCreateBodyGuard(empty);
      expect(g.ok).toBe(false);            // refused at open…
      expect(g.reason).toMatch(/bodyless/); // …with a reason naming the omission (#2332)
    }
  });

  it('builds a one-PR merge that deletes the lane ref (not --auto on a native queue)', () => {
    expect(buildMergeArgs({ pr: 4, method: 'merge' }))
      .toEqual(['pr', 'merge', '4', '--merge', '--delete-branch']);
    expect(buildMergeArgs({ pr: 7, method: 'squash' })).not.toContain('--auto'); // drain owns ordering
  });

  it('omits --onto-ref when no pre-merge main sha is known (falls back to the git-ordinal heuristic, #2071)', () => {
    expect(buildRenumberHealArgs()).toEqual(['scripts/backlog-renumber-collisions.mjs', '--json']);
    expect(buildRenumberHealArgs({}).some((a) => a.startsWith('--onto-ref'))).toBe(false);
    expect(buildRenumberHealArgs()).not.toContain('--force');
  });

  it('passes --onto-ref=<pre-merge-main sha> so a published id is never yielded (resume-land fix, #2213)', () => {
    // Files already on the branch being landed ONTO are immutable keepers: only the INCOMING lane's new file
    // may yield — otherwise a lagging lane authored first, landing last, would renumber a live main item.
    const sha = 'a'.repeat(40);
    expect(buildRenumberHealArgs({ ontoRef: sha })).toEqual(['scripts/backlog-renumber-collisions.mjs', '--json', `--onto-ref=${sha}`]);
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

  it('builds the ready-to-merge label-apply args, and skips when disabled (#2196)', () => {
    // Default: apply the producer-certified label so the label lander (/drain) collects the PR.
    expect(buildAddLabelArgs({ pr: 60, label: 'ready-to-merge' }))
      .toEqual(['pr', 'edit', '60', '--add-label', 'ready-to-merge']);
    // --label=<name> overrides the label name.
    expect(buildAddLabelArgs({ pr: 5, label: 'draft-ok' }))
      .toEqual(['pr', 'edit', '5', '--add-label', 'draft-ok']);
    // --no-label (label null) → no args (PR opened UNlabelled, not auto-collected).
    expect(buildAddLabelArgs({ pr: 60, label: null })).toBe(null);
    // No PR number known → nothing to label.
    expect(buildAddLabelArgs({ pr: null, label: 'ready-to-merge' })).toBe(null);
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

describe('pollVerdict — producer labels a BEHIND-but-green PR, never aborts (#2284 residual 1)', () => {
  const green = { checkStatus: 'passed', requiredCount: 1 };
  it('CLEAN/UNSTABLE + green → label (either mode)', () => {
    expect(pollVerdict({ state: 'CLEAN', ...green, labelWhenGreen: true })).toBe('label');
    expect(pollVerdict({ state: 'UNSTABLE', ...green, labelWhenGreen: false })).toBe('label');
  });
  it('BEHIND + green in PRODUCER mode → label & hand off (the fix — was previously aborting)', () => {
    expect(pollVerdict({ state: 'BEHIND', ...green, labelWhenGreen: true })).toBe('label');
  });
  it('BEHIND in a non-producer (merge) path → abort behind (up-to-date still required to merge)', () => {
    expect(pollVerdict({ state: 'BEHIND', ...green, labelWhenGreen: false })).toBe('behind');
  });
  it('BEHIND + EMPTY required set → wait, never a premature label (empty-set green races a not-yet-registered check)', () => {
    expect(pollVerdict({ state: 'BEHIND', checkStatus: 'passed', requiredCount: 0, labelWhenGreen: true })).toBe('wait');
  });
  it('BEHIND + checks pending → wait', () => {
    expect(pollVerdict({ state: 'BEHIND', checkStatus: 'pending', requiredCount: 1, labelWhenGreen: true })).toBe('wait');
  });
  it('a red required check → red, in every state/mode', () => {
    expect(pollVerdict({ state: 'BEHIND', checkStatus: 'failed', requiredCount: 1, labelWhenGreen: true })).toBe('red');
    expect(pollVerdict({ state: 'CLEAN', checkStatus: 'failed', requiredCount: 1, labelWhenGreen: true })).toBe('red');
  });
  it('CONFLICTING / DIRTY → conflict (dominates)', () => {
    expect(pollVerdict({ state: 'CLEAN', ...green, labelWhenGreen: true, conflicting: true })).toBe('conflict');
    expect(pollVerdict({ state: 'DIRTY', ...green, labelWhenGreen: true })).toBe('conflict');
  });
  it('BLOCKED / pending → wait', () => {
    expect(pollVerdict({ state: 'BLOCKED', checkStatus: 'pending', requiredCount: 1, labelWhenGreen: true })).toBe('wait');
  });
});

describe('planPrLand — label only after CI green (#2199), never merges (#2290)', () => {
  it('default (land): wait → label when green → TRIGGER a single-couple drain; NEVER merges here (#2290)', () => {
    expect(planPrLand({ wait: true, labelOnGreen: false })).toEqual({ waitForChecks: true, labelWhenGreen: true, mergeWhenGreen: false, triggerDrain: true, mode: 'land' });
  });
  it('no mode EVER merges (the drain is the sole writer to main, #2290)', () => {
    for (const w of [true, false]) for (const g of [true, false]) {
      expect(planPrLand({ wait: w, labelOnGreen: g }).mergeWhenGreen).toBe(false);
    }
  });
  it('--label-on-green (producer): wait → label when green → STOP; no merge, no drain trigger (standalone drain lands it)', () => {
    const p = planPrLand({ wait: true, labelOnGreen: true });
    expect(p.mode).toBe('label-on-green');
    expect(p.waitForChecks).toBe(true);
    expect(p.labelWhenGreen).toBe(true);
    expect(p.mergeWhenGreen).toBe(false);
    expect(p.triggerDrain).toBe(false);
  });
  it('bare --no-wait (open-only): NEVER labels (CI unconfirmed) and never waits/merges/triggers', () => {
    const p = planPrLand({ wait: false, labelOnGreen: false });
    expect(p.mode).toBe('open-only');
    expect(p.waitForChecks).toBe(false);
    expect(p.labelWhenGreen).toBe(false); // the #2199 fix: no label before green
    expect(p.mergeWhenGreen).toBe(false);
    expect(p.triggerDrain).toBe(false);
  });
  it('--label-on-green forces the wait even alongside --no-wait (the label REQUIRES a green confirmation)', () => {
    expect(planPrLand({ wait: false, labelOnGreen: true }).mode).toBe('label-on-green');
  });
  it('no mode ever labels without waiting for checks first', () => {
    for (const w of [true, false]) for (const g of [true, false]) {
      const p = planPrLand({ wait: w, labelOnGreen: g });
      if (p.labelWhenGreen) expect(p.waitForChecks).toBe(true); // labelWhenGreen ⇒ waitForChecks
    }
  });
});

describe('pr-land contract guards (source-level, mirrors gated-push-wiring)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/pr-land.mjs'), 'utf8');
  it('#2199: the label is applied only after the green-wait — never eagerly at PR open', () => {
    // applyLabel() must be invoked AFTER the check-wait loop (`labelWhenGreen`), not in the open/3b block.
    expect(src).toMatch(/if \(PLAN\.labelWhenGreen\) applyLabel\(\)/);
    // the open-only (--no-wait) path emits UNLABELLED
    expect(src).toMatch(/opened UNLABELLED|UNLABELLED — CI not confirmed/);
    // the eager pre-CI add-label call is gone from the open path (applyLabel is a deferred closure)
    expect(src).toMatch(/const applyLabel = \(\) =>/);
  });
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
    // #2290 — the heal now runs only in the (break-glass-gated) --fallback-git path, after its local merge.
    expect(src.indexOf('const heal = HEAL ? runHeal')).toBeGreaterThan(src.indexOf("gitC(['merge', '--no-ff'"));
    // #2312 — `runHeal` must scope its commit to the renumber's OWN files (`scopeHealChangedPaths`), never a
    // bare `git diff --name-only` (that swept foreign checkout state into the healed commit, observed live,
    // PR #168): the bare diff is only ever fed straight into the scoping helper, never straight into `git add`.
    expect(src).toMatch(/scopeHealChangedPaths\(plan, allChanged\)/);
    expect(src).toMatch(/if \(foreign\.length\) return \{ healed: false, renumbered, warning:/);
    expect(src.indexOf("gitC(['add', ...changed])")).toBeGreaterThan(src.indexOf('scopeHealChangedPaths'));
  });
  it('#2312 — reproduces the leaky heal: a foreign dirty tracked file must never ride the renumber commit', () => {
    // The exact incident shape (PR #168, 2026-07-06): a clean single-file backlog renumber ran in a checkout
    // that ALSO carried unrelated uncommitted tracked work (agent-memory + skill + script edits from other
    // in-flight items) — a bare `git diff --name-only` would report ALL of it as "changed".
    const plan = { writePaths: ['2283-file.md'], deletePaths: ['2301-file.md'] };
    const allChanged = [
      'backlog/2283-file.md',
      'backlog/2301-file.md',
      'agent-memory-src/index-meta.md',
      'backlog/2301-force-agent-memory.md',
      'scripts/merge-ai-prs.mjs',
      'scripts/lane-drain.mjs',
      'scripts/__tests__/lane-drain.test.mjs',
      'skills-src/closing-session/SKILL.md',
    ];
    const { changed, foreign } = scopeHealChangedPaths(plan, allChanged);
    // BUG (pre-fix behaviour, if `changed` were just `allChanged`): all 8 paths would ride the heal commit.
    // FIX: only the renumber's own two paths are "changed"; every unrelated path is flagged "foreign" so the
    // caller aborts instead of committing them.
    expect(changed).toEqual(['backlog/2283-file.md', 'backlog/2301-file.md']);
    expect(foreign).toEqual([
      'agent-memory-src/index-meta.md',
      'backlog/2301-force-agent-memory.md',
      'scripts/merge-ai-prs.mjs',
      'scripts/lane-drain.mjs',
      'scripts/__tests__/lane-drain.test.mjs',
      'skills-src/closing-session/SKILL.md',
    ]);
  });
  it('#2312 — a checkout with ONLY the renumber\'s own diff has no foreign paths (the common, safe case)', () => {
    const plan = { writePaths: ['2283-file.md'], deletePaths: ['2301-file.md'] };
    const allChanged = ['backlog/2283-file.md', 'backlog/2301-file.md'];
    expect(scopeHealChangedPaths(plan, allChanged)).toEqual({ changed: allChanged, foreign: [] });
  });
  it('#2312 — tolerates a plan missing writePaths/deletePaths (older CLI output) without throwing', () => {
    expect(scopeHealChangedPaths({}, ['backlog/2283-file.md'])).toEqual({ changed: [], foreign: ['backlog/2283-file.md'] });
    expect(scopeHealChangedPaths(null, [])).toEqual({ changed: [], foreign: [] });
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
  it('#2290: pr-land NEVER merges on the default path — the drain is the sole writer to main', () => {
    // No `gh pr merge` (or buildMergeArgs invocation) anywhere in the runCli land flow.
    expect(src).not.toMatch(/ghC\(buildMergeArgs/);
    // The default path triggers a single-couple fast drain instead of merging.
    expect(src).toMatch(/triggerSingleCoupleDrain/);
    expect(src).toMatch(/merge-ai-prs\.mjs/);
    expect(src).toMatch(/--only=/);
  });
  it('#2290: the --fallback-git local merge is routed through the shared gate (break-glass only)', () => {
    // fallback-git is a write to main → it must assert the caller may merge (blocked unless break-glass).
    expect(src).toMatch(/assertMayMerge\(\{ caller: 'pr-land'/);
    // still ff-syncs the user's primary checkout, best-effort, after a land.
    expect(src).toMatch(/function syncPrimaryMain/);
    expect(src).toMatch(/'pull', '--ff-only', '--autostash'/);
    expect(src).toMatch(/NOT fast-forwarded/);
  });
});
