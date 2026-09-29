/**
 * @file soak-replay-gate.test.mjs — unit tests for the "every daemon bug fix adds a soak break scenario, or
 * waives it" gate (`we:scripts/lib/soak-replay-gate.mjs`, #4075). Covers the pure decision functions with
 * synthetic cases, then re-runs `evaluateSoakReplayGate` against five FROZEN real PRs
 * (`./fixtures/soak-replay-gate-real-prs.mjs`) as the live-proof evidence this gate would have caught the
 * actual gap it was built to close.
 */
import { describe, it, expect } from 'vitest';
import {
  isLikelyDaemonBugFix,
  addsOrChangesSoakBreak,
  extractSoakWaiver,
  evaluateSoakReplayGate,
  filePaths,
  SOAK_BREAKS_DIR_PREFIX,
} from '../soak-replay-gate.mjs';
import { REAL_PRS } from './fixtures/soak-replay-gate-real-prs.mjs';

describe('isLikelyDaemonBugFix', () => {
  it('is true for a conventional-commit fix()-shaped title', () => {
    expect(isLikelyDaemonBugFix({ title: 'fix(daemon-smoke): fresh GitHub token per smoke attempt' })).toBe(true);
    expect(isLikelyDaemonBugFix({ title: 'fix: stop the redispatch storm' })).toBe(true);
    expect(isLikelyDaemonBugFix({ title: 'fix-dispatch: cap consecutive refusals' })).toBe(true);
    expect(isLikelyDaemonBugFix({ title: 'fix red main: resolve JIT-renamed flow citations' })).toBe(true);
  });

  it('is true for a body "Fix" / "Root cause" / "What broke" / "Problem" / "Incident" heading', () => {
    expect(isLikelyDaemonBugFix({ body: '## What broke\nsomething' })).toBe(true);
    expect(isLikelyDaemonBugFix({ body: '### Root cause\nsomething' })).toBe(true);
    expect(isLikelyDaemonBugFix({ body: '## Problem (live)\nsomething' })).toBe(true);
    expect(isLikelyDaemonBugFix({ body: '## Fix (`scripts/lib/x.mjs`)\nsomething' })).toBe(true);
    expect(isLikelyDaemonBugFix({ body: '## Incident\nsomething' })).toBe(true);
  });

  it('is true for the word bug/broke/broken/regression/incident anywhere in the body', () => {
    expect(isLikelyDaemonBugFix({ body: 'that looked like a discovery bug' })).toBe(true);
    expect(isLikelyDaemonBugFix({ body: 'the tick logging broke silently' })).toBe(true);
    expect(isLikelyDaemonBugFix({ body: 'a regression against yesterday' })).toBe(true);
  });

  it('is false for a plain feature/description title+body with none of the above', () => {
    expect(
      isLikelyDaemonBugFix({
        title: 'conveyor flows as data — graphs + gap checker (#4075, describe only)',
        body: '## Summary\nDescribes flows as data. ## Why\nBecause data beats prose. ## Tests\nAll green.',
      }),
    ).toBe(false);
  });

  it('does NOT over-fire on the bare word "fix" alone (daemon vocabulary, not a verdict)', () => {
    // "fix session" / "fix-dispatch" name a ROLE in this codebase, not "this PR fixes something" — the bare
    // word must not be a signal on its own (see soak-replay-gate.mjs's header for why).
    expect(isLikelyDaemonBugFix({ body: 'a stale fix session was still bound to the PR' })).toBe(false);
  });

  it('handles missing fields', () => {
    expect(isLikelyDaemonBugFix({})).toBe(false);
    expect(isLikelyDaemonBugFix(undefined)).toBe(false);
  });
});

