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
 * episode hysteresis — a clone's episode should open the very first tick that sees an aged orphan in it, and
 * close the very first tick its LAST orphan is gone or tracked (the clone then simply stops appearing in this
 * smell's output, which `we:scripts/conveyor/health-watch-core.mjs#stepEpisodes` already treats as clean — see
 * its own "seen" set).
 *
 * THE ACCEPTED TRADE-OFF of one episode per clone: a NEW orphan dropped into a clone whose episode is already
 * open raises no fresh `opened` transition — it only appears in that episode's `measure.rels`/`count`. That is
 * the price of bounding the episode count; the open episode already says "this clone has orphans, find the
 * writer", which a new orphan does not change.
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
  // ONE EPISODE PER CLONE, not per card (#4317 advisory review, 2026-09-29): per-card subjects turned the 23
  // live orphans into 23 `investigate` episodes on the first tick — one problem per clone, so one episode per
  // clone, bounded by the number of daemon clones however large the orphan backlog grows. The episode closes
  // once the clone's LAST orphan lands or disappears.
  evaluate({ untrackedBacklogCards }, { now }) {
    const byClone = new Map();
    for (const c of untrackedBacklogCards || []) {
      if (!byClone.has(c.cloneRoot)) byClone.set(c.cloneRoot, []);
      byClone.get(c.cloneRoot).push(c);
    }
    return [...byClone].map(([cloneRoot, cards]) => {
      const rels = cards.map((c) => c.rel).sort();
      const oldestMs = Math.min(...cards.map((c) => c.mtimeMs));
      const what = cards.length === 1 ? rels[0] : `${cards.length} backlog cards (oldest ${fmtAge(now - oldestMs)})`;
      return {
        subject: cloneRoot,
        breach: true,
        measure: { cloneRoot, count: cards.length, rels, ageMin: Math.round((now - oldestMs) / MINUTE) },
        summary: `${cloneRoot}: ${what} ${cards.length === 1 ? 'has' : 'have'} sat UNTRACKED for `
          + `${cards.length === 1 ? '' : 'up to '}${fmtAge(now - oldestMs)} — written straight into this daemon `
          + 'clone and never landed.',
        recommendation: `Land ${cards.length === 1 ? rels[0] : `each of ${rels.slice(0, 5).join(', ')}${rels.length > 5 ? ', …' : ''}`} `
          + 'through a real lane (`we:scripts/operations/land-prevention-card.mjs` or the ordinary '
          + `file-item/verify/open-pr sequence), then confirm it reaches \`main\` — never hand-commit inside ${cloneRoot} `
          + '(a daemon clone is read-only by convention). If this recurs, the product fix is the WRITER that put it '
          + 'there, not cleaning the clone by hand.',
      };
    });
  },
};
