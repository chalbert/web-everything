/**
 * @file skill-operation-wiring.test.mjs — the #3224 scan: a skill instructing a raw home that a declared
 * operation owns, where naming that home does not reach the operation.
 *
 * THE PROPERTY UNDER TEST IS PRECISION, not detection. Detecting "a skill mentions a path" is trivial and
 * useless: on the tree this was written against, 4 of the 5 `verify-lane.mjs` mentions are prose DOCUMENTING
 * the rewiring, and the one that matters is a `node …` command. A scan that flags all five is wrong 80% of
 * the time, and a gate that is wrong 80% of the time gets switched off rather than obeyed.
 *
 * So the tests below are mostly NEGATIVE — each pins a thing that must NOT produce a finding, because every
 * one of them is a false positive an earlier design of this scan would have emitted:
 *   - a home that DELEGATES (the PR #1508 mistake, in one assertion)
 *   - a prose mention with no `node ` prefix
 *   - a different subcommand of the same file
 *   - a home whose source could not be read
 * Each negative is paired with the positive that would otherwise pass it vacuously — "never flag anything"
 * must not survive this file.
 */
import { describe, it, expect } from 'vitest';

import {
  findSkillsNamingUndelegatedHomes, homeDelegates, extractHomeMentions, declaredHomeCovers, hasReasonedMarker,
  findMalformedOperationCalls, extractOperationCalls,
} from '../skill-operation-wiring.mjs';
import { parseDeclaredHome, op } from '../../operations/registry.mjs';
import { compute } from '../../operations/step-kinds.mjs';

/** A home that reaches the operation, and one that does not. */
const DELEGATING = "import { claimOperation } from './operations/claim.mjs';\nexport const x = 1;\n";
const RAW = "import { execFileSync } from 'node:child_process';\nexport const y = 2;\n";

const OPS = [{ name: 'verify', declaresOver: [{ home: 'we:scripts/verify-lane.mjs', command: null }] }];
const SOURCES = new Map([['scripts/verify-lane.mjs', RAW]]);

const scan = (md, ops = OPS, sources = SOURCES) =>
  findSkillsNamingUndelegatedHomes([{ file: 'skills-src/s/SKILL.md', content: md }], ops, sources).warnings;

describe('delegation decides, not the mention (the PR #1508 lesson)', () => {
  const claimOps = [{ name: 'claim', declaresOver: [{ home: 'we:scripts/backlog.mjs', command: 'claim' }] }];

  it('a home that DELEGATES produces NO finding, even when a skill instructs it directly', () => {
    // `backlog.mjs claim` delegates through `claimViaOperation`, so naming it IS naming the declared layer —
    // and it additionally does the #083 reservation clear and the rename-slug block `run.mjs claim` does not.
    // PR #1508 rewired a skill off it on the theory that any raw-home mention is a miswiring, and dropped all
    // three. If this ever produces a finding, the scan is recommending that same regression.
    const w = scan('Run `node scripts/backlog.mjs claim 100`.', claimOps, new Map([['scripts/backlog.mjs', DELEGATING]]));
    expect(w).toEqual([]);
  });

  it('the SAME line against a NON-delegating home DOES produce a finding', () => {
    // The other half. Without it, "never flag anything" passes the test above.
    const w = scan('Run `node scripts/backlog.mjs claim 100`.', claimOps, new Map([['scripts/backlog.mjs', RAW]]));
    expect(w).toHaveLength(1);
    expect(w[0].descriptor.operation).toBe('claim');
  });

  it('homeDelegates reads the import graph, not a flag', () => {
    expect(homeDelegates(DELEGATING, 'claim')).toBe(true);
    expect(homeDelegates(RAW, 'claim')).toBe(false);
    // An `-io.mjs` import counts — it is still reaching the operation's module pair.
    expect(homeDelegates("import x from './operations/claim-io.mjs';", 'claim')).toBe(true);
    // A DIFFERENT operation's module does not count as delegating to this one.
    expect(homeDelegates(DELEGATING, 'verify')).toBe(false);
  });
});

