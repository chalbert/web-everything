/**
 * @file secret-scrub.test.mjs — unit proof of the PUBLISH-SEAM detector (#3015, under #2978 Fork 3).
 *
 * WHAT THIS FILE IS FOR. `scrubPublish` is the gate standing between an authored/harvested string and a
 * COMMITTED, PUSHED artifact. Two failure modes matter and both are pinned here:
 *   • it must REJECT a credential in each family it claims to cover — otherwise the gate is theatre;
 *   • it must PASS ordinary, correct backlog/memory prose — a `we:`-prefixed repo path citation, a quoted
 *     identifier, a commit SHA. A gate that fires on correct authorship gets routed around, and then it
 *     protects nothing at all. That is why the detector is NARROWER than the append-seam `scrubReasons`,
 *     and the "should pass" block below is the load-bearing half of this file, not the courtesy half.
 *
 * THE CALIBRATION IS PART OF THE CONTRACT. The two entropy thresholds were measured against the whole
 * committed corpus (3,319 files). The pins at the bottom encode the measured margins, so tightening a
 * threshold on a hunch goes red here rather than reddening `check:standards` for everyone.
 *
 * NO REAL SECRET APPEARS IN THIS FILE. Every fixture is an obviously-synthetic marker (`SYNTHETIC`,
 * `NOTREAL`, `EXAMPLE`) or random-looking filler that was never issued by any service.
 */
import { describe, it, expect } from 'vitest';
import {
  scrubPublish, scrubReasons, isOpaquePublishToken, shannonEntropy,
} from '../lib/secret-scrub.mjs';

/** The one marker the whole #3015 suite writes through real paths. Obviously synthetic; never issued. */
export const SYNTHETIC_MARKER = 'sk-SYNTHETIC0000TESTMARKERNOTREAL';

