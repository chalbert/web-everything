/**
 * @file review-prep-io.test.mjs — the `review-prep` io shell: reads a card, appends its review section,
 * commits, and shells `we:scripts/pr-land.mjs` — with no real `fs` mutation outside a temp dir and no real
 * `git`/`gh` subprocess (both injected).
 *
 * THE PROPERTY WORTH PINNING is the race guard: a `record` whose card changed since `read` makes NO write and
 * calls neither `exec` nor `runNode` — the deterministic stand-in for the `confirm` step this operation
 * deliberately does not have (see `review-prep-io.mjs`'s header).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contentHashOf, createReviewPrepReader, createReviewPrepSinks, hasGitHubCredential, readPrep,
  recordPrepVerdict, resolveCardPath, todayIso,
} from '../review-prep-io.mjs';
import { REVIEW_PREP_EFFECTS, reviewPrepOperation } from '../review-prep.mjs';
import { projectReads } from '../engine.mjs';
import { notApplied } from '../effect-executor.mjs';

const IO_SOURCE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'review-prep-io.mjs');

/** The staged read, stubbed off the working tree — what `git show :<path>` would return with no racing writer. */
const stagedFromDisk = ({ path: rel, cwd: c }) => readFileSync(join(c, rel), 'utf8');

/**
 * Build the RECORD effect's payload THE WAY THE ENGINE DOES — `projectReads` over the `record` step's DECLARED
 * reads, then the step's own `effects(view)`.
 *
 * Going through the declaration rather than calling `recordPrepVerdict` with a hand-made `{land}` is the whole
 * point: `projectReads` hands a step only what it declares, so a `land` missing from `reads` is invisible
 * downstream no matter how correct the io shell is. A test that skipped this projection would stay green with
 * the flag inert.
 */
