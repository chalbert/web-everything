/**
 * @file scripts/__tests__/check-standards-rules-githook-flags.test.mjs
 * @description Split from check-standards-rules.test.mjs (#3383 test-speedup): the #3196/#3204 git-hook
 * `--all` flag scanner — shell tokenization, comment/quote handling, line continuations — plus the
 * standing guard that the real .githooks/ tree passes its own rule. Pure file-move — same tests, smaller
 * file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  findGitHookAllFlags, gitHookAllFlagError, shellCodeOf, shellCommentOf, shellWords, isAllFlagWord,
  logicalLines, scanShellLine, GITHOOK_ALL_ALLOW,
} from '../check-standards-rules.mjs';

/**
 * #3196 — `--all` inside a git hook.
 *
 * `we:.githooks/post-merge` shipped a commands sync carrying `--all`. On that CLI the flag does not mean
 * "deploy every command" — it means CREATE the machine-global tree on a machine that never opted in, so a
 * routine `git pull` that merely touched a command file populated the operator's user-global config, live in
 * every unrelated repo they open, without asking. A hook runs unattended on every merge and every clone; it
 * was caught by a reviewer, and a reviewer catching it is not a mechanism.
 *
 * The interesting half is the COMMENT half. That same hook now carries a long explanation of why it does NOT
 * pass the flag — the exact prose a substring scan reports as a violation, which would make the rule fire
 * hardest on the file that already got it right.
 */