describe('addsOrChangesSoakBreak', () => {
  it('is true when a file under scripts/conveyor/soak/breaks/ is added or modified', () => {
    expect(addsOrChangesSoakBreak([{ path: `${SOAK_BREAKS_DIR_PREFIX}my-break.mjs`, changeType: 'ADDED' }])).toBe(true);
    expect(addsOrChangesSoakBreak([{ path: `${SOAK_BREAKS_DIR_PREFIX}index.mjs`, changeType: 'MODIFIED' }])).toBe(true);
    expect(addsOrChangesSoakBreak([{ path: `${SOAK_BREAKS_DIR_PREFIX}my-break.mjs`, changeType: 'RENAMED' }])).toBe(true);
  });

  it('is false for a bare DELETE under breaks/', () => {
    expect(addsOrChangesSoakBreak([{ path: `${SOAK_BREAKS_DIR_PREFIX}old-break.mjs`, changeType: 'DELETED' }])).toBe(false);
  });

  it('is false when no file touches the breaks/ prefix', () => {
    expect(addsOrChangesSoakBreak([{ path: 'scripts/conveyor/soak/soak.mjs', changeType: 'MODIFIED' }])).toBe(false);
    expect(addsOrChangesSoakBreak([])).toBe(false);
  });

  it('treats a plain path string (no changeType — e.g. git diff --name-only) as sufficient', () => {
    expect(addsOrChangesSoakBreak([`${SOAK_BREAKS_DIR_PREFIX}my-break.mjs`])).toBe(true);
  });
});

describe('extractSoakWaiver', () => {
  it('extracts a non-empty waiver reason', () => {
    expect(extractSoakWaiver('some text\nsoak-waiver: not a regression, a new capability\nmore text')).toBe(
      'not a regression, a new capability',
    );
  });

  it('is case-insensitive on the key and tolerant of leading whitespace', () => {
    expect(extractSoakWaiver('  Soak-Waiver: covered by #1234 already')).toBe('covered by #1234 already');
  });

  it('rejects an empty reason', () => {
    expect(extractSoakWaiver('soak-waiver:   \nmore text')).toBeNull();
    expect(extractSoakWaiver('soak-waiver:')).toBeNull();
  });

  it('is null when no waiver line is present', () => {
    expect(extractSoakWaiver('nothing to see here')).toBeNull();
    expect(extractSoakWaiver('')).toBeNull();
    expect(extractSoakWaiver(undefined)).toBeNull();
  });

  // Real PR bodies write this as a markdown list item with the key bolded, not as bare text — the bare
  // `soak-waiver:` form alone missed this and produced the exact false red this covers (#2783's real body).
  it('is tolerant of a list bullet plus bold/italic decoration around the key, colon inside or outside it', () => {
    expect(extractSoakWaiver('- **Soak-waiver**: change is confined to a pure decision function')).toBe(
      'change is confined to a pure decision function',
    );
    expect(extractSoakWaiver('- **Soak-waiver:** change is confined to a pure decision function')).toBe(
      'change is confined to a pure decision function',
    );
    expect(extractSoakWaiver('* soak-waiver: some reason')).toBe('some reason');
    expect(extractSoakWaiver('1. **Soak-Waiver**: some reason')).toBe('some reason');
    expect(extractSoakWaiver('_soak-waiver_: some reason')).toBe('some reason');
  });

  it('still rejects an empty reason when the key is decorated', () => {
    expect(extractSoakWaiver('- **Soak-waiver**:   ')).toBeNull();
  });

  it('is null for prose that merely mentions the key with no colon-terminated key at all', () => {
    expect(extractSoakWaiver('`soak-waiver` line included above (see commit message)')).toBeNull();
  });

  it('extracts the real (decorated) waiver from PR #2783\'s actual body', () => {
    const body2783 =
      '- `node scripts/verify-lane.mjs run --repo=.` — green (65 files / 3154 tests passed; `check:standards` 0 errors).\n' +
      '  Selected-gate run, not the full suite (per repo convention); no unrelated red state hit.\n' +
      '- **Soak-waiver**: change is confined to a pure decision function in `reconcile-core.mjs` (no fs/network/clock/\n' +
      '  process); fully exercised by the unit suite above, including fixtures shaped off the live incident PRs. No\n' +
      '  soak scenario added — nothing here touches the daemon\'s IO shells, timers, or dispatch plumbing itself.';
    expect(extractSoakWaiver(body2783)).toBe(
      'change is confined to a pure decision function in `reconcile-core.mjs` (no fs/network/clock/',
    );
  });
});

