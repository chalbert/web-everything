/**
 * @file review-dispatch.test.mjs — `#3279`: dispatch an independent review to a fresh session.
 *
 * NOTHING HERE SPAWNS A REAL PROCESS: `spawnAgent` is a recorder, `readBrief` is a stub template, and
 * `mintSessionId` is deterministic — so every assertion is about the ARGV and the FILLED PROMPT this operation
 * would actually send, not about `claude` itself (which `dispatch-lane-io.mjs`'s own live-spawn test already
 * covers for the shared `buildAgentArgv`/`defaultSpawnAgent` machinery this file reuses verbatim).
 */

import { describe, it, expect } from 'vitest';

import {
  assertMainNotStale, canonicalReviewPlaceholder, dispatchReview, dispatchReviewCli, fillReviewBrief,
  planReviewDispatch, reviewDispatchDisallowedToolsArgs, reviewSessionSlug, CODEX_JUDGE_PROVIDER_REFUSAL,
  REVIEW_BRIEF_PLACEHOLDERS, REVIEW_DISPATCH_DISALLOWED_TOOLS, REVIEW_DISPATCH_SYSTEM_PROMPT_FILE,
} from '../review-dispatch.mjs';

// #3433 — the two argv elements every dispatched review session carries, ahead of anything else, so the tests
// below don't hand-duplicate the join.
const DISALLOWED_TOOLS_ARGV = reviewDispatchDisallowedToolsArgs();

// A `checkStaleness` stub that never touches git — every `dispatchReview` test below injects one, so none of
// them depend on real subprocess/network fail-soft behavior for a nonexistent `root`.
const FRESH = () => ({ fresh: true, behind: 0 });

const REAL_TEMPLATE_STUB = [
  '# brief for {{PR}} in {{REPO}}',
  'acquire: node scripts/lane-pool.mjs acquire --session={{SESSION_SLUG}}',
  'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
].join('\n');

describe('planReviewDispatch', () => {
  it('derives a distinct, review-only session slug', () => {
    expect(planReviewDispatch({ pr: 1234, repo: 'chalbert/web-everything' })).toEqual({
      pr: 1234, repo: 'chalbert/web-everything', sessionSlug: 'review-1234',
    });
  });

  it('refuses a non-positive-integer PR', () => {
    expect(() => planReviewDispatch({ pr: 0, repo: 'o/r' })).toThrow(/positive integer/);
    expect(() => planReviewDispatch({ pr: 'abc', repo: 'o/r' })).toThrow(/positive integer/);
    expect(() => planReviewDispatch({ pr: -5, repo: 'o/r' })).toThrow(/positive integer/);
  });

  it('refuses a repo that is not an owner/repo slug', () => {
    expect(() => planReviewDispatch({ pr: 1, repo: 'not-a-slug' })).toThrow(/owner\/repo/);
    expect(() => planReviewDispatch({ pr: 1, repo: '' })).toThrow(/owner\/repo/);
  });
});

describe('reviewSessionSlug', () => {
  it('is its own namespace, distinct from dispatch-lane\'s conveyor-<num>/prepare-<num>', () => {
    expect(reviewSessionSlug(42)).toBe('review-42');
  });

  it('refuses an empty PR', () => {
    expect(() => reviewSessionSlug('')).toThrow(/needs a PR number/);
  });
});

