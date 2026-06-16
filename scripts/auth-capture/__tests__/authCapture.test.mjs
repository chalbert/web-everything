/**
 * @file scripts/auth-capture/__tests__/authCapture.test.mjs
 * @description Tests for the managed-inbox auth-capture helper (#611). Exercises the pure heart —
 * `+`-aliasing, token/magic-link extraction, the provider registry, each provider's request/parse builders
 * — and `waitForToken` against a fake source with no network, no browser, no real waiting.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  aliasAddress, extractToken, TOKEN_KINDS,
  registerMailProvider, hasMailProvider, mailProviderNames, createMailSource,
} from '../mailSource.mjs';
import { waitForToken } from '../captureAuthed.mjs';
import { parseMailpitList, parseMailpitBody } from '../providers/mailpit.mjs';
import { buildSearchQuery, decodeBase64Url, extractGmailBody, parseGmailMessage } from '../providers/gmail.mjs';
import { pickDomain, parseMailtmList, parseMailtmBody, throwawayLocalPart } from '../providers/mailtm.mjs';

describe('aliasAddress — per-site +alias off one mailbox', () => {
  it('inserts a slugified +tag before the @', () => {
    expect(aliasAddress('screenshots@gmail.com', 'Acme App')).toBe('screenshots+acme-app@gmail.com');
  });
  it('appends to a bare local-part (a sink user with no @)', () => {
    expect(aliasAddress('screenshots', 'acme')).toBe('screenshots+acme');
  });
  it('falls back to +site for an empty/garbage tag', () => {
    expect(aliasAddress('a@b.com', '!!!')).toBe('a+site@b.com');
  });
});

describe('extractToken — magic-link + OTP extraction (pure)', () => {
  it('extracts the first link and trims trailing sentence punctuation', () => {
    const body = 'Welcome! Confirm here: https://app.example.com/verify?token=abc123.';
    expect(extractToken(body, { kind: TOKEN_KINDS.link })).toBe('https://app.example.com/verify?token=abc123');
  });
  it('narrows to a urlMatch when several links are present', () => {
    const body = 'Home https://app.example.com/home or verify https://app.example.com/verify?t=9';
    expect(extractToken(body, { kind: TOKEN_KINDS.link, urlMatch: /verify/ })).toBe('https://app.example.com/verify?t=9');
  });
  it('extracts a numeric OTP and normalizes a split code', () => {
    expect(extractToken('Your code is 481920', { kind: TOKEN_KINDS.otp })).toBe('481920');
    expect(extractToken('Code: 481 920', { kind: TOKEN_KINDS.otp })).toBe('481920');
  });
  it('accepts an upper-alnum OTP only with alnum:true', () => {
    expect(extractToken('Code: AB12CD', { kind: TOKEN_KINDS.otp })).toBeNull();
    expect(extractToken('Code: AB12CD', { kind: TOKEN_KINDS.otp, alnum: true })).toBe('AB12CD');
  });
  it('returns null on an empty/non-string body', () => {
    expect(extractToken('', { kind: TOKEN_KINDS.link })).toBeNull();
    expect(extractToken(undefined)).toBeNull();
  });
});

describe('provider registry', () => {
  it('lists the three built-in providers once imported', () => {
    // importing the provider modules above registered them
    expect(mailProviderNames()).toEqual(['gmail', 'mailpit', 'mailtm']);
    expect(hasMailProvider('mailpit')).toBe(true);
  });
  it('throws a listing error for an unknown provider', () => {
    expect(() => createMailSource('nope')).toThrow(/unknown mail provider "nope".*gmail, mailpit, mailtm/);
  });
  it('builds a registered source via its factory', () => {
    registerMailProvider('fake', () => ({ name: 'fake', address: () => 'x@y', list: async () => [] }));
    expect(createMailSource('fake').name).toBe('fake');
  });
});

describe('mailpit provider parsers (pure)', () => {
  it('parses a list response into summaries', () => {
    const out = parseMailpitList({ messages: [{ ID: '1', Subject: 'Verify', From: { Address: 'no-reply@x' }, Created: 't' }] });
    expect(out).toEqual([{ id: '1', from: 'no-reply@x', subject: 'Verify', body: '', receivedAt: 't' }]);
  });
  it('prefers the Text body, falls back to HTML', () => {
    expect(parseMailpitBody({ Text: 'plain', HTML: '<b>h</b>' })).toBe('plain');
    expect(parseMailpitBody({ HTML: '<b>h</b>' })).toBe('<b>h</b>');
  });
});

describe('gmail provider builders (pure)', () => {
  it('builds a to:+newer_than search query', () => {
    expect(buildSearchQuery({ to: 'a+b@x.com', newerThan: '2h' })).toBe('to:a+b@x.com newer_than:2h');
  });
  it('decodes a base64url body', () => {
    const data = Buffer.from('hello world', 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    expect(decodeBase64Url(data)).toBe('hello world');
  });
  it('walks the payload tree for the first text/plain part', () => {
    const enc = (s) => Buffer.from(s, 'utf8').toString('base64');
    const payload = { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/html', body: { data: enc('<b>hi</b>') } },
      { mimeType: 'text/plain', body: { data: enc('plain body') } },
    ] };
    expect(extractGmailBody(payload)).toBe('plain body');
  });
  it('maps a full message resource', () => {
    const enc = (s) => Buffer.from(s, 'utf8').toString('base64');
    const json = {
      id: 'm1', internalDate: '0',
      payload: { headers: [{ name: 'From', value: 'no-reply@x' }, { name: 'Subject', value: 'Code' }],
        mimeType: 'text/plain', body: { data: enc('your code 123456') } },
    };
    const m = parseGmailMessage(json);
    expect(m).toMatchObject({ id: 'm1', from: 'no-reply@x', subject: 'Code', body: 'your code 123456' });
  });
});

describe('mailtm provider parsers (pure)', () => {
  it('picks the first active domain', () => {
    expect(pickDomain({ 'hydra:member': [{ domain: 'a.tm', isActive: false }, { domain: 'b.tm', isActive: true }] })).toBe('b.tm');
  });
  it('parses a list + a detail body', () => {
    expect(parseMailtmList({ 'hydra:member': [{ id: '1', subject: 'Hi', from: { address: 'x@y' }, intro: 'preview', createdAt: 't' }] }))
      .toEqual([{ id: '1', from: 'x@y', subject: 'Hi', body: 'preview', receivedAt: 't' }]);
    expect(parseMailtmBody({ text: 'full body' })).toBe('full body');
  });
  it('slugifies a throwaway local-part', () => {
    expect(throwawayLocalPart('Acme App!')).toBe('acmeapp');
    expect(throwawayLocalPart('')).toBe('screenshots');
  });
});

describe('waitForToken — source-agnostic polling (no real waiting)', () => {
  const noSleep = async () => {};
  const fakeSource = (pages) => {
    let i = 0;
    return { name: 'fake', address: () => 'screenshots+s@x', list: async () => pages[Math.min(i++, pages.length - 1)] };
  };

  it('returns the first token once it appears, after empty polls', async () => {
    const source = fakeSource([
      [], // poll 1: nothing yet
      [{ id: '1', body: 'no token here' }], // poll 2: still nothing extractable
      [{ id: '2', body: 'open https://app/verify?t=Z' }], // poll 3: arrives
    ]);
    const { token, message } = await waitForToken(source, { kind: TOKEN_KINDS.link, urlMatch: /verify/, attempts: 5, sleep: noSleep });
    expect(token).toBe('https://app/verify?t=Z');
    expect(message.id).toBe('2');
  });

  it('throws after exhausting attempts with no token', async () => {
    const source = fakeSource([[{ id: '1', body: 'nothing' }]]);
    await expect(waitForToken(source, { kind: TOKEN_KINDS.otp, attempts: 3, sleep: noSleep }))
      .rejects.toThrow(/no otp token after 3 attempt/);
  });
});
