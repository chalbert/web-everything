/**
 * @file scripts/operations/__tests__/command-redact.test.mjs
 * @description Tests for `command-redact.mjs#redactCommandLine` — PR #2220 review (security): a host process's
 * full argv is persisted to the durable telemetry NDJSON and printed by `telemetry-cli report`, so
 * credential-shaped values must be masked and control characters neutralised before either happens.
 */
import { describe, it, expect } from 'vitest';

import { REDACTED, redactCommandLine } from '../command-redact.mjs';

describe('redactCommandLine — credential-shaped argv values are masked, identity is kept', () => {
  const cases = [
    ['--flag=value', 'node tool.mjs --token=abc123SECRET --verbose', 'abc123SECRET', `node tool.mjs --token=${REDACTED} --verbose`],
    ['--flag value', 'node tool.mjs --api-key abc123SECRET --verbose', 'abc123SECRET', `node tool.mjs --api-key ${REDACTED} --verbose`],
    ['quoted flag value with spaces', 'run --password="hunter 2 trombone" go', 'hunter 2 trombone', `run --password=${REDACTED} go`],
    ['env assignment', 'GITHUB_TOKEN=abc123SECRET node build.mjs', 'abc123SECRET', `GITHUB_TOKEN=${REDACTED} node build.mjs`],
    ['Authorization header (quoted)', "curl -H 'Authorization: Bearer abc123SECRET' https://x.test", 'abc123SECRET', `curl -H 'Authorization: ${REDACTED}' https://x.test`],
    ['bare Bearer', 'curl -H "X-Auth: Bearer abc123SECRETvalue" https://x.test', 'abc123SECRETvalue', `curl -H "X-Auth: Bearer ${REDACTED}" https://x.test`],
    ['URL user:pass', 'psql postgres://admin:hunter2Trombone@db.internal/app', 'hunter2Trombone', `psql postgres://admin:${REDACTED}@db.internal/app`],
    ['URL lone token userinfo', 'git clone https://ghp_abcdefghijklmnop1234@github.com/o/r', 'ghp_abcdefghijklmnop1234', `git clone https://${REDACTED}@github.com/o/r`],
    ['known-prefix token in a bare argument', 'node x.mjs sk-abcdefghijklmnopqrstuv', 'sk-abcdefghijklmnopqrstuv', `node x.mjs ${REDACTED}`],
  ];
  for (const [name, input, secret, expected] of cases) {
    it(`masks: ${name}`, () => {
      const out = redactCommandLine(input);
      expect(out).not.toContain(secret);
      expect(out).toBe(expected);
    });
  }

  it('leaves an ordinary command line untouched (identity is the point of keeping argv)', () => {
    const plain = '/Applications/Spotify.app/Contents/MacOS/Spotify Helper --type=gpu-process --no-sandbox';
    expect(redactCommandLine(plain)).toBe(plain);
    expect(redactCommandLine('git -C /w/lane-3 log --oneline -5')).toBe('git -C /w/lane-3 log --oneline -5');
  });

  it('does not swallow the next FLAG as the value of a valueless credential-named flag', () => {
    expect(redactCommandLine('tool --no-auth --verbose')).toBe('tool --no-auth --verbose');
  });

  it('is idempotent — redacting an already-redacted line changes nothing', () => {
    const once = redactCommandLine("curl --token=abc123SECRET -H 'Authorization: Bearer xyz98765432' postgres://u:pw12345678@h/d");
    expect(redactCommandLine(once)).toBe(once);
  });

  it('replaces C0/C1 control characters (ANSI/OSC escapes, BEL, NUL, CR) so a crafted title cannot drive a terminal', () => {
    const out = redactCommandLine('node a.mjs \u001b[2J\u001b]0;pwned\u0007 x\u0000y\r\n\u009b');
    expect(out).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(out).toContain('node a.mjs');
  });

  it('a secret is masked BEFORE any caller truncation — masking a straddling value cannot leave half of it', () => {
    const line = `${'x'.repeat(470)} --token=SECRETSECRETSECRET`;
    expect(redactCommandLine(line).slice(0, 480)).not.toContain('SECRET');
  });

  it('is total on non-string / hostile input', () => {
    for (const junk of [undefined, null, 42, {}, [], '']) expect(() => redactCommandLine(junk)).not.toThrow();
    expect(redactCommandLine(undefined)).toBe('');
    expect(redactCommandLine(null)).toBe('');
  });
});
