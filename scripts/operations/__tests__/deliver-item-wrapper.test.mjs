/**
 * @file deliver-item-wrapper.test.mjs — argv-contract coverage for the #3627 minimal-delivery wrapper
 * PROTOTYPE (`we:scripts/operations/deliver-item-wrapper.mjs`). The file is still NOT wired into
 * `dispatch-lane.mjs` and NOT imported by production code — this test exists so the one thing that is a real,
 * load-bearing contract (the `claude` argv `CLAUDE_RESTRICTED_PROVIDER` constructs) cannot silently drift.
 *
 * Mirrors the reasoning `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` is tested for: "the argv
 * IS the contract with the CLI and a test that asserts it is the only thing standing between a flag rename
 * and a silent non-dispatch." `buildRestrictedProviderArgv` is the pure seam extracted from
 * `CLAUDE_RESTRICTED_PROVIDER.spawn` for exactly this reason.
 *
 * This provider replaces an earlier `--bare`-based draft; see the file's own docblock for the real (not
 * assumed) verification trail behind the swap — a `--safe-mode` swap was tried FIRST and independently
 * REJECTED after a real smoke test showed a `--settings=<hooks file>` layered on top of it never fires.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DELIVERY_AGENT_PROVIDERS, buildRestrictedProviderArgv,
  resolveItemSpecPathBasename, fillMinimalBrief,
  buildPrBody, writePrBody, openPr,
  runConverge, parseConvergeEditResult, buildConvergeEditorArgv,
  decideParkMode, computeLaneDiffStats,
  resolveLanePath, runGateWithOneRetry,
} from '../deliver-item-wrapper.mjs';

describe('buildRestrictedProviderArgv', () => {
  it('fresh spawn: uses --restricted (never --bare), an explicit --tools allowlist, --strict-mcp-config, '
    + '--disable-slash-commands, the given --settings file, and -p/--session-id', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'build item #1234', settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).toEqual([
      '--restricted', '--tools', 'Bash,Edit,Write,Read,Glob,Grep', '--strict-mcp-config',
      '--disable-slash-commands', '--settings', '/repo/.operations/hooks.json',
      '-p', '--session-id', 'session-1', 'build item #1234',
    ]);
  });

  it('never emits --bare — the flag this provider replaced (it requires ANTHROPIC_API_KEY/apiKeyHelper and '
    + 'cannot use the operator\'s OAuth/subscription auth)', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'build item #1234', settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).not.toContain('--bare');
  });

  it('never emits --safe-mode — independently smoke-tested and rejected: a --settings-supplied hook layered '
    + 'on top of --safe-mode does not fire (confirmed by running a guard-bash.mjs-denied command through it '
    + 'and observing it execute for real, permission_denials: [])', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'build item #1234', settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).not.toContain('--safe-mode');
  });

  it('resume: drops -p/--session-id, adds --resume <id>, but KEEPS every other flag identical to a fresh '
    + 'spawn (--resume was verified, not assumed, to preserve both auth-without-a-key and hooks-firing)', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'fix the gate failure', resumeSessionId: 'session-1',
      settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).toEqual([
      '--restricted', '--tools', 'Bash,Edit,Write,Read,Glob,Grep', '--strict-mcp-config',
      '--disable-slash-commands', '--settings', '/repo/.operations/hooks.json',
      '--resume', 'session-1', 'fix the gate failure',
    ]);
    expect(argv).not.toContain('-p');
    expect(argv).not.toContain('--session-id');
  });

  it('--tools is always the explicit allowlist, never "default" — verified: --tools=default does not '
    + 'restore what --restricted removes (a real probe asking for a Bash call under --tools=default came '
    + 'back "no shell tool available")', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 's', prompt: 'p', settingsFile: '/f.json',
    });
    const toolsIdx = argv.indexOf('--tools');
    expect(toolsIdx).toBeGreaterThanOrEqual(0);
    expect(argv[toolsIdx + 1]).toBe('Bash,Edit,Write,Read,Glob,Grep');
    expect(argv[toolsIdx + 1]).not.toBe('default');
  });

  it('--settings always carries the caller-provided hooks-file path verbatim, not a hardcoded default', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 's', prompt: 'p', settingsFile: '/some/other/path/hooks.json',
    });
    const settingsIdx = argv.indexOf('--settings');
    expect(argv[settingsIdx + 1]).toBe('/some/other/path/hooks.json');
  });
});

describe('DELIVERY_AGENT_PROVIDERS registry', () => {
  it('registers the real provider under the renamed key "claude-restricted" (was "claude-bare")', () => {
    expect(DELIVERY_AGENT_PROVIDERS['claude-bare']).toBeUndefined();
    expect(DELIVERY_AGENT_PROVIDERS['claude-restricted']).toBeDefined();
    expect(DELIVERY_AGENT_PROVIDERS['claude-restricted'].name).toBe('claude-restricted');
  });

  it('keeps the codex seam a named, deliberately-throwing placeholder (provider parity, #3627 requirement 6)', () => {
    expect(DELIVERY_AGENT_PROVIDERS.codex).toBeDefined();
    expect(() => DELIVERY_AGENT_PROVIDERS.codex.spawn()).toThrow(/no real implementation/);
  });
});

// ================================================================================================
// Gap 1 — fillMinimalBrief was a PLACEHOLDER that left `{{ITEM_SPEC_PATH_BASENAME}}`'s literal token-name
// text in the agent's prompt. It now reuses `dispatch-lane.mjs#fillBrief` for real substitution, resolving the
// item's actual backlog filename through the SAME `findItem` every other launch kind uses.
// ================================================================================================
describe('fillMinimalBrief / resolveItemSpecPathBasename (#3627 gap 1)', () => {
  const fakeLoadItems = () => [
    { num: '1234', slug: 'do-the-thing', scope: ['we:scripts/lib/foo.mjs'] },
  ];

  it('resolveItemSpecPathBasename resolves the REAL backlog filename basename via findItem, not a guess', () => {
    expect(resolveItemSpecPathBasename('1234', fakeLoadItems)).toBe('1234-do-the-thing.md');
  });

  it('resolveItemSpecPathBasename throws a named error when the item cannot be found — never substitutes a placeholder', () => {
    expect(() => resolveItemSpecPathBasename('9999', fakeLoadItems)).toThrow(/could not resolve a backlog filename for item #9999/);
  });

  it('fillMinimalBrief substitutes the REAL filename into the brief — never the literal placeholder-name string the sketch left behind', () => {
    const template = 'Read your spec at backlog/{{ITEM_SPEC_PATH_BASENAME}}. Build exactly that.';
    const prompt = fillMinimalBrief(
      template,
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: '' },
      { loadItems: fakeLoadItems },
    );
    expect(prompt).toContain('backlog/1234-do-the-thing.md');
    expect(prompt).not.toContain('{{ITEM_SPEC_PATH_BASENAME}}');
    expect(prompt).not.toContain("item's actual backlog filename for #1234");
  });

  it('fillMinimalBrief still appends the env footer after the real fillBrief substitution', () => {
    const prompt = fillMinimalBrief(
      '{{ITEM_SPEC_PATH_BASENAME}}',
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: 'b' },
      { loadItems: fakeLoadItems },
    );
    expect(prompt).toMatch(/\[env: DELIVERY_SESSION=conveyor-1234 DELIVERY_ITEM=1234 LANE=7 ATTEMPT_TAG=b\]$/);
  });

  it('fillMinimalBrief refuses (via the real fillBrief) rather than substituting a value with unsafe characters', () => {
    const unsafeLoadItems = () => [{ num: '1234', slug: 'x`echo pwned`y', scope: [] }];
    expect(() => fillMinimalBrief(
      '{{ITEM_SPEC_PATH_BASENAME}}',
      { item: '1234', sessionSlug: 's', lane: 1, attemptTag: '' },
      { loadItems: unsafeLoadItems },
    )).toThrow(/characters the brief cannot carry safely/);
  });
});

// ================================================================================================
// Gap 2 — openPr read `${lane}/.pr-body.md`, a file nothing ever wrote (ENOENT the moment a real run reached
// PR-open). `buildPrBody`/`writePrBody` now generate and write a real, minimal body first.
// ================================================================================================
describe('buildPrBody / writePrBody (#3627 gap 2)', () => {
  it('pulls the one-line summary from the delivery agent\'s own report reason, and names the item', () => {
    const body = buildPrBody({ item: '1234', report: { reason: 'Implements the missing FooBar validator.', filesTouched: [] } });
    expect(body).toContain('#1234');
    expect(body).toContain('Implements the missing FooBar validator.');
  });

  it('falls back to a generic, still-accurate summary when the report carries no reason (allowed on a `done` outcome)', () => {
    const body = buildPrBody({ item: '5678', report: { outcome: 'done', reason: null, filesTouched: [] } });
    expect(body).toContain('#5678');
    expect(body).toMatch(/Delivers item #5678/);
  });

  it('lists filesTouched when the report carries them', () => {
    const body = buildPrBody({ item: '1234', report: { reason: null, filesTouched: ['scripts/lib/foo.mjs', 'scripts/lib/__tests__/foo.test.mjs'] } });
    expect(body).toContain('scripts/lib/foo.mjs');
    expect(body).toContain('scripts/lib/__tests__/foo.test.mjs');
  });

  it('carries a standard footer identifying the mechanical pipeline', () => {
    const body = buildPrBody({ item: '1234', report: { reason: 'x', filesTouched: [] } });
    expect(body).toMatch(/#3627 minimal delivery-agent pipeline/);
  });

  it('writePrBody writes buildPrBody\'s exact content to `${lane}/.pr-body.md` and returns that path', () => {
    const writeFile = vi.fn();
    const report = { reason: 'Implements the thing.', filesTouched: [] };
    const path = writePrBody({ item: '1234', lane: '/lanes/lane-1', report }, { writeFile });
    expect(path).toBe('/lanes/lane-1/.pr-body.md');
    expect(writeFile).toHaveBeenCalledWith('/lanes/lane-1/.pr-body.md', buildPrBody({ item: '1234', report }));
  });
});

// ================================================================================================
// Gap 3 — runConverge called `converge-cli.mjs step` exactly once and returned it as if that were the whole
// loop. It now calls `init`, then loops `step` — executing whatever action is printed (`read`/`panel`/
// `edit`/`red-team`/`invite`) — until the action is genuinely `land` or `escalate`.
// ================================================================================================
describe('runConverge (#3627 gap 3 — the real loop)', () => {
  let lane;

  beforeEach(() => {
    lane = mkdtempSync(join(tmpdir(), 'deliver-item-wrapper-converge-'));
  });

  afterEach(() => {
    rmSync(lane, { recursive: true, force: true });
  });

  /** A scripted fake `run` — routes on argv shape, never on call order, so it stays correct regardless of how
   *  many times any one action's sub-driver calls it internally. `steps` is consumed in order for `step` calls
   *  only (the ONE sequence genuinely order-dependent: each `step` answers "what happens after the observation
   *  I was just fed"). */
  function fakeRun({ init, read = 'diff --git a/x b/x\n+hi\n', panel, redTeamPanel, editor, steps }) {
    let stepIdx = 0;
    const calls = [];
    const fn = vi.fn((cmd, args = [], opts) => {
      calls.push({ cmd, args, opts });
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'init') return init;
      if (cmd === 'bash') return read;
      if (cmd === 'node' && args[0] === 'skills-src/jury/panel-fanout.mjs') {
        const isRedTeam = args.some((a) => String(a).includes('-redteam'));
        return isRedTeam ? redTeamPanel : panel;
      }
      if (cmd === 'claude') return editor;
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'step') {
        if (stepIdx >= steps.length) throw new Error(`fakeRun: no scripted step left for call #${stepIdx + 1}`);
        return steps[stepIdx++];
      }
      throw new Error(`fakeRun: unexpected run(${cmd}, ${JSON.stringify(args)})`);
    });
    fn.calls = calls;
    return fn;
  }

  it('loops through read → panel → edit → red-team → land, calling `step` MORE THAN ONCE (the actual gap)', () => {
    const init = JSON.stringify({
      action: 'read', round: 1, careLevel: 'elevated', jurorsPerLens: 1, roundCap: 5,
      lenses: ['correctness'], seatableLenses: ['correctness'], mandatoryLenses: ['correctness'],
      read: { command: 'git diff', cwd: lane },
    });
    const panelStep = JSON.stringify({
      action: 'panel', round: 1, roundCap: 5,
      panel: [{ lens: 'correctness', jurors: 1, mandatory: true, mandate: 'judge it' }],
    });
    const editStep = JSON.stringify({
      action: 'edit', round: 1, roundCap: 5, edit: { prompt: 'fix the findings' },
    });
    const redTeamStep = JSON.stringify({
      action: 'red-team', round: 2, roundCap: 5,
      redTeam: { jury: [{ lens: 'correctness', prompt: 'try to break it' }] },
    });
    const landStep = JSON.stringify({ action: 'land', round: 2, roundCap: 5, verdict: 'land', dismissed: [] });

    const run = fakeRun({
      init,
      panel: JSON.stringify({ seats: [{ lens: 'correctness', ok: true, findings: [] }] }),
      redTeamPanel: JSON.stringify({ seats: [{ lens: 'correctness', ok: true, findings: [] }] }),
      editor: JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [] }) }),
      steps: [panelStep, editStep, redTeamStep, landStep],
    });

    const result = runConverge(
      { lane, item: '1234', goal: 'ship the thing' },
      { run, ensureSettingsFile: () => '/fake/hooks-settings.json' },
    );

    expect(result.action).toBe('land');
    expect(result.verdict).toBe('land');

    const stepCalls = run.calls.filter((c) => c.cmd === 'node' && c.args[1] === 'step');
    expect(stepCalls.length).toBe(4); // proves the loop, not a single call mistaken for the whole thing
    const initCalls = run.calls.filter((c) => c.cmd === 'node' && c.args[1] === 'init');
    expect(initCalls.length).toBe(1);
    expect(run.calls.some((c) => c.cmd === 'claude')).toBe(true); // the editor round actually ran
    expect(run.calls.filter((c) => c.cmd === 'node' && c.args[0] === 'skills-src/jury/panel-fanout.mjs').length).toBe(2); // panel + red-team
  });

  it('stops on `escalate` without ever needing an edit/panel round', () => {
    const init = JSON.stringify({
      action: 'read', round: 1, careLevel: 'elevated', jurorsPerLens: 1, roundCap: 5,
      lenses: ['correctness'], seatableLenses: ['correctness'], mandatoryLenses: ['correctness'],
      read: { command: 'git diff', cwd: lane },
    });
    const escalateStep = JSON.stringify({
      action: 'escalate', round: 1, roundCap: 5, verdict: null,
      reason: 'mandatory-lens-absent', dismissed: [],
    });
    const run = fakeRun({ init, steps: [escalateStep] });

    const result = runConverge({ lane, item: '1234' }, { run, ensureSettingsFile: () => '/fake/hooks.json' });

    expect(result.action).toBe('escalate');
    expect(result.reason).toBe('mandatory-lens-absent');
  });

  it('throws a named error if converge-cli reports an action this loop does not recognize (fails loud, not silently)', () => {
    const init = JSON.stringify({
      action: 'read', round: 1, careLevel: 'elevated', jurorsPerLens: 1, roundCap: 5,
      lenses: [], seatableLenses: [], mandatoryLenses: [],
      read: { command: 'git diff', cwd: lane },
    });
    const weirdStep = JSON.stringify({ action: 'teleport', round: 1, roundCap: 5 });
    const run = fakeRun({ init, steps: [weirdStep] });

    expect(() => runConverge({ lane, item: '1234' }, { run, ensureSettingsFile: () => '/fake/hooks.json' }))
      .toThrow(/action this loop does not know how to run.*teleport/s);
  });
});