describe('an instruction, not a mention — the `node ` prefix', () => {
  it('does NOT flag prose that merely names the path', () => {
    // Verbatim shapes from the real tree: all four are skills DESCRIBING the operation, which is the point.
    for (const line of [
      'It declares over `we:scripts/verify-lane.mjs` and maps its exit codes onto three outcomes.',
      '(`verify` over `we:scripts/verify-lane.mjs`), the operation is the fuller caller',
      'your FINAL commit (via `scripts/verify-lane.mjs`); the gate here is the same suites.',
      '— `scripts/verify-lane.mjs`: the marker lifecycle.',
    ]) expect(scan(line)).toEqual([]);
  });

  it('DOES flag the command form', () => {
    expect(scan('node scripts/verify-lane.mjs --gate="npm run check:standards"')).toHaveLength(1);
  });

  it('flags it inside a fenced block and after a backtick or `$` prompt', () => {
    for (const line of ['```\nnode scripts/verify-lane.mjs\n```', '`node scripts/verify-lane.mjs`', '$ node scripts/verify-lane.mjs']) {
      expect(scan(line)).toHaveLength(1);
    }
  });
});

describe('the subcommand is part of the claim', () => {
  const claimOps = [{ name: 'claim', declaresOver: [{ home: 'we:scripts/backlog.mjs', command: 'claim' }] }];
  const raw = new Map([['scripts/backlog.mjs', RAW]]);

  it('does NOT flag a DIFFERENT subcommand of the same file', () => {
    // `backlog.mjs` has a dozen subcommands and only `claim` is declared over. A file-granular claim would
    // condemn every other `backlog.mjs` line in every skill — wrong, and the fastest way to get this ignored.
    expect(scan('node scripts/backlog.mjs list --open', claimOps, raw)).toEqual([]);
  });

  it('flags the declared one', () => {
    expect(scan('node scripts/backlog.mjs claim 100', claimOps, raw)).toHaveLength(1);
  });

  it('a declaration with NO subcommand covers every mention of that file', () => {
    expect(declaredHomeCovers({ home: 'we:scripts/verify-lane.mjs', command: null }, { path: 'scripts/verify-lane.mjs', command: 'anything' })).toBe(true);
    expect(declaredHomeCovers({ home: 'we:scripts/backlog.mjs', command: 'claim' }, { path: 'scripts/backlog.mjs', command: 'list' })).toBe(false);
  });

  it('a flag is never read as the subcommand', () => {
    // Without the `(?!-)` guard, `--gate` reads as the subcommand and a declaration naming a real subcommand
    // would stop matching — a silent miss, which is the failure direction that matters.
    expect(extractHomeMentions('node scripts/backlog.mjs --json')[0].command).toBe(null);
  });
});