describe('findGitHookAllFlags (#3196)', () => {
  it('flags the flag where it is actually passed', () => {
    expect(findGitHookAllFlags('node scripts/sync-commands-deploy.mjs --all\n'))
      .toEqual([{ line: 1, text: 'node scripts/sync-commands-deploy.mjs --all' }]);
  });

  // THE ONE THAT MATTERS. Prose ABOUT the flag is not the flag.
  it('does not report a comment explaining why the flag is absent', () => {
    // Deliberately BARE (space-delimited) in the prose, not backticked. The backticked form the live hook
    // happens to use is already rejected by the flag-boundary regex, so a fixture built only from it would
    // pass with comment-stripping removed — i.e. for the wrong reason.
    const hook = [
      '# NO --all HERE, and the asymmetry is the point: --all does not mean "deploy every command".',
      '# Creating one is the explicit opt-in: `npm run commands:sync -- --all` by hand.',
      'node scripts/sync-commands-deploy.mjs',
    ].join('\n');
    expect(findGitHookAllFlags(hook)).toEqual([]);
  });

  it('reads the code half of a line that has both', () => {
    expect(findGitHookAllFlags('node x.mjs --all   # yes, really')).toHaveLength(1);
    expect(findGitHookAllFlags('node x.mjs   # never pass --all here')).toEqual([]);
  });

  it('is not fooled by a `#` that opens no comment', () => {
    expect(shellCodeOf('echo "a#b" --all')).toBe('echo "a#b" --all');
    expect(shellCodeOf('echo ${x#y} --all')).toBe('echo ${x#y} --all');
    expect(findGitHookAllFlags('echo ${x#y} --all')).toHaveLength(1);
  });

  /**
   * EVERY SHELL-VALID WAY OF WRITING THE SAME ARGUMENT. This table is the reason the detector tokenizes
   * instead of boundary-matching: two review rounds each found another form the character classes did not
   * recognise — round 1 the trailing `;` (in a file full of `if …; then`), round 2 the leading quote, the
   * backtick and the comma. Same defect both times, and the worst shape this gate can have: silently not
   * reporting the real line while a passing run reads as coverage.
   */
  it('flags the flag however the shell lets it be written', () => {
    for (const line of [
      'node x.mjs --all;',
      'node x.mjs --all; then',
      '(node x.mjs --all)',
      'node x.mjs --all|tee log',
      'node x.mjs --all&',
      'node x.mjs --all&& echo ok',
      'node x.mjs --all>out.txt',
      'node x.mjs --all<in.txt',
      'node x.mjs "--all"',                 // quoting is not part of the word
      "node x.mjs '--all'",
      'args=("--all")',
      'node x.mjs --all`echo hi`',
      'node x.mjs --all,foo',
      '$(node x.mjs --all)',
      'node x.mjs \\--all',                  // unquoted, `\\-` is a literal `-` — argv is exactly `--all`
      'node x.mjs --all}',
      'node x.mjs --all]',
      '"${OVERRIDE:-node x.mjs --all}"',    // an ordinary bash default expansion, not an exotic construct
      '[ $x = --all ]',
      // SPLICED forms. Each was verified against real bash: all four execute argv `--all`.
      'node x.mjs --al""l',
      'node x.mjs -"-all"',
      'node x.mjs --a"ll"',
      'node x.mjs -\\-all',
    ]) expect({ line, hits: findGitHookAllFlags(line).length }).toEqual({ line, hits: 1 });
  });

  it('splits on an escape as well as a quote, so a backslash cannot hide the flag', () => {
    expect(shellWords('node x.mjs \\--all')).toEqual(['node', 'x.mjs', '--all']);
    // A KNOWN over-report, pinned so it stays a decision rather than a surprise: removal is quote-blind, and
    // inside double quotes a backslash is literal unless it precedes `$`, a backtick, `"` or itself. So
    // `"\\-\\-all"` really passes `\\-\\-all` and we still call it a hit. Modelling double-quote escape rules
    // would buy nothing this gate needs, and the direction is the declared one.
    expect(findGitHookAllFlags('node x.mjs "\\-\\-all"')).toHaveLength(1);
  });

  /**
   * The separator set is defined POSITIVELY — everything that is not a word character splits — and that
   * inversion is the fix rather than a tidy-up. Four rounds each found another character an enumerated
   * separator list did not contain, and every one of those was a SILENT miss. A positive set can only be
   * wrong in the direction that REPORTS: an unlisted character splits, which at worst over-splits a word into
   * pieces that are not the flag either.
   */
  it('splits on ANY non-word character, so an unlisted one cannot hide the flag', () => {
    // A character nobody thought to enumerate — the point is that it needs no enumerating.
    expect(findGitHookAllFlags('node x.mjs --all%')).toHaveLength(1);
    expect(findGitHookAllFlags('node x.mjs --all~')).toHaveLength(1);
    expect(findGitHookAllFlags('node x.mjs :--all:')).toHaveLength(1);
  });

  // The four characters that ARE word characters carry the whole false-positive story, so each is pinned.
  it('keeps `-` `=` `.` `/` inside a word, which is what the negatives depend on', () => {
    expect(shellWords('node x.mjs --all-repos')).toEqual(['node', 'x.mjs', '--all-repos']);
    expect(shellWords('node x.mjs --all=1')).toEqual(['node', 'x.mjs', '--all=1']);
    expect(findGitHookAllFlags('node foo/--all')).toEqual([]);   // a path, not the flag
  });

  it('splits a line the way a shell reads words, REMOVING the quoting', () => {
    expect(shellWords('node x.mjs "--all"')).toEqual(['node', 'x.mjs', '--all']);
    expect(shellWords('args=("--all")')).toEqual(['args=', '--all']);
    expect(shellWords('')).toEqual([]);
    // Welding adjacent quoted fragments is what the SHELL does — `--al""l` is one word. An earlier cut
    // replaced quotes with a space, inventing a split the shell never makes.
    expect(shellWords('node x.mjs --al""l')).toEqual(['node', 'x.mjs', '--all']);
    // …but separate words stay separate: the space between them is not inside the quotes.
    expect(shellWords('echo "--al" "l"')).toEqual(['echo', '--al', 'l']);
    // A backtick is SUBSTITUTION, not quoting, so it breaks the word instead of splicing it: a substitution
    // that yields nothing leaves exactly `--all`, and the expansion is unknowable here.
    expect(shellWords('node x.mjs --all`echo hi`')).toEqual(['node', 'x.mjs', '--all', 'echo', 'hi']);
  });

  /**
   * A `\`-newline continuation can split the flag WORD, so no per-physical-line scan can see it: bash joins
   * `--al\` + `l` into the single word `--all`.
   */
  describe('line continuations', () => {
    it('flags a flag split across a continuation, and reports the line it STARTS on', () => {
      const hits = findGitHookAllFlags('echo hi\nnode x.mjs --al\\\nl\necho bye');
      expect(hits).toHaveLength(1);
      expect(hits[0].line).toBe(2);
    });

    it('joins physical lines into logical ones, keeping the first line number', () => {
      expect(logicalLines('a \\\nb\nc')).toEqual([{ line: 1, text: 'a b' }, { line: 3, text: 'c' }]);
      expect(logicalLines('one\ntwo')).toEqual([{ line: 1, text: 'one' }, { line: 2, text: 'two' }]);
    });

    /**
     * PARITY, not presence. An EVEN trailing run is escaped backslashes and the line ends there. Testing for
     * "ends with a backslash" welded the next line's head onto this one's tail, so a bare `--all` immediately
     * after such a line became `foo--all` and was MISSED — over-joining is the one direction in which this
     * preprocessing can HIDE a flag rather than expose one.
     */
    it('does not join on an EVEN backslash run — that is a literal backslash, not a continuation', () => {
      expect(logicalLines('echo foo\\\\\n--all').map((l) => l.line)).toEqual([1, 2]);
      expect(findGitHookAllFlags('echo foo\\\\\n--all').map((h) => h.line)).toEqual([2]);
    });

    // Three: a literal backslash AND a continuation. Joining is right, and the welded word is `foo\--all`,
    // which bash passes as ONE argument — so a non-hit here agrees with the shell rather than missing anything.
    it('joins on an odd run, and the welded word is correctly not the flag', () => {
      expect(logicalLines('echo foo\\\\\\\n--all x')).toHaveLength(1);
      expect(findGitHookAllFlags('echo foo\\\\\\\n--all x')).toEqual([]);
    });

    // A comment ends at its newline whatever precedes it, so a trailing `\` inside one continues nothing.
    it('does not continue a comment that happens to end in a backslash', () => {
      expect(logicalLines('# trailing \\\nnode x.mjs --all').map((l) => l.line)).toEqual([1, 2]);
      expect(findGitHookAllFlags('# trailing \\\nnode x.mjs --all')).toHaveLength(1);
    });
  });

  // `-` is NOT a separator, and that single omission is the whole reason the sibling flags stay out.
  it('treats a whole word as the flag, never a prefix of one', () => {
    expect(isAllFlagWord('--all')).toBe(true);
    expect(isAllFlagWord('--all=1')).toBe(true);
    for (const w of ['--all-repos', '--allow-dirty', '--allall', 'all', '-all', '']) expect(isAllFlagWord(w)).toBe(false);
  });

  it('leaves a DIFFERENT flag that merely starts with the same letters alone', () => {
    expect(findGitHookAllFlags('node x.mjs --all-repos')).toEqual([]);
    expect(findGitHookAllFlags('node x.mjs --allow-dirty')).toEqual([]);
    // `-` stays out of the SEPARATOR set precisely so these two tokenize to themselves; pinned here so
    // widening that set later cannot quietly swallow them.
    expect(findGitHookAllFlags('node x.mjs --all-repos;')).toEqual([]);
    expect(findGitHookAllFlags('node x.mjs "--allow-dirty"')).toEqual([]);
  });

  it('accepts `--all=<value>` as the flag, because it is', () => {
    expect(findGitHookAllFlags('node x.mjs --all=1')).toHaveLength(1);
  });

  // A PROMPT, NOT A WALL: a hook that genuinely needs the flag says so, on the line or the one above it.
  it('honours the inline escape on the line and on the line above', () => {
    expect(findGitHookAllFlags(`node x.mjs --all   # ${GITHOOK_ALL_ALLOW} bootstrapping a fresh VM`)).toEqual([]);
    expect(findGitHookAllFlags(`# ${GITHOOK_ALL_ALLOW} bootstrapping a fresh VM\nnode x.mjs --all`)).toEqual([]);
  });

  /**
   * The escape is a COMMENT, and only a comment. A raw-line substring match meant the phrase appearing in a
   * STRING suppressed a genuine invocation on the same line — the round-3 miss. Whether the suppression is
   * malicious or accidental does not matter: a marker that can be triggered from code is not a marker.
   */
  it('reads the escape from the comment half only, never from a string in the code', () => {
    // Asserted by LINE, not by count. The `echo` is itself reported — `standards-allow --all:` inside a string
    // tokenizes to a bare `--all`, so the scanner over-reports it. That is the accepted direction (a sentence
    // in a review), and counting hits here would make this test fail for a reason that is not its subject.
    const line = `echo "${GITHOOK_ALL_ALLOW} fake" ; node x.mjs --all`;
    expect(findGitHookAllFlags(line).map((h) => h.line)).toContain(1);
    expect(findGitHookAllFlags(`echo "${GITHOOK_ALL_ALLOW} fake"\nnode x.mjs --all`).map((h) => h.line))
      .toContain(2);
  });

  it('splits a line into its code and comment halves at the same point', () => {
    expect(shellCommentOf('node x.mjs --all   # why')).toBe('# why');
    expect(shellCommentOf('# whole line')).toBe('# whole line');
    expect(shellCommentOf('echo "a#b"')).toBe('');
    expect(shellCommentOf(undefined)).toBe('');
  });

  it('does not let an escape two lines up cover an unexplained flag', () => {
    expect(findGitHookAllFlags(`# ${GITHOOK_ALL_ALLOW} reason\nnode a.mjs --all\nnode b.mjs --all`))
      .toEqual([{ line: 3, text: 'node b.mjs --all' }]);
  });

  it('reports every offending line, not just the first', () => {
    expect(findGitHookAllFlags('node a.mjs --all\nnode b.mjs\nnode c.mjs --all').map((h) => h.line)).toEqual([1, 3]);
  });

  it('survives empty and absent input', () => {
    for (const c of ['', '\n', undefined, null]) expect(findGitHookAllFlags(c)).toEqual([]);
  });

  // A rule a reader can only OBEY is a rule they suppress; the message has to say what the flag does.
  it('names the consequence and the escape, not merely the prohibition', () => {
    const msg = gitHookAllFlagError('.githooks/post-merge', { line: 36, text: 'node x.mjs --all' });
    expect(msg).toMatch(/^\.githooks\/post-merge:36:/);
    expect(msg).toMatch(/machine-global tree/);
    expect(msg).toMatch(/never opted in/);
    expect(msg).toContain(GITHOOK_ALL_ALLOW);
    expect(msg).toContain('node x.mjs --all');
  });
});

