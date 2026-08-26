import { describe, it, expect } from 'vitest';
import {
  doneWhenSection,
  doneWhenCriteria,
  candidateNeedles,
  resolvedWithTodo,
  staleGateCount,
  danglingWikilink,
  danglingHashId,
  grepLiteralMismatch,
  vacuousExecutableCriterion,
  scopeOmitsDoneWhenFile,
  citationLineContent,
} from '../gates.mjs';
import { covers } from '../replay-gates.mjs';

const card = (body) => `---\nkind: story\nstatus: open\n---\n\n# A card\n\n${body}\n`;

describe('doneWhenCriteria — criteria wrap across physical lines', () => {
  it('joins a criterion with its continuation lines', () => {
    const { body } = doneWhenSection(card('## Done when\n\n1. **Executable** — grepping `we:a/b.md`\n   for `needle` returns nothing.\n2. second\n'));
    const crits = doneWhenCriteria(body);
    expect(crits).toHaveLength(2);
    // The regression this pins: the path is on line 1 and the claim on line 2. A per-line scan sees
    // neither half, which is exactly why the first replay of grep-literal-mismatch scored 0.
    expect(crits[0].text).toContain('we:a/b.md');
    expect(crits[0].text).toContain('returns nothing');
  });
});

describe('candidateNeedles — the path being grepped is not the needle', () => {
  it('drops bare paths and path:line loci, keeps the literal', () => {
    const n = candidateNeedles('grepping `we:skills-src/conveyor/SKILL.md` for `dispatch-lane` returns nothing');
    expect(n).toEqual(['dispatch-lane']);
  });
  it('drops a npm run command', () => {
    expect(candidateNeedles('`npm run check:standards` passes')).toEqual([]);
  });
});

describe('staleGateCount', () => {
  it('flags a hyphen-joined count — "1435-warning" is the repo\'s own phrasing', () => {
    const out = staleGateCount(card('## Done when\n\n1. no new warnings against the 0-error / 1435-warning baseline.\n'), { path: 'backlog/x.md' });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('1435');
  });
  it('does not flag "0 errors", which is a stable target rather than a drifting count', () => {
    expect(staleGateCount(card('## Done when\n\n1. `check:standards` reports 0 errors.\n'), { path: 'backlog/x.md' })).toEqual([]);
  });
});

describe('grepLiteralMismatch', () => {
  const read = (p) => (p === 'skills-src/conveyor/SKILL.md' ? 'line one\nmentions dispatch-lane here\nline three\n' : null);

  it('flags a criterion claiming absence when the literal is present', () => {
    const out = grepLiteralMismatch(
      card('## Done when\n\n1. **Executable** — grepping `we:skills-src/conveyor/SKILL.md` for `dispatch-lane`\n   returns hits. It returns nothing today.\n'),
      { path: 'backlog/x.md', read },
    );
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('dispatch-lane');
    expect(out[0].message).toMatch(/has 1 hit/);
  });

  it('does not read a LINE REFERENCE as an occurrence count', () => {
    // Regression: `/…(\d+)/` matched the 77 in "the line-77 mention" and reported "a count of 77",
    // a confidently wrong message that then matched a real finding by keyword and inflated recall.
    const out = grepLiteralMismatch(
      card('## Done when\n\n1. **Executable** — the line-77 mention of `dispatch-lane` in `we:skills-src/conveyor/SKILL.md` occurs once.\n'),
      { path: 'backlog/x.md', read },
    );
    expect(out.filter((f) => /count of 77/.test(f.message))).toEqual([]);
  });
});

describe('vacuousExecutableCriterion', () => {
  it('flags a criterion that already passes before the work is done', () => {
    const read = () => 'nothing relevant here\n';
    const out = vacuousExecutableCriterion(
      card('## Done when\n\n1. **Executable** — grepping `we:a/b.md` for `Spawn it as one background Agent` returns zero hits.\n'),
      { path: 'backlog/x.md', read },
    );
    expect(out).toHaveLength(1);
    expect(out[0].message).toMatch(/already matches zero times/);
  });
});

