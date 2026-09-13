/**
 * @file scripts/conveyor/autofix-review-findings.mjs
 * @description Part 3 of the mechanical-dispatcher review line — the ROUTER that turns an auto-fixable
 *   advisory-panel finding into a real, verify-gated `fix` dispatch. Part 2 (landed `8cb872a96`) made a
 *   `review:human` PR's panel run automatically and post its findings as an ADVISORY comment; nothing acted on
 *   them. This module is the acting half: {@link classifyFindingForAutoFix} (`./fix-autofix-gate.mjs`) tags
 *   each finding with a blacklist-first auto-fix verdict, and this file dispatches a narrowly-scoped `fix` for
 *   every finding that clears the gate — reusing `we:scripts/operations/fix-dispatch-wrapper.mjs`'s existing
 *   dispatch/lane/verify-gate/converge machinery UNCHANGED, never inventing a parallel fixer.
 *
 * ONLY EVER OPERATES ON FINDINGS ALREADY POSTED (task requirement 5). This module's own entry point,
 * {@link autoFixAfterReview}, takes the SAME structured `verdict.findings` array
 * `we:scripts/operations/review-pr.mjs#renderAdvisoryNote` already rendered the advisory comment from — read
 * back off `review-loop-cli.mjs --json`'s own printed `verdict` field
 * (`we:scripts/operations/review-dispatch-wrapper.mjs#dispatchReviewMechanical`'s `raw.verdict`). It runs no
 * judge, spawns no panel, and reads no PR comment itself: the panel already ran, once, before this file is ever
 * called. See `we:scripts/operations/review-dispatch.mjs`'s `IS_CLI` block for where this is wired in — the
 * live population is exactly the one Part 2 targets (`raw.verdict.humanRequired === true`, a parked/confirm
 * outcome), and nothing else.
 *
 * VERIFY-GATED, MIRRORING `we:scripts/autofix/engine.mjs`'s PROPOSE-AND-VERIFY DISCIPLINE (task requirement 3).
 * That engine's loop is APPLY → RE-VERIFY → KEEP-ONLY-IF-GREEN-ELSE-REVERT over conformance-spec JSON patches —
 * a different domain (in-process file patches), but the SAME invariant. `fix-dispatch-wrapper.mjs#dispatchFix`
 * already has it, structurally: `pushLaneRef` (the only call that lands the fix on the real PR) sits AFTER the
 * `runFixGateWithOneRetry` check and is unreachable when the gate stays red — a failing fix is never pushed, so
 * nothing needs an explicit revert step here. This module adds no gate of its own; it inherits that one.
 *
 * IMPURE: `node:child_process` (via the injected `run`, to resolve the PR's base ref for tier resolution) and
 * whatever `dispatchFixFn` does (real lane/git/agent-spawn work) — every impure call is injectable, mirroring
 * every sibling wrapper in this tree.
 */
import { run } from '../operations/minimal-context-provider.mjs';
import { dispatchFix } from '../operations/fix-dispatch-wrapper.mjs';
import { normalizeFindings } from '../lib/review-core.mjs';
import { classifyFindingForAutoFix, resolveAutoFixTier } from './fix-autofix-gate.mjs';

/**
 * Render a NARROW, single-finding brief — never the whole advisory comment, never more than one finding's own
 * anchor (task requirement 3: "scoped narrowly to the cited file/finding"). Pure.
 * @param {object} finding
 * @returns {string}
 */
export function renderScopedFindingBrief(finding) {
  const f = finding && typeof finding === 'object' ? finding : {};
  const lines = [
    '## Auto-fix target — ONE finding from the automated advisory review panel',
    '',
    'This finding already cleared the blacklist-first auto-fix gate (`we:scripts/conveyor/fix-autofix-gate.mjs`).',
    'Fix ONLY the finding below, scoped to the file it cites. Do not attempt any other finding from the same',
    'review — every auto-fixable finding on this PR is dispatched as its own separate, independently-verified fix.',
    '',
    f.file ? `**File:** \`${f.file}${f.line != null ? `:${f.line}` : ''}\`` : '**File:** (no file anchor)',
    `**Finding:** ${f.summary || '(no summary reported)'}`,
  ];
  if (f.failure_scenario) lines.push(`**Failure scenario:** ${f.failure_scenario}`);
  if (f.category) lines.push(`**Category:** ${f.category}`);
  if (f.impactIfUnfixed) lines.push(`**Impact if unfixed:** ${f.impactIfUnfixed}`);
  return lines.join('\n');
}

/**
 * REAL — `gh pr view <pr> --json baseRefName --repo <repo>`. The PR's base ref is the ground truth of where it
 * lands (a POC-branch-targeted PR is opened with `--base=<deliveryTarget>` by `we:scripts/pr-land.mjs`), so
 * reading it directly avoids needing to parse any `deliveryTarget:` frontmatter at all.
 * @param {{pr: number|string, repo: string}} o
 * @param {{run?: Function}} [io]
 * @returns {string}
 */
export function resolveBaseRefName({ pr, repo }, { run: runFn = run } = {}) {
  const out = runFn('gh', ['pr', 'view', String(pr), '--json', 'baseRefName', '--repo', repo]);
  return JSON.parse(out).baseRefName;
}

/**
 * THE ENTRY POINT — classify every finding in `findings` for auto-fix and dispatch a scoped, verify-gated `fix`
 * for each one that clears the gate. Findings that don't clear it are left exactly as the advisory comment
 * already reported them (task requirement 4: no change to today's behavior there) — this function does not
 * touch the PR's advisory comment, labels, or review state for those.
 *
 * @param {{pr: number|string, repo: string, findings: object[], item?: (number|string|null)}} o
 * @param {{dispatchFixFn?: Function, registry?: object, run?: Function}} [io]
 * @returns {Promise<{tier: string, results: Array<{finding: object, risk: object, dispatched: boolean, outcome?: object}>}>}
 */
export async function autoFixAfterReview({ pr, repo, findings, item = null } = {}, {
  dispatchFixFn = dispatchFix, registry, run: runFn = run,
} = {}) {
  const baseRefName = resolveBaseRefName({ pr, repo }, { run: runFn });
  const tier = resolveAutoFixTier({ baseRefName, registry });
  const list = normalizeFindings(findings);
  const results = [];
  for (const finding of list) {
    if (!finding.file) {
      // No file anchor → cannot be scoped narrowly to a citation at all; never auto-fixable, regardless of tier.
      results.push({
        finding,
        risk: { selfClears: false, batched: false, escalate: false, reason: 'no-file-anchor', tier },
        dispatched: false,
      });
      continue;
    }
    const risk = classifyFindingForAutoFix({ finding, tier });
    if (!risk.selfClears) {
      results.push({ finding, risk, dispatched: false });
      continue;
    }
    const findingOverride = renderScopedFindingBrief(finding);
    let outcome;
    try {
      // eslint-disable-next-line no-await-in-loop -- each fix dispatch acquires its OWN lane and must not race
      // a sibling finding's fix over the same PR ref; sequential is the correct, not merely simpler, shape.
      outcome = await dispatchFixFn({ pr, repo, item, findingOverride }, undefined, { run: runFn });
    } catch (e) {
      outcome = { error: String((e && e.message) || e) };
    }
    results.push({ finding, risk, dispatched: true, outcome });
  }
  return { tier, baseRefName, results };
}
