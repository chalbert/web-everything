/**
 * @file clear-human-request.test.mjs — the REMOTE human ceremony (#2895 family).
 *
 * WHAT IS WORTH PINNING is the boundary this path draws, because it is one refusal away from becoming the
 * escalation #2285 exists to prevent. `we:scripts/apply-review-request.mjs` refuses `clear-human` because its
 * basis is a PUSH, and push access is not personhood. This file's basis is a GitHub-authenticated comment. The
 * tests below hold the line between them:
 *
 *   · only the repository OWNER may clear, by the association GitHub computed — never a claim in the body;
 *   · the person is authorised BEFORE their words are read, so a stranger's text never reaches the parser;
 *   · the trigger is an exact token at the START of the comment — discussing a clearance is not performing one
 *     (#3060: never infer a clearance from prose);
 *   · a reason is mandatory and travels verbatim, with the comment URL, so the record is checkable later.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  CLEARING_ASSOCIATIONS, CLEAR_TOKEN, REPO_ROOT,
  authorizeClearance, buildLabelArgv, buildReason, parseClearHumanComment, readEvent,
} from '../clear-human-request.mjs';

describe('who may perform a human ceremony', () => {
  const OK = { login: 'chalbert', association: 'OWNER', owner: 'chalbert' };

  it('lets the repository owner clear', () => {
    expect(authorizeClearance(OK).ok).toBe(true);
  });

  it('REFUSES every association short of OWNER — a token or a grant is not personhood', () => {
    for (const association of ['COLLABORATOR', 'MEMBER', 'CONTRIBUTOR', 'NONE', 'FIRST_TIME_CONTRIBUTOR', undefined]) {
      const r = authorizeClearance({ ...OK, association });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/INVARIANT 2|author_association/);
    }
    // Widening this is a DECISION — it must be an edit to the constant, not a surprise.
    expect(CLEARING_ASSOCIATIONS).toEqual(['OWNER']);
  });

  it('refuses someone who is not the owner even when GitHub calls them OWNER of somewhere else', () => {
    expect(authorizeClearance({ ...OK, login: 'someone-else' }).ok).toBe(false);
  });

  it('matches the login case-insensitively — GitHub logins are not case-sensitive', () => {
    expect(authorizeClearance({ ...OK, login: 'ChalBert' }).ok).toBe(true);
  });

  it('refuses when either identity is missing rather than defaulting one', () => {
    expect(authorizeClearance({ ...OK, login: undefined }).ok).toBe(false);
    expect(authorizeClearance({ ...OK, owner: undefined }).ok).toBe(false);
    expect(authorizeClearance().ok).toBe(false);
  });
});

describe('what counts as a clearance', () => {
  it('accepts the token followed by a reason', () => {
    expect(parseClearHumanComment('/clear-human the statute edit is mine and intended'))
      .toEqual({ ok: true, reason: 'the statute edit is mine and intended' });
  });

  it('requires the token to OPEN the comment — discussing a clearance is not performing one', () => {
    for (const body of [
      'I think we should /clear-human this one',
      'we could clear it with /clear-human tomorrow',
      'not /clear-human yet',
    ]) {
      expect(parseClearHumanComment(body).ok).toBe(false);
    }
  });

  it('does not fire on a token that merely starts the same way', () => {
    expect(parseClearHumanComment('/clear-humanoid go').ok).toBe(false);
    expect(parseClearHumanComment('/clear-human-please go').ok).toBe(false);
  });

  it('REQUIRES a reason — a clearance nobody explained cannot be reviewed later', () => {
    for (const body of [CLEAR_TOKEN, `${CLEAR_TOKEN} `, `${CLEAR_TOKEN}\n\n`, '  /clear-human   ']) {
      const r = parseClearHumanComment(body);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/reason/);
    }
  });

  it('carries a multi-line reason intact, and tolerates CRLF from the web UI', () => {
    expect(parseClearHumanComment('/clear-human line one\r\nline two').reason).toBe('line one\nline two');
  });

  it('refuses a non-string body without throwing', () => {
    for (const body of [undefined, null, 42, {}]) expect(parseClearHumanComment(body).ok).toBe(false);
  });
});

describe('the event it will act on', () => {
  const payload = {
    issue: { number: 1445, pull_request: { url: 'https://api.github.invalid/pulls/1445' } },
    repository: { full_name: 'chalbert/web-everything', owner: { login: 'chalbert' } },
    comment: {
      user: { login: 'chalbert' }, author_association: 'OWNER',
      body: '/clear-human mine', html_url: 'https://github.com/chalbert/web-everything/pull/1445#issuecomment-1',
    },
  };

  it('reads the subject, the actor and the association off the payload', () => {
    const { event } = readEvent(payload);
    expect(event).toMatchObject({
      pr: 1445, repo: 'chalbert/web-everything', owner: 'chalbert', login: 'chalbert', association: 'OWNER',
    });
  });

  it('REFUSES a comment on an issue — an issue carries no review hold to clear', () => {
    const { pull_request, ...issue } = payload.issue;
    expect(readEvent({ ...payload, issue }).ok).toBe(false);
  });

  it('refuses a payload it cannot name a subject from', () => {
    expect(readEvent({ ...payload, repository: { full_name: 'nope' } }).ok).toBe(false);
    expect(readEvent({ ...payload, issue: { ...payload.issue, number: 0 } }).ok).toBe(false);
    expect(readEvent(undefined).ok).toBe(false);
  });
});

describe('the record the ceremony leaves', () => {
  it('keeps the operator’s words verbatim and appends provenance a third party can check', () => {
    const reason = buildReason({
      reason: 'mine and intended',
      commentUrl: 'https://github.com/o/n/pull/7#issuecomment-9',
      login: 'chalbert',
    });
    expect(reason).toContain('mine and intended');
    expect(reason).toContain('https://github.com/o/n/pull/7#issuecomment-9');
    expect(reason).toContain('@chalbert');
  });

  it('states the limit of the signal IN the record, so nobody reads it as more than it is', () => {
    const reason = buildReason({ reason: 'x', commentUrl: 'u', login: 'l' });
    expect(reason).toMatch(/not that a physical gesture occurred/);
    expect(reason).toContain('#2946');
  });
});

describe('the argv handed to the SINGLE HOME', () => {
  it('invokes review-set-label.mjs, and builds no gh call of its own', () => {
    const argv = buildLabelArgv({ pr: 1445, repo: 'o/n', actor: 'chalbert', reason: 'because' });
    expect(argv[0]).toBe(join(REPO_ROOT, 'scripts', 'review-set-label.mjs'));
    expect(argv).toContain('1445');
    expect(argv).toContain('--repo=o/n');
    expect(argv).toContain('--to=clear-human');
    expect(argv).toContain('--actor=chalbert');
    expect(argv).toContain('--reason=because');
    expect(argv.join(' ')).not.toContain('gh ');
  });

  it('names the surface, so the durable comment says where the clearance came through', () => {
    expect(buildLabelArgv({ pr: 1, repo: 'o/n', actor: 'a', reason: 'r' })).toContain('--channel=github-comment');
  });
});