// The SHIPPED hooks stay clean — a standing guard, so the rule is judged against real files and not only
// fixtures. It also proves the scan is not inert: there really are hooks under `.githooks/` to read.
/**
 * #3204 — QUOTE STATE CROSSES LINES.
 *
 * `shellCodeOf` decides where a line's code ends by tracking quotes, but every physical line used to start
 * with none open. A single-quoted string spanning two lines whose continuation begins with `#` therefore read
 * as a whole-line comment, and a real invocation after the closing quote on that line was never tokenized.
 *
 * This is a worse failure than the boundary misses the six earlier rounds closed. Those were a boundary the
 * scan could not SEE; this one made it stop LOOKING — and a scan that stops looking cannot even degrade
 * toward the escape hatch.
 */
describe('a string that spans physical lines (#3204)', () => {
  const Q = "'";
  const HOOK = `MSG=${Q}explanation that spans\n# multiple lines${Q} ; node scripts/sync-commands-deploy.mjs --all`;

  // THE REGRESSION, verified against real bash by the juror on PR #1488 round 7: this invocation runs.
  it('reports an invocation after a closing quote on a line that OPENS with a hash', () => {
    expect(findGitHookAllFlags(HOOK).map((h) => h.line)).toEqual([2]);
  });

  it('carries the open quote out of one line and into the next', () => {
    expect(scanShellLine(`MSG=${Q}spans`).openQuote).toBe(Q);
    // Fed that state, the `#` is inside a string and opens nothing.
    const next = scanShellLine(`# lines${Q} ; node x.mjs --all`, Q);
    expect(next.comment).toBe('');
    expect(next.openQuote).toBeNull();
  });

  // The fix must not trade this miss for noise on every hook in the tree.
  it('still treats a genuine comment as a comment', () => {
    expect(findGitHookAllFlags('# never pass --all here\nnode scripts/sync-commands-deploy.mjs')).toEqual([]);
    expect(scanShellLine('# whole line').comment).toBe('# whole line');
    expect(scanShellLine('node x.mjs   # why').code.trim()).toBe('node x.mjs');
  });

  it('leaves the escape hatch working across the same seam', () => {
    expect(findGitHookAllFlags('node x.mjs --all  # standards-allow --all: reason')).toEqual([]);
  });

  // A backslash is LITERAL inside single quotes, so a line that begins inside one continues nothing.
  it('does not treat a trailing backslash as a continuation while inside a single-quoted string', () => {
    // Three physical lines; the middle one ends in a backslash that is LITERAL because the string opened on
    // line 1 is still open. So nothing joins and all three stay their own logical line.
    const src = `A=${Q}open\nstill open\\\nclosed${Q}`;
    expect(src.split('\n')).toHaveLength(3);
    expect(logicalLines(src).map((l) => l.line)).toEqual([1, 2, 3]);
  });

  // …and OUTSIDE a string the same trailing backslash still joins, so the guard is narrow rather than a
  // blanket "never continue".
  it('still joins an odd trailing backslash outside any string', () => {
    expect(logicalLines('node x.mjs --al\\\nl').map((l) => l.line)).toEqual([1]);
  });

  /**
   * The guard reads the quote state at the END of the line, not the one the line began with, because a quote
   * can open on the SAME physical line as its trailing backslash. Fed the incoming state the guard never
   * fired: the lines spliced, and the invocation on the second was reported at line 1 under FABRICATED text.
   * It still reported — nothing hid — but it pointed at the wrong line. I had considered this exact case and
   * judged it harmless because the resulting argv matched the shell; the argv did, the LOCATION did not.
   */
  it('reports at the real line when the quote opens on the same line as the backslash', () => {
    const src = `A=${Q}foo\\\nbar${Q} ; node scripts/sync-commands-deploy.mjs --all`;
    const hits = findGitHookAllFlags(src);
    expect(hits.map((h) => h.line)).toEqual([2]);
    // The reported text is the real second line, not a splice of both.
    expect(hits[0].text).toBe(`bar${Q} ; node scripts/sync-commands-deploy.mjs --all`);
  });

  // The cost of that choice, pinned so it stays a decision: a `--all` that is only ever STRING CONTENT is
  // now reported. That is the declared direction — a false positive is a sentence in a review, and the escape
  // hatch answers it — where a wrong line number quietly misleads.
  it('over-reports a --all that is merely string content, which is the accepted direction', () => {
    expect(findGitHookAllFlags(`A=${Q}x\\\n--all${Q}`).map((h) => h.line)).toEqual([2]);
  });
});

describe('#3196 — the live .githooks/ tree', () => {
  it('passes its own rule', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.githooks');
    const names = existsSync(dir) ? readdirSync(dir) : [];
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect({ [n]: findGitHookAllFlags(readFileSync(join(dir, n), 'utf8')) }).toEqual({ [n]: [] });
    }
  });
});
