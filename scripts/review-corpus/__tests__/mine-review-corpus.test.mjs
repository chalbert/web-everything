import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_GH_COMMANDS,
  ALLOWED_READ_ENDPOINTS,
  assertReadOnlyEndpoint,
  assertReadOnlyGh,
} from '../mine-review-corpus.mjs';

// ── WHY THIS FILE EXISTS (#1569 review, `coverage`) ───────────────────────────────────────────────────────
// The miner's whole safety story is one sentence — "read-only by construction" — and it rested on one
// unexercised function. Nothing stopped a later edit from adding a `/comments` POST or widening the
// allowlist to `repos/:o/:r/*`: the guard would have kept its name and stopped guarding. These tests pin
// BOTH halves of the refusal (write flags, endpoint shape) and the SIZE of the allowlist, because the
// second defect that round was prose claiming a different number of shapes than the code allowlists.

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, '..', 'mine-review-corpus.mjs'), 'utf8');
/** The same file with comments stripped — so counting CALL SITES counts code, not prose about code. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ALLOWED = [
  'repos/chalbert/web-everything/issues/1569/comments',
  'repos/chalbert/web-everything/pulls/1569',
  'repos/chalbert/web-everything/pulls/1569/files',
];

describe('assertReadOnlyEndpoint — the allowed reads', () => {
  it.each(ALLOWED)('accepts %s', (endpoint) => {
    expect(assertReadOnlyEndpoint(endpoint, ['api', endpoint])).toBe(true);
  });

  it('accepts `--paginate`, which is still a GET', () => {
    expect(assertReadOnlyEndpoint(ALLOWED[0], ['api', ALLOWED[0], '--paginate'])).toBe(true);
  });
});

describe('assertReadOnlyEndpoint — refuses a write flag whatever the endpoint', () => {
  // Every shape `gh` accepts for "this is not a plain GET". `-f`/`--field` are here because a POST body
  // can be handed over without `--method` ever appearing: `gh api <path> -f body=…` posts.
  const WRITE_ARGV = [
    ['--method', 'POST'],
    ['--method=POST'],
    ['-X', 'PATCH'],
    ['--field', 'body=nope'],
    ['--field=body=nope'],
    ['-f', 'body=nope'],
  ];

  it.each(WRITE_ARGV)('throws on %s even on an allowlisted endpoint', (...flags) => {
    expect(() => assertReadOnlyEndpoint(ALLOWED[0], ['api', ALLOWED[0], ...flags]))
      .toThrow(/read-only; argv carries a write flag/);
  });
});

describe('assertReadOnlyEndpoint — refuses anything off the allowlist', () => {
  const REFUSED = [
    // The mutating endpoints this corpus must never touch, even as a bare GET-shaped path.
    'repos/chalbert/web-everything/issues/1569/labels',
    'repos/chalbert/web-everything/pulls/1569/merge',
    'repos/chalbert/web-everything/pulls/1569/reviews',
    // Widening by wildcard or prefix — the shape a later "just let it read anything" edit would take.
    'repos/chalbert/web-everything',
    'repos/chalbert/web-everything/issues/1569',
    // Anchoring: a path that merely CONTAINS an allowed shape must not pass at either end.
    'repos/chalbert/web-everything/pulls/1569/files/extra',
    'x/repos/chalbert/web-everything/pulls/1569',
    'repos/chalbert/web-everything/issues/1569/comments/42',
  ];

  it.each(REFUSED)('throws on %s', (endpoint) => {
    expect(() => assertReadOnlyEndpoint(endpoint, ['api', endpoint]))
      .toThrow(/endpoint is not an allowed read/);
  });
});

describe('the allowlist and the prose that describes it agree', () => {
  it('allowlists exactly THREE read shapes', () => {
    // The claim-accuracy half of the #1569 review: the header said "those two shapes" while the code
    // allowlisted three. Pin the number so prose and code cannot drift apart again silently.
    expect(ALLOWED_READ_ENDPOINTS).toHaveLength(3);
  });

  it('says THREE in the header too, and no longer says two', () => {
    expect(SOURCE).toMatch(/THREE-shape read allowlist/);
    // The retracted sentence must not reappear anywhere outside the retraction that quotes it.
    const live = SOURCE.replace(/^ \* RETRACTED[\s\S]*?(?=^ \*$)/m, '');
    expect(live).not.toMatch(/those two shapes/);
  });

  it('is frozen, so a caller cannot push a fourth shape onto it at runtime', () => {
    expect(Object.isFrozen(ALLOWED_READ_ENDPOINTS)).toBe(true);
  });
});

describe('the miner calls exactly one of the three shapes', () => {
  it('has a single `ghJson` call site, and it is the comments read', () => {
    // The other half of the same false sentence: it claimed two call sites. Counting them here means the
    // header's "calls exactly ONE" cannot rot the next time a caller is added without updating the prose.
    const callSites = CODE.match(/ghJson\(`[^`]+`/g) ?? [];
    expect(callSites).toHaveLength(1);
    expect(callSites[0]).toContain('/issues/${n}/comments');
  });

  it('shells `gh` from exactly ONE place, and that place asserts first', () => {
    // THE BYPASS THIS PINS. `mineRepo` used to call execFileSync('gh', ['pr','list',…]) directly — a second
    // route to GitHub that never met a guard. Counting the call sites is the only check that catches the
    // next one, because a new direct call reads perfectly well in review.
    const ghShells = CODE.match(/execFileSync\(\s*'gh'/g) ?? [];
    expect(ghShells).toHaveLength(1);
    expect(CODE).toMatch(/assertReadOnlyGh\(argv\);\s*return execFileSync\('gh', argv/);
  });
});

describe('assertReadOnlyGh — the second guard, over the `gh` subcommand', () => {
  it('allows exactly TWO subcommands', () => {
    expect(ALLOWED_GH_COMMANDS).toHaveLength(2);
    expect(ALLOWED_GH_COMMANDS.map((c) => c.join(' '))).toEqual(['api', 'pr list']);
  });

  it('accepts the PR listing the miner actually runs', () => {
    expect(assertReadOnlyGh(['pr', 'list', '--repo', 'o/n', '--state', 'all', '--limit', '200', '--json', 'number'])).toBe(true);
  });

  it('accepts `gh api` on an allowed endpoint, and hands the endpoint on to the endpoint guard', () => {
    expect(assertReadOnlyGh(['api', ALLOWED[0], '--paginate'])).toBe(true);
    expect(() => assertReadOnlyGh(['api', 'repos/o/n/issues/1/labels'])).toThrow(/endpoint is not an allowed read/);
    expect(() => assertReadOnlyGh(['api', ALLOWED[0], '--method', 'POST'])).toThrow(/argv carries a write flag/);
  });

  it.each([
    ['pr', 'edit', '1', '--body', 'nope'],
    ['pr', 'close', '1'],
    ['pr', 'comment', '1', '--body', 'nope'],
    ['pr', 'merge', '1'],
    ['issue', 'edit', '1'],
    ['label', 'create', 'x'],
  ])('refuses `gh %s %s`', (...argv) => {
    expect(() => assertReadOnlyGh(argv)).toThrow(/is not one of its allowed reads/);
  });

  it('refuses an empty argv rather than defaulting to permitted', () => {
    expect(() => assertReadOnlyGh([])).toThrow(/is not one of its allowed reads/);
    expect(() => assertReadOnlyGh()).toThrow(/is not one of its allowed reads/);
  });

  it('is not fooled by an allowed word appearing later in the argv', () => {
    // `['pr','edit','--json','api']` contains 'api', but the guard matches on POSITION, not membership.
    expect(() => assertReadOnlyGh(['pr', 'edit', '--json', 'api'])).toThrow(/is not one of its allowed reads/);
  });
});