describe('danglingWikilink', () => {
  const list = () => ['agent-memory-src/104-feedback_commit_to_default_branch_ok.md'];
  it('flags a wikilink that resolves to nothing', () => {
    const out = danglingWikilink('see [[104-edit-work-runs-in-a-lane-clone]]\n', { path: 'agent-memory-src/x.md', list });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('104-edit-work-runs-in-a-lane-clone');
  });
  it('resolves a link that matches an existing slug', () => {
    expect(danglingWikilink('see [[104-feedback_commit_to_default_branch_ok]]\n', { path: 'agent-memory-src/x.md', list })).toEqual([]);
  });
});

describe('danglingHashId', () => {
  it('flags an id that resolves neither by filename nor bornAs', () => {
    const out = danglingHashId(card('body cites #x2sqf62 as the prior instance.'), { path: 'backlog/x.md', knownHashIds: () => new Set(['xabc123']) });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('x2sqf62');
  });
  it('accepts an id carried by bornAs after JIT-numbering', () => {
    expect(danglingHashId(card('cites #xabc123.'), { path: 'backlog/x.md', knownHashIds: () => new Set(['xabc123']) })).toEqual([]);
  });
});

describe('resolvedWithTodo', () => {
  it('flags a resolved card whose Done-when still holds the scaffold placeholder', () => {
    const t = '---\nstatus: resolved\n---\n\n## Done when\n\nTODO: a command that fails before and passes after.\n';
    expect(resolvedWithTodo(t, { path: 'backlog/x.md' })).toHaveLength(1);
  });
  it('ignores an open card', () => {
    const t = '---\nstatus: open\n---\n\n## Done when\n\nTODO: fill this in.\n';
    expect(resolvedWithTodo(t, { path: 'backlog/x.md' })).toEqual([]);
  });
});

describe('scopeOmitsDoneWhenFile', () => {
  it('flags a Done-when file the scope does not cover', () => {
    const t = '---\nscope:\n  - we:skills-src/conveyor/SKILL.md\n---\n\n## Done when\n\n1. a test in `we:skills-src/conveyor/__tests__/runner.test.mjs` asserts it.\n';
    const out = scopeOmitsDoneWhenFile(t, { path: 'backlog/x.md' });
    expect(out.map((f) => f.subject)).toContain('skills-src/conveyor/__tests__/runner.test.mjs');
  });
});

describe('citationLineContent', () => {
  it('flags a locus whose named symbol is far from the cited line', () => {
    const read = () => `${'x\n'.repeat(20)}function gitPushMain() {}\n${'y\n'.repeat(20)}function realPush() {}\n`;
    const out = citationLineContent('the push it does itself (`we:scripts/pr-land.mjs:5`) calls `realPush` first.', { path: 'backlog/x.md', read });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('scripts/pr-land.mjs:5');
  });
  it('stays silent when the symbol sits at the cited line', () => {
    const read = () => 'a\nb\nfunction realPush() {}\nd\n';
    expect(citationLineContent('see `we:scripts/pr-land.mjs:3` for `realPush`.', { path: 'backlog/x.md', read })).toEqual([]);
  });
});

describe('covers — the scoring matcher', () => {
  const label = { path: 'backlog/x.md', line: 102, summary: 'criterion 1 claims grepping SKILL.md for `dispatch-lane` returns nothing today' };

  it('CONTENT matches when the gate names the same thing the reviewer described', () => {
    expect(covers({ path: 'backlog/x.md', line: 138, subject: 'dispatch-lane' }, label, 3, 'content')).toBe(true);
  });

  it('CONTENT refuses a gate that fired in the same file for an unrelated reason', () => {
    // This is why file-level scoring was rejected: it counted this as a catch.
    expect(covers({ path: 'backlog/x.md', line: 268, subject: 'scripts/pr-land.mjs' }, label, 3, 'content')).toBe(false);
    expect(covers({ path: 'backlog/x.md', line: 268, subject: 'scripts/pr-land.mjs' }, label, 3, 'file')).toBe(true);
  });

  it('LINE scoring misses a correct gate, because the reviewer\'s own line number is wrong', () => {
    // The gate flags line 138; the reviewer recorded the same defect at 102. Proximity says "miss".
    expect(covers({ path: 'backlog/x.md', line: 138, subject: 'dispatch-lane' }, label, 3, 'line')).toBe(false);
  });
});
