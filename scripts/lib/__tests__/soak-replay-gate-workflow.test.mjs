// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';

const workflow = yaml.load(readFileSync(new URL('../../../.github/workflows/soak-replay-gate.yml', import.meta.url), 'utf8'));
const steps = workflow.jobs['soak-replay-gate'].steps;
const step = steps.find((s) => s.env?.PR_TITLE);
const evaluator = new URL('../soak-replay-gate.mjs', import.meta.url).href;
const roots = [];
const title = 'fix(daemon): recover a lost candidate';
const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
const fork = 'c'.repeat(40);
const filesStatus = 'M\tscripts/lib/daemon-rebuild.mjs';
const waiver = 'soak-waiver: transport-only regression fixture';

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Substitutes exist only in the temporary fixture. Execute the parsed workflow's actual shell,
// capturing its argv and passing its transported body to the real gate evaluator.
function fixture(branch, eventBody = '') {
  const root = mkdtempSync(join(tmpdir(), 'soak-workflow-'));
  roots.push(root);
  mkdirSync(join(root, 'bin'));
  mkdirSync(join(root, 'scripts'));
  if (branch !== 'absent') writeFileSync(join(root, 'scripts/soak-replay-gate-cli.mjs'), branch === 'modern' ? '// base-sha' : '// legacy');
  const executable = (name, source) => writeFileSync(join(root, 'bin', name), `#!${process.execPath}\n${source}`, { mode: 0o755 });
  executable('gh', `
    const fs = require('node:fs');
    fs.appendFileSync('api.jsonl', JSON.stringify({ args: process.argv.slice(2), token: process.env.GH_TOKEN }) + '\\n');
    if (process.env.API_FAILURE === '1') { console.error('API/auth/parse failure'); process.exit(1); }
    const response = JSON.parse(fs.readFileSync('response.json', 'utf8'));
    process.stdout.write((response.body ?? '') + '\\n');
  `);
  executable('git', `
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    fs.appendFileSync('git.jsonl', JSON.stringify(args) + '\\n');
    if (args[0] === 'merge-base') console.log(${JSON.stringify(fork)});
    if (args[0] === 'diff') console.log(${JSON.stringify(filesStatus)});
  `);
  executable('node', `
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    fs.appendFileSync('node.jsonl', JSON.stringify(args) + '\\n');
    const value = key => args.find(a => a.startsWith('--' + key + '='))?.slice(key.length + 3);
    import(${JSON.stringify(evaluator)}).then(({ evaluateSoakReplayGate }) => {
      const verdict = evaluateSoakReplayGate({ title: value('title'), body: value('body'),
        files: [{ path: 'scripts/lib/daemon-rebuild.mjs', changeType: 'MODIFIED' }] });
      console.log(JSON.stringify(verdict));
      process.exit(verdict.ok ? 0 : 1);
    });
  `);
  const log = name => existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8').trim().split('\n').map(JSON.parse) : [];
  return {
    root, log,
    run(body, failure = false) {
      writeFileSync(join(root, 'response.json'), JSON.stringify({ body }));
      return spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run], {
        cwd: root, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`,
          PR_TITLE: title, PR_BODY: eventBody, BASE_SHA: base, HEAD_SHA: head,
          GH_TOKEN: 'fixture-token', PR_REPO: 'fixture/repo', PR_NUMBER: '42', API_FAILURE: failure ? '1' : '0' },
      });
    },
  };
}

describe('soak workflow live PR body transport', () => {
  it('retains event triggers, main ancestry, and read-only authenticated PR bindings', () => {
    expect(workflow.on.pull_request.types).toEqual(['opened', 'synchronize', 'reopened', 'edited']);
    expect(workflow.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' });
    expect(steps.find(s => s.uses?.startsWith('actions/checkout@')).with).toEqual({ ref: 'main', 'fetch-depth': 0 });
    expect(step.env).toEqual({
      PR_TITLE: '${{ github.event.pull_request.title }}',
      BASE_SHA: '${{ github.event.pull_request.base.sha }}', HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      GH_TOKEN: '${{ github.token }}', PR_REPO: '${{ github.repository }}', PR_NUMBER: '${{ github.event.pull_request.number }}',
    });
  });

  describe.each(['modern', 'legacy'])('%s CLI', branch => {
    it.each(['', waiver])('replays red → clear → red with a fixed event body %j and fresh API reads', eventBody => {
      const f = fixture(branch, eventBody);
      const bodies = ['', waiver, ''];
      expect(bodies.map(body => f.run(body).status)).toEqual([1, 0, 1]);
      expect(f.log('api.jsonl')).toEqual(bodies.map(() => ({ args: ['api', 'repos/fixture/repo/pulls/42', '--jq', '.body // ""'], token: 'fixture-token' })));
      expect(f.log('node.jsonl')).toEqual(bodies.map(body => [
        'scripts/soak-replay-gate-cli.mjs', `--title=${title}`, `--body=${body}`,
        ...(branch === 'modern' ? [`--base-sha=${base}`, `--head-sha=${head}`] : [`--files-status=${filesStatus}`]),
      ]));
      const gitCalls = [['fetch', 'origin', head], ...(branch === 'modern' ? [] : [
        ['merge-base', base, head], ['diff', '--name-status', '-M', fork, head],
      ])];
      expect(f.log('git.jsonl')).toEqual(bodies.flatMap(() => gitCalls));
    });

    it.each([null, '', 'soak-waiver:   '])('keeps empty/null/blank-waiver body %j red', body => {
      const f = fixture(branch, waiver);
      expect(f.run(body).status).toBe(1);
      expect(f.log('node.jsonl')[0][2]).toBe(`--body=${body ?? ''}`);
    });

    it('transports multiline markdown and shell metacharacters literally', () => {
      const f = fixture(branch);
      const body = '## Fix\n"double" and \'single\'\n`touch executed` $(touch executed) $HOME\n' + waiver;
      expect(f.run(body).status).toBe(0);
      expect(f.log('node.jsonl')[0][2]).toBe(`--body=${body}`);
      expect(existsSync(join(f.root, 'executed'))).toBe(false);
    });

    it('fails retrieval explicitly without evaluating or falling back to an event waiver', () => {
      const f = fixture(branch, waiver);
      const result = f.run('', true);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/failed to retrieve.*PR body/i);
      expect(f.log('api.jsonl')).toHaveLength(1);
      expect(f.log('node.jsonl')).toEqual([]);
    });
  });

  it('preserves the script-absent bootstrap before attempting retrieval', () => {
    const f = fixture('absent');
    const result = f.run('', true);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('not bootstrapped');
    expect(f.log('api.jsonl')).toEqual([]);
    expect(f.log('node.jsonl')).toEqual([]);
  });
});
