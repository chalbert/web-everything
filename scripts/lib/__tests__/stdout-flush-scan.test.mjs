/**
 * @file scripts/lib/__tests__/stdout-flush-scan.test.mjs
 * @description Differential/equivalence proof that `createRegexTailTracker`'s incremental
 *   (`lastChar`/`lastWordTail`) tracking is an exact equivalent of the whole-string re-derivation it replaced
 *   (#1730 review finding on the O(n²) fix). Owed as prevention: the review's own fixture (`x in/…/`, a keyword
 *   preceded by a whitespace-separated identifier) reproduced a silent false negative — `noteAppended` bridged
 *   `lastWordTail` across the space, reading `'xin'` instead of `'in'`, so `REGEX_PRECEDING_KEYWORDS` missed it
 *   and the `/` was misclassified as division. No existing fixture exercised a keyword preceded by another
 *   identifier across whitespace; this file both pins that exact case and fuzzes the broader space so the next
 *   stateless→stateful rewrite of this function gets caught here, not in production.
 */
import { describe, it, expect } from 'vitest';
import { createRegexTailTracker } from '../stdout-flush-scan.mjs';

const REGEX_PRECEDING_KEYWORDS = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await'];

/** The REFERENCE algorithm `createRegexTailTracker` replaced: re-derive the answer from the whole string
 *  emitted so far. Deliberately re-implemented here (not imported — the module no longer exports the old
 *  shape) so the differential test has an independent oracle, not a copy of the code under test. */
function startsRegexReference(emitted) {
  const t = emitted.replace(/\s+$/, '');
  if (!t) return true;
  const last = t.at(-1);
  if (/[)\]'"`]/.test(last)) return false;
  if (/[\w$]/.test(last)) {
    const word = /[A-Za-z_$][\w$]*$/.exec(t);
    return !!word && REGEX_PRECEDING_KEYWORDS.includes(word[0]);
  }
  return true;
}

/** Drive both the reference and the tracker off the SAME character stream, asserting agreement after every
 *  character (not just at the end) — the reviewer's exact recommendation. */
function assertAgreesThroughout(chars) {
  const tracker = createRegexTailTracker();
  let emitted = '';
  for (const c of chars) {
    emitted += c;
    tracker.note(c);
    const want = startsRegexReference(emitted);
    const got = tracker.startsRegex();
    if (got !== want) {
      throw new Error(`disagreement after emitting ${JSON.stringify(emitted)}: reference=${want}, tracker=${got}`);
    }
  }
}

describe('createRegexTailTracker — differential equivalence with the whole-string reference (#1730)', () => {
  it('pins the exact review fixture: a keyword preceded by another identifier across whitespace', () => {
    // `x in` — "x" must NOT bridge into "in"'s word tail across the space.
    assertAgreesThroughout('x in');
  });

  it('a bare keyword with no preceding identifier', () => {
    assertAgreesThroughout('return');
  });

  it('an identifier with no keyword', () => {
    assertAgreesThroughout('foo');
  });

  it('an identifier, trailing whitespace, then the slash — trailing whitespace must NOT erase the word tail', () => {
    assertAgreesThroughout('foo   ');
  });

  it('a keyword, trailing whitespace, then the slash — trailing whitespace must NOT erase the word tail', () => {
    assertAgreesThroughout('return   ');
  });

  it('closing punctuation forms: `)`, `]`, quotes, backtick', () => {
    for (const s of ['foo()', 'arr[0]', "'str'", '"str"', '`tpl`']) assertAgreesThroughout(s);
  });

  it('two keywords separated by whitespace — only the LAST one is the tail', () => {
    assertAgreesThroughout('typeof in');
  });

  it('a multi-word non-keyword identifier chain across whitespace stays non-keyword', () => {
    assertAgreesThroughout('foo bar');
  });

  it('empty stream starts regex (module scope / statement start)', () => {
    assertAgreesThroughout('');
    expect(createRegexTailTracker().startsRegex()).toBe(true);
  });

  it('fuzz: many token/whitespace/punctuation sequences agree at every position', () => {
    const tokens = [
      ...REGEX_PRECEDING_KEYWORDS,
      'foo', 'bar', 'x', 'y', '_priv', '$jq', 'a1', 'CONST_NAME',
      '(', ')', '[', ']', "'", '"', '`', '{', '}', ',', ';', '.', '=', '+', '-',
      ' ', '  ', '\t', '\n', '\n\n', '',
    ];
    let seed = 42;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rand() * 6);
      let s = '';
      for (let i = 0; i < len; i++) s += tokens[Math.floor(rand() * tokens.length)];
      assertAgreesThroughout(s);
    }
  });
});