describe('fillReviewBrief', () => {
  const values = {
    PR: 1234, REPO: 'chalbert/web-everything', SESSION_SLUG: 'review-1234', JUDGE_PROVIDER: 'claude',
  };

  it('substitutes the placeholders the template actually uses, and reports (never refuses) an unrelated '
    + 'bracketed token', () => {
    const { prompt, unknownTokens } = fillReviewBrief(REAL_TEMPLATE_STUB, values);
    expect(prompt).toContain('# brief for 1234 in chalbert/web-everything');
    expect(prompt).toContain('--session=review-1234');
    expect(unknownTokens).toEqual(['{{LIKE_THIS}}']);
  });

  it('refuses an empty template', () => {
    expect(() => fillReviewBrief('', values)).toThrow(/template is empty/);
  });

  it('refuses a missing value', () => {
    expect(() => fillReviewBrief('{{PR}} {{REPO}} {{SESSION_SLUG}}', { PR: 1, REPO: 'o/r' }))
      .toThrow(/no value for the brief placeholder \{\{SESSION_SLUG\}\}/);
  });

  it('refuses a value carrying shell-unsafe characters', () => {
    expect(() => fillReviewBrief('{{PR}} {{REPO}} {{SESSION_SLUG}}', { ...values, REPO: 'o/r; rm -rf /' }))
      .toThrow(/characters the brief cannot carry safely/);
  });

  it('refuses a MISSPELLED placeholder rather than shipping it unfilled', () => {
    expect(() => fillReviewBrief('{{ PR }} {{REPO}} {{SESSION_SLUG}}', values))
      .toThrow(/MISSPELLED placeholder/);
  });

  it('canonicalizes separator/case variants of the three real names', () => {
    expect(canonicalReviewPlaceholder('session_slug')).toBe('SESSION_SLUG');
    expect(canonicalReviewPlaceholder('Session-Slug')).toBe('SESSION_SLUG');
    expect(canonicalReviewPlaceholder('bogus')).toBeNull();
  });

  it('the placeholder roster is exactly PR, REPO, SESSION_SLUG, JUDGE_PROVIDER (#xqa9ttq)', () => {
    expect(REVIEW_BRIEF_PLACEHOLDERS).toEqual(['PR', 'REPO', 'SESSION_SLUG', 'JUDGE_PROVIDER']);
  });

  it('refuses a missing JUDGE_PROVIDER value exactly like any other declared placeholder (#xqa9ttq)', () => {
    expect(() => fillReviewBrief('{{PR}} {{REPO}} {{SESSION_SLUG}} {{JUDGE_PROVIDER}}', {
      PR: 1, REPO: 'o/r', SESSION_SLUG: 'review-1',
    })).toThrow(/no value for the brief placeholder \{\{JUDGE_PROVIDER\}\}/);
  });
});

describe('dispatchReview — the composition: plan → fill → mint → spawn', () => {
  it('spawns exactly once, with a freshly minted session id and the filled brief as the prompt', () => {
    const calls = [];
    const result = dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toEqual({ cwd: '/repo' });
    expect(calls[0].argv).toEqual([
      // #3331 — `--session-id` IS still emitted, and the id it carries is NOT the dispatch's identity.
      // `claude --bg` discards the flag and assigns its own id (which `dispatchReview` now reads back off
      // stdout as `agentId`); `buildAgentArgv` keeps passing it anyway because it costs nothing and a
      // future CLI may honour it — see `buildAgentArgv`'s own docblock in
      // `we:scripts/operations/dispatch-lane-io.mjs`. This branch's provider-port design (#3331's remedy
      // here) fixes the REPORTED id, not the argv.
      '--bg',
      '--session-id', '11111111-1111-4111-8111-111111111111',
      '-n', 'review-1234',
      '--append-system-prompt-file', REVIEW_DISPATCH_SYSTEM_PROMPT_FILE,
      ...DISALLOWED_TOOLS_ARGV,
      '# brief for 1234 in chalbert/web-everything\n'
      + 'acquire: node scripts/lane-pool.mjs acquire --session=review-1234\n'
      + 'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
    ]);

    expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.sessionSlug).toBe('review-1234');
    expect(result.pr).toBe(1234);
    expect(result.repo).toBe('chalbert/web-everything');
    expect(result.unknownTokens).toEqual(['{{LIKE_THIS}}']);
  });

  it('refuses to dispatch from inside a lane checkout, same guard dispatch-lane-io.mjs uses', () => {
    expect(() => dispatchReview({
      pr: 1, repo: 'o/r', root: '/some/path/.lanes/web-everything/lane-3',
      readBrief: () => REAL_TEMPLATE_STUB,
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: FRESH,
    })).toThrow(/lane/i);
  });

  it('never spawns when the plan itself refuses (bad PR/repo caught before any fs/spawn call)', () => {
    let readBriefCalls = 0;
    expect(() => dispatchReview({
      pr: -1, repo: 'o/r', root: '/repo',
      readBrief: () => { readBriefCalls += 1; return REAL_TEMPLATE_STUB; },
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: FRESH,
    })).toThrow(/positive integer/);
    expect(readBriefCalls).toBe(0);
  });

  // #xw3k2v9 — PR #1756 review finding: `extraArgs` was accepted and documented as forwarded, but the call to
  // `buildAgentArgv` never referenced it, so any caller-supplied flag (a `--permission-mode`, a `--model`
  // override) was silently dropped. This is the regression test for that fix.
  it('forwards extraArgs to buildAgentArgv, exactly like dispatch-lane-io.mjs does for its own dispatch', () => {
    const calls = [];
    dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      extraArgs: ['--permission-mode', 'plan'],
      checkStaleness: FRESH,
    });
    expect(calls[0].argv).toEqual([
      // #3331 — `--session-id` IS still emitted, and the id it carries is NOT the dispatch's identity.
      // `claude --bg` discards the flag and assigns its own id (which `dispatchReview` now reads back off
      // stdout as `agentId`); `buildAgentArgv` keeps passing it anyway because it costs nothing and a
      // future CLI may honour it — see `buildAgentArgv`'s own docblock in
      // `we:scripts/operations/dispatch-lane-io.mjs`. This branch's provider-port design (#3331's remedy
      // here) fixes the REPORTED id, not the argv.
      '--bg',
      '--session-id', '11111111-1111-4111-8111-111111111111',
      '-n', 'review-1234',
      '--append-system-prompt-file', REVIEW_DISPATCH_SYSTEM_PROMPT_FILE,
      ...DISALLOWED_TOOLS_ARGV,
      '--permission-mode', 'plan',
      '# brief for 1234 in chalbert/web-everything\n'
      + 'acquire: node scripts/lane-pool.mjs acquire --session=review-1234\n'
      + 'this brief documents {{LIKE_THIS}} as an example convention, not a real token',
    ]);
  });

  // #xy8di3v — extending #3418/#xqyyoje's static system-prompt fix to review-dispatch: live-confirmed
  // 2026-09-07, review-1998/2024/2027 each read a genuinely, correctly instantiated brief and wrongly
  // concluded they'd been handed a raw template — see we:backlog/3606-*.md. Pin the argv shape directly, the
  // same way dispatch-lane-io.test.mjs pins it for the build-dispatch side.
  it('#xy8di3v — always passes REVIEW_DISPATCH_SYSTEM_PROMPT_FILE via --append-system-prompt-file, ahead of '
    + 'the disallowed-tools deny list and any extraArgs', () => {
    const calls = [];
    dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });
    const promptFileIdx = calls[0].argv.indexOf('--append-system-prompt-file');
    expect(promptFileIdx).toBeGreaterThan(-1);
    expect(calls[0].argv[promptFileIdx + 1]).toBe(REVIEW_DISPATCH_SYSTEM_PROMPT_FILE);
    const disallowedIdx = calls[0].argv.findIndex((a) => a.startsWith('--disallowedTools='));
    expect(disallowedIdx).toBeGreaterThan(promptFileIdx);
  });
});