describe('filePaths', () => {
  it('normalizes plain strings and {path} objects alike', () => {
    expect(filePaths(['a.mjs', { path: 'b.mjs' }, { path: 'c.mjs', changeType: 'ADDED' }])).toEqual(['a.mjs', 'b.mjs', 'c.mjs']);
  });
  it('drops malformed entries rather than throwing', () => {
    expect(filePaths([null, {}, 'ok.mjs', undefined])).toEqual(['ok.mjs']);
  });
});

describe('evaluateSoakReplayGate — synthetic cases', () => {
  it('does not apply when no daemon-soak-scope file is touched', () => {
    const v = evaluateSoakReplayGate({ title: 'fix: something', body: '', files: ['README.md'] });
    expect(v.applicable).toBe(false);
    expect(v.ok).toBe(true);
  });

  it('does not apply when daemon scope is touched but nothing reads as a bug fix', () => {
    const v = evaluateSoakReplayGate({
      title: 'conveyor: new flows-as-data graph viewer',
      body: '## Summary\nA new viewer.',
      files: ['scripts/conveyor/flows-viewer.mjs'],
    });
    expect(v.applicable).toBe(false);
    expect(v.ok).toBe(true);
  });

  it('fails a daemon bug fix that adds no breaks/ file and carries no waiver', () => {
    const v = evaluateSoakReplayGate({
      title: 'fix(daemon-rebuild): stop losing a passing candidate',
      body: '## Problem\nIt broke live.\n## Fix\nDone.',
      files: ['scripts/lib/daemon-rebuild.mjs'],
    });
    expect(v.applicable).toBe(true);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/breaks\//);
  });

  it('passes a daemon bug fix that adds a breaks/ file', () => {
    const v = evaluateSoakReplayGate({
      title: 'fix(daemon-rebuild): stop losing a passing candidate',
      body: '## Problem\nIt broke live.\n## Fix\nDone.',
      files: [
        { path: 'scripts/lib/daemon-rebuild.mjs', changeType: 'MODIFIED' },
        { path: `${SOAK_BREAKS_DIR_PREFIX}rebuild-finalize-starved.mjs`, changeType: 'ADDED' },
        { path: `${SOAK_BREAKS_DIR_PREFIX}rebuild-finalize-starved.soak.test.mjs`, changeType: 'ADDED' },
        { path: `${SOAK_BREAKS_DIR_PREFIX}index.mjs`, changeType: 'MODIFIED' },
      ],
    });
    expect(v.applicable).toBe(true);
    expect(v.ok).toBe(true);
  });

  it('passes a daemon bug fix with no breaks/ file when it carries a non-empty soak-waiver line', () => {
    const v = evaluateSoakReplayGate({
      title: 'fix(daemon-rebuild): stop losing a passing candidate',
      body: '## Problem\nIt broke live.\n## Fix\nDone.\n\nsoak-waiver: pure config typo, no daemon behavior changed',
      files: ['scripts/lib/daemon-rebuild.mjs'],
    });
    expect(v.applicable).toBe(true);
    expect(v.ok).toBe(true);
    expect(v.waiver).toBe('pure config typo, no daemon behavior changed');
  });

  // backlog/4292 — PR #2822's exact shape: a backlog-only diff (four new cards) whose PR body PROSE uses
  // daemon/fix/break vocabulary to describe FUTURE work. Once the diff is merge-base-correct (backlog/4264 —
  // `soak-gate-merge-base-diff.mjs`), no daemon-soak-scope path is in it, so the fix-shaped prose must never be
  // reached and no `soak-waiver:` line is needed.
  it('does not apply to a backlog-only PR whose body prose reads fix-shaped (PR #2822) — no waiver needed', () => {
    const body =
      '## Problem\nThe daemon broke on a regression: the fix-dispatch bug lets a stale lane break the next ' +
      'rebuild.\n\nThese cards describe the future daemon fix; no code changed here.';
    expect(isLikelyDaemonBugFix({ title: 'backlog: file 4 gate-efficiency cards', body })).toBe(true);
    const v = evaluateSoakReplayGate({
      title: 'backlog: file 4 gate-efficiency cards',
      body,
      files: [
        { path: 'backlog/4288-daemon-rebuild-starves-on-stale-lane.md', changeType: 'ADDED' },
        { path: 'backlog/4289-fix-dispatch-retries-a-broken-lane.md', changeType: 'ADDED' },
        { path: 'backlog/4290-soak-break-for-lane-pool-drift.md', changeType: 'ADDED' },
        { path: 'backlog/4291-daemon-health-watch-misses-a-break.md', changeType: 'ADDED' },
      ],
    });
    expect(v).toEqual({ applicable: false, ok: true, reason: 'no daemon-soak-scope file touched — rule does not apply' });
    expect(v.waiver).toBeUndefined();
  });

  it('fails when the soak-waiver line is present but empty', () => {
    const v = evaluateSoakReplayGate({
      title: 'fix(daemon-rebuild): stop losing a passing candidate',
      body: '## Problem\nIt broke.\n## Fix\nDone.\nsoak-waiver:   ',
      files: ['scripts/lib/daemon-rebuild.mjs'],
    });
    expect(v.applicable).toBe(true);
    expect(v.ok).toBe(false);
  });
});

