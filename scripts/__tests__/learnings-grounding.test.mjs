/**
 * @file scripts/__tests__/learnings-grounding.test.mjs
 * @description Unit proof of the harvest-side grounding verification (#3016, ratified #2978 Fork 1): a note's
 *   quoted turn is checked against the HARNESS transcript it points at. Pins what counts as "in the transcript"
 *   (visible user/assistant text only — never the drop command's own tool_use input or its --json tool_result
 *   echo, which would let every note verify against its own emission), the fail-safe verdicts (every failure is
 *   a named `failed`, a note with no grounding is `ungrounded`, nothing throws), and the transcript-root
 *   containment (no `..` climb, no symlink escape to an emitter-written file).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GROUNDING, MIN_QUOTE_CHARS, normalizeQuote, findQuote, verifyGrounding, transcriptRoot, cachedReader,
} from '../conveyor/learnings-grounding.mjs';

const QUOTE = 'stop re-running the whole suite for a README edit';

/** One transcript JSONL, shaped like the harness writes it. */
const transcript = (...records) => records.map((r) => JSON.stringify(r)).join('\n') + '\n';
const human = (text, uuid = 'u-human') => ({ type: 'user', uuid, message: { role: 'user', content: text } });
const assistantText = (text, uuid = 'u-asst') => ({ type: 'assistant', uuid, message: { role: 'assistant', content: [{ type: 'text', text }] } });

describe('findQuote — what counts as a visible turn', () => {
  it('finds a quote in a human turn (string content) and reports role + turn id', () => {
    expect(findQuote(transcript(human(`please ${QUOTE}, it wastes minutes`)), QUOTE))
      .toEqual({ found: true, role: 'human', turn: 'u-human' });
  });

  it('finds a quote in an assistant text block and in a user text block', () => {
    expect(findQuote(transcript(assistantText(QUOTE)), QUOTE)).toMatchObject({ found: true, role: 'assistant' });
    const userBlocks = { type: 'user', uuid: 'u-b', message: { role: 'user', content: [{ type: 'text', text: QUOTE }] } };
    expect(findQuote(transcript(userBlocks), QUOTE)).toMatchObject({ found: true, role: 'human', turn: 'u-b' });
  });

  it('matches across whitespace differences (line wraps, doubled spaces) but stays case-sensitive', () => {
    expect(findQuote(transcript(human('stop re-running the whole\n  suite for a README edit')), QUOTE).found).toBe(true);
    expect(findQuote(transcript(human(QUOTE.toUpperCase())), QUOTE).found).toBe(false);
  });

  it('IGNORES the drop command itself (tool_use) and its --json echo (tool_result) — no self-verification', () => {
    const toolUse = { type: 'assistant', message: { content: [{ type: 'tool_use', input: { command: `learnings-drop.mjs --quoted-turn="${QUOTE}"` } }] } };
    const toolResult = { type: 'user', message: { content: [{ type: 'tool_result', content: `{"ok":true,"record":{"quotedTurn":"${QUOTE}"}}` }] } };
    expect(findQuote(transcript(toolUse, toolResult), QUOTE).found).toBe(false);
  });

  it('IGNORES thinking blocks, harness-injected isMeta records, and non-message records', () => {
    const thinking = { type: 'assistant', message: { content: [{ type: 'thinking', thinking: QUOTE }] } };
    const meta = { ...human(QUOTE), isMeta: true };
    const lastPrompt = { type: 'last-prompt', lastPrompt: QUOTE };
    expect(findQuote(transcript(thinking, meta, lastPrompt), QUOTE).found).toBe(false);
  });

  it('tolerates torn/malformed lines — a live session\'s half-written tail never costs the match', () => {
    const text = `{"type":"user"\nnot json\n${JSON.stringify(human(QUOTE))}\n{"type":"assis`;
    expect(findQuote(text, QUOTE).found).toBe(true);
  });

  it('an empty quote never matches', () => {
    expect(findQuote(transcript(human(QUOTE)), '   ')).toEqual({ found: false });
  });
});

