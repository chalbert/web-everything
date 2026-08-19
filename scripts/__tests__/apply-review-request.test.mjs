/**
 * @file apply-review-request.test.mjs — the machine applier (#x39x752 slice 2).
 *
 * WHAT IS WORTH PINNING is not that a JSON file parses. It is the set of things an UNATTENDED applier must
 * refuse, because the whole point of this path is that no human is watching when it runs:
 *
 *   · `clear-human` — human-ceremony-only (INVARIANT 2, #2285). CI holds a write token, and a token is not a
 *     ceremony. Refused HERE as well as in the single home; two refusals for one rule is deliberate.
 *   · an empty `changes` — a bounce with no findings tells an author nothing (#xd6moh1).
 *   · a malformed subject — a request that cannot name its PR must not reach a subprocess.
 *
 * And one thing worth pinning about what it does NOT do: it never builds a `gh` call of its own. The argv it
 * hands over is the single home's CLI, with the single home's flags.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  APPLIABLE_TARGETS, REPO_ROOT, buildEnv, buildLabelArgv, validateRequest,
} from '../apply-review-request.mjs';

const OK = { repo: 'chalbert/web-everything', pr: 1466, to: 'accepted', actor: 'reviewer', body: '# verdict' };

describe('what this applier REFUSES', () => {
  /**
   * `clear-human` WAS refused outright here. Operator ruling 2026-08-19 — made with the weakness stated in
   * front of them — allows it when the request carries the instruction authorising it. These tests changed
   * DELIBERATELY, and this comment is the record of why, because a suite that quietly flips an invariant is
   * indistinguishable from one that never held it.
   *
   * The ruling gives up less than it looks: the workstation path never verified a human either (#2895 shipped
   * the clearance as "the raw command with better manners", #2946 is the open durable fix). What the field
   * buys is that a clearance nobody asked for requires inventing a quote and publishing it.
   */
  it('ACCEPTS clear-human when the operator instruction is attached', () => {
    const r = validateRequest({ ...OK, to: 'clear-human', operatorInstruction: 'remove the human tag on 1445' });
    expect(r.ok).toBe(true);
    expect(r.request.operatorInstruction).toBe('remove the human tag on 1445');
  });

  it('REFUSES clear-human with no instruction — the authorisation is the whole guard', () => {
    for (const operatorInstruction of [undefined, '', '   ', 42, null]) {
      const r = validateRequest({ ...OK, to: 'clear-human', operatorInstruction });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/operatorInstruction/);
    }
  });

  it('names #2946 in the refusal, so nobody reads the field as verification', () => {
    expect(validateRequest({ ...OK, to: 'clear-human' }).error).toMatch(/#2946/);
  });

  it('refuses an instruction attached to an ORDINARY verdict — that is a copied clearance request', () => {
    expect(validateRequest({ ...OK, to: 'accepted', operatorInstruction: 'x' }).ok).toBe(false);
    expect(validateRequest({ ...OK, to: 'changes', body: 'f', operatorInstruction: 'x' }).ok).toBe(false);
  });

  it('refuses an empty `changes` — a bounce with no findings lands nothing', () => {
    expect(validateRequest({ ...OK, to: 'changes', body: '   ' }).error).toMatch(/non-empty `body`/);
    expect(validateRequest({ ...OK, to: 'changes', body: undefined }).error).toMatch(/non-empty `body`/);
  });

  it('accepts a `changes` that carries its findings', () => {
    expect(validateRequest({ ...OK, to: 'changes', body: '- the thing is wrong' }).ok).toBe(true);
  });

  it('refuses a verdict target it does not know', () => {
    for (const to of ['rearm', 'merged', 'ACCEPTED', '', null, undefined]) {
      expect(validateRequest({ ...OK, to }).ok).toBe(false);
    }
    expect(APPLIABLE_TARGETS).toEqual(['accepted', 'changes', 'clear-human']);
  });

  it('refuses a subject it cannot name', () => {
    expect(validateRequest({ ...OK, repo: 'not-a-slug' }).error).toMatch(/owner\/name/);
    expect(validateRequest({ ...OK, pr: 0 }).error).toMatch(/positive integer/);
    expect(validateRequest({ ...OK, pr: '1466' }).error).toMatch(/positive integer/);
  });

  it('refuses an unattributed verdict', () => {
    expect(validateRequest({ ...OK, actor: '  ' }).error).toMatch(/`actor` is required/);
  });

  it('refuses anything that is not an object, without throwing', () => {
    for (const raw of [null, undefined, 'accepted', 42, ['accepted']]) {
      expect(validateRequest(raw)).toEqual({ ok: false, error: 'request must be a JSON object' });
    }
  });
});