describe('the exemption is POSITIONAL', () => {
  const CMD = 'node scripts/verify-lane.mjs';

  it('exempts the mention on its own line', () => {
    expect(scan(`${CMD}   <!-- @operation-home-ok: this documents the home itself -->`)).toEqual([]);
  });

  it('exempts a mention whose marker is on the line directly above', () => {
    expect(scan(`<!-- @operation-home-ok: comparison -->\n${CMD}`)).toEqual([]);
  });

  it('does NOT exempt a mention far from the marker', () => {
    // The `hasCohesiveEscapeHatch` / `hasTestOnlyExportOkMarker` lesson: a file-wide search lets any skill
    // that merely DOCUMENTS the escape hatch exempt every mention in itself.
    expect(scan(`<!-- @operation-home-ok: reason -->\n\nsome prose\n\n${CMD}`)).toHaveLength(1);
  });

  it('exempts through a multi-line comment BLOCK, marker on its first line', () => {
    // BOTH REAL MARKERS ON THE TREE HAVE THIS SHAPE and a single-line-above rule silently exempted NEITHER.
    // A justification worth writing runs to a sentence or two, so it is a comment block: the marker lands on
    // the block's first line and the line directly above the command is its last.
    expect(scan(`# @operation-home-ok: #xvj8sj0 — the operation forwards no gate\n# so naming it would drop the caller's gate.\n${CMD}`)).toEqual([]);
  });

  it('markdown BOLD and BULLET lines end the walk — `*` is not a comment in markdown', () => {
    // PR #1513 correctness juror, CONFIRMED. `COMMENT_LINE` carried a `*` alternative over from the JS-source
    // walk its precedents perform, where `*` continues a JSDoc block. This scan reads only markdown, where `*`
    // opens a bullet or the leading star of `**bold**` — 169 lines in the current skills-src tree start with
    // `**`. So a marker written to excuse ONE command silently exempted an unrelated mention below it.
    //
    // The juror's own probe is what makes this test necessary rather than decorative: it removed `\*` from the
    // pattern and all 25 tests still passed, so no named test exercised the branch at all.
    const marker = '<!-- @operation-home-ok: a reason for a DIFFERENT command -->';
    expect(scan(`${marker}\n**Note:** unrelated prose.\n**More bold prose.**\n${CMD}`)).toHaveLength(1);
    expect(scan(`${marker}\n* an unrelated bullet\n${CMD}`)).toHaveLength(1);
  });

  it('a blank line ends the walk — the block must be attached to the mention', () => {
    expect(scan(`# @operation-home-ok: #xvj8sj0 — a reason\n\n${CMD}`)).toHaveLength(1);
  });

  it('accepts a CARD ID as the reason', () => {
    // Regression: requiring `[A-Za-z0-9]` immediately after the colon rejected `#xvj8sj0`, the most useful
    // reason there is, so every real marker was ignored and the gate re-reported what it had been told.
    expect(hasReasonedMarker('<!-- @operation-home-ok: #xbbscm5 — routed by its own item -->')).toBe(true);
    expect(scan(`${CMD}   <!-- @operation-home-ok: #xbbscm5 — routed by its own item -->`)).toEqual([]);
  });

  it('a marker with NO reason exempts nothing', () => {
    // The comment's own closing delimiter is not a reason.
    expect(hasReasonedMarker('<!-- @operation-home-ok: -->')).toBe(false);
    expect(scan(`${CMD}   <!-- @operation-home-ok: -->`)).toHaveLength(1);
    expect(scan(`${CMD}   # @operation-home-ok:`)).toHaveLength(1);
  });
});

describe('absence of evidence is not a finding', () => {
  it('a home whose source could not be read produces NO finding', () => {
    // `unknown`, not `raw`. The scan cannot tell whether an unreadable home delegates, and guessing "it does
    // not" would invent findings from a missing file — the same line `verify` draws around `unrun`.
    expect(scan('node scripts/verify-lane.mjs', OPS, new Map())).toEqual([]);
  });

  it('but a home it CAN read and that does not delegate is flagged', () => {
    expect(scan('node scripts/verify-lane.mjs', OPS, SOURCES)).toHaveLength(1);
  });

  it('an operation declaring over nothing flags nothing', () => {
    expect(scan('node scripts/verify-lane.mjs', [{ name: 'explore', declaresOver: [] }], SOURCES)).toEqual([]);
  });
});

describe('the finding names what the reader has to act on', () => {
  it('carries file, line, the invocation and the operation', () => {
    const w = scan('intro\n\nnode scripts/verify-lane.mjs --gate=x');
    expect(w[0].descriptor).toMatchObject({
      kind: 'skill-names-raw-home', file: 'skills-src/s/SKILL.md', line: 3, operation: 'verify',
    });
    expect(w[0].message).toContain('run.mjs verify');
  });
});

describe('`declaresOver` is refused at registration when it is malformed', () => {
  const decl = (declaresOver) => op('t', { declaresOver, probe: compute({ reads: [], fn: () => ({}) }) });

  it('parses a locus-prefixed entry with and without a subcommand', () => {
    expect(parseDeclaredHome('we:scripts/backlog.mjs claim')).toEqual({ home: 'we:scripts/backlog.mjs', command: 'claim' });
    expect(parseDeclaredHome('we:scripts/verify-lane.mjs')).toEqual({ home: 'we:scripts/verify-lane.mjs', command: null });
  });

  it('refuses an entry with no #883 locus prefix — it would declare over nothing', () => {
    expect(parseDeclaredHome('scripts/backlog.mjs claim')).toBe(null);
    expect(() => decl(['scripts/backlog.mjs claim'])).toThrow(/locus-prefixed/);
  });

  it('refuses a non-array', () => {
    expect(() => decl('we:scripts/x.mjs')).toThrow(/must be an array/);
  });

  it('an operation that declares over nothing is still legal', () => {
    expect(decl(undefined).declaresOver).toEqual([]);
    expect(decl(['we:scripts/x.mjs']).declaresOver).toEqual([{ home: 'we:scripts/x.mjs', command: null }]);
  });
});

