/**
 * #4317 — a backlog card sitting UNTRACKED inside a daemon clone's own working tree. The approval-time
 * prevention filer (`we:scripts/review-set-label.mjs#fileApprovalPreventionCard`) used to shell `file-item`
 * straight into whatever checkout was reviewing a PR — routinely a read-only daemon clone
 * (`we:scripts/lib/daemon-clone-registry.mjs`) that is never committed to and never pushes. The file it wrote
 * sat there FOREVER: a daemon rebuild's own dirty check reads `git status --untracked-files=no` BY DESIGN (an
 * untracked sidecar must never block a rebuild, `we:scripts/lib/daemon-rebuild.mjs`), so nothing ever surfaced
 * or landed it. Live 2026-09-28: 22 such orphans in `wev-review-daemon`, 1 in `wev-control`, dating to PR
 * #2807.
 *
 * #4317's own fix routes that filing through a real lane instead (`we:scripts/operations/land-prevention-
 * card.mjs`), so a daemon clone should never carry one of these again — this smell is the DEFENSE-IN-DEPTH
 * safety net for the CLASS of failure, not a symptom of the fix itself: something else writing an untracked
 * backlog card straight into a daemon clone, by any future path, still gets caught here.
 *
 * REGISTRATION IS AUTOMATIC — this file needs no entry anywhere. `../health-smells/index.mjs` discovers every
 * module in this directory from disk (`registry-discovery.mjs#loadModuleRegistry`, a top-level `await` at
 * import time); dropping this file in IS the whole registration step, and
 * `../health-smells/__tests__/index-discovery.test.mjs`'s own "one entry per discovered file on disk" assertion
 * already covers it — no separate registration test is needed for this smell specifically.
 *
 * `openAfter`/`closeAfter` are both 1 (mirrors `gh-shim-lane-path.mjs`): the probe itself only ever reports a
 * card once it has already sat untracked past `agedMs`, so the grace period is baked into the PROBE, not the
 * episode hysteresis — an episode should open the very first tick that sees an aged orphan, and close the
 * very first tick the file is gone or tracked (it then simply stops appearing in the probe's own list, which
 * `we:scripts/conveyor/health-watch-core.mjs#stepEpisodes` already treats as clean — see its own "seen" set).
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

export default {
  id: 'untracked-backlog-card',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['untrackedBacklogCards'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'medium',
  action: 'investigate',
  recommendationHint: 'A backlog card is sitting UNTRACKED inside a daemon clone — something wrote it straight into that checkout instead of landing it through a real lane.',
  evaluate({ untrackedBacklogCards }, { now }) {
    return (untrackedBacklogCards || []).map((c) => ({
      subject: `${c.cloneRoot}:${c.rel}`,
      breach: true,
      measure: { cloneRoot: c.cloneRoot, rel: c.rel, ageMin: Math.round((now - c.mtimeMs) / MINUTE) },
      summary: `${c.cloneRoot}: ${c.rel} has sat UNTRACKED for ${fmtAge(now - c.mtimeMs)} — a backlog card was `
        + 'written straight into this daemon clone and never landed.',
      recommendation: `Land ${c.rel} through a real lane (\`we:scripts/operations/land-prevention-card.mjs\` or `
        + 'the ordinary file-item/verify/open-pr sequence), then confirm it reaches `main` — never hand-commit it '
        + `inside ${c.cloneRoot} (a daemon clone is read-only by convention). If this recurs, the product fix is `
        + 'the WRITER that put it there, not cleaning the clone by hand.',
    }));
  },
};