describe('parseConvergeEditResult (#3627 gap 3 helper)', () => {
  it('parses the two JSON layers of a real --output-format json editor reply', () => {
    const raw = JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [{ summary: 'x', reason: 'not real' }] }) });
    expect(parseConvergeEditResult(raw)).toEqual({ advanced: true, dismissed: [{ summary: 'x', reason: 'not real' }] });
  });

  it('degrades to {advanced:false, dismissed:[]} on unparseable output — fail-closed, matches an editor-stall escalation, never throws', () => {
    expect(parseConvergeEditResult('not json at all')).toEqual({ advanced: false, dismissed: [] });
  });
});

describe('buildConvergeEditorArgv (#3627 gap 3 helper)', () => {
  it('is a FRESH restricted spawn (never --resume) carrying --output-format json for a parseable reply', () => {
    const argv = buildConvergeEditorArgv({ sessionId: 'item-converge-editor-r1', prompt: 'fix it', settingsFile: '/f.json' });
    expect(argv).toContain('--restricted');
    expect(argv).not.toContain('--safe-mode');
    expect(argv).not.toContain('--resume');
    expect(argv).toEqual(expect.arrayContaining(['--output-format', 'json']));
    expect(argv[argv.length - 1]).toBe('fix it');
  });
});

// ================================================================================================
// Gap 4 — decideParkMode skipped the real `scoreEscalation` rubric (statute-touch + needs-human-judgment only).
// It now wires in the FULL real `scoreEscalation` (`scripts/lib/review-escalation.mjs`), including diff-size
// and dismissed-finding signals, via the SAME `producerReviewLabel` mapping `pr-land.mjs` itself uses.
// ================================================================================================
describe('decideParkMode (#3627 gap 4 — the real scoreEscalation rubric)', () => {
  const noVerdict = { verdict: 'land', dismissed: [] };

  it('still parks review:human on a statute-path touch (kept as its own cheap, explicit check)', () => {
    const result = decideParkMode({
      report: { outcome: 'done' }, convergeVerdict: noVerdict,
      filesTouched: ['docs/agent/platform-decisions.md'],
    });
    expect(result).toEqual({ mode: 'park', label: 'review:human', reason: 'statute/policy-core path touched' });
  });

  it('still parks review:human on the agent\'s own needs-human-judgment outcome', () => {
    const result = decideParkMode({
      report: { outcome: 'needs-human-judgment', reason: 'a genuine taste call' }, convergeVerdict: noVerdict,
      filesTouched: ['scripts/lib/foo.mjs'],
    });
    expect(result).toEqual({ mode: 'park', label: 'review:human', reason: 'a genuine taste call' });
  });

  it('still parks review:human when converge itself escalated', () => {
    const result = decideParkMode({
      report: { outcome: 'done' }, convergeVerdict: { verdict: 'escalate', reason: 'red-team broke it', dismissed: [] },
      filesTouched: ['scripts/lib/foo.mjs'],
    });
    expect(result).toEqual({ mode: 'park', label: 'review:human', reason: 'red-team broke it' });
  });

  // NOTE — these use `reports/*.md` paths, not `scripts/*`: `scripts/` is itself a real blast-radius surface
  // in `scoreEscalation` (verified directly against `isBlastRadiusPath`), so a `scripts/` path would trip the
  // rubric for a reason unrelated to what each test below is isolating (size, dismissed-findings).

  it('calls the REAL scoreEscalation for a clean small diff and labels ready-to-merge (label-on-green)', () => {
    const run = vi.fn((cmd, args) => {
      if (args.includes('merge-base')) return 'abc123\n';
      if (args.includes('diff')) return '2\t1\treports/2026-09-09-note.md\n';
      throw new Error(`unexpected: ${cmd} ${args}`);
    });
    const result = decideParkMode(
      { report: { outcome: 'done' }, convergeVerdict: noVerdict, filesTouched: ['reports/2026-09-09-note.md'], lanePath: '/lanes/lane-1' },
      { run },
    );
    expect(result.mode).toBe('label-on-green');
    expect(result.label).toBe('ready-to-merge');
    expect(result.score.escalate).toBe(false);
  });

  it('a LARGE real diff (>= the real 400-line threshold) escalates to review:pending via the real rubric, never silently clears', () => {
    const run = vi.fn((cmd, args) => {
      if (args.includes('merge-base')) return 'abc123\n';
      if (args.includes('diff')) return '300\t200\treports/2026-09-09-big.md\n';
      throw new Error(`unexpected: ${cmd} ${args}`);
    });
    const result = decideParkMode(
      { report: { outcome: 'done' }, convergeVerdict: noVerdict, filesTouched: ['reports/2026-09-09-big.md'], lanePath: '/lanes/lane-1' },
      { run },
    );
    expect(result.mode).toBe('park');
    expect(result.label).toBe('review:pending');
    expect(result.score.escalate).toBe(true);
    expect(result.score.signals.size).toBeGreaterThanOrEqual(400);
  });

  it('dismissed converge findings (from the real convergeVerdict.dismissed) escalate to review:pending via scoreEscalation', () => {
    const run = vi.fn((cmd, args) => {
      if (args.includes('merge-base')) return 'abc123\n';
      if (args.includes('diff')) return '2\t1\treports/2026-09-09-note.md\n';
      throw new Error(`unexpected: ${cmd} ${args}`);
    });
    const result = decideParkMode(
      {
        report: { outcome: 'done' },
        convergeVerdict: { verdict: 'land', dismissed: [{ summary: 'a finding the editor dismissed', reason: 'not real' }] },
        filesTouched: ['reports/2026-09-09-note.md'],
        lanePath: '/lanes/lane-1',
      },
      { run },
    );
    expect(result.mode).toBe('park');
    expect(result.label).toBe('review:pending');
    expect(result.score.signals.dismissedFindings).toBe(1);
  });

  it('computeLaneDiffStats fails soft to {changedFiles:[], diffLines:0} when git itself fails — never crashes the park decision', () => {
    const run = vi.fn(() => { throw new Error('git exploded'); });
    const stats = computeLaneDiffStats('/lanes/lane-1', { run });
    expect(stats).toEqual({ changedFiles: [], diffLines: 0 });
  });
});

