/**
 * Seed smell 10 / #4066 — an open PR carrying review labels that contradict each other, or a stray review label
 * nothing in the conveyor writes. The verdict labels are the reviewer's disposition (`review-escalation.mjs`
 * `REVIEW_LABELS`, #2171), and the drain, the review daemon and the fix daemon each branch on them; a PR that is
 * both `review:accepted` and `review:changes` is read differently by each, and usually means one label writer
 * forgot to remove the label it replaced.
 *
 * What counts ({@link labelConflicts}):
 *   - two verdicts at once: any two of `review:pending` / `review:accepted` / `review:changes`;
 *   - `review:awaiting-advisory` without `review:human` (it is only ever applied alongside it);
 *   - more than one informative `review-status:*` state (`review-status-tag.mjs` keeps exactly one);
 *   - `review-status:stood-down` with a live-work status (`reviewing`, `fixing`, `fixing-conflict`, `healing-ci`):
 *     stood down means no agent should be on it;
 *   - a `review:` label that is not one of the ratified verdicts (a typo or a retired label).
 * `review:human` + `review:accepted` is NOT a conflict (the human clears it in that order), nor is `redteam:accepted`
 * alongside any verdict.
 *
 * `openAfter: 2` gh samples: two label writes 15 minutes apart are never one inconsistent state. `action: 'file'`
 * (4065 table: "alert + file") with a known-fix template; filing stays off until `config.fileDispatch`.
 */
import { REVIEW_LABELS } from '../../lib/review-escalation.mjs';
import { STATUS_LABEL_RE } from '../review-status-tag.mjs';
import { STAND_DOWN_LABEL } from '../stand-down.mjs';

const VERDICTS = [REVIEW_LABELS.pending, REVIEW_LABELS.accepted, REVIEW_LABELS.changes];
const KNOWN_REVIEW = new Set(Object.values(REVIEW_LABELS).filter((l) => l.startsWith('review:')));
const LIVE_WORK_STATUS = /^review-status:(reviewing|fixing|fixing-conflict|healing-ci)$/;

/** PURE: every contradiction or stray label on one PR's label names, each a short human reason. */
export function labelConflicts(labelNames) {
  const names = [...new Set((labelNames || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean))];
  const has = (n) => names.includes(n);
  const out = [];
  const verdicts = VERDICTS.filter(has);
  if (verdicts.length > 1) out.push(`two verdicts at once: ${verdicts.join(' + ')}`);
  if (has(REVIEW_LABELS.awaitingAdvisory) && !has(REVIEW_LABELS.human)) out.push(`${REVIEW_LABELS.awaitingAdvisory} without ${REVIEW_LABELS.human}`);
  const statuses = names.filter((n) => STATUS_LABEL_RE.test(n));
  if (statuses.length > 1) out.push(`more than one review-status: ${statuses.join(' + ')}`);
  if (has(STAND_DOWN_LABEL)) {
    const live = names.filter((n) => LIVE_WORK_STATUS.test(n));
    if (live.length) out.push(`${STAND_DOWN_LABEL} while ${live.join(' + ')}`);
  }
  for (const n of names) if (n.startsWith('review:') && !KNOWN_REVIEW.has(n)) out.push(`stray label ${n}`);
  return out;
}

export default {
  id: 'review-label-conflict',
  scope: 'repo',
  cadence: 'gh',
  probes: ['prs'],
  openAfter: 2,
  closeAfter: 1,
  severity: 'medium',
  action: 'file',
  knownFix: {
    title: 'Contradictory review labels on ${subject}',
    digestTemplate: 'The health watch saw contradictory or stray review labels on ${subject} for two samples in a row. '
      + 'Find which label writer left the stale label (review-set-label.mjs, review-status-tag.mjs, stand-down.mjs) and make the '
      + 'write remove the label it replaces.',
    scope: ['we:scripts/review-set-label.mjs'],
    size: '2',
  },
  recommendationHint: 'A PR carries review labels that contradict each other — the drain and the daemons will disagree about it.',
  evaluate({ prs }) {
    const out = [];
    for (const pr of prs || []) {
      const conflicts = labelConflicts(pr.labels);
      if (!conflicts.length) continue;
      out.push({
        subject: `${pr.repo}#${pr.number}`,
        breach: true,
        measure: { repo: pr.repo, number: pr.number, labels: (pr.labels || []).map((l) => l?.name ?? l), conflicts },
        summary: `${pr.repo}#${pr.number}: ${conflicts.join('; ')}.`,
        recommendation: `Fix the labels on #${pr.number} by hand to the one state it is really in (${conflicts.join('; ')}), `
          + 'then find which writer left the stale one — a label writer that adds a verdict must remove the one it replaces.',
      });
    }
    return out;
  },
};