// ── #3253: THE CALL SITE, JUDGED AGAINST THE OPERATION'S OWN `input` ────────────────────────────────────────
//
// Same precision-over-detection property as the scan above, and the two NEGATIVE cases at the end are not
// hypothetical: both were emitted by this scan against the live tree before it shipped, and both were the
// gate's bug rather than the tree's. A gate whose first live run cries wolf twice is a gate that gets ignored.
describe('#3253 — operation call sites judged against declared inputs', () => {
  const CONTROL = ['help', 'json', 'resume', 'answer', 'run-id', 'cwd', 'model'];
  const scaffold = {
    title: { type: 'string', required: true },
    workItem: { type: 'string', required: false },
    blockedBy: { type: 'string', required: false },
  };
  const doc = (content, file = 'skills-src/x/SKILL.md') => [{ file, content }];
  const scan = (content) => findMalformedOperationCalls(doc(content), new Map([['scaffold', scaffold]]), new Map([['scaffold', CONTROL]]));

  it('ERRORS on the rename class — the kebab-case spelling the raw home uses', () => {
    // THE WHOLE POINT. `backlog.mjs scaffold` takes `--workitem`; the operation declares `workItem`. The CLI
    // would refuse it, but a reader rewiring 26 sites by eye will not notice the capital I.
    const r = scan('run it: `node scripts/operations/run.mjs scaffold --title=x --workitem=story`');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].descriptor).toMatchObject({ kind: 'operation-call-unknown-flag', operation: 'scaffold', flag: 'workitem' });
    expect(r.errors[0].message).toContain('--workitem');
  });

  it('says plainly what it does NOT prove — a green is not "the rewire is safe"', () => {
    // #1523's rehearsal was well-formed AND previewed the wrong mode. If the finding text let a green read as
    // equivalence, the gate would be actively misleading exactly where it is weakest.
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --nope=1`');
    expect(r.errors[0].message).toMatch(/WELL-FORMED, never that it preserves/);
  });

  it('accepts every declared input and every CLI control flag', () => {
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --workItem=story --blockedBy=12 --json --cwd=/l`');
    expect(r.errors).toEqual([]);
  });


  it('an operation whose schema could not be built produces NO finding', () => {
    // Absence of evidence is not evidence of a defect — the same line the wiring scan draws around a home
    // whose source it could not read, and `verify` draws around `unrun`.
    const r = findMalformedOperationCalls(doc('`node scripts/operations/run.mjs mystery --whatever=1`'), new Map(), new Map());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('prose ABOUT an operation is not a call site', () => {
    expect(scan('the `scaffold` operation takes `--title` and refuses `--nope`').errors).toEqual([]);
    expect(extractOperationCalls('run.mjs scaffold --nope=1')).toEqual([]); // no `node ` prefix
  });

  it('honours a reasoned exemption marker on the line', () => {
    const r = scan('`node scripts/operations/run.mjs scaffold --nope=1` <!-- @operation-home-ok: illustrating a refusal -->');
    expect(r.errors).toEqual([]);
  });

  // ── the two the live tree taught it ────────────────────────────────────────────────────────────────────



  it('but a typo on a --resume line is still a typo', () => {
    const r = scan('`node scripts/operations/run.mjs scaffold --resume=abc --nope=1`');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].descriptor.flag).toBe('nope');
  });
});

