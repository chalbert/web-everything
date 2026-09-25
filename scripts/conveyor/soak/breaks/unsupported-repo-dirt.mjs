/**
 * @file breaks/unsupported-repo-dirt.mjs — live break 1a, 2026-09-25 morning. The fix-dispatch daemon records
 * which repos cannot take which action (`we:scripts/conveyor/unsupported-repo.mjs#recordUnsupported`) EVERY tick,
 * into `.conveyor/unsupported-repo.json` resolved by script location — i.e. inside the daemon's own clone. The
 * path was not gitignored (unlike every sibling `.conveyor/*.json`), so the clone read dirty from its first tick,
 * self-sync refused to merge main ("dirty"), and every dispatch after that was refused as stale.
 * Fix: `14b2e4096` (card x4cteem) gitignores the path. On main.
 *
 * Scenario: the plain soak world for a few rounds with main moving — nothing special is needed, the daemon writes
 * the file on its own. RED = the clone goes dirty and then falls behind main.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';

export default {
  id: 'unsupported-repo-dirt',
  title: 'fix daemon writes .conveyor/unsupported-repo.json into its own clone; the dirty clone freezes self-sync',
  card: 'we:backlog/x4cteem (epic #4075)',
  fixedBy: { sha: '14b2e4096', where: 'main', paths: ['.gitignore'] },
  fixPresent(root) {
    try { return /^\.conveyor\/unsupported-repo\.json$/m.test(readFileSync(join(root, '.gitignore'), 'utf8')); } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({ name: 'break:unsupported-repo-dirt', rounds: 5, mainEvery: 2, scorecards: false, log });
  },
  judge(report) {
    return report.violations
      .filter((v) => ['clean', 'behind', 'lag', 'stale'].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