// #xqa9ttq — the dispatched session's OWN `review-loop-cli.mjs` invocation (brief step 2) is the seam that
// carries an opt-in Codex judge provider selection out to the dispatcher-shaped "fix-dispatch path" #3581's
// ratified sequencing names — NOT a tool-bearing dispatch of Codex itself (see `dispatchReview`'s own header
// note on what this does and does not do).
describe('dispatchReview — judgeProvider (#xqa9ttq)', () => {
  const JUDGE_PROVIDER_TEMPLATE = [
    '# brief for {{PR}} in {{REPO}}',
    'run: node scripts/operations/review-loop-cli.mjs --pr={{PR}} --repo={{REPO}} --provider={{JUDGE_PROVIDER}}',
  ].join('\n');

  it('defaults to claude when omitted — additive, never a default flip', () => {
    const calls = [];
    const result = dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => JUDGE_PROVIDER_TEMPLATE,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });
    expect(result.judgeProvider).toBe('claude');
    expect(calls[0].argv.at(-1)).toContain('--provider=claude');
  });

  it('fills the opted-in codex provider into the dispatched session\'s own review-loop-cli.mjs command', () => {
    const calls = [];
    const result = dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => JUDGE_PROVIDER_TEMPLATE,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
      judgeProvider: 'codex',
    });
    expect(result.judgeProvider).toBe('codex');
    expect(calls[0].argv.at(-1)).toContain('--provider=codex');
  });

  it('refuses an unrecognised provider name BEFORE reading the brief or spawning', () => {
    let readBriefCalls = 0;
    expect(() => dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => { readBriefCalls += 1; return JUDGE_PROVIDER_TEMPLATE; },
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: FRESH,
      judgeProvider: 'gemini',
    })).toThrow(/judgeProvider.*must be one of claude\|codex/);
    expect(readBriefCalls).toBe(0);
  });
});