// ── the third false-positive class, found by PR #1526's correctness juror ────────────────────────────────────
describe('#3253 — only ARGV counts, not everything that looks like it (PR #1526 juror)', () => {
  const CONTROL = ['help', 'json', 'resume', 'answer', 'run-id', 'cwd', 'model'];
  const scaffold = { title: { type: 'string', required: true }, workItem: { type: 'string', required: false } };
  const scan = (content) => findMalformedOperationCalls([{ file: 'f.md', content }], new Map([['scaffold', scaffold]]), new Map([['scaffold', CONTROL]]));

  it('a trailing shell comment is NOT argv', () => {
    // The likely shape: PR #1522 moved these docs TO trailing `#` comments because HTML comments break inside
    // the fenced "exact gh sequence" blocks. So the convention produces exactly what this used to misread.
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --json`  # --workitem is the raw spelling');
    expect(r.errors).toEqual([]);
    expect(extractOperationCalls('node scripts/operations/run.mjs scaffold --title=x  # --nope')[0].flags)
      .toEqual(['title']);
  });

  it('a `--` inside a QUOTED value is data, not a flag', () => {
    const r = scan("`node scripts/operations/run.mjs scaffold --title='mentions --nope in prose' --json`");
    expect(r.errors).toEqual([]);
  });

  it('a `#` inside a quoted value does NOT truncate the argv', () => {
    // Quotes are blanked BEFORE the comment is cut. Cutting first would drop the real flags after it.
    expect(extractOperationCalls("node scripts/operations/run.mjs scaffold --title='fixes #123' --workItem=story")[0].flags)
      .toEqual(['title', 'workItem']);
  });

  it('and a real trailing flag is still read', () => {
    // The other half — "strip everything" would pass the three above vacuously.
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --nope=1`');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].descriptor.flag).toBe('nope');
  });
});

// ── the fourth false-positive class, found by PR #1526 round 2 ───────────────────────────────────────────────

// ── the fifth class, found by PR #1526 round 3: a FALSE NEGATIVE, not a false positive ──────────────────────
describe('#3253 — control flags are per-operation, not a flat union (PR #1526 round 3)', () => {
  const scaffold = { title: { type: 'string', required: true } };
  const doc = (content) => [{ file: 'f.md', content }];
  const scan = (content, controls) => findMalformedOperationCalls(doc(content), new Map([['scaffold', scaffold]]), controls);

  it('ERRORS on a juror flag passed to an operation with no judge step', () => {
    // `--cwd`/`--model` mean the juror's lane and model. On a compute-only operation the CLI refuses them, so
    // a gate that accepts them green-lights a command that cannot run — the one job it claims to do.
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --cwd=/lane`',
      new Map([['scaffold', ['help', 'json', 'resume', 'answer', 'run-id']]]));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].descriptor.flag).toBe('cwd');
  });

  it('ACCEPTS the same flag on an operation that DOES declare a judge step', () => {
    // The other half. Without it, "reject every control flag" passes the case above.
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --cwd=/lane`',
      new Map([['scaffold', ['help', 'json', 'resume', 'answer', 'run-id', 'cwd', 'model']]]));
    expect(r.errors).toEqual([]);
  });

  it('an operation with no entry in the map accepts no control flags — over-report, never under-report', () => {
    const r = scan('`node scripts/operations/run.mjs scaffold --title=x --json`', new Map());
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].descriptor.flag).toBe('json');
  });
});

// ── what this gate DELIBERATELY does not do (PR #1526 round 3) ───────────────────────────────────────────────
describe('#3253 — one physical line, and the miss is stated not hidden', () => {
  const CONTROL = ['help', 'json', 'resume', 'answer', 'run-id', 'cwd', 'model'];
  const scaffold = { title: { type: 'string', required: true } };
  const scan = (c) => findMalformedOperationCalls([{ file: 'f.md', content: c }],
    new Map([['scaffold', scaffold]]), new Map([['scaffold', CONTROL]]));

  it('does not scan a continuation line — a MISS, never a false alarm', () => {
    // The absorber that used to read these caused two of this gate's five defects. Removing it means an
    // unknown flag on a wrapped line goes unreported; that is the safe direction and it is pinned here so the
    // limitation is a decision on the record rather than an accident someone re-"fixes" later.
    const md = 'node scripts/operations/run.mjs scaffold --title=x\n  --nope=1';
    expect(extractOperationCalls(md)[0].flags).toEqual(['title']);
    expect(scan(md).errors).toEqual([]);
  });

  it('a real markdown-decorated wrapped call produces NO false finding', () => {
    // Verbatim shape from `we:skills-src/next-backlog-item/SKILL.md`: bracketed optional flags, a trailing
    // `**`, a `(#card)` tail. The round-2 absorber mis-read this; nothing reads it now.
    const md = "**`node scripts/operations/run.mjs scaffold\n  --title='…' [--parent=NNN] --json`** (#xrrpfo7).";
    expect(scan(md).errors).toEqual([]);
  });

  it('still reports an undeclared flag on the invocation line itself', () => {
    expect(scan('`node scripts/operations/run.mjs scaffold --title=x --workitem=story`').errors).toHaveLength(1);
  });
});