function recordEffectFor(input) {
  const declaration = reviewPrepOperation({ readPrep: () => { throw new Error('the reader is not used at `record`'); } });
  const { step } = declaration.steps.find((s) => s.name === 'record');
  const run = {
    input,
    verdict: {
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true, note: 'checked against live code' }],
      corrections: [],
      fixApplied: false,
      summary: 'the preparation holds up',
    },
    findings: { read: { item: input.item, repo: input.repo, contentHash: contentHashOf(CARD_RAW) } },
  };
  const view = projectReads(run, step.reads);
  return { view, payload: step.effects(view)[0].payload };
}

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'review-prep-io-'));
  mkdirSync(join(root, 'backlog'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const CARD_RAW = [
  '---',
  'kind: story',
  'size: 3',
  'status: open',
  'tags: [x, y]',
  'scope:',
  '  - we:scripts/foo.mjs',
  '  - we:scripts/bar.mjs',
  '---',
  '',
  '# A fake card for tests',
  '',
  'This card claims the sky is blue.',
  '',
].join('\n');

function writeCard(name, raw = CARD_RAW) {
  const path = join(root, 'backlog', name);
  writeFileSync(path, raw, 'utf8');
  return path;
}

describe('resolveCardPath', () => {
  it('resolves a hash-prefixed item to its card', () => {
    writeCard('9999-a-fake-card.md');
    expect(resolveCardPath({ item: '9999', cwd: root })).toBe(join(root, 'backlog', '9999-a-fake-card.md'));
  });

  it('resolves an exact `<item>.md` — a card whose slug IS its id', () => {
    writeCard('xk1tron.md');
    expect(resolveCardPath({ item: 'xk1tron', cwd: root })).toBe(join(root, 'backlog', 'xk1tron.md'));
  });

  it('refuses a missing item', () => {
    expect(() => resolveCardPath({ item: '404', cwd: root })).toThrow(/no backlog card matches/);
  });

  it('refuses an ambiguous item rather than guessing', () => {
    writeCard('42-first.md');
    writeCard('42-second.md');
    expect(() => resolveCardPath({ item: '42', cwd: root })).toThrow(/ambiguous/);
  });

  it('refuses an empty item', () => {
    expect(() => resolveCardPath({ item: '', cwd: root })).toThrow(/non-empty backlog id/);
  });
});

describe('readPrep', () => {
  it('reads frontmatter, body and scope — and hashes the raw bytes', () => {
    writeCard('9999-a-fake-card.md');
    const result = readPrep({ item: '9999', repo: 'chalbert/web-everything', cwd: root });
    expect(result.card.frontmatter).toMatchObject({ kind: 'story', size: 3, status: 'open', tags: ['x', 'y'] });
    expect(result.card.body).toContain('# A fake card for tests');
    expect(result.card.body).toContain('the sky is blue');
    expect(result.card.contentHash).toBe(contentHashOf(CARD_RAW));
    expect(result.scopeFiles).toEqual(['we:scripts/foo.mjs', 'we:scripts/bar.mjs']);
  });

  it('refuses a malformed repo rather than reading a card for nobody', () => {
    writeCard('9999-a-fake-card.md');
    expect(() => readPrep({ item: '9999', repo: 'not-a-repo', cwd: root })).toThrow(/owner\/name/);
  });

  it('`createReviewPrepReader` binds cwd, giving the declaration\'s injected `{item, repo}` shape', () => {
    writeCard('9999-a-fake-card.md');
    const reader = createReviewPrepReader({ cwd: root });
    const result = reader({ item: '9999', repo: 'chalbert/web-everything' });
    expect(result.scopeFiles).toEqual(['we:scripts/foo.mjs', 'we:scripts/bar.mjs']);
  });
});

describe('contentHashOf', () => {
  it('is deterministic and sensitive to a single byte', () => {
    expect(contentHashOf('a')).toBe(contentHashOf('a'));
    expect(contentHashOf('a')).not.toBe(contentHashOf('b'));
  });
});

describe('todayIso', () => {
  it('formats YYYY-MM-DD from a fixed clock', () => {
    expect(todayIso(new Date(2026, 7, 14))).toBe('2026-08-14'); // month is 0-indexed
  });
});

describe('recordPrepVerdict — the race guard', () => {
  it('a card that changed since it was read makes NO write and calls neither exec nor runNode', async () => {
    const path = writeCard('9999-a-fake-card.md');
    const calls = [];
    const result = await recordPrepVerdict({
      item: '9999',
      repo: 'chalbert/web-everything',
      cwd: root,
      confidence: 'High',
      risks: [],
      corrections: [],
      fixApplied: false,
      note: '',
      expectedContentHash: 'a-hash-that-will-never-match-the-live-file',
      exec: () => { calls.push('exec'); return ''; },
      runNode: () => { calls.push('runNode'); return '{}'; },
    });
    expect(result).toMatchObject({ recorded: false, aborted: true });
    expect(result.reason).toMatch(/changed since it was read/);
    expect(calls).toEqual([]);
    expect(readFileSync(path, 'utf8')).toBe(CARD_RAW); // byte-for-byte unchanged
  });

  it('a matching hash proceeds to write, commit and land', async () => {
    const path = writeCard('9999-a-fake-card.md');
    const calls = [];
    const result = await recordPrepVerdict({
      item: '9999',
      repo: 'chalbert/web-everything',
      cwd: root,
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true, note: 'checked against live code' }],
      corrections: [],
      fixApplied: false,
      note: 'the preparation holds up',
      expectedContentHash: contentHashOf(CARD_RAW),
      hasCredential: () => true,
      readStaged: stagedFromDisk,
      exec: (cmd, args) => { calls.push([cmd, args]); return args[0] === 'rev-parse' ? 'deadbeefcafe\n' : ''; },
      runNode: (argv) => { calls.push(['node', argv]); return JSON.stringify({ ok: true }); },
    });
    expect(result).toMatchObject({
      recorded: true, aborted: false, clean: true, disposition: 'landed', verified: true, landed: true, pushed: true,
    });
    const updated = readFileSync(path, 'utf8');
    expect(updated).toContain('## Independent review — ');
    expect(updated).toContain('Confidence: **High**');
    expect(updated).toContain('premise');
    // git add / commit / rev-parse, then the pr-land shell — and NOTHING ELSE. The length assertion is the
    // criterion: these positional asserts alone stay green while a stray `git push` sits at calls[4], which
    // is exactly the sentence ("pr-land owns the push on this path") they exist to protect. #3233 DW1.
    expect(calls).toHaveLength(4);
    expect(calls.some(([cmd, args]) => cmd === 'git' && args[0] === 'push')).toBe(false);
    expect(calls[0]).toEqual(['git', ['add', '--', 'backlog/9999-a-fake-card.md']]);
    expect(calls[1][0]).toBe('git');
    expect(calls[1][1][0]).toBe('commit');
    expect(calls[2]).toEqual(['git', ['rev-parse', 'HEAD']]);
    const landCall = calls[3];
    expect(landCall[0]).toBe('node');
    expect(landCall[1]).toContain(`${join(root, 'scripts', 'pr-land.mjs')}`);
    expect(landCall[1]).toContain('--label-on-green');
    expect(landCall[1]).toContain('--sha=deadbeefcafe');
    // THE BODY RIDES A FILE, NEVER `--body=<text>` — pr-land's own argv regex has no `s` flag, so a
    // multi-line `--body=` value fails the match outright and silently resolves to no body at all,
    // reproduced live against a real card (#1637) as pr-land's `empty-body` refusal.
    const bodyFlag = landCall[1].find((a) => a.startsWith('--body-file='));
    expect(bodyFlag).toBeTruthy();
    expect(landCall[1].some((a) => a.startsWith('--body='))).toBe(false);
    const bodyFilePath = bodyFlag.slice('--body-file='.length);
    const stagedBody = readFileSync(bodyFilePath, 'utf8');
    expect(stagedBody).toContain('Independent review of #9999');
    expect(stagedBody).toContain('## Independent review — ');
  });
});

