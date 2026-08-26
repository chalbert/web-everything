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
import { GATES } from '../gates.mjs';
import { covers } from '../replay-gates.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The two files' own source, so a doc claim can be pinned to the code it describes. */
const GATES_SOURCE = readFileSync(resolve(HERE, '..', 'gates.mjs'), 'utf8');
const REPLAY_SOURCE = readFileSync(resolve(HERE, '..', 'replay-gates.mjs'), 'utf8');

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

// ── #3340: the gate modelled ONE shape of vacuity (absence) and missed the common one ─────────────────
// A criterion whose command is a test-runner invocation under a name filter is green before the work
// exists: `vitest … -t "#NNNN"` on a tree with no matching test is a selection of ZERO, and vitest exits
// 0 on an empty selection. The specimen below is the pre-fix #3319 criterion, quoted VERBATIM from
// `backlog/3340-…md`. It is quoted rather than cited by sha on purpose: the two commits that
// introduced and then fixed it never landed on `main`, so a sha would not resolve for anyone.
describe('vacuousExecutableCriterion — #3340 the empty-selection shape', () => {
  const read = () => 'nothing relevant here\n';
  const fire = (body) => vacuousExecutableCriterion(card(`## Done when\n\n${body}\n`), { path: 'backlog/x.md', read });

  /** The #3319 criterion as it was written before its own fix, verbatim. */
  const PRE_FIX_3319 = '1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-pr.test.mjs -t "#3319"` (drop the\n'
    + '   `we:` prefix when actually running it). Fails before this item lands — no `judgeSecurity` step exists and\n'
    + '   the run reaches `confirm` after ONE judge suspend — and passes after.';

  it('#3340 flags the pre-fix #3319 criterion exactly once', () => {
    const out = fire(PRE_FIX_3319);
    expect(out.filter((f) => f.gate === 'vacuous-executable-criterion')).toHaveLength(1);
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('-t "#3319"');
    expect(out[0].message).toMatch(/selection of zero/i);
  });

  it('#3340 does NOT flag the fixed form, which asserts the run actually ran tests', () => {
    // This is #3319's own landed fix, and the shape the repo treats as correct. A gate that flags this
    // is a gate people route around, after which it protects nothing.
    expect(fire('1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-pr.test.mjs -t "#3319" | grep -qE "Tests +[0-9]+ passed"`.\n   Fails before this item lands and passes after.')).toEqual([]);
    // Same assertion stated in prose rather than piped.
    expect(fire('1. **Executable** — `npx vitest run gates -t "#3340"`; the run reports `Tests  2 passed` after, and 0 before.')).toEqual([]);
    // And the runner flag that turns an empty selection into a failure.
    expect(fire('1. **Executable** — `npx vitest run gates -t "#3340" --passWithNoTests=false`.')).toEqual([]);
  });

  it('#3340 does NOT flag an unfiltered run, which fails honestly on an empty tree', () => {
    expect(fire('1. **Executable** — `npx vitest run we:scripts/review-corpus/__tests__/gates.test.mjs` is green.')).toEqual([]);
    expect(fire('1. **Executable** — `npm run check:standards` reports 0 errors.')).toEqual([]);
  });

  it('#3340 keeps the absence predicate beside the new one, not in place of it', () => {
    const out = fire('1. **Executable** — grepping `we:a/b.md` for `Spawn it as one background Agent` returns zero hits.');
    expect(out).toHaveLength(1);
    expect(out[0].message).toMatch(/already matches zero times/);
  });

  it('#3340 catches --testNamePattern, the long spelling of the same filter', () => {
    const out = fire('1. **Executable** — `npx vitest run gates --testNamePattern "#1234"`.');
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('--testNamePattern "#1234"');
  });

  it('#3340 emits a subject the default matcher can score on', () => {
    for (const f of fire(PRE_FIX_3319)) {
      expect(f.subject.trim().length).toBeGreaterThanOrEqual(3);
      expect(covers({ ...f }, { path: f.path, line: f.line, summary: f.subject }, 3, 'content')).toBe(true);
    }
  });

  it('#3340 the gate header states the general rule the shapes are instances of', () => {
    // Naming the rule is what stops the next shape being filed as a third unrelated card.
    expect(GATES_SOURCE).toMatch(/a criterion is vacuous when its success\s+\*?\s*\*?is independent of the work/i);
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

  it('LINE fails CLOSED on a label with no line of its own, instead of degrading into FILE', () => {
    // RETRACTED BEHAVIOUR (#1571 review, the juror's non-blocking `correctness` finding). `line` mode used
    // to `return true` for a label whose own line is null or 0, which made it match ANY hit anywhere in the
    // same file — silently becoming the `file` matcher this file's header calls the worse of the two. It is
    // not a corner case: 5 of the corpus's 39 confirmed labels carry a null or 0 line, and one of them was
    // the whole of `stale-gate-count`'s apparent catch under `--match=line`. Unanswerable is now "no".
    const unlocated = { path: 'backlog/x.md', line: null, summary: 'a totally different defect' };
    expect(covers({ path: 'backlog/x.md', line: 999, subject: 'unrelated' }, unlocated, 3, 'line')).toBe(false);
    expect(covers({ path: 'backlog/x.md', line: 999, subject: 'unrelated' }, { ...unlocated, line: 0 }, 3, 'line')).toBe(false);
    // The contrast that makes the point: `file` still says yes, and `content` still says no for its own reason.
    expect(covers({ path: 'backlog/x.md', line: 999, subject: 'unrelated' }, unlocated, 3, 'file')).toBe(true);
    expect(covers({ path: 'backlog/x.md', line: 999, subject: 'unrelated' }, unlocated, 3, 'content')).toBe(false);
    // And an unlocated label is still matchable under the DEFAULT matcher, which never reads a line at all.
    expect(covers({ path: 'backlog/x.md', line: 999, subject: 'different defect' }, unlocated, 3, 'content')).toBe(true);
  });
});

// ── THE DOCS ARE PART OF THE CONTRACT (#1571 review, `claim-accuracy` x2) ──────────────────────────────────
// Two doc blocks in this pair of files described a shape and a default the code does not have: `gates.mjs`'s
// `Finding` typedef omitted `subject`, the one field the default matcher depends on entirely; and
// `replay-gates.mjs` named FILE-LEVEL as the default while the signature has always read `mode = 'content'`.
// Both are retracted in place. These tests pin the corrected claims to the code, so the next drift reddens
// instead of shipping — the same treatment the `#1569` allowlist-count claim already gets.

describe('every gate emits the `subject` the default matcher scores on', () => {
  // WHY THIS MATTERS MORE THAN IT LOOKS. `covers()` in content mode bails at `subject.length < 3` and
  // returns false. A gate that forgets `subject` therefore scores a structural ZERO against every label in
  // the corpus — no error, no warning, just a gate that appears to catch nothing. The typedef used to
  // document exactly that broken shape.
  const SAMPLES = [
    ['resolved-with-todo', () => resolvedWithTodo('---\nstatus: resolved\n---\n\n## Done when\n\nTODO: fill this in.\n', { path: 'backlog/x.md' })],
    ['stale-gate-count', () => staleGateCount(card('## Done when\n\n1. no new warnings against the 0-error / 1435-warning baseline.\n'), { path: 'backlog/x.md' })],
    ['scope-omits-donewhen-file', () => scopeOmitsDoneWhenFile('---\nscope:\n  - we:skills-src/conveyor/SKILL.md\n---\n\n## Done when\n\n1. a test in `we:skills-src/conveyor/__tests__/runner.test.mjs` asserts it.\n', { path: 'backlog/x.md' })],
    ['citation-line-content', () => citationLineContent('the push it does itself (`we:scripts/pr-land.mjs:5`) calls `realPush` first.', { path: 'backlog/x.md', read: () => `${'x\n'.repeat(20)}function gitPushMain() {}\n${'y\n'.repeat(20)}function realPush() {}\n` })],
  ];

  it.each(SAMPLES)('%s emits a subject of at least 3 characters on every finding', (_name, fire) => {
    const out = fire();
    expect(out.length).toBeGreaterThan(0);
    for (const f of out) {
      expect(typeof f.subject).toBe('string');
      expect(f.subject.trim().length).toBeGreaterThanOrEqual(3);
      expect(covers({ ...f }, { path: f.path, line: f.line, summary: f.subject }, 3, 'content')).toBe(true);
    }
  });

  it('every gate in the registry has a sample above, so a ninth gate cannot skip this check unnoticed', () => {
    // The other four gates are exercised with `subject` assertions in their own describes higher up; this
    // pins the REGISTRY size, so adding a gate without adding coverage for its subject reddens here.
    expect(GATES).toHaveLength(8);
    expect(GATES.map((g) => g.name)).toEqual([
      'resolved-with-todo', 'stale-gate-count', 'dangling-wikilink', 'dangling-hash-id',
      'grep-literal-mismatch', 'vacuous-executable-criterion', 'scope-omits-donewhen-file',
      'citation-line-content',
    ]);
  });

  it('the `Finding` typedef documents `subject`, and no longer documents the shape without it', () => {
    const live = GATES_SOURCE.replace(/^ \* RETRACTED[\s\S]*?^ \*\//m, '');
    expect(live).toMatch(/@property \{string\} subject/);
    expect(live).not.toMatch(/\{\{gate:string, path:string, line:number, message:string\}\}/);
  });
});

describe('replay-gates documents the matcher it actually defaults to', () => {
  it('`covers` defaults to content when no mode is passed', () => {
    const label = { path: 'backlog/x.md', line: 102, summary: 'grepping for `dispatch-lane` returns nothing' };
    // Same file, unrelated subject: content says no, file says yes. Omitting the mode must behave as content.
    expect(covers({ path: 'backlog/x.md', line: 268, subject: 'scripts/pr-land.mjs' }, label)).toBe(false);
    expect(covers({ path: 'backlog/x.md', line: 138, subject: 'dispatch-lane' }, label)).toBe(true);
  });

  it('the prose says CONTENT, and the retracted "DEFAULT IS FILE-LEVEL" survives only inside its retraction', () => {
    const live = REPLAY_SOURCE.replace(/^ \* RETRACTED[\s\S]*?(?=^ \*$|^ \*\/)/gm, '');
    expect(live).toMatch(/DEFAULT IS CONTENT/);
    expect(live).not.toMatch(/DEFAULT IS FILE-LEVEL/);
    expect(live).not.toMatch(/the only sound recall measure/);
  });

  it('the Usage block documents `--match`, the flag that selects between the three matchers', () => {
    // It listed `--tol` — which qualifies ONE non-default mode — and omitted `--match` entirely.
    expect(REPLAY_SOURCE).toMatch(/--match=content\|file\|line/);
    expect(REPLAY_SOURCE).toMatch(/ONLY read under --match=line/);
  });

  it('the label caveat is in the FILE, not only on the PR page', () => {
    // #1569 r3 f9 asked for provenance on the labels in the code. It reached the description and stopped.
    expect(REPLAY_SOURCE).toMatch(/unadjudicated self-assessment/);
    expect(REPLAY_SOURCE).toMatch(/never as an absolute catch rate/);
  });
});
