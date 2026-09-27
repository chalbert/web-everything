#!/usr/bin/env node
/**
 * @file promote-draft-pr-dispatch.mjs
 * @description Draft-first PRs (operator-approved 2026-09-27) — the ONE mechanical pass that acts on
 *   `scripts/conveyor/reconcile-core.mjs`'s new `kind:'promote-draft'` plan entries: a draft PR (opened by
 *   `scripts/pr-land.mjs --park`'s new draft-by-default open) whose required checks are ALL green. The
 *   effect is a single `gh pr ready <pr>` (`scripts/lib/draft-promote-provider.mjs`) — no agent, no lane, no
 *   brief. This is deliberately the SIMPLEST dispatcher in this family (contrast
 *   `scripts/operations/ci-heal-pr-dispatch.mjs`'s lane/claim/brief machinery): nothing here spawns a
 *   session, so there is no claim to race, no lane to pop, no capability profile to gate on.
 *
 * WHAT UN-DRAFTING ACTUALLY DOES: it does not itself dispatch a review. `gh pr ready` only flips GitHub's own
 * draft bit; the review daemon's OWN next tick reads `pr.isDraft: false` off the SAME PR and, since its
 * `review:*` label was already applied at open (`pr-land.mjs --park`'s existing behavior, unchanged), reaches
 * `scripts/conveyor/reconcile-core.mjs#dispatchReviewRow` and dispatches normally — the same review-owed path
 * every non-draft PR already takes. This file's whole job is removing the ONE thing standing between a
 * green-CI draft and that ordinary path.
 *
 * MIRRORS `we:scripts/operations/ci-heal-pr-dispatch.mjs`'s own shape (`runReconcile<X>Dispatch` reading the
 * SAME `runReconcilePass` plan, filtering its own `kind`, and being the reconcile daemon's OWN durable pass —
 * `skills-src/conveyor/runner.mjs` calls this on every tick, right where it calls that file) — never a second
 * reconciliation of its own.
 */
import { repoKeyForSlug } from '../lib/constellation-repos.mjs';
import { armSelfReexecOnFastForward, assertMainNotStale } from '../lib/main-staleness.mjs';
import { createDraftPromoteProvider } from '../lib/draft-promote-provider.mjs';
import { runReconcilePass } from '../conveyor/reconcile-pass.mjs';
import { readPrsFromFile } from '../conveyor/open-pr-fetch.mjs';

/**
 * Run ONE pass: reconcile, filter `kind:'promote-draft'`, call `gh pr ready` on each. Repo-agnostic, same
 * `--repo`/`--prs-file` contract as `ci-heal-pr-dispatch.mjs`'s own `runReconcileCiHealDispatch`.
 * @param {object} [o]
 * @param {string|null} [o.repo] - a constellation repo slug, or `null` for WE (mirrors every sibling dispatcher).
 * @param {Function} [o.reconcile] - injectable, defaults to the real `runReconcilePass`.
 * @param {string} [o.prsFile] - when given, `reconcile` reads this tick's shared PR listing instead of a fresh `gh pr list`.
 * @param {object} [o.provider] - injectable `gh` seam (`createDraftPromoteProvider`'s shape); a test passes a fake.
 * @param {Function} [o.checkStaleness] - threaded straight to `assertMainNotStale`, mirroring every sibling dispatcher's own seam.
 * @returns {{promoted:Array<{pr:number}>, refusals:Array<{pr:number, kind:string, why:string}>, reconcileRefusals:number}}
 */
export function runReconcilePromoteDraftDispatch({
  root = process.cwd(),
  repo = null,
  reconcile = runReconcilePass,
  prsFile,
  provider = createDraftPromoteProvider({ cwd: root }),
  checkStaleness,
} = {}) {
  const repoKey = repo == null ? 'we' : repoKeyForSlug(repo);
  if (repoKey === null) throw new Error(`promote-draft-pr-dispatch: --repo ${repo} is not a constellation repo`);
  // #x1rr9rh (multi-repo slice 2) — guards THIS dispatching checkout's own import path, same as every sibling
  // mechanical pass (`ci-heal-pr-dispatch.mjs`, `reconcile-fix-dispatch.mjs`) — never the target repo.
  assertMainNotStale(root, checkStaleness);
  const reconciled = reconcile({ repo, ...(prsFile ? { readPrs: () => readPrsFromFile(prsFile) } : {}) });
  const entries = (reconciled.dispatch ?? []).filter((entry) => entry.kind === 'promote-draft');
  const promoted = [];
  const refusals = [];
  for (const entry of entries) {
    try {
      provider.ready(entry.prNumber);
      promoted.push({ pr: entry.prNumber });
    } catch (e) {
      // Best-effort, same as every other label/state write in this family (`pr-land.mjs`'s own `applyLabel`):
      // a `gh` hiccup here never throws the whole pass — the PR stays draft and this same plan entry recurs
      // next tick, so a transient failure self-heals within one tick interval rather than needing a retry loop.
      refusals.push({ pr: entry.prNumber, kind: 'ready-failed', why: String((e && e.message) || e).split('\n')[0] });
    }
  }
  return { promoted, refusals, reconcileRefusals: reconciled.refusals?.length ?? 0, reconcileRefusalDetails: reconciled.refusals };
}

const IS_CLI = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (IS_CLI) {
  // Same self-heal as every sibling CLI in this family — re-execute rather than dispatch on old code if this
  // checkout was fast-forwarded underneath a long-lived runner.
  armSelfReexecOnFastForward();
  const flags = {};
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  try {
    const result = runReconcilePromoteDraftDispatch({
      repo: typeof flags.repo === 'string' ? flags.repo : null,
      prsFile: flags['prs-file'],
    });
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      const lines = [`promote-draft-pr-dispatch — ${result.promoted.length} promoted, ${result.refusals.length} refusal(s)`];
      for (const p of result.promoted) lines.push(`  → promoted PR #${p.pr} to ready-for-review (required checks green)`);
      for (const r of result.refusals) lines.push(`  ✗ ${r.kind} PR #${r.pr} — ${r.why}`);
      process.stdout.write(`${lines.join('\n')}\n`);
    }
  } catch (e) {
    process.stderr.write(`✗ promote-draft-pr-dispatch failed: ${String((e && e.message) || e).split('\n')[0]}\n`);
    process.exitCode = 1;
  }
}