describe('recordPrepVerdict — land vs park', () => {
  const baseArgs = (overrides = {}) => ({
    item: '9999',
    repo: 'chalbert/web-everything',
    cwd: root,
    expectedContentHash: contentHashOf(CARD_RAW),
    hasCredential: () => true,
    readStaged: stagedFromDisk,
    exec: (cmd, args) => (args[0] === 'rev-parse' ? 'deadbeefcafe\n' : ''),
    runNode: () => '{}',
    ...overrides,
  });

  it('parks (never lands) when a risk is left unaddressed', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    const result = await recordPrepVerdict(baseArgs({
      confidence: 'High',
      risks: [{ risk: 'consumer', addressed: false, note: 'a caller outside scope: was found' }],
      runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(result.clean).toBe(false);
    expect(result.disposition).toBe('parked');
    expect(seen[0]).toContain('--park=review:pending');
    expect(seen[0].some((a) => a === '--label-on-green')).toBe(false);
  });

  it('parks when a correction was applied, even at High confidence with all risks addressed', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    await recordPrepVerdict(baseArgs({
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true }],
      corrections: ['the cited line number is stale'],
      fixApplied: true,
      runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(seen[0]).toContain('--park=review:pending');
  });

  it('parks at Low confidence regardless of risk state', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    await recordPrepVerdict(baseArgs({
      confidence: 'Low', risks: [], runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(seen[0]).toContain('--park=review:pending');
  });

  it('lands cleanly at High confidence, every risk addressed, no corrections', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    const result = await recordPrepVerdict(baseArgs({
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true }, { risk: 'interface', addressed: true }],
      runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(result.clean).toBe(true);
    expect(seen[0]).toContain('--label-on-green');
  });
});

describe('recordPrepVerdict — failure classification', () => {
  it('a git commit failure is `notApplied` — nothing pushed, safe to retry', async () => {
    writeCard('9999-a-fake-card.md');
    await expect(recordPrepVerdict({
      item: '9999', repo: 'chalbert/web-everything', cwd: root, confidence: 'High', risks: [],
      expectedContentHash: contentHashOf(CARD_RAW),
      hasCredential: () => true,
      readStaged: stagedFromDisk,
      exec: () => { throw new Error('nothing to commit'); },
      runNode: () => { throw new Error('must not be reached'); },
    })).rejects.toMatchObject({ notApplied: true });
  });

  it('a pr-land failure AFTER a local commit is INDETERMINATE, not notApplied — the commit already happened', async () => {
    writeCard('9999-a-fake-card.md');
    const err = await recordPrepVerdict({
      item: '9999', repo: 'chalbert/web-everything', cwd: root, confidence: 'High', risks: [],
      expectedContentHash: contentHashOf(CARD_RAW),
      hasCredential: () => true,
      readStaged: stagedFromDisk,
      exec: (cmd, args) => (args[0] === 'rev-parse' ? 'deadbeefcafe\n' : ''),
      runNode: () => { throw new Error('gh: network unreachable'); },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.notApplied).toBeUndefined();
    expect(String(err.message)).toMatch(/UNKNOWN/);
    expect(String(err.message)).toContain('deadbeefcafe');
  });
});

// ── #3233 — THE LAND FLAG, THE CREDENTIAL DOWNGRADE, AND THE HAND-BACK ────────────────────────────────────
//
// Every case here drives the payload through the DECLARATION (`recordEffectFor`) rather than hand-writing a
// `land` value, because half of what #3233 fixes is the wiring: `input.land` has to be a DECLARED read of the
// `record` step or `projectReads` never hands it over and the flag is inert.
describe('recordPrepVerdict — land, downgrade, hand-back (#3233)', () => {
  const REF = 'lane/review-prep-9999-deadbeef';

  /** Spies shaped like the two injected transports, plus the pushes pulled out for assertion. */
  function spies({ pushFails = false } = {}) {
    const calls = [];
    const landed = [];
    return {
      calls,
      landed,
      pushes: () => calls.filter(([cmd, args]) => cmd === 'git' && args[0] === 'push'),
      exec: (cmd, args) => {
        calls.push([cmd, args]);
        if (pushFails && args[0] === 'push') throw new Error('remote rejected: shallow update not allowed');
        return args[0] === 'rev-parse' ? 'deadbeefcafe\n' : '';
      },
      runNode: (argv) => { landed.push(argv); return '{}'; },
    };
  }

  const record = (payload, extra) => recordPrepVerdict({
    ...payload,
    cwd: root,
    readStaged: stagedFromDisk,
    ...extra,
  });

  it('case 2 — an explicit `land: false` shells pr-land ZERO times and pushes exactly one commit BY SHA', async () => {
    writeCard('9999-a-fake-card.md');
    const { payload } = recordEffectFor({ item: '9999', repo: 'chalbert/web-everything', actor: 'operator', land: false });
    expect(payload.land).toBe(false);

    const spy = spies();
    const result = await record(payload, { hasCredential: () => true, exec: spy.exec, runNode: spy.runNode });

    expect(spy.landed).toHaveLength(0);
    expect(spy.pushes()).toHaveLength(1);
    // THE REFSPEC NAMES THE SHA. Asserting only "a push happened" passes on the defect this card exists for:
    // pushing a branch tip carries the caller's whole accumulated stack under one item's ref (six commits on
    // one lane, misattributed to whichever item was last).
    expect(spy.pushes()[0][1]).toEqual(['push', 'origin', `deadbeefcafe:refs/heads/${REF}`]);
    expect(result).toMatchObject({ recorded: true, verified: true, pushed: true, landed: false, clean: true, ref: REF });
    expect(result.followUp[0]).toBe('node');
    expect(result.followUp).toContain(`--sha=deadbeefcafe`);
    expect(result.followUp).toContain('--label-on-green');
    // `disposition`/`land` describe what pr-land DID; nothing landed, so neither may be claimed.
    expect(result.disposition).toBeUndefined();
    expect(result.land).toBeUndefined();
    // `clean` IS retained — it is computed from the verdict, not from the land, and the caller holding a
    // `followUp` is exactly who needs to know which disposition that follow-up will ask for.
    expect(result.clean).toBe(true);
    // The downgrade did not fire; the caller asked for this.
    expect(result.reason).toBeUndefined();
  });

  it('case 3 — the DEFAULT land on a credential-less host DOWNGRADES rather than refusing', async () => {
    const path = writeCard('9999-a-fake-card.md');
    const { payload } = recordEffectFor({ item: '9999', repo: 'chalbert/web-everything', actor: 'operator', land: true });
    expect(payload.land).toBe(true);

    const spy = spies();
    const result = await record(payload, { hasCredential: () => false, exec: spy.exec, runNode: spy.runNode });

    // Write, stage, commit and push each fire — the verdict survives a reclaimed box.
    expect(readFileSync(path, 'utf8')).toContain('## Independent review — ');
    expect(spy.calls.map(([, args]) => args[0])).toEqual(['add', 'commit', 'rev-parse', 'push']);
    expect(spy.landed).toHaveLength(0);
    expect(result).toMatchObject({
      recorded: true, verified: true, pushed: true, landed: false, reason: 'no-credential', clean: true, ref: REF,
    });
    expect(Array.isArray(result.followUp)).toBe(true);
    expect(result.followUp.some((a) => a.endsWith('pr-land.mjs'))).toBe(true);
  });

  it('case 4 — a pre-#3233 run record with NO `land` key LANDS: the declared read plus `?? true`', async () => {
    writeCard('9999-a-fake-card.md');
    // A run record written before the field existed. Defaults are applied ONCE at `startRun` and never
    // re-applied on resume, so this record genuinely has no `land` key — `view.input.land` is `undefined`.
    const { view, payload } = recordEffectFor({ item: '9999', repo: 'chalbert/web-everything', actor: 'operator' });
    // The `record` step DECLARES the read, so `projectReads` materialises the key even when the record has no
    // value for it. Drop `'input.land'` from `reads` and the key is absent instead — the flag inert.
    expect(Object.prototype.hasOwnProperty.call(view.input, 'land')).toBe(true);
    expect(view.input.land).toBeUndefined();
    expect(payload.land).toBe(true);

    const spy = spies();
    const result = await record(payload, { hasCredential: () => true, exec: spy.exec, runNode: spy.runNode });

    expect(spy.landed).toHaveLength(1);
    expect(spy.pushes()).toHaveLength(0);
    expect(result).toMatchObject({ landed: true, pushed: true, disposition: 'landed' });
  });

  it('case 5 — a FAILED push returns pushed:false with the commit intact and does not throw', async () => {
    writeCard('9999-a-fake-card.md');
    const { payload } = recordEffectFor({ item: '9999', repo: 'chalbert/web-everything', actor: 'operator', land: false });
    const spy = spies({ pushFails: true });

    const result = await record(payload, { hasCredential: () => true, exec: spy.exec, runNode: spy.runNode });

    expect(result).toMatchObject({ recorded: true, verified: true, pushed: false, landed: false, sha: 'deadbeefcafe' });
    expect(Array.isArray(result.followUp)).toBe(true);
    expect(String(result.pushError)).toMatch(/shallow update not allowed/);
    // The COMMIT stands — that is what makes this branch reportable rather than a throw.
    expect(spy.calls.map(([, args]) => args[0])).toEqual(['add', 'commit', 'rev-parse', 'push']);
  });

  it('the staged content missing the section is a THIRD OUTCOME — nothing committed, nothing pushed', async () => {
    writeCard('9999-a-fake-card.md');
    const { payload } = recordEffectFor({ item: '9999', repo: 'chalbert/web-everything', actor: 'operator', land: false });
    const spy = spies();

    const result = await recordPrepVerdict({
      ...payload,
      cwd: root,
      hasCredential: () => true,
      readStaged: () => CARD_RAW, // a racing writer's bytes: the index does not carry the review section
      exec: spy.exec,
      runNode: spy.runNode,
    });

    expect(result).toMatchObject({ recorded: false, verified: false });
    expect(result.sha).toBeUndefined();
    // `add` precedes the verification by design — asserting it at zero would encode the wrong order.
    expect(spy.calls.map(([, args]) => args[0])).toEqual(['add']);
    expect(spy.landed).toHaveLength(0);
  });
});

// ── #3233 — THE PROBE ITSELF ──────────────────────────────────────────────────────────────────────────────
describe('hasGitHubCredential', () => {
  it('reads the cloud-VM `prox…` sentinel as NO credential, with no subprocess', () => {
    let shelled = false;
    const answer = hasGitHubCredential({
      env: { GH_TOKEN: 'proxy-token-xy' },
      exec: () => { shelled = true; return ''; },
    });
    expect(answer).toBe(false);
    expect(shelled).toBe(false);
  });

  it('asks `gh` when no token is set, and reads a non-zero exit as NO credential', () => {
    expect(hasGitHubCredential({ env: {}, exec: () => '' })).toBe(true);
    expect(hasGitHubCredential({ env: {}, exec: () => { throw new Error('gh: command not found'); } })).toBe(false);
  });

  it('accepts a real token shape and still confirms it with `gh`', () => {
    const seen = [];
    expect(hasGitHubCredential({ env: { GH_TOKEN: 'ghp_0123456789abcdef' }, exec: (c, a) => { seen.push([c, a]); return ''; } })).toBe(true);
    expect(seen).toEqual([['gh', ['auth', 'status']]]);
  });
});

// ── #3233 DW6 — THE TWO DOC BLOCKS, both rewritten, both asserted POSITIVELY ──────────────────────────────
// A bare "does not contain LANDS OR PARKS" check is green today for the FILE HEADER (the string has never
// been there — it lives in `recordPrepVerdict`'s own JSDoc), so absence alone would be decorative on one of
// the two blocks. Each is therefore required to SAY the new mechanism.
describe('the io shell documents the credential downgrade, not an automatic land', () => {
  const source = () => readFileSync(IO_SOURCE_PATH, 'utf8');

  it('the FILE HEADER (lines 1-31) describes the downgrade instead of an automatic commit-and-land', () => {
    const header = source().split('\n').slice(0, 31).join('\n');
    expect(header).toMatch(/LANDING IS NOT AUTOMATIC/);
    expect(header).toMatch(/DOWNGRADED to push-only/);
    expect(header).toContain("reason: 'no-credential'");
    expect(header).toContain('followUp');
    // the sentence this card replaced
    expect(header).not.toMatch(/appends a review section, commits, and shells/);
  });

  it("`recordPrepVerdict`'s own JSDoc no longer says LANDS OR PARKS and describes the downgrade instead", () => {
    const src = source();
    const at = src.indexOf('export async function recordPrepVerdict');
    const jsdoc = src.slice(src.lastIndexOf('/**', at), at);
    expect(jsdoc).not.toContain('LANDS OR PARKS');
    expect(jsdoc).toMatch(/DOWNGRADE/);
    expect(jsdoc).toContain("reason: 'no-credential'");
    expect(jsdoc).toMatch(/pushes exactly ONCE/);
  });
});

describe('createReviewPrepSinks', () => {
  it('wires the RECORD and NOTICE effect types', () => {
    const sinks = createReviewPrepSinks({ root });
    expect(typeof sinks[REVIEW_PREP_EFFECTS.RECORD]).toBe('function');
    expect(typeof sinks[REVIEW_PREP_EFFECTS.NOTICE]).toBe('function');
  });

  it('the NOTICE sink reports through the injected channel and writes nothing', async () => {
    const lines = [];
    const sinks = createReviewPrepSinks({ root, out: (l) => lines.push(l) });
    const result = await sinks[REVIEW_PREP_EFFECTS.NOTICE]({ notice: 'Card o/n#7 — recorded.' });
    expect(result).toEqual({ reported: true });
    expect(lines).toEqual(['Card o/n#7 — recorded.']);
  });
});

// `notApplied` re-export sanity — used above via `.toMatchObject({ notApplied: true })`; this just documents
// the helper is the SAME one `review-pr-io.mjs` uses, not a lookalike.
describe('notApplied', () => {
  it('marks an error so the executor retries rather than replays it as indeterminate', () => {
    expect(notApplied('x').notApplied).toBe(true);
  });
});