describe('scrubPublish — rejects a credential in every family it claims', () => {
  const reject = (label, value) => it(label, () => {
    const reasons = scrubPublish(value);
    expect(reasons.length, `should reject: ${value}`).toBeGreaterThan(0);
  });

  reject('the suite-wide synthetic api-key marker', `we saw ${SYNTHETIC_MARKER} in the log`);
  reject('a PEM private-key block', '-----BEGIN RSA PRIVATE KEY-----\nSYNTHETICNOTREAL\n-----END');
  reject('a GitHub token', 'rotate ghp_SYNTHETIC0000abcdefABCDEF0123456789 now');
  reject('a GitHub fine-grained PAT', `github_pat_${'S'}YNTHETIC00_${'a'.repeat(50)}`);
  // No digit run after the prefix, on purpose. The digits-then-digits-then-blob shape is what GitHub's own
  // push protection recognises as a live Slack token — it rejected this push when the fixture had one, even
  // though the value was invented. A fixture that trips a real scanner is a fixture that could be mistaken
  // for a credential, which is exactly what this repo must never commit. This still trips `xox[baprs]-`.
  reject('a Slack token', 'xoxb-NOTAREALTOKEN-SYNTHETIC-NOTREAL');
  reject('an AWS access key id', 'AKIASYNTHETIC0000NR was in the env');
  reject('a Google API key', 'AIzaSyNOTREALsynthetic0000000000000000000');
  reject('a JWT', 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJTWU5USEVUSUMifQ.c3ludGhldGlj');
  reject('a URL with inline credentials', 'psql postgres://admin:hunter2Trombone@db.internal/app');
  reject('a labeled credential with a secret-shaped value', 'set password: hunter2Trombone in the env');
  reject('a labeled api_key', 'api_key=Synthetic0Value1Here2');
  reject('an unlabeled high-entropy opaque token', 'the value was Xk7Qz9Rw4Tn2Bv6Hy8Jm3Fd5Gs1Lp0Cw');
  reject('a long random base64 blob', 'blob n5FQ8vZ2xK7dW1jT6bR3yG9pC0mS4hL8uA5eN2qX7zV1oB6iD3kY9fJ4wP0tM8rH=');

  it('is TOTAL — a non-string is a reason, never a throw', () => {
    for (const v of [undefined, null, 42, {}, []]) expect(scrubPublish(v)).toEqual(['not a string']);
  });
});

describe('scrubPublish — PASSES ordinary, correct backlog/memory prose', () => {
  // Each fixture is real shape lifted from the committed corpus. A red here means the gate would block
  // authorship the repo requires — which is how a security gate gets disabled.
  const pass = (label, value) => it(label, () => {
    expect(scrubPublish(value), `should pass: ${value}`).toEqual([]);
  });

  pass('a we:-prefixed repo path citation (#883 REQUIRES this shape)',
    'The funnel is we:scripts/backlog.mjs `writeBacklogMd` (line 96), mirrored in we:scripts/backlog-guard.mjs.');
  pass('a Grounding-filter citation with a line locus',
    'Corroborated by we:scripts/lib/secret-scrub.mjs:120 and we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment.');
  pass('a quoted code identifier and a call shape',
    'Call `scrubPublish(content)` before `writeBacklogMdUnguarded(...)` and `die()` on any hit.');
  pass('a fenced code block (CODE_PATTERNS is retired at this seam)',
    'Example:\n```js\nconst reasons = scrubPublish(content);\nif (reasons.length) die(reasons.join("; "));\n```');
  pass('a site-relative route', 'The card renders at /backlog/3015-move-the-learnings-secret-scrub and links /api/backlog.');
  pass('the repo\'s own documented machine paths',
    'Run it in a lane clone (~/workspace/.lanes/web-everything/lane-N); hooks live in ~/.claude/settings.json.');
  pass('a git SHA citation', 'Landed as 0722238c375844a363ea7c611eb82b381a64998b on main.');
  pass('a UUID a card legitimately quotes', 'session 43c091c2-3478-4489-a078-8bb6c34d20bb dropped the entry');
  pass('hyphenated prose the append-seam detector flags', 'a UTF-16-code-unit offset, JS-first-vs-CSS-first, branch-vs-branch');
  pass('a long module path (the append-seam base64 rule\'s worst false positive)',
    'we:plugs/webregistries/CustomElementRegistry and we:blocks/renderers/component/declarativeComponent');
  pass('a screaming-snake identifier', 'The REGISTRY_SCRIPT_TYPE constant and pullRefreshThresholdPx knob.');
  pass('a localhost address', 'the worker forwards frames to 127.0.0.1:<port>/bridge on the host');
  pass('a machine-account email and a test-vector placeholder',
    'origin is `git@github.com:chalbert/web-everything.git`; the vector sets the email field to a@b.com');
  pass('a plain generalized sentence', 'the lane gate is too coarse for docs-only diffs');
});

describe('scrubPublish vs scrubReasons — the widths differ ON PURPOSE (#3015)', () => {
  const narrowedAway = [
    ['fenced code', '```js\nconst x = 1;\n```'],
    ['an ES import', 'import { scrubPublish } from "./secret-scrub.mjs"'],
    ['a repo-relative source path', 'we:scripts/conveyor/learnings-drop.mjs is the append seam'],
    ['the repo name itself', 'this lives in web-everything, not frontier ui'],
    ['an absolute POSIX path', 'the file /etc/nginx/nginx.conf was read'],
    ['a home-relative path', 'it lives under ~/workspace/webeverything/scripts'],
    ['a bare 40-char hex token', 'value was 0722238c375844a363ea7c611eb82b381a64998b'],
  ];
  it.each(narrowedAway)('the append seam rejects %s; the publish seam deliberately does not', (_label, value) => {
    expect(scrubReasons(value).length).toBeGreaterThan(0);
    expect(scrubPublish(value)).toEqual([]);
  });

  it('both seams still reject a real credential — the narrowing never crosses that line', () => {
    for (const v of [SYNTHETIC_MARKER, 'ghp_SYNTHETIC0000abcdefABCDEF0123456789', 'AKIASYNTHETIC0000NR']) {
      expect(scrubReasons(v).length).toBeGreaterThan(0);
      expect(scrubPublish(v).length).toBeGreaterThan(0);
    }
  });
});

describe('the entropy calibration is part of the contract (measured against the committed corpus)', () => {
  it('the corpus\'s most-random 40-char run stays under the blob threshold, with margin', () => {
    // The highest-entropy ≥40-char run in the 3,319-file corpus, measured: 4.55 bits/char. Threshold 4.8.
    const worst = '/backlog/3051-benchmark-which-reviewer-prompt-formulation-actually-fin';
    expect(shannonEntropy(worst)).toBeLessThan(4.8);
    expect(scrubPublish(worst)).toEqual([]);
  });
  it('a random base64 secret is caught by the BLOB rule alone — the threshold is load-bearing', () => {
    // This fixture is deliberately slash-segmented so no segment reaches the opaque-token rule's 20-char
    // minimum. Without it the two rules mask each other: a slash-free blob is caught by BOTH, so loosening
    // the blob threshold would leave every test green while the rule silently stopped working.
    const blob = 'n5FQ8vZ2xK7dW1j/T6bR3yG9pC0mS4h/L8uA5eN2qX7zV1o/B6iD3kY9fJ4wP0tM8rH';
    for (const seg of blob.split('/')) expect(isOpaquePublishToken(seg)).toBe(false);
    expect(shannonEntropy(blob)).toBeGreaterThanOrEqual(4.8);
    expect(scrubPublish(blob)).toEqual(['long opaque blob (≥40 chars, secret-level entropy)']);
  });
  it('the corpus\'s least-pronounceable long identifier stays under the token threshold', () => {
    // Measured minimum vowel ratio among ≥20-char corpus identifiers: 0.222 (`REGISTRY_SCRIPT_TYPE`).
    // Threshold 0.20 — the margin is what keeps a future identifier from reddening check:standards.
    expect(isOpaquePublishToken('REGISTRY_SCRIPT_TYPE')).toBe(false);
    expect(isOpaquePublishToken('pullRefreshThresholdPx')).toBe(false);
    expect(isOpaquePublishToken('CustomScriptTypeRegistry')).toBe(false);
  });
  it('pure hex is EXEMPT from the opaque-token rule — a git SHA and a hex token look identical', () => {
    expect(isOpaquePublishToken('0722238c375844a363ea7c611eb82b381a64998b')).toBe(false);
    // ...and the append seam still catches it (its "≥20 hex chars" rule), which is why the two seams are
    // separate functions rather than one with a flag.
    expect(scrubReasons('0722238c375844a363ea7c611eb82b381a64998b').join(' ')).toMatch(/hex/i);
  });
});
