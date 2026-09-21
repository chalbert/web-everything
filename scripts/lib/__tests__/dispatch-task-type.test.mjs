/**
 * @file scripts/lib/__tests__/dispatch-task-type.test.mjs
 * @description #3717 — the `taskType` DERIVATION, table-driven.
 *
 * The property under test is the operator's acceptance test: **no model judgment anywhere between the dispatch
 * kind and the chosen provider**. What that means concretely for this module is three things, each asserted
 * below rather than asserted in a comment:
 *
 *   1. every dispatch kind and cause the repo actually dispatches maps to a STATED `taskType`;
 *   2. a dispatch that maps to none is REFUSED with a named reason, never defaulted (which is what
 *      `provider-routing.mjs#selectProvider`'s own `task?.taskType || 'bugfix'` would otherwise do);
 *   3. the three `taskType`s with no producing dispatch kind stay unreachable.
 *
 * The table itself is EXECUTED, not described: `DISPATCH_TASK_TYPE_TABLE` carries a concrete example dispatch
 * per row, and the first test runs the real function over every one of them. A row added to the module with no
 * matching behaviour fails here.
 */
import { describe, it, expect } from 'vitest';

import {
  CODE_CHANGE_DISPATCH_KINDS,
  CONFLICT_CAUSE,
  DISPATCH_CAUSES,
  DISPATCH_TASK_TYPE_TABLE,
  ROLE_DISPATCH_KINDS,
  TASK_TYPES_WITHOUT_PRODUCING_KIND,
  isDocScopePath,
  normalizeScopePath,
  taskTypeFor,
} from '../dispatch-task-type.mjs';
import { LAUNCH_KINDS } from '../../operations/dispatch-lane.mjs';
import { PROVEN_TASK_ENVELOPES } from '../provider-routing.mjs';

describe('the derivation table is executed, not described', () => {
  it.each(DISPATCH_TASK_TYPE_TABLE.map((row) => [row.note, row]))('%s', (_note, row) => {
    const got = taskTypeFor(row.example);
    expect(got.outcome).toBe(row.outcome);
    expect(got.taskType).toBe(row.taskType);
    expect(got.reason).toBeTruthy();
  });

  it('covers every launch kind `dispatch-lane` can dispatch — no kind falls off the table', () => {
    for (const kind of LAUNCH_KINDS) {
      const got = taskTypeFor({ kind, cause: null, scopePaths: ['we:scripts/lib/example.mjs'] });
      expect(got.outcome, `${kind} must be derivable or an explicit role`).not.toBe('refused');
    }
    // and the two axes partition those kinds plus `review`, with nothing in both
    expect(CODE_CHANGE_DISPATCH_KINDS.filter((k) => ROLE_DISPATCH_KINDS.includes(k))).toEqual([]);
    expect([...CODE_CHANGE_DISPATCH_KINDS, ...ROLE_DISPATCH_KINDS].filter((k) => k !== 'review').sort())
      .toEqual([...LAUNCH_KINDS].sort());
  });

  it('every derived taskType is one the router actually has an envelope or a role path for', () => {
    const known = [...Object.keys(PROVEN_TASK_ENVELOPES), 'triage-research', 'architectural-decision'];
    for (const row of DISPATCH_TASK_TYPE_TABLE) {
      if (row.outcome !== 'task-type') continue;
      expect(known).toContain(row.taskType);
    }
  });
});

describe('the refuse rule — never a guess, never a default', () => {
  it('refuses an unknown dispatch kind by name rather than defaulting to `bugfix`', () => {
    const got = taskTypeFor({ kind: 'transmogrify', cause: null, scopePaths: ['we:scripts/a.mjs'] });
    expect(got.outcome).toBe('refused');
    expect(got.taskType).toBeNull();
    expect(got.reason).toContain('transmogrify');
    expect(got.reason).toContain('Refusing');
  });

  it('refuses a dispatch with no kind at all', () => {
    for (const kind of [undefined, null, '', '   ']) {
      expect(taskTypeFor({ kind, scopePaths: ['we:scripts/a.mjs'] }).outcome).toBe('refused');
    }
    expect(taskTypeFor().outcome).toBe('refused');
  });

  it('refuses a cause outside the closed vocabulary instead of ignoring it', () => {
    const got = taskTypeFor({ kind: 'fix', cause: 'vibes', scopePaths: ['we:scripts/a.mjs'] });
    expect(got.outcome).toBe('refused');
    expect(got.reason).toContain('vibes');
    for (const cause of DISPATCH_CAUSES) {
      expect(taskTypeFor({ kind: 'fix', cause, scopePaths: ['we:scripts/a.mjs'] }).outcome).toBe('task-type');
    }
  });

  it('refuses a `build` with no declared scope — `doc-fix` is scope-derived, so there is nothing to derive from', () => {
    const got = taskTypeFor({ kind: 'build', cause: null, scopePaths: [] });
    expect(got.outcome).toBe('refused');
    expect(got.reason).toContain('doc-fix');
  });

  it('never returns a taskType outside the table for any kind × cause × scope combination it accepts', () => {
    const scopes = [[], ['we:scripts/a.mjs'], ['we:docs/agent/a.md'], ['we:docs/agent/a.md', 'we:scripts/a.mjs']];
    const produced = new Set();
    for (const kind of [...LAUNCH_KINDS, 'review', 'self-fix', 'other', '']) {
      for (const cause of [null, ...DISPATCH_CAUSES, 'nonsense']) {
        for (const scopePaths of scopes) {
          const got = taskTypeFor({ kind, cause, scopePaths });
          expect(['task-type', 'role', 'refused']).toContain(got.outcome);
          if (got.taskType) produced.add(got.taskType);
        }
      }
    }
    expect([...produced].sort()).toEqual(['bugfix', 'build-new-feature', 'conflict-resolution', 'doc-fix']);
  });
});

