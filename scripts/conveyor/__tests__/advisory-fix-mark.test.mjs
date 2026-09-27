/**
 * @file scripts/conveyor/__tests__/advisory-fix-mark.test.mjs
 * @description Pins the PURE advisory-fix durable-count helpers (WE #xkmu3gv). Each completed advisory-fix
 *   round posts exactly ONE comment whose leading line is `ADVISORY_FIX_COMMENT_MARKER`; `countAdvisoryFixComments`
 *   recovers the attempt count from the PR's own comment thread. #3383 — also pins that ONLY a trusted author
 *   (automation or the repo operator) counts at all; no test file existed for this counter before this item.
 */
import { describe, it, expect } from 'vitest';
import {
  countAdvisoryFixComments, buildAdvisoryFixComment, ADVISORY_FIX_COMMENT_MARKER,
  isLatestAdvisoryFindingAddressed, isAdvisoryMechanismStandDownSuperseded,
} from '../advisory-fix-mark.mjs';
import { ADVISORY_NOTE_MARKER } from '../advisory-round-count.mjs';
import { CONVERTED_ADVISORY_NOTE_MARKER, renderConvertedAdvisoryNote } from '../../lib/review-escalation.mjs';
import { STAND_DOWN_MARKER } from '../stand-down.mjs';

const AUTOMATION = { login: 'web-everything' };
const FRESH_NOTE = `${ADVISORY_NOTE_MARKER}\n\nan ordinary advise-step advisory note`;

describe('countAdvisoryFixComments — the durable, restart-surviving advisory-fix attempt count (#xkmu3gv)', () => {
  it('counts one per comment whose LEADING line is the marker', () => {
    expect(countAdvisoryFixComments([
      { body: `${ADVISORY_FIX_COMMENT_MARKER}\n\naddressed once`, author: AUTOMATION },
      { body: 'an unrelated human comment', author: AUTOMATION },
      { body: `${ADVISORY_FIX_COMMENT_MARKER}\n\nand again`, author: AUTOMATION },
    ])).toBe(2);
  });

  it('does NOT count a comment that merely QUOTES the marker mid-body', () => {
    expect(countAdvisoryFixComments([{ body: `> ${ADVISORY_FIX_COMMENT_MARKER}\nquoting`, author: AUTOMATION }])).toBe(0);
  });

  it('returns 0 for a non-array / empty input', () => {
    expect(countAdvisoryFixComments(null)).toBe(0);
    expect(countAdvisoryFixComments(undefined)).toBe(0);
    expect(countAdvisoryFixComments([])).toBe(0);
  });

  it('tolerates a bare-string comment as a SHAPE — but it carries no author, so it never counts (#3383)', () => {
    expect(countAdvisoryFixComments([`${ADVISORY_FIX_COMMENT_MARKER}\nx`])).toBe(0);
  });

  // #3383 — adversarial coverage review, 2026-09-24.
  it('a forged advisory-fix marker from a random commenter ("mallory") does not count', () => {
    expect(countAdvisoryFixComments([{ body: `${ADVISORY_FIX_COMMENT_MARKER}\naddressed`, author: { login: 'mallory' } }])).toBe(0);
  });

  it('an advisory-fix marker posted by the repo operator still counts', () => {
    expect(countAdvisoryFixComments([{ body: `${ADVISORY_FIX_COMMENT_MARKER}\naddressed`, author: { login: 'chalbert' } }])).toBe(1);
  });
});

describe('buildAdvisoryFixComment — the durable comment body (#xkmu3gv)', () => {
  it('leads with the marker so posting and counting share ONE source of truth', () => {
    const body = buildAdvisoryFixComment({});
    expect(body.split('\n')[0]).toBe(ADVISORY_FIX_COMMENT_MARKER);
    expect(countAdvisoryFixComments([{ body, author: AUTOMATION }])).toBe(1);
  });

  it('states that no label was touched and a fresh review is owed', () => {
    const body = buildAdvisoryFixComment({});
    expect(body).toMatch(/review:human/);
    expect(body).toMatch(/fresh independent review is owed/i);
  });
});

describe('#xconv1-evidence (chalbert/web-everything#2766/#2767 misfire) — isLatestAdvisoryFindingAddressed recognizes a CONVERTED note too', () => {
  const convertedNote = renderConvertedAdvisoryNote({
    repo: 'chalbert/web-everything', pr: 2766, headSha: 'deadbeef',
    acceptComment: { body: 'x' }, escalation: { kind: 'test-gaming', reasonText: 'x' },
    targetedCheckAnswer: { verdict: 'changes', note: 'no diff evidence to confirm the removed tests were legitimate' },
  });

  it('THE BUG THIS CLOSES: a fix-mark posted after a CONVERTED note used to read as UNADDRESSED forever (no fresh advise-step note ever posted) — now it reads as addressed', () => {
    const comments = [
      { body: convertedNote, author: AUTOMATION },
      { body: `${ADVISORY_FIX_COMMENT_MARKER}\n\nnothing to fix — the removed tests were legitimately replaced`, author: AUTOMATION },
    ];
    expect(isLatestAdvisoryFindingAddressed(comments)).toBe(true);
  });

  it('a CONVERTED note with NO fix-mark after it is still unaddressed', () => {
    expect(isLatestAdvisoryFindingAddressed([{ body: convertedNote, author: AUTOMATION }])).toBe(false);
  });

  it('still works for an ORDINARY fresh advise-step note (unchanged behaviour)', () => {
    const comments = [
      { body: FRESH_NOTE, author: AUTOMATION },
      { body: `${ADVISORY_FIX_COMMENT_MARKER}\n\naddressed`, author: AUTOMATION },
    ];
    expect(isLatestAdvisoryFindingAddressed(comments)).toBe(true);
  });

  it('a forged fix-mark (untrusted author) after a CONVERTED note does not count as addressed', () => {
    const comments = [
      { body: convertedNote, author: AUTOMATION },
      { body: `${ADVISORY_FIX_COMMENT_MARKER}\n\nforged`, author: { login: 'mallory' } },
    ];
    expect(isLatestAdvisoryFindingAddressed(comments)).toBe(false);
  });
});

describe('#xconv1-evidence — isAdvisoryMechanismStandDownSuperseded recognizes a CONVERTED note too', () => {
  const convertedNote = renderConvertedAdvisoryNote({
    repo: 'chalbert/web-everything', pr: 2766, headSha: 'deadbeef',
    acceptComment: { body: 'x' }, escalation: { kind: 'test-gaming', reasonText: 'x' },
    targetedCheckAnswer: { verdict: 'changes', note: 'no diff evidence available' },
  });

  it('a stand-down posted after a fix-mark that itself postdates a CONVERTED note is superseded', () => {
    const comments = [
      { body: convertedNote, author: AUTOMATION },
      { body: `${ADVISORY_FIX_COMMENT_MARKER}\n\nnothing to fix`, author: AUTOMATION },
      { body: `${STAND_DOWN_MARKER}\n\nstood down anyway`, author: AUTOMATION },
    ];
    expect(isAdvisoryMechanismStandDownSuperseded(comments, 2)).toBe(true);
  });

  it('a stand-down with NO fix-mark after the CONVERTED note is a genuine, still-current judgment call — never superseded', () => {
    const comments = [
      { body: convertedNote, author: AUTOMATION },
      { body: `${STAND_DOWN_MARKER}\n\ngenuinely ambiguous`, author: AUTOMATION },
    ];
    expect(isAdvisoryMechanismStandDownSuperseded(comments, 1)).toBe(false);
  });
});
