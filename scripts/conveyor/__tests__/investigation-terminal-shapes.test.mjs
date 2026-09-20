/**
 * @file scripts/conveyor/__tests__/investigation-terminal-shapes.test.mjs
 * @description The investigation brief (#3567, `we:skills-src/conveyor/investigation-agent-brief.md`)
 *   documents TWO terminal shapes an investigation ends with — report-only (writes no new backlog file) and
 *   file-item-terminal (files one or more real backlog items through the declared `file-item` operation,
 *   never a hand-scaffold). This mirrors #3150's own parameterized-terminal test pattern
 *   (`we:scripts/operations/__tests__/explore.test.mjs`): the SAME harness exercised twice, once per
 *   terminal shape, asserting each produces exactly what it documents.
 *
 *   The investigation dispatch itself has no CLI `--terminal` flag the way `explore.mjs` does — which
 *   terminal shape an investigation takes is a single agent's judgment call about its OWN findings, not a
 *   declared operation's parameter. So the harness below parameterizes the one thing that IS deterministic:
 *   whether the investigation, in reaching its verdict, calls `file-item`'s own scaffold write
 *   (`we:scripts/operations/scaffold.mjs#planScaffold`, reused verbatim by `file-item` — see that file's own
 *   header) at all.
 *
 *   WHAT THIS DOES NOT COVER, stated plainly: this exercises `file-item`'s PRE-EXISTING, already-tested
 *   scaffold/queue primitive — not any of #3567's own new code (`dispatch-plan.mjs`'s `needs-investigation`
 *   hold, `tick-core.mjs`'s `spawnInvestigations`, or `dispatch-lane.mjs`'s `investigate` launch kind, each
 *   already covered by their OWN dedicated tests elsewhere). An investigation's actual choice of terminal
 *   shape is a live agent's runtime judgment call inside `investigation-agent-brief.md`'s prose — no unit
 *   test can exercise that judgment. This file's only claim is narrower: IF an investigation takes the
 *   file-item-terminal path, the primitive it is instructed to call really does produce a real, queue-eligible
 *   backlog file — and IF it takes report-only, nothing is produced. Read it as coverage of the PRIMITIVE the
 *   brief depends on, not of the brief's own runtime decision.
 */
import { describe, it, expect } from 'vitest';
import { planScaffold } from '../../operations/scaffold.mjs';
import { planQueueing } from '../../operations/file-item.mjs';

const read = (over = {}) => ({
  existingIds: ['3567', '0001'],
  today: '2026-09-08',
  dir: '/repo/backlog',
  ...over,
});

/**
 * THE SAME HARNESS #3150's own parameterized-terminal test exercises twice, adapted to the investigation
 * brief's two documented terminal shapes: `'report-only'` never calls the scaffold write at all (the
 * investigation's findings live only in its own report); `'file-item-terminal'` calls it once per finding
 * worth filing, exactly as `file-item` does under the hood. Returns the verdict(s) produced, or `[]` for the
 * report-only shape — never a fabricated file.
 * @param {'report-only'|'file-item-terminal'} terminal
 * @param {object[]} findings - the finding(s) to file, only consulted when `terminal === 'file-item-terminal'`
 * @returns {object[]} the `planScaffold` verdict for each filed finding — empty for report-only
 */
function exerciseInvestigationTerminal(terminal, findings = []) {
  if (terminal === 'report-only') return [];
  return findings.map((f) => planScaffold(read(), f));
}

describe('investigation terminal shapes — the file-item PRIMITIVE they depend on (#3567, mirrors #3150\'s parameterized-terminal pattern)', () => {
  it('report-only produces NO backlog file — the harness never touches the scaffold write', () => {
    const verdicts = exerciseInvestigationTerminal('report-only', [
      { kind: 'story', title: 'a finding that turned out not to warrant filing', size: '3', digest: 'we:x.mjs' },
    ]);
    expect(verdicts).toEqual([]);
  });

  it('file-item-terminal produces a REAL, queue-eligible backlog file per filed finding', () => {
    const verdicts = exerciseInvestigationTerminal('file-item-terminal', [
      { kind: 'story', title: 'a finding filed by an investigation', size: '3', digest: 'we:scripts/example.mjs — root cause traced by the investigation' },
    ]);
    expect(verdicts).toHaveLength(1);
    const [verdict] = verdicts;
    // A real file: a resolvable path, non-empty rendered content, and — the point of file-item over a bare
    // scaffold — it is queue-eligible for the conveyor to pick up on a later tick.
    expect(verdict.rel).toMatch(/^backlog\/.*\.md$/);
    expect(verdict.content.length).toBeGreaterThan(0);
    expect(planQueueing(verdict, {})).toEqual({ queueing: true, reason: expect.stringContaining('ready to clear') });
  });

  it('the SAME harness produces zero files for report-only and N files for N findings on file-item-terminal', () => {
    const findings = [
      { kind: 'task', title: 'finding one', digest: 'we:a.mjs' },
      { kind: 'task', title: 'finding two', digest: 'we:b.mjs' },
    ];
    expect(exerciseInvestigationTerminal('report-only', findings)).toHaveLength(0);
    expect(exerciseInvestigationTerminal('file-item-terminal', findings)).toHaveLength(2);
  });
});