describe('evaluateSoakReplayGate — live proof against real merged/open PRs (frozen 2026-09-26)', () => {
  it.each(['2771', '2762'])(
    'FAILS #%s — a real daemon fix that added no scripts/conveyor/soak/breaks/ file and carried no waiver',
    (num) => {
      const pr = REAL_PRS[num];
      const v = evaluateSoakReplayGate(pr);
      expect(v.applicable, `#${num} should be classified as a daemon bug fix in daemon-soak scope`).toBe(true);
      expect(v.ok, `#${num} should have been RED under this gate: ${v.reason}`).toBe(false);
    },
  );

  it('#2763 ("fix(drain): a cross-repo couple lands whole in one pass or not at all") is a real daemon-family ' +
    'fix with no breaks/ file, but is NOT APPLICABLE under this gate — a discovered, pre-existing scope gap, ' +
    'not a classifier bug: its files (scripts/merge-ai-prs.mjs, scripts/lib/couple-cascade.mjs) touch the drain ' +
    'daemon, and the daemon-soak harness\'s own CI scope regex (reused as-is here, per design) never covered ' +
    'drain/merge-ai-prs — only the review+fix-dispatch daemons under scripts/conveyor/, scripts/lib/daemon-*, ' +
    'etc. Widening that regex to also cover drain is a separate, upstream scope decision for the daemon-soak ' +
    'harness itself, not something this gate should quietly do on its own by diverging from CI\'s own trigger.', () => {
    const v = evaluateSoakReplayGate(REAL_PRS['2763']);
    expect(v.applicable).toBe(false);
    expect(v.ok).toBe(true);
  });

  it.each(['2765', '2768'])(
    'PASSES #%s — a real daemon fix that DID add a scripts/conveyor/soak/breaks/ scenario',
    (num) => {
      const pr = REAL_PRS[num];
      const v = evaluateSoakReplayGate(pr);
      expect(v.applicable, `#${num} should be classified as a daemon bug fix in daemon-soak scope`).toBe(true);
      expect(v.ok, `#${num} should have been GREEN under this gate: ${v.reason}`).toBe(true);
      expect(v.reason).toMatch(new RegExp(SOAK_BREAKS_DIR_PREFIX.replace(/\//g, '\\/')));
    },
  );
});