// ================================================================================================
// Bug 1 (found re-reading the file end-to-end before the first real #3371 run) — `openPr`'s PR ref carried a
// literal, never-substituted `<slug>` placeholder (`lane/${item}${attemptTag}-<slug>`), which would have
// produced an invalid ref like `lane/3371-<slug>`. `openPr` is now a PURE function of its params — the caller
// resolves the item's real slug (via `findItem`, same as `resolveItemSpecPathBasename`) and passes it in.
// ================================================================================================
describe('openPr (#3627 bug 1 — the real slug, never the literal <slug> placeholder)', () => {
  // `openPr` writes a real PR-body file via `writePrBody`'s default `writeFileSync` (gap 2's own fix), so
  // these use a real temp dir for `lane` — the same pattern the `runConverge` describe block above uses.
  let lane;
  beforeEach(() => { lane = mkdtempSync(join(tmpdir(), 'deliver-item-wrapper-openpr-')); });
  afterEach(() => { rmSync(lane, { recursive: true, force: true }); });

  it('builds the PR ref using the REAL slug handed in, never the literal "<slug>" placeholder text', () => {
    const run = vi.fn(() => JSON.stringify({ number: 42, url: 'https://example/pr/42' }));
    const report = { reason: 'x', filesTouched: [] };
    const result = openPr(
      { item: '3371', attemptTag: '', lane, park: { mode: 'label-on-green' }, report, slug: 'some-real-slug' },
      { run },
    );
    expect(result).toEqual({ number: 42, url: 'https://example/pr/42' });
    const openPrCall = run.mock.calls.find((c) => c[1]?.[1] === 'open-pr');
    expect(openPrCall).toBeDefined();
    const refFlag = openPrCall[1].find((a) => a.startsWith('--ref='));
    expect(refFlag).toBe('--ref=lane/3371-some-real-slug');
    expect(refFlag).not.toContain('<slug>');
  });

  it('includes the attemptTag between the item number and the real slug when one is given', () => {
    const run = vi.fn(() => JSON.stringify({ number: 1 }));
    openPr(
      { item: '3371', attemptTag: 'b', lane, park: { mode: 'label-on-green' }, report: { reason: 'x', filesTouched: [] }, slug: 'do-the-thing' },
      { run },
    );
    const openPrCall = run.mock.calls.find((c) => c[1]?.[1] === 'open-pr');
    const refFlag = openPrCall[1].find((a) => a.startsWith('--ref='));
    expect(refFlag).toBe('--ref=lane/3371b-do-the-thing');
  });

  it('refuses (throws a named error) rather than opening a PR with no real slug', () => {
    expect(() => openPr({ item: '3371', attemptTag: '', lane, park: { mode: 'label-on-green' }, report: { reason: 'x', filesTouched: [] } }))
      .toThrow(/needs the item's real slug/);
  });

  it('never calls findItem/the backlog loader itself — openPr is a pure function of its params (the caller resolves the slug)', () => {
    // No `loadItems` is threaded through `openPr` at all (removed from its signature on purpose) — this test
    // simply asserts the call succeeds with a bare `run` mock and no backlog-loading machinery in play.
    const run = vi.fn(() => JSON.stringify({ number: 7 }));
    expect(() => openPr(
      { item: '1234', attemptTag: '', lane, park: { mode: 'park', label: 'review:human' }, report: { reason: 'x', filesTouched: [] }, slug: 'x' },
      { run },
    )).not.toThrow();
  });
});

// ================================================================================================
// Bug 2 (found in the same re-read) — `resolveLanePath(lane)` was a hardcoded, relative-path placeholder
// (`${REPO_ROOT}/../.lanes/web-everything/lane-${lane}`) that only resolved correctly when this file happened
// to be imported from the primary checkout root; run from an isolated worktree/clone it silently computed the
// WRONG path. It now shells `scripts/lane-pool.mjs status --json` (the single source of truth
// `lane-pool-paths.mjs`/`verify-lane.mjs` already trust) via an injectable `run` and reads the real `path`
// field off the matching lane entry — never a second, re-derived path computation.
// ================================================================================================
describe('resolveLanePath (#3627 bug 2 — real lane-pool.mjs status --json lookup, not hardcoded path math)', () => {
  const statusJson = (lanes) => JSON.stringify({ repo: 'web-everything', root: '/pool', lanes });

  it('calls lane-pool.mjs status --json (via the injected run) and returns the matching lane\'s real path', () => {
    const run = vi.fn(() => statusJson([
      { lane: 1, path: '/Users/op/workspace/.lanes/web-everything/lane-1', exists: true },
      { lane: 4, path: '/Users/op/workspace/.lanes/web-everything/lane-4', exists: true },
    ]));
    const path = resolveLanePath(4, { run });
    expect(path).toBe('/Users/op/workspace/.lanes/web-everything/lane-4');
    expect(run).toHaveBeenCalledWith('node', ['scripts/lane-pool.mjs', 'status', '--json']);
  });

  it('never derives the path from hardcoded relative-path math — the returned path need not even look like ../.lanes/web-everything/lane-N', () => {
    const run = vi.fn(() => statusJson([
      { lane: 9, path: '/completely/different/pool/location/lane-9', exists: true },
    ]));
    const path = resolveLanePath(9, { run });
    expect(path).toBe('/completely/different/pool/location/lane-9');
  });

  it('throws a named error when no matching lane entry is reported, rather than falling back to a computed path', () => {
    const run = vi.fn(() => statusJson([{ lane: 1, path: '/pool/lane-1', exists: true }]));
    expect(() => resolveLanePath(2, { run })).toThrow(/no entry\/path for lane-2/);
  });
});

describe('runGateWithOneRetry (#3627 bug 2 — threads the injected run through to resolveLanePath)', () => {
  it('uses the injected run for BOTH the lane-pool.mjs status lookup and the gate itself, and runs the gate in the resolved (not hardcoded) lane path', () => {
    const run = vi.fn((cmd, args, opts) => {
      if (args[0] === 'scripts/lane-pool.mjs') {
        return JSON.stringify({ repo: 'web-everything', root: '/pool', lanes: [{ lane: 3, path: '/real/pool/lane-3', exists: true }] });
      }
      if (args[0] === 'scripts/verify-lane.mjs') {
        expect(opts.cwd).toBe('/real/pool/lane-3'); // the RESOLVED path, never the hardcoded ../.lanes guess
        return '{"status":"green"}';
      }
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const result = runGateWithOneRetry({ lane: 3, item: '3371', sessionSlug: 'conveyor-3371' }, { run });
    expect(result).toEqual({ status: 'green', lanePath: '/real/pool/lane-3' });
    const statusCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/lane-pool.mjs');
    expect(statusCall).toBeDefined();
    expect(statusCall[1]).toEqual(['scripts/lane-pool.mjs', 'status', '--json']);
  });
});