describe('the three taskTypes with no producing dispatch kind', () => {
  it('names all three, with a reason each', () => {
    expect(Object.keys(TASK_TYPES_WITHOUT_PRODUCING_KIND).sort())
      .toEqual(['conflict-resolution', 'other', 'self-fix']);
    for (const why of Object.values(TASK_TYPES_WITHOUT_PRODUCING_KIND)) expect(why).toBeTruthy();
  });

  it('`self-fix` and `other` are UNREACHABLE — no kind, no cause, no scope produces either', () => {
    for (const kind of [...LAUNCH_KINDS, 'review', 'self-fix', 'other']) {
      for (const cause of [null, ...DISPATCH_CAUSES]) {
        for (const scopePaths of [[], ['we:scripts/a.mjs'], ['we:docs/a.md']]) {
          const got = taskTypeFor({ kind, cause, scopePaths });
          expect(got.taskType).not.toBe('self-fix');
          expect(got.taskType).not.toBe('other');
        }
      }
    }
  });

  it('`conflict-resolution` comes from the CAUSE and from no kind at all', () => {
    expect(taskTypeFor({ kind: 'fix', cause: CONFLICT_CAUSE, scopePaths: ['we:scripts/a.mjs'] }).taskType)
      .toBe('conflict-resolution');
    for (const kind of [...LAUNCH_KINDS, 'review']) {
      expect(taskTypeFor({ kind, cause: null, scopePaths: ['we:scripts/a.mjs'] }).taskType)
        .not.toBe('conflict-resolution');
    }
    // and the cause only means that on a `fix`: a conflict-caused `build` is not a conflict resolution
    expect(taskTypeFor({ kind: 'build', cause: CONFLICT_CAUSE, scopePaths: ['we:scripts/a.mjs'] }).taskType)
      .toBe('build-new-feature');
  });
});

describe('the role path is a third outcome, not a taskType and not a refusal', () => {
  it.each(ROLE_DISPATCH_KINDS)('%s takes the role path with no taskType', (kind) => {
    const got = taskTypeFor({ kind, cause: null, scopePaths: ['we:backlog/1-x.md'] });
    expect(got.outcome).toBe('role');
    expect(got.role).toBe(kind);
    expect(got.taskType).toBeNull();
    expect(got.reason).toContain('role');
  });

  it('a role dispatch stays a role however its scope looks — the KIND decides, not the files', () => {
    for (const scopePaths of [[], ['we:scripts/a.mjs'], ['we:docs/a.md']]) {
      expect(taskTypeFor({ kind: 'prepare', cause: null, scopePaths }).outcome).toBe('role');
    }
  });
});

describe('the all-docs rule', () => {
  it('a `build` is a doc-fix only when EVERY declared scope path is documentation', () => {
    const doc = taskTypeFor({ kind: 'build', cause: null, scopePaths: ['we:docs/agent/a.md', 'README.md'] });
    expect(doc.taskType).toBe('doc-fix');
    const mixed = taskTypeFor({ kind: 'build', cause: null, scopePaths: ['we:docs/agent/a.md', 'we:scripts/a.mjs'] });
    expect(mixed.taskType).toBe('build-new-feature');
  });

  it('classifies paths by suffix and by the `docs/` home, after stripping the repo qualifier', () => {
    for (const p of ['we:docs/agent/x.md', 'docs/anything.json', './notes.txt', 'frontierui:README.md', 'a/b.mdx']) {
      expect(isDocScopePath(p), p).toBe(true);
    }
    for (const p of ['we:scripts/a.mjs', 'src/x.ts', 'documentation/x.ts', '', '   ']) {
      expect(isDocScopePath(p), p).toBe(false);
    }
  });

  it('normalises a repo-qualified scope path the same way the contract does', () => {
    expect(normalizeScopePath('we:scripts/a.mjs')).toBe('scripts/a.mjs');
    expect(normalizeScopePath('frontierui:src/a.ts')).toBe('frontierui/src/a.ts');
    expect(normalizeScopePath('./a.mjs')).toBe('a.mjs');
    expect(normalizeScopePath(null)).toBe('');
  });
});