describe('the argv handed to the SINGLE HOME', () => {
  it('invokes review-set-label.mjs with its own flags, and builds no gh call of its own', () => {
    const { request } = validateRequest(OK);
    const argv = buildLabelArgv(request, '/tmp/body.md');
    expect(argv[0]).toBe(join(REPO_ROOT, 'scripts', 'review-set-label.mjs'));
    expect(argv).toContain('1466');
    expect(argv).toContain('--repo=chalbert/web-everything');
    expect(argv).toContain('--to=accepted');
    expect(argv).toContain('--actor=reviewer');
    expect(argv).toContain('--body-file=/tmp/body.md');
    expect(argv.join(' ')).not.toContain('gh ');
  });

  it('passes the channel through when the request names one, and omits it otherwise', () => {
    const withCh = validateRequest({ ...OK, channel: 'ci-applier' }).request;
    expect(buildLabelArgv(withCh, '/tmp/b.md')).toContain('--channel=ci-applier');
    expect(buildLabelArgv(validateRequest(OK).request, '/tmp/b.md').some((a) => a.startsWith('--channel='))).toBe(false);
  });

  it('passes the operator instruction as --reason, verbatim, for a clearance', () => {
    // VERBATIM, not paraphrased: a paraphrase is the agent's account of what it was told rather than what it
    // was told, and the single home posts this straight into the durable comment.
    const words = 'For now, I want to allow you to accept an explicit demand to remove human tag.';
    const { request } = validateRequest({ ...OK, to: 'clear-human', operatorInstruction: words });
    expect(buildLabelArgv(request, null)).toContain(`--reason=${words}`);
  });

  it('adds no --reason to an ordinary verdict', () => {
    const { request } = validateRequest(OK);
    expect(buildLabelArgv(request, null).some((a) => a.startsWith('--reason='))).toBe(false);
  });

  it('omits --body-file when there is no body to pass', () => {
    expect(buildLabelArgv(validateRequest(OK).request, null).some((a) => a.startsWith('--body-file='))).toBe(false);
  });
});

/**
 * The actor identity. The request DECLARES a session id and nothing verifies it — the same self-assertion an
 * env var on a workstation already is (#2895 deferred the unforgeable signal; #2946 is the durable fix). What
 * these pin is that an ABSENT id is left absent, so the durable comment records independence as unproven
 * rather than inheriting whatever the runner happened to carry.
 */
describe('the session identity handed to the CLI', () => {
  it('carries the judging session id, so the record names who DECIDED', () => {
    const { request } = validateRequest({ ...OK, sessionId: 'sess-judge-1' });
    expect(buildEnv(request, {}).CLAUDE_CODE_SESSION_ID).toBe('sess-judge-1');
  });

  it('DELETES an inherited id when the request declares none — never silently reuses the runner’s', () => {
    const { request } = validateRequest(OK);
    const env = buildEnv(request, { CLAUDE_CODE_SESSION_ID: 'sess-of-some-other-thing', PATH: '/bin' });
    expect(env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    expect(env.PATH).toBe('/bin');
  });

  it('refuses a present-but-empty session id rather than treating it as absent', () => {
    expect(validateRequest({ ...OK, sessionId: '' }).ok).toBe(false);
  });
});