// #3433 — PR #1756 r1's residual: nothing technically restricted a dispatched review session's tools, so a
// prompt-injection payload in the reviewed diff could in principle talk it into merging the PR it is reviewing,
// or clearing the `review:human` park on it, directly. These prove the deny list is real, is baked in
// unconditionally (not opt-in), and covers every script that can reach either.
describe('REVIEW_DISPATCH_DISALLOWED_TOOLS (#3433)', () => {
  // r1 (this item's own step-6 adversarial pass): denying only `Bash(gh pr merge:*)` still left `gh pr edit
  // --add-label review:accepted --remove-label review:human` and `gh api repos/*/pulls/*/merge -X PUT` open —
  // the same two outcomes under a different verb. Denying `gh` wholesale is what actually closes both.
  it('denies the WHOLE gh CLI — not just `gh pr merge` (r1: a label-edit or gh api call reaches the same '
    + 'outcomes under a different verb)', () => {
    expect(REVIEW_DISPATCH_DISALLOWED_TOOLS).toContain('Bash(gh:*)');
    expect(REVIEW_DISPATCH_DISALLOWED_TOOLS).not.toContain('Bash(gh pr merge:*)');
  });

  it('denies every script that can reach the review:human --to=clear-human ceremony', () => {
    expect(REVIEW_DISPATCH_DISALLOWED_TOOLS).toContain('Bash(node scripts/review-set-label.mjs:*)');
    expect(REVIEW_DISPATCH_DISALLOWED_TOOLS).toContain('Bash(node scripts/apply-review-request.mjs:*)');
    expect(REVIEW_DISPATCH_DISALLOWED_TOOLS).toContain('Bash(node scripts/operations/run.mjs:*)');
  });

  // r2 (this item's own SECOND adversarial pass, verified against the real `claude` binary): a `['--disallowedTools',
  // '<joined>']` TWO-element form still gets eaten whole by the variadic parser — the joined value AND the
  // prompt right after it both get consumed as "tool patterns", and the dispatched session starts with NO
  // prompt at all. Only a single `--disallowedTools=<joined>` element is safe. This must stay exactly ONE argv
  // element, or every dispatched review silently no-ops.
  it('reviewDispatchDisallowedToolsArgs returns exactly ONE `=`-joined argv element, never a separate flag+value '
    + 'pair (r2: a variadic CLI option eats the prompt that follows a two-element form)', () => {
    expect(DISALLOWED_TOOLS_ARGV).toEqual([
      `--disallowedTools=${REVIEW_DISPATCH_DISALLOWED_TOOLS.join(',')}`,
    ]);
    expect(DISALLOWED_TOOLS_ARGV).toHaveLength(1);
    expect(DISALLOWED_TOOLS_ARGV[0]).not.toBe('--disallowedTools');
  });

  it('the deny list is baked in even when the caller supplies NO extraArgs at all — not opt-in', () => {
    const calls = [];
    dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });
    expect(calls[0].argv).toEqual(expect.arrayContaining(DISALLOWED_TOOLS_ARGV));
  });

  it('the deny list comes BEFORE any caller-supplied extraArgs — a caller cannot push it later or shadow it', () => {
    const calls = [];
    dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      extraArgs: ['--model', 'sonnet'],
      checkStaleness: FRESH,
    });
    const disallowedIdx = calls[0].argv.findIndex((a) => a.startsWith('--disallowedTools='));
    const modelIdx = calls[0].argv.indexOf('--model');
    expect(disallowedIdx).toBeGreaterThan(-1);
    expect(modelIdx).toBeGreaterThan(disallowedIdx);
  });
});

// #3439 — a dispatched review spawns with its own `cwd`-relative import path, so a dispatching checkout N
// commits behind origin/main silently runs pre-fix code with no error. These prove the refusal is real.
describe('assertMainNotStale', () => {
  it('passes through a fresh checkout untouched', () => {
    expect(assertMainNotStale('/repo', FRESH)).toEqual({ fresh: true, behind: 0 });
  });

  it('refuses a checkout N commits behind origin/main, naming the count', () => {
    expect(() => assertMainNotStale('/repo', () => ({ action: 'warn', behind: 12, ahead: 0, dirty: false, warning: 'stub' })))
      .toThrow(/12 commit\(s\) behind origin\/main/);
  });

  it('refuses a DIVERGED checkout the same way — being behind at all is disqualifying, not just non-fast-forwardable', () => {
    expect(() => assertMainNotStale('/repo', () => ({ action: 'warn', behind: 3, ahead: 2, dirty: false, warning: 'stub' })))
      .toThrow(/3 commit\(s\) behind/);
  });

  it('does not refuse when the staleness check is offline (fail-soft, matching main-staleness.mjs itself)', () => {
    expect(assertMainNotStale('/repo', () => ({ offline: true }))).toEqual({ offline: true });
  });
});