describe('verifyGrounding — fail-safe verdicts over a real transcript root', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'we-transcripts-'));
    mkdirSync(join(root, '-proj'), { recursive: true });
  });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  const write = (name, text) => { const p = join(root, '-proj', name); writeFileSync(p, text); return p; };

  it('verified: the quote is in a visible turn of the pointed-at transcript', () => {
    const p = write('s1.jsonl', transcript(human(QUOTE, 'turn-7')));
    expect(verifyGrounding({ quotedTurn: QUOTE, transcript: p }, { root }))
      .toEqual({ status: GROUNDING.VERIFIED, role: 'human', turn: 'turn-7' });
  });

  it('ungrounded: an entry with no grounding is NOT a failure', () => {
    expect(verifyGrounding({ kind: 'friction' }, { root })).toEqual({ status: GROUNDING.UNGROUNDED });
  });

  it('failed/quote-not-found: the transcript exists but never said it', () => {
    const p = write('s1.jsonl', transcript(human('something else entirely, nothing about suites')));
    expect(verifyGrounding({ quotedTurn: QUOTE, transcript: p }, { root })).toEqual({ status: GROUNDING.FAILED, reason: 'quote-not-found' });
  });

  it('failed/unreadable: the transcript was pruned or never existed', () => {
    expect(verifyGrounding({ quotedTurn: QUOTE, transcript: join(root, '-proj', 'gone.jsonl') }, { root }))
      .toEqual({ status: GROUNDING.FAILED, reason: 'unreadable' });
  });

  it('failed/incomplete and failed/relative-pointer: a hand-appended line that skipped validateEntry', () => {
    expect(verifyGrounding({ quotedTurn: QUOTE }, { root })).toMatchObject({ reason: 'incomplete' });
    expect(verifyGrounding({ transcript: '/x.jsonl' }, { root })).toMatchObject({ reason: 'incomplete' });
    expect(verifyGrounding({ quotedTurn: QUOTE, transcript: 'rel/s1.jsonl' }, { root })).toMatchObject({ reason: 'relative-pointer' });
  });

  it('failed/outside-transcript-root: an emitter-written file elsewhere, a `..` climb, a sibling-prefix dir', () => {
    const outside = mkdtempSync(join(tmpdir(), 'we-forged-'));
    try {
      const forged = join(outside, 'forged.jsonl');
      writeFileSync(forged, transcript(human(QUOTE)));
      expect(verifyGrounding({ quotedTurn: QUOTE, transcript: forged }, { root })).toMatchObject({ reason: 'outside-transcript-root' });
      expect(verifyGrounding({ quotedTurn: QUOTE, transcript: join(root, '-proj', '..', '..', 'x.jsonl') }, { root }))
        .toMatchObject({ reason: 'outside-transcript-root' });
      expect(verifyGrounding({ quotedTurn: QUOTE, transcript: `${root}-sibling/x.jsonl` }, { root }))
        .toMatchObject({ reason: 'outside-transcript-root' });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('failed/outside-transcript-root: a symlink planted under the root that points at a forged file', () => {
    const outside = mkdtempSync(join(tmpdir(), 'we-forged-'));
    try {
      const forged = join(outside, 'forged.jsonl');
      writeFileSync(forged, transcript(human(QUOTE)));
      const link = join(root, '-proj', 'link.jsonl');
      symlinkSync(forged, link);
      expect(verifyGrounding({ quotedTurn: QUOTE, transcript: link }, { root })).toMatchObject({ reason: 'outside-transcript-root' });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('never throws, whatever the entry', () => {
    for (const e of [null, undefined, 42, [], { quotedTurn: {}, transcript: [] }]) {
      expect(() => verifyGrounding(e, { root })).not.toThrow();
    }
  });
});

describe('helpers', () => {
  it('transcriptRoot honours $LEARNINGS_TRANSCRIPT_ROOT, else ~/.claude/projects', () => {
    expect(transcriptRoot({ env: { LEARNINGS_TRANSCRIPT_ROOT: '/t' } })).toBe('/t');
    expect(transcriptRoot({ env: {}, home: '/home/u' })).toBe('/home/u/.claude/projects');
  });

  it('MIN_QUOTE_CHARS is measured on the whitespace-normalized quote', () => {
    expect(normalizeQuote('  a \n\t b  ')).toBe('a b');
    expect(MIN_QUOTE_CHARS).toBeGreaterThan('yes do it'.length);
  });

  it('cachedReader opens each transcript once, and caches a failed read too', () => {
    let calls = 0;
    const read = cachedReader((p) => { calls++; if (p === '/missing') throw new Error('ENOENT'); return 'text'; });
    read('/a'); read('/a');
    expect(() => read('/missing')).toThrow(); expect(() => read('/missing')).toThrow();
    expect(calls).toBe(2);
  });
});