describe('dispatchReview — refuses to spawn from a stale checkout (#3439)', () => {
  it('refuses before reading the brief or spawning, when behind origin/main', () => {
    let readBriefCalls = 0;
    expect(() => dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => { readBriefCalls += 1; return REAL_TEMPLATE_STUB; },
      spawnAgent: () => { throw new Error('must not be called'); },
      checkStaleness: () => ({ action: 'warn', behind: 9, ahead: 0, dirty: false, warning: 'stub' }),
    })).toThrow(/9 commit\(s\) behind origin\/main/);
    expect(readBriefCalls).toBe(0);
  });

  it('proceeds to spawn when the checkout is fresh', () => {
    const calls = [];
    dispatchReview({
      pr: 1234, repo: 'chalbert/web-everything', root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: (argv, opts) => { calls.push({ argv, opts }); return ''; },
      checkStaleness: FRESH,
    });
    expect(calls).toHaveLength(1);
  });
});

// ── #3331 — the id this operation REPORTS has to be the one that addresses the session ────────────────────────

describe('#3331 — dispatchReview reports the id `claude --bg` assigned, not the uuid it minted', () => {
  /** Verbatim the first line CLI 2.1.269 prints on stdout for a `--bg` spawn. */
  const BANNER = (id) => `backgrounded \u00b7 ${id} \u00b7 review-1234\n  claude agents             list sessions\n`;

  it('returns `agentId` parsed off the spawn\'s stdout', () => {
    // The bug this pins: `claude --bg` discards `--session-id` and assigns its own id, so the minted uuid
    // this operation used to print named NO session. `claude agents --json | grep <uuid>` was always empty and
    // no transcript existed under it, which is why a dispatch that had in fact run a full review to an accept
    // verdict (live: review-2129) read to every operator as a silent failure.
    const result = dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: () => BANNER('91035f2f'),
      checkStaleness: FRESH,
    });
    expect(result.agentId).toBe('91035f2f');
    // The minted id is still returned, so an existing caller reading `sessionId` sees the documented shape —
    // it is simply no longer the thing that addresses the session.
    expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('reports `agentId: null` rather than a fabricated one when the banner cannot be read', () => {
    const result = dispatchReview({
      pr: 1234,
      repo: 'chalbert/web-everything',
      root: '/repo',
      readBrief: () => REAL_TEMPLATE_STUB,
      mintSessionId: () => '11111111-1111-4111-8111-111111111111',
      spawnAgent: () => '',
      checkStaleness: FRESH,
    });
    expect(result.agentId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// #xu2pp2m — THE LIVE PATH IS MECHANICAL. This block exists because every test ABOVE could stay green while
// the thing `we:skills-src/conveyor/runner.mjs` actually shells still spawned an LLM agent: they all drive
// `dispatchReview` DIRECTLY, so nothing in this file ever proved which path an unflagged CLI invocation takes.
// That exact gap — "the wrapper is present" vs "the wrapper is EXERCISED" — is what these close.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('dispatchReviewCli — the mechanical wrapper is the DEFAULT live path', () => {
  const CLASSIFIED = (outcome, extra = {}) => ({
    pr: 2122,
    repo: 'chalbert/web-everything',
    sessionSlug: 'review-2122',
    lanePath: '/lanes/lane-3',
    classified: { outcome, verdict: null, loopOutcome: null, runId: 'review-pr-abc', ...extra },
    raw: {},
  });

  it('an unflagged `--pr/--repo` invocation calls the WRAPPER and never spawns an agent', () => {
    const mechanicalCalls = [];
    const agentCalls = [];
    const out = [];
    const res = dispatchReviewCli(['--pr=2122', '--repo=chalbert/web-everything'], {
      dispatchMechanical: (o) => { mechanicalCalls.push(o); return CLASSIFIED('auto-cleared', { verdict: 'accept' }); },
      dispatchAgent: (o) => { agentCalls.push(o); return {}; },
      write: (t) => out.push(t),
    });
    // THE WHOLE POINT: the agent-spawning path is not merely de-prioritised, it is not reached at all.
    expect(agentCalls).toEqual([]);
    expect(mechanicalCalls).toEqual([{ pr: '2122', repo: 'chalbert/web-everything', codexAdvisory: false }]);
    expect(res.mode).toBe('mechanical');
    expect(res.code).toBe(0);
    expect(out.join('')).toMatch(/no agent spawned/);
  });

  it('`--agent` still reaches the old spawn path, unchanged — the fallback is real, not vestigial', () => {
    const agentCalls = [];
    const res = dispatchReviewCli(['--pr=7', '--repo=o/r', '--agent'], {
      dispatchMechanical: () => { throw new Error('the mechanical path must NOT run under --agent'); },
      dispatchAgent: (o) => {
        agentCalls.push(o);
        return {
          agentId: 'agent-1', sessionSlug: 'review-7', pr: 7, repo: 'o/r', unknownTokens: [], judgeProvider: 'claude',
        };
      },
      write: () => {},
    });
    expect(agentCalls).toHaveLength(1);
    expect(res.mode).toBe('agent');
    expect(res.code).toBe(0);
  });

  it('`blocked-on-infra` exits NON-ZERO — `runner.mjs` must not advance a round label for a review that never ran', () => {
    const out = [];
    const res = dispatchReviewCli(['--pr=2122', '--repo=o/r'], {
      dispatchMechanical: () => CLASSIFIED('blocked-on-infra', { runId: null }),
      dispatchAgent: () => { throw new Error('unreachable'); },
      write: (t) => out.push(t),
    });
    expect(res.code).toBe(1);
    expect(out.join('')).toMatch(/could NOT review/);
  });

  it('a REAL verdict — bounced or parked, not only accepted — exits ZERO', () => {
    for (const outcome of ['bounced', 'parked', 'auto-cleared']) {
      const res = dispatchReviewCli(['--pr=1', '--repo=o/r'], {
        dispatchMechanical: () => CLASSIFIED(outcome),
        dispatchAgent: () => { throw new Error('unreachable'); },
        write: () => {},
      });
      expect(res.code, outcome).toBe(0);
    }
  });

  it('`--codex-advisory` is forwarded to the wrapper as the opt-in third seat', () => {
    const seen = [];
    dispatchReviewCli(['--pr=1', '--repo=o/r', '--codex-advisory'], {
      dispatchMechanical: (o) => { seen.push(o.codexAdvisory); return CLASSIFIED('auto-cleared'); },
      dispatchAgent: () => { throw new Error('unreachable'); },
      write: () => {},
    });
    expect(seen).toEqual([true]);
  });

  it('REFUSES `--judge-provider=codex` at the command line instead of crashing mid-dispatch', () => {
    // Measured live 2026-09-12: `--provider=codex` sets the provider for ALL seats, both MANDATORY seats are
    // tool-bearing, and `createDefaultJudge` structurally refuses codex + tools (#3581) — so this always died
    // minutes in, at the first judge step, on a constraint the operator never asked to violate.
    const errs = [];
    const res = dispatchReviewCli(['--pr=1', '--repo=o/r', '--judge-provider=codex'], {
      dispatchMechanical: () => { throw new Error('must not reach the wrapper'); },
      dispatchAgent: () => { throw new Error('must not reach the agent path'); },
      write: () => {},
      writeErr: (l) => errs.push(l),
    });
    expect(res.code).toBe(1);
    expect(res.mode).toBe('refused');
    // and it POINTS AT THE KNOB THAT WORKS, rather than only saying no.
    expect(errs.join('')).toMatch(/--codex-advisory/);
    expect(CODEX_JUDGE_PROVIDER_REFUSAL).toMatch(/tool-bearing/);
  });

  it('`--judge-provider=claude` is untouched — the refusal is codex-only', () => {
    const res = dispatchReviewCli(['--pr=1', '--repo=o/r', '--judge-provider=claude'], {
      dispatchMechanical: () => CLASSIFIED('auto-cleared'),
      dispatchAgent: () => { throw new Error('unreachable'); },
      write: () => {},
    });
    expect(res.code).toBe(0);
  });
});
